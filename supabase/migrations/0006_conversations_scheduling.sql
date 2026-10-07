-- Phase 4: conversations, scheduling, automation and summaries.

DO $$ BEGIN
  CREATE TYPE conversation_channel AS ENUM ('chat','voice','whatsapp','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE scheduled_job_status AS ENUM ('pending','running','completed','failed','cancelled','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel conversation_channel NOT NULL,
  external_contact_id text,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS conversations_org_last_message_idx
ON conversations(organization_id,last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_agent_idx ON conversations(agent_id,started_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content text,
  tool_name text,
  tool_call_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx
ON conversation_messages(conversation_id,created_at);

ALTER TABLE conversation_turns
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input_message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
  output_message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE conversation_turns
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE conversation_turns
  ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS conversation_turns_correlation_uniq ON conversation_turns(correlation_id);
CREATE INDEX IF NOT EXISTS conversation_turns_org_created_idx ON conversation_turns(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  next_run_at timestamptz,
  last_run_at timestamptz,
  grace_period_seconds integer NOT NULL DEFAULT 900 CHECK (grace_period_seconds >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx ON scheduled_jobs(enabled,next_run_at);
CREATE INDEX IF NOT EXISTS scheduled_jobs_org_idx ON scheduled_jobs(organization_id);

ALTER TABLE scheduled_job_runs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE scheduled_job_runs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_job_id uuid NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status scheduled_job_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scheduled_job_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS scheduled_job_runs_org_created_idx ON scheduled_job_runs(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_rules_org_enabled_idx ON automation_rules(organization_id,enabled);

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_event_id text,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(automation_rule_id,idempotency_key)
);
ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS automation_runs_org_created_idx ON automation_runs(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  summary_type text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS summaries_org_created_idx ON summaries(organization_id,created_at DESC);

ALTER TABLE summary_sources
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS summary_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id uuid NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(summary_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS summary_sources_org_idx ON summary_sources(organization_id);

CREATE OR REPLACE FUNCTION update_scheduling_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_scheduling_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_member_visibility ON conversations FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY conversations_member_manage ON conversations FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY conversation_messages_member_visibility ON conversation_messages FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY conversation_messages_member_manage ON conversation_messages FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY conversation_turns_member_visibility ON conversation_turns FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY conversation_turns_member_manage ON conversation_turns FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY scheduled_jobs_member_visibility ON scheduled_jobs FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY scheduled_jobs_member_manage ON scheduled_jobs FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY scheduled_job_runs_member_visibility ON scheduled_job_runs FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY scheduled_job_runs_member_manage ON scheduled_job_runs FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY automation_rules_member_visibility ON automation_rules FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY automation_rules_member_manage ON automation_rules FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY automation_runs_member_visibility ON automation_runs FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY automation_runs_member_manage ON automation_runs FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY summaries_member_visibility ON summaries FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY summaries_member_manage ON summaries FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));

CREATE POLICY summary_sources_member_visibility ON summary_sources FOR SELECT TO authenticated USING (can_access_organization(organization_id));
CREATE POLICY summary_sources_member_manage ON summary_sources FOR ALL TO authenticated USING (can_access_organization(organization_id)) WITH CHECK (can_access_organization(organization_id));
