-- 0035 — More runtime drift fixup (sync + voice)
-- Reconciles additional columns the runtime worker and voice session code
-- expect but that were not created by earlier migrations.
-- Idempotent (ADD COLUMN IF NOT EXISTS). Forward-only.

-- email_folders: worker's replaceFolders/replaceStructure INSERTs updated_at
ALTER TABLE email_folders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- email_labels: worker's replaceLabels/replaceStructure INSERTs updated_at
ALTER TABLE email_labels
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- voice_sessions: voice route INSERTs conversation_id
ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

-- voice_sessions: also add provider, model, voice_id if missing (older code paths)
ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS voice_id text;

-- conversations: some runtime code references summary fields; ensure they exist
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index for the voice_sessions conversation lookup
CREATE INDEX IF NOT EXISTS voice_sessions_conversation_idx
  ON voice_sessions(conversation_id) WHERE conversation_id IS NOT NULL;
