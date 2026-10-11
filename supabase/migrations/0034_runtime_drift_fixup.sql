-- 0034 — Runtime drift fixup
-- Reconciles columns the runtime repository contracts expect but that were
-- not added by earlier CREATE TABLE IF NOT EXISTS migrations (because the
-- tables already existed from a prior legacy migration with fewer columns).
--
-- This migration is forward-only and idempotent (uses ADD COLUMN IF NOT EXISTS).
-- Apply on a database that already has migrations 0000–0033 applied.

-- whatsapp_accounts: app code references provider/phone_number/business_account_id
ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS business_account_id text,
  ADD COLUMN IF NOT EXISTS credential_key_reference text;

-- ai_provider_configs: app code references purpose (UNIQUE(organization_id,provider,purpose))
ALTER TABLE ai_provider_configs
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'general';

-- Drop and recreate the uniqueness constraint to include purpose, if not already.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_provider_configs_org_provider_purpose_uniq'
  ) THEN
    ALTER TABLE ai_provider_configs
      ADD CONSTRAINT ai_provider_configs_org_provider_purpose_uniq
      UNIQUE (organization_id, provider, purpose);
  END IF;
END $$;

-- audit_events: app repository expects provider column (legacy audit_events never
-- had it; new installations created the table without it).
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS provider text;

-- email_accounts: app repository expects connection_type (the legacy table only
-- has connection_config jsonb).
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS connection_type text;

-- Convenience index for the ai_provider_configs uniqueness lookup.
CREATE INDEX IF NOT EXISTS ai_provider_configs_org_provider_purpose_idx
  ON ai_provider_configs(organization_id, provider, purpose);
