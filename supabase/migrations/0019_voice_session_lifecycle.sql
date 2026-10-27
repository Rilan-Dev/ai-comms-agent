-- Product completion: realtime voice session lifecycle alignment.
-- Keeps voice sessions authoritative in PostgreSQL while Clara owns realtime transport.

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS turn_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS voice_sessions_agent_started_idx
  ON voice_sessions(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS voice_sessions_user_started_idx
  ON voice_sessions(user_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS voice_sessions_provider_session_uniq
  ON voice_sessions(provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION finalize_voice_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)))::integer);
    IF NEW.status = 'starting' THEN
      NEW.status = 'ended';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voice_sessions_finalize ON voice_sessions;
CREATE TRIGGER voice_sessions_finalize
BEFORE UPDATE ON voice_sessions
FOR EACH ROW EXECUTE FUNCTION finalize_voice_session();

COMMENT ON TABLE voice_sessions IS 'Host-owned voice session metadata; Clara owns realtime transport and provider lifecycle.';
COMMENT ON TABLE voice_telemetry IS 'Host-owned persistence for Clara realtime latency/quality telemetry; audio is never persisted.';
