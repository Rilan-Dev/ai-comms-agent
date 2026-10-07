-- Phase 4 correction: align application schema with DATA-MODEL.md.
-- Forward-only additions; no destructive rewrite of 0002.

ALTER TYPE action_status ADD VALUE IF NOT EXISTS 'executing';

ALTER TABLE agents ADD COLUMN IF NOT EXISTS organization_id_shadow uuid;
-- No data rewrite is performed; organization_id is already authoritative.

ALTER TABLE scheduled_job_runs ADD COLUMN IF NOT EXISTS fire_at timestamptz;
ALTER TABLE scheduled_job_runs ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS action jsonb;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS organization_id_shadow uuid;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS trigger_event jsonb;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES email_accounts(id) ON DELETE SET NULL;
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS target_message_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS draft_id uuid;
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS executed_at timestamptz;
ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS audit_event_id uuid;
ALTER TABLE email_action_approvals ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE summaries ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS content_json jsonb;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS token_usage jsonb;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS summary_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 summary_id uuid NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
 email_message_id uuid REFERENCES email_messages(id) ON DELETE SET NULL,
 whatsapp_message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
 weight real,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (email_message_id IS NOT NULL OR whatsapp_message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS summary_sources_summary_idx ON summary_sources(summary_id);

ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS encrypted_api_key bytea;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS operation text;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS voice_seconds numeric;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cost_usd numeric;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS provider_session_id text;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS duration_seconds numeric;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS turn_count integer NOT NULL DEFAULT 0;
ALTER TABLE voice_sessions ADD COLUMN IF NOT EXISTS connection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE voice_telemetry ADD COLUMN IF NOT EXISTS voice_session_id uuid;
ALTER TABLE voice_telemetry ADD COLUMN IF NOT EXISTS turn_id text;
ALTER TABLE voice_telemetry ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE voice_telemetry ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_type text;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS correlation_id uuid;

DO $
BEGIN
  IF to_regclass('aca.api_keys') IS NOT NULL THEN
    ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $;

CREATE TABLE IF NOT EXISTS api_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL,
 hashed_key text NOT NULL,
 scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
 last_used_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_org_name_uniq ON api_keys(organization_id,name);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id);

CREATE TABLE IF NOT EXISTS agent_messaging_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 channel_type text NOT NULL,
 channel_account_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(agent_id,channel_type)
);
CREATE INDEX IF NOT EXISTS agent_messaging_assignments_agent_idx ON agent_messaging_assignments(agent_id);

-- Secure credential-bearing rows are intentionally fail-closed for browser
-- sessions. Workers access them through the privileged server-side path.
DROP POLICY IF EXISTS email_account_credentials_member_visibility ON email_account_credentials;
CREATE POLICY email_account_credentials_deny_browser ON email_account_credentials
  USING (false) WITH CHECK (false);

-- Audit is append-only: no UPDATE/DELETE policies are created.
CREATE INDEX IF NOT EXISTS audit_events_event_type_idx ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS audit_events_correlation_idx ON audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_agent_created_idx ON ai_usage_events(agent_id,created_at DESC);

-- Phase 4 marker.
INSERT INTO schema_migration_markers(key,value)
VALUES ('phase4-correction','DATA-MODEL alignment and credential RLS hardening')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
