import {
  PostgresEmailAccountRepository,
  createEmailAction,
  EmailActionIdempotencyConflictError,
  createLocalDraft,
  getLocalDraftForOrganization,
  getMailMessageForOrganization,
  query,
  updateLocalDraftForOrganization,
} from "@ai-comms-agent/db";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { EMAIL_TOOL_CATALOG } from "@ai-comms-agent/shared";
import { canUseEmailAccountBinding, hasEmailToolCapabilities } from "./email-tool-policy";
import { preserveEmailBody } from "./email-body";
import { normalizeEmailRecipients } from "./email-recipients";
import { resolveAccountIdentifier } from "./account-identifier";

type Input = Record<string, unknown>;
type Row = Record<string, unknown>;

class EmailWriteFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

function object(value: unknown): Input {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Input : {};
}
function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
/** A draft's To must be explicit, not inferred from an email contact name.
 * Ask the user to choose the full recipient address before writing anything. */
function requireRecipients(value: unknown): string[] {
  const recipients = normalizeEmailRecipients(value, true);
  if (!recipients) throw new EmailWriteFailure("recipient_required",
    "Who should receive this email? Please choose or provide valid recipient email addresses before I create a draft or request approval.");
  return recipients;
}
/** Empty optional recipient fields are permitted; malformed provided lists
 * are not silently truncated, skipped, or persisted into a future send. */
function optionalRecipients(value: unknown): string[] {
  if (value == null) return [];
  const recipients = normalizeEmailRecipients(value, false);
  if (!recipients) throw new EmailWriteFailure("recipient_required",
    "CC and BCC must contain valid recipient email addresses.");
  return recipients;
}
function summary(toolName: string, output?: unknown): string {
  if (output && typeof output === "object" && "status" in output) {
    const record = output as Record<string, unknown>;
    return typeof record.status === "string" ? `${toolName}:${record.status}` : toolName;
  }
  return Array.isArray(output) ? `${toolName}:${output.length} result(s)` : toolName;
}
function result(toolName: string, startedAt: number, output?: unknown, error?: { code: string; message: string }): ToolResult {
  return {
    ok: !error,
    ...(output === undefined ? {} : { output }),
    ...(error ? { error: { ...error, retryable: false } } : {}),
    audit: {
      tool_name: toolName,
      input_summary: toolName,
      output_summary: error?.code ?? summary(toolName, output),
      duration_ms: Math.max(0, Date.now() - startedAt),
    },
  };
}

export interface EmailWriteToolDependencies {
  accounts?: PostgresEmailAccountRepository;
}

