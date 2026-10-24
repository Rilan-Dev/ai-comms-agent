/**
 * Autonomous-send policy flag.
 *
 * An organization administrator opts an agent into autonomous outbound sending
 * by storing `autonomous_send: true` in the agent policy's security_policy JSON
 * (Agent Policy page). When enabled, email and WhatsApp send requests created
 * by that agent are approved automatically at creation time instead of waiting
 * in the human approval queues. Everything else still applies: the requesting
 * user's own permissions, agent account bindings, idempotency, Meta's 24-hour
 * customer-service window / approved-template rules, and the worker's
 * dispatch-time authorization rechecks.
 */
export const AUTONOMOUS_SEND_POLICY_KEY = "autonomous_send" as const;

/** Marker comment recorded on auto-approved email action approval rows. */
export const AUTO_APPROVED_MARKER = "auto-approved:agent_policy_autonomous_send" as const;

export function isAutonomousSendEnabled(securityPolicy: Record<string, unknown> | null | undefined): boolean {
  return securityPolicy?.[AUTONOMOUS_SEND_POLICY_KEY] === true;
}
