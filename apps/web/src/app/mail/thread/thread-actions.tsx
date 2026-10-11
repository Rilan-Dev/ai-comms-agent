"use client";

import { useState } from "react";

export function ThreadActions({
  organizationId,
  emailAccountId,
  messageId,
}: {
  organizationId: string;
  emailAccountId: string;
  messageId: string;
}) {
  const [mode, setMode] = useState<"reply" | "forward" | null>(null);
  const [to, setTo] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestApproval(actionType: "reply_email" | "forward_email") {
    setBusy(true);
    setNotice(null);
    try {
      const recipients = to.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
      const response = await fetch("/api/mail/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          emailAccountId,
          messageId,
          actionType,
          to: recipients,
          bodyText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not request approval.");
      setNotice("Approval requested. Provider execution will occur only after an authorized approval.");
      setMode(null);
      setTo("");
      setBodyText("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not request approval.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-5 rounded-3xl border bg-background p-5 shadow-sm">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setMode("reply")} className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted">Reply</button>
      <button type="button" onClick={() => setMode("forward")} className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted">Forward</button>
    </div>
    {notice && <p role="status" className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{notice}</p>}
    {mode && <div className="mt-4 space-y-3">
      {mode === "forward" && <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" className="h-11 w-full rounded-xl border bg-background px-3 text-sm" />}
      <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={6} placeholder={mode === "reply" ? "Write your reply…" : "Add a note before forwarding…"} className="w-full rounded-xl border bg-background p-3 text-sm leading-6" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setMode(null)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Cancel</button>
        <button type="button" disabled={busy || (mode === "forward" && !to.trim())} onClick={() => void requestApproval(mode === "reply" ? "reply_email" : "forward_email")} className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50">{busy ? "Requesting…" : "Request approval"}</button>
      </div>
    </div>}
  </div>;
}
