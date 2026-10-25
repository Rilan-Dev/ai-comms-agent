"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity as ActivityIcon, ArrowLeft, Bot, FlaskConical, GitBranch, PauseCircle, Plug, Rocket, Save, ShieldCheck, KeyRound } from "lucide-react";
import type { Agent, AgentEmailBinding, AgentPolicy, AgentVersion, AgentWhatsAppBinding, EmailAccount } from "@ai-comms-agent/shared";
import { useNotifications } from "@/components/notifications";
import { AgentAISettingsPanel } from "./agent-ai-settings-panel";
import { EMAIL_PERMISSION_PRESETS, emailPermissionPresetSelection, summarizeEmailPermissionChanges } from "@/lib/agents/email-permission-presets";
import { WHATSAPP_POLICY_CHOICES } from "@/lib/agents/whatsapp-permission-choices";
import { SCHEDULES_POLICY_CHOICES } from "@/lib/agents/schedules-permission-choices";
import { useWhatsAppReadiness } from "@/lib/whatsapp/use-readiness";
import {describeEffectiveAgentPolicy} from '@/lib/agents/effective-policy';
import {collectSenderEntries} from '@/lib/agents/sender-entries';
import {SenderListEditor} from './sender-list-editor';

// Only tools registered by the current email runtime are selectable here.
// The shared catalog also includes unimplemented contracts: showing those
// as working toggles would mislead admins about actual agent capabilities.
const EMAIL_POLICY_CHOICES = [
  { name: "email.search", label: "Search mailbox", detail: "Find matching emails and support natural-language summaries.", group: "read" },
  { name: "email.messages.list", label: "List emails", detail: "Retrieve recent or filtered message lists.", group: "read" },
  { name: "email.message.get", label: "Read an email", detail: "Open an authorized message by ID.", group: "read" },
  { name: "email.thread.get", label: "Read a conversation", detail: "Retrieve an existing email thread.", group: "read" },
  { name: "email.accounts.list", label: "List connected mailboxes", detail: "Discover the mailboxes assigned to this agent.", group: "read" },
  { name: "email.folders.list", label: "List mail folders", detail: "Read available folders on a connected mailbox.", group: "read" },
  { name: "email.labels.list", label: "List labels", detail: "Read labels on supported providers.", group: "read" },
  { name: "email.capabilities.get", label: "Check mailbox capabilities", detail: "Check which operations the provider supports.", group: "read" },
  { name: "email.sync.status", label: "Check synchronization", detail: "Read the mailbox sync status.", group: "read" },
  { name: "email.draft.create", label: "Create drafts", detail: "Prepare a new email without sending it.", group: "write" },
  { name: "email.draft.update", label: "Edit drafts", detail: "Edit existing saved drafts.", group: "write" },
  { name: "email.draft_reply", label: "Draft replies", detail: "Prepare a reply without sending.", group: "write" },
  { name: "email.draft_forward", label: "Draft forwards", detail: "Prepare a forwarded message without sending.", group: "write" },
  { name: "email.send.request", label: "Prepare email sends", detail: "Prepare send requests; approval follows the sending mode.", group: "write" },
  { name: "email.reply.request", label: "Prepare email replies", detail: "Prepare reply requests; approval follows the sending mode.", group: "write" },
  { name: "email.forward.request", label: "Prepare email forwards", detail: "Prepare forward requests; approval follows the sending mode.", group: "write" },
] as const;
const KNOWN_EMAIL_POLICY_TOOLS = new Set<string>(EMAIL_POLICY_CHOICES.map((choice) => choice.name));
const KNOWN_SELECTABLE_POLICY_TOOLS = new Set<string>([...KNOWN_EMAIL_POLICY_TOOLS, ...WHATSAPP_POLICY_CHOICES.map((choice) => choice.name), ...SCHEDULES_POLICY_CHOICES.map((choice) => choice.name)]);

type Check = { key: string; label: string; ok: boolean; detail?: string };
type AuditEvent = { id:string; eventType:string; action:string|null; decision:string|null; createdAt:string; metadata:Record<string,unknown> };

