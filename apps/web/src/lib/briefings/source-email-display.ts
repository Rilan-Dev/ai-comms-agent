/**
 * Human-readable labels for authorized, canonical Catch-up source email links.
 * These labels describe stored email headers; they are NOT AI-generated
 * priorities, proof of freshness, or evidence that a person was absent.
 */
type SourceHeader = { subject?: unknown; sender?: unknown; receivedAt?: unknown } | null;

function boundedHeader(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s{2,}/g, " ");
  return clean ? clean.slice(0, 160) : null;
}

export function describeBriefingSource(source: SourceHeader): {
  subject: string;
  sender: string;
  receivedAtIso: string | null;
  receivedLabel: string;
} {
  const subject = boundedHeader(source?.subject) ?? "Subject unavailable";
  const sender = boundedHeader(source?.sender) ?? "Sender unavailable";
  const rawDate = source?.receivedAt;
  const ms = typeof rawDate === "string" && rawDate.trim() ? Date.parse(rawDate) : NaN;
  if (!Number.isFinite(ms)) {
    return { subject, sender, receivedAtIso: null, receivedLabel: "Received time unavailable" };
  }
  const receivedAtIso = new Date(ms).toISOString();
  return {
    subject, sender, receivedAtIso,
    receivedLabel: receivedAtIso.slice(0, 16).replace("T", " ") + " UTC",
  };
}
