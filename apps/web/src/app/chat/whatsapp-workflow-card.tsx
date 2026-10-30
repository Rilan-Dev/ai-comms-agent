'use client';

import {useEffect,useRef,useState} from 'react';
import {canEditWorkflow,canRenewWorkflow,readWhatsAppWidget,workflowStatusLabel,type WhatsAppWidget,type WorkflowCommand} from '@/lib/chat/whatsapp-workflow-contract';

type View='home'|'setup'|'recipient'|'message'|'review';
type Props={messageId:string;organizationId:string;agentId:string;conversationId:string;initial:WhatsAppWidget;disabled:boolean};
const button='rounded-lg border px-3 py-2 text-sm text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed';
export function WhatsAppWorkflowCard({messageId,organizationId,agentId,conversationId,initial,disabled}:Props){
 const [widget,setWidget]=useState(initial),[view,setView]=useState<View>(initial.readiness?'setup':'home'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[signInNeeded,setSignInNeeded]=useState(false);
 const [recipient,setRecipient]=useState(initial.recipient),[body,setBody]=useState(initial.body);
 const heading=useRef<HTMLHeadingElement>(null),inFlight=useRef(false),abort=useRef<AbortController|null>(null);
 const endpoint=`/api/chat/widgets/${encodeURIComponent(messageId)}?${new URLSearchParams({organizationId,agentId,conversationId})}`;
 function accept(value:unknown){const next=readWhatsAppWidget({ui:value});if(next){setWidget(next);setRecipient(next.recipient);setBody(next.body);}return next;}
 useEffect(()=>{const controller=new AbortController();void fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{if(response.ok)accept((await response.json()).widget);}).catch(()=>{});return()=>{controller.abort();abort.current?.abort();};},[endpoint]);
 useEffect(()=>{if(view!=='home')heading.current?.focus();},[view]);
 async function run(action:WorkflowCommand['action'],input?:WorkflowCommand['input']){
  if(disabled||inFlight.current)return null;
  inFlight.current=true;setBusy(true);setNotice('');
  const controller=new AbortController();abort.current=controller;
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,revision:widget.revision,...(input?{input}:{})}),signal:controller.signal});
   if(response.status===401){setSignInNeeded(true);setNotice('Your session expired. Sign in to continue with this saved review.');return null;}
   const data=await response.json();const updated=accept(data.widget);
   if(!response.ok){setNotice(typeof data.message==='string'?data.message:'This card changed. Reload its saved state before continuing.');if(!updated){const current=await fetch(endpoint,{cache:'no-store',signal:controller.signal});if(current.ok)accept((await current.json()).widget);}return null;}
   return updated;
  }catch{if(!controller.signal.aborted)setNotice('The result could not be confirmed. Your message is still here. Check status before trying again.');return null;}
  finally{inFlight.current=false;if(!controller.signal.aborted)setBusy(false);}
 }
 const locked=disabled||busy,editable=canEditWorkflow(widget.status),readiness=widget.readiness;
 const canReview=editable&&!!widget.recipient&&!!widget.body.trim();
 async function inspect(){setView('setup');await run('inspect');}
 async function review(){const next=await run('review');setView(next?.status==='review'?'review':'setup');}
 return <section aria-label="WhatsApp assistant workflow" className="mt-4 rounded-xl border bg-card p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">{({home:'WhatsApp message',setup:'WhatsApp setup',recipient:'Choose the recipient',message:'Edit your message',review:'Review before requesting approval'})[view]}</h3>
   <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{workflowStatusLabel(widget.status)}</span>
  </div>
  <div role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">{busy?'Checking saved details…':notice||widget.notice||
   (widget.status==='pending'?'Review the exact message below. Approve only when you are ready to send.':widget.status==='queued'?'Queued for sending. Delivery is not confirmed yet.':widget.status==='sent'?'The provider accepted this message. This is not a delivery receipt.':widget.status==='unknown'?'Check status to recover the saved result. A new message will not be sent by this check.':editable?'Choose what you need below. You can complete the review here in Chat.':'This request is no longer editable. Check its latest status below.')}</div>
  {signInNeeded&&<a className={`${button} mt-3 inline-block`} href="/login?next=%2Fchat">Sign in to continue</a>}
  {canRenewWorkflow(widget)&&<button type="button" className={`${button} mt-3`} disabled={locked} onClick={()=>void run('renew').then(next=>{if(next)setView('home');})}>Start a fresh review</button>}
  {view!=='home'&&<button type="button" className="mt-3 text-xs underline" disabled={locked} onClick={()=>setView('home')}>← Back to message</button>}
  {view==='home'&&<div className="mt-4 grid gap-2 sm:grid-cols-2">
   {editable&&<><button type="button" className={`${button} sm:col-span-2`} disabled={locked} onClick={()=>void inspect()}>Check my WhatsApp setup</button>
   <button type="button" className={button} disabled={locked} onClick={()=>setView('recipient')}>{widget.recipient?'Edit recipient':'Add recipient'}</button>
   <button type="button" className={button} disabled={locked} onClick={()=>setView('message')}>{widget.body?'Edit message':'Write message'}</button>
   {canReview&&<button type="button" className={button} disabled={locked} onClick={()=>void review()}>Review message</button>}</>}
   {!editable&&<button type="button" className={button} disabled={locked} onClick={()=>void run('refresh')}>Check request status</button>}
  </div>}
  {view==='setup'&&<div className="mt-4 space-y-3">
   <dl className="space-y-3 text-sm">
    <div className="flex justify-between gap-3"><dt>Sending phone</dt><dd>{readiness?.accountLabel??'Not confirmed'}</dd></div>
    <div className="flex justify-between gap-3"><dt>Connection</dt><dd>{!readiness?'Not checked':readiness.state==='unavailable'?'Check unavailable':readiness.connected?'Connected':'Needs attention'}</dd></div>
    <div className="flex justify-between gap-3"><dt>Sending access</dt><dd>{!readiness?'Not checked':readiness.canRequestSend?'Available':readiness.state==='bound_without_permission'?'Permission needed':'Not ready'}</dd></div>
    <div className="flex justify-between gap-3"><dt>Free-form message window</dt><dd>{readiness?.windowOpen===true?'Open':readiness?.windowOpen===false?'Closed':'Choose a recipient to check'}</dd></div>
   </dl>
   {readiness&&<p className="rounded-lg bg-muted p-3 text-sm">{readiness.message}</p>}
   <div className="flex flex-wrap gap-2">
    <button type="button" className={button} disabled={locked} onClick={()=>void run('inspect')}>Check again</button>
    {!widget.recipient&&<button type="button" className={button} disabled={locked} onClick={()=>setView('recipient')}>Add recipient</button>}
    {!widget.body&&<button type="button" className={button} disabled={locked} onClick={()=>setView('message')}>Write message</button>}
    {canReview&&readiness?.state==='ready'&&<button type="button" className={button} disabled={locked} onClick={()=>void review()}>Review message</button>}
    {readiness?.state==='disconnected'&&<a href={`/agents/${encodeURIComponent(agentId)}?tab=channels`} className={button}>Choose an assigned phone</a>}
    {readiness?.state==='bound_without_permission'&&<a href={`/agents/${encodeURIComponent(agentId)}?tab=policy`} className={button}>Review assistant permissions</a>}
    {(readiness?.state==='provider_error'||readiness?.state==='template_required')&&<a href="/whatsapp" className={button}>{readiness.state==='template_required'?'Choose an approved template':'Repair phone connection'}</a>}
   </div>
  </div>}
  {view==='recipient'&&<form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();void run('save',{recipient:recipient.trim(),body:widget.body}).then(next=>{if(next)setView('home');});}}>
   <label className="block text-sm">Recipient number<input autoComplete="tel" type="tel" required pattern="\+[1-9][0-9]{7,14}" maxLength={16} value={recipient} onChange={event=>setRecipient(event.target.value)} disabled={locked||!editable} className="mt-1 block w-full rounded-lg border bg-background p-3" placeholder="+Country code and phone number" /></label>
   <button className={button} disabled={locked||!editable}>Save recipient</button>
  </form>}
  {view==='message'&&<form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();void run('save',{recipient:widget.recipient,body}).then(next=>{if(next)setView('home');});}}>
   <label className="block text-sm">Message content<textarea required maxLength={4096} rows={4} value={body} onChange={event=>setBody(event.target.value)} disabled={locked||!editable} className="mt-1 block w-full rounded-lg border bg-background p-3" placeholder="Write the exact message to review" /></label>
   <button className={button} disabled={locked||!editable||!body.trim()}>Save message</button>
  </form>}
  {(view==='review'||!editable)&&<div className="mt-4 space-y-3 rounded-lg border p-3">
   <p className="text-xs text-muted-foreground">{widget.accountLabel??'Saved sending phone'} → {widget.recipient||'Recipient not set'}</p>
   <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">{widget.body||'No message content saved.'}</p>
   {view==='review'&&widget.status==='review'&&<button type="button" className={`${button} bg-primary text-primary-foreground`} disabled={locked} onClick={()=>void run('request').then(()=>setView('home'))}>Request human approval</button>}
   {widget.status==='pending'&&<div className="flex flex-wrap gap-2"><button type="button" className={`${button} bg-primary text-primary-foreground`} disabled={locked} onClick={()=>void run('approve')}>Approve and send</button><button type="button" className={button} disabled={locked} onClick={()=>void run('reject')}>Decline</button></div>}
   {widget.status==='approved'&&<button type="button" className={button} disabled={locked} onClick={()=>void run('approve')}>Resume approved send</button>}
  </div>}
  <details className="mt-4 text-xs text-muted-foreground"><summary>Request details</summary><p className="mt-1 break-all">Reference: {widget.reference}</p><p>Saved revision {widget.revision}. {widget.actionId?'Request: '+widget.actionId:'No approval linked to this card yet.'}</p></details>
 </section>;
}
