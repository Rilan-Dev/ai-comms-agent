/**
 * Host-owned messaging for explicit email mutation requests. These messages
 * report verified authorization and tool outcomes, not model predictions.
 * This module never grants a permission or executes a provider operation.
 */
/**
 * Distinguish a command to mutate email from a request to read mail or learn
 * how sending works. This classifier is for safe host feedback only, never
 * permission or provider-operation authorization.
 */
export function isExplicitEmailMutationRequest(text: string): boolean {
  const prompt = text.trim();
  const command = prompt.match(/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would|will)\s+you\s+|i\s+(?:(?:need|want)\s+you\s+to|would\s+like\s+you\s+to)\s+)?(send|draft|write|compose|forward|reply\s+to|request\s+(?:send|email)\s+approval)\b/i);
  if (!command || !/\b(?:e-?mail|message|draft|reply)\b/i.test(prompt)) return false;
  if (command[1]?.toLowerCase() === "send"
    && !/\bsend\s+(?:(?:me|a|an|the|this|that|test|new|another)\s+){0,4}(?:e-?mail|message)\b/i.test(prompt)) return false;
  return true;
}

export function deniedEmailWriteExplanation(
  text: string,
  permissions: ReadonlySet<string>,
): string | null {
  if (permissions.has("email.write") || !isExplicitEmailMutationRequest(text)) return null;
  return "I cannot create an email draft or request send approval because your signed-in organization role lacks email.write. The agent's saved tool choices and assigned mailboxes do not grant that user permission. No draft or send-approval request was created. No email was sent. An authorized administrator must arrange a separately approved role-permission change before you retry. Even with that access, sending requires explicit human approval.";
}

/** An explicit email command needs a verified mutation tool result. A model
 * completion (including a tool-free answer or read-only search) cannot prove
 * that anything was drafted, approved or sent. */
export function unverifiedEmailActionExplanation(): string {
  return "No email draft or send-approval request was confirmed by an authorized email tool. No email was sent. Please check this agent's saved email tools, assigned primary mailbox, provider capabilities, and your organization's email.write permission, then retry. Actual sending remains subject to explicit human approval.";
}

type VerifiedEmailToolCall = Readonly<{
  name: string;
  ok: boolean;
  readOnly?: boolean;
  status?: string;
  errorCode?: string;
}>;

/** Provide the authoritative host outcome for email mutations instead of
 * trusting a model's unverified delivery claims. No send is performed here. */
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
    if (["draft_created", "draft_updated", "reply_draft_created", "forward_draft_created"].includes(call.status ?? "")) return "Email draft saved";
    if (call.status === "pending_approval") return "Send approval request pending human review";
    return "Email tool returned success without a confirmed send or approval status";
  });
  return `Verified email tool results: ${outcomes.join("; ")}. No email was sent by these actions; sending requires explicit human approval.`;
}
