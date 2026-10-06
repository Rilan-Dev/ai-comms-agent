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

export type AgentExecutionDispatchResult =
  | { status: "queued" | "completed"; executionId: string; output?: string; provider?: string; model?: string }
  | { status: "configuration_required"; executionId: string; reason: string };
