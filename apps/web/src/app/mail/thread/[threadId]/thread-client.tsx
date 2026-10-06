"use client";

import { useState } from "react";

type Message = Record<string, any>;

export function ThreadClient({ organizationId, threadId, initialMessages }: { organizationId: string; threadId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = messages[messages.length - 1];
  const [replyBody, setReplyBody] = useState("");

  async function markRead(id: string) {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/messages/read-state", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, messageIds: [id], isRead: true }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not mark the message read.");
      setMessages(current => current.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not update the message."); } finally { setBusy(false); }
  }

  async function requestReply() {
    if (!latest?.id || !latest?.email_account_id) return;
    if (!replyBody.trim()) { setNotice("Enter a reply before requesting approval."); return; }
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, emailAccountId: latest.email_account_id, actionType: "reply_email", messageId: latest.id, bodyText: replyBody }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not create the approval request.");
      setReplyBody(""); setNotice("Reply request created. It is pending approval and will not send automatically.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create the approval request."); } finally { setBusy(false); }
  }

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,.08),transparent_32%)] p-5 sm:p-7 lg:p-9">
    <div className="mx-auto max-w-4xl">
      <a href="/mail/inbox" className="text-sm font-semibold underline underline-offset-4">← Inbox</a>
      <header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail thread</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{latest?.subject || "(No subject)"}</h1><p className="mt-2 text-xs text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"}</p></header>
      {notice && <div role="status" className="mt-5 rounded-xl border bg-background px-4 py-3 text-sm">{notice}</div>}
      <section className="mt-6 space-y-4">{messages.map((m, i) => <article key={m.id} className="rounded-3xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{m.from_email || m.from_address || "Unknown sender"}</p><p className="text-xs text-muted-foreground">{m.account_email || ""} · {m.received_at ? new Date(m.received_at).toLocaleString() : "No date"}</p></div><button type="button" disabled={busy || m.is_read} onClick={() => void markRead(String(m.id))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{m.is_read ? "Read" : "Mark read"}</button></div>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-7">{m.text_body || "No text body available."}</div>
        {m.has_attachments && <p className="mt-5 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">This message has attachments. Secure attachment retrieval is exposed only after provider/storage integration is available.</p>}
      </article>)}</section>
      <section className="mt-6 rounded-3xl border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Reply</h2><span className="text-xs text-muted-foreground">Approval required</span></div><textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write a reply…" rows={6} className="mt-4 w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/><div className="mt-3 flex justify-end"><button type="button" disabled={busy} onClick={() => void requestReply()} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Submitting…" : "Request approval"}</button></div></section>
    </div>
  </main>;
}
