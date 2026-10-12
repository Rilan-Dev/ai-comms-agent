/**
 * Agent runtime types — shared between web and worker.
 * Per docs/architecture/AI-ARCHITECTURE.md and docs/specs/TOOL-CONTRACTS.md.
 */

export type Channel = "chat" | "voice" | "whatsapp" | "schedule";

export type Intent =
  | "summarize_emails"
  | "find_emails"
  | "classify_emails"
  | "extract_information"
  | "draft_email"
  | "draft_reply"
  | "send_email"
  | "forward_email"
  | "delete_email"
  | "bulk_modify"
  | "send_whatsapp_message"
  | "create_schedule"
  | "list_schedules"
  | "cancel_schedule"
  | "summary_generate"
  | "general_qa";

export type ToolSensitivity = "safe" | "sensitive";

export interface AgentRequest {
  agent_id: string;
  organization_id: string;
  user_id: string | null;
  channel: Channel;
  transport_metadata: {
    conversation_id?: string;
    voice_session_id?: string;
    whatsapp_contact_id?: string;
    scheduled_job_id?: string;
    stream_id?: string;
  };
  user_text: string;
  attachments?: Attachment[];
  auth_subject: {
    user_id: string | null;
    role: "owner" | "admin" | "member" | "viewer";
    permissions: string[];
  };
  audit: {
    correlation_id: string;
    request_id: string;
    started_at: number;
  };
}

export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface AgentResponse {
  turn_id: string;
  conversation_id: string;
  text: string;
  tool_calls?: ToolCallSummary[];
  approval_required?: {
    action_id: string;
    action_type: string;
    target_summary: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ToolCallSummary {
  tool_name: string;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  ok: boolean;
}

export interface Tool<I = unknown, O = unknown> {
  name: string;
  domain: "email" | "messaging" | "schedule" | "summary" | "kb" | "conversation";
  description: string;
  input_schema: Record<string, unknown>;
  sensitivity: ToolSensitivity;
  required_permission: string;
  required_capability?: string;
  execute: (input: I, context: ToolContext) => Promise<ToolResult<O>>;
  timeout_ms?: number;
  retryable?: boolean;
  idempotent?: boolean;
}

export interface ToolContext {
  agent_id: string;
  organization_id: string;
  user_id: string | null;
  conversation_id: string;
  turn_id: string;
  correlation_id: string;
  channel: Channel;
  auth_subject: {
    user_id: string | null;
    role: "owner" | "admin" | "member" | "viewer";
    permissions: string[];
  };
}

export interface ToolResult<O = unknown> {
  ok: boolean;
  output?: O;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  audit: {
    tool_name: string;
    input_summary: string;
    output_summary: string;
    duration_ms: number;
    provider_calls?: Array<{
      provider: string;
      latency_ms: number;
      status: "success" | "error";
    }>;
  };
}

/** Metadata contract for host-owned email tools. Descriptors are not executable handlers. */
export interface EmailToolDescriptor {
  name: `email.${string}`;
  description: string;
  input_schema: Record<string, unknown>;
  sensitivity: ToolSensitivity;
  required_permission: string;
  required_capabilities: readonly ("folders" | "labels" | "sync_incremental" | "sync_full" | "sync_webhook" | "sync_idle" | "search_server_side" | "search_client_side" | "drafts" | "reply" | "forward" | "mark_read" | "archive" | "move" | "threads" | "attachments_download" | "attachments_upload" | "send")[];
  any_capabilities?: readonly ("folders" | "labels" | "sync_incremental" | "sync_full" | "sync_webhook" | "sync_idle" | "search_server_side" | "search_client_side" | "drafts" | "reply" | "forward" | "mark_read" | "archive" | "move" | "threads" | "attachments_download" | "attachments_upload" | "send")[];
  channels: readonly Channel[];
  policy_required: boolean;
  contract_status: "contract";
}
