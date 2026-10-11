-- 0040 — Per-agent voice configuration
-- Each agent can have its own voice provider, model, and voice_id,
-- separate from the global organization_ai_runtime_settings.
-- The voice session route reads from the agent first, falling back to
-- org settings when agent-level voice config is not set.
-- Idempotent. Forward-only.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_model text,
  ADD COLUMN IF NOT EXISTS voice_id text;

-- Also add voice config to agent_versions so different versions can
-- have different voice configs (useful for A/B testing voice models).
ALTER TABLE agent_versions
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_model text,
  ADD COLUMN IF NOT EXISTS voice_id text;
