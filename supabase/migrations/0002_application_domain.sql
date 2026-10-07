-- Phase 4: Database foundation and application-domain schema
-- Forward-only migration. PostgreSQL 15+.
-- Phase 3 identity/RBAC tables remain authoritative; this migration adds
-- application-domain persistence, indexes, RLS, and storage metadata.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deployment_environment AS ENUM ('production','preview'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_provider AS ENUM ('gmail','imap_smtp','zoho'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_account_status AS ENUM ('active','expired','revoked','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_folder_role AS ENUM ('inbox','sent','drafts','trash','spam','archive','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_label_type AS ENUM ('system','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE embedding_status AS ENUM ('pending','indexed','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE credential_type AS ENUM ('oauth_token','password','app_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_mode AS ENUM ('initial','incremental'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_event_type AS ENUM ('started','completed','failed','token_refreshed','partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_status AS ENUM ('active','pending_verification','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('inbound','outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE whatsapp_message_status AS ENUM ('queued','sent','delivered','read','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_channel AS ENUM ('chat','whatsapp','voice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_message_role AS ENUM ('user','assistant','system','tool'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('active','paused','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scheduled_job_status AS ENUM ('active','paused','archived','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE action_status AS ENUM ('pending_approval','approved','rejected','completed','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_decision AS ENUM ('approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE automation_status AS ENUM ('active','paused','archived','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL, slug text NOT NULL, description text, status agent_status NOT NULL DEFAULT 'draft',
 current_version_id uuid, current_deployment_id uuid, created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,slug)
);
CREATE TABLE IF NOT EXISTS agent_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 version_number integer NOT NULL, config jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), diff_from_previous jsonb,
 UNIQUE(agent_id,version_number)
);
CREATE TABLE IF NOT EXISTS agent_deployments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 version_id uuid NOT NULL REFERENCES agent_versions(id), environment deployment_environment NOT NULL,
 deployed_by uuid REFERENCES users(id), deployed_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz
);
ALTER TABLE agents ADD CONSTRAINT agents_current_version_fk FOREIGN KEY (current_version_id) REFERENCES agent_versions(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE agents ADD CONSTRAINT agents_current_deployment_fk FOREIGN KEY (current_deployment_id) REFERENCES agent_deployments(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS agent_ai_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
 ai_provider_config_id uuid, model_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
 feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 provider email_provider NOT NULL, email_address citext NOT NULL, display_name text,
 connection_config jsonb NOT NULL DEFAULT '{}'::jsonb, capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
 status email_account_status NOT NULL DEFAULT 'active', last_sync_at timestamptz, last_error_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_org_address_uniq ON email_accounts(organization_id,email_address);
CREATE TABLE IF NOT EXISTS email_account_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
 credential_type credential_type NOT NULL, encrypted_payload bytea NOT NULL, expires_at timestamptz,
 rotated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_folders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
 provider_folder_id text NOT NULL, name text NOT NULL, parent_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
 role email_folder_role NOT NULL DEFAULT 'custom', unread_count integer NOT NULL DEFAULT 0, last_synced_at timestamptz,
 UNIQUE(email_account_id,provider_folder_id)
);
CREATE TABLE IF NOT EXISTS email_labels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
 provider_label_id text NOT NULL, name text NOT NULL, color text, label_type email_label_type NOT NULL DEFAULT 'user',
 UNIQUE(email_account_id,provider_label_id)
);
CREATE TABLE IF NOT EXISTS email_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
 provider_thread_id text, subject text, snippet text, last_message_at timestamptz, message_count integer NOT NULL DEFAULT 0,
 is_unread boolean NOT NULL DEFAULT false, importance_score real, action_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(email_account_id,provider_thread_id)
);
CREATE TABLE IF NOT EXISTS email_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
 thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE, folder_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
 provider_message_id text, message_id_header text, in_reply_to text, "references" text[],
 from_address text NOT NULL, to_addresses jsonb NOT NULL DEFAULT '[]', cc_addresses jsonb NOT NULL DEFAULT '[]', bcc_addresses jsonb NOT NULL DEFAULT '[]',
 subject text, text_body text, html_body text, snippet text, received_at timestamptz,
 is_read boolean NOT NULL DEFAULT false, is_starred boolean NOT NULL DEFAULT false, is_draft boolean NOT NULL DEFAULT false,
 is_outbound boolean NOT NULL DEFAULT false, importance_score real, has_attachments boolean NOT NULL DEFAULT false,
 embedding_status embedding_status NOT NULL DEFAULT 'pending', search_tsv tsvector GENERATED ALWAYS AS (
   to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(text_body,''))
 ) STORED, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(email_account_id,provider_message_id)
);
CREATE INDEX IF NOT EXISTS email_messages_account_received_idx ON email_messages(email_account_id,received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_thread_received_idx ON email_messages(thread_id,received_at);
CREATE INDEX IF NOT EXISTS email_messages_search_tsv_gin ON email_messages USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS email_messages_importance_idx ON email_messages(importance_score DESC);
CREATE TABLE IF NOT EXISTS email_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
 filename text NOT NULL, mime_type text, size_bytes bigint NOT NULL, storage_url text, content_hash text,
 virus_scan_status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_sync_states (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
 cursor jsonb NOT NULL DEFAULT '{}'::jsonb, history_token text, last_sync_at timestamptz, last_full_sync_at timestamptz,
 sync_mode sync_mode NOT NULL DEFAULT 'initial', error_state jsonb
);
CREATE TABLE IF NOT EXISTS email_sync_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
 event_type sync_event_type NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, started_at timestamptz,
 completed_at timestamptz, error text
);

CREATE TABLE IF NOT EXISTS agent_email_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'primary',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(agent_id,email_account_id)
);
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 phone_number_id text NOT NULL UNIQUE, display_name text, waba_id text NOT NULL, verify_token text NOT NULL,
 encrypted_credentials bytea NOT NULL, status whatsapp_status NOT NULL DEFAULT 'pending_verification',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_whatsapp_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
 whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
 phone_number text NOT NULL, display_name text, first_seen_at timestamptz NOT NULL DEFAULT now(), last_message_at timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, UNIQUE(whatsapp_account_id,phone_number)
);
CREATE TABLE IF NOT EXISTS whatsapp_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
 contact_id uuid NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE, direction message_direction NOT NULL,
 provider_message_id text UNIQUE, body text, media jsonb, status whatsapp_message_status NOT NULL DEFAULT 'queued',
 created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, read_at timestamptz
);
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), whatsapp_account_id uuid REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
 provider_event_id text NOT NULL UNIQUE, event_type text NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz, processing_error text
);

