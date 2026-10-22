"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchesManualComposeReview, normalizeManualComposeSnapshot, type ManualComposeSnapshot } from "@/lib/mail/manual-compose-review";

type Account = { id: string; provider: string; email_address: string; display_name?: string | null; status: string; capabilities: Record<string, boolean> };

export function ComposeClient({ organizationId }: { organizationId: string }) {
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draftId");
  const scopeKey = organizationId + ":" + (requestedDraftId ?? "");
  const scopeRef = useRef(scopeKey);
  const scopeRevisionRef = useRef(0);
  const organizationRef = useRef(organizationId);
  if (scopeRef.current !== scopeKey) {
    scopeRef.current = scopeKey;
    scopeRevisionRef.current += 1;
  }
  organizationRef.current = organizationId;
  const [formScope, setFormScope] = useState(scopeKey);
  const [formRevision, setFormRevision] = useState(0);
  const scopeValid = formScope === scopeKey && formRevision === scopeRevisionRef.current;
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
  const draftOperationRef = useRef<{ revision: number } | null>(null);
  const markEdited = () => { setReviewedSnapshot(null); setSavedAt(null); };

  useEffect(() => {
    const controller = new AbortController();
    const revision = scopeRevisionRef.current;
    // Never let the previous draft/tenant appear reviewable during navigation.
    setFormScope(scopeKey);
    setFormRevision(revision);
    setBusy(false);
    setDraftId(null);
    setApprovalId(null);
    setReviewedSnapshot(null);
    setSavedAt(null);
    setNotice(null);
    setTo(""); setCc(""); setBcc(""); setSubject(""); setBodyText("");
    setAccountId(requestedDraftId ? "" : accounts.find(a => a.status === "connected")?.id ?? "");
    if (!requestedDraftId) {
      setLoadingDraft(false);
      return () => controller.abort();
    }
    setLoadingDraft(true);
    void fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&draftId=" + encodeURIComponent(requestedDraftId), {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not load draft.");
      return data.draft;
    }).then((draft: Record<string, unknown> | null) => {
      if (controller.signal.aborted || scopeRef.current !== scopeKey || scopeRevisionRef.current !== revision) return;
      if (!draft || String(draft.id) !== requestedDraftId) throw new Error("Draft response does not match the selected draft.");
      setDraftId(String(draft.id));
      setAccountId(String(draft.email_account_id));
      setTo(Array.isArray(draft.to_recipients) ? draft.to_recipients.join(", ") : "");
      setCc(Array.isArray(draft.cc_recipients) ? draft.cc_recipients.join(", ") : "");
      setBcc(Array.isArray(draft.bcc_recipients) ? draft.bcc_recipients.join(", ") : "");
      setSubject(String(draft.subject ?? ""));
      setBodyText(String(draft.text_body ?? ""));
      setSavedAt(draft.updated_at ? new Date(String(draft.updated_at)).toLocaleTimeString() : null);
      setReviewedSnapshot(normalizeManualComposeSnapshot({
        to: draft.to_recipients, cc: draft.cc_recipients, bcc: draft.bcc_recipients,
        subject: draft.subject ?? "", bodyText: draft.text_body ?? "",
      }));
    }).catch(error => {
      if (controller.signal.aborted || scopeRef.current !== scopeKey || scopeRevisionRef.current !== revision) return;
      setNotice(error instanceof Error ? error.message : "Could not load draft.");
    }).finally(() => {
      if (!controller.signal.aborted && scopeRef.current === scopeKey && scopeRevisionRef.current === revision) setLoadingDraft(false);
    });
    return () => controller.abort();
    // accounts only provides a default sender; mailbox loading is an
    // independent request and must never replace a selected saved sender.
  }, [organizationId, requestedDraftId]);

  useEffect(() => {
    const controller = new AbortController();
    setAccounts([]);
    void fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not load mailboxes.");
      return data.accounts ?? [];
    }).then((items: Account[]) => {
      if (controller.signal.aborted || organizationRef.current !== organizationId) return;
      setAccounts(items);
      if (!requestedDraftId) {
        const first = items.find(account => account.status === "connected");
        setAccountId(current => current || first?.id || "");
      }
    }).catch(error => {
      if (controller.signal.aborted || organizationRef.current !== organizationId) return;
      setNotice(error instanceof Error ? error.message : "Could not load mailboxes.");
    });
    return () => controller.abort();
  }, [organizationId]);

  const recipients = useMemo(() => to.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [to]);
  const ccRecipients = useMemo(() => cc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [cc]);
  const bccRecipients = useMemo(() => bcc.split(/[,\n]/).map(v => v.trim().toLowerCase()).filter(Boolean), [bcc]);

  const currentSnapshot = { to: recipients, cc: ccRecipients, bcc: bccRecipients, subject, bodyText };
  const canRequestApproval = Boolean(
    scopeValid && draftId && reviewedSnapshot && !busy && !loadingDraft && !approvalId
    && matchesManualComposeReview(currentSnapshot, reviewedSnapshot)
  );

  async function saveDraft() {
    if (!scopeValid || draftOperationRef.current?.revision === scopeRevisionRef.current || busy || loadingDraft || approvalId || (requestedDraftId && !draftId)) return;
    if (!accountId || recipients.length === 0) {
      setNotice("Select a mailbox and add at least one valid recipient.");
      return;
    }
    const operationScope = scopeKey;
    const operationRevision = scopeRevisionRef.current;
    draftOperationRef.current = { revision: operationRevision };
    setBusy(true);
    setNotice(null);
    try {
      const payload = { organizationId, emailAccountId: accountId, to: recipients, cc: ccRecipients, bcc: bccRecipients, subject, bodyText };
      const response = await fetch("/api/mail/drafts", {
        method: draftId ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(draftId ? { ...payload, messageId: draftId } : payload),
      });
      const data = await response.json();
      if (scopeRef.current !== operationScope || scopeRevisionRef.current !== operationRevision) return;
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
      if (scopeRef.current === operationScope && scopeRevisionRef.current === operationRevision) {
        setReviewedSnapshot(null);
        setNotice(error instanceof Error ? error.message : "Could not save draft.");
      }
    } finally {
      if (draftOperationRef.current?.revision === operationRevision) draftOperationRef.current = null;
      if (scopeRef.current === operationScope && scopeRevisionRef.current === operationRevision) setBusy(false);
    }
  }

  async function requestSendApproval() {
    if (!canRequestApproval || !draftId || !reviewedSnapshot || draftOperationRef.current?.revision === scopeRevisionRef.current) {
      setNotice("Save and review the current recipients, subject and message before requesting approval.");
      return;
    }
    const operationScope = scopeKey;
    const operationRevision = scopeRevisionRef.current;
    draftOperationRef.current = { revision: operationRevision };
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
      if (scopeRef.current !== operationScope || scopeRevisionRef.current !== operationRevision) return;
      if (!response.ok) throw new Error(data.message ?? "Could not request send approval.");
      if (!data.action?.id || data.status !== "pending_approval") {
        throw new Error("The server did not confirm a pending human approval request.");
      }
      setApprovalId(String(data.action.id));
      setNotice("Send approval requested for the saved draft. No email will be sent until an authorized user approves it.");
    } catch (error) {
      if (scopeRef.current === operationScope && scopeRevisionRef.current === operationRevision) {
        setNotice(error instanceof Error ? error.message : "Could not request send approval.");
        setReviewedSnapshot(null);
      }
    } finally {
      if (draftOperationRef.current?.revision === operationRevision) draftOperationRef.current = null;
      if (scopeRef.current === operationScope && scopeRevisionRef.current === operationRevision) setBusy(false);
    }
  }

  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground">← Back to inbox</a><a href="/mail/approvals" className="text-sm font-semibold text-muted-foreground underline underline-offset-4">Approvals</a></div><span className="text-xs text-muted-foreground">{savedAt ? "Saved " + savedAt : "Local draft"}</span></div>
    <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
      <header className="border-b border-border p-5 sm:p-6"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p><h1 className="font-display text-2xl font-medium">New draft<span className="text-tertiary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Drafts are persisted locally first. Sending remains an authorized provider action and is not simulated.</p></header>
      {notice && <div role="alert" className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{notice}</div>}
      <div className="space-y-4 p-6">
        <label className="block text-sm font-medium">From<select value={accountId} onChange={e=>{ setAccountId(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(draftId) || Boolean(approvalId)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20">{accounts.length===0?<option value="">No configured mailbox</option>:accounts.map(a=><option key={a.id} value={a.id}>{a.display_name || a.email_address} · {a.provider} · {a.status}</option>)}</select></label>
        <label className="block text-sm font-medium">To<input value={to} onChange={e=>{ setTo(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId)} placeholder="recipient@example.com, another@example.com" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20"/></label>
        <label className="block text-sm font-medium">Cc<input value={cc} onChange={e=>{ setCc(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Bcc<input value={bcc} onChange={e=>{ setBcc(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Subject<input value={subject} onChange={e=>{ setSubject(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId)} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
        <label className="block text-sm font-medium">Message<textarea value={bodyText} onChange={e=>{ setBodyText(e.target.value); markEdited(); }} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId)} rows={14} className="mt-2 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-ring/20"/></label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={()=>void saveDraft()} disabled={busy || loadingDraft || !scopeValid || Boolean(approvalId) || Boolean(requestedDraftId && !draftId) || accounts.length===0} className="rounded-md border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button><button type="button" disabled={!canRequestApproval} className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50" onClick={()=>void requestSendApproval()} title="Sending requires explicit approval" >{approvalId ? "Approval requested" : "Request send approval"}</button></div>
      </div>
    </section>
  </div></main>;
}
