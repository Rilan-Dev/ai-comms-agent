/**
 * Shared email operation contracts for the host agent runtime.
 * Metadata only: descriptors must not be exposed until executable handlers
 * enforce tenant/account grants, schema, capability, policy and audit.
 */
import type { Channel, EmailToolDescriptor } from "./types";
import type { CapabilitySet, EmailProviderCapability } from "../email/provider";

const emailChannels = ["chat", "voice", "whatsapp", "schedule"] as const;
const emailAccountId = { type: "string", minLength: 1, description: "Local email account ID, resolved by the host." };
const emailMessageIds = { type: "array", minItems: 1, maxItems: 100, items: { type: "string", minLength: 1 } };
const emailRecipients = { type: "array", maxItems: 100, items: { type: "string", minLength: 1 } };
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
  emailTool("email.search", "Search provider or tenant-scoped local mail.", "email.read", emailObject({ account_id: emailAccountId, query: { type: "string", maxLength: 1000 }, from: { type: "string" }, subject: { type: "string" }, date_from: { type: "string", format: "date-time" }, date_to: { type: "string", format: "date-time" }, folder: { type: "string" }, label: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } }, ["account_id"]), [], "safe", ["search_server_side", "search_client_side"]),
  emailTool("email.sync.status", "Read synchronization state for an account.", "email.read", emailObject({ account_id: emailAccountId }, ["account_id"])),
  emailTool("email.draft.create", "Create a draft without sending it.", "email.write", emailObject({ account_id: emailAccountId, to: emailMessageIds, cc: emailRecipients, bcc: emailRecipients, subject: { type: "string", maxLength: 998 }, body_text: { type: "string", maxLength: 100000 } }, ["account_id", "to", "subject", "body_text"]), ["drafts"]),
  emailTool("email.draft.update", "Update an existing draft.", "email.write", emailObject({ account_id: emailAccountId, draft_id: { type: "string" }, to: emailRecipients, subject: { type: "string" }, body_text: { type: "string" } }, ["account_id", "draft_id"]), ["drafts"]),
  emailTool("email.draft.delete", "Delete a draft without sending it.", "email.write", emailObject({ account_id: emailAccountId, draft_id: { type: "string" } }, ["account_id", "draft_id"]), ["drafts"]),
  emailTool("email.draft_reply", "Create a reply draft for an existing message.", "email.write", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, body_text: { type: "string" } }, ["account_id", "message_id", "body_text"]), ["drafts", "reply"]),
  emailTool("email.draft_forward", "Create a forward draft for an existing message.", "email.write", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, to: emailMessageIds }, ["account_id", "message_id", "to"]), ["drafts", "forward"]),
  emailTool("email.message.mark_read", "Mark messages read or unread.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, is_read: { type: "boolean" } }, ["account_id", "message_ids", "is_read"]), ["mark_read"]),
  emailTool("email.message.archive", "Archive messages.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds }, ["account_id", "message_ids"]), ["archive"]),
  emailTool("email.message.move", "Move messages to a provider folder.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, target_folder_id: { type: "string" } }, ["account_id", "message_ids", "target_folder_id"]), ["move"]),
  emailTool("email.labels.apply", "Apply labels to messages.", "email.write", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, label_ids: emailMessageIds }, ["account_id", "message_ids", "label_ids"]), ["labels"]),
  emailTool("email.attachment.list", "List attachment metadata without exposing bytes.", "email.read", emailObject({ account_id: emailAccountId, message_id: { type: "string" } }, ["account_id", "message_id"]), ["attachments_download"]),
  emailTool("email.attachment.download", "Download an authorized attachment after safety checks.", "email.read", emailObject({ account_id: emailAccountId, message_id: { type: "string" }, attachment_id: { type: "string" } }, ["account_id", "message_id", "attachment_id"]), ["attachments_download"]),
  emailTool("email.summarize", "Summarize a bounded set of messages with source IDs.", "email.read", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds, since: { type: "string", format: "date-time" }, until: { type: "string", format: "date-time" }, max_messages: { type: "integer", minimum: 1, maximum: 100 } }, ["account_id"])),
  emailTool("email.message.trash", "Move messages to Trash; permanent deletion is separate.", "email.delete", emailObject({ account_id: emailAccountId, message_ids: emailMessageIds }, ["account_id", "message_ids"]), ["move"], "sensitive"),
  emailTool("email.bulk_action", "Apply a bounded bulk action after policy checks.", "email.modify_bulk", emailObject({ account_id: emailAccountId, action: { type: "string", enum: ["mark_read", "mark_unread", "archive", "move", "apply_labels", "trash"] }, message_ids: emailMessageIds, target_folder_id: { type: "string" }, label_ids: emailMessageIds }, ["account_id", "action", "message_ids"]), [], "sensitive", ["mark_read", "archive", "move", "labels"]),
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
