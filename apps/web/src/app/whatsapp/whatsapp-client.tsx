"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send, ShieldCheck, Smartphone, Unplug, X, Pencil, FlaskConical } from "lucide-react";
import { WhatsAppWebhookSetupGuide } from "./whatsapp-webhook-setup-guide";

type Account = { id: string; phone_number_id: string; phone_number?: string | null; display_name?: string | null; business_account_id?: string | null; status: string; last_error?: string | null };

export default function WhatsAppClient({ organizationId }: { organizationId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" });
  const [busy, setBusy] = useState(false);
  const [showWebhookSetupModal, setShowWebhookSetupModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; direction: string; body?: string | null; status: string; phone_number?: string | null; display_name?: string | null; created_at: string }>>([]);
  const [recipient, setRecipient] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendIdempotencyKey, setSendIdempotencyKey] = useState<string | null>(null);
  const [approvalActions, setApprovalActions] = useState<Array<{ id: string; whatsapp_account_id: string; recipient_phone: string; message_body: string; payload_type: string; status: string; expires_at: string; created_at: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; language: string; category: string; status: string }>>([]);
  const [payloadType, setPayloadType] = useState<"text" | "template">("text");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [templateParametersText, setTemplateParametersText] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateLanguage, setNewTemplateLanguage] = useState("en_US");
  const [newTemplateCategory, setNewTemplateCategory] = useState("UTILITY");
  const [newTemplateBody, setNewTemplateBody] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/whatsapp/accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not load WhatsApp accounts.");
      setAccounts(d.accounts ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load WhatsApp accounts."); }
  }
  useEffect(() => { void load(); }, [organizationId]);
  useEffect(() => { const firstAccount = accounts[0]; if (firstAccount && !selectedAccountId) setSelectedAccountId(firstAccount.id); }, [accounts, selectedAccountId]);
  useEffect(() => { if (!selectedAccountId) return; const loadMessages = async () => { try { const r = await fetch("/api/whatsapp/messages?organizationId=" + encodeURIComponent(organizationId) + "&accountId=" + encodeURIComponent(selectedAccountId), { cache: "no-store" }); const d = await r.json(); if (r.ok) setMessages(d.messages ?? []); } catch {} }; void loadMessages(); const timer = setInterval(() => { void loadMessages(); }, 5000); return () => clearInterval(timer); }, [organizationId, selectedAccountId]);
  async function loadApprovals() {
    try {
      const r = await fetch("/api/whatsapp/send-actions?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setApprovalActions(d.actions ?? []);
    } catch {}
  }
  async function loadTemplates() {
    if (!selectedAccountId) { setTemplates([]); return; }
    try {
      const r = await fetch("/api/whatsapp/templates?organizationId=" + encodeURIComponent(organizationId) + "&accountId=" + encodeURIComponent(selectedAccountId), { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setTemplates(d.templates ?? []);
      else setTemplates([]);
    } catch { setTemplates([]); }
  }
  useEffect(() => { void loadApprovals(); const timer = setInterval(() => { void loadApprovals(); }, 5000); return () => clearInterval(timer); }, [organizationId]);
  useEffect(() => { void loadTemplates(); }, [organizationId, selectedAccountId]);

  const credentialFields = [
    ["phoneNumberId", "Phone number ID *", false],
    ["businessAccountId", "Business account ID", false],
    ["phoneNumber", "Display phone number", false],
    ["displayName", "Display name", false],
    ["accessToken", "Access token" , true],
  ] as const;

  async function save() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, accountId: editingAccountId ?? undefined, ...form }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not save WhatsApp configuration.");
      const verified = d.verified === true || d.account?.status === "connected";
      setNotice(verified ? "Account saved and Meta phone access verified. Webhook subscriptions and allowed test recipients still need to be configured in Meta." : (d.message ?? "Credentials saved, but Meta verification failed. Check the account error and edit the credentials to retry."));
      await load();
      if (verified) {
        setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" });
        setEditingAccountId(null);
        setShowWebhookSetupModal(false);
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save WhatsApp configuration."); } finally { setBusy(false); }
  }


  async function sendMessage() {
    setBusy(true); setNotice(null);
    try {
      const idempotencyKey = sendIdempotencyKey ?? crypto.randomUUID();
      if (!sendIdempotencyKey) setSendIdempotencyKey(idempotencyKey);
      const templateParameters = templateParametersText.split("\n").map(value => value.trim()).filter(Boolean);
      const payload = payloadType === "template"
        ? { organizationId, accountId: selectedAccountId, to: recipient, payloadType, templateName, templateLanguage, templateParameters }
        : { organizationId, accountId: selectedAccountId, to: recipient, body: messageBody };
      const r = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not request WhatsApp send approval.");
      setMessageBody(""); setTemplateParametersText(""); setSendIdempotencyKey(null);
      setNotice(d.approvalRequired ? "Approval requested. This message has not been sent; an authorized person must approve it." : "Request recorded.");
      await loadApprovals();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not request WhatsApp send approval."); } finally { setBusy(false); }
  }

  async function decideApproval(actionId: string, decision: "approve" | "reject") {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/send-actions/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, actionId, decision }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error ?? "Could not decide this WhatsApp action.");
      setNotice(typeof d.message === "string" ? d.message : decision === "approve" ? "Approved and queued. Meta delivery has not yet been confirmed." : "WhatsApp send request rejected.");
      await loadApprovals();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not decide this WhatsApp action."); } finally { setBusy(false); }
  }

  async function submitTemplate() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        organizationId, accountId: selectedAccountId, name: newTemplateName.trim(), language: newTemplateLanguage,
        category: newTemplateCategory, components: [{ type: "BODY", text: newTemplateBody }],
      }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not submit the template to Meta.");
      setNotice(d.message ?? "Template submitted to Meta. It cannot be used until Meta reports approved status.");
      await loadTemplates();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not submit the template."); } finally { setBusy(false); }
  }

  async function verifyAccount(account: Account) {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          accountId: account.id,
          phoneNumberId: account.phone_number_id,
          businessAccountId: account.business_account_id ?? null,
          phoneNumber: account.phone_number ?? null,
          displayName: account.display_name ?? null,
          accessToken: "",
          verifyToken: "",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not verify this WhatsApp account.");
      setNotice(d.verified
        ? "Meta verification succeeded. Check webhook subscriptions and test-recipient permissions separately."
        : (d.account?.last_error || d.message || "Meta could not verify this account. Edit its credentials and retry."));
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not verify this WhatsApp account.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(accountId: string) {
    if (!window.confirm("Disconnect this WhatsApp account and remove its stored credential?")) return;
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/accounts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, accountId }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not disconnect account.");
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not disconnect account."); } finally { setBusy(false); }
  }

  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10"><div className="mx-auto max-w-[1200px]">
    {showWebhookSetupModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6" onClick={() => setShowWebhookSetupModal(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="whatsapp-webhook-modal-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Guided connection</p><h2 id="whatsapp-webhook-modal-title" className="mt-1 text-lg font-semibold">{editingAccountId ? "Edit WhatsApp phone" : "WhatsApp Webhook Setup"}</h2><p className="mt-1 text-sm text-muted-foreground">{editingAccountId ? "Update this phone’s details. Leave the access token blank to keep the encrypted token already saved." : "Configure Meta, then add a business phone or a Meta test number."}</p></div>
          <button type="button" autoFocus aria-label="Close WhatsApp webhook setup" onClick={() => { setShowWebhookSetupModal(false); setEditingAccountId(null); setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" }); }} className="rounded-lg border p-2 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">
          <WhatsAppWebhookSetupGuide organizationId={organizationId} onVerifyTokenChange={token => setForm(v => ({ ...v, verifyToken: token }))}>
      {/* The connect form — rendered inside step 5 of the setup guide */}
      <div className="mt-4 rounded-md border bg-background p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><ShieldCheck size={18} /></div>
          <div>
            <h3 className="font-display text-base font-medium">Connect Meta Cloud API</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Use the Phone Number ID, WhatsApp Business Account ID and access token from your Meta app. Credentials are encrypted server-side.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{credentialFields.map(([key,label,secret])=><label key={key} className="block"><span className="text-xs font-medium">{label}</span><input type={secret ? "password" : "text"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} required={key === "phoneNumberId" || (key === "accessToken" && !editingAccountId)} aria-label={label} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" autoComplete={secret ? "new-password" : "off"} /></label>)}</div>
        <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !form.phoneNumberId.trim() || (!form.accessToken.trim() && !editingAccountId)} onClick={() => void save()} className="h-10 rounded-md bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving and verifying…" : editingAccountId ? "Save changes and verify" : "Save and verify phone"}</button></div>
      </div>
          </WhatsAppWebhookSetupGuide>
        </div>
      </section>
    </div>}
    <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Messaging</p><h1 className="mt-2 font-display text-3xl font-medium tracking-tight">WhatsApp Business</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Add Meta Cloud API business phones or test numbers. Saving a phone immediately checks its ID and access token with Meta; webhook subscriptions and test-recipient permissions are separate.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingAccountId(null); setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "Meta Test Phone", accessToken: "", verifyToken: "", appSecret: "" }); setShowWebhookSetupModal(true); }} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-muted"><FlaskConical size={16} />Add Meta test phone</button><button type="button" onClick={() => { setEditingAccountId(null); setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" }); setShowWebhookSetupModal(true); }} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"><Smartphone size={16} />{accounts.length ? "Connect another phone" : "Connect WhatsApp Business"}</button></div></header>
    {notice && <div role="status" className="mt-5 rounded-md border bg-background px-4 py-3 text-sm">{notice}</div>}
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-md border bg-background p-5  sm:p-7 lg:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="flex items-center gap-2 font-display text-lg font-medium"><MessageCircle size={17} /> Conversation channel</h2><p className="mt-1 text-xs text-muted-foreground">Inbound webhook messages and worker-queued outbound text. No fake messages are inserted.</p></div><select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">{accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.phone_number || a.phone_number_id}</option>)}</select></div><div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto rounded-md bg-muted/30 p-4">{messages.length ? messages.slice().reverse().map(m=><div key={m.id} className={"flex " + (m.direction === "outbound" ? "justify-end" : "justify-start")}><div className={"max-w-[80%] rounded-md border px-4 py-3 text-sm " + (m.direction === "outbound" ? "bg-foreground text-background" : "bg-background")}><p className="whitespace-pre-wrap">{m.body || "[" + m.status + "]"}</p><p className="mt-1 text-[10px] opacity-60">{m.phone_number || "WhatsApp"} · {m.status}</p></div></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No persisted messages yet.</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
        <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="+919876543210" aria-label="Recipient phone in E.164 format" className="h-11 rounded-md border bg-background px-3 text-sm"/>
        <div className="grid gap-2">
          <select value={payloadType} onChange={e=>setPayloadType(e.target.value as "text" | "template")} aria-label="WhatsApp message type" className="h-11 rounded-md border bg-background px-3 text-sm"><option value="text">Free-form text (24-hour window)</option><option value="template">Approved Meta template</option></select>
          {payloadType === "text" ? <input value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Write a WhatsApp message…" aria-label="WhatsApp message" className="h-11 rounded-md border bg-background px-3 text-sm"/> : <><select value={templateName + "|" + templateLanguage} onChange={e=>{const [name,language]=e.target.value.split("|");setTemplateName(name);setTemplateLanguage(language);}} aria-label="Approved WhatsApp template" className="h-11 rounded-md border bg-background px-3 text-sm"><option value="|">Choose approved template…</option>{templates.filter(t=>t.status==="approved").map(t=><option key={t.id} value={t.name + "|" + t.language}>{t.name} ({t.language})</option>)}</select><textarea value={templateParametersText} onChange={e=>setTemplateParametersText(e.target.value)} placeholder="One body parameter per line, in template order" aria-label="Template body parameters" className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"/></>}
        </div>
        <button type="button" disabled={busy || !selectedAccountId || !accounts.some(a => a.id === selectedAccountId && a.status === "connected") || !/^\+[1-9]\d{7,14}$/.test(recipient) || (payloadType === "text" ? !messageBody.trim() : !templates.some(t=>t.name===templateName && t.language===templateLanguage && t.status==="approved"))} onClick={()=>void sendMessage()} className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"><><Send size={14} className="mr-2 inline" />{busy ? "Submitting…" : "Request approval"}</></button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Sending is approval-gated. Free-form text is allowed only after a recent inbound customer message; outside Meta’s 24-hour window, choose a template currently approved by Meta.</p></section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-medium">Send approval queue</h2><p className="mt-1 text-xs text-muted-foreground">Requests are not sent until an authorized person approves them. Expired-window text requires a Meta-approved template.</p></div><button type="button" onClick={()=>void loadApprovals()} className="rounded-md border px-3 py-2 text-xs font-semibold">Refresh</button></div>
        <div className="mt-4 space-y-3">{approvalActions.length ? approvalActions.map(action=><article key={action.id} className="rounded-md border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{action.payload_type === "template" ? "Template: " + action.message_body.replace(/^Template: /,"") : action.message_body}</p><p className="mt-1 text-xs text-muted-foreground">To {action.recipient_phone} · {action.status} · expires {new Date(action.expires_at).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Account {action.whatsapp_account_id}</p></div><span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold">{action.status}</span></div>{action.status === "pending" && <div className="mt-3 flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>void decideApproval(action.id,"reject")} className="rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">Reject</button><button type="button" disabled={busy} onClick={()=>void decideApproval(action.id,"approve")} className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50">Approve and queue</button></div>}{action.status === "requires_template" && <p className="mt-3 text-xs text-amber-700">No free-form send was queued. Create or select an approved Meta template and submit a new request.</p>}</article>) : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No pending WhatsApp send approvals.</p>}</div>
      </section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7 lg:col-span-2"><h2 className="font-display text-lg font-medium">Meta message templates</h2><p className="mt-1 text-xs text-muted-foreground">Submissions are sent to Meta for review. Only current Meta-approved text-body templates can be used; media headers, dynamic headers and button templates fail closed.</p><button type="button" onClick={()=>void loadTemplates()} disabled={busy || !selectedAccountId} className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">Refresh Meta approval status</button><div className="mt-4 grid gap-3 sm:grid-cols-4"><input value={newTemplateName} onChange={e=>setNewTemplateName(e.target.value)} placeholder="template_name" aria-label="New template name" className="h-10 rounded-md border bg-background px-3 text-sm"/><input value={newTemplateLanguage} onChange={e=>setNewTemplateLanguage(e.target.value)} aria-label="Template language" className="h-10 rounded-md border bg-background px-3 text-sm"/><select value={newTemplateCategory} onChange={e=>setNewTemplateCategory(e.target.value)} aria-label="Template category" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option></select><button type="button" disabled={busy || !selectedAccountId || !newTemplateName.trim() || !newTemplateBody.trim() || !accounts.some(a=>a.id===selectedAccountId && a.status==="connected")} onClick={()=>void submitTemplate()} className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Submit to Meta</button></div><textarea value={newTemplateBody} onChange={e=>setNewTemplateBody(e.target.value)} placeholder="Template body text. Use {{1}}, {{2}} for body parameters." aria-label="Template body text" className="mt-3 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"/><div className="mt-3 flex flex-wrap gap-2">{templates.map(template=><span key={template.id} className="rounded-md border px-3 py-2 text-xs">{template.name} ({template.language}) · {template.status}</span>)}</div></section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-display text-lg font-medium"><Smartphone size={17} /> Connected phone</h2><p className="mt-1 text-xs text-muted-foreground">{accounts.length} account{accounts.length === 1 ? "" : "s"} configured</p></div></div>
        <div className="mt-5 space-y-3">{accounts.length === 0 ? <div className="rounded-md border border-dashed p-7 text-center text-sm text-muted-foreground">No WhatsApp Business account configured yet.</div> : accounts.map(a => <article key={a.id} className="rounded-md border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{a.display_name || a.phone_number || "WhatsApp Business phone"}</p><p className="mt-1 text-xs text-muted-foreground">Phone ID {a.phone_number_id}{a.business_account_id ? " · Business " + a.business_account_id : ""}</p></div><span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (a.status === "connected" ? "bg-emerald-50 text-emerald-700" : a.status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{a.status}</span></div>{a.status !== "connected" && <p className="mt-3 text-xs text-muted-foreground">{a.status === "pending" ? "Waiting for provider verification." : "Meta verification failed or the account needs attention. Edit the credentials and save to retry."}</p>}{a.last_error && <p role="alert" className="mt-2 text-xs text-destructive">{a.last_error}</p>}<div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => void verifyAccount(a)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><ShieldCheck size={13} className="mr-1 inline" />{a.status === "connected" ? "Recheck" : "Verify now"}</button><button type="button" disabled={busy} onClick={() => { setEditingAccountId(a.id); setForm({ phoneNumberId: a.phone_number_id, businessAccountId: a.business_account_id ?? "", phoneNumber: a.phone_number ?? "", displayName: a.display_name ?? "", accessToken: "", verifyToken: "", appSecret: "" }); setShowWebhookSetupModal(true); }} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><Pencil size={13} className="mr-1 inline" />Edit</button><button type="button" disabled={busy} onClick={() => void disconnect(a.id)} className="rounded-lg border border-destructive/20 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><Unplug size={13} className="mr-1 inline" />Disconnect</button></div></article>)}</div>
      </section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7 lg:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-medium">Daily briefing</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{accounts.some(a => a.status === "connected") ? "Your verified WhatsApp channel can receive scheduled summaries once a briefing schedule is configured." : "Connect and verify a WhatsApp Business phone first. Then configure a schedule to deliver daily summaries to your chosen recipient."}</p></div><a href="/schedules" className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-secondary">Manage schedules</a></div></section>
    </div>
  </div></main>;
}
