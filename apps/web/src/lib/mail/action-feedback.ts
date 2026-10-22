/**
 * Host-owned messaging for explicit email mutation requests. These messages
 * report verified authorization and tool outcomes, not model predictions.
 * This module never grants a permission or executes a provider operation.
 */
export function deniedEmailWriteExplanation(
  text: string,
  permissions: ReadonlySet<string>,
): string | null {
  if (permissions.has("email.write")) return null;
  if (!/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would)\s+you\s+)?(?:send|draft|write|compose|forward|reply\s+to|request\s+(?:send|email)\s+approval)\b/i.test(text.trim())) return null;
  if (!/\b(?:e-?mail|message|draft|reply)\b/i.test(text)) return null;
  return "I cannot create an email draft or request send approval because your signed-in organization role lacks email.write. The agent's saved tool choices and assigned mailboxes do not grant that user permission. No draft or send-approval request was created. No email was sent. An authorized administrator must arrange a separately approved role-permission change before you retry. Even with that access, sending requires explicit human approval.";
}

type VerifiedEmailToolCall = Readonly<{
  name: string;
  ok: boolean;
  readOnly?: boolean;
  status?: string;
  errorCode?: string;
}>;

/** Append a host-verified outcome to the model's summary of email mutations.
 * The only possible send operation is a request for human approval. */
export function verifiedEmailToolSummary(calls: readonly VerifiedEmailToolCall[]): string {
  const mutations = calls.filter(call => !call.readOnly
    && /^email\.(?:draft\.|send\.|reply\.|forward\.)/.test(call.name));
  if (mutations.length === 0) return "";
  const outcomes = mutations.map(call => {
    if (!call.ok) {
      const code = typeof call.errorCode === "string" && /^[a-z_]{1,80}$/.test(call.errorCode)
        ? ` (${call.errorCode})` : "";
      return `Email tool denied${code}`;
    }
    if (call.status === "draft_created" || call.status === "draft_updated") return "Email draft saved";
    if (call.status === "pending_approval") return "Send approval request pending human review";
    return "Email tool returned success without a confirmed send or approval status";
  });
  return `Verified email tool results: ${outcomes.join("; ")}. No email was sent by these actions; sending requires explicit human approval.`;
}
