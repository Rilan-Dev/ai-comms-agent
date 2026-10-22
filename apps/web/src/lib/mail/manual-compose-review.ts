/**
 * Compare a human-reviewed mail composer snapshot with the persisted draft.
 * This is a review-consistency check, not an authorization or send decision.
 * The email actions route continues to enforce organization and permissions.
 */
export type ManualComposeSnapshot = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
};

function normalizeAddresses(value: unknown, required: boolean): string[] | null {
  if (!Array.isArray(value)) return required ? null : value == null ? [] : null;
  const addresses: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const address = item.trim().toLowerCase();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(address)) return null;
    addresses.push(address);
  }
  return required && addresses.length === 0 ? null : addresses;
}

export function normalizeManualComposeSnapshot(value: unknown): ManualComposeSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const to = normalizeAddresses(item.to, true);
  const cc = normalizeAddresses(item.cc, false);
  const bcc = normalizeAddresses(item.bcc, false);
  if (!to || !cc || !bcc || typeof item.subject !== "string" || !item.subject.trim()
      || typeof item.bodyText !== "string") return null;
  return { to, cc, bcc, subject: item.subject.trim(), bodyText: item.bodyText };
}

export function matchesManualComposeReview(persisted: unknown, reviewed: unknown): boolean {
  const left = normalizeManualComposeSnapshot(persisted);
  const right = normalizeManualComposeSnapshot(reviewed);
  return left !== null && right !== null
    && left.subject === right.subject
    && left.bodyText === right.bodyText
    && (["to", "cc", "bcc"] as const).every(key =>
      left[key].length === right[key].length
      && left[key].every((value, index) => value === right[key][index]));
}
