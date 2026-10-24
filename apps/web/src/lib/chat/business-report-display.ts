/**
 * Presentation-only recognition of host-produced locally synced mail reports.
 * Never performs an action or asks the model to infer missing email facts.
 * Unrecognized/incomplete reports fall back to the raw Markdown view.
 */
export type BusinessMailItem = {
  subject: string;
  sender: string;
  mailbox: string;
  receivedUtc: string;
  excerpt: string;
  source: string | null;
  attention: boolean;
};
export type BusinessMailReport = {
  kind: "messages" | "unread-count";
  matched: number;
  included: number;
  period: string;
  lastSyncUtc: string | null;
  notice: string;
  coverage: string;
  moreCount: number;
  mailboxes: Array<{ email: string; unread: number }>;
  messages: BusinessMailItem[];
};

const MAX_REPORT_LENGTH = 400000;
const SUBJECT_FLAG = /^\s*(?:action (?:needed|required)|urgent|critical|security alert|payment overdue|response required|account suspended)\b/i;
const THREAD_LINK = /\[Open source thread\]\((?:https:\/\/aca\.starcitytechnical\.com)?(\/mail\/thread\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/i;
const HEADER = /^(?:\d+\.\s+)?(.+?)\s+\|\s+From:\s*(.*?)\s+\|\s+Mailbox:\s*(.*?)\s+\|\s+Received \(UTC\):\s*(.*?)\s*$/;

function displayText(value: string): string {
  return value.replace(/\\([@*_\[\]<>])/g, "$1").trim();
}

/** Only http(s) and safe, site-relative paths may become links in model text. */
export function safeChatLink(value: string): string | null {
  if (!value || /[\u0000-\u0020\u007f"'<>\\]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//") && /^\/[a-z0-9/_%#.?=&+-]*$/i.test(value)) return value;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname ? value : null;
  } catch { return null; }
}

/** Plain text export changes formatting only, retaining text and source URLs. */
export function cleanAnswerForText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/\x60([^\x60]+)\x60/g, "$1")
    .replace(/\\([@*_\[\]<>])/g, "$1");
}

export function parseBusinessMailReport(raw: string): BusinessMailReport | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_REPORT_LENGTH) return null;
  const source = raw.replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const first = (lines.find(line => line.trim()) ?? "").trim();
  const countMatch = /^Unread email count from locally synchronized data: (\d+) unread across (\d+) connected mailbox(?:es)?\.$/.exec(first);
  const isMessageReport = /^Locally synchronized (?:unread )?received messages in the /.test(first);
  if (!countMatch && !isMessageReport) return null;
  const numbers = countMatch
    ? { matched: Number(countMatch[1]), included: 0 }
    : (() => {
        const match = lines.find(line => /^Matched: \d+\. Included: \d+ of \d+\.$/.test(line.trim()))
          ?.match(/^Matched: (\d+)\. Included: (\d+) of (\d+)\.$/);
        return match && match[1] === match[3]
          ? { matched: Number(match[1]), included: Number(match[2]) } : null;
      })();
  if (!numbers || !Number.isSafeInteger(numbers.matched) || numbers.matched < 0
      || numbers.matched > 1000000 || numbers.included > numbers.matched) return null;

  const records: BusinessMailItem[] = [];
  let current: BusinessMailItem | null = null;
  const mailboxes: BusinessMailReport["mailboxes"] = [];
  let section = "";
  let moreCount = 0;
  let coverage = "";
  let notice = "";
  let lastSyncUtc: string | null = null;
  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (/^Per mailbox:$/.test(trimmed)) { section = "mailboxes"; continue; }
    if (/^Newest unread messages:$/.test(trimmed)) { section = "messages"; continue; }
    if (/^Message-by-message overview/.test(trimmed)) { section = "messages"; continue; }
    if (/^Coverage: /.test(trimmed)) coverage = trimmed;
    if (/^This report uses local sync data;/.test(trimmed)) notice = trimmed;
    const sync = /Oldest mailbox sync:\s*(\d{4}-\d\d-\d\dT[\d:.]+Z)\./.exec(trimmed);
    if (sync) lastSyncUtc = sync[1] ?? null;
    const extra = trimmed.match(/^…and (\d+) more unread messages/);
    if (extra) moreCount = Number(extra[1]);
    if (section === "mailboxes") {
      const mailbox = /^-\s+(.+?):\s+(\d+) unread$/.exec(trimmed);
      if (mailbox) { mailboxes.push({ email: displayText(mailbox[1] ?? ""), unread: Number(mailbox[2]) }); continue; }
    }
    if (section !== "messages") continue;
    const header = HEADER.exec(trimmed);
    if (header) {
      current = {
        subject: displayText(header[1] ?? "(No subject)"),
        sender: displayText(header[2] ?? "(Unknown sender)"),
        mailbox: displayText(header[3] ?? ""),
        receivedUtc: (header[4] ?? "").trim(),
        excerpt: "",
        source: null,
        attention: SUBJECT_FLAG.test(displayText(header[1] ?? "")),
      };
      records.push(current);
      if (records.length > 500) return null;
      continue;
    }
    if (current && /^Available content \(.*?\):\s*/.test(trimmed)) {
      const text = trimmed.replace(/^Available content \(.*?\):\s*/, "");
      const link = text.match(THREAD_LINK)?.[1] ?? null;
      current.source = link && safeChatLink(link) ? link : null;
      current.excerpt = displayText(text.replace(THREAD_LINK, "").trim());
      continue;
    }
    // The host formats its citation on a separate, indented next line.
    // Recognize only our same-origin, UUID-bounded mail/thread paths.
    if (current && trimmed.startsWith("[Open source thread](")) {
      const link = trimmed.match(THREAD_LINK)?.[1] ?? null;
      if (link && safeChatLink(link)) current.source = link;
    }
  }
  if (isMessageReport && records.length !== numbers.included) return null;
  if (countMatch && mailboxes.length !== Number(countMatch[2])) return null;
  return {
    kind: countMatch ? "unread-count" : "messages",
    matched: numbers.matched,
    included: countMatch ? records.length : numbers.included,
    period: countMatch ? "All locally synchronized unread mail"
      : first.includes("full locally synchronized history (no time window)")
        ? "Full locally synchronized history (no time cutoff), through " +
          (first.match(/ to (\d{4}-\d\d-\d\dT[\d:.]+Z)\.$/)?.[1] ?? "the latest included UTC timestamp")
        : first.replace(/^Locally synchronized /, ""),
    lastSyncUtc,
    coverage: coverage || (countMatch ? "Only the newest messages are previewed." : ""),
    notice: notice || "This report uses local sync data; newer provider messages may not yet be synchronized.",
    moreCount,
    mailboxes,
    messages: records,
  };
}
