-- Organization-scoped Gmail OAuth client registrations.
-- Client secrets are encrypted by the application before persistence; plaintext
-- is returned only to the OAuth token exchange, never to browser responses.

CREATE TABLE IF NOT EXISTS gmail_oauth_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  client_id text NOT NULL,
  client_secret_ciphertext bytea NOT NULL,
  redirect_uri text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gmail_oauth_configs_org_enabled_idx
  ON gmail_oauth_configs(organization_id, enabled, created_at DESC);
