"use client";

import {useEffect,useState} from "react";
type Recipient={id:string;display_name:string;phone_e164:string;recipient_role:"primary"|"secondary"|"contact"};
type Entry={name:string;phone:string;role:Recipient["recipient_role"]};
const empty:Entry={name:"",phone:"",role:"contact"};
export function RecipientDirectory({organizationId}:{organizationId:string}) {
 const [recipients,setRecipients]=useState<Recipient[]>([]);
 const [form,setForm]=useState<Entry>(empty),[editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const endpoint="/api/organizations/"+encodeURIComponent(organizationId)+"/recipient-directory";
 async function reload(){const response=await fetch(endpoint,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.message||"Cannot load personal contacts");setRecipients(data.recipients||[]);}
 useEffect(()=>{let mounted=true;void fetch(endpoint,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"Cannot load contacts");if(mounted)setRecipients(d.recipients||[]);}).catch(e=>{if(mounted)setNotice(String(e.message||e));});return()=>{mounted=false;};},[endpoint]);
 async function save(){setBusy(true);setNotice("");try{
  const response=await fetch(endpoint,{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,...(editing?{id:editing}:{})})});
  const data=await response.json();if(!response.ok)throw new Error(data.message||"Unable to save contact.");
  setForm(empty);setEditing(null);await reload();setNotice(editing?"Recipient updated.":"Recipient saved.");
 }catch(e){setNotice(e instanceof Error?e.message:"Unable to save contact.");}finally{setBusy(false);}}
 async function archive(id:string){if(!window.confirm("Remove this saved recipient from your personal contact book?"))return;setBusy(true);setNotice("");try{
  const r=await fetch(endpoint+"?id="+encodeURIComponent(id),{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not remove contact.");await reload();setNotice("Contact removed.");
 }catch(e){setNotice(e instanceof Error?e.message:"Could not remove contact.");}finally{setBusy(false);}}
 return <section className="space-y-4">
  <header><h2 className="text-xl font-semibold">Personal WhatsApp recipients</h2>
   <p className="mt-1 text-sm text-muted-foreground">Assign one primary and one secondary number; other entries stay in your private contact book. These roles do not verify phone ownership or bypass message approvals.</p></header>
  {notice&&<p role="status" className="rounded-xl border p-3 text-sm">{notice}</p>}
  <div className="grid gap-3 md:grid-cols-3">{(["primary","secondary","contact"] as const).map(role=><div key={role} className="rounded-xl border bg-card p-4"><h3 className="text-sm font-semibold capitalize">{role==="contact"?"Other contacts":role+" personal number"}</h3>
    {(role==="contact"?recipients.filter(r=>r.recipient_role===role):recipients.filter(r=>r.recipient_role===role)).length===0?<p className="mt-2 text-xs text-muted-foreground">No number saved</p>:recipients.filter(r=>r.recipient_role===role).map(r=><div key={r.id} className="mt-2 border-t pt-2 text-xs"><p className="font-semibold">{r.display_name}</p><p className="my-1 font-mono">{r.phone_e164}</p><button type="button" className="mr-3 text-primary underline" onClick={()=>{setEditing(r.id);setForm({name:r.display_name,phone:r.phone_e164,role:r.recipient_role});}}>Edit</button><button type="button" disabled={busy} onClick={()=>void archive(r.id)} className="text-destructive underline">Remove</button></div>)}</div>)}</div>
  <div className="rounded-xl border bg-card p-4">
    <h3 className="mb-3 text-sm font-semibold">{editing?"Edit saved recipient":"Add a recipient"}</h3>
    <div className="grid gap-3 sm:grid-cols-3">
     <label className="text-xs font-semibold">Contact name<input aria-label="Contact name" maxLength={120} className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="text-xs font-semibold">WhatsApp phone (E.164)<input aria-label="Contact phone" type="tel" placeholder="+919876543210" className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
     <label className="text-xs font-semibold">Role<select aria-label="Contact role" className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.role} onChange={e=>setForm({...form,role:e.target.value as Entry["role"]})}><option value="contact">Contact book</option><option value="primary">Primary (personal)</option><option value="secondary">Secondary (personal)</option></select></label>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Confirm recipient number and consent before sending. A saved number is not proof of ownership. Existing WhatsApp customer-service windows, approved templates and agent authorization still apply.</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy||!form.name.trim()||!form.phone.trim()} onClick={()=>void save()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{editing?"Save changes":"Save recipient"}</button>
      {editing&&<button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel</button>}
    </div>
  </div>
 </section>;
}
