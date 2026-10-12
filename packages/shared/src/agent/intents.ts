/**
 * Intent taxonomy — deterministic, not free-form.
 * Per docs/architecture/AI-ARCHITECTURE.md §3.
 *
 * The LLM classifies a user's text into one of these intents. If it cannot
 * classify with confidence above a threshold, the runtime asks for clarification.
 */

import type { Intent } from "./types";

export const INTENT_TAXONOMY: Record<
  Intent,
  {
    description: string;
    sensitivity: "safe" | "sensitive";
    required_permission: string;
  }
> = {
  summarize_emails: {
    description: "Summarize a time range or scope of emails",
    sensitivity: "safe",
    required_permission: "email.read",
  },
  find_emails: {
    description: "Search emails by person, topic, date, or content",
    sensitivity: "safe",
    required_permission: "email.read",
  },
  classify_emails: {
    description: "Mark importance / action-required for emails",
    sensitivity: "safe",
    required_permission: "email.read",
  },
  extract_information: {
    description: "Extract dates, contacts, deadlines from emails",
    sensitivity: "safe",
    required_permission: "email.read",
  },
  draft_email: {
    description: "Create a draft (not sent)",
    sensitivity: "safe",
    required_permission: "email.write",
  },
  draft_reply: {
    description: "Create a reply draft (not sent)",
    sensitivity: "safe",
    required_permission: "email.write",
  },
  send_email: {
    description: "Send an email",
    sensitivity: "sensitive",
    required_permission: "email.send",
  },
  forward_email: {
    description: "Forward an email",
    sensitivity: "sensitive",
    required_permission: "email.send",
  },
  delete_email: {
    description: "Delete an email",
    sensitivity: "sensitive",
    required_permission: "email.delete",
  },
  bulk_modify: {
    description: "Bulk read/unread/label/archive emails",
    sensitivity: "sensitive",
    required_permission: "email.modify_bulk",
  },
  send_whatsapp_message: {
    description: "Send an outbound WhatsApp message",
    sensitivity: "sensitive",
    required_permission: "messaging.send",
  },
  create_schedule: {
    description: "Create a scheduled job",
    sensitivity: "safe",
    required_permission: "schedule.write",
  },
  list_schedules: {
    description: "List scheduled jobs",
    sensitivity: "safe",
    required_permission: "schedule.read",
  },
  cancel_schedule: {
    description: "Cancel a scheduled job",
    sensitivity: "safe",
    required_permission: "schedule.write",
  },
  summary_generate: {
    description: "Generate a summary for a scope/period",
    sensitivity: "safe",
    required_permission: "email.read",
  },
  general_qa: {
    description: "General question (uses RAG)",
    sensitivity: "safe",
    required_permission: "agent.read",
  },
};

/**
 * Canonical email tool contracts for the host-owned agent runtime.
 * These descriptors are not handlers: production execution must resolve the
 * local account, validate schema, check permissions/capabilities/policy again,
 * and write the host audit record before/after any side effect.
 */
import type { EmailToolDescriptor } from "./types";
import type { CapabilitySet, EmailProviderCapability } from "../email/provider";

const emailChannels = ["chat", "voice", "whatsapp", "schedule"] as const;
const emailAccountId = { type: "string", minLength: 1, description: "Local email account ID, resolved by the host." };
const emailMessageIds = { type: "array", minItems: 1, maxItems: 100, items: { type: "string", minLength: 1 } };
const emailObject = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});
function emailTool(name: `email.${string}`, description: string, permission: string, input_schema: Record<string, unknown>, required_capabilities: readonly EmailProviderCapability[] = [], sensitivity: "safe" | "sensitive" = "safe", any_capabilities?: readonly EmailProviderCapability[]): EmailToolDescriptor {
  return { name, description, required_permission: permission, input_schema, required_capabilities, ...(any_capabilities ? { any_capabilities } : {}), sensitivity, channels: [...emailChannels], policy_required: sensitivity === "sensitive", contract_status: "contract" };
}

