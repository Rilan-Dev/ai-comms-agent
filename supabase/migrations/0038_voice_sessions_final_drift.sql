-- 0038 — voice_sessions final drift fixup
-- The voice route UPDATE references disconnect_reason; a trigger references updated_at.
-- Idempotent. Forward-only.

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS disconnect_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Drop & recreate the set_updated_at trigger for voice_sessions (only if
-- a previous trigger references the now-existing updated_at column).
DROP TRIGGER IF EXISTS voice_sessions_set_updated_at ON voice_sessions;
CREATE TRIGGER voice_sessions_set_updated_at
  BEFORE UPDATE ON voice_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
