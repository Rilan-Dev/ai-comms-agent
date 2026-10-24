import { containsUnverifiedOperationClaim, currentTurnOperationAnswer } from './operation-feedback';
/**
 * Presentation hygiene for untrusted model text. The host must collect a
 * complete response before displaying or persisting it. This is not a claim
 * that the response is accurate or authorized to mutate external resources.
 */
export function isInternalChatPlanning(text: string): boolean {
  return /<\/?think(?:ing)?\b[^>]*>/i.test(text)
    || /\bNo new emails were provided by the user in this turn\b/i.test(text)
    || /\bMy instructions say\b/i.test(text)
    || /\bI should not hallucinate\b/i.test(text)
    || /\bLet's identify them correctly from context\b/i.test(text)
    || /\bWe need to inspect the system prompt\b/i.test(text)
    || /\bI should respond appropriately\b/i.test(text)
    || /\bI need to make sure I don't include other emails\b/i.test(text);
}

export function userFacingChatAnswer(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 40000 || !raw.trim()) return null;
  if (isInternalChatPlanning(raw)) return null;
  return containsUnverifiedOperationClaim(raw) ? currentTurnOperationAnswer(raw, [], '', false) : raw.trim();
}
