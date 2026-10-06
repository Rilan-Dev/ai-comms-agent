import { query } from "../client";

type Row = Record<string, unknown>;

export type VoiceSessionStatus = "starting" | "active" | "ended" | "error";

export interface CreateVoiceSessionInput {
  organizationId: string;
  agentId: string;
  userId: string;
  conversationId?: string | null;
  provider?: string | null;
  model?: string | null;
  voiceId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createVoiceSession(input: CreateVoiceSessionInput): Promise<Row> {
  const result = await query<Row>(
    `INSERT INTO voice_sessions
      (organization_id, agent_id, user_id, conversation_id, provider, model, voice_id, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'starting',$8::jsonb)
     RETURNING id, organization_id, agent_id, user_id, conversation_id, provider, model, voice_id, status, started_at, connected_at, ended_at, duration_seconds, turn_count, metadata`,
    [input.organizationId, input.agentId, input.userId, input.conversationId ?? null, input.provider ?? null, input.model ?? null, input.voiceId ?? null, JSON.stringify(input.metadata ?? {})],
  );
  if (!result.rows[0]) throw new Error("Voice session could not be created.");
  return result.rows[0];
}

export async function activateVoiceSessionForOrganization(
  organizationId: string,
  sessionId: string,
  providerSessionId?: string | null,
): Promise<Row | null> {
  const result = await query<Row>(
    `UPDATE voice_sessions
     SET status = 'active', connected_at = COALESCE(connected_at, now()), provider_session_id = COALESCE($1, provider_session_id)
     WHERE id = $2 AND organization_id = $3 AND ended_at IS NULL
     RETURNING *`,
    [providerSessionId ?? null, sessionId, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function incrementVoiceSessionTurnForOrganization(
  organizationId: string,
  sessionId: string,
): Promise<void> {
  await query(
    `UPDATE voice_sessions SET turn_count = turn_count + 1
     WHERE id = $1 AND organization_id = $2 AND ended_at IS NULL`,
    [sessionId, organizationId],
  );
}

export async function endVoiceSessionForOrganization(
  organizationId: string,
  sessionId: string,
  reason?: string | null,
): Promise<Row | null> {
  const result = await query<Row>(
    `UPDATE voice_sessions
     SET status = CASE WHEN $3 = 'error' THEN 'error' ELSE 'ended' END,
         ended_at = COALESCE(ended_at, now()),
         disconnect_reason = COALESCE($3, disconnect_reason)
     WHERE id = $1 AND organization_id = $2
     RETURNING id, organization_id, agent_id, user_id, conversation_id, provider, model, voice_id, status, started_at, connected_at, ended_at, duration_seconds, turn_count, disconnect_reason, metadata`,
    [sessionId, organizationId, reason ?? null],
  );
  return result.rows[0] ?? null;
}

export async function getVoiceSessionForOrganization(
  organizationId: string,
  sessionId: string,
): Promise<Row | null> {
  const result = await query<Row>(
    `SELECT id, organization_id, agent_id, user_id, conversation_id, provider, model, voice_id, status, started_at, connected_at, ended_at, duration_seconds, turn_count, disconnect_reason, metadata
     FROM voice_sessions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
    [sessionId, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function recordVoiceTelemetry(input: {
  organizationId: string;
  voiceSessionId: string;
  metricName: string;
  metricValue: number;
  unit?: string | null;
  stage?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO voice_telemetry
      (organization_id, voice_session_id, correlation_id, metric_name, metric_value, unit, stage, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [input.organizationId, input.voiceSessionId, input.correlationId ?? null, input.metricName, input.metricValue, input.unit ?? null, input.stage ?? null, JSON.stringify(input.metadata ?? {})],
  );
}
