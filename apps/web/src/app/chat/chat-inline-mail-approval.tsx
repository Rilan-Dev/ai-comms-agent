"use client";

import { useRef, useState } from "react";
import { validateChatEmailApproval, type ChatEmailApproval } from "@/lib/chat/inline-mail-approval";

/**
 * A full, authoritative human review inside Chat. GET is initiated by a
 * deliberate click; PATCH only after displaying the persisted snapshot,
 * explicit acknowledgement, and confirmation. Both endpoints independently
 * authorize the signed-in reviewer; approving queues the worker, not a
 * browser-side provider send.
 */
export function InlineMailApprovalReview({ organizationId, actionId, draftId, accountId }: {
  organizationId: string;
  actionId: string;
  draftId: string;
  accountId: string;
}) {
  const [approval, setApproval] = useState<ChatEmailApproval | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [decisionDone, setDecisionDone] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  async function loadReview() {
    if (inFlight.current || decisionDone) return;
    inFlight.current = true;
    setLoading(true);
    setApproval(null);
    setReviewConfirmed(false);
    setNotice("");
    try {
      const query = new URLSearchParams({ organizationId, actionId });
      const response = await fetch("/api/mail/actions?" + query.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Only authorized organization reviewers can inspect this email request.");
      const verified = validateChatEmailApproval(data.action, { actionId, draftId, accountId });
      if (!verified) throw new Error("This saved email request is missing, mismatched, expired or no longer awaiting approval. Nothing was sent.");
      setApproval(verified);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load the saved email request.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  async function approve() {
    if (inFlight.current || loading || decisionDone || !approval || !reviewConfirmed) return;
    const recipients = approval.recipientSnapshot.to.join(", ");
    if (!window.confirm("Approve the exact email shown to " + recipients +
      "? This authorizes the worker to send it. Delivery is not guaranteed and dispatch cannot be undone.")) return;
    inFlight.current = true;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/mail/actions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, actionId, decision: "approved" }),
      });
      const data = await response.json();
      if (!response.ok || data.action?.id !== actionId || data.action?.status !== "approved") {
        throw new Error(data.message ?? "Approval was not confirmed; reload its status before trying again.");
      }
      setDecisionDone(true);
      setApproval(null);
      setReviewConfirmed(false);
      setNotice("Approval accepted for worker processing. This Chat view has not verified the delivery outcome; check your Sent mailbox or action status.");
    } catch (error) {
      // The result may be uncertain after a network failure. The user must
      // reload the authoritative action status instead of retrying blindly.
      setReviewConfirmed(false);
      setApproval(null);
      setNotice((error instanceof Error ? error.message : "Unable to confirm approval.") +
        " Check the approval queue before any retry.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  const snapshot = approval?.recipientSnapshot;
  return (
    <section aria-label="Review and approve sending from Chat" className="mt-4 rounded-xl border border-primary/20 bg-card p-4">
      <h3 className="text-sm font-semibold">Human send approval</h3>
      <p className="mt-1 text-xs text-muted-foreground">Authorized reviewers can inspect the saved request and approve sending here. A draft is never sent merely by saving or requesting approval.</p>
      {!approval && !decisionDone ? (
        <button type="button" disabled={loading} onClick={() => void loadReview()}
          className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          {loading ? "Loading saved request…" : "Load saved approval for review"}
        </button>
      ) : null}
      {snapshot && !decisionDone ? (
        <div className="mt-3 space-y-3 text-sm">
          <div className="rounded-lg border p-3">
            <p><strong>To:</strong> {snapshot.to.join(", ")}</p>
            {snapshot.cc.length > 0 ? <p><strong>Cc:</strong> {snapshot.cc.join(", ")}</p> : null}
            {snapshot.bcc.length > 0 ? <p><strong>Bcc:</strong> {snapshot.bcc.join(", ")}</p> : null}
            <p><strong>Subject:</strong> {snapshot.subject}</p>
          </div>
          <div>
            <p className="text-xs font-semibold">Exact persisted email body</p>
            <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-sans text-xs">{snapshot.bodyText}</pre>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={reviewConfirmed} disabled={loading}
              onChange={event => setReviewConfirmed(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span>Reviewed recipient, subject and body. I authorize this saved request to be sent if I click Approve.</span>
          </label>
          <button type="button" disabled={loading || !reviewConfirmed} onClick={() => void approve()}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            Approve &amp; queue email sending
          </button>
        </div>
      ) : null}
      {notice ? <p role="status" className="mt-3 text-xs text-muted-foreground">{notice}</p> : null}
      <a href="/mail/approvals" className="mt-3 inline-block text-xs font-medium text-primary underline">Open full approval queue</a>
    </section>
  );
}
