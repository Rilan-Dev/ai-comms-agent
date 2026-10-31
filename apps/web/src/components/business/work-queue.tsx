"use client";
import {useEffect,useState} from "react";

type Item={id:string;kind:"opportunity"|"service_ticket";title:string;description:string;ai_summary:string;
 source_contact:string|null;source_event_type:string;priority:string;status:string;review_status:string;
 assigned_user_id:string|null;created_at:string;};
type Assignee={id:string;name:string|null;email:string;role:string};

export function BusinessWorkQueue({organizationId}:{organizationId:string}){
 const [items,setItems]=useState<Item[]>([]);
 const [assignees,setAssignees]=useState<Assignee[]>([]);
 const [filter,setFilter]=useState<"all"|"opportunity"|"service_ticket">("all");
 const [busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 async function refresh(){
  const response=await fetch("/api/organizations/"+encodeURIComponent(organizationId)+"/work-items",{cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw Error(data.message??"Could not load business work queue.");
  setItems(data.items??[]);setAssignees(data.assignees??[]);
 }
 useEffect(()=>{let mounted=true;void fetch("/api/organizations/"+encodeURIComponent(organizationId)+"/work-items",{cache:"no-store"})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message??"Could not load work queue.");if(mounted){setItems(d.items??[]);setAssignees(d.assignees??[]);}})
   .catch(e=>{if(mounted)setNotice(e instanceof Error?e.message:"Unable to load work items.");})
   .finally(()=>{if(mounted)setLoading(false);});
   return()=>{mounted=false;};
 },[organizationId]);
 async function change(id:string,values:Record<string,unknown>){
  setBusy(id);setNotice("");
  try{
   const res=await fetch("/api/organizations/"+encodeURIComponent(organizationId)+"/work-items",{
    method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...values})});
   const d=await res.json();
   if(!res.ok)throw Error(d.message??"Work item update denied.");
   await refresh();
   setNotice("Work item updated. The action is recorded in the organization audit history.");
  }catch(e){setNotice(e instanceof Error?e.message:"Unable to update work item.");}
  finally{setBusy(null);}
 }
 const visible=items.filter(x=>filter==="all"||x.kind===filter);
 return <section className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-semibold">Business follow-up queue</h2>
    <p className="mt-1 text-xs text-muted-foreground">Event-derived opportunities and service tickets. Nothing is assigned, approved or closed automatically.</p></div>
   <div className="flex gap-2">
    <select aria-label="Filter business work items" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="h-10 rounded-lg border bg-background px-3 text-sm">
     <option value="all">All items</option><option value="opportunity">Sales opportunities</option><option value="service_ticket">Service tickets</option>
    </select>
    <button className="h-10 rounded-lg border px-3 text-sm" onClick={()=>void refresh().catch(e=>setNotice(String(e)))}>Refresh</button>
   </div>
  </div>
  {notice&&<p role="status" className="rounded-lg border bg-card p-3 text-sm">{notice}</p>}
  {loading?<p className="text-sm text-muted-foreground">Loading organization records…</p>:
   visible.length===0?<p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No work items yet. Configure a business action in Scheduled AI Agent → Event automations.</p>:
   visible.map(item=><article key={item.id} className="rounded-xl border bg-card p-5 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><div>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.kind==="opportunity"?"Sales opportunity":"Service ticket"} · {item.priority}</p>
      <h3 className="mt-1 font-semibold">{item.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{item.source_event_type} · {new Date(item.created_at).toLocaleString()}</p>
     </div><div className="flex gap-2 text-xs"><span className="rounded-full border px-2 py-1">{item.status}</span><span className="rounded-full border px-2 py-1">Review: {item.review_status}</span></div></div>
    {item.source_contact&&<p className="text-sm">Contact: {item.source_contact}</p>}
    {item.description&&<p className="whitespace-pre-wrap text-sm">{item.description}</p>}
    {item.ai_summary&&<details><summary className="cursor-pointer text-sm font-medium">AI summary / source recap</summary><p className="mt-2 whitespace-pre-wrap text-sm">{item.ai_summary}</p></details>}
    <div className="flex flex-wrap items-end gap-3 border-t pt-3">
      <label className="grid gap-1 text-xs font-medium">Assigned person
       <select aria-label={"Assign "+item.title} disabled={busy===item.id} value={item.assigned_user_id??""} onChange={e=>void change(item.id,{assignedUserId:e.target.value||null})} className="h-10 min-w-44 rounded-lg border bg-background px-2 text-sm">
        <option value="">Unassigned</option>{assignees.map(a=><option key={a.id} value={a.id}>{a.name||a.email} ({a.role})</option>)}
       </select></label>
      <label className="grid gap-1 text-xs font-medium">Progress
       <select aria-label={"Status "+item.title} disabled={busy===item.id} value={item.status} onChange={e=>void change(item.id,{status:e.target.value})} className="h-10 rounded-lg border bg-background px-2 text-sm">
        <option value="new">New</option><option value="in_progress">In progress</option>
        <option value="completed" disabled={item.review_status!=="approved"}>Completed (needs approval)</option>
       </select></label>
      <div className="flex items-center gap-2">
       <button disabled={busy===item.id||item.review_status==="approved"} onClick={()=>void change(item.id,{reviewStatus:"approved"})} className="h-10 rounded-lg border px-3 text-sm disabled:opacity-50">Approve (admin)</button>
       <button disabled={busy===item.id||item.review_status==="rejected"} onClick={()=>void change(item.id,{reviewStatus:"rejected"})} className="h-10 rounded-lg border px-3 text-sm disabled:opacity-50">Reject (admin)</button>
      </div>
    </div>
   </article>)}
 </section>;
}
