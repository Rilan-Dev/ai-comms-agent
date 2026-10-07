-- Phase 4: Database Foundation
-- Canonical Phase 4 domain schema. This is migration 0002; legacy duplicate 0002 migrations were removed.
-- Forward-only production schema for the ai-comms-agent domain.
-- Phase 3 system roles remain TypeScript-authoritative; custom role tables stay deferred.
-- No provider secrets are stored in plaintext.
-- psql session directive belongs in the runner, not inside the SQL migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deployment_environment AS ENUM ('production','preview'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_email_account_role AS ENUM ('primary','read_only','send_only'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('active','ended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_role AS ENUM ('user','assistant','system','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scheduled_run_status AS ENUM ('success','failed','skipped','in_progress'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE action_status AS ENUM ('pending_approval','approved','executing','completed','rejected','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_decision AS ENUM ('approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE summary_scope AS ENUM ('daily','custom','on_demand'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_operation AS ENUM ('chat','embedding','voice_session','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE voice_status AS ENUM ('active','ended','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE voice_latency_stage AS ENUM ('tfa','ttft','ttfa','total'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE actor_type AS ENUM ('user','agent','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Generic updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  status agent_status NOT NULL DEFAULT 'draft',
  current_version_id uuid,
  current_deployment_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agents_org_slug_uniq ON agents(organization_id, slug) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS agents_org_status_idx ON agents(organization_id, status);
CREATE INDEX IF NOT EXISTS agents_created_by_idx ON agents(created_by);

CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  diff_from_previous jsonb,
  UNIQUE(agent_id, version_number)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_created_idx ON agent_versions(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES agent_versions(id) ON DELETE RESTRICT,
  environment deployment_environment NOT NULL,
  deployed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_deployments_agent_env_idx ON agent_deployments(agent_id, environment, deployed_at DESC);

ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_current_version_fk;
ALTER TABLE agents ADD CONSTRAINT agents_current_version_fk FOREIGN KEY (current_version_id) REFERENCES agent_versions(id) ON DELETE SET NULL;
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_current_deployment_fk;
ALTER TABLE agents ADD CONSTRAINT agents_current_deployment_fk FOREIGN KEY (current_deployment_id) REFERENCES agent_deployments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS agent_email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL,
  role agent_email_account_role NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, email_account_id)
);

CREATE TABLE IF NOT EXISTS agent_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name FROM (VALUES ('agents')) AS t(table_name)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', r.table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', r.table_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Organization authorization wrappers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.is_active_organization_member(
    p_organization_id,
    NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.is_active_organization_admin_or_owner(
    p_organization_id,
    NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;

REVOKE EXECUTE ON FUNCTION can_access_organization(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION can_manage_organization(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  GRANT EXECUTE ON FUNCTION can_access_organization(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION can_manage_organization(uuid) TO authenticated;
END $$;

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_org_member ON agents FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY agent_versions_org_member ON agent_versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_versions.agent_id AND can_access_organization(a.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_versions.agent_id AND can_manage_organization(a.organization_id)));

CREATE POLICY agent_deployments_org_member ON agent_deployments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_deployments.agent_id AND can_access_organization(a.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_deployments.agent_id AND can_manage_organization(a.organization_id)));

CREATE POLICY agent_email_accounts_org_member ON agent_email_accounts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_email_accounts.agent_id AND can_access_organization(a.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_email_accounts.agent_id AND can_manage_organization(a.organization_id)));

CREATE POLICY agent_whatsapp_accounts_org_member ON agent_whatsapp_accounts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_whatsapp_accounts.agent_id AND can_access_organization(a.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_whatsapp_accounts.agent_id AND can_manage_organization(a.organization_id)));

INSERT INTO permissions(name, description) VALUES
 ('organization.read','Read organization'),
 ('organization.update','Update organization'),
 ('organization.members.read','Read organization members'),
 ('organization.members.manage','Manage organization members'),
 ('users.read','Read users'),
 ('users.manage','Manage users'),
 ('audit.read','Read audit events'),
 ('settings.read','Read settings'),
 ('settings.manage','Manage settings')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'agents','agent_versions','agent_deployments','agent_email_accounts',
    'agent_whatsapp_accounts'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Phase 4 foundation schema missing required table: %', required_table;
    END IF;
  END LOOP;
END $$;
