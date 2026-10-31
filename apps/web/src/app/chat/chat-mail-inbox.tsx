"use client";
import {useEffect,useState} from 'react';
import {ChatMailResult} from './chat-mail-result';
import type {ChatMailReference} from '@/lib/chat/mail-result-references';
import {readJsonWithTimeout} from '@/lib/streaming/scoped-request';
type Item={reference:ChatMailReference;label:string};
export function ChatMailInbox({organizationId,agentId,onClose}:{organizationId:string;agentId:string;onClose:()=>void}){
 const [items,setItems]=useState<Item[]>([]);const [selected,setSelected]=useState<ChatMailReference|null>(null);const [status,setStatus]=useState('Loading saved emails…');const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setItems([]);setSelected(null);setStatus('Loading saved emails…');
  const query='?organizationId='+encodeURIComponent(organizationId);
  void Promise.allSettled(['/api/mail/drafts','/api/mail/approvals'].map(url=>readJsonWithTimeout<{drafts?:any[];actions?:any[]}>(url+query,controller.signal))).then(results=>{
   if(!active)return;const rows:Item[]=[];
   const draftResult=results[0];const actionResult=results[1];
   const drafts=draftResult?.status==='fulfilled'&&Array.isArray(draftResult.value.drafts)?draftResult.value.drafts:[];
   const actions=actionResult?.status==='fulfilled'&&Array.isArray(actionResult.value.actions)?actionResult.value.actions:[];
   const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   for(const a of actions)if(a&&['send_email','reply_email','forward_email'].includes(a.actionType)&&typeof a.id==='string'&&uuid.test(a.id))rows.push({reference:{kind:'approval',id:a.id},label:'Approval needed: '+(typeof a.recipientSnapshot?.subject==='string'?a.recipientSnapshot.subject:'Email')});
   for(const d of drafts)if(d&&typeof d.id==='string'&&uuid.test(d.id))rows.push({reference:{kind:'draft',id:d.id},label:'Draft: '+(typeof d.subject==='string'?d.subject:'Email')});
   setItems(rows);setStatus(results.some(result=>result.status==='rejected')?'Some emails could not be loaded with your current permissions.':rows.length?'Choose an email to review.':'No saved drafts or pending approvals.');
  });return()=>{active=false;controller.abort();};
 },[organizationId,refresh]);
 return <section aria-label="Review saved emails in Chat" className="w-full rounded-2xl border bg-card p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Drafts and approvals</h2><div className="flex gap-2"><button type="button" onClick={()=>setRefresh(n=>n+1)} className="text-xs underline">Refresh</button><button type="button" onClick={onClose} className="text-xs underline">Close</button></div></div>
  <p role="status" className="mt-2 text-xs text-muted-foreground">{status}</p>
  <div className="mt-3 flex flex-wrap gap-2">{items.map(item=><button key={`${item.reference.kind}:${item.reference.id}`} type="button" onClick={()=>setSelected(item.reference)} className="rounded-md border px-3 py-2 text-left text-xs">{item.label}</button>)}</div>
  {selected&&<ChatMailResult key={`${selected.kind}:${selected.id}`} reference={selected} organizationId={organizationId} agentId={agentId}/>}
 </section>;
}
