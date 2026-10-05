"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, AgentEmailBinding, AgentPolicy, AgentVersion, AgentWhatsAppBinding, EmailAccount } from "@ai-comms-agent/shared";
import { useNotifications } from "@/components/notifications";

type Check = { key: string; label: string; ok: boolean; detail?: string };

export function AgentDetailClient({ organizationId, devUserId, initialAgent, initialVersions, initialPolicy, initialEmailBindings, initialWhatsAppBinding }: { organizationId: string; devUserId: string; initialAgent: Agent; initialVersions: AgentVersion[]; initialPolicy: AgentPolicy | null; initialEmailBindings: AgentEmailBinding[]; initialWhatsAppBinding: AgentWhatsAppBinding | null }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [agent, setAgent] = useState(initialAgent);
  const [versions, setVersions] = useState(initialVersions);
  const [policy, setPolicy] = useState(initialPolicy);
  const [emailBindings, setEmailBindings] = useState(initialEmailBindings);
  const [whatsappBinding, setWhatsappBinding] = useState(initialWhatsAppBinding);
  const [tab, setTab] = useState<"overview"|"versions"|"policy"|"channels"|"test">("overview");
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"deploy"|"retire"|null>(null);
  const [emailAccountId, setEmailAccountId] = useState("");
  const [whatsappAccountId, setWhatsappAccountId] = useState("");
  const [testResult, setTestResult] = useState<{ok:boolean;checks:Check[]}|null>(null);
  const [versionConfig, setVersionConfig] = useState("{}");
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailRole, setEmailRole] = useState<"primary"|"read_only"|"send_only">("primary");
  const [editName, setEditName] = useState(initialAgent.name);
  const [editSlug, setEditSlug] = useState(initialAgent.slug);
  const [editDescription, setEditDescription] = useState(initialAgent.description ?? "");

  async function call(path:string, init:RequestInit) {
    const response=await fetch(path,init); const payload=await response.json();
    if(!response.ok) throw new Error(payload.message ?? Object.values(payload.fieldErrors ?? {}).filter(Boolean).join(" ") ?? "Request failed");
    return payload;
  }
  async function deploy() {
    const version=versions[0]; if(!version) return;
    setBusy(true);
    try { const p=await call(`/api/agents/${agent.id}/deploy`,{method:"POST",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,versionId:version.id,environment:"production"})}); setAgent({...agent,status:"active",currentVersionId:version.id,currentDeploymentId:p.deployment.id}); notify({kind:"success",title:"Agent deployed",message:`Version ${version.versionNumber} is now active.`}); setShowConfirm(null); } catch(e){notify({kind:"error",title:"Deployment failed",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function retire() {
    setBusy(true);
    try { const p=await call(`/api/agents/${agent.id}`,{method:"DELETE",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId})}); setAgent(p.agent); notify({kind:"success",title:"Agent paused"}); setShowConfirm(null); } catch(e){notify({kind:"error",title:"Could not pause agent",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  useEffect(() => {
    if (tab !== "channels") return;
    let cancelled = false;
    fetch(`/api/email-accounts?organizationId=${encodeURIComponent(organizationId)}`, { headers: { "x-dev-user-id": devUserId } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Email accounts could not be loaded.");
        if (!cancelled) setEmailAccounts(payload.accounts ?? []);
      })
      .catch((error) => {
        if (!cancelled) notify({ kind:"error", title:"Email accounts unavailable", message:error instanceof Error ? error.message : "Unable to load email accounts." });
      });
    return () => { cancelled = true; };
  }, [tab, organizationId, devUserId, notify]);

  async function saveAgent(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}`,{method:"PATCH",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,name:editName,slug:editSlug,description:editDescription})});
      setAgent(p.agent);
      notify({kind:"success",title:"Agent details saved",message:"The persisted agent identity was updated."});
    } catch(e) {
      notify({kind:"error",title:"Agent details could not be saved",message:e instanceof Error?e.message:"Unknown error"});
    } finally { setBusy(false); }
  }
  async function createVersion() {
    let parsed: unknown;
    try { parsed = JSON.parse(versionConfig); } catch { notify({kind:"error",title:"Invalid configuration",message:"Version configuration must be valid JSON."}); return; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { notify({kind:"error",title:"Invalid configuration",message:"Version configuration must be a JSON object."}); return; }
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/versions`,{method:"POST",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,config:parsed})});
      setVersions((v)=>[p.version,...v]); setVersionConfig(JSON.stringify(p.version.config ?? {},null,2));
      notify({kind:"success",title:"Version created",message:`Version ${p.version.versionNumber} is ready for deployment.`});
    } catch(e){notify({kind:"error",title:"Could not create version",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function runTest() {
    setBusy(true); setTestResult(null);
    try { const p=await call(`/api/agents/${agent.id}/simulate`,{method:"POST",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId})}); setTestResult(p); } catch(e){notify({kind:"error",title:"Configuration test failed",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function unbindEmail(emailAccountId:string) {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,action:"unbind_email",emailAccountId})});
      setEmailBindings(p.emailBindings); notify({kind:"success",title:"Email account unbound",message:"The agent no longer has access to that mailbox."});
    } catch(e){notify({kind:"error",title:"Could not unbind email",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }

  async function unbindWhatsApp() {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,action:"unbind_whatsapp"})});
      setWhatsappBinding(p.whatsappBinding); notify({kind:"success",title:"WhatsApp account unbound",message:"The agent is no longer connected to WhatsApp."});
    } catch(e){notify({kind:"error",title:"Could not unbind WhatsApp",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }

  async function saveChannels() {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,emailAccountId,whatsappAccountId,emailRole})});
      setEmailBindings(p.emailBindings); setWhatsappBinding(p.whatsappBinding);
      notify({kind:"success",title:"Channels saved"});
    } catch(e) { notify({kind:"error",title:"Channels could not be saved",message:e instanceof Error?e.message:"Unknown error"}); }
    finally { setBusy(false); }
  }
  async function savePolicy(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form=new FormData(event.currentTarget);
    const allowedTools=String(form.get("allowedTools")??"").split(",").map((v)=>v.trim()).filter(Boolean);
    const allowedSenders=String(form.get("allowedSenders")??"").split(",").map((v)=>v.trim()).filter(Boolean);
    const blockedSenders=String(form.get("blockedSenders")??"").split(",").map((v)=>v.trim()).filter(Boolean);
    try { const p=await call(`/api/agents/${agent.id}/policy`,{method:"PATCH",headers:{"content-type":"application/json","x-dev-user-id":devUserId},body:JSON.stringify({organizationId,securityPolicy:policy?.securityPolicy??{},allowedTools,allowedSenders,blockedSenders,rateLimits:policy?.rateLimits??{}})}); setPolicy(p.policy); notify({kind:"success",title:"Policy saved"}); } catch(e){notify({kind:"error",title:"Policy could not be saved",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }

  return <main className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-7 lg:p-9">
    <button type="button" onClick={()=>router.push("/agents")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">← All agents</button>
    <header className="rounded-3xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-foreground text-xl text-background">✦</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{agent.name}</h1><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{agent.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{agent.slug} · {agent.description || "No purpose described"}</p><p className="mt-3 text-xs text-muted-foreground">Current version: {agent.currentVersionId ? versions.find((v)=>v.id===agent.currentVersionId)?.versionNumber ?? "unknown" : "Not deployed"}</p></div></div>
        <div className="flex flex-wrap gap-2">{agent.status==="active" ? <button type="button" onClick={()=>setShowConfirm("retire")} className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted">Pause</button> : <button type="button" onClick={()=>setShowConfirm("deploy")} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">Deploy latest</button>}</div>
      </div>
    </header>
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-background p-1 shadow-sm">{(["overview","versions","policy","channels","test"] as const).map((item)=><button key={item} type="button" onClick={()=>setTab(item)} className={`rounded-xl px-4 py-2.5 text-sm font-medium capitalize ${tab===item?"bg-foreground text-background":"text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item}</button>)}</nav>
    {tab==="overview" && <section className="space-y-4">
      <form onSubmit={saveAgent} className="rounded-2xl border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-semibold">Agent details</h2><p className="mt-1 text-sm text-muted-foreground">Edit the persisted identity without changing deployed version history.</p></div>
          <button type="submit" disabled={busy} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Saving…":"Save details"}</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium">Name<input value={editName} onChange={(e)=>setEditName(e.target.value)} maxLength={120} required className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
          <label className="text-sm font-medium">Slug<input value={editSlug} onChange={(e)=>setEditSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} required className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
          <label className="text-sm font-medium lg:col-span-2">Purpose<textarea value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border bg-background p-6 shadow-sm lg:col-span-2"><h2 className="font-semibold">Configuration</h2><p className="mt-1 text-sm text-muted-foreground">Versioned runtime configuration is stored with the agent.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Versions</p><p className="mt-1 text-xl font-semibold">{versions.length}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Policy</p><p className="mt-1 text-xl font-semibold">{policy ? "Ready" : "Missing"}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Deployment</p><p className="mt-1 text-xl font-semibold">{agent.status==="active" ? "Live" : "Draft"}</p></div></div></div></div><div className="rounded-2xl border bg-background p-6 shadow-sm"><h2 className="font-semibold">Channels</h2><p className="mt-1 text-sm text-muted-foreground">Connect email and WhatsApp accounts from the channel configuration.</p><div className="mt-5 space-y-2"><div className="rounded-xl border p-3 text-sm">Email <span className="float-right text-xs text-muted-foreground">Configure next</span></div><div className="rounded-xl border p-3 text-sm">WhatsApp <span className="float-right text-xs text-muted-foreground">Configure next</span></div></div></div></section>}
    {tab==="versions" && <section className="space-y-4"><div className="rounded-2xl border bg-background p-6 shadow-sm"><div><h2 className="font-semibold">Version configuration</h2><p className="mt-1 text-xs text-muted-foreground">Edit the draft JSON and create an immutable snapshot. Deployed versions are never mutated.</p></div><textarea value={versionConfig} onChange={(e)=>setVersionConfig(e.target.value)} spellCheck={false} className="mt-5 min-h-56 w-full rounded-xl border bg-muted/20 p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20" aria-label="Version configuration JSON" /><div className="mt-3 flex justify-end"><button type="button" disabled={busy} onClick={createVersion} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Creating…":"Create version"}</button></div></div><div className="rounded-2xl border bg-background shadow-sm"><div className="border-b p-5"><h3 className="font-semibold">History</h3></div><div className="divide-y">{versions.length===0?<p className="p-6 text-sm text-muted-foreground">No versions yet.</p>:versions.map((v)=><button type="button" key={v.id} onClick={()=>setVersionConfig(JSON.stringify(v.config ?? {},null,2))} className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/30"><div><p className="text-sm font-semibold">Version {v.versionNumber}</p><p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-[11px]">{v.id===agent.currentVersionId?"Current":"Draft"}</span></button>)}</div></div></section>}
    {tab==="policy" && <section className="rounded-2xl border bg-background p-6 shadow-sm"><h2 className="font-semibold">Agent safety policy</h2><p className="mt-1 text-sm text-muted-foreground">Control tool and sender boundaries before deployment.</p><form onSubmit={savePolicy} className="mt-6 space-y-5"><label className="block text-sm font-medium">Allowed tools<input name="allowedTools" defaultValue={policy?.allowedTools.join(", ")??""} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-normal" placeholder="rag_search, summarize_emails" /></label><label className="block text-sm font-medium">Allowed senders<input name="allowedSenders" defaultValue={policy?.allowedSenders.join(", ")??""} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-normal" placeholder="finance@example.com" /></label><label className="block text-sm font-medium">Blocked senders<input name="blockedSenders" defaultValue={policy?.blockedSenders.join(", ")??""} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm font-normal" placeholder="spam@example.com" /></label><button disabled={busy} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Save policy</button></form></section>}
    {tab==="channels" && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border bg-background p-6 shadow-sm"><h2 className="font-semibold">Email accounts</h2><p className="mt-1 text-sm text-muted-foreground">An agent can use multiple email accounts. Enter an existing persisted email account ID while the Email Accounts menu is being completed.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
  <select value={emailAccountId} onChange={(e)=>setEmailAccountId(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
    <option value="">Select a persisted email account</option>
    {emailAccounts.map((account)=><option key={account.id} value={account.id}>{account.email_address} · {account.provider} · {account.status}</option>)}
  </select>
  <select value={emailRole} onChange={(e)=>setEmailRole(e.target.value as typeof emailRole)} className="h-11 rounded-xl border bg-background px-3 text-sm">
    <option value="primary">Primary</option>
    <option value="read_only">Read only</option>
    <option value="send_only">Send only</option>
  </select>
</div><div className="mt-4 space-y-2">{emailBindings.map((b)=><div key={b.id} className="flex items-center justify-between rounded-xl border p-3 text-xs"><span className="min-w-0 truncate font-medium">{emailAccounts.find((a)=>a.id===b.emailAccountId)?.email_address ?? b.emailAccountId}</span><span className="ml-3 flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-1">{b.role}</span><button type="button" disabled={busy} onClick={()=>unbindEmail(b.emailAccountId)} className="text-destructive hover:underline">Remove</button></span></div>)}</div></div><div className="rounded-2xl border bg-background p-6 shadow-sm"><h2 className="font-semibold">WhatsApp</h2><p className="mt-1 text-sm text-muted-foreground">Exactly one WhatsApp Business account can be bound to an agent.</p><input value={whatsappAccountId} onChange={(e)=>setWhatsappAccountId(e.target.value)} className="mt-5 h-11 w-full rounded-xl border px-3 text-sm" placeholder="WhatsApp account UUID" /><div className="mt-4 rounded-xl border p-3 text-xs">{whatsappBinding ? <><span className="font-medium">{whatsappBinding.whatsappAccountId}</span><span className="flex items-center gap-3"><span className="text-emerald-600">Connected</span><button type="button" disabled={busy} onClick={unbindWhatsApp} className="text-destructive hover:underline">Remove</button></span></> : <span className="text-muted-foreground">No WhatsApp account connected.</span>}</div><button type="button" disabled={busy || (!emailAccountId && !whatsappAccountId)} onClick={saveChannels} className="mt-5 h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Saving…":"Save channels"}</button></div></section>}
    {tab==="test" && <section className="rounded-2xl border bg-background p-6 shadow-sm"><h2 className="font-semibold">Configuration test</h2><p className="mt-1 text-sm text-muted-foreground">This verifies persisted agent configuration and security prerequisites without pretending to execute a live AI/provider call.</p><button type="button" disabled={busy} onClick={runTest} className="mt-5 h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Testing…":"Run configuration test"}</button>{testResult && <div className="mt-5 space-y-2">{testResult.checks.map((c)=><div key={c.key} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{c.label}</span><span className={c.ok?"text-emerald-600":"text-destructive"}>{c.ok?"Pass":"Needs attention"}</span></div>)}</div>}</section>}
    {showConfirm && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border bg-background p-6 shadow-2xl"><h2 className="text-lg font-semibold">{showConfirm==="deploy"?"Deploy this agent?":"Pause this agent?"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{showConfirm==="deploy"?"The latest version will become active in production.":"The agent will stop being active. Existing configuration and versions remain preserved."}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setShowConfirm(null)} className="h-10 rounded-xl border px-4 text-sm">Cancel</button><button type="button" disabled={busy} onClick={showConfirm==="deploy"?deploy:retire} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Working…":"Confirm"}</button></div></div></div>}
  </main>;
}
