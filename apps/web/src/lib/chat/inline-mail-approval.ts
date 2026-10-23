/**
 * Browser review accepts only an exact, still-pending saved email action
 * returned by the authenticated organization-scoped approval API. Never use
 * model text or client-supplied metadata as approval authority.
 */
export type ChatEmailApproval = {
  id: string;
  actionType: "send_email";
  status: "pending_approval";
  draftId: string;
  emailAccountId: string;
  expiresAt: string | null;
  recipientSnapshot: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    bodyText: string;
  };
};

const validAddress = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 320 &&
  /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);

function recipientList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100 || !value.every(validAddress)) return null;
  return [...value];
}

export function validateChatEmailApproval(
  source: unknown,
  expected: { actionId: string; draftId: string; accountId: string },
): ChatEmailApproval | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const action = source as Record<string, unknown>;
  if (!expected.actionId || !expected.draftId || !expected.accountId ||
      action.id !== expected.actionId || action.actionType !== "send_email" ||
      action.status !== "pending_approval" || action.draftId !== expected.draftId ||
      action.emailAccountId !== expected.accountId) return null;

  const expiresAt = action.expiresAt;
  if (expiresAt !== null && expiresAt !== undefined) {
    if (typeof expiresAt !== "string") return null;
    const expiration = Date.parse(expiresAt);
    if (!Number.isFinite(expiration) || expiration <= Date.now()) return null;
  }
  const raw = action.recipientSnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const snapshot = raw as Record<string, unknown>;
  const to = recipientList(snapshot.to);
  const cc = recipientList(snapshot.cc ?? []);
  const bcc = recipientList(snapshot.bcc ?? []);
  if (!to?.length || !cc || !bcc ||
      typeof snapshot.subject !== "string" || !snapshot.subject.trim() || snapshot.subject.length > 998 ||
      typeof snapshot.bodyText !== "string" || !snapshot.bodyText.trim() || snapshot.bodyText.length > 100000) return null;

  return {
    id: expected.actionId,
    actionType: "send_email",
    status: "pending_approval",
    draftId: expected.draftId,
    emailAccountId: expected.accountId,
    expiresAt: typeof expiresAt === "string" ? expiresAt : null,
    recipientSnapshot: { to, cc, bcc, subject: snapshot.subject, bodyText: snapshot.bodyText },
  };
}
