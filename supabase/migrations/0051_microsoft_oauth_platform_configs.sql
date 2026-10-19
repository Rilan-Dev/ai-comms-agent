-- Organization-scoped Microsoft Graph OAuth client registrations.
-- Microsoft client IDs, tenant IDs, and secrets are configured at runtime in
-- Platform Settings, never in per-deployment MICROSOFT_OAUTH_* variables.
-- The generic CREDENTIALS_MASTER_KEY remains the host encryption root.
CREATE TABLE IF NOT EXISTS microsoft_oauth_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  client_id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'common',
  client_secret_ciphertext bytea NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS microsoft_oauth_configs_org_enabled_idx
  ON microsoft_oauth_configs (organization_id, enabled, created_at DESC);
