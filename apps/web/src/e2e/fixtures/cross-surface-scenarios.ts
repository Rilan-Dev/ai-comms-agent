export const E2E_FIXTURE_IDS = {
  organizationA: "10000000-0000-0000-0000-000000000001",
  organizationB: "10000000-0000-0000-0000-000000000002",
  ownerA: "20000000-0000-0000-0000-000000000001",
  memberA: "20000000-0000-0000-0000-000000000002",
  ownerB: "20000000-0000-0000-0000-000000000003",
  agentA: "30000000-0000-0000-0000-000000000001",
  agentB: "30000000-0000-0000-0000-000000000002",
  emailAccountA: "40000000-0000-0000-0000-000000000001",
  emailDraftA: "50000000-0000-0000-0000-000000000001",
  emailActionA: "60000000-0000-0000-0000-000000000001",
  whatsappAccountA: "70000000-0000-0000-0000-000000000001",
  whatsappMessageA: "80000000-0000-0000-0000-000000000001",
  scheduledJobA: "90000000-0000-0000-0000-000000000001",
  scheduledRunA: "a0000000-0000-0000-0000-000000000001",
  conversationA: "b0000000-0000-0000-0000-000000000001",
  voiceSessionA: "c0000000-0000-0000-0000-000000000001",
  correlationEmail: "d0000000-0000-0000-0000-000000000001",
  correlationWhatsApp: "d0000000-0000-0000-0000-000000000002",
} as const;

export const CROSS_SURFACE_SCENARIOS = [
  {
    id: "email-approval-send",
    description: "Create one approval-gated email action, retry it, approve it once, and preserve one correlation trail.",
    idempotencyKey: "e2e-email-action-001",
    expected: ["pending_approval", "single_action", "single_send", "audit_correlation"],
  },
  {
    id: "whatsapp-outbound-duplicate",
    description: "Queue one WhatsApp outbound message, retry the same request, and reject a conflicting payload using the same key.",
    idempotencyKey: "e2e-whatsapp-outbound-001",
    expected: ["single_message", "idempotent_retry", "conflict_409", "audit_correlation"],
  },
  {
    id: "scheduled-execution-duplicate",
    description: "Claim one scheduled fire concurrently and ensure only one durable scheduled run exists for that fire time.",
    idempotencyKey: "e2e-scheduled-fire-001",
    expected: ["single_run", "fire_at_unique", "execution_correlation"],
  },
  {
    id: "organization-isolation",
    description: "Attempt cross-organization access to email, WhatsApp, schedules, conversations, voice sessions, and audit data.",
    idempotencyKey: "e2e-org-isolation-001",
    expected: ["deny_cross_org", "no_data_leak", "no_cross_org_mutation"],
  },
  {
    id: "audit-trace-continuity",
    description: "Propagate one execution correlation through sensitive action creation, worker completion, and audit read models.",
    idempotencyKey: "e2e-audit-trace-001",
    expected: ["stable_correlation_id", "request_to_worker_trace", "audit_read_model"],
  },
] as const;

export type CrossSurfaceScenarioId = (typeof CROSS_SURFACE_SCENARIOS)[number]["id"];

export function getCrossSurfaceScenario(id: CrossSurfaceScenarioId) {
  return CROSS_SURFACE_SCENARIOS.find((scenario) => scenario.id === id);
}
