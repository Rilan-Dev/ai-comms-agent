"use client";

import { useState } from "react";
import { Eye, Code2 } from "lucide-react";
import { buildEmailPreviewDocument } from "@/lib/email/html-preview-document";

type Message = Record<string, any>;
type Attachment = { id: string; filename: string; content_type?: string | null; size_bytes?: number | null; scan_status: string; download_available: boolean };

export function ThreadClient({ organizationId, threadId, initialMessages }: { organizationId: string; threadId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Per-message view mode: "html" (rendered) or "text" (raw text_body).
  // Defaults to "html" when html_body is available, else "text".
  const [viewModes, setViewModes] = useState<Record<string, "html" | "text">>(() => {
    const initial: Record<string, "html" | "text"> = {};
    for (const m of initialMessages) {
      initial[m.id as string] = m.html_body ? "html" : "text";
    }
    return initial;
  });
  const latest = messages[messages.length - 1];
  const [replyBody, setReplyBody] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});


  async function loadAttachments(messageId: string) {
    try {
      const r = await fetch("/api/mail/attachments?organizationId=" + encodeURIComponent(organizationId) + "&messageId=" + encodeURIComponent(messageId), { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setAttachments(current => ({ ...current, [messageId]: d.attachments ?? [] }));
    } catch {}
  }

  async function markRead(id: string) {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/messages/read-state", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, messageIds: [id], isRead: true }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not mark the message read.");
      setMessages(current => current.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not update the message."); } finally { setBusy(false); }
  }

  async function requestForward() {
    if (!latest?.id || !latest?.email_account_id) return;
    const recipients = forwardTo.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean);
    if (recipients.length === 0) { setNotice("Add at least one forwarding recipient."); return; }
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, emailAccountId: latest.email_account_id, actionType: "forward_email", messageId: latest.id, to: recipients }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not create the forwarding approval request.");
      setForwardTo(""); setNotice("Forward request created. It is pending approval and will not send automatically.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create the forwarding approval request."); } finally { setBusy(false); }
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

  function setViewMode(messageId: string, mode: "html" | "text") {
    setViewModes(current => ({ ...current, [messageId]: mode }));
  }

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,oklch(0.88_0.105_152/.14),transparent_32%)] p-5 sm:p-7 lg:p-9">
    <div className="mx-auto max-w-4xl">
      <a href="/mail/inbox" className="text-sm font-semibold underline underline-offset-4">← Inbox</a>
      <header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail thread</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{latest?.subject || "(No subject)"}</h1><p className="mt-2 text-xs text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"}</p></header>
      {notice && <div role="status" className="mt-5 rounded-xl border bg-background px-4 py-3 text-sm">{notice}</div>}
      <section className="mt-6 space-y-4">{messages.map((m) => {
        const mode = viewModes[m.id] ?? (m.html_body ? "html" : "text");
        return <article key={m.id} className="rounded-3xl border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">{m.from_name || m.from_email || m.from_address || "Unknown sender"}</p>
              <p className="text-xs text-muted-foreground">
                {m.from_email || m.from_address ? `<${m.from_email || m.from_address}>` : ""}
                {m.to_addresses?.length ? ` → ${m.to_addresses.join(", ")}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{m.account_email || ""} · {m.received_at ? new Date(m.received_at).toLocaleString() : "No date"}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle HTML / Text view — only show if both bodies exist */}
              {m.html_body && m.text_body && (
                <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode(String(m.id), "html")}
                    className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "html" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                    aria-pressed={mode === "html"}
                  >
                    <Eye className="h-3 w-3" /> HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode(String(m.id), "text")}
                    className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                    aria-pressed={mode === "text"}
                  >
                    <Code2 className="h-3 w-3" /> Text
                  </button>
                </div>
              )}
              <button type="button" disabled={busy || m.is_read} onClick={() => void markRead(String(m.id))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{m.is_read ? "Read" : "Mark read"}</button>
            </div>
          </div>
          {/* Body rendering: HTML mode shows iframe sandbox (safe), text mode shows whitespace-pre-wrap.
              For very large text bodies (>100KB), truncate to prevent browser DOM freeze. */}
          <div className="mt-5">
            {mode === "html" && m.html_body ? (
              <HtmlEmailFrame htmlBody={String(m.html_body)} />
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-7">
                {m.text_body
                  ? (String(m.text_body).length > 100000
                      ? String(m.text_body).slice(0, 100000) + "\n\n… (truncated — full text body is " + Math.round(String(m.text_body).length / 1024) + "KB)"
                      : m.text_body)
                  : "No text body available."}
              </div>
            )}
          </div>
          {m.has_attachments && <p className="mt-5 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">This message has attachments. Secure attachment retrieval is exposed only after provider/storage integration is available.</p>}
        </article>;
      })}</section>
      <section className="mt-6 rounded-3xl border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Reply</h2><span className="text-xs text-muted-foreground">Approval required</span></div><textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write a reply…" rows={6} className="mt-4 w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/><div className="mt-3 flex justify-end"><button type="button" disabled={busy} onClick={() => void requestReply()} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Submitting…" : "Request approval"}</button></div></section>
      <section className="mt-4 rounded-3xl border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Forward</h2><span className="text-xs text-muted-foreground">Approval required</span></div><input value={forwardTo} onChange={e => setForwardTo(e.target.value)} placeholder="recipient@example.com" className="mt-4 h-11 w-full rounded-xl border bg-background px-3 text-sm"/><div className="mt-3 flex justify-end"><button type="button" disabled={busy} onClick={() => void requestForward()} className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Submitting…" : "Request forward approval"}</button></div></section>
    </div>
  </main>;
}

/**
 * MailFlow-inspired email reader with an opaque-origin iframe and restrictive
 * CSP. Embedded data: images and sender HTML layout work; tracking pixels,
 * scripts, forms, embeds, external styles and remote fonts never load.
 * Without allow-same-origin we intentionally use an internal scroll region
 * instead of reading the email's DOM for auto-height.
 */
function HtmlEmailFrame({ htmlBody }: { htmlBody: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">Formatted message · remote images blocked for privacy</p>
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          aria-expanded={expanded}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {expanded ? "Reduce preview" : "Expand preview"}
        </button>
      </div>
      <iframe
        srcDoc={buildEmailPreviewDocument(htmlBody)}
        title="Formatted email message (external content blocked)"
        sandbox=""
        referrerPolicy="no-referrer"
        loading="lazy"
        className={`block w-full border-0 bg-white ${expanded ? "h-[85vh]" : "h-[480px] sm:h-[600px]"}`}
      />
    </div>
  );
}
