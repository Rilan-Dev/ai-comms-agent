-- 0044 — AI Provider Setup menu: split chat / voice-chat / realtime / embedding
-- 1. Extend organization_ai_runtime_settings with voice-chat (TTS/STT) columns,
--    realtime-specific columns (separate from voice-chat), and embedding
--    columns. Existing realtime_voice_provider/model/voice_id columns remain
--    authoritative for the realtime surface; we add voice_chat_* for the
--    pipeline TTS/STT surface and embedding_* for the RAG surface.
-- 2. Extend ai_provider_configs.purpose CHECK constraint to allow
--    'chat' | 'tts' | 'stt' | 'realtime' | 'embedding' | 'general'.
--    (Some rows already exist with 'chat' or default 'general'; we keep them.)
-- 3. Extend agents + agent_versions with per-agent override columns for:
--    chat model, voice-chat TTS/STT/voice_id, realtime TTS/STT/voice_id,
--    embedding model, system prompt override, temperature override,
--    max_tokens override. NULL on every column means "inherit org defaults".
--    This mirrors vendor/clara/clara-core/.../agent-ai-types.ts shape
--    minus the language/voice catalog (already covered by
--    agent_language_assignments + agent_voice_assignments).
-- 4. Extend the existing agent_ai_settings table (created by 0002/0007)
--    with the same column set, so deployments/versions can snapshot the
--    effective agent config without joining agents.
-- Idempotent. Forward-only. Safe to re-run on existing rows.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. organization_ai_runtime_settings extensions
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE organization_ai_runtime_settings
  ADD COLUMN IF NOT EXISTS voice_chat_provider text
    CHECK (voice_chat_provider IS NULL OR voice_chat_provider IN ('openai','gemini','sarvam','elevenlabs')),
  ADD COLUMN IF NOT EXISTS voice_chat_tts_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_stt_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_voice_id text,
  -- Realtime surface (Mode B — OpenAI Realtime / Gemini Live / ElevenLabs Mode B).
  -- The existing realtime_voice_provider / realtime_voice_model / voice_id
  -- columns remain authoritative for Mode B; we add separate realtime_*
  -- STT/TTS columns so an org can pin a different STT/TTS pair for the
  -- realtime path than for the pipeline voice-chat path.
  ADD COLUMN IF NOT EXISTS realtime_stt_model text,
  ADD COLUMN IF NOT EXISTS realtime_tts_model text,
  -- Embeddings (RAG backbone). The local Clara runtime stubbed these to
  -- throw; once enabled they are picked up by claraRuntime.embedText.
  ADD COLUMN IF NOT EXISTS embedding_provider text
    CHECK (embedding_provider IS NULL OR embedding_provider IN ('openai','gemini','tei')),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimension integer CHECK (embedding_dimension IS NULL OR (embedding_dimension > 0 AND embedding_dimension <= 4096));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ai_provider_configs.purpose — extend CHECK constraint
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  existing_constraint_name text;
BEGIN
  SELECT conname INTO existing_constraint_name
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid = 'organization_ai_runtime_settings'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%purpose%';
  -- No constraint to drop on organization_ai_runtime_settings (we just added
  -- columns above); the ai_provider_configs.purpose constraint lives on a
  -- different table. This block is here for clarity / future-proofing.
END $$;

-- Drop the legacy ai_provider_configs_org_provider_purpose_uniq + the purpose
-- CHECK (if it exists) so we can recreate with the extended domain. Both are
-- idempotent: IF NOT EXISTS on the ADD side, IF EXISTS on the DROP side.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conname = 'ai_provider_configs_purpose_check'
  ) THEN
    ALTER TABLE ai_provider_configs DROP CONSTRAINT ai_provider_configs_purpose_check;
  END IF;
END $$;

