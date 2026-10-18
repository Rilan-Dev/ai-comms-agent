/**
 * Conservative route for a rolling-window email report. Recognize the current
 * user's explicit scope, not prior assistant text (which may be hallucinated).
 * Queries outside this narrow contract continue through the normal authorized
 * tool path rather than silently dropping sender/subject constraints.
 */
export type RollingMailSummaryRequest = {
  hours: 24;
  unreadOnly: boolean;
  sender?: string;
  topic?: string;
};
export type RollingMailRow = {
  id: string;
  account_email: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  received_at: string | Date | null;
  snippet: string | null;
  text_body: string | null;
  total_count: number | string;
};

export const MAX_REPORT_MESSAGES = 500;

export function parseRollingMailSummaryRequest(input: string): RollingMailSummaryRequest | null {
  const message = input.trim();
  const mentionsMail = /\b(?:email|emails|mail|mails|inbox|message|messages|mesaages)\b/i.test(message);
  const pastDay = /\b(?:last|past|previous|within)\s+(?:the\s+)?(?:24\s*(?:hours?|hrs?|h)|1\s*day|one\s+day)\b/i.test(message);
  const requestsReport = /\b(?:summar\w*|summery|summary|recap|review|list|show|check|find|count|all)\b|how many/i.test(message);
  if (!mentionsMail || !pastDay || !requestsReport) return null;

  const from = /\bfrom\s+(?!last\b|past\b|previous\b|the\s+(?:last|past|previous)\b)(.+?)(?=\s+(?:during|within|over|in|for|last|past|previous)\b|[,!?]|$)/i.exec(message)?.[1]?.trim().replace(/\.$/, "");
  const subject = /\b(?:about|regarding|with\s+subject|subject\s+(?:contains|is))\s+(.+?)(?=\s+(?:during|within|over|in|for|last|past|previous)\b|[,.!?]|$)/i.exec(message)?.[1]?.trim();
  // Do not downgrade complex requests to an unfiltered broad report.
  const hasUnsupportedFilter = /\b(?:excluding|except|without|only from|labelled|tagged|folder|before|after|between)\b/i.test(message);
  if (hasUnsupportedFilter) return null;
  // If the user supplied an explicit filter but it could not be parsed,
  // never return all messages while pretending the filter was applied.
  if (/\bfrom\s+(?!last\b|past\b|previous\b|the\s+(?:last|past|previous)\b)/i.test(message) && !from) return null;
  return {
    hours: 24,
    unreadOnly: /\bunread(?:ed)?\b|\bnot\s+read\b/i.test(message),
    ...(from ? { sender: from.slice(0, 120) } : {}),
    ...(subject ? { topic: subject.slice(0, 120) } : {}),
  };
}

function shortText(input: string | null | undefined, max = 360): string {
  if (!input) return "";
  const normalized = input.replace(/[\p{C}\s]+/gu, " ").trim();
  return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
}

export function formatRollingMailSummary(
  rows: RollingMailRow[],
  scope: RollingMailSummaryRequest,
  fromUtc: string,
  toUtc: string,
): string {
  const total = rows.length ? Number(rows[0]!.total_count) : 0;
  const included = rows.length;
  const complete = included === total && total <= MAX_REPORT_MESSAGES;
  const kind = scope.unreadOnly ? "unread received messages" : "received messages";
  const filters = [
    scope.sender ? `sender containing "${scope.sender}"` : null,
    scope.topic ? `subject or content containing "${scope.topic}"` : null,
  ].filter(Boolean).join("; ");
  const parts = [
    `Locally synchronized ${kind} in the rolling 24-hour UTC window ${fromUtc} to ${toUtc}.`,
    `Matched: ${total}. Included: ${included} of ${total}.`,
    filters ? `Applied filters: ${filters}.` : "No sender or subject filter was requested.",
    complete
      ? "Coverage: all matching messages currently stored for mailboxes this agent is authorized to read."
      : `Coverage: partial (safety limit ${MAX_REPORT_MESSAGES}); ${Math.max(0, total - included)} matching messages not included. Do not describe this as all messages.`,
    "This report uses local sync data; it does not prove your email provider has no newer or unsynchronized messages.",
  ];
  if (!included) return parts.join("\n");
  parts.push("", "Message-by-message overview (every included message is listed):");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const at = row.received_at instanceof Date ? row.received_at.toISOString()
      : row.received_at ? new Date(row.received_at).toISOString() : "unknown";
    const subject = shortText(row.subject, 180) || "(No subject)";
    const from = shortText(row.from_name || row.from_email, 160) || "(Unknown sender)";
    const preview = shortText(row.text_body || row.snippet, 450) || "(No message preview synchronized)";
    parts.push(`${i + 1}. ${subject} | From: ${from} | Mailbox: ${shortText(row.account_email, 160)} | Received (UTC): ${at}\n   Available content: ${preview}`);
  }
  return parts.join("\n");
}
