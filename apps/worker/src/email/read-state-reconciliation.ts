import type {EmailMessageFlags} from '@ai-comms-agent/shared';

type Page={nextCursor?:string|null;messages:Array<{providerMessageId:string;messageIdHeader:string|null}>};
type Result={flags:EmailMessageFlags[];missing:string[];refetched:Array<{providerMessageId:string;messageIdHeader:string|null}>};
type Dependencies<P extends Page>={
  prepare:()=>Promise<P|null>;
  fetchFlags:(ids:string[])=>Promise<unknown>;
  withLease:(page:P,work:()=>Promise<void>)=>Promise<void>;
  /** Persist canonical content first; undefined means confirmed provider absence. */
  refetch:(id:string)=>Promise<string|null|undefined>;
  remove:(ids:string[])=>Promise<void>;
  complete:(page:P,result:Result)=>Promise<void>;
};
const identity=(value:string|null)=>value?.trim()||null;

/** Provider metadata can update local state, never provider read state or user review. */
export async function reconcileReadState<P extends Page>(deps:Dependencies<P>,imap:boolean,enabled=true):Promise<'completed'|'pending'|'unavailable'>{
  if(!enabled)return 'unavailable';
  const page=await deps.prepare();if(!page)return 'unavailable';
  const expected=new Map(page.messages.map(message=>[message.providerMessageId,message]));
  const response=await deps.fetchFlags([...expected.keys()]);
  if(!Array.isArray(response))throw new Error('Invalid provider flag response');
  const observed=new Set<string>();
  for(const value of response){
    if(!value||typeof value!=='object'||!expected.has(value.provider_message_id)||observed.has(value.provider_message_id)
      ||![value.is_read,value.is_starred,value.is_draft,value.is_outbound].every(flag=>typeof flag==='boolean')
      ||!(value.message_id_header===null||typeof value.message_id_header==='string'))throw new Error('Invalid provider flag coverage');
    observed.add(value.provider_message_id);
  }
  const result:Result={flags:[],missing:[...expected.keys()].filter(id=>!observed.has(id)),refetched:[]};
  await deps.withLease(page,async()=>{
   for(const flag of response as EmailMessageFlags[]){
    const original=expected.get(flag.provider_message_id)!;
    if(identity(flag.message_id_header)!==identity(original.messageIdHeader)||(imap&&!identity(original.messageIdHeader))){
      const refetched=await deps.refetch(flag.provider_message_id);
      if(refetched===undefined)result.missing.push(flag.provider_message_id);
      else result.refetched.push({providerMessageId:flag.provider_message_id,messageIdHeader:refetched});
    }else result.flags.push(flag);
  }
   if(result.missing.length)await deps.remove(result.missing);
  });
  await deps.complete(page,result);return page.nextCursor?'pending':'completed';
}
