import {
  PostgresEmailAccountRepository,
  archiveMailMessagesForOrganization,
  createEmailAction,
  createLocalDraft,
  deleteLocalDraftForOrganization,
  getLocalDraftForOrganization,
  getMailMessageForOrganization,
  listMailFoldersForOrganization,
  moveMailMessagesForOrganization,
  query,
  updateLocalDraftForOrganization,
  updateMailReadStateForOrganization,
} from "@ai-comms-agent/db";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { EMAIL_TOOL_CATALOG } from "@ai-comms-agent/shared";
import { hasEmailToolCapabilities } from "./email-tool-policy";

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
function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 100) : [];
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
    if (!accountId) throw new EmailWriteFailure("invalid_account", "A connected email account is required.");
    const binding = await query<{ role: string }>(
      `SELECT b.role FROM agent_email_accounts b
       JOIN agents g ON g.id=b.agent_id
       JOIN email_accounts a ON a.id=b.email_account_id
       WHERE g.id=$1 AND g.organization_id=$2 AND a.id=$3
         AND a.organization_id=$2 AND a.deleted_at IS NULL
       LIMIT 1`,
      [context.agent_id, context.organization_id, accountId],
    );
    const role = binding.rows[0]?.role;
    if (!role || (role === "send_only" && !allowSendOnly)) {
      throw new EmailWriteFailure("account_not_available", "This mailbox is not available for the requested operation.");
    }
    const account = await accounts.getForAgent(context.organization_id, context.agent_id, accountId);
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
          return result(name, startedAt, undefined, {
            code: known?.code ?? "email_write_tool_failed",
            message: known?.message ?? "The email operation could not be completed.",
          });
        }
      },
    };
  }

  const draftCreate = makeTool("email.draft.create", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const item = descriptor("email.draft.create");
    if (!hasEmailToolCapabilities(item, account.capabilities as Record<string, boolean>)) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support drafts.");
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: list(input.to),
      cc: list(input.cc),
      bcc: list(input.bcc),
      subject: text(input.subject, 998),
      bodyText: text(input.body_text, 100000),
    });
    return { status: "draft_created", draft_id: String(draft.id), account_id: account.id, subject: draft.subject ?? "" };
  });

  const draftUpdate = makeTool("email.draft.update", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const draftId = text(input.draft_id, 100);
    const existing = await getLocalDraftForOrganization(context.organization_id, draftId);
    if (!existing || String(existing.email_account_id) !== account.id) throw new EmailWriteFailure("draft_not_found", "The draft was not found in the selected mailbox.");
    const updated = await updateLocalDraftForOrganization(context.organization_id, draftId, {
      ...(Array.isArray(input.to) ? { to: list(input.to) } : {}),
      ...(Array.isArray(input.cc) ? { cc: list(input.cc) } : {}),
      ...(Array.isArray(input.bcc) ? { bcc: list(input.bcc) } : {}),
      ...(typeof input.subject === "string" ? { subject: text(input.subject, 998) } : {}),
      ...(typeof input.body_text === "string" ? { bodyText: text(input.body_text, 100000) } : {}),
    });
    if (!updated) throw new EmailWriteFailure("draft_update_failed", "The draft could not be updated.");
    return { status: "draft_updated", draft_id: draftId, account_id: account.id, subject: updated.subject ?? "" };
  });

  const draftDelete = makeTool("email.draft.delete", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const draftId = text(input.draft_id, 100);
    const existing = await getLocalDraftForOrganization(context.organization_id, draftId);
    if (!existing || String(existing.email_account_id) !== account.id) throw new EmailWriteFailure("draft_not_found", "The draft was not found in the selected mailbox.");
    if (!await deleteLocalDraftForOrganization(context.organization_id, draftId)) throw new EmailWriteFailure("draft_delete_failed", "The draft could not be deleted.");
    return { status: "draft_deleted", draft_id: draftId, account_id: account.id };
  });

  const replyDraft = makeTool("email.draft_reply", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const source = await checkMessage(account.id, text(input.message_id, 100), context);
    if (!account.capabilities.drafts || !account.capabilities.reply) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support reply drafts.");
    const sender = text(source.from_email, 320);
    if (!sender) throw new EmailWriteFailure("reply_recipient_missing", "The source message has no replyable sender address.");
    const originalSubject = text(source.subject, 998);
    const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: [sender],
      subject,
      bodyText: text(input.body_text, 100000),
    });
    return { status: "reply_draft_created", draft_id: String(draft.id), account_id: account.id, subject };
  });

  const forwardDraft = makeTool("email.draft_forward", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const source = await checkMessage(account.id, text(input.message_id, 100), context);
    if (!account.capabilities.drafts || !account.capabilities.forward) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support forward drafts.");
    const recipients = list(input.to);
    if (!recipients.length) throw new EmailWriteFailure("recipient_required", "At least one forward recipient is required.");
    const originalSubject = text(source.subject, 998);
    const subject = /^fwd?:/i.test(originalSubject) ? originalSubject : `Fwd: ${originalSubject}`;
    const originalBody = text(source.text_body, 90000);
    const draft = await createLocalDraft({
      organizationId: context.organization_id,
      emailAccountId: account.id,
      to: recipients,
      subject,
      bodyText: `${text(input.body_text, 10000)}\n\n---------- Forwarded message ----------\n${originalBody}`.trim(),
    });
    return { status: "forward_draft_created", draft_id: String(draft.id), account_id: account.id, subject };
  });

  const markRead = makeTool("email.message.mark_read", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (typeof input.is_read !== "boolean") throw new EmailWriteFailure("invalid_input", "is_read must be a boolean.");
    const ids = list(input.message_ids);
    if (!ids.length) throw new EmailWriteFailure("invalid_input", "At least one message ID is required.");
    for (const id of ids) await checkMessage(account.id, id, context);
    const updated = await updateMailReadStateForOrganization(context.organization_id, ids, input.is_read);
    if (updated !== ids.length) throw new EmailWriteFailure("partial_update", "Not all selected messages were updated.");
    return { status: "messages_updated", count: updated, is_read: input.is_read };
  });

  const archive = makeTool("email.message.archive", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (!account.capabilities.archive) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support archiving.");
    const ids = list(input.message_ids);
    if (!ids.length) throw new EmailWriteFailure("invalid_input", "At least one message ID is required.");
    for (const id of ids) await checkMessage(account.id, id, context);
    const updated = await archiveMailMessagesForOrganization(context.organization_id, ids);
    if (updated !== ids.length) throw new EmailWriteFailure("partial_update", "Not all selected messages were archived.");
    return { status: "messages_archived", count: updated };
  });

  const move = makeTool("email.message.move", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (!account.capabilities.move) throw new EmailWriteFailure("capability_not_supported", "This mailbox does not support moving messages.");
    const ids = list(input.message_ids);
    const target = text(input.target_folder_id, 300);
    if (!ids.length || !target) throw new EmailWriteFailure("invalid_input", "Message IDs and a target folder are required.");
    const folders = await listMailFoldersForOrganization(context.organization_id, account.id);
    const folder = folders.find((item) => [item.id, item.provider_folder_id, item.name].some((candidate) => typeof candidate === "string" && candidate.toLowerCase() === target.toLowerCase()));
    if (!folder) throw new EmailWriteFailure("folder_not_found", "The target folder does not belong to the selected mailbox.");
    for (const id of ids) await checkMessage(account.id, id, context);
    const updated = await moveMailMessagesForOrganization(context.organization_id, ids, String(folder.id));
    if (updated !== ids.length) throw new EmailWriteFailure("partial_update", "Not all selected messages were moved.");
    return { status: "messages_moved", count: updated, folder_id: String(folder.id), folder_name: text(folder.name, 200) };
  });

  const requestSend = makeTool("email.send.request", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context, true);
    const draftId = text(input.draft_id, 100);
    const draft = await getLocalDraftForOrganization(context.organization_id, draftId);
    if (!draft || String(draft.email_account_id) !== account.id) throw new EmailWriteFailure("draft_not_found", "The draft was not found in the selected mailbox.");
    if (!account.capabilities.drafts || !account.capabilities.send) throw new EmailWriteFailure("capability_not_supported", "This mailbox cannot send drafts.");
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "send_email",
      draftId,
      recipientSnapshot: {
        to: list(draft.to_recipients), cc: list(draft.cc_recipients), bcc: list(draft.bcc_recipients),
        subject: text(draft.subject, 998), bodyText: text(draft.text_body, 100000),
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
    const recipient = text(source.from_email, 320);
    if (!recipient) throw new EmailWriteFailure("reply_recipient_missing", "The source message has no replyable sender address.");
    const originalSubject = text(source.subject, 998);
    const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "reply_email",
      recipientSnapshot: { messageId, to: [recipient], cc: [], bcc: [], subject, bodyText: text(input.body_text, 100000) },
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
    const recipients = list(input.to);
    if (!recipients.length) throw new EmailWriteFailure("recipient_required", "At least one forward recipient is required.");
    const action = await createEmailAction({
      organizationId: context.organization_id,
      agentId: context.agent_id,
      emailAccountId: account.id,
      actionType: "forward_email",
      recipientSnapshot: { messageId, to: recipients, subject: text(source.subject, 998), bodyText: text(source.text_body, 100000) },
      requestedBy: context.user_id,
      idempotencyKey: `${context.turn_id}:forward:${messageId}`,
      correlationId: context.correlation_id,
    });
    return { status: "pending_approval", action_id: action.id, action_type: action.actionType, message: "The forward request is awaiting explicit user approval. The message has not been forwarded." };
  });

  return [draftCreate, draftUpdate, draftDelete, replyDraft, forwardDraft, markRead, archive, move, requestSend, requestReply, requestForward];
}

export function registerEmailWriteTools(register: (tool: Tool) => void, deps: EmailWriteToolDependencies = {}): number {
  const tools = createEmailWriteTools(deps);
  for (const tool of tools) register(tool);
  return tools.length;
}
