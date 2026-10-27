import {it,expect,vi} from 'vitest';
import {parseSavedDraftApproval,requestSavedDraftApproval} from '../src/lib/chat/saved-draft-approval';
const id='50000000-0000-4000-8000-000000000001';
const text=`Request human approval to send saved email draft ${id} to qa@example.test. Keep it pending for human review; do not send it automatically.`;
it('recognizes a complete current approval request without promoting quoted bodies or extra commands',()=>{
 expect(parseSavedDraftApproval(text)).toEqual({draftId:id,recipient:'qa@example.test'});
 for(const message of [`Send saved email draft ${id}`,`Body: "${text}"`,text+' Also change the body.',`Request human approval to send that draft`])expect(parseSavedDraftApproval(message)).toBeNull();
});
it('reads the existing draft and requests human review once, without composing or sending',async()=>{
 const read=vi.fn(async(name:string)=>name==='email.accounts.list'?{ok:true,output:[{id:'account'}]}:{ok:true,output:{id,email_account_id:'account',is_draft:true,to_addresses:['qa@example.test']}});
 const request=vi.fn(async(input:unknown)=>({ok:true,output:{status:'pending_approval'},input}));
 await requestSavedDraftApproval({draftId:id,recipient:'qa@example.test'},{read,request});
 expect(read.mock.calls.map(([name])=>name)).toEqual(['email.accounts.list','email.message.get']);
 expect(request.mock.calls).toEqual([[{account_id:'account',draft_id:id}]]);
});
it('does not request review after permission denial or recipient mismatch',async()=>{
 for(const fail of ['denied','recipient']){
  const read=vi.fn(async(name:string)=>name==='email.accounts.list'?{ok:true,output:[{id:'account'}]}:fail==='denied'?{ok:false,error:{code:'permission_denied'}}:{ok:true,output:{id,email_account_id:'account',is_draft:true,to_addresses:['other@example.test']}});
  const request=vi.fn();await expect(requestSavedDraftApproval({draftId:id,recipient:'qa@example.test'},{read,request})).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 }
});
it('continues only past an authenticated message-not-found result in another bound account',async()=>{
 const read=vi.fn(async(name:string,input:Record<string,unknown>)=>name==='email.accounts.list'?{ok:true,output:[{id:'wrong'},{id:'right'}]}:input.account_id==='wrong'?{ok:false,error:{code:'message_not_found'}}:{ok:true,output:{id,email_account_id:'right',is_draft:true,to_addresses:['qa@example.test']}});
 const request=vi.fn(async()=>({ok:true}));await requestSavedDraftApproval({draftId:id},{read,request});expect(request.mock.calls).toEqual([[{account_id:'right',draft_id:id}]]);
});