CREATE TABLE IF NOT EXISTS conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, channel conversation_channel NOT NULL,
 subject text, status conversation_status NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), last_message_at timestamptz
);
CREATE TABLE IF NOT EXISTS conversation_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role conversation_message_role NOT NULL, content text, content_json jsonb, parent_message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
 tool_call_id text, tool_name text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversation_turns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, intent text, status text, token_usage jsonb
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL, cron text,
 one_fire_at timestamptz, intent text NOT NULL, params jsonb NOT NULL DEFAULT '{}'::jsonb, next_fire_at timestamptz,
 last_fire_at timestamptz, status scheduled_job_status NOT NULL DEFAULT 'active', created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scheduled_job_id uuid NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL, error text, result jsonb
);
CREATE TABLE IF NOT EXISTS automation_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name text NOT NULL, trigger jsonb NOT NULL,
 conditions jsonb NOT NULL DEFAULT '{}'::jsonb, actions jsonb NOT NULL DEFAULT '[]'::jsonb,
 status automation_status NOT NULL DEFAULT 'active', created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
 triggered_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz, status text NOT NULL, error text, result jsonb
);

CREATE TABLE IF NOT EXISTS email_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE, action_type text NOT NULL, target jsonb NOT NULL,
 status action_status NOT NULL DEFAULT 'pending_approval', requested_by uuid REFERENCES users(id), requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz, completed_at timestamptz, error text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS email_action_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_id uuid NOT NULL REFERENCES email_actions(id) ON DELETE CASCADE,
 approver_id uuid NOT NULL REFERENCES users(id), decision approval_decision NOT NULL, reason text, decided_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(action_id,approver_id)
);

