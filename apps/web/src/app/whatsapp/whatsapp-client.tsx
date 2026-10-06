"use client";

import { useEffect, useState } from "react";

type Account = { id: string; phone_number_id: string; phone_number?: string | null; display_name?: string | null; business_account_id?: string | null; status: string; last_error?: string | null };

export default function WhatsAppClient({ organizationId }: { organizationId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; direction: string; body?: string | null; status: string; phone_number?: string | null; display_name?: string | null; created_at: string }>>([]);
  const [recipient, setRecipient] = useState("");
  const [messageBody, setMessageBody] = useState("");

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

  const credentialFields = [\n    ["phoneNumberId", "Phone number ID", false],\n    ["businessAccountId", "Business account ID", false],\n    ["phoneNumber", "Display phone number", false],\n    ["displayName", "Display name", false],\n    ["accessToken", "Access token", true],\n  ] as const;\n\n  async function save() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, ...form }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not save WhatsApp configuration.");
      setForm({ phoneNumberId: "", businessAccountId: "", phoneNumber: "", displayName: "", accessToken: "" });
      setNotice("WhatsApp credentials were encrypted and stored. The account remains pending until a worker verifies Meta connectivity.");
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save WhatsApp configuration."); } finally { setBusy(false); }
  }


  async function sendMessage() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, accountId: selectedAccountId, to: recipient, body: messageBody, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not queue WhatsApp message.");
      setMessageBody(""); setNotice("Message queued. The worker will send it only after the account is verified.");
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

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,.08),transparent_32%)] p-5 sm:p-7 lg:p-9"><div className="mx-auto max-w-[1200px]">
    <header><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Messaging</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">WhatsApp</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Connect exactly one WhatsApp Business phone per agent. Credentials stay server-side and encrypted; no provider success is fabricated before verification.</p></header>
    {notice && <div role="status" className="mt-5 rounded-2xl border bg-background px-4 py-3 text-sm">{notice}</div>}
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-7 lg:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Conversation channel</h2><p className="mt-1 text-xs text-muted-foreground">Inbound webhook messages and worker-queued outbound text. No fake messages are inserted.</p></div><select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">{accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.phone_number || a.phone_number_id}</option>)}</select></div><div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto rounded-2xl bg-muted/30 p-4">{messages.length ? messages.slice().reverse().map(m=><div key={m.id} className={"flex " + (m.direction === "outbound" ? "justify-end" : "justify-start")}><div className={"max-w-[80%] rounded-2xl border px-4 py-3 text-sm " + (m.direction === "outbound" ? "bg-foreground text-background" : "bg-background")}><p className="whitespace-pre-wrap">{m.body || "[" + m.status + "]"}</p><p className="mt-1 text-[10px] opacity-60">{m.phone_number || "WhatsApp"} · {m.status}</p></div></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No persisted messages yet.</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]"><input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="+919876543210" className="h-11 rounded-xl border bg-background px-3 text-sm"/><input value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Write a WhatsApp message…" className="h-11 rounded-xl border bg-background px-3 text-sm"/><button type="button" disabled={busy || !selectedAccountId || !recipient || !messageBody} onClick={()=>void sendMessage()} className="h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Queueing…" : "Queue message"}</button></div></section>
      <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Connected phone</h2><p className="mt-1 text-xs text-muted-foreground">{accounts.length} account{accounts.length === 1 ? "" : "s"} configured</p></div></div>
        <div className="mt-5 space-y-3">{accounts.length === 0 ? <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">No WhatsApp Business account configured yet.</div> : accounts.map(a => <article key={a.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{a.display_name || a.phone_number || "WhatsApp Business phone"}</p><p className="mt-1 text-xs text-muted-foreground">Phone ID {a.phone_number_id}{a.business_account_id ? " · Business " + a.business_account_id : ""}</p></div><span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (a.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{a.status}</span></div><div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={() => void disconnect(a.id)} className="rounded-lg border border-destructive/20 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50">Disconnect</button></div></article>)}</div>
      </section>
      <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-7"><h2 className="font-semibold">Meta Cloud API</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Enter the server-side values from your Meta WhatsApp Business setup. The access token is never returned to the browser after submission.</p>
        <div className="mt-5 space-y-3">{credentialFields.map(([key,label,secret])=><label key={key} className="block"><span className="text-xs font-medium">{label}</span><input type={secret ? "password" : "text"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" autoComplete={secret ? "new-password" : "off"} /></label>)}</div>
        <button type="button" disabled={busy || !form.phoneNumberId || !form.accessToken} onClick={() => void save()} className="mt-5 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving…" : "Save encrypted configuration"}</button>
      </section>
    </div>
  </div></main>;
}
