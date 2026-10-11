-- 0037 — voice_sessions column drift fixup
-- The voice route INSERTs into connected_at, ended_at columns that weren't
-- created by earlier migrations. Idempotent. Forward-only.

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