CREATE TABLE IF NOT EXISTS ai_provider_configs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 provider text NOT NULL, config jsonb NOT NULL DEFAULT '{}'::jsonb, encrypted_credentials bytea,
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 agent_id uuid REFERENCES agents(id) ON DELETE SET NULL, provider text, model text, surface text, input_tokens bigint, output_tokens bigint,
 latency_ms integer, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_ai_settings ADD CONSTRAINT agent_ai_settings_provider_fk FOREIGN KEY(ai_provider_config_id) REFERENCES ai_provider_configs(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS summaries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE, summary_type text NOT NULL, period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL, content text NOT NULL, sources jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS voice_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE, provider text, model text, started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz, status text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS voice_telemetry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
 metric_name text NOT NULL, metric_value numeric, unit text, recorded_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, resource_type text NOT NULL, resource_id uuid,
 outcome text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 bucket text NOT NULL, object_key text NOT NULL, content_type text, size_bytes bigint, content_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bucket,object_key)
);

CREATE INDEX IF NOT EXISTS agents_org_idx ON agents(organization_id);
CREATE INDEX IF NOT EXISTS agent_versions_agent_idx ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS deployments_agent_idx ON agent_deployments(agent_id);
CREATE INDEX IF NOT EXISTS email_accounts_org_idx ON email_accounts(organization_id);
CREATE INDEX IF NOT EXISTS threads_account_last_idx ON email_threads(email_account_id,last_message_at DESC);
CREATE INDEX IF NOT EXISTS sync_events_account_started_idx ON email_sync_events(email_account_id,started_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_org_idx ON whatsapp_accounts(organization_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_account_created_idx ON whatsapp_messages(whatsapp_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_org_updated_idx ON conversations(organization_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx ON conversation_messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx ON scheduled_jobs(status,next_fire_at);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_org_created_idx ON ai_usage_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS summaries_agent_period_idx ON summaries(agent_id,period_start DESC);
CREATE INDEX IF NOT EXISTS voice_sessions_agent_started_idx ON voice_sessions(agent_id,started_at DESC);

CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(current_setting('app.user_id', true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_org_member(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM aca.organization_memberships
    WHERE organization_id=p_org AND user_id=current_app_user_id()
      AND status='active'
  )
$$;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agents','agent_versions','agent_deployments','agent_ai_settings','email_accounts',
    'email_account_credentials','email_folders','email_labels','email_threads','email_messages',
    'email_attachments','email_sync_states','email_sync_events','agent_email_accounts',
    'whatsapp_accounts','agent_whatsapp_accounts','whatsapp_contacts','whatsapp_messages',
    'whatsapp_webhook_events','conversations','conversation_messages','conversation_turns',
    'scheduled_jobs','scheduled_job_runs','automation_rules','automation_runs','email_actions',
    'email_action_approvals','ai_provider_configs','ai_usage_events','summaries','voice_sessions',
    'voice_telemetry','audit_events','storage_objects'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

-- Policies are intentionally explicit per tenant-bearing table. Child tables
-- inherit tenant membership through their parent relationships.
CREATE POLICY agents_member_visibility ON agents USING (app_is_org_member(organization_id));
CREATE POLICY email_accounts_member_visibility ON email_accounts USING (app_is_org_member(organization_id));
CREATE POLICY whatsapp_accounts_member_visibility ON whatsapp_accounts USING (app_is_org_member(organization_id));
CREATE POLICY conversations_member_visibility ON conversations USING (app_is_org_member(organization_id));
CREATE POLICY scheduled_jobs_member_visibility ON scheduled_jobs USING (app_is_org_member(organization_id));
CREATE POLICY automation_rules_member_visibility ON automation_rules USING (app_is_org_member(organization_id));
CREATE POLICY email_actions_member_visibility ON email_actions USING (app_is_org_member(organization_id));
CREATE POLICY ai_provider_configs_member_visibility ON ai_provider_configs USING (app_is_org_member(organization_id));
CREATE POLICY ai_usage_events_member_visibility ON ai_usage_events USING (app_is_org_member(organization_id));
CREATE POLICY summaries_member_visibility ON summaries USING (app_is_org_member(organization_id));
CREATE POLICY voice_sessions_member_visibility ON voice_sessions USING (app_is_org_member(organization_id));
CREATE POLICY audit_events_member_visibility ON audit_events USING (app_is_org_member(organization_id));
CREATE POLICY storage_objects_member_visibility ON storage_objects USING (app_is_org_member(organization_id));

-- Child-table RLS derives organization membership through a security-definer
-- EXISTS chain. Policies are fail-closed when app.user_id is absent.
CREATE OR REPLACE FUNCTION app_is_agent_member(p_agent uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM agents a WHERE a.id=p_agent AND app_is_org_member(a.organization_id)
  )
$$;
CREATE OR REPLACE FUNCTION app_is_email_account_member(p_account uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM email_accounts e WHERE e.id=p_account AND app_is_org_member(e.organization_id)
  )
$$;
CREATE OR REPLACE FUNCTION app_is_whatsapp_account_member(p_account uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM whatsapp_accounts w WHERE w.id=p_account AND app_is_org_member(w.organization_id)
  )
$$;

CREATE POLICY agent_versions_member_visibility ON agent_versions USING (app_is_agent_member(agent_id));
CREATE POLICY agent_deployments_member_visibility ON agent_deployments USING (app_is_agent_member(agent_id));
CREATE POLICY agent_ai_settings_member_visibility ON agent_ai_settings USING (app_is_agent_member(agent_id));
CREATE POLICY agent_email_accounts_member_visibility ON agent_email_accounts USING (app_is_agent_member(agent_id));
CREATE POLICY email_account_credentials_member_visibility ON email_account_credentials USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_folders_member_visibility ON email_folders USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_labels_member_visibility ON email_labels USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_threads_member_visibility ON email_threads USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_messages_member_visibility ON email_messages USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_sync_states_member_visibility ON email_sync_states USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_sync_events_member_visibility ON email_sync_events USING (app_is_email_account_member(email_account_id));
CREATE POLICY email_attachments_member_visibility ON email_attachments USING (
  EXISTS (SELECT 1 FROM email_messages m WHERE m.id=email_attachments.email_message_id AND app_is_email_account_member(m.email_account_id))
);
CREATE POLICY whatsapp_contacts_member_visibility ON whatsapp_contacts USING (app_is_whatsapp_account_member(whatsapp_account_id));
CREATE POLICY whatsapp_messages_member_visibility ON whatsapp_messages USING (app_is_whatsapp_account_member(whatsapp_account_id));
CREATE POLICY whatsapp_webhook_events_member_visibility ON whatsapp_webhook_events USING (app_is_whatsapp_account_member(whatsapp_account_id));
CREATE POLICY conversation_messages_member_visibility ON conversation_messages USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_messages.conversation_id AND app_is_org_member(c.organization_id))
);
CREATE POLICY conversation_turns_member_visibility ON conversation_turns USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id=conversation_turns.conversation_id AND app_is_org_member(c.organization_id))
);
CREATE POLICY scheduled_job_runs_member_visibility ON scheduled_job_runs USING (
  EXISTS (SELECT 1 FROM scheduled_jobs j WHERE j.id=scheduled_job_runs.scheduled_job_id AND app_is_org_member(j.organization_id))
);
CREATE POLICY automation_runs_member_visibility ON automation_runs USING (
  EXISTS (SELECT 1 FROM automation_rules r WHERE r.id=automation_runs.automation_rule_id AND app_is_org_member(r.organization_id))
);
CREATE POLICY email_action_approvals_member_visibility ON email_action_approvals USING (
  EXISTS (SELECT 1 FROM email_actions a WHERE a.id=email_action_approvals.action_id AND app_is_org_member(a.organization_id))
);
CREATE POLICY voice_telemetry_member_visibility ON voice_telemetry USING (
  EXISTS (SELECT 1 FROM voice_sessions s WHERE s.id=voice_telemetry.session_id AND app_is_org_member(s.organization_id))
);

-- Service-side workers use the service_role/database owner and are not exposed
-- to browser sessions. Browser-facing writes remain subject to explicit
-- authorization in the application layer.

CREATE OR REPLACE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER email_threads_updated_at BEFORE UPDATE ON email_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER email_messages_updated_at BEFORE UPDATE ON email_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER ai_provider_configs_updated_at BEFORE UPDATE ON ai_provider_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER voice_sessions_updated_at BEFORE UPDATE ON voice_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration verification marker.
CREATE TABLE IF NOT EXISTS schema_migration_markers (
  key text PRIMARY KEY, value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migration_markers(key,value) VALUES ('phase4','database foundation and application-domain schema')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
