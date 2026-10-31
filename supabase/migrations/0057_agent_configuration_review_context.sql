-- Explicit review context and one recoverable working draft per editor.
-- No active settings, communications or schedules are changed by this DDL.
BEGIN;
ALTER TABLE agent_configuration_reviews
 ADD COLUMN IF NOT EXISTS validation jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(validation)='object');
ALTER TABLE agent_configuration_revisions
 ADD COLUMN IF NOT EXISTS parent_draft_id uuid;
ALTER TABLE agent_configuration_applications
 ADD COLUMN IF NOT EXISTS revocation_generation integer NOT NULL DEFAULT 0 CHECK(revocation_generation>=0);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='agent_configuration_revisions'::regclass AND conname='agent_configuration_parent_draft_fk') THEN
  ALTER TABLE agent_configuration_revisions ADD CONSTRAINT agent_configuration_parent_draft_fk
   FOREIGN KEY(organization_id,agent_id,parent_draft_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS agent_configuration_draft_heads (
 organization_id uuid NOT NULL,
 agent_id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 draft_revision_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,agent_id,created_by),
 FOREIGN KEY(organization_id,agent_id) REFERENCES agents(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,agent_id,draft_revision_id) REFERENCES agent_configuration_revisions(organization_id,agent_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE agent_configuration_draft_heads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename='agent_configuration_draft_heads' AND policyname='agent_configuration_admin_read') THEN
  CREATE POLICY agent_configuration_admin_read ON agent_configuration_draft_heads FOR SELECT USING(can_manage_organization(organization_id));
 END IF;
END $$;
COMMIT;
