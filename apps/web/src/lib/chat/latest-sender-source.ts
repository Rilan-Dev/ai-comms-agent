import type {EmailToolRuntime} from '@ai-comms-agent/email-agent-runtime';
type Result={ok:boolean;output?:unknown};
type Invoke=(name:string,input:Record<string,unknown>)=>Promise<Result>;
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const timestamp=(value:unknown)=>value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;
export class LatestSenderLookupError extends Error{}
const lookupError=()=>new LatestSenderLookupError('Could you check this agent’s mailbox access? The latest-email lookup could not be completed.');

export function authorizeSelectedReply(authorize:EmailToolRuntime['authorize'],selected:{accountId:string;messageId:string}):EmailToolRuntime['authorize']{
 return async(tool,input,context)=>{
  const fields=object(input)??{};
  if(tool.name!=='email.draft_reply'||fields.account_id!==selected.accountId||fields.message_id!==selected.messageId)
    return {allowed:false,code:'reply_source_mismatch',message:'Use email.draft_reply with the exact account_id and message_id from the completed source lookup. This request may only save that reply draft.'};
  return authorize(tool,input,context);
 };
}

/** Host-owned discovery only. The caller invokes these registered safe reads
 * through its existing authenticated executor and records every call. This
 * helper neither authorizes tools nor creates drafts or send requests. */
export async function resolveLatestSenderSource(sender:string,invoke:Invoke):Promise<{accountId:string;messageId:string}>{
 if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(sender))throw lookupError();
 const accounts=await invoke('email.accounts.list',{});
 if(!accounts.ok||!Array.isArray(accounts.output))throw lookupError();
 if(!accounts.output.length||accounts.output.length>4)throw new LatestSenderLookupError('Which mailbox should I use? Please narrow the latest-email lookup.');
 const candidates:Array<{accountId:string;messageId:string;at:number}>=[];
 const seen=new Set<string>();
 for(const account of accounts.output){
  const accountId=object(account)?.id;if(typeof accountId!=='string'||!accountId||seen.has(accountId))throw lookupError();seen.add(accountId);
  const result=await invoke('email.search',{account_id:accountId,from:sender,limit:10});
  const output=object(result.output);if(!result.ok||!Array.isArray(output?.messages)||typeof output.has_more!=='boolean')throw lookupError();
  const exact=output.messages.map(object).filter(row=>typeof row?.from_address==='string'&&row.from_address.toLowerCase()===sender.toLowerCase());
  const matches=exact.map(row=>{
   const at=timestamp(row?.received_at);
   if(row?.email_account_id!==accountId||typeof row.id!=='string'||!row.id||row.is_draft!==false||row.is_outbound!==false||!Number.isFinite(at))throw lookupError();
   return {accountId,messageId:row.id,at};
  }).sort((a,b)=>b.at-a.at);
  if(output.has_more){
   const last=object(output.messages.at(-1));const lastAt=timestamp(last?.received_at);
   if(!matches.length||!Number.isFinite(lastAt)||lastAt>=matches[0]!.at)throw new LatestSenderLookupError('Which email should I reply to? Please narrow the mailbox or email selection.');
  }
  candidates.push(...matches);
 }
 candidates.sort((a,b)=>b.at-a.at);const selected=candidates[0];
 if(!selected)throw new LatestSenderLookupError('Which email should I reply to? No exact matching incoming email was found in the current synchronized mailboxes.');
 if(candidates[1]?.at===selected.at)throw new LatestSenderLookupError('Which email should I reply to? More than one latest email matches.');
 const result=await invoke('email.message.get',{account_id:selected.accountId,message_id:selected.messageId});
 const source=object(result.output);
 if(!result.ok||source?.id!==selected.messageId||source.email_account_id!==selected.accountId
  ||typeof source.from_address!=='string'||source.from_address.toLowerCase()!==sender.toLowerCase()
  ||source.is_draft!==false||source.is_outbound!==false||timestamp(source.received_at)!==selected.at)throw new LatestSenderLookupError('Which email should I reply to? The selected email changed during lookup; refresh before preparing a reply.');
 return {accountId:selected.accountId,messageId:selected.messageId};
}
