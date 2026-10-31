import { containsUnverifiedOperationClaim, currentTurnOperationAnswer } from './operation-feedback';
import {isInternalChatPlanning} from './internal-planning';
export {isInternalChatPlanning} from './internal-planning';
/**
 * Presentation hygiene for untrusted model text. The host must collect a
 * complete response before displaying or persisting it. This is not a claim
 * that the response is accurate or authorized to mutate external resources.
 */
export function userFacingChatAnswer(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 40000 || !raw.trim()) return null;
  if (isInternalChatPlanning(raw)) return null;
  return containsUnverifiedOperationClaim(raw) ? currentTurnOperationAnswer(raw, [], '', false) : raw.trim();
}
