-- Phase 4 follow-up: complete audit-event access while preserving append-only semantics.
-- Forward-only because 0002/0013 may already have been applied to live databases.
-- Existing UPDATE/DELETE restrictive deny policies remain the authority for immutability.
--
-- Resolve audit_events through the migration connection's search_path. The
-- application supports deployments whose application tables live in the
-- "aca" schema (search_path=aca,public) as well as public-schema deployments.
-- The access helper remains explicitly qualified because it is installed in public.

DO $phase4$
BEGIN
  IF to_regclass('audit_events') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 audit hardening requires audit_events in the active search_path';
  END IF;
END
$phase4$;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_insert ON audit_events;
CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_organization(organization_id));

DROP POLICY IF EXISTS audit_events_read ON audit_events;
CREATE POLICY audit_events_read ON audit_events
  FOR SELECT TO authenticated
  USING (public.can_access_organization(organization_id));

-- Keep the audit log append-only even if another permissive policy is added later.
DROP POLICY IF EXISTS audit_events_update_deny ON audit_events;
CREATE POLICY audit_events_update_deny ON audit_events
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS audit_events_delete_deny ON audit_events;
CREATE POLICY audit_events_delete_deny ON audit_events
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

COMMENT ON TABLE audit_events IS 'audit_events is append-only; updates and deletes are denied by restrictive RLS policies.';