/** Metadata inventory: actual availability is capability-filtered and execution-gated. */
export const EMAIL_TOOL_CATALOG: readonly EmailToolDescriptor[] = [
  emailTool("email.accounts.list", "List accounts this agent may access.", "email.read", emailObject({})),
  emailTool("email.capabilities.get", "List verified operations available for an account.", "email.read", emailObject({ account_id: emailAccountId }, ["account_id"])),
  emailTool("email.folders.list", "List folders/mailboxes.", "email.read", emailObject({ account_id: emailAccountId }, ["account_id"]), ["folders"]),
  emailTool("email.labels.list", "List labels.", "email.read", emailObject({ account_id: emailAccountId }, ["account_id"]), ["labels"]),
  emailTool("email.messages.list", "List a bounded page of messages.", "email.read", emailObject({ account_id: emailAccountId, folder_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: "string" } }, ["account_id"])),
  emailTool("email.message.get", "Read one authorized message.", "email.read", emailObject({ account_id: emailAccountId, message_id: { type: "string", minLength: 1 } }, ["account_id", "message_id"])),
  emailTool("email.thread.get", "Read a provider thread.", "email.read", emailObject({ account_id: emailAccountId, thread_id: { type: "string", minLength: 1 } }, ["account_id", "thread_id"]), ["threads"]),
  emailTool("email.search", "Search provider or tenant-scoped local mail.", "email.read", emailObject({ account_id: emailAccountId, query: { type: "string", maxLength: 1000 }, from: { type: "string" }, subject: { type: "string" }, date_from: { type: "string", format: "date-time" }, date_to: { type: "string", format: "date-time" }, folder: { type: "string" }, label: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } }, ["account_id"], "safe", ["search_server_side", "search_client_side"])),
  emailTool("email.sync.status", "Read synchronization state for an account.", "email.read", emailObject({ account_id: emailAccountId }, ["account_id"])),
  emailTool("email.draft.create", "Create a draft without sending it.", "email.write", emailObject({ account_id: emailAccountId, to: emailMessageIds, cc: emailMessageIds, bcc: emailMessageIds, subject: { type: "string", maxLength: 998 }, body_text: { type: "string", maxLength: 100000 } }, ["account_id", "to", "subject", "body_text"]), ["drafts"]),
  emailTool("email.draft.update", "Update an existing draft.", "email.write", emailObject({ account_id: emailAccountId, draft_id: { type: "string" }, to: emailMessageIds, subject: { type: "string" }, body_text: { type: "string" } }, ["account_id", "draft_id"]), ["drafts"]),
  emailTool("email.draft.delete", "Delete a draft without sending it.", "email.write", emailObject({ account_id: emailAccountId, draft_id: { type: "string" } }, ["account_id", "draft_id"]), ["drafts"]),
  emailTool("email.draft_reply", "Create a reply draft for an existing message.", "email.write", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, body_text: { type: "string" } }, ["account_id", "message_id", "body_text"]), ["drafts"]),
  emailTool("email.draft_forward", "Create a forward draft for an existing message.", "email.write", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, to: emailMessageIds }, ["account_id", "message_id", "to"]), ["drafts"]),
  emailTool("email.message.mark_read", "Mark messages read or unread.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, is_read: { type: "boolean" } }, ["account_id", "message_ids", "is_read"]), ["mark_read"]),
  emailTool("email.message.archive", "Archive messages.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds }, ["account_id", "message_ids"]), ["archive"]),
  emailTool("email.message.move", "Move messages to a provider folder.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, target_folder_id: { type: "string" } }, ["account_id", "message_ids", "target_folder_id"]), ["move"]),
  emailTool("email.labels.apply", "Apply labels to messages.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, label_ids: emailMessageIds }, ["account_id", "message_ids", "label_ids"]), ["labels"]),
  emailTool("email.attachment.list", "List attachment metadata without exposing bytes.", "email.read", emailObject({ account_id: emailAccountId, message_id: { type: "string" } }, ["account_id", "message_id"]), ["attachments_download"]),
  emailTool("email.attachment.download", "Download an authorized attachment after safety checks.", "email.read", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, attachment_id: { type: "string" } }, ["account_id", "message_id", "attachment_id"]), ["attachments_download"]),
  emailTool("email.summarize", "Summarize a bounded set of messages with source IDs.", "email.read", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, since: { type: "string", format: "date-time" }, until: { type: "string", format: "date-time" }, max_messages: { type: "integer", minimum: 1, maximum: 100 } }, ["account_id"])),
  emailTool("email.send", "Send an approved immutable draft through host policy.", "email.send", emailObject({ account_id: emailAccountId, draft_id: { type: "string" }, idempotency_key: { type: "string", minLength: 8, maxLength: 200 } }, ["send"], "sensitive"),
  emailTool("email.reply.send", "Send a thread-aware reply only after host approval.", "email.send", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, draft_id: { type: "string" }, idempotency_key: { type: "string", minLength: 8 } }, ["send", "threads"], "sensitive"),
  emailTool("email.forward.send", "Send a forward only after host approval.", "email.send", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, draft_id: { type: "string" }, idempotency_key: { type: "string", minLength: 8 } }, ["send", "threads"], "sensitive"),
  emailTool("email.message.trash", "Move messages to Trash; permanent deletion is separate.", "email.delete", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds }, ["account_id", "message_ids"]), ["move"], "sensitive"),
  emailTool("email.bulk_action", "Apply a bounded bulk action after policy checks.", "email.modify_bulk", emailObject({ account_id: emailAccountId, action: { type: "string", enum: ["mark_read", "mark_unread", "archive", "move", "apply_labels", "trash"] }, message_ids: emailMessageIds, target_folder_id: { type: "string" }, label_ids: emailMessageIds }, ["account_id", "action", "message_ids"]), [], "sensitive"),
] as const;

/** Hide tools unsupported by this account or disabled by the agent allowlist. */
export function listEmailToolDescriptors(capabilities: Partial<CapabilitySet>, allowedToolNames?: readonly string[]): EmailToolDescriptor[] {
  const allowed = allowedToolNames ? new Set(allowedToolNames) : undefined;
  return EMAIL_TOOL_CATALOG.filter((item) =>
    (!allowed || allowed.has(item.name)) &&
    item.required_capabilities.every((capability) => capabilities[capability] === true) &&
    (!item.any_capabilities?.length || item.any_capabilities.some((capability) => capabilities[capability] === true)),
  );
}
