-- Phase 4 schema cleanup: remove accidental compatibility columns and
-- normalize names to the canonical DATA-MODEL shape.

ALTER TABLE agents DROP COLUMN IF EXISTS organization_id_shadow;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS organization_id_shadow;
-- Preserve the canonical voice_session_id column created by the voice telemetry migration.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='actions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='action') THEN
    ALTER TABLE automation_rules RENAME COLUMN actions TO action;
  END IF;
END $$;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'aca.voice_telemetry'::regclass
      AND conname = 'voice_telemetry_session_fk'
  ) THEN
    ALTER TABLE voice_telemetry
      ADD CONSTRAINT voice_telemetry_session_fk
      FOREIGN KEY (voice_session_id) REFERENCES voice_sessions(id) ON DELETE CASCADE;
  END IF;
END $;

-- Canonical audit names. Preserve existing Phase 4 columns if already
-- normalized; otherwise rename the initial implementation's equivalents.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='action')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='event_type') THEN
    ALTER TABLE audit_events RENAME COLUMN action TO event_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='resource_type')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='target_type') THEN
    ALTER TABLE audit_events RENAME COLUMN resource_type TO target_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='resource_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_events' AND column_name='target_id') THEN
    ALTER TABLE audit_events RENAME COLUMN resource_id TO target_id;
  END IF;
END $$;

-- RLS for newly introduced tenant tables.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messaging_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_sources ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename='api_keys' AND policyname='api_keys_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY api_keys_member_visibility ON api_keys USING (app_is_org_member(organization_id));$policy$;
  END IF;
END $;

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename='agent_messaging_assignments' AND policyname='agent_messaging_assignments_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY agent_messaging_assignments_member_visibility ON agent_messaging_assignments USING (app_is_agent_member(agent_id));$policy$;
  END IF;
END $;

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename='summary_sources' AND policyname='summary_sources_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY summary_sources_member_visibility ON summary_sources
  USING (EXISTS (SELECT 1 FROM summaries s WHERE s.id=summary_sources.summary_id AND app_is_org_member(s.organization_id)));$policy$;
  END IF;
END $;

INSERT INTO schema_migration_markers(key,value)
VALUES ('phase4-cleanup','canonical column names, FK and RLS hardening')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
