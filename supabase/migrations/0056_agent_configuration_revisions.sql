-- Complete nonsecret agent candidates. No active configuration/provider write
-- occurs here. A real saved baseline is captured lazily under the agent lock.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS agents_organization_id_id_key ON agents(organization_id,id);

CREATE TABLE IF NOT EXISTS agent_configuration_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 agent_id uuid NOT NULL,
 revision_number integer NOT NULL CHECK(revision_number>0),
 kind text NOT NULL CHECK(kind IN ('baseline','draft','restore','legacy_restore','revocation')),
 base_revision_id uuid,
 restored_from_id uuid,
 legacy_source_version_id uuid,
 coverage text NOT NULL DEFAULT 'complete' CHECK(coverage IN ('complete','legacy_partial')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND snapshot->>'schemaVersion'='1'),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,agent_id,id),
 UNIQUE(organization_id,agent_id,revision_number),
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id,base_revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organization_id,agent_id,restored_from_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS agent_configuration_heads (
 organization_id uuid NOT NULL,
 agent_id uuid NOT NULL,
 active_revision_id uuid NOT NULL,
 revocation_generation integer NOT NULL DEFAULT 0 CHECK(revocation_generation>=0),
 revocation_barrier jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(revocation_barrier)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,agent_id),
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id,active_revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS agent_configuration_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 agent_id uuid NOT NULL,
 revision_id uuid NOT NULL,
 base_revision_id uuid NOT NULL,
 dependency_fingerprint text NOT NULL CHECK(dependency_fingerprint ~ '^[0-9a-f]{64}$'),
 snapshot_digest text NOT NULL CHECK(snapshot_digest ~ '^[0-9a-f]{64}$'),
 diff jsonb NOT NULL CHECK(jsonb_typeof(diff)='array'),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 UNIQUE(organization_id,agent_id,revision_id,id),
 CHECK(expires_at>created_at),
 FOREIGN KEY(organization_id,agent_id,revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id,base_revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS agent_configuration_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 agent_id uuid NOT NULL,
 revision_id uuid NOT NULL,
 review_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('production','preview')),
 legacy_version_id uuid,
 legacy_deployment_id uuid,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,agent_id,revision_id),
 FOREIGN KEY(organization_id,agent_id,revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id,revision_id,review_id) REFERENCES agent_configuration_reviews(organization_id,agent_id,revision_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS agent_configuration_history_idx ON agent_configuration_revisions(organization_id,agent_id,revision_number DESC);

CREATE OR REPLACE FUNCTION guard_agent_configuration_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Preserve existing parent-resource deletion semantics; direct history
 -- editing remains forbidden. FK cleanup may only clear deleted references.
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM agents WHERE id=OLD.agent_id AND organization_id=OLD.organization_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.created_by IS NULL AND OLD.created_by IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.created_by)
   AND (to_jsonb(NEW)-'created_by')=(to_jsonb(OLD)-'created_by') THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Configuration history is immutable' USING ERRCODE='55000';
END $$;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['agent_configuration_revisions','agent_configuration_reviews','agent_configuration_applications'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS agent_configuration_history_immutable ON %I',table_name);
  EXECUTE format('CREATE TRIGGER agent_configuration_history_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_agent_configuration_history()',table_name);
 END LOOP;
END $$;

ALTER TABLE agent_configuration_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configuration_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configuration_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configuration_applications ENABLE ROW LEVEL SECURITY;
-- Complete payloads include protected policy fields. Server routes provide
-- field-filtered views; broad organization membership is not raw SQL access.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['agent_configuration_revisions','agent_configuration_heads','agent_configuration_reviews','agent_configuration_applications'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename=table_name AND policyname='agent_configuration_admin_read') THEN
   EXECUTE format('CREATE POLICY agent_configuration_admin_read ON %I FOR SELECT USING(can_manage_organization(organization_id))',table_name);
  END IF;
 END LOOP;
END $$;
COMMIT;
