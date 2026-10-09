-- Phase 4 follow-up: complete audit-event access while preserving append-only semantics.
-- Forward-only because 0002/0013 may already have been applied to live databases.
-- Existing UPDATE/DELETE restrictive deny policies remain the authority for immutability.

DO $phase4$
BEGIN
  IF to_regclass('public.audit_events') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 audit hardening requires public.audit_events';
  END IF;
END
$phase4$;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_organization(organization_id));

DROP POLICY IF EXISTS audit_events_read ON public.audit_events;
CREATE POLICY audit_events_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.can_access_organization(organization_id));

-- Keep the audit log append-only even if another permissive policy is added later.
DROP POLICY IF EXISTS audit_events_update_deny ON public.audit_events;
CREATE POLICY audit_events_update_deny ON public.audit_events
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS audit_events_delete_deny ON public.audit_events;
CREATE POLICY audit_events_delete_deny ON public.audit_events
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false) WITH CHECK (false);

COMMENT ON TABLE public.audit_events IS 'audit_events is append-only; updates and deletes are denied by restrictive RLS policies.';
