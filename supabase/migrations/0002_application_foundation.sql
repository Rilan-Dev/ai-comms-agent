-- Phase 4: application database foundation.
-- PostgreSQL-native. No Supabase-specific runtime or SQL API is required.
-- Forward-only migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $phase4$ BEGIN CREATE TYPE deployment_environment AS ENUM ('production','preview'); EXCEPTION WHEN duplicate_object THEN NULL; END $phase4$;
DO $phase4$ BEGIN CREATE TYPE agent_version_status AS ENUM ('draft','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $phase4$;
DO $phase4$ BEGIN CREATE TYPE agent_deployment_status AS ENUM ('pending','active','paused','failed','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $phase4$;
DO $$ BEGIN CREATE TYPE email_account_provider AS ENUM ('gmail','imap_smtp','zoho'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_account_status AS ENUM ('active','expired','revoked','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_credential_type AS ENUM ('oauth_token','password','app_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_folder_role AS ENUM ('inbox','sent','drafts','trash','spam','archive','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE embedding_status AS ENUM ('pending','indexed','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE virus_scan_status AS ENUM ('pending','clean','infected','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_mode AS ENUM ('initial','incremental'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_status AS ENUM ('active','pending_verification','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_direction AS ENUM ('inbound','outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_message_status AS ENUM ('queued','sent','delivered','read','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_channel AS ENUM ('chat','whatsapp','voice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_role AS ENUM ('user','assistant','system','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('active','completed','cancelled','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scheduled_status AS ENUM ('active','paused','archived','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_status AS ENUM ('success','failed','skipped','in_progress'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_action_status AS ENUM ('pending_approval','approved','executing','completed','rejected','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_decision AS ENUM ('approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE summary_scope AS ENUM ('daily','custom','on_demand'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_operation AS ENUM ('chat','embedding','voice_session','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE voice_session_status AS ENUM ('active','ended','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE voice_stage AS ENUM ('tfa','ttft','ttfa','total'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE actor_type AS ENUM ('user','agent','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  hashed_key text NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  status agent_status NOT NULL DEFAULT 'draft',
  system_prompt text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_version_id uuid,
  current_deployment_id uuid,
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

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
  diff_from_previous jsonb,
  UNIQUE (agent_id, version_number)
);

DO $$ BEGIN
  ALTER TABLE agents
    ADD CONSTRAINT agents_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES agent_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES agent_versions(id) ON DELETE RESTRICT,
  status agent_deployment_status NOT NULL DEFAULT 'pending',
  environment deployment_environment NOT NULL,
  deployed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

DO $$ BEGIN
  ALTER TABLE agents
    ADD CONSTRAINT agents_current_deployment_fk
    FOREIGN KEY (current_deployment_id) REFERENCES agent_deployments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider email_account_provider NOT NULL,
  email_address citext NOT NULL,
  display_name text,
  connection_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  status email_account_status NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email_address)
);

CREATE TABLE IF NOT EXISTS email_account_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  credential_type email_credential_type NOT NULL,
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
  UNIQUE (email_account_id, provider_folder_id)
);

CREATE TABLE IF NOT EXISTS email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_label_id text NOT NULL,
  name text NOT NULL,
  color text,
  label_type text NOT NULL DEFAULT 'user',
  UNIQUE (email_account_id, provider_label_id)
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, provider_thread_id)
);

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
  received_at timestamptz NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  is_outbound boolean NOT NULL DEFAULT false,
  importance_score real NOT NULL DEFAULT 0 CHECK (importance_score BETWEEN 0 AND 1),
  has_attachments boolean NOT NULL DEFAULT false,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(text_body,''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, provider_message_id)
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  storage_url text,
  content_hash text,
  virus_scan_status virus_scan_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sync_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  history_token text,
  last_sync_at timestamptz,
  last_full_sync_at timestamptz,
  sync_mode sync_mode NOT NULL DEFAULT 'initial',
  error_state jsonb
);

CREATE TABLE IF NOT EXISTS email_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text
);

CREATE TABLE IF NOT EXISTS agent_email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','read_only','send_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, email_account_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL UNIQUE,
  display_name text,
  waba_id text NOT NULL,
  verify_token text NOT NULL,
  encrypted_credentials bytea,
  status whatsapp_status NOT NULL DEFAULT 'pending_verification',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  display_name text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (whatsapp_account_id, phone_number)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  direction whatsapp_direction NOT NULL,
  provider_message_id text UNIQUE,
  body text,
  media jsonb NOT NULL DEFAULT '{}'::jsonb,
  status whatsapp_message_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);

CREATE TABLE IF NOT EXISTS agent_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  ai_provider_config_id uuid,
  model_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel conversation_channel NOT NULL,
  subject text,
  status conversation_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role conversation_role NOT NULL,
  content text,
  content_json jsonb,
  parent_message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
  tool_call_id text,
  tool_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  intent text,
  status text NOT NULL DEFAULT 'in_progress',
  token_usage jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  cron text,
  one_fire_at timestamptz,
  intent text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_fire_at timestamptz,
  last_fire_at timestamptz,
  status scheduled_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cron IS NOT NULL OR one_fire_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_job_id uuid NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  fire_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status run_status NOT NULL DEFAULT 'in_progress',
  error text,
  result jsonb,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger jsonb NOT NULL,
  action jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  trigger_event jsonb NOT NULL,
  status run_status NOT NULL DEFAULT 'in_progress',
  result jsonb,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_message_ids uuid[] NOT NULL DEFAULT '{}',
  draft_id uuid,
  status email_action_status NOT NULL DEFAULT 'pending_approval',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  executed_at timestamptz,
  error text,
  audit_event_id uuid
);

CREATE TABLE IF NOT EXISTS email_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_action_id uuid NOT NULL REFERENCES email_actions(id) ON DELETE CASCADE,
  decision approval_decision NOT NULL,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  scope summary_scope NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  content text NOT NULL,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  token_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS summary_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  email_message_id uuid REFERENCES email_messages(id) ON DELETE SET NULL,
  whatsapp_message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  weight real
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

DO $$ BEGIN
  ALTER TABLE agent_ai_settings
    ADD CONSTRAINT agent_ai_settings_provider_fk
    FOREIGN KEY (ai_provider_config_id) REFERENCES ai_provider_configs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text,
  operation ai_operation NOT NULL,
  input_tokens bigint,
  output_tokens bigint,
  voice_seconds real,
  cost_usd numeric(18,8),
  latency_ms integer,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_session_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds real,
  status voice_session_status NOT NULL DEFAULT 'active',
  turn_count integer NOT NULL DEFAULT 0,
  connection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS voice_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id uuid NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  turn_id text NOT NULL,
  stage voice_stage NOT NULL,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type actor_type NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant indexes.
CREATE INDEX IF NOT EXISTS agents_org_idx ON agents(organization_id);
CREATE INDEX IF NOT EXISTS email_accounts_org_idx ON email_accounts(organization_id);
CREATE INDEX IF NOT EXISTS email_messages_account_received_idx ON email_messages(email_account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_thread_received_idx ON email_messages(thread_id, received_at);
CREATE INDEX IF NOT EXISTS email_messages_search_tsv_idx ON email_messages USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS email_messages_importance_idx ON email_messages(importance_score DESC);
CREATE INDEX IF NOT EXISTS conversations_org_idx ON conversations(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx ON scheduled_jobs(status, next_fire_at);
CREATE INDEX IF NOT EXISTS ai_usage_org_idx ON ai_usage_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_agent_idx ON ai_usage_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_sessions_org_idx ON voice_sessions(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_org_idx ON audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_type_idx ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS audit_events_correlation_idx ON audit_events(correlation_id);

-- Generic updated_at triggers.
DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS email_accounts_updated_at ON email_accounts;
CREATE TRIGGER email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS email_threads_updated_at ON email_threads;
CREATE TRIGGER email_threads_updated_at BEFORE UPDATE ON email_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS email_messages_updated_at ON email_messages;
CREATE TRIGGER email_messages_updated_at BEFORE UPDATE ON email_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS whatsapp_accounts_updated_at ON whatsapp_accounts;
CREATE TRIGGER whatsapp_accounts_updated_at BEFORE UPDATE ON whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS automation_rules_updated_at ON automation_rules;
CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS ai_provider_configs_updated_at ON ai_provider_configs;
CREATE TRIGGER ai_provider_configs_updated_at BEFORE UPDATE ON ai_provider_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS agent_ai_settings_updated_at ON agent_ai_settings;
CREATE TRIGGER agent_ai_settings_updated_at BEFORE UPDATE ON agent_ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tenant RLS helper. The API sets app.organization_id inside a transaction/request.
CREATE OR REPLACE FUNCTION current_app_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
BEGIN
  raw := current_setting('app.organization_id', true);
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  RETURN raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION tenant_access(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_organization_id IS NOT NULL
     AND p_organization_id = current_app_organization_id()
     AND private.is_active_organization_member(p_organization_id, current_setting('app.user_id', true)::uuid);
$$;

-- Tenant tables use the same fail-closed policy for SELECT/INSERT/UPDATE/DELETE.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'api_keys','agents','agent_policies','email_accounts','whatsapp_accounts','conversations',
    'scheduled_jobs','ai_provider_configs','ai_usage_events','voice_sessions','audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_access ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_tenant_access ON %I FOR ALL USING (tenant_access(organization_id)) WITH CHECK (tenant_access(organization_id))',
      table_name, table_name
    );
  END LOOP;
END $$;

ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_versions_tenant_access ON agent_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_versions.agent_id AND tenant_access(a.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_versions.agent_id AND tenant_access(a.organization_id))
  );

ALTER TABLE agent_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_deployments_tenant_access ON agent_deployments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_deployments.agent_id AND tenant_access(a.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_deployments.agent_id AND tenant_access(a.organization_id))
  );

ALTER TABLE agent_email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_email_accounts_tenant_access ON agent_email_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_email_accounts.agent_id AND tenant_access(a.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_email_accounts.agent_id AND tenant_access(a.organization_id))
  );

ALTER TABLE agent_whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_whatsapp_accounts_tenant_access ON agent_whatsapp_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_whatsapp_accounts.agent_id AND tenant_access(a.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_whatsapp_accounts.agent_id AND tenant_access(a.organization_id))
  );

ALTER TABLE agent_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_ai_settings_tenant_access ON agent_ai_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_ai_settings.agent_id AND tenant_access(a.organization_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_ai_settings.agent_id AND tenant_access(a.organization_id))
  );

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'email_account_credentials','email_folders','email_labels','email_threads',
    'email_messages','email_attachments','email_sync_states','email_sync_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY email_credentials_tenant_access ON email_account_credentials
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_account_credentials.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_account_credentials.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_folders_tenant_access ON email_folders
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_folders.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_folders.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_labels_tenant_access ON email_labels
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_labels.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_labels.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_threads_tenant_access ON email_threads
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_threads.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_threads.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_messages_tenant_access ON email_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_messages.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_messages.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_attachments_tenant_access ON email_attachments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id=m.email_account_id
    WHERE m.id=email_attachments.email_message_id AND tenant_access(e.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id=m.email_account_id
    WHERE m.id=email_attachments.email_message_id AND tenant_access(e.organization_id)
  ));
CREATE POLICY email_sync_states_tenant_access ON email_sync_states
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_states.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_states.email_account_id AND tenant_access(e.organization_id)));
CREATE POLICY email_sync_events_tenant_access ON email_sync_events
  FOR ALL USING (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_events.email_account_id AND tenant_access(e.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM email_accounts e WHERE e.id=email_sync_events.email_account_id AND tenant_access(e.organization_id)));

ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_contacts_tenant_access ON whatsapp_contacts
  FOR ALL USING (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_contacts.whatsapp_account_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_contacts.whatsapp_account_id AND tenant_access(a.organization_id)));
