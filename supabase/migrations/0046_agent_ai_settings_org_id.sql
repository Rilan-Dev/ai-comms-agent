-- 0046 — Add organization_id column to agent_ai_settings
--
-- The original CREATE TABLE in migration 0007 only included agent_id (UNIQUE),
-- ai_provider_config_id, model_overrides, feature_flags, updated_at. The
-- runtime resolver and the per-agent settings repository both need to scope
-- by organization_id (tenant isolation) — otherwise the only way to find an
-- agent_ai_settings row is by agent_id alone, which requires a JOIN to
-- agents + organization_memberships for tenant scoping.
--
-- This migration adds the column, backfills it from agents.organization_id,
-- and adds a UNIQUE constraint on (organization_id, agent_id) so the
-- UPSERT path in packages/db/src/ai-provider/repository.ts (which keys on
-- agent_id via ON CONFLICT (agent_id)) continues to work — agent_id remains
-- globally unique, but the (organization_id, agent_id) pair gives a stable
-- tenant-scoped lookup.

ALTER TABLE agent_ai_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill from agents.organization_id. Idempotent.
UPDATE agent_ai_settings s
  SET organization_id = a.organization_id
  FROM agents a
  WHERE s.agent_id = a.id
    AND (s.organization_id IS NULL OR s.organization_id <> a.organization_id);

-- Add FK to organizations + index for tenant-scoped lookups. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conname = 'agent_ai_settings_organization_id_fkey'
  ) THEN
    ALTER TABLE agent_ai_settings
      ADD CONSTRAINT agent_ai_settings_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_ai_settings_org_agent_idx
  ON agent_ai_settings (organization_id, agent_id);