ALTER TABLE ai_provider_configs
  ADD CONSTRAINT ai_provider_configs_purpose_check
  CHECK (purpose IN ('chat','tts','stt','realtime','embedding','general'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Per-agent overrides on agents + agent_versions
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS chat_provider text
    CHECK (chat_provider IS NULL OR chat_provider IN ('openai','gemini','sarvam')),
  ADD COLUMN IF NOT EXISTS chat_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_provider text
    CHECK (voice_chat_provider IS NULL OR voice_chat_provider IN ('openai','gemini','sarvam','elevenlabs')),
  ADD COLUMN IF NOT EXISTS voice_chat_tts_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_stt_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_voice_id text,
  ADD COLUMN IF NOT EXISTS realtime_voice_provider_override text
    CHECK (realtime_voice_provider_override IS NULL OR realtime_voice_provider_override IN ('openai','gemini','sarvam','elevenlabs')),
  ADD COLUMN IF NOT EXISTS realtime_stt_model text,
  ADD COLUMN IF NOT EXISTS realtime_tts_model text,
  ADD COLUMN IF NOT EXISTS realtime_voice_id_override text,
  ADD COLUMN IF NOT EXISTS embedding_provider text
    CHECK (embedding_provider IS NULL OR embedding_provider IN ('openai','gemini','tei')),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimension integer CHECK (embedding_dimension IS NULL OR (embedding_dimension > 0 AND embedding_dimension <= 4096)),
  ADD COLUMN IF NOT EXISTS system_prompt_override text,
  ADD COLUMN IF NOT EXISTS temperature_override numeric(4,3) CHECK (temperature_override IS NULL OR (temperature_override >= 0 AND temperature_override <= 2)),
  ADD COLUMN IF NOT EXISTS max_tokens_override integer CHECK (max_tokens_override IS NULL OR (max_tokens_override > 0 AND max_tokens_override <= 32768));

ALTER TABLE agent_versions
  ADD COLUMN IF NOT EXISTS chat_provider text,
  ADD COLUMN IF NOT EXISTS chat_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_provider text,
  ADD COLUMN IF NOT EXISTS voice_chat_tts_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_stt_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_voice_id text,
  ADD COLUMN IF NOT EXISTS realtime_voice_provider_override text,
  ADD COLUMN IF NOT EXISTS realtime_stt_model text,
  ADD COLUMN IF NOT EXISTS realtime_tts_model text,
  ADD COLUMN IF NOT EXISTS realtime_voice_id_override text,
  ADD COLUMN IF NOT EXISTS embedding_provider text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimension integer,
  ADD COLUMN IF NOT EXISTS system_prompt_override text,
  ADD COLUMN IF NOT EXISTS temperature_override numeric(4,3),
  ADD COLUMN IF NOT EXISTS max_tokens_override integer;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. agent_ai_settings extensions — mirror agents columns so a deployment
--    snapshot can store the effective config without joining agents.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE agent_ai_settings
  ADD COLUMN IF NOT EXISTS chat_provider text,
  ADD COLUMN IF NOT EXISTS chat_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_provider text,
  ADD COLUMN IF NOT EXISTS voice_chat_tts_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_stt_model text,
  ADD COLUMN IF NOT EXISTS voice_chat_voice_id text,
  ADD COLUMN IF NOT EXISTS realtime_voice_provider_override text,
  ADD COLUMN IF NOT EXISTS realtime_stt_model text,
  ADD COLUMN IF NOT EXISTS realtime_tts_model text,
  ADD COLUMN IF NOT EXISTS realtime_voice_id_override text,
  ADD COLUMN IF NOT EXISTS embedding_provider text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimension integer,
  ADD COLUMN IF NOT EXISTS system_prompt_override text,
  ADD COLUMN IF NOT EXISTS temperature_override numeric(4,3),
  ADD COLUMN IF NOT EXISTS max_tokens_override integer;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Helpful index for per-agent lookups
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ai_provider_configs_org_purpose_idx
  ON ai_provider_configs (organization_id, purpose, enabled);