CREATE POLICY whatsapp_messages_tenant_access ON whatsapp_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_messages.whatsapp_account_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_messages.whatsapp_account_id AND tenant_access(a.organization_id)));
CREATE POLICY whatsapp_webhook_events_tenant_access ON whatsapp_webhook_events
  FOR ALL USING (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_webhook_events.whatsapp_account_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.id=whatsapp_webhook_events.whatsapp_account_id AND tenant_access(a.organization_id)));

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_messages_tenant_access ON conversation_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_messages.conversation_id AND tenant_access(c.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_messages.conversation_id AND tenant_access(c.organization_id)));
CREATE POLICY conversation_turns_tenant_access ON conversation_turns
  FOR ALL USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_turns.conversation_id AND tenant_access(c.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_turns.conversation_id AND tenant_access(c.organization_id)));

ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_job_runs_tenant_access ON scheduled_job_runs
  FOR ALL USING (EXISTS (SELECT 1 FROM scheduled_jobs j WHERE j.id=scheduled_job_runs.scheduled_job_id AND tenant_access(j.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM scheduled_jobs j WHERE j.id=scheduled_job_runs.scheduled_job_id AND tenant_access(j.organization_id)));
CREATE POLICY automation_rules_tenant_access ON automation_rules
  FOR ALL USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=automation_rules.agent_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=automation_rules.agent_id AND tenant_access(a.organization_id)));
