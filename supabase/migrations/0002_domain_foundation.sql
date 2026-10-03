-- Phase 4: Database Foundation and Domain Schema
-- Forward-only application schema for the communications agent platform.
-- Production Supabase provisioning remains a deployment operation, not a migration test.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deployment_status AS ENUM ('draft','active','paused','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_account_status AS ENUM ('active','expired','revoked','error','disconnected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_folder_role AS ENUM ('inbox','sent','drafts','trash','spam','archive','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_mode AS ENUM ('initial','incremental'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_event_status AS ENUM ('queued','running','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE embedding_status AS ENUM ('pending','indexed','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_account_status AS ENUM ('active','pending','disabled','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('inbound','outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('queued','running','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status AS ENUM ('pending','approved','rejected','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Agents / versions / deployments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status agent_status NOT NULL DEFAULT 'draft',
  default_timezone text NOT NULL DEFAULT 'UTC',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS agents_org_idx ON agents(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_idx ON agent_versions(agent_id, version DESC);

CREATE TABLE IF NOT EXISTS agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id) ON DELETE RESTRICT,
  status deployment_status NOT NULL DEFAULT 'draft',
  deployed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, agent_version_id)
);

-- ---------------------------------------------------------------------------
-- Email accounts / credentials / mailbox model
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail','imap_smtp','zoho')),
  email_address citext NOT NULL,
  display_name text,
  status email_account_status NOT NULL DEFAULT 'disconnected',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_org_address_uniq
  ON email_accounts(organization_id, email_address) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS email_accounts_org_idx ON email_accounts(organization_id);

CREATE TABLE IF NOT EXISTS email_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('oauth_token','password','app_password')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  password_ciphertext text,
  encryption_key_id text,
  scopes text[] NOT NULL DEFAULT '{}',
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
  label_type text NOT NULL DEFAULT 'user' CHECK (label_type IN ('system','user')),
  UNIQUE(email_account_id, provider_label_id)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_thread_id text,
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  is_unread boolean NOT NULL DEFAULT false,
  importance_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (importance_score BETWEEN 0 AND 1),
  action_required boolean NOT NULL DEFAULT false,
  UNIQUE(email_account_id, provider_thread_id)
);
CREATE INDEX IF NOT EXISTS email_threads_account_time_idx ON email_threads(email_account_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
  provider_message_id text,
  message_id_header text NOT NULL,
  in_reply_to text,
  references_header text[] NOT NULL DEFAULT '{}',
  from_address citext NOT NULL,
  to_addresses citext[] NOT NULL DEFAULT '{}',
  cc_addresses citext[] NOT NULL DEFAULT '{}',
  bcc_addresses citext[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  html_body text,
  snippet text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  direction message_direction NOT NULL DEFAULT 'inbound',
  importance_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (importance_score BETWEEN 0 AND 1),
  action_required boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx ON email_messages(thread_id, received_at);
CREATE INDEX IF NOT EXISTS email_messages_account_received_idx ON email_messages(email_account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_action_idx ON email_messages(email_account_id, action_required, received_at DESC);

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_key text,
  provider_attachment_id text,
  sha256 text,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','blocked','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sync_states (
  email_account_id uuid PRIMARY KEY REFERENCES email_accounts(id) ON DELETE CASCADE,
  cursor text,
  history_token text,
  mode sync_mode NOT NULL DEFAULT 'initial',
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  next_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL,
  status sync_event_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(email_account_id, provider_event_id)
);

CREATE TABLE IF NOT EXISTS agent_email_accounts (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(agent_id, email_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_email_accounts_one_primary
  ON agent_email_accounts(agent_id) WHERE is_primary;

-- ---------------------------------------------------------------------------
-- WhatsApp — exactly one account/phone per agent is enforced by partial unique
-- index. Provider credentials remain encrypted/opaque to the application UI.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta_cloud_api',
  phone_number_e164 text NOT NULL,
  display_name text,
  business_account_id text,
  phone_number_id text NOT NULL,
  access_token_ciphertext text,
  encryption_key_id text,
  status whatsapp_account_status NOT NULL DEFAULT 'pending',
  webhook_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, phone_number_id)
);

CREATE TABLE IF NOT EXISTS agent_whatsapp_accounts (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  phone_number_e164 text NOT NULL,
  display_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(whatsapp_account_id, phone_number_e164)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  provider_message_id text,
  direction message_direction NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  text_body text,
  media_storage_key text,
  provider_timestamp timestamptz,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(whatsapp_account_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_account_time_idx ON whatsapp_messages(whatsapp_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_account_id uuid REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_event_id)
);

-- ---------------------------------------------------------------------------
-- Agent policies, tools, conversations, approvals, schedules, summaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_policies (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_requires_approval boolean NOT NULL DEFAULT true,
  forward_requires_approval boolean NOT NULL DEFAULT true,
  delete_requires_approval boolean NOT NULL DEFAULT true,
  bulk_action_requires_approval boolean NOT NULL DEFAULT true,
  auto_draft_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, name)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('chat','whatsapp','voice')),
  external_contact_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS conversations_agent_time_idx ON conversations(agent_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content text NOT NULL,
  tool_name text,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  email_account_id uuid REFERENCES email_accounts(id) ON DELETE SET NULL,
  message_id uuid REFERENCES email_messages(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('create_draft','reply','forward','send','delete','archive','move','mark_read','mark_unread','bulk')),
  status approval_status NOT NULL DEFAULT 'pending',
  requested_by text NOT NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_actions_agent_status_idx ON email_actions(agent_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  cron_expression text,
  timezone text NOT NULL DEFAULT 'UTC',
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx ON scheduled_jobs(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_job_id uuid NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  summary_type text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  content text NOT NULL,
  source_ids uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS summaries_agent_period_idx ON summaries(agent_id, period_end DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  outcome text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_time_idx ON audit_events(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- AI / voice telemetry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_ciphertext text,
  encryption_key_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text,
  modality text NOT NULL DEFAULT 'text',
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  duration_ms integer,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_org_time_idx ON ai_usage_events(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  provider text,
  model text,
  voice text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  time_to_first_audio_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS voice_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id uuid NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  stage text NOT NULL,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at coverage for mutable Phase 4 tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agents','email_accounts','email_credentials','email_sync_states',
    'whatsapp_accounts','agent_policies','agent_tools','scheduled_jobs',
    'ai_provider_configs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

-- Organization-scoped RLS. SECURITY DEFINER helpers from Phase 3 avoid recursive
-- membership policy evaluation. Service workers may use the server-side DB role.
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_telemetry ENABLE ROW LEVEL SECURITY;

-- Policies are deliberately based on organization membership through agent/email
-- ownership paths. Direct credentials are never exposed to browser clients.
CREATE POLICY agents_member_visibility ON agents FOR ALL USING (is_active_organization_member(organization_id, auth.uid())) WITH CHECK (is_active_organization_member(organization_id, auth.uid()));
CREATE POLICY email_accounts_member_visibility ON email_accounts FOR ALL USING (is_active_organization_member(organization_id, auth.uid())) WITH CHECK (is_active_organization_member(organization_id, auth.uid()));
CREATE POLICY whatsapp_accounts_member_visibility ON whatsapp_accounts FOR ALL USING (is_active_organization_member(organization_id, auth.uid())) WITH CHECK (is_active_organization_member(organization_id, auth.uid()));
CREATE POLICY audit_events_member_visibility ON audit_events FOR SELECT USING (is_active_organization_member(organization_id, auth.uid()));
CREATE POLICY ai_usage_member_visibility ON ai_usage_events FOR SELECT USING (is_active_organization_member(organization_id, auth.uid()));
CREATE POLICY ai_provider_config_admin_visibility ON ai_provider_configs FOR ALL USING (is_active_organization_admin_or_owner(organization_id, auth.uid())) WITH CHECK (is_active_organization_admin_or_owner(organization_id, auth.uid()));

-- All dependent domain tables resolve organization ownership through their agent
-- or account. Policies are kept explicit to prevent cross-tenant access.
CREATE POLICY agent_versions_member_visibility ON agent_versions FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_versions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_versions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY agent_deployments_member_visibility ON agent_deployments FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_deployments.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_deployments.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY agent_email_accounts_member_visibility ON agent_email_accounts FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a JOIN email_accounts e ON e.id = agent_email_accounts.email_account_id WHERE a.id = agent_email_accounts.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY agent_whatsapp_accounts_member_visibility ON agent_whatsapp_accounts FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a JOIN whatsapp_accounts w ON w.id = agent_whatsapp_accounts.whatsapp_account_id WHERE a.id = agent_whatsapp_accounts.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY agent_tools_member_visibility ON agent_tools FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_tools.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_tools.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY agent_policies_member_visibility ON agent_policies FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_policies.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_policies.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY conversations_member_visibility ON conversations FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = conversations.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = conversations.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY email_actions_member_visibility ON email_actions FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = email_actions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = email_actions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY scheduled_jobs_member_visibility ON scheduled_jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = scheduled_jobs.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = scheduled_jobs.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY summaries_member_visibility ON summaries FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = summaries.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = summaries.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY voice_sessions_member_visibility ON voice_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = voice_sessions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM agents a WHERE a.id = voice_sessions.agent_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY conversation_messages_member_visibility ON conversation_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c JOIN agents a ON a.id = c.agent_id WHERE c.id = conversation_messages.conversation_id AND is_active_organization_member(a.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c JOIN agents a ON a.id = c.agent_id WHERE c.id = conversation_messages.conversation_id AND is_active_organization_member(a.organization_id, auth.uid()))
);

-- Mailbox tables follow account ownership.
CREATE POLICY email_credentials_server_only ON email_credentials FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY email_folders_member_visibility ON email_folders FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_folders.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_folders.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_labels_member_visibility ON email_labels FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_labels.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_labels.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_threads_member_visibility ON email_threads FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_threads.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_threads.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_messages_member_visibility ON email_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_messages.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_messages.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_attachments_member_visibility ON email_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id = m.email_account_id WHERE m.id = email_attachments.message_id AND is_active_organization_member(e.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM email_messages m JOIN email_accounts e ON e.id = m.email_account_id WHERE m.id = email_attachments.message_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_sync_states_member_visibility ON email_sync_states FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_sync_states.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);
CREATE POLICY email_sync_events_member_visibility ON email_sync_events FOR ALL USING (
  EXISTS (SELECT 1 FROM email_accounts e WHERE e.id = email_sync_events.email_account_id AND is_active_organization_member(e.organization_id, auth.uid()))
);

-- Remaining mailbox/channel operational tables.
CREATE POLICY whatsapp_contacts_member_visibility ON whatsapp_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id = whatsapp_contacts.whatsapp_account_id AND is_active_organization_member(w.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id = whatsapp_contacts.whatsapp_account_id AND is_active_organization_member(w.organization_id, auth.uid()))
);
CREATE POLICY whatsapp_messages_member_visibility ON whatsapp_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id = whatsapp_messages.whatsapp_account_id AND is_active_organization_member(w.organization_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM whatsapp_accounts w WHERE w.id = whatsapp_messages.whatsapp_account_id AND is_active_organization_member(w.organization_id, auth.uid()))
);
CREATE POLICY whatsapp_webhook_events_server_only ON whatsapp_webhook_events FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY scheduled_job_runs_member_visibility ON scheduled_job_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM scheduled_jobs j JOIN agents a ON a.id = j.agent_id WHERE j.id = scheduled_job_runs.scheduled_job_id AND is_active_organization_member(a.organization_id, auth.uid()))
);
CREATE POLICY voice_telemetry_member_visibility ON voice_telemetry FOR SELECT USING (
  EXISTS (SELECT 1 FROM voice_sessions v JOIN agents a ON a.id = v.agent_id WHERE v.id = voice_telemetry.voice_session_id AND is_active_organization_member(a.organization_id, auth.uid()))
);

-- Prevent more than one WhatsApp account/phone binding per agent.
CREATE UNIQUE INDEX IF NOT EXISTS agent_whatsapp_one_account ON agent_whatsapp_accounts(agent_id);

-- Durable uniqueness for provider webhook idempotency.
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_created_idx ON whatsapp_webhook_events(created_at DESC);
