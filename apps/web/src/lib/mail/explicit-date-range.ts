/**
 * Bounded explicit calendar-date mail report parsing.
 *
 * The reported 24h production incident belongs to FIX-01. This independent
 * DEV-01 feature accepts *only* unambiguous ISO calendar dates, UTC. It
 * never broadens a malformed or filtered report into an "all inbox" claim.
 */
export type ExplicitMailDateRange = {
  kind: "valid";
  fromUtc: string;
  toUtc: string;
  firstDate: string;
  lastDate: string;
  unreadOnly: boolean;
  sender?: string;
  topic?: string;
};
export type InvalidExplicitMailDateRange = { kind: "invalid"; message: string };
export type ExplicitMailDateRangeParse = ExplicitMailDateRange | InvalidExplicitMailDateRange | null;
export const MAX_EXPLICIT_MAIL_DAYS = 366;

function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime() : null;
}

const INVALID_SCOPE = "Use two valid dates as YYYY-MM-DD to YYYY-MM-DD (UTC), within 366 days. Only optional unread, exact sender-email and subject/topic filters are supported; unsupported filters are not ignored.";

export function parseExplicitMailDateRangeRequest(input: string): ExplicitMailDateRangeParse {
  const text = input.trim().slice(0, 1000);
  if (!/\b(?:mail|mails|email|emails|inbox|message|messages)\b/i.test(text) ||
      !/\b(?:summari[sz]\w*|summery|summary|recap|report|review|list|show|count|find|check)\b|how many/i.test(text) ||
      !/\d{4}-\d{2}-\d{2}/.test(text)) return null;

  const pair = /\b(?:between\s+|from\s+)?(\d{4}-\d{2}-\d{2})\s+(?:to|through|until|and)\s+(\d{4}-\d{2}-\d{2})\b/i.exec(text);
  if (!pair) return { kind: "invalid", message: INVALID_SCOPE };
  const from = utcDay(pair[1]!);
  const until = utcDay(pair[2]!);
  if (from === null || until === null || until < from ||
      (until - from) / 86400000 + 1 > MAX_EXPLICIT_MAIL_DAYS) {
    return { kind: "invalid", message: INVALID_SCOPE };
  }
  // Reject a second date, relative window, or unsupported predicate before
  // querying; never silently report unrelated messages.
  const remaining = text.replace(pair[0], " ").replace(/[?!,;]/g, " ").replace(/\.(?=\s|$)/g, " ");
  if (/\d{4}-\d{2}-\d{2}|\b(?:except|excluding|without|before|after|since|last|past|next|only\s+from|important|urgent|priority|starred|flagged|labelled|labeled|folder|attachment|has\s+attachment)\b/i.test(remaining)) {
    return { kind: "invalid", message: INVALID_SCOPE };
  }
  const senderMatch = /\bfrom\s+([\w.%+-]+@[\w.-]+\.[a-z]{2,})\b/i.exec(remaining);
  if (/\bfrom\b/i.test(remaining) && !senderMatch) {
    return { kind: "invalid", message: INVALID_SCOPE };
  }
  const topicMatch = /\b(?:about|regarding|subject\s+(?:contains|is))\s+([a-z0-9][\w\s-]{0,100})$/i.exec(remaining.trim());
  if (/\b(?:about|regarding|subject)\b/i.test(remaining) && !topicMatch) {
    return { kind: "invalid", message: INVALID_SCOPE };
  }
  const sender = senderMatch?.[1];
  const topic = topicMatch?.[1]?.trim();
  // Optional expressions must be unambiguous and known; catch unsupported
  // qualifiers such as "messages containing invoice" or "from Alice".
  let residual = remaining
    .replace(senderMatch?.[0] ?? "\u0000", " ")
    .replace(topicMatch?.[0] ?? "\u0000", " ")
    .replace(/\b(?:please|can|you|my|the|me|all|unread|received|incoming|mail|mails|emails?|inbox|messages?|summari[sz]\w*|summery|summary|recap|report|review|list|show|count|find|check|how|many|for|of|on|in|during|between|and|with|a|an)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (residual) return { kind: "invalid", message: INVALID_SCOPE };

  return {
    kind: "valid",
    firstDate: pair[1]!,
    lastDate: pair[2]!,
    fromUtc: new Date(from).toISOString(),
    // Exclusive upper bound includes every microsecond of the final date in PostgreSQL.\n    toUtc: new Date(until + 86400000).toISOString(),
    unreadOnly: /\bunread\b|\bnot\s+read\b/i.test(remaining),
    ...(sender ? { sender: sender.slice(0, 120) } : {}),
    ...(topic ? { topic } : {}),
  };
}
