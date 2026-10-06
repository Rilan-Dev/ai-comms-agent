"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Account = { id: string; provider: string; email_address: string; display_name?: string | null; status: string; capabilities: Record<string, boolean> };

export function ComposeClient({ organizationId }: { organizationId: string }) {
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draftId");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  useEffect(() => {
    if (!requestedDraftId) return;
    void fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&draftId=" + encodeURIComponent(requestedDraftId), { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not load draft."); return d.draft; })
      .then((d: Record<string, any>) => {
        setDraftId(String(d.id));
        setAccountId(String(d.email_account_id));
        setTo(Array.isArray(d.to_recipients) ? d.to_recipients.join(", ") : "");
        setCc(Array.isArray(d.cc_recipients) ? d.cc_recipients.join(", ") : "");
        setBcc(Array.isArray(d.bcc_recipients) ? d.bcc_recipients.join(", ") : "");
        setSubject(String(d.subject ?? ""));
        setBodyText(String(d.text_body ?? ""));
        setSavedAt(d.updated_at ? new Date(String(d.updated_at)).toLocaleTimeString() : null);
      })
      .catch(e => setNotice(e instanceof Error ? e.message : "Could not load draft."));
  }, [organizationId, requestedDraftId]);

  useEffect(() => {
    void fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not load mailboxes."); return d.accounts ?? []; })
      .then((items: Account[]) => { setAccounts(items); const first = items.find(a => a.status === "connected" || a.status === "pending"); if (first) setAccountId(first.id); })
      .catch(e => setNotice(e instanceof Error ? e.message : "Could not load mailboxes."));
  }, [organizationId]);

  const recipients = useMemo(() => to.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [to]);
  const ccRecipients = useMemo(() => cc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [cc]);
  const bccRecipients = useMemo(() => bcc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [bcc]);

  async function saveDraft() {
    if (!accountId || recipients.length === 0) { setNotice("Select a mailbox and add at least one recipient."); return; }
    setBusy(true); setNotice(null);
    try {
      const payload = { organizationId, emailAccountId: accountId, to: recipients, cc: ccRecipients, bcc: bccRecipients, subject, bodyText };
      const response = await fetch(draftId ? "/api/mail/drafts" : "/api/mail/drafts", { method: draftId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draftId ? { ...payload, messageId: draftId } : payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not save draft.");
      setDraftId(String(data.draft.id)); setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save draft."); }
    finally { setBusy(false); }
  }

  async function requestSendApproval() {
    if (!draftId) {
      await saveDraft();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/mail/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, emailAccountId: accountId, actionType: "send_email", draftId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not request send approval.");
      setApprovalId(String(data.action.id));
      setNotice("Send approval requested. The message will not leave this mailbox until an authorized user approves it.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not request send approval.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!draftId) return;
    const timer = setTimeout(() => { void saveDraft(); }, 900);
    return () => clearTimeout(timer);
  }, [to, cc, bcc, subject, bodyText]);

  return <main className="min-h-full bg-muted/20 p-5 sm:p-7 lg:p-9"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground">← Back to inbox</a><a href="/mail/approvals" className="text-sm font-semibold text-muted-foreground underline underline-offset-4">Approvals</a></div><span className="text-xs text-muted-foreground">{savedAt ? "Saved " + savedAt : "Local draft"}</span></div>
    <section className="mt-6 overflow-hidden rounded-3xl border bg-background shadow-sm">
      <header className="border-b p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail</p><h1 className="mt-2 text-2xl font-semibold">New draft</h1><p className="mt-2 text-sm text-muted-foreground">Drafts are persisted locally first. Sending remains an authorized provider action and is not simulated.</p></header>
      {notice && <div role="alert" className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{notice}</div>}
      <div className="space-y-4 p-6">
        <label className="block text-sm font-medium">From<select value={accountId} onChange={e=>setAccountId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3">{accounts.length===0?<option value="">No configured mailbox</option>:accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.email_address} · {a.provider} · {a.status}</option>)}</select></label>
        <label className="block text-sm font-medium">To<input value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@example.com, another@example.com" className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Cc<input value={cc} onChange={e=>setCc(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Bcc<input value={bcc} onChange={e=>setBcc(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Message<textarea value={bodyText} onChange={e=>setBodyText(e.target.value)} rows={14} className="mt-2 w-full resize-y rounded-xl border bg-background p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20"/></label>
        <div className="flex flex-wrap justify-end gap-3 border-t pt-5"><button type="button" onClick={()=>void saveDraft()} disabled={busy || accounts.length===0} className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button><button type="button" disabled={busy || accounts.length===0 || !draftId || Boolean(approvalId)} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50" onClick={()=>void requestSendApproval()} title="Sending requires explicit approval" >{approvalId ? "Approval requested" : "Request send approval"}</button></div>
      </div>
    </section>
  </div></main>;
}
