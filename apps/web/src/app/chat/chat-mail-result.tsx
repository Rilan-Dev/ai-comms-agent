"use client";
import {useEffect,useRef,useState} from 'react';
import {MailReview} from '@/components/mail-review';
import {normalizeManualComposeSnapshot,type ManualComposeSnapshot} from '@/lib/mail/manual-compose-review';
import {validateChatEmailApproval,type ChatEmailApproval} from '@/lib/chat/inline-mail-approval';
import type {ChatMailReference} from '@/lib/chat/mail-result-references';
import {InlineMailApprovalReview} from './chat-inline-mail-approval';
import {readJsonWithTimeout} from '@/lib/streaming/scoped-request';

type Draft={id:string;accountId:string;sender:string;snapshot:ManualComposeSnapshot};
export function parseDraft(value:unknown,id:string):Draft|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const d=value as Record<string,unknown>;
 const snapshot=normalizeManualComposeSnapshot({to:d.to_recipients,cc:d.cc_recipients,bcc:d.bcc_recipients,subject:d.subject,bodyText:d.text_body});
 return d.id===id&&d.is_draft===true&&typeof d.email_account_id==='string'&&typeof d.account_email==='string'&&snapshot
  ?{id,accountId:d.email_account_id,sender:d.account_email,snapshot:{to:d.to_recipients as string[],cc:(d.cc_recipients??[]) as string[],bcc:(d.bcc_recipients??[]) as string[],subject:d.subject as string,bodyText:d.text_body as string}}:null;
}
export function ChatMailResult({reference,organizationId,agentId}:{reference:ChatMailReference;organizationId:string;agentId:string}){
 const [draft,setDraft]=useState<Draft|null>(null);const [approval,setApproval]=useState<ChatEmailApproval|null>(null);
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const inflight=useRef(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();setDraft(null);setApproval(null);setNotice('');
  const query=new URLSearchParams({organizationId,[reference.kind==='draft'?'draftId':'actionId']:reference.id});
  const endpoint=reference.kind==='draft'?'/api/mail/drafts?':'/api/mail/actions?';
  void readJsonWithTimeout<{draft?:unknown;action?:any}>(endpoint+query,controller.signal).then(data=>{
   if(reference.kind==='draft'){const d=parseDraft(data.draft,reference.id);if(!d)throw Error('This draft is no longer available for review.');if(active)setDraft(d);}
   else {const a=data.action;const type=a?.actionType;if(!['send_email','reply_email','forward_email'].includes(type))throw Error('This request cannot be reviewed here.');const verified=validateChatEmailApproval(a,{actionId:reference.id,draftId:a?.draftId,accountId:a?.emailAccountId,actionType:type});if(!verified)throw Error('This request is no longer awaiting review.');if(active)setApproval(verified);}
  }).catch(error=>{if(active)setNotice(error instanceof Error?error.message:'Could not load the saved email.');});
  return()=>{active=false;controller.abort();};
 },[organizationId,reference.id,reference.kind,reload]);
 async function requestApproval(){
  if(!draft||inflight.current||approval)return;
  if(!window.confirm('Request human approval for the saved email shown? Nothing will be sent until an authorized reviewer approves.'))return;
  inflight.current=true;setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/chat/mail-compose',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json'},body:JSON.stringify({organizationId,agentId,action:'request_approval',accountId:draft.accountId,draftId:draft.id})});
   const data=await response.json();if(!response.ok||data.status!=='pending_approval'||typeof data.actionId!=='string')throw Error(data.message??'The request was not confirmed. Refresh its status before retrying.');
   const query=new URLSearchParams({organizationId,actionId:data.actionId});const check=await fetch('/api/mail/actions?'+query,{cache:'no-store',signal:AbortSignal.timeout(15000)});const result=await check.json();
   const verified=check.ok?validateChatEmailApproval(result.action,{actionId:data.actionId,draftId:draft.id,accountId:draft.accountId}):null;
   if(!verified)throw Error('Request created, but its current review status could not be loaded. Refresh before retrying.');
   setApproval(verified);setNotice('Ready for human review.');
  }catch(error){setDraft(null);setNotice((error instanceof Error?error.message:'Could not confirm the request.')+' Refresh Drafts and approvals to check its current status.');}finally{inflight.current=false;setBusy(false);}
 }
 return <section aria-label="Email in this conversation" className="mt-3 rounded-xl border bg-card p-4">
  {!draft&&!approval&&!notice&&<p role="status" className="text-sm">Loading saved email…</p>}
  {draft&&!approval&&<><h3 className="mb-3 text-sm font-semibold">Saved draft</h3><MailReview sender={draft.sender} snapshot={draft.snapshot}/><button type="button" disabled={busy} onClick={()=>void requestApproval()} className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">{busy?'Preparing review…':'Request send approval'}</button></>}
  {approval&&<InlineMailApprovalReview organizationId={organizationId} actionId={approval.id} draftId={approval.draftId} accountId={approval.emailAccountId} actionType={approval.actionType} autoLoad onApprovalConfirmed={()=>setNotice('Approval accepted for processing. Delivery is not yet confirmed.')}/>}
  {notice&&<p role="status" className="mt-3 text-xs text-muted-foreground">{notice} {!approval&&<button type="button" className="underline" onClick={()=>setReload(n=>n+1)}>Reload status</button>}</p>}
 </section>;
}
