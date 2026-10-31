"use client";

import {useEffect,useState} from 'react';
type Counts={emailApprovals:number|null;whatsappApprovals:number|null};
export function AgentAttention({organizationId,agentId}:{organizationId:string;agentId:string}){
 const [counts,setCounts]=useState<Counts|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;setCounts(null);setFailed(false);
  fetch(`/api/agents/${encodeURIComponent(agentId)}/operational-summary?${new URLSearchParams({organizationId})}`,{cache:'no-store'})
   .then(async response=>{if(!response.ok)throw Error('unavailable');return response.json() as Promise<Counts>;})
   .then(value=>{if(!cancelled)setCounts(value);}).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;};
 },[organizationId,agentId]);
 return <section className="rounded-md border bg-background p-6 shadow-sm" aria-label="Agent approvals">
  <h2 className="font-semibold">Approvals needing attention</h2>
  {!counts?<p className="mt-2 text-sm text-muted-foreground">{failed?'Approval information is unavailable.':'Checking approvals…'}</p>:<div className="mt-4 grid gap-3 sm:grid-cols-2">
   {counts.emailApprovals!==null&&<a href="/mail/approvals" className="rounded-md border p-4 text-sm hover:bg-muted/30"><span className="block font-semibold">Email approvals</span><span className="mt-1 block text-xs text-muted-foreground">{counts.emailApprovals} pending for this agent</span></a>}
   {counts.whatsappApprovals!==null&&<a href="/whatsapp" className="rounded-md border p-4 text-sm hover:bg-muted/30"><span className="block font-semibold">WhatsApp approvals</span><span className="mt-1 block text-xs text-muted-foreground">{counts.whatsappApprovals} pending for this agent</span></a>}
   {counts.emailApprovals===null&&counts.whatsappApprovals===null&&<p className="text-sm text-muted-foreground">Approval information is not available for your access.</p>}
  </div>}
 </section>;
}
