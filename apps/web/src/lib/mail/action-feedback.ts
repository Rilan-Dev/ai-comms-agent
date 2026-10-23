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
  const command = prompt.match(
    /^(?:(?:please|kindly)\s+)?(?:(?:(?:can|could|would|will)\s+you\s+(?:(?:please|kindly)\s+)?)|(?:i\s+(?:(?:need|want)\s+(?:you\s+to|to)|would\s+like\s+(?:you\s+to|to))\s+)|(?:i['’]d\s+like\s+(?:you\s+to|to)\s+))?(send|draft|write|compose|forward|reply\s+to|respond\s+to|email|e-mail|request\s+(?:send|email)\s+approval)\b/i,
  );
  if (!command) return false;
  const verb = command[1]?.toLowerCase() ?? "";
  const addressedRecipient = /\bto\s+[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(prompt);
  const emailContext = /\b(?:e-?mails?|messages?|drafts?|repl(?:y|ies))\b/i.test(prompt)
    || addressedRecipient || verb === "email" || verb === "e-mail";
  if (!emailContext) return false;

  if (verb === "send") {
    // "Send me the emails from yesterday" is often a request to *read* or
    // list mail. Unlike a command with an explicit outgoing recipient, it
    // must not be mistaken for permission to create an outbound message.
    if (!addressedRecipient &&
        /\bsend\s+me\s+(?:(?:the|all|those|these|my)\s+)?(?:e-?mails?|messages?)\b/i.test(prompt)) {
      return false;
    }
    const directEmail = /\bsend\s+(?:(?:me|a|an|the|this|that|these|those|test|new|another|some|several)\s+){0,4}(?:e-?mails?|messages?)\b/i.test(prompt);
    return directEmail || addressedRecipient;
  }
  return true;
}

export function deniedEmailWriteExplanation(
  text: string,
  permissions: ReadonlySet<string>,
): string | null {
  if (permissions.has("email.write") || !isExplicitEmailMutationRequest(text)) return null;
  return "Security check (not an AI-generated send confirmation): Your current organization membership does not grant email.write, so this request cannot save a draft or request sending. No draft or send-approval request was created. No email was sent. Open Compose email in Chat to see your actual user and agent permissions. An authorized administrator must correct your workspace role or grant through the approved access process; selecting agent tools does not grant user access. After authorization, explicitly choose From, enter To, review the message, Save email draft, and Request send approval. A human must approve before worker delivery.";
}

/** An explicit email command needs a verified mutation tool result. A model
 * completion (including a tool-free answer or read-only search) cannot prove
 * that anything was drafted, approved or sent. */
export function unverifiedEmailActionExplanation(): string {
  return "Security check (not an AI-generated send confirmation): No email draft or send-approval request was confirmed by an authorized email tool. No email was sent by this request. Repeating this same command cannot confirm delivery. Choose Write email draft below (or Compose email above), select the connected From mailbox and the exact To address, review the message, then Save email draft. Only after a saved draft is confirmed should you Request send approval. If Save is disabled, check the displayed user email.write grant, saved agent tools and mailbox provider capabilities. Delivery still requires separate human approval and a working provider/worker.";
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
  // Match ALL registered email mutation tool names. Two naming conventions
  // coexist in the registry:
  //   - dot-separated: email.draft.create, email.draft.update,
  //     email.send.request, email.reply.request, email.forward.request
  //   - underscore-separated: email.draft_reply, email.draft_forward
  // The old regex `^email\.(?:draft\.|send\.|reply\.|forward\.)` only matched
  // the dot form, so a successful email.draft_reply / email.draft_forward
  // tool call was treated as "no verified mutation" and the chat surfaced
  // the unverifiedEmailActionExplanation() denial message even though the
  // draft was actually saved. This updated regex accepts either separator
  // after the leading verb (draft|send|reply|forward).
  const mutations = calls.filter(call => !call.readOnly
    && /^email\.(?:draft|send|reply|forward)[._]/.test(call.name));
  if (mutations.length === 0) return "";
  const outcomes = mutations.map(call => {
    if (!call.ok) {
      // Codes come from the audited host executor, never from model text.
      // Only known, safe codes are reflected to a chat/voice user.
      switch (call.errorCode) {
        case "permission_denied":
          return "Email tool denied (permission_denied). Ask an organization administrator to review your email.write permission; agent tool settings cannot grant it.";
        case "tool_not_allowed":
          return "Email tool denied (tool_not_allowed). Ask an administrator to review and save the agent's saved email tool policy.";
        case "account_not_available":
          return "Email tool denied (account_not_available). Bind a connected primary mailbox to the agent and check its account status.";
        case "capability_not_supported":
          return "Email tool denied (capability_not_supported). Check the mailbox provider capabilities for drafting and sending.";
        case "approval_required":
          return "Email tool denied (approval_required). Use the human approval workflow to request sending, rather than attempting direct delivery.";
        default:
          return "Email tool denied. Review the saved agent permissions and mailbox configuration before retrying.";
      }
    }
    if (["draft_created", "draft_updated", "reply_draft_created", "forward_draft_created"].includes(call.status ?? "")) {
      return "Email draft saved. Review the draft and explicitly request send approval if you want it delivered";
    }
    if (call.status === "pending_approval") {
      return "Send approval request pending human review. Open Mail > Approvals to review the request";
    }
    return "Email tool returned success without a confirmed draft or approval status";
  });
  return `Verified email tool results: ${outcomes.join("; ")}. No email was sent by these actions; sending requires explicit human approval.`;
}
