-- Runtime verification for Phase 3 identity/RBAC migration.
-- This runs against a disposable PostgreSQL instance in CI.
\set ON_ERROR_STOP on

BEGIN;

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO users (id, email, name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test', 'Owner'),
  ('00000000-0000-0000-0000-000000000002', 'target@example.test', 'Target');

INSERT INTO organizations (id, name, slug)
VALUES ('10000000-0000-0000-0000-000000000001', 'Verification Org', 'verification-org');

INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'active');

COMMIT;

-- Ownership transfer must be allowed inside one transaction even though the
-- intermediate state has zero owners.
BEGIN;
UPDATE organization_memberships
SET role = 'admin'
WHERE id = '20000000-0000-0000-0000-000000000001';

INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
VALUES ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'owner', 'active');
COMMIT;

DO $$
DECLARE
  owner_count integer;
  helper_count integer;
BEGIN
  SELECT count(*) INTO owner_count
  FROM organization_memberships
  WHERE organization_id = '10000000-0000-0000-0000-000000000001'
    AND role = 'owner'
    AND status = 'active';

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'Runtime verification failed: expected exactly one active owner, got %', owner_count;
  END IF;

  SELECT count(*) INTO helper_count
  FROM pg_proc
  WHERE proname IN ('is_active_organization_member', 'is_active_organization_admin_or_owner');

  IF helper_count <> 2 THEN
    RAISE EXCEPTION 'Runtime verification failed: expected both RLS helper functions';
  END IF;
END;
$$;

SELECT 'phase3 migration runtime verification passed' AS result;
