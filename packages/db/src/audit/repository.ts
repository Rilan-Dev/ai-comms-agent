import { query } from "../client";

export type AuditEventInput = {
  organizationId: string;
  actorUserId: string | null;
  agentId?: string | null;
  eventType: string;
  targetType?: string | null;
  targetId?: string | null;
  action?: string | null;
  decision?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  await query(
    "INSERT INTO audit_events (organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
    [
      input.organizationId,
      input.actorUserId,
      input.agentId ?? null,
      input.eventType,
      input.targetType ?? null,
      input.targetId ?? null,
      input.action ?? null,
      input.decision ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
