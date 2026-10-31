export const AI_TODAY_DAYS = [1, 5, 7, 30] as const;
export type AiTodayDays = typeof AI_TODAY_DAYS[number];

export function parseAiTodayDays(raw: string | null): AiTodayDays {
  if (raw === null) return 5;
  if (!["1", "5", "7", "30"].includes(raw)) throw new Error("Unsupported AI Today lookback");
  return Number(raw) as AiTodayDays;
}

export function buildAiTodayWindow(days: AiTodayDays, now: Date): {from: string; to: string} {
  if (!AI_TODAY_DAYS.includes(days) || !Number.isFinite(now.getTime())) throw new Error("Invalid AI Today window");
  return {from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString()};
}

export type AiTodaySourceRow = {
  id: string; thread_id: string; email_account_id: string; account_email: string;
  from_address: string | null; subject: string | null; snippet: string | null;
  received_at: Date | string | null; is_read: boolean; action_required: boolean;
  is_starred: boolean; importance_score: number | string | null; action_deadline: Date | string | null;
};
export type AiTodaySource = {
  messageId: string; threadId: string; mailboxId: string; accountEmail: string;
  sender: string; subject: string; snippet: string; receivedAt: string | null;
  isRead: boolean; actionRequired: boolean; isStarred: boolean;
  priority: "action_required" | "starred" | "important" | "unread";
  actionDeadline: string | null;
};
export type AiTodaySchedule = {
  id: string; name: string; status: string; lastFireAt: string | null; nextFireAt: string | null;
};
export type AiTodaySnapshot = {
  windowDays: AiTodayDays; asOf: string; connectedMailboxes: number; lastSyncAt: string | null;
  totalMatches: number; items: AiTodaySource[];
  pendingEmailApprovals: number | null; pendingWhatsAppApprovals: number | null;
  schedules: AiTodaySchedule[];
};

const sourceText = (value: unknown, length: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, length) : "";
export const aiTodayTimestamp = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export function projectAiTodaySource(row: AiTodaySourceRow): AiTodaySource {
  const importance = Number(row.importance_score);
  const priority: AiTodaySource["priority"] =
    row.action_required ? "action_required" : row.is_starred ? "starred" :
    row.importance_score != null && Number.isFinite(importance) && ((importance >= 0.7 && importance <= 1) || importance >= 70) ? "important" : "unread";
  return {
    messageId: row.id, threadId: row.thread_id, mailboxId: row.email_account_id,
    accountEmail: sourceText(row.account_email, 180),
    sender: sourceText(row.from_address, 180) || "Unknown sender",
    subject: sourceText(row.subject, 250) || "Untitled message",
    snippet: sourceText(row.snippet, 350),
    receivedAt: aiTodayTimestamp(row.received_at),
    isRead: Boolean(row.is_read), actionRequired: Boolean(row.action_required),
    isStarred: Boolean(row.is_starred), priority, actionDeadline: aiTodayTimestamp(row.action_deadline),
  };
}


/** Only the opaque source ID crosses into Chat; never leak subject, sender or
 * snippet into browser history, URL logs or an unbound agent context. */
export function aiTodayChatHref(messageId: string): string {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(messageId)) return "/chat";
  const prompt = "Review email message ID " + messageId +
    " using only the mail sources I have permission to access. Help prepare a reply draft for my review. " +
    "Do not send any message. If the source is unavailable, say so rather than inventing its contents.";
  return "/chat?" + new URLSearchParams({prompt,run:"1"});
}
