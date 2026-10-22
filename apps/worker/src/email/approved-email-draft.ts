import type { DraftParams } from "@ai-comms-agent/shared";

/**
 * The saved email-action snapshot, not a mutable local/provider draft, is the
 * content that a human authorized. Never trust current draft fields or a
 * previously synchronized provider_draft_id to reconstruct the send.
 */
export function paramsFromApprovedEmailSnapshot(snapshot: Record<string, unknown>): DraftParams {
  function recipients(value: unknown, required: boolean): string[] {
    if (value == null && !required) return [];
    if (!Array.isArray(value)) throw new Error("Approved email approval snapshot has invalid recipients");
    const addresses = value.map((address) => {
      if (typeof address !== "string") throw new Error("Approved email approval snapshot has invalid recipients");
      const normalized = address.trim();
      if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(normalized)) {
        throw new Error("Approved email approval snapshot has invalid recipients");
      }
      return normalized;
    });
    if (required && addresses.length === 0) throw new Error("Approved email approval snapshot has no recipients");
    return addresses;
  }

  const subject = snapshot.subject;
  const bodyText = snapshot.bodyText;
  if (typeof subject !== "string" || !subject.trim() || typeof bodyText !== "string") {
    throw new Error("Approved email approval snapshot lacks the reviewed subject or body");
  }
  return {
    to: recipients(snapshot.to, true),
    cc: recipients(snapshot.cc, false),
    bcc: recipients(snapshot.bcc, false),
    subject,
    body_text: bodyText,
  };
}
