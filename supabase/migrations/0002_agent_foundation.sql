-- Phase 4: agent foundation.
-- Forward-only. PostgreSQL/Supabase authoritative.
-- Tenant access is enforced through the Phase 3 membership helpers.

DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_version_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_deployment_status AS ENUM ('pending', 'active', 'paused', 'failed', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  status agent_status NOT NULL DEFAULT 'draft',
  default_version_id uuid,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_org_slug_uniq
  ON agents (organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS agents_org_status_idx ON agents (organization_id, status);

CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status agent_version_status NOT NULL DEFAULT 'draft',
  system_prompt text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_summary text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (agent_id, version_number)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_status_idx
  ON agent_versions (agent_id, status);

ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS agents_default_version_fk;
ALTER TABLE agents
  ADD CONSTRAINT agents_default_version_fk
  FOREIGN KEY (default_version_id) REFERENCES agent_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id) ON DELETE RESTRICT,
  status agent_deployment_status NOT NULL DEFAULT 'pending',
  environment text NOT NULL DEFAULT 'production',
  deployed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deployed_at timestamptz,
  retired_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_deployments_active_env_uniq
  ON agent_deployments(agent_id, environment)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS agent_deployments_agent_idx
  ON agent_deployments(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  sync_enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, email_account_id)
);
CREATE INDEX IF NOT EXISTS agent_email_accounts_org_idx
  ON agent_email_accounts(organization_id);
CREATE INDEX IF NOT EXISTS agent_email_accounts_agent_idx
  ON agent_email_accounts(agent_id);

CREATE TABLE IF NOT EXISTS agent_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  whatsapp_account_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);
CREATE INDEX IF NOT EXISTS agent_whatsapp_accounts_org_idx
  ON agent_whatsapp_accounts(organization_id);

CREATE TABLE IF NOT EXISTS agent_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  chat_provider text,
  chat_model text,
  realtime_provider text,
  realtime_model text,
  voice_provider text,
  voice_id text,
  temperature numeric(3,2),
  max_output_tokens integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);
CREATE INDEX IF NOT EXISTS agent_ai_settings_org_idx
  ON agent_ai_settings(organization_id);

CREATE TABLE IF NOT EXISTS agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitive_actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_senders jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_senders jsonb NOT NULL DEFAULT '[]'::jsonb,
  rate_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);
CREATE INDEX IF NOT EXISTS agent_policies_org_idx ON agent_policies(organization_id);

CREATE OR REPLACE FUNCTION update_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
DROP TRIGGER IF EXISTS agent_email_accounts_updated_at ON agent_email_accounts;
CREATE TRIGGER agent_email_accounts_updated_at BEFORE UPDATE ON agent_email_accounts
FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
DROP TRIGGER IF EXISTS agent_whatsapp_accounts_updated_at ON agent_whatsapp_accounts;
CREATE TRIGGER agent_whatsapp_accounts_updated_at BEFORE UPDATE ON agent_whatsapp_accounts
FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
DROP TRIGGER IF EXISTS agent_ai_settings_updated_at ON agent_ai_settings;
CREATE TRIGGER agent_ai_settings_updated_at BEFORE UPDATE ON agent_ai_settings
FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
DROP TRIGGER IF EXISTS agent_policies_updated_at ON agent_policies;
CREATE TRIGGER agent_policies_updated_at BEFORE UPDATE ON agent_policies
FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();

-- Every tenant table has RLS. Policies use the SECURITY DEFINER membership
-- helpers from 0001 to avoid recursive membership-policy evaluation.
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_member_visibility ON agents
FOR SELECT TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())));

CREATE POLICY agents_member_write ON agents
FOR ALL TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())))
WITH CHECK (is_active_organization_member(organization_id, (select auth.uid())));

CREATE POLICY agent_versions_member_visibility ON agent_versions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_versions.agent_id
    AND is_active_organization_member(a.organization_id, (select auth.uid()))
));

CREATE POLICY agent_versions_member_write ON agent_versions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_versions.agent_id
    AND is_active_organization_member(a.organization_id, (select auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_versions.agent_id
    AND is_active_organization_member(a.organization_id, (select auth.uid()))
));

CREATE POLICY agent_deployments_member_visibility ON agent_deployments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_deployments.agent_id
    AND is_active_organization_member(a.organization_id, (select auth.uid()))
));

CREATE POLICY agent_deployments_admin_write ON agent_deployments
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_deployments.agent_id
    AND is_active_organization_admin_or_owner(a.organization_id, (select auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = agent_deployments.agent_id
    AND is_active_organization_admin_or_owner(a.organization_id, (select auth.uid()))
));

CREATE POLICY agent_email_accounts_member_visibility ON agent_email_accounts
FOR SELECT TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())));
CREATE POLICY agent_email_accounts_member_write ON agent_email_accounts
FOR ALL TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())))
WITH CHECK (is_active_organization_member(organization_id, (select auth.uid())));

CREATE POLICY agent_whatsapp_accounts_member_visibility ON agent_whatsapp_accounts
FOR SELECT TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())));
CREATE POLICY agent_whatsapp_accounts_member_write ON agent_whatsapp_accounts
FOR ALL TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())))
WITH CHECK (is_active_organization_member(organization_id, (select auth.uid())));

CREATE POLICY agent_ai_settings_member_visibility ON agent_ai_settings
FOR SELECT TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())));
CREATE POLICY agent_ai_settings_member_write ON agent_ai_settings
FOR ALL TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())))
WITH CHECK (is_active_organization_member(organization_id, (select auth.uid())));

CREATE POLICY agent_policies_admin_write ON agent_policies
FOR SELECT TO authenticated
USING (is_active_organization_member(organization_id, (select auth.uid())));
CREATE POLICY agent_policies_admin_manage ON agent_policies
FOR ALL TO authenticated
USING (is_active_organization_admin_or_owner(organization_id, (select auth.uid())))
WITH CHECK (is_active_organization_admin_or_owner(organization_id, (select auth.uid())));
