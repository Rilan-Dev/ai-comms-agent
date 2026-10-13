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


export { EMAIL_TOOL_CATALOG, listEmailToolDescriptors } from "./mail-operations";
