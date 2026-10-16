/**
 * Shared email agent loop facade.
 *
 * Keep the worker's existing import path stable while web voice and worker
 * execution use the same policy-aware tool runtime and bounded model loop.
 */
export {
  runEmailAgentTurn,
} from "@ai-comms-agent/email-agent-runtime";
export type {
  EmailAgentTurnInput,
  EmailAgentTurnResult,
  EmailToolLoopDependencies,
} from "@ai-comms-agent/email-agent-runtime";