CREATE POLICY automation_runs_tenant_access ON automation_runs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM automation_rules r JOIN agents a ON a.id=r.agent_id
    WHERE r.id=automation_runs.automation_rule_id AND tenant_access(a.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM automation_rules r JOIN agents a ON a.id=r.agent_id
    WHERE r.id=automation_runs.automation_rule_id AND tenant_access(a.organization_id)
  ));

ALTER TABLE email_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_action_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_actions_tenant_access ON email_actions
  FOR ALL USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=email_actions.agent_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=email_actions.agent_id AND tenant_access(a.organization_id)));
CREATE POLICY email_action_approvals_tenant_access ON email_action_approvals
  FOR ALL USING (EXISTS (
    SELECT 1 FROM email_actions a JOIN agents ag ON ag.id=a.agent_id
    WHERE a.id=email_action_approvals.email_action_id AND tenant_access(ag.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_actions a JOIN agents ag ON ag.id=a.agent_id
    WHERE a.id=email_action_approvals.email_action_id AND tenant_access(ag.organization_id)
  ));

ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY summaries_tenant_access ON summaries
  FOR ALL USING (EXISTS (SELECT 1 FROM agents a WHERE a.id=summaries.agent_id AND tenant_access(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id=summaries.agent_id AND tenant_access(a.organization_id)));
CREATE POLICY summary_sources_tenant_access ON summary_sources
  FOR ALL USING (EXISTS (
    SELECT 1 FROM summaries s JOIN agents a ON a.id=s.agent_id
    WHERE s.id=summary_sources.summary_id AND tenant_access(a.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM summaries s JOIN agents a ON a.id=s.agent_id
    WHERE s.id=summary_sources.summary_id AND tenant_access(a.organization_id)
  ));

ALTER TABLE voice_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_telemetry_tenant_access ON voice_telemetry
  FOR ALL USING (EXISTS (SELECT 1 FROM voice_sessions v WHERE v.id=voice_telemetry.voice_session_id AND tenant_access(v.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM voice_sessions v WHERE v.id=voice_telemetry.voice_session_id AND tenant_access(v.organization_id)));

-- Audit is append-only.
DROP POLICY IF EXISTS audit_events_tenant_access ON audit_events;
CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT WITH CHECK (tenant_access(organization_id));
CREATE POLICY audit_events_read ON audit_events
  FOR SELECT USING (tenant_access(organization_id));

CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE='insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

-- One WhatsApp account per agent is enforced by the UNIQUE(agent_id) constraint
-- on agent_whatsapp_accounts.
