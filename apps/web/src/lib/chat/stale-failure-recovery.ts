/**
 * Stale-failure conversation recovery.
 *
 * A production incident left conversation e4698119 with a run of
 * assistant answers claiming the mailbox could not be authorized. After the
 * underlying account_id resolution bug was fixed, those persisted answers
 * became stale: on every retry the model saw its own prior failures in the
 * conversation history, concluded the mailbox was still inaccessible, and
 * repeated the failure without calling any tool. The user could only escape
 * by starting a brand-new conversation, which a busy business user will not
 * know to do.
 *
 * This module detects that shape — recent history dominated by
 * access-failure-style assistant answers while the current message asks
 * about mail or WhatsApp — and returns a compact system guidance note that
 * instructs the model to re-run the read tools in THIS turn instead of
 * quoting its own stale conclusions.
 *
 * Contract kept deliberately conservative:
 * - Requires at least two failure-style assistant messages among the last
 *   six assistant messages (a single honest "I couldn't find X" answer is
 *   normal context, not poisoning).
 * - Only engages when the current message itself asks about email or
 *   WhatsApp, so ordinary conversational turns are untouched.
 * - Never claims the mailbox WILL work; it only demands a fresh tool
 *   attempt, so a genuinely broken binding still fails honestly.
 */

export type StaleFailureHistoryMessage = {
  role: string;
  content: string;
};

/** Access-failure language that marks an assistant answer as failure-style. */
const STALE_FAILURE_ANSWER_MARKERS =
  /\b(?:authorization(?:\s+failure|\s+error|\s+unavailable)?|not\s+authorized|authori[sz]ation\s+(?:failed|error)|access\s+(?:denied|failure|error)|couldn'?t\s+access|could\s+not\s+access|can'?t\s+access|cannot\s+access|unable\s+to\s+(?:access|retrieve|reach)|re-?authori[sz]e|reconnect|not\s+permitted|permission\s+denied|no\s+(?:inbox|mailbox)\s+(?:contents?|access)|account_not_available|authorization_unavailable)\b/i;

const ASKS_ABOUT_MAIL =
  /\b(?:e-?mails?|mails?|inbox|mailbox|unread|messages?|drafts?|whats\s?app)\b/i;

/** Failure answers must dominate the RECENT window, not the whole chat. */
const RECENT_ASSISTANT_WINDOW = 6;
const MIN_FAILURE_ANSWERS = 2;

export function isStaleFailureAnswer(content: string): boolean {
  return STALE_FAILURE_ANSWER_MARKERS.test(content)
    || /^(?:No saved draft or send request was confirmed for this turn\.|I couldn't complete that request safely\.)/.test(content.trim());
}

/**
 * Returns the recovery guidance system-message content, or null when the
 * history does not look poisoned or the current message is unrelated to
 * mail/WhatsApp.
 */
export function buildStaleFailureRecoveryGuidance(
  history: StaleFailureHistoryMessage[],
  currentMessage: string,
): string | null {
  const message = (currentMessage ?? "").trim();
  if (!message || !ASKS_ABOUT_MAIL.test(message)) return null;

  const recentAssistants = history
    .filter((entry) => entry.role === "assistant")
    .slice(-RECENT_ASSISTANT_WINDOW);
  const failureCount = recentAssistants.filter((entry) =>
    isStaleFailureAnswer(entry.content ?? "")).length;
  if (failureCount < MIN_FAILURE_ANSWERS) return null;

  return [
    "Stale-failure recovery notice:",
    "Earlier assistant messages in this conversation report authorization or access failures for a mailbox or WhatsApp account. Those results may be stale: account bindings and tool authorization may have been repaired since those turns.",
    "Do not repeat or rely on the earlier failure conclusion, and do not tell the user to reconnect an account that is already connected.",
    /\bwhats\s?app\b/i.test(message) && !/\b(?:e-?mails?|mailbox|inbox)\b/i.test(message)
      ? "Use only the current WhatsApp account context and authorized WhatsApp tools for this request. Do not read unrelated email to diagnose a WhatsApp request."
      : "Re-run the read tools now: call email.accounts.list first, then call email.messages.list (and other read tools) using the account id that email.accounts.list returns. Accept the mailbox address as an account_id value as well.",
    "Never replay a previous mutation or assume a prior send failed. Reconcile existing drafts and approvals; execute only the user's new explicit request through the current permission and approval checks.",
    "Only report an authorization or access failure if a tool you call in THIS turn actually fails; report the fresh result otherwise.",
  ].join(" ");
}
