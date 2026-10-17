"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send, ShieldCheck, Smartphone, Unplug, X } from "lucide-react";
import { WhatsAppWebhookSetupGuide } from "./whatsapp-webhook-setup-guide";

type Account = { id: string; phone_number_id: string; phone_number?: string | null; display_name?: string | null; business_account_id?: string | null; status: string; last_error?: string | null };

export default function WhatsAppClient({ organizationId }: { organizationId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" });
  const [busy, setBusy] = useState(false);
  const [showWebhookSetupModal, setShowWebhookSetupModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; direction: string; body?: string | null; status: string; phone_number?: string | null; display_name?: string | null; created_at: string }>>([]);
  const [recipient, setRecipient] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendIdempotencyKey, setSendIdempotencyKey] = useState<string | null>(null);

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

  const credentialFields = [
    ["phoneNumberId", "Phone number ID *", false],
    ["businessAccountId", "Business account ID", false],
    ["phoneNumber", "Display phone number", false],
    ["displayName", "Display name", false],
    ["accessToken", "Access token *", true],
    ["verifyToken", "Webhook Verify Token *", true],
  ] as const;

  async function save() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, ...form }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not save WhatsApp configuration.");
      setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "", verifyToken: "", appSecret: "" });
      setNotice("WhatsApp credentials were encrypted and stored. The account remains pending until a worker verifies Meta connectivity.");
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save WhatsApp configuration."); } finally { setBusy(false); }
  }


  async function sendMessage() {
    setBusy(true); setNotice(null);
    try {
      const idempotencyKey = sendIdempotencyKey ?? crypto.randomUUID();
      if (!sendIdempotencyKey) setSendIdempotencyKey(idempotencyKey);
      const r = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ organizationId, accountId: selectedAccountId, to: recipient, body: messageBody }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not queue WhatsApp message.");
      setMessageBody(""); setSendIdempotencyKey(null); setNotice(d.queued === false ? "This message was already queued; no duplicate was created." : "Message queued. The worker will send it only after the account is verified.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not queue WhatsApp message."); } finally { setBusy(false); }
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
          <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Guided connection</p><h2 id="whatsapp-webhook-modal-title" className="mt-1 text-lg font-semibold">WhatsApp Webhook Setup</h2><p className="mt-1 text-sm text-muted-foreground">Configure Meta and connect another phone in one place.</p></div>
          <button type="button" autoFocus aria-label="Close WhatsApp webhook setup" onClick={() => setShowWebhookSetupModal(false)} className="rounded-lg border p-2 hover:bg-muted"><X className="size-4" /></button>
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{credentialFields.map(([key,label,secret])=><label key={key} className="block"><span className="text-xs font-medium">{label}</span><input type={secret ? "password" : "text"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} required={key === "phoneNumberId" || key === "accessToken" || key === "verifyToken"} aria-label={label} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" autoComplete={secret ? "new-password" : "off"} /></label>)}</div>
        <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !form.phoneNumberId.trim() || !form.accessToken.trim() || !form.verifyToken.trim()} onClick={() => void save()} className="h-10 rounded-md bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving securely…" : "Save and connect"}</button></div>
      </div>
          </WhatsAppWebhookSetupGuide>
        </div>
      </section>
    </div>}
    <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Messaging</p><h1 className="mt-2 font-display text-3xl font-medium tracking-tight">WhatsApp Business</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Connect one WhatsApp Business phone to each agent. Credentials stay encrypted on the server; the account remains pending until Meta connectivity and webhook verification are confirmed.</p></div><button type="button" onClick={() => setShowWebhookSetupModal(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"><Smartphone size={16} />{accounts.length ? "Connect another phone" : "Connect WhatsApp Business"}</button></header>
    {notice && <div role="status" className="mt-5 rounded-md border bg-background px-4 py-3 text-sm">{notice}</div>}
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-md border bg-background p-5  sm:p-7 lg:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="flex items-center gap-2 font-display text-lg font-medium"><MessageCircle size={17} /> Conversation channel</h2><p className="mt-1 text-xs text-muted-foreground">Inbound webhook messages and worker-queued outbound text. No fake messages are inserted.</p></div><select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">{accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.phone_number || a.phone_number_id}</option>)}</select></div><div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto rounded-md bg-muted/30 p-4">{messages.length ? messages.slice().reverse().map(m=><div key={m.id} className={"flex " + (m.direction === "outbound" ? "justify-end" : "justify-start")}><div className={"max-w-[80%] rounded-md border px-4 py-3 text-sm " + (m.direction === "outbound" ? "bg-foreground text-background" : "bg-background")}><p className="whitespace-pre-wrap">{m.body || "[" + m.status + "]"}</p><p className="mt-1 text-[10px] opacity-60">{m.phone_number || "WhatsApp"} · {m.status}</p></div></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No persisted messages yet.</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]"><input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="+919876543210" className="h-11 rounded-md border bg-background px-3 text-sm"/><input value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Write a WhatsApp message…" className="h-11 rounded-md border bg-background px-3 text-sm"/><button type="button" disabled={busy || !selectedAccountId || !recipient || !messageBody} onClick={()=>void sendMessage()} className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"><><Send size={14} className="mr-2 inline" />{busy ? "Queueing…" : "Queue message"}</></button></div></section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-display text-lg font-medium"><Smartphone size={17} /> Connected phone</h2><p className="mt-1 text-xs text-muted-foreground">{accounts.length} account{accounts.length === 1 ? "" : "s"} configured</p></div></div>
        <div className="mt-5 space-y-3">{accounts.length === 0 ? <div className="rounded-md border border-dashed p-7 text-center text-sm text-muted-foreground">No WhatsApp Business account configured yet.</div> : accounts.map(a => <article key={a.id} className="rounded-md border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{a.display_name || a.phone_number || "WhatsApp Business phone"}</p><p className="mt-1 text-xs text-muted-foreground">Phone ID {a.phone_number_id}{a.business_account_id ? " · Business " + a.business_account_id : ""}</p></div><span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (a.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{a.status}</span></div>{a.status !== "connected" && <p className="mt-3 text-xs text-muted-foreground">Meta connectivity and webhook verification are not yet confirmed.</p>}{a.last_error && <p role="alert" className="mt-2 text-xs text-destructive">{a.last_error}</p>}<div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={() => void disconnect(a.id)} className="rounded-lg border border-destructive/20 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><Unplug size={13} className="mr-1 inline" />Disconnect</button></div></article>)}</div>
      </section>
      <section className="rounded-md border bg-background p-5 shadow-sm sm:p-7 lg:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-medium">Daily briefing</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{accounts.some(a => a.status === "connected") ? "Your verified WhatsApp channel can receive scheduled summaries once a briefing schedule is configured." : "Connect and verify a WhatsApp Business phone first. Then configure a schedule to deliver daily summaries to your chosen recipient."}</p></div><a href="/schedules" className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-secondary">Manage schedules</a></div></section>
    </div>
  </div></main>;
}
