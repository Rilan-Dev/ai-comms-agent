/**
 * Fast path for the most common business questions about unread mail.
 *
 * "Summarize my unread emails" and "How many unread emails do I have?"
 * previously took the model tool loop (observed 5-24s in production):
 * discovery call, message listing, then generation. A busy user expects
 * these counting/reporting questions to be answered from the locally
 * synchronized database almost instantly, exactly like the rolling 24-hour
 * report in rolling-summary.ts.
 *
 * This parser keeps the same conservative contract as its siblings:
 * it ONLY accepts a pure unread report or count request. Any additional
 * analysis ask (business highlights, important/urgent filtering, sender or
 * subject constraints, time windows, labels, attachments, WhatsApp mixing)
 * returns null so the request continues through the normal authorized tool
 * path — a fast answer must never silently drop a constraint the user
 * actually asked for.
 */

import { formatRollingMailSummary, type RollingMailRow } from "./rolling-summary";

export type UnreadOnlyMailRequest = {
  /** "count" answers a how-many question; "summary" lists the unread mail. */
  kind: "count" | "summary";
  unreadOnly: true;
  /** Never set on this fast path; keeps the route's scope union readable. */
  sender?: undefined;
  topic?: undefined;
};

/** Lower bound for the no-window unread report (all locally synced mail). */
export const UNREAD_REPORT_FROM_UTC = "2000-01-01T00:00:00.000Z";

const MENTIONS_MAIL = /\b(?:e-?mails?|mails?|inbox|mailbox|messages?)\b/i;
const MENTIONS_UNREAD = /\b(?:unread(?:ed)?|not\s+read|new\s+(?:e-?mails?|mails?|messages?|inbox))\b|\bwhat(?:'s| is)\s+new\b/i;
const REPORT_VERB = /\b(?:summari[sz]e|summery|summary|recap|report|review|list|show|check|find|see|go\s+through)\b|\bhow\s+many\b|\bcount\b|\bnumber\s+of\b|\bwhat(?:'s| is)\s+new\b/i;
const COUNT_QUESTION = /\bhow\s+many\b|\bcount\b|\bnumber\s+of\b/i;

/**
 * Anything that narrows, analyzes, or mixes the request disqualifies the
 * fast path: the deterministic report cannot honor these constraints.
 * A named mailbox/address is a scope the report must not silently drop.
 */
const UNSUPPORTED =
  /[\w.%+-]+@[\w.-]+\.[a-z]{2,}|\b(?:business|important|urgent|priority|highlight|high\s+light|critical|action\s+required|needs?\s+my\s+attention|attention|from|sender|subject|about|regarding|concerning|label(?:l?ed)?|folder|starred|flagged|attachment|has\s+attachment|account|gmail|outlook|hotmail|yahoo|zoho|imap|smtp|today|yesterday|tomorrow|this\s+(?:morning|afternoon|evening|week|month)|last|past|previous|next|since|between|before|after|24\s*(?:hours?|hrs?|h)|\d+\s*(?:hours?|days?|weeks?|months?)|whats\s?app|whatsapp|call|meeting|invoice|order|customer|client|draft|reply|send|archive|trash|delete|mark|move|filter|sort|group|top|biggest|oldest|newest|first|latest|due|deadline|follow\s?up|summarize\s+each|detail)\b/i;

/** Very long prompts usually carry hidden constraints; stay conservative. */
const MAX_FAST_PATH_LENGTH = 120;

export function parseUnreadOnlyMailRequest(input: string): UnreadOnlyMailRequest | null {
  const message = (input ?? "").trim().toLowerCase();
  if (!message || message.length > MAX_FAST_PATH_LENGTH) return null;
  if (!MENTIONS_MAIL.test(message) || !MENTIONS_UNREAD.test(message) || !REPORT_VERB.test(message)) return null;
  if (UNSUPPORTED.test(message)) return null;
  return { kind: COUNT_QUESTION.test(message) ? "count" : "summary", unreadOnly: true };
}

export type MailboxUnreadCount = {
  account_email: string;
  unread_count: number;
};

function shortText(input: string | null | undefined, max = 360): string {
  if (!input) return "";
  const normalized = input.replace(/[\p{C}\s]+/gu, " ").trim();
  return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
}

/**
 * Compact count-first report for "how many unread" questions: per-mailbox
 * totals plus the newest unread messages so the number is immediately
 * actionable, with the same honest local-sync caveats as the rolling report.
 */
export function formatUnreadMailCountReport(
  counts: MailboxUnreadCount[],
  rows: RollingMailRow[],
): string {
  const totalUnread = counts.reduce((sum, row) => sum + Number(row.unread_count), 0);
  const parts = [
    `Unread email count from locally synchronized data: ${totalUnread} unread across ${counts.length} connected mailbox${counts.length === 1 ? "" : "es"}.`,
  ];
  if (counts.length > 0) {
    parts.push("Per mailbox:");
    for (const row of counts) {
      parts.push(`- ${shortText(row.account_email, 160) || "(unknown mailbox)"}: ${Number(row.unread_count)} unread`);
    }
  }
  const newest = rows.slice(0, 5);
  if (newest.length > 0) {
    parts.push("", "Newest unread messages:");
    for (let i = 0; i < newest.length; i++) {
      const row = newest[i]!;
      const at = row.received_at instanceof Date ? row.received_at.toISOString()
        : row.received_at ? new Date(row.received_at).toISOString() : "unknown";
      parts.push(`${i + 1}. ${shortText(row.subject, 180) || "(No subject)"} | From: ${shortText(row.from_name || row.from_email, 160) || "(Unknown sender)"} | Mailbox: ${shortText(row.account_email, 160)} | Received (UTC): ${at}`);
    }
    if (totalUnread > newest.length) {
      parts.push(`…and ${totalUnread - newest.length} more unread messages (ask for a full unread summary to list up to 500).`);
    }
  } else if (totalUnread === 0) {
    parts.push("", "You have no unread emails in the locally synchronized mail store.");
  }
  parts.push(
    "",
    "This report uses local sync data; it does not prove your email provider has no newer or unsynchronized messages.",
  );
  return parts.join("\n");
}

/**
 * Full unread listing (reuses the rolling report renderer so coverage and
 * untrusted-data language stay consistent across fast paths).
 */
export function formatUnreadMailSummary(rows: RollingMailRow[]): string {
  return formatRollingMailSummary(
    rows,
    { unreadOnly: true, sender: undefined, topic: undefined },
    UNREAD_REPORT_FROM_UTC,
    new Date().toISOString(),
    "full locally synchronized history (no time window)",
  );
}