export function AgentDetailClient({ organizationId, initialAgent, initialVersions, initialPolicy, initialEmailBindings, initialWhatsAppBinding }: { organizationId: string; initialAgent: Agent; initialVersions: AgentVersion[]; initialPolicy: AgentPolicy | null; initialEmailBindings: AgentEmailBinding[]; initialWhatsAppBinding: AgentWhatsAppBinding | null }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [agent, setAgent] = useState(initialAgent);
  const [versions, setVersions] = useState(initialVersions);
  const [policy, setPolicy] = useState(initialPolicy);
  const [selectedTools, setSelectedTools] = useState<string[]>(initialPolicy?.allowedTools ?? []);
  // Autonomous sending: administrator-approved waiver of the human approval
  // step for this agent's own email/WhatsApp send requests. Persisted in the
  // policy security_policy JSON as autonomous_send: true.
  const [autonomousSend, setAutonomousSend] = useState(initialPolicy?.securityPolicy?.autonomous_send === true);
  const effectivePolicy=describeEffectiveAgentPolicy({allowedTools:selectedTools,autonomousSend});
  const [emailBindings, setEmailBindings] = useState(initialEmailBindings);
  const [whatsappBinding, setWhatsappBinding] = useState(initialWhatsAppBinding);
  const [tab, setTab] = useState<"overview"|"versions"|"policy"|"channels"|"ai-settings"|"test"|"activity">("overview");
  // The chat workspace can link administrators directly to this detailed
  // policy editor. It never changes policy merely by opening the tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "policy") setTab("policy");
  }, []);
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"deploy"|"retire"|null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [emailAccountId, setEmailAccountId] = useState("");
  const [whatsappAccountId, setWhatsappAccountId] = useState("");
  const [testResult, setTestResult] = useState<{ok:boolean;checks:Check[]}|null>(null);
  const initialSelectedVersion = initialVersions.find((v)=>v.id === (initialAgent.currentVersionId ?? initialVersions[0]?.id));
  const [versionConfig, setVersionConfig] = useState(JSON.stringify(initialSelectedVersion?.config ?? {}, null, 2));
  const [selectedVersionId, setSelectedVersionId] = useState(initialAgent.currentVersionId ?? initialVersions[0]?.id ?? "");
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState<Array<{id:string;displayName:string|null;phoneNumberId:string;status:string}>>([]);
  const whatsappReadiness = useWhatsAppReadiness({organizationId,agentId:agent.id,revision:JSON.stringify([policy?.allowedTools,whatsappBinding?.whatsappAccountId])});
  const [emailRole, setEmailRole] = useState<"primary"|"read_only"|"send_only">("primary");
  const [editName, setEditName] = useState(initialAgent.name);
  const [editSlug, setEditSlug] = useState(initialAgent.slug);
  const [editDescription, setEditDescription] = useState(initialAgent.description ?? "");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!showConfirm) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelConfirmRef.current?.focus();

    function onDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowConfirm(null);
        return;
      }
      if (event.key !== "Tab" || !confirmDialogRef.current) return;
      const focusable = Array.from(confirmDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        confirmDialogRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", onDialogKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [showConfirm]);

  async function call(path:string, init:RequestInit) {
    const response=await fetch(path,init); const payload=await response.json();
    if(!response.ok) throw new Error(payload.message ?? Object.values(payload.fieldErrors ?? {}).filter(Boolean).join(" ") ?? "Request failed");
    return payload;
  }
  async function deploy() {
    const version=versions.find((v)=>v.id===selectedVersionId) ?? versions[0]; if(!version) { notify({kind:"error",title:"No version available",message:"Create a configuration version before deploying."}); return; }
    setBusy(true);
    try { const p=await call(`/api/agents/${agent.id}/deploy`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,versionId:version.id,environment:"production"})}); setAgent({...agent,status:"active",currentVersionId:version.id,currentDeploymentId:p.deployment.id}); setSelectedVersionId(version.id); notify({kind:"success",title:"Agent deployed",message:`Version ${version.versionNumber} is now active.`}); setShowConfirm(null); } catch(e){notify({kind:"error",title:"Deployment failed",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function retire() {
    setBusy(true);
    try { const p=await call(`/api/agents/${agent.id}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId})}); setAgent(p.agent); notify({kind:"success",title:"Agent paused"}); setShowConfirm(null); } catch(e){notify({kind:"error",title:"Could not pause agent",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  useEffect(() => {
    if (tab !== "channels" && tab !== "policy") return;
    let cancelled = false;
    void Promise.all([
      fetch(`/api/email-accounts?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" }),
      fetch(`/api/whatsapp/accounts?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" }),
    ])
      .then(async ([emailResponse, whatsappResponse]) => {
        const [emailPayload, whatsappPayload] = await Promise.all([
          emailResponse.json().catch(() => ({})),
          whatsappResponse.json().catch(() => ({})),
        ]);
        if (!emailResponse.ok) throw new Error(emailPayload.message ?? "Email accounts could not be loaded.");
        if (!whatsappResponse.ok) throw new Error(whatsappPayload.message ?? "WhatsApp accounts could not be loaded.");
        if (!cancelled) {
          setEmailAccounts(emailPayload.accounts ?? []);
          setWhatsappAccounts((whatsappPayload.accounts ?? []).map((account:{id:string;display_name?:string|null;phone_number?:string|null;phone_number_id?:string;status:string})=>({id:account.id,displayName:account.display_name??null,phoneNumberId:account.phone_number||account.phone_number_id||"WhatsApp account",status:account.status})));
        }
      })
      .catch((error) => {
        if (!cancelled) notify({ kind:"error", title:"Channel accounts unavailable", message:error instanceof Error ? error.message : "Unable to load channel accounts." });
      });
    return () => { cancelled = true; };
  }, [tab, organizationId, notify]);

  useEffect(() => {
    if (tab !== "activity") return;
    let cancelled = false; setAuditLoading(true);
    const url = "/api/agents/" + agent.id + "/audit?organizationId=" + encodeURIComponent(organizationId) + "&limit=50";
    fetch(url)
      .then(async response => { const payload=await response.json(); if(!response.ok) throw new Error(payload.message??"Audit history could not be loaded."); if(!cancelled) setAuditEvents(payload.events??[]); })
      .catch(error => { if(!cancelled) notify({kind:"error",title:"Activity unavailable",message:error instanceof Error?error.message:"Unable to load audit history."}); })
      .finally(() => { if(!cancelled) setAuditLoading(false); });
    return () => { cancelled=true; };
  },[tab,agent.id,organizationId,notify]);
  async function saveAgent(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,name:editName,slug:editSlug,description:editDescription})});
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
      const p=await call(`/api/agents/${agent.id}/versions`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,config:parsed})});
      setVersions((v)=>[p.version,...v]); setVersionConfig(JSON.stringify(p.version.config ?? {},null,2));
      notify({kind:"success",title:"Version created",message:`Version ${p.version.versionNumber} is ready for deployment.`});
    } catch(e){notify({kind:"error",title:"Could not create version",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function runTest() {
    setBusy(true); setTestResult(null);
    try { const p=await call(`/api/agents/${agent.id}/simulate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId})}); setTestResult(p); } catch(e){notify({kind:"error",title:"Configuration test failed",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }
  async function unbindEmail(emailAccountId:string) {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,action:"unbind_email",emailAccountId})});
      setEmailBindings(p.emailBindings); notify({kind:"success",title:"Email account unbound",message:"The agent no longer has access to that mailbox."});
    } catch(e){notify({kind:"error",title:"Could not unbind email",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }

  async function unbindWhatsApp() {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,action:"unbind_whatsapp"})});
      setWhatsappBinding(p.whatsappBinding); notify({kind:"success",title:"WhatsApp account unbound",message:"The agent is no longer connected to WhatsApp."});
    } catch(e){notify({kind:"error",title:"Could not unbind WhatsApp",message:e instanceof Error?e.message:"Unknown error"});} finally{setBusy(false);}
  }

  async function saveChannels() {
    setBusy(true);
    try {
      const p=await call(`/api/agents/${agent.id}/channels`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,emailAccountId,whatsappAccountId,emailRole})});
      setEmailBindings(p.emailBindings); setWhatsappBinding(p.whatsappBinding);
      notify({kind:"success",title:"Channels saved"});
    } catch(e) { notify({kind:"error",title:"Channels could not be saved",message:e instanceof Error?e.message:"Unknown error"}); }
    finally { setBusy(false); }
  }
  function chooseMailPreset(preset: "read"|"draft"|"approval"|"off") {
    setSelectedTools((current) => emailPermissionPresetSelection(current, preset));
  }
  function togglePolicyTool(toolName: string, checked: boolean) {
    setSelectedTools((current) => checked
      ? (current.includes(toolName) ? current : [...current, toolName])
      : current.filter((name) => name !== toolName));
  }
  async function savePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const allowedTools = selectedTools;
    const allowedSenders = collectSenderEntries(form,'allowedSenders');
    const blockedSenders = collectSenderEntries(form,'blockedSenders');
    let securityPolicy: Record<string, unknown>;
    let rateLimits: Record<string, unknown>;
    try {
      const security = JSON.parse(String(form.get("securityPolicy") ?? "{}")) as unknown;
      const limits = JSON.parse(String(form.get("rateLimits") ?? "{}")) as unknown;
      if (!security || typeof security !== "object" || Array.isArray(security)
        || !limits || typeof limits !== "object" || Array.isArray(limits)) throw new Error("Expected JSON objects.");
      securityPolicy = security as Record<string, unknown>;
      rateLimits = limits as Record<string, unknown>;
    } catch {
      notify({ kind: "error", title: "Invalid policy JSON", message: "Security policy and rate limits must be valid JSON objects." });
      return;
    }
    // The autonomous-send toggle is the controlled editor for this single
    // security_policy key; keep it authoritative over hand-edited JSON.
    if (autonomousSend) securityPolicy = { ...securityPolicy, autonomous_send: true };
    else { const { autonomous_send: _removed, ...rest } = securityPolicy; void _removed; securityPolicy = rest; }
    const previousAutonomous = policy?.securityPolicy?.autonomous_send === true;
    const autonomousChanged = autonomousSend !== previousAutonomous;
    const { added, removed, confirmation } =
      summarizeEmailPermissionChanges(policy?.allowedTools ?? [], allowedTools);
    const otherChanges = !policy || JSON.stringify({
      securityPolicy, rateLimits, allowedSenders, blockedSenders,
    }) !== JSON.stringify({
      securityPolicy: policy.securityPolicy, rateLimits: policy.rateLimits,
      allowedSenders: policy.allowedSenders, blockedSenders: policy.blockedSenders,
    });
    if (!added.length && !removed.length && !otherChanges) {
      notify({ kind: "info", title: "No permission changes to save" });
      return;
    }
    const autonomousNotice = autonomousChanged
      ? (autonomousSend
        ? "\n\n⚠️ AUTONOMOUS SENDING will be ENABLED: this agent's email and WhatsApp send requests will be approved and dispatched automatically, with no human approval step. Meta's 24-hour window and template rules still apply to WhatsApp."
        : "\n\nAutonomous sending will be DISABLED: this agent's send requests will wait for human approval again.")
      : "";
    if (!window.confirm(confirmation + autonomousNotice + (otherChanges && !autonomousChanged
      ? "\n\nAdvanced sender restrictions or policy settings will also be updated." : ""))) return;
    setBusy(true);
    try {
      const p = await call(`/api/agents/${agent.id}/policy`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId, securityPolicy, allowedTools, allowedSenders, blockedSenders, rateLimits,
          ...(policy ? { expectedPolicy: {
            securityPolicy: policy.securityPolicy, allowedTools: policy.allowedTools,
            allowedSenders: policy.allowedSenders, blockedSenders: policy.blockedSenders,
            rateLimits: policy.rateLimits,
          } } : {}),
        }),
      });
      setPolicy(p.policy);
      setSelectedTools(p.policy.allowedTools);
      setAutonomousSend(p.policy.securityPolicy?.autonomous_send === true);
      notify({ kind: "success", title: "Policy saved", message: p.policy.securityPolicy?.autonomous_send === true
        ? "Autonomous sending is active: new send requests from this agent are approved and dispatched automatically."
        : "New chat and voice turns use the updated policy. No message was sent." });
    } catch (error) {
      notify({ kind: "error", title: "Policy could not be saved",
        message: error instanceof Error ? error.message : "Unknown error" });
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-7 lg:p-9">
    <button type="button" onClick={()=>router.push("/agents")} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> All agents</button>
    <header className="rounded-md border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Bot size={24} /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{agent.name}</h1><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{agent.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{agent.slug} · {agent.description || "No purpose described"}</p><p className="mt-3 text-xs text-muted-foreground">Current version: {agent.currentVersionId ? versions.find((v)=>v.id===agent.currentVersionId)?.versionNumber ?? "unknown" : "Not deployed"}</p></div></div>
        <div className="flex flex-wrap gap-2">{agent.status==="active" ? <button type="button" onClick={()=>setShowConfirm("retire")} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary"><PauseCircle size={15} /> Pause</button> : <button type="button" onClick={()=>setShowConfirm("deploy")} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"><Rocket size={15} /> Deploy latest</button>}</div>
      </div>
    </header>
    <nav aria-label="Agent sections" className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 shadow-sm">{(["overview","versions","policy","channels","ai-settings","test","activity"] as const).map((item)=><button key={item} type="button" aria-pressed={tab===item} onClick={()=>setTab(item)} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-medium capitalize transition-colors ${tab===item?"bg-foreground text-background":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{item==="overview"?<Bot className="h-4 w-4" />:item==="versions"?<GitBranch className="h-4 w-4" />:item==="policy"?<ShieldCheck className="h-4 w-4" />:item==="channels"?<Plug className="h-4 w-4" />:item==="ai-settings"?<KeyRound className="h-4 w-4" />:item==="test"?<FlaskConical className="h-4 w-4" />:<ActivityIcon className="h-4 w-4" />}{item==="ai-settings"?"AI Settings":item}</button>)}</nav>
    {tab==="overview" && <section className="space-y-4">
      <div className="rounded-md border bg-background p-6 shadow-sm">
        <h2 className="font-semibold">Get your agent ready</h2>
        <p className="mt-1 text-sm text-muted-foreground">Complete these steps using the controls already in this page. No tool names, JSON or developer assistance are needed for ordinary mail setup.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button type="button" onClick={() => setTab("channels")} className="rounded-md border p-4 text-left text-sm hover:bg-muted/30"><span className="block font-semibold">1. Choose a mailbox →</span><span className="mt-1 block text-xs text-muted-foreground">{emailBindings.length ? `${emailBindings.length} mailbox assignment(s) saved` : "No mailbox assigned yet"}</span></button>
          <button type="button" onClick={() => setTab("policy")} className="rounded-md border p-4 text-left text-sm hover:bg-muted/30"><span className="block font-semibold">2. Select permissions →</span><span className="mt-1 block text-xs text-muted-foreground">{policy?.allowedTools.some((name) => name === "email.search" || name === "email.messages.list") ? "Mail search/list saved" : "Mail summaries not enabled"}</span></button>
          <button type="button" onClick={() => setTab("test")} className="rounded-md border p-4 text-left text-sm hover:bg-muted/30"><span className="block font-semibold">3. Check readiness →</span><span className="mt-1 block text-xs text-muted-foreground">Run a configuration check before deploying. AI models can be selected under AI Settings.</span></button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">The checklist reflects saved configuration, not a live connection or successful mail import.</p>
      </div>
      <form onSubmit={saveAgent} className="rounded-md border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-semibold">Agent details</h2><p className="mt-1 text-sm text-muted-foreground">Edit the persisted identity without changing deployed version history.</p></div>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} />{busy?"Saving…":"Save details"}</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium">Name<input value={editName} onChange={(e)=>setEditName(e.target.value)} maxLength={120} required className="mt-1 h-11 w-full rounded-md border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
          <label className="text-sm font-medium">Slug<input value={editSlug} onChange={(e)=>setEditSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} required className="mt-1 h-11 w-full rounded-md border px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
          <label className="text-sm font-medium lg:col-span-2">Purpose<textarea value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-md border px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-md border bg-background p-6 shadow-sm lg:col-span-2"><h2 className="font-semibold">Configuration</h2><p className="mt-1 text-sm text-muted-foreground">Versioned runtime configuration is stored with the agent.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Versions</p><p className="mt-1 text-xl font-semibold">{versions.length}</p></div><div className="rounded-md bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Policy</p><p className="mt-1 text-xl font-semibold">{policy ? "Ready" : "Missing"}</p></div><div className="rounded-md bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Deployment</p><p className="mt-1 text-xl font-semibold">{agent.status==="active" ? "Live" : "Draft"}</p></div></div></div></div><div className="rounded-md border bg-background p-6 shadow-sm"><h2 className="font-semibold">Channels</h2><p className="mt-1 text-sm text-muted-foreground">Connect email and WhatsApp accounts from the channel configuration.</p><div className="mt-5 space-y-2"><button type="button" onClick={()=>setTab("channels")} className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/30">Email <span className="text-xs font-semibold text-primary">{emailBindings.length ? `${emailBindings.length} connected` : "Configure →"}</span></button><button type="button" onClick={()=>setTab("channels")} className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/30">WhatsApp <span className="text-xs font-semibold text-primary">{whatsappBinding ? "Connected" : "Configure →"}</span></button></div></div></section>}
    {tab==="versions" && <section className="space-y-4"><div className="rounded-md border bg-background p-6 shadow-sm"><div><h2 className="font-semibold">Version configuration</h2><p className="mt-1 text-xs text-muted-foreground">Select a version from History to reuse its configuration, then create a new immutable version. Technical editing is optional.</p><p className="mt-2 text-xs text-muted-foreground">Selected version: {versions.find((v)=>v.id===selectedVersionId)?.versionNumber ?? "none"} · Deploy uses the selected version.</p></div><details className="mt-5 rounded-md border p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced: edit technical version JSON (optional)</summary><textarea value={versionConfig} onChange={(e)=>setVersionConfig(e.target.value)} spellCheck={false} className="mt-3 min-h-56 w-full rounded-md border bg-muted/20 p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20" aria-label="Version configuration JSON" /></details><div className="mt-3 flex justify-end"><button type="button" disabled={busy} onClick={createVersion} className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Creating…":"Create version"}</button></div></div><div className="rounded-md border bg-background shadow-sm"><div className="border-b p-5"><h3 className="font-semibold">History</h3></div><div className="divide-y">{versions.length===0?<p className="p-6 text-sm text-muted-foreground">No versions yet.</p>:versions.map((v)=><button type="button" key={v.id} onClick={()=>{setSelectedVersionId(v.id); setVersionConfig(JSON.stringify(v.config ?? {},null,2));}} className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/30"><div><p className="text-sm font-semibold">Version {v.versionNumber}</p><p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p></div><span className="flex items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px]">{v.id===agent.currentVersionId?"Current":"Draft"}</span>{selectedVersionId===v.id && <span className="text-[11px] font-semibold text-primary">Selected</span>}</span></button>)}</div></div></section>}
    {tab==="policy" && <section className="rounded-md border bg-background p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-primary" /> Agent safety policy</h2>
      <p className="mt-1 text-sm text-muted-foreground">Select what this agent may do. Nothing is enabled unless an administrator selects it and saves the policy.</p>
      <div className="mt-4 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">Mail setup checklist</p>
        <p className="mt-1 text-muted-foreground">{emailBindings.some((b) => b.role !== "send_only") ? "✓ A mailbox is assigned for reading." : "1. Select a readable mailbox in Channels."} {selectedTools.includes("email.search") || selectedTools.includes("email.messages.list") ? "✓ Mail search/list permission selected (save to apply)." : "2. Select Search mailbox or List emails below to allow mail summaries."}</p>
        <button type="button" onClick={() => setTab("channels")} className="mt-2 text-sm font-semibold text-primary underline">Choose connected mailbox →</button>
        <p className="mt-2 text-xs text-muted-foreground">Binding a mailbox never grants tool access automatically. The account must also be connected, and the signed-in user must have email.read. Sending follows the approval rules on this page: human approval by default, or automatic dispatch if Autonomous sending is enabled above.</p>
      </div>
      <div className="mt-4 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">WhatsApp setup checklist</p>
        <p role="status" className="mt-1 text-muted-foreground">
          {whatsappReadiness.message}
        </p>
        <button type="button" onClick={() => setTab("channels")} className="mt-2 text-sm font-semibold text-primary underline">Choose connected WhatsApp account →</button>
        <p className="mt-2 text-xs text-muted-foreground">
          Account binding and saved tool permission are separate. The signed-in user must also have whatsapp.send.
          By default the agent creates a pending proposal that a human must approve; with Autonomous sending enabled above, its proposals are approved and dispatched automatically. Meta&apos;s conversation-window or template rules always apply.
        </p>
      </div>
      <form onSubmit={savePolicy} className="mt-6 space-y-5">
        <fieldset className={`rounded-md border p-4 ${autonomousSend ? "border-amber-500/50 bg-amber-50/50" : "border-border"}`}>
          <legend className="px-1 text-sm font-semibold">Sending mode</legend>
          <label className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm hover:bg-muted/30">
            <input type="checkbox" disabled={busy} checked={autonomousSend} onChange={(event) => setAutonomousSend(event.target.checked)} className="mt-1 size-4 shrink-0" aria-describedby="autonomous-send-help" />
            <span>
              <span className="block font-medium">Send automatically {autonomousSend ? "— on" : "— off; review before sending"}</span>
              <span id="autonomous-send-help" className="mt-1 block text-xs text-muted-foreground">
                Applies only to enabled sending tools. Requests for human review always wait for approval. Account access and provider rules still apply.
              </span>
            </span>
          </label>
          <p role="status" className="mt-2 rounded-md border bg-background p-2 text-xs">
            Selected: Email {effectivePolicy.email.mode==='off'?'sending off':effectivePolicy.email.mode==='automatic'?'automatic':'human review'} · WhatsApp {effectivePolicy.whatsapp.mode==='off'?'sending off':effectivePolicy.whatsapp.mode==='automatic'?'automatic':'human review'}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">This setting is stored in the agent&apos;s security policy and requires an administrator to save it. Changes apply to future chat and voice turns.</p>
        </fieldset>
        <fieldset className="rounded-md border border-primary/25 bg-primary/5 p-4">
          <legend className="px-1 text-sm font-semibold">Quick permission presets</legend>
          <p className="mb-3 text-xs text-muted-foreground">Choose the work this agent may do. Current selection: {effectivePolicy.emailPreset==='custom'?'Custom':EMAIL_PERMISSION_PRESETS.find(preset=>preset.id===effectivePolicy.emailPreset)?.label}. Individual choices remain below.</p>
          <div className="grid gap-2 sm:grid-cols-2">{EMAIL_PERMISSION_PRESETS.map((preset) => <button key={preset.id} type="button" disabled={busy} aria-pressed={effectivePolicy.emailPreset===preset.id} onClick={() => chooseMailPreset(preset.id)} className={`rounded-md border bg-background p-3 text-left text-xs transition hover:border-primary/50 disabled:opacity-50 ${effectivePolicy.emailPreset===preset.id?'border-foreground ring-1 ring-foreground':''}`}><span className="block font-semibold">{preset.label}</span><span className="mt-1 block text-muted-foreground">{preset.description}</span></button>)}</div>
          <p role="status" className="mt-3 text-xs text-muted-foreground">{selectedTools.filter(name => KNOWN_EMAIL_POLICY_TOOLS.has(name)).length} email tools selected; changes are not active until you confirm and save.</p>
        </fieldset>
        <details className="space-y-4 rounded-md border p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced: individual registered tools</summary>
        {(["read", "write"] as const).map((group) => <fieldset key={group} className="rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">{group === "read" ? "Read and search mail" : "Drafting and approval requests (optional)"}</legend>
          <p className="mb-3 text-xs text-muted-foreground">{group === "read" ? "Select only the information this agent needs. No mailbox is accessible unless separately connected." : "These actions do not bypass provider capabilities, administrator consent, or send approvals."}</p>
          <div className="grid gap-3 sm:grid-cols-2">{EMAIL_POLICY_CHOICES.filter((choice) => choice.group === group).map((choice) => <label key={choice.name} className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/30">
            <input type="checkbox" checked={selectedTools.includes(choice.name)} onChange={(event) => togglePolicyTool(choice.name, event.target.checked)} className="mt-1 size-4 shrink-0" />
            <span><span className="block font-medium">{choice.label}</span><span className="mt-1 block text-xs text-muted-foreground">{choice.detail}</span></span>
          </label>)}</div>
        </fieldset>)}
        <fieldset className="rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">WhatsApp permissions</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Enable only the registered WhatsApp tools this agent needs. A selected checkbox is not active until an administrator confirms and saves the policy.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">{WHATSAPP_POLICY_CHOICES.map((choice) => <label key={choice.name} className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/30">
            <input type="checkbox" disabled={busy} checked={selectedTools.includes(choice.name)} onChange={(event) => togglePolicyTool(choice.name, event.target.checked)} className="mt-1 size-4 shrink-0" />
            <span><span className="block font-medium">{choice.label}</span><span className="mt-1 block text-xs text-muted-foreground">{choice.detail}</span></span>
          </label>)}</div>
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {whatsappReadiness.message}
          </p>
        </fieldset>
        <fieldset className="rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">Scheduled AI agent permissions</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Let this agent manage its own scheduled tasks from chat: create, read, edit and delete schedules. At every fire time the agent executes the task instruction with the tools enabled above (email and WhatsApp). The signed-in user must also have schedules.manage for mutations.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">{SCHEDULES_POLICY_CHOICES.map((choice) => <label key={choice.name} className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/30">
            <input type="checkbox" disabled={busy} checked={selectedTools.includes(choice.name)} onChange={(event) => togglePolicyTool(choice.name, event.target.checked)} className="mt-1 size-4 shrink-0" />
            <span><span className="block font-medium">{choice.label}</span><span className="mt-1 block text-xs text-muted-foreground">{choice.detail}</span></span>
          </label>)}</div>
        </fieldset>
        {selectedTools.filter((name) => !KNOWN_SELECTABLE_POLICY_TOOLS.has(name)).length > 0 && <fieldset className="rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">Existing other permissions</legend>
          <p className="mb-3 text-xs text-muted-foreground">These were already saved. They are preserved until you explicitly remove them; this page cannot confirm whether each has a registered handler.</p>
          {selectedTools.filter((name) => !KNOWN_SELECTABLE_POLICY_TOOLS.has(name)).map((name) => <label key={name} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked onChange={() => togglePolicyTool(name, false)} />{name}</label>)}
        </fieldset>}
        </details>
        <details className="rounded-md border p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced sender rules and existing custom policy (optional)</summary>
          <p className="mt-2 text-xs text-muted-foreground">Existing values are preserved. Sender-list and rate-limit enforcement has not been verified; these fields do not replace access permissions or sending approval.</p>
          <div className="mt-4 space-y-4">
            <SenderListEditor key={`allowed-${policy?.updatedAt??'new'}`} name="allowedSenders" label="Allowed senders" initialEntries={policy?.allowedSenders??[]} disabled={busy} />
            <SenderListEditor key={`blocked-${policy?.updatedAt??'new'}`} name="blockedSenders" label="Blocked senders" initialEntries={policy?.blockedSenders??[]} disabled={busy} />
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block text-sm font-medium">Security policy<textarea name="securityPolicy" defaultValue={JSON.stringify(policy?.securityPolicy??{},null,2)} spellCheck={false} rows={7} className="mt-1 w-full rounded-md border bg-muted/20 p-3 font-mono text-xs font-normal" aria-label="Security policy JSON" /></label>
              <label className="block text-sm font-medium">Rate limits<textarea name="rateLimits" defaultValue={JSON.stringify(policy?.rateLimits??{},null,2)} spellCheck={false} rows={7} className="mt-1 w-full rounded-md border bg-muted/20 p-3 font-mono text-xs font-normal" aria-label="Rate limits JSON" /></label>
            </div>
          </div>
        </details>
        <button disabled={busy} className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Saving…":"Save selected permissions"}</button>
      </form>
    </section>}
    {tab==="channels" && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-md border bg-background p-6 shadow-sm"><h2 className="font-semibold">Email accounts</h2><p className="mt-1 text-sm text-muted-foreground">An agent can use multiple email accounts. Select a persisted mailbox below.</p>{!policy?.allowedTools.some((tool)=>tool==="email.search"||tool==="email.messages.list") && <p className="mt-3 text-xs text-muted-foreground" role="status">Mailbox connection does not enable chat summaries. An administrator must add <code>email.search</code> or <code>email.messages.list</code> under <button type="button" className="font-semibold underline" onClick={()=>setTab("policy")}>Agent Policy</button> and save it.</p>}<div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
  <select aria-label="Email account to connect" value={emailAccountId} onChange={(e)=>setEmailAccountId(e.target.value)} className="h-11 rounded-md border bg-background px-3 text-sm">
    <option value="">Select a persisted email account</option>
    {emailAccounts.map((account)=><option key={account.id} value={account.id} disabled={account.status !== "connected"}>{account.email_address} · {account.provider} · {account.status !== "connected" ? "Unavailable — connect first" : "Connected"}</option>)}
  </select>
  <select aria-label="Role for selected email account" value={emailRole} onChange={(e)=>setEmailRole(e.target.value as typeof emailRole)} className="h-11 rounded-md border bg-background px-3 text-sm">
    <option value="primary">Primary</option>
    <option value="read_only">Read only</option>
    <option value="send_only">Send only</option>
  </select>
</div><p className="mt-2 text-xs text-muted-foreground">Only connected mailboxes can be assigned. Unavailable accounts must be restored under <a href="/mail/accounts" className="font-semibold text-primary underline">Mailboxes</a> first.</p><div className="mt-4 space-y-2">{emailBindings.map((b)=><div key={b.id} className="flex items-center justify-between rounded-md border p-3 text-xs"><span className="min-w-0 truncate font-medium">{emailAccounts.find((a)=>a.id===b.emailAccountId)?.email_address ?? b.emailAccountId}</span><span className="ml-3 flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-1">{b.role}</span><button type="button" disabled={busy} onClick={()=>unbindEmail(b.emailAccountId)} className="text-destructive hover:underline">Remove</button></span></div>)}</div></div><div className="rounded-md border bg-background p-6 shadow-sm"><h2 className="font-semibold">WhatsApp</h2><p className="mt-1 text-sm text-muted-foreground">Exactly one WhatsApp Business account can be bound to an agent.</p><select aria-label="WhatsApp account to connect" value={whatsappAccountId} onChange={(e)=>setWhatsappAccountId(e.target.value)} className="mt-5 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a WhatsApp account</option>{whatsappAccounts.map(account=><option key={account.id} value={account.id} disabled={account.status !== "connected"}>{account.displayName || account.phoneNumberId} · {account.status === "connected" ? "Connected" : "Unavailable — connect first"}</option>)}</select><div className="mt-4 rounded-md border p-3 text-xs">{whatsappBinding ? <><span className="font-medium">{whatsappReadiness.accountLabel ?? "Bound WhatsApp account"}</span><span className="flex items-center gap-3"><span className={whatsappReadiness.connected ? "text-emerald-600" : "text-amber-600"}>{whatsappReadiness.message}</span><button type="button" disabled={busy} onClick={unbindWhatsApp} className="text-destructive hover:underline">Remove</button></span></> : <span className="text-muted-foreground">No WhatsApp account connected.</span>}</div><button type="button" disabled={busy || (!emailAccountId && !whatsappAccountId)} onClick={saveChannels} className="mt-5 h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Saving…":"Save channels"}</button></div></section>}
    {tab==="ai-settings" && <AgentAISettingsPanel organizationId={organizationId} agentId={agent.id} />}
    {tab==="test" && <section className="rounded-md border bg-background p-6 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><FlaskConical size={16} className="text-primary" /> Configuration test</h2><p className="mt-1 text-sm text-muted-foreground">This verifies persisted agent configuration and security prerequisites without pretending to execute a live AI/provider call.</p><button type="button" disabled={busy} onClick={runTest} className="mt-5 h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Testing…":"Run configuration test"}</button>{testResult && <div className="mt-5 space-y-2">{testResult.checks.map((c)=><div key={c.key} className="flex items-center justify-between rounded-md border p-3 text-sm"><span><span className="block">{c.label}</span>{c.detail && <span className="mt-1 block text-xs text-muted-foreground">{c.detail}</span>}</span><span className={c.ok?"text-emerald-600":"text-destructive"}>{c.ok?"Pass":"Needs attention"}</span></div>)}</div>}</section>}
    {tab==="activity" && <section className="rounded-md border bg-background shadow-sm">
      <div className="border-b p-6"><h2 className="flex items-center gap-2 font-semibold"><ActivityIcon size={16} className="text-primary" /> Activity</h2><p className="mt-1 text-sm text-muted-foreground">Security-sensitive configuration, deployment, policy, and channel changes for this agent.</p></div>
      {auditLoading?<div className="space-y-3 p-6">{[1,2,3].map(i=><div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</div>:auditEvents.length===0?<div className="p-10 text-center text-sm text-muted-foreground">No recorded activity yet.</div>:<div className="divide-y">{auditEvents.map(event=><div key={event.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{event.eventType.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}{event.action ? " · "+event.action : ""}</p></div><span className={"w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold "+(event.decision==="allowed"?"bg-emerald-50 text-emerald-700":"bg-muted text-muted-foreground")}>{event.decision??"recorded"}</span></div>)}</div>}
    </section>}
    {showConfirm && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4"><div ref={confirmDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="agent-action-confirm-title" className="my-auto w-full max-w-md rounded-md border border-border bg-card p-6 shadow-lg outline-none"><h2 id="agent-action-confirm-title" className="text-lg font-semibold">{showConfirm==="deploy"?"Deploy this agent?":"Pause this agent?"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{showConfirm==="deploy" ? <>Version {versions.find((v)=>v.id===selectedVersionId)?.versionNumber ?? versions[0]?.versionNumber ?? "selected"} will become active in production.</> : "The agent will stop being active. Existing configuration and versions remain preserved."}</p><div className="mt-6 flex justify-end gap-2"><button ref={cancelConfirmRef} type="button" onClick={()=>setShowConfirm(null)} className="h-10 rounded-md border px-4 text-sm">Cancel</button><button type="button" disabled={busy} onClick={showConfirm==="deploy"?deploy:retire} className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy?"Working…":"Confirm"}</button></div></div></div>}
  </main>;
}
