-- Phase 4: actions/approvals, AI usage, voice telemetry and audit.

DO $$ BEGIN
  CREATE TYPE email_action_status AS ENUM ('pending_approval','approved','rejected','completed','failed','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF to_regclass('aca.email_actions') IS NOT NULL THEN
    ALTER TABLE email_actions
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  status email_action_status NOT NULL DEFAULT 'pending_approval',
  draft_id uuid REFERENCES email_messages(id) ON DELETE SET NULL,
  recipient_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  completed_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS email_actions_org_status_idx ON email_actions(organization_id,status,requested_at DESC);
CREATE INDEX IF NOT EXISTS email_actions_pending_idx ON email_actions(status,expires_at) WHERE status='pending_approval';

DO $$
BEGIN
  IF to_regclass('aca.email_action_approvals') IS NOT NULL THEN
    ALTER TABLE email_action_approvals
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE email_action_approvals
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS email_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_action_id uuid NOT NULL REFERENCES email_actions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  decided_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_action_approvals_org_idx ON email_action_approvals(organization_id,created_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.ai_provider_configs') IS NOT NULL THEN
    ALTER TABLE ai_provider_configs
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  purpose text NOT NULL DEFAULT 'general',
  model text,
  credential_ciphertext bytea,
  credential_key_reference text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,provider,purpose)
);
CREATE INDEX IF NOT EXISTS ai_provider_configs_org_idx ON ai_provider_configs(organization_id);

CREATE TABLE IF NOT EXISTS agent_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  ai_provider_config_id uuid REFERENCES ai_provider_configs(id) ON DELETE SET NULL,
  model_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_ai_settings_agent_idx ON agent_ai_settings(agent_id);

DO $$
BEGIN
  IF to_regclass('aca.ai_usage_events') IS NOT NULL THEN
    ALTER TABLE ai_usage_events
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  provider text,
  model text,
  operation text NOT NULL,
  request_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  estimated_cost numeric(14,8),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_request_uniq ON ai_usage_events(organization_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_usage_org_created_idx ON ai_usage_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_agent_created_idx ON ai_usage_events(agent_id,created_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.voice_sessions') IS NOT NULL THEN
    ALTER TABLE voice_sessions
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  provider text,
  model text,
  voice_id text,
  status text NOT NULL DEFAULT 'starting',
  started_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz,
  ended_at timestamptz,
  disconnect_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS voice_sessions_org_started_idx ON voice_sessions(organization_id,started_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.voice_telemetry') IS NOT NULL THEN
    ALTER TABLE voice_telemetry
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS voice_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_session_id uuid NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  correlation_id uuid,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  unit text,
  stage text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_telemetry_session_idx ON voice_telemetry(voice_session_id,created_at);
CREATE INDEX IF NOT EXISTS voice_telemetry_org_metric_idx ON voice_telemetry(organization_id,metric_name,created_at DESC);

DO $$
BEGIN
  IF to_regclass('aca.audit_events') IS NOT NULL THEN
    ALTER TABLE audit_events
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  correlation_id uuid,
  event_type text NOT NULL,
  target_type text,
  target_id uuid,
  action text,
  decision text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_correlation_idx ON audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS audit_events_type_idx ON audit_events(organization_id,event_type,created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE OR REPLACE FUNCTION update_phase4_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER ai_provider_configs_updated_at BEFORE UPDATE ON ai_provider_configs FOR EACH ROW EXECUTE FUNCTION update_phase4_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE email_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_actions_member_visibility ON email_actions FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY email_actions_member_manage ON email_actions FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_action_approvals_member_visibility ON email_action_approvals FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY email_action_approvals_member_manage ON email_action_approvals FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY ai_provider_configs_admin_visibility ON ai_provider_configs FOR SELECT TO authenticated USING (can_manage_organization(organization_id));
CREATE POLICY ai_provider_configs_admin_manage ON ai_provider_configs FOR ALL TO authenticated USING (can_manage_organization(organization_id)) WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY ai_usage_events_member_visibility ON ai_usage_events FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY ai_usage_events_member_manage ON ai_usage_events FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY voice_sessions_member_visibility ON voice_sessions FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY voice_sessions_member_manage ON voice_sessions FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY voice_telemetry_member_visibility ON voice_telemetry FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY voice_telemetry_member_manage ON voice_telemetry FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY audit_events_member_visibility ON audit_events FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY audit_events_insert ON audit_events FOR INSERT TO authenticated WITH CHECK (can_access_organization(organization_id));

ALTER TABLE agent_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_ai_settings_member ON agent_ai_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_ai_settings.agent_id AND can_access_organization(a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = agent_ai_settings.agent_id AND can_manage_organization(a.organization_id)));
