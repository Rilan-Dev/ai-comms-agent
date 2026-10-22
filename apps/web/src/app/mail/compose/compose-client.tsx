"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchesManualComposeReview, normalizeManualComposeSnapshot, type ManualComposeSnapshot } from "@/lib/mail/manual-compose-review";

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
  const [reviewedSnapshot, setReviewedSnapshot] = useState<ManualComposeSnapshot | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(requestedDraftId));
  const draftOperationRef = useRef(false);
  const markEdited = () => { setReviewedSnapshot(null); setSavedAt(null); };

  useEffect(() => {
    if (!requestedDraftId) { setLoadingDraft(false); return; }
    setLoadingDraft(true);
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
        setReviewedSnapshot(normalizeManualComposeSnapshot({ to: d.to_recipients, cc: d.cc_recipients, bcc: d.bcc_recipients, subject: d.subject ?? "", bodyText: d.text_body ?? "" }));
      })
      .catch(e => setNotice(e instanceof Error ? e.message : "Could not load draft."))
      .finally(() => setLoadingDraft(false));
  }, [organizationId, requestedDraftId]);

  useEffect(() => {
    void fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not load mailboxes."); return d.accounts ?? []; })
      .then((items: Account[]) => { setAccounts(items); const first = items.find(a => a.status === "connected"); setAccountId(current => current || first?.id || ""); })
      .catch(e => setNotice(e instanceof Error ? e.message : "Could not load mailboxes."));
  }, [organizationId]);

  const recipients = useMemo(() => to.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [to]);
  const ccRecipients = useMemo(() => cc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [cc]);
  const bccRecipients = useMemo(() => bcc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [bcc]);

  const currentSnapshot = { to: recipients, cc: ccRecipients, bcc: bccRecipients, subject, bodyText };
  const canRequestApproval = Boolean(
    draftId && reviewedSnapshot && !busy && !loadingDraft && !approvalId
    && matchesManualComposeReview(currentSnapshot, reviewedSnapshot)
  );

  async function saveDraft() {
    if (draftOperationRef.current || busy || loadingDraft || approvalId || (requestedDraftId && !draftId)) return;
    if (!accountId || recipients.length === 0) {
      setNotice("Select a mailbox and add at least one valid recipient.");
      return;
    }
    draftOperationRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const payload = { organizationId, emailAccountId: accountId, to: recipients, cc: ccRecipients, bcc: bccRecipients, subject, bodyText };
      const response = await fetch("/api/mail/drafts", {
        method: draftId ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(draftId ? { ...payload, messageId: draftId } : payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not save draft.");
      if (!data.draft?.id || String(data.draft.email_account_id) !== accountId) {
        throw new Error("Draft save returned an unexpected mailbox or record. Reload before requesting approval.");
      }
      const persisted = {
        to: data.draft.to_recipients, cc: data.draft.cc_recipients, bcc: data.draft.bcc_recipients,
        subject: data.draft.subject ?? "", bodyText: data.draft.text_body ?? "",
      };
      setDraftId(String(data.draft.id));
      const confirmed = matchesManualComposeReview(persisted, payload);
      setReviewedSnapshot(confirmed ? normalizeManualComposeSnapshot(payload) : null);
      setSavedAt(confirmed ? new Date().toLocaleTimeString() : null);
      if (!confirmed) setNotice("Draft saved, but the saved content is not identical to this review. Check recipients and subject, then save again.");
    } catch (error) {
      setReviewedSnapshot(null);
      setNotice(error instanceof Error ? error.message : "Could not save draft.");
    } finally {
      draftOperationRef.current = false;
      setBusy(false);
    }
  }

  async function requestSendApproval() {
    if (!canRequestApproval || !draftId || !reviewedSnapshot || draftOperationRef.current) {
      setNotice("Save and review the current recipients, subject and message before requesting approval.");
      return;
    }
    draftOperationRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/mail/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId, emailAccountId: accountId, actionType: "send_email", draftId,
          expectedSnapshot: reviewedSnapshot,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not request send approval.");
      if (!data.action?.id || data.status !== "pending_approval") {
        throw new Error("The server did not confirm a pending human approval request.");
      }
      setApprovalId(String(data.action.id));
      setNotice("Send approval requested for the saved draft. No email will be sent until an authorized user approves it.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not request send approval.");
      setReviewedSnapshot(null);
    } finally {
      draftOperationRef.current = false;
      setBusy(false);
    }
  }

  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground">← Back to inbox</a><a href="/mail/approvals" className="text-sm font-semibold text-muted-foreground underline underline-offset-4">Approvals</a></div><span className="text-xs text-muted-foreground">{savedAt ? "Saved " + savedAt : "Local draft"}</span></div>
    <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
      <header className="border-b border-border p-5 sm:p-6"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p><h1 className="font-display text-2xl font-medium">New draft<span className="text-tertiary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Drafts are persisted locally first. Sending remains an authorized provider action and is not simulated.</p></header>
      {notice && <div role="alert" className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{notice}</div>}
      <div className="space-y-4 p-6">
        <label className="block text-sm font-medium">From<select value={accountId} onChange={e=>{ setAccountId(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(draftId) || Boolean(approvalId)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20">{accounts.length===0?<option value="">No configured mailbox</option>:accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.email_address} · {a.provider} · {a.status}</option>)}</select></label>
        <label className="block text-sm font-medium">To<input value={to} onChange={e=>{ setTo(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(approvalId)} placeholder="recipient@example.com, another@example.com" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20"/></label>
        <label className="block text-sm font-medium">Cc<input value={cc} onChange={e=>{ setCc(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Bcc<input value={bcc} onChange={e=>{ setBcc(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Subject<input value={subject} onChange={e=>{ setSubject(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Message<textarea value={bodyText} onChange={e=>{ setBodyText(e.target.value); markEdited(); }} disabled={busy || loadingDraft || Boolean(approvalId)} rows={14} className="mt-2 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-ring/20"/></label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={()=>void saveDraft()} disabled={busy || loadingDraft || Boolean(approvalId) || Boolean(requestedDraftId && !draftId) || accounts.length===0} className="rounded-md border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button><button type="button" disabled={!canRequestApproval} className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50" onClick={()=>void requestSendApproval()} title="Sending requires explicit approval" >{approvalId ? "Approval requested" : "Request send approval"}</button></div>
      </div>
    </section>
  </div></main>;
}
