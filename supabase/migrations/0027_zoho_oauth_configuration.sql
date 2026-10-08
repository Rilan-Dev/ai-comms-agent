-- Organization-scoped Zoho OAuth client registrations.
-- Secrets are encrypted by the application before persistence.
CREATE TABLE IF NOT EXISTS zoho_oauth_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  client_id text NOT NULL,
  client_secret_ciphertext bytea NOT NULL,
  data_center text NOT NULL DEFAULT 'in'
    CHECK (data_center IN ('us','eu','in','au','ca','jp','sa')),
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zoho_oauth_configs_org_enabled_idx
  ON zoho_oauth_configs(organization_id, enabled, created_at DESC);
