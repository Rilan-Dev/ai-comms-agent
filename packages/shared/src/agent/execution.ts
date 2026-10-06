export type AgentExecutionSource = "schedule" | "automation" | "user";

export interface AgentExecutionRequest {
  executionId: string;
  organizationId: string;
  agentId: string;
  source: AgentExecutionSource;
  intent: string;
  params: Record<string, unknown>;
  requestedAt: string;
}

export interface ProductActionResult {
  type: string;
  status: string;
  reason?: string;
  actionId?: string;
  messageId?: string | null;
}

export type AgentExecutionDispatchResult =
  | { status: "queued" | "completed"; executionId: string; output?: string; provider?: string; model?: string; actions?: ProductActionResult[] }
  | { status: "configuration_required"; executionId: string; reason: string; actions?: ProductActionResult[] };
