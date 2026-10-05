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
DO $$ BEGIN CREATE TYPE email_provider AS ENUM ('gmail','imap_smtp','zoho'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_account_status AS ENUM ('active','expired','revoked','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE credential_type AS ENUM ('oauth_token','password','app_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_folder_role AS ENUM ('inbox','sent','drafts','trash','spam','archive','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_label_type AS ENUM ('system','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE embedding_status AS ENUM ('pending','indexed','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_event_type AS ENUM ('started','completed','failed','token_refreshed','partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_status AS ENUM ('active','pending_verification','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('inbound','outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_message_status AS ENUM ('queued','sent','delivered','read','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_channel AS ENUM ('chat','whatsapp','voice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('active','ended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_role AS ENUM ('user','assistant','system','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scheduled_job_status AS ENUM ('active','paused','archived','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text,
  encrypted_api_key bytea,
  model_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_provider_configs_org_idx ON ai_provider_configs(organization_id, enabled);

CREATE TABLE IF NOT EXISTS agent_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  ai_provider_config_id uuid REFERENCES ai_provider_configs(id) ON DELETE SET NULL,
  model_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Email
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider email_provider NOT NULL,
  email_address citext NOT NULL,
  display_name text,
  connection_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  status email_account_status NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_org_address_uniq ON email_accounts(organization_id, email_address);
CREATE INDEX IF NOT EXISTS email_accounts_org_status_idx ON email_accounts(organization_id, status);

CREATE TABLE IF NOT EXISTS email_account_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  credential_type credential_type NOT NULL,
  encrypted_payload bytea NOT NULL,
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_folder_id text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
  role email_folder_role NOT NULL DEFAULT 'custom',
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_synced_at timestamptz,
  UNIQUE(email_account_id, provider_folder_id)
);
CREATE INDEX IF NOT EXISTS email_folders_account_idx ON email_folders(email_account_id);

CREATE TABLE IF NOT EXISTS email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_label_id text NOT NULL,
  name text NOT NULL,
  color text,
  label_type email_label_type NOT NULL DEFAULT 'user',
  UNIQUE(email_account_id, provider_label_id)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_thread_id text,
  subject text NOT NULL DEFAULT '',
  snippet text,
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  is_unread boolean NOT NULL DEFAULT false,
  importance_score real CHECK (importance_score IS NULL OR importance_score BETWEEN 0 AND 1),
  action_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_threads_provider_uniq ON email_threads(email_account_id, provider_thread_id) WHERE provider_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_threads_account_last_message_idx ON email_threads(email_account_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
  provider_message_id text,
  message_id_header text,
  in_reply_to text,
  "references" text[],
  from_address citext NOT NULL,
  to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL DEFAULT '',
  text_body text,
  html_body text,
  snippet text,
  received_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  is_outbound boolean NOT NULL DEFAULT false,
  importance_score real CHECK (importance_score IS NULL OR importance_score BETWEEN 0 AND 1),
  has_attachments boolean NOT NULL DEFAULT false,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(text_body,''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_provider_id_uniq ON email_messages(email_account_id, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_header_uniq ON email_messages(email_account_id, message_id_header) WHERE message_id_header IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_messages_account_received_idx ON email_messages(email_account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_thread_received_idx ON email_messages(thread_id, received_at);
CREATE INDEX IF NOT EXISTS email_messages_search_tsv_idx ON email_messages USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS email_messages_importance_idx ON email_messages(importance_score DESC) WHERE importance_score IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_url text,
  content_hash text,
  virus_scan_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_attachments_message_idx ON email_attachments(email_message_id);
CREATE INDEX IF NOT EXISTS email_attachments_hash_idx ON email_attachments(content_hash) WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_sync_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  history_token text,
  last_sync_at timestamptz,
  last_full_sync_at timestamptz,
  sync_mode text NOT NULL DEFAULT 'initial',
  error_state jsonb
);

CREATE TABLE IF NOT EXISTS email_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_type sync_event_type NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS email_sync_events_account_started_idx ON email_sync_events(email_account_id, started_at DESC);

ALTER TABLE agent_email_accounts DROP CONSTRAINT IF EXISTS agent_email_accounts_account_fk;
ALTER TABLE agent_email_accounts ADD CONSTRAINT agent_email_accounts_account_fk FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL UNIQUE,
  display_name text,
  waba_id text NOT NULL,
  verify_token text,
  encrypted_credentials bytea NOT NULL,
  status whatsapp_status NOT NULL DEFAULT 'pending_verification',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_org_status_idx ON whatsapp_accounts(organization_id, status);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  display_name text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(whatsapp_account_id, phone_number)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  provider_message_id text NOT NULL UNIQUE,
  body text,
  media jsonb NOT NULL DEFAULT '{}'::jsonb,
  status whatsapp_message_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_account_created_idx ON whatsapp_messages(whatsapp_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_contact_created_idx ON whatsapp_messages(contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_account_received_idx ON whatsapp_webhook_events(whatsapp_account_id, received_at DESC);

ALTER TABLE agent_whatsapp_accounts DROP CONSTRAINT IF EXISTS agent_whatsapp_accounts_account_fk;
ALTER TABLE agent_whatsapp_accounts ADD CONSTRAINT agent_whatsapp_accounts_account_fk FOREIGN KEY (whatsapp_account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name FROM (VALUES
    ('agents'),('agent_ai_settings'),('email_accounts'),
    ('email_account_credentials'),('email_threads'),('email_messages'),
    ('whatsapp_accounts')
  ) AS t(table_name)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', r.table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', r.table_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Organization authorization wrappers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_active_organization_member(
    p_organization_id,
    NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_active_organization_admin_or_owner(
    p_organization_id,
    NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;

REVOKE EXECUTE ON FUNCTION can_access_organization(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION can_manage_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_organization(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS for tables created by this migration
-- ---------------------------------------------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name FROM (VALUES
    ('agents'),('agent_versions'),('agent_deployments'),('agent_email_accounts'),
    ('agent_whatsapp_accounts'),('ai_provider_configs'),('agent_ai_settings'),
    ('email_accounts'),('email_account_credentials'),('email_folders'),('email_labels'),
    ('email_threads'),('email_messages'),('email_attachments'),('email_sync_states'),
    ('email_sync_events'),('whatsapp_accounts'),('whatsapp_contacts'),
    ('whatsapp_messages'),('whatsapp_webhook_events')
  ) AS t(table_name)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
  END LOOP;
END $$;

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

CREATE POLICY agent_ai_settings_org_member ON agent_ai_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_ai_settings.agent_id AND can_access_organization(a.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=agent_ai_settings.agent_id AND can_manage_organization(a.organization_id)));

CREATE POLICY email_accounts_org_member ON email_accounts FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY email_account_credentials_org_member ON email_account_credentials FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_account_credentials.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_account_credentials.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_folders_org_member ON email_folders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_folders.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_folders.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_labels_org_member ON email_labels FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_labels.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_labels.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_threads_org_member ON email_threads FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_threads.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_threads.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_messages_org_member ON email_messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_messages.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_messages.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_attachments_org_member ON email_attachments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id=m.email_account_id WHERE m.id=email_attachments.email_message_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id=m.email_account_id WHERE m.id=email_attachments.email_message_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_sync_states_org_member ON email_sync_states FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_states.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_states.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY email_sync_events_org_member ON email_sync_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_events.email_account_id AND can_access_organization(e.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_events.email_account_id AND can_manage_organization(e.organization_id)));

CREATE POLICY whatsapp_accounts_org_member ON whatsapp_accounts FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY whatsapp_contacts_org_member ON whatsapp_contacts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_contacts.whatsapp_account_id AND can_access_organization(w.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_contacts.whatsapp_account_id AND can_manage_organization(w.organization_id)));

CREATE POLICY whatsapp_messages_org_member ON whatsapp_messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_messages.whatsapp_account_id AND can_access_organization(w.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_messages.whatsapp_account_id AND can_manage_organization(w.organization_id)));

CREATE POLICY whatsapp_webhook_events_org_member ON whatsapp_webhook_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_webhook_events.whatsapp_account_id AND can_access_organization(w.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id=whatsapp_webhook_events.whatsapp_account_id AND can_manage_organization(w.organization_id)));

-- ---------------------------------------------------------------------------
-- Default reference permission catalogue remains Phase 3-only.
-- ---------------------------------------------------------------------------
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

-- Migration-level schema sanity checks.
DO $$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'agents','agent_versions','agent_deployments','agent_email_accounts',
    'agent_whatsapp_accounts','ai_provider_configs','agent_ai_settings',
    'email_accounts','email_account_credentials','email_folders','email_labels',
    'email_threads','email_messages','email_attachments','email_sync_states',
    'email_sync_events','whatsapp_accounts','whatsapp_contacts',
    'whatsapp_messages','whatsapp_webhook_events'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Phase 4 foundation schema missing required table: %', required_table;
    END IF;
  END LOOP;
END $$;
