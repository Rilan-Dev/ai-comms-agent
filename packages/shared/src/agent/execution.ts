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
  | { status: "queued"; executionId: string }
  | { status: "configuration_required"; executionId: string; reason: string };