export function createEmailWriteTools(deps: EmailWriteToolDependencies = {}): Tool[] {
  const accounts = deps.accounts ?? new PostgresEmailAccountRepository();
  const descriptor = (name: string) => {
    const item = EMAIL_TOOL_CATALOG.find((entry) => entry.name === name);
    if (!item) throw new Error(`Missing email tool contract: ${name}`);
    return item;
  };

  async function resolveAccount(accountId: string, context: ToolContext, allowSendOnly = false) {
    if (!accountId) throw new EmailWriteFailure("invalid_account",
      "Which From email should I use? Select a connected mailbox assigned to this agent before I create a draft.");
    // Resolve email-address identifiers to the internal UUID BEFORE any
    // uuid-typed query, so the model echoing the user's mailbox address
    // (e.g. "user@gmail.com") works instead of failing with a cryptic
    // uuid syntax error surfaced as authorization_unavailable.
    const resolvedAccountId = await resolveAccountIdentifier(context.organization_id, context.agent_id, accountId);
    if (!resolvedAccountId) throw new EmailWriteFailure("account_not_available",
      "No mailbox matching that identifier is bound to this agent. Available mailboxes are returned by email.accounts.list.");
    const binding = await query<{ role: string }>(
      `SELECT b.role FROM agent_email_accounts b
       JOIN agents g ON g.id=b.agent_id
       JOIN email_accounts a ON a.id=b.email_account_id
       WHERE g.id=$1 AND g.organization_id=$2 AND a.id=$3
         AND a.organization_id=$2 AND a.deleted_at IS NULL
       LIMIT 1`,
      [context.agent_id, context.organization_id, resolvedAccountId],
    );
    const role = binding.rows[0]?.role;
    if (!canUseEmailAccountBinding(role, "email.write") || !(allowSendOnly || role === "primary")) {
      throw new EmailWriteFailure("account_not_available", "This mailbox is not available for the requested operation.");
    }
    const account = await accounts.getForAgent(context.organization_id, context.agent_id, resolvedAccountId);
    if (!account || account.status !== "connected") throw new EmailWriteFailure("account_not_connected", "This mailbox is not connected or is not bound to this agent.");
    return account;
  }

  async function checkMessage(accountId: string, messageId: string, context: ToolContext): Promise<Row> {
    const message = await getMailMessageForOrganization(context.organization_id, messageId);
    if (!message || String(message.email_account_id) !== accountId) {
      throw new EmailWriteFailure("message_not_found", "The message was not found in the selected mailbox.");
    }
    return message;
  }

  function makeTool(name: string, handler: (input: Input, context: ToolContext) => Promise<unknown>): Tool {
    const item = descriptor(name);
    return {
      name: item.name,
      domain: "email",
      description: item.description,
      input_schema: item.input_schema,
      sensitivity: item.sensitivity,
      required_permission: item.required_permission,
      ...(item.required_capabilities[0] ? { required_capability: item.required_capabilities[0] } : {}),
      retryable: false,
      idempotent: false,
      execute: async (rawInput, context) => {
        const startedAt = Date.now();
        try {
          const output = await handler(object(rawInput), context);
          return result(name, startedAt, output);
        } catch (error) {
          const known = error instanceof EmailWriteFailure ? error : null;
          const conflict = error instanceof EmailActionIdempotencyConflictError;
          return result(name, startedAt, undefined, {
            code: conflict ? "email_action_conflict" : known?.code ?? "email_write_tool_failed",
            message: conflict ? error.message : known?.message ?? "The email operation could not be completed.",
          });
        }
      },
    };
  }

  const draftCreate = makeTool("email.draft.create", async (input, context) => {
    const recipients = requireRecipients(input.to);
    const account = await resolveAccount(text(input.account_id), context);
    const item = descriptor("email.draft.create");
    if (!hasEmailToolCapabilities(item, account.capabilities as Record<string, boolean>)) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support drafts.");
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: recipients,
      cc: optionalRecipients(input.cc),
      bcc: optionalRecipients(input.bcc),
      subject: text(input.subject, 998),
      bodyText: preserveEmailBody(input.body_text),
    });
    return { status: "draft_created", draft_id: String(draft.id), account_id: account.id, subject: draft.subject ?? "" };
  });

  const draftUpdate = makeTool("email.draft.update", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const draftId = text(input.draft_id, 100);
    const existing = await getLocalDraftForOrganization(context.organization_id, draftId);
    if (!existing || String(existing.email_account_id) !== account.id) throw new EmailWriteFailure("draft_not_found", "The draft was not found in the selected mailbox.");
    const updated = await updateLocalDraftForOrganization(context.organization_id, draftId, {
      ...(input.to !== undefined ? { to: requireRecipients(input.to) } : {}),
      ...(input.cc !== undefined ? { cc: optionalRecipients(input.cc) } : {}),
      ...(input.bcc !== undefined ? { bcc: optionalRecipients(input.bcc) } : {}),
      ...(typeof input.subject === "string" ? { subject: text(input.subject, 998) } : {}),
      ...(typeof input.body_text === "string" ? { bodyText: preserveEmailBody(input.body_text) } : {}),
    });
    if (!updated) throw new EmailWriteFailure("draft_update_failed", "The draft could not be updated.");
    return { status: "draft_updated", draft_id: draftId, account_id: account.id, subject: updated.subject ?? "" };
  });

  const replyDraft = makeTool("email.draft_reply", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const source = await checkMessage(account.id, text(input.message_id, 100), context);
    if (!account.capabilities.drafts || !account.capabilities.reply) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support reply drafts.");
    const sender = typeof source.from_email === "string" ? source.from_email.trim() : "";
    if (!sender) throw new EmailWriteFailure("reply_recipient_missing", "The source message has no replyable sender address.");
    const recipient = requireRecipients([sender])[0]!;
    const originalSubject = text(source.subject, 998);
    const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: [recipient],
      subject,
      bodyText: preserveEmailBody(input.body_text),
    });
    return { status: "reply_draft_created", draft_id: String(draft.id), account_id: account.id, subject };
  });

  const forwardDraft = makeTool("email.draft_forward", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const source = await checkMessage(account.id, text(input.message_id, 100), context);
    if (!account.capabilities.drafts || !account.capabilities.forward) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support forward drafts.");
    const recipients = requireRecipients(input.to);
    const originalSubject = text(source.subject, 998);
    const subject = /^fwd?:/i.test(originalSubject) ? originalSubject : `Fwd: ${originalSubject}`;
    const originalBody = preserveEmailBody(source.text_body);
    const note = preserveEmailBody(input.body_text, 10000);
    const forwardedBody = `${note ? note + "\n\n" : ""}---------- Forwarded message ----------\n${originalBody}`;
    if (forwardedBody.length > 100000) {
      throw new EmailWriteFailure("draft_body_too_long", "The forwarded email exceeds the maximum draft size. Reduce the quoted content before saving.");
    }
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: recipients,
      subject,
      bodyText: forwardedBody,
    });
    return { status: "forward_draft_created", draft_id: String(draft.id), account_id: account.id, subject };
  });

  const requestSend = makeTool("email.send.request", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context, true);
    const draftId = text(input.draft_id, 100);
    const draft = await getLocalDraftForOrganization(context.organization_id, draftId);
    if (!draft || String(draft.email_account_id) !== account.id) throw new EmailWriteFailure("draft_not_found", "The draft was not found in the selected mailbox.");
    // Older saved drafts can lack a recipient; never request approval for one.
    const recipients = requireRecipients(draft.to_recipients);
    const cc = optionalRecipients(draft.cc_recipients);
    const bcc = optionalRecipients(draft.bcc_recipients);
    if (!account.capabilities.drafts || !account.capabilities.send) throw new EmailWriteFailure("capability_not_supported", "This mailbox cannot send drafts.");
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "send_email",
      draftId,
      recipientSnapshot: {
        to: recipients, cc, bcc,
        subject: text(draft.subject, 998), bodyText: preserveEmailBody(draft.text_body),
      },
      requestedBy: context.user_id,
      idempotencyKey: `${context.turn_id}:send:${draftId}`,
      correlationId: context.correlation_id,
    });
    return { status: "pending_approval", action_id: action.id, action_type: action.actionType, message: "The send request is awaiting explicit user approval. The email has not been sent." };
  });

  const requestReply = makeTool("email.reply.request", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context, true);
    const messageId = text(input.message_id, 100);
    const source = await checkMessage(account.id, messageId, context);
    if (!account.capabilities.reply) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support replies.");
    const recipient = typeof source.from_email === "string" ? source.from_email.trim() : "";
    if (!recipient) throw new EmailWriteFailure("reply_recipient_missing", "The source message has no replyable sender address.");
    requireRecipients([recipient]);
    const originalSubject = text(source.subject, 998);
    const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "reply_email",
      recipientSnapshot: { messageId: text(source.provider_message_id, 500) || messageId, to: [recipient], cc: [], bcc: [], subject, bodyText: preserveEmailBody(input.body_text) },
      requestedBy: context.user_id,
      idempotencyKey: `${context.turn_id}:reply:${messageId}`,
      correlationId: context.correlation_id,
    });
    return { status: "pending_approval", action_id: action.id, action_type: action.actionType, message: "The reply request is awaiting explicit user approval. The reply has not been sent." };
  });

  const requestForward = makeTool("email.forward.request", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context, true);
    const messageId = text(input.message_id, 100);
    const source = await checkMessage(account.id, messageId, context);
    if (!account.capabilities.forward) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support forwarding.");
    const recipients = requireRecipients(input.to);
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "forward_email",
      recipientSnapshot: { messageId: text(source.provider_message_id, 500) || messageId, to: recipients, subject: text(source.subject, 998), bodyText: preserveEmailBody(source.text_body) },
      requestedBy: context.user_id,
      idempotencyKey: `${context.turn_id}:forward:${messageId}`,
      correlationId: context.correlation_id,
    });
    return { status: "pending_approval", action_id: action.id, action_type: action.actionType, message: "The forward request is awaiting explicit user approval. The message has not been forwarded." };
  });

  return [draftCreate, draftUpdate, replyDraft, forwardDraft, requestSend, requestReply, requestForward];
}

export function registerEmailWriteTools(register: (tool: Tool) => void, deps: EmailWriteToolDependencies = {}): number {
  const tools = createEmailWriteTools(deps);
  for (const tool of tools) register(tool);
  return tools.length;
}
