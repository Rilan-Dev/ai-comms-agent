export type SavedDraftApproval={draftId:string;recipient?:string};
type Result={ok:boolean;output?:unknown;error?:{code:string}};
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
export class SavedDraftApprovalLookupError extends Error{}
const unavailable=()=>new SavedDraftApprovalLookupError('Could you check the draft and mailbox access? The saved-draft review request could not be prepared.');

/** Parse only a complete current user command. Additional editing instructions,
 * quoted mail and unresolved references must retain the normal chat flow. */
export function parseSavedDraftApproval(text:string):SavedDraftApproval|null{
 const match=/^(?:please\s+)?(?:request|prepare)\s+(?:human\s+)?approval\s+to\s+send\s+(?:the\s+)?saved\s+(?:email\s+)?draft\s+([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\s+to\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}))?([\s\S]*)$/i.exec(text.trim());
 if(!match)return null;
 const suffix=match[3]!.replace(/\bkeep\s+it\s+pending\s+for\s+human\s+review\b/gi,'').replace(/\bdo\s+not\s+send\s+it\s+automatically\b/gi,'');
 if(!/^[\s.,;!]*$/.test(suffix))return null;
 return {draftId:match[1]!,...(match[2]?{recipient:match[2]}:{})};
}

/** Existing authenticated, registered tools remain the only I/O boundary.
 * The request callback must force human approval independently of auto mode. */
export async function requestSavedDraftApproval<T extends Result>(command:SavedDraftApproval,deps:{
 read:(name:string,input:Record<string,unknown>)=>Promise<Result>;
 request:(input:{account_id:string;draft_id:string})=>Promise<T>;
}):Promise<T>{
 const accounts=await deps.read('email.accounts.list',{});
 if(!accounts.ok||!Array.isArray(accounts.output)||!accounts.output.length)throw unavailable();
 if(accounts.output.length>4)throw new SavedDraftApprovalLookupError('Which mailbox contains the saved draft? Narrow the mailbox selection before requesting review.');
 const seen=new Set<string>();
 for(const account of accounts.output){
  const id=object(account)?.id;if(typeof id!=='string'||!id||seen.has(id))throw unavailable();seen.add(id);
  const result=await deps.read('email.message.get',{account_id:id,message_id:command.draftId});
  if(!result.ok){if(result.error?.code==='message_not_found')continue;throw unavailable();}
  const draft=object(result.output);
  if(draft?.id!==command.draftId||draft.email_account_id!==id||draft.is_draft!==true)throw unavailable();
  if(command.recipient&&(!Array.isArray(draft.to_addresses)||!draft.to_addresses.some(value=>typeof value==='string'&&value.trim().toLowerCase()===command.recipient!.toLowerCase())))
    throw new SavedDraftApprovalLookupError('Which recipient should this saved draft use? Its saved recipient does not match your request.');
  return deps.request({account_id:id,draft_id:command.draftId});
 }
 throw new SavedDraftApprovalLookupError('Which saved draft should I use? That draft is not available in the current mailboxes.');
}
