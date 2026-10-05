-- Phase 4 security hardening: lock down SECURITY DEFINER RLS helpers.
-- These helpers only exist to prevent recursive RLS evaluation. They are not a
-- public membership lookup API and therefore cannot trust caller-supplied user IDs.

CREATE OR REPLACE FUNCTION is_active_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid IS NOT NULL
    AND p_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM organization_memberships m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND m.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION is_active_organization_admin_or_owner(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid IS NOT NULL
    AND p_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM organization_memberships m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    );
$$;

REVOKE EXECUTE ON FUNCTION is_active_organization_member(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_active_organization_member(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION is_active_organization_member(uuid,uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION is_active_organization_admin_or_owner(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_active_organization_admin_or_owner(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION is_active_organization_admin_or_owner(uuid,uuid) TO authenticated;
