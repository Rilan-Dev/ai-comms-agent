-- Phase 4 security hardening for the database foundation.
-- Corrects function exposure and least-privilege RLS for secret-bearing tables.

-- Policy helper wrappers must not themselves run with elevated privileges.
CREATE OR REPLACE FUNCTION public.can_access_organization(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_active_organization_member(p_organization_id, NULLIF(current_setting('app.user_id', true), '')::uuid);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_organization(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_active_organization_admin_or_owner(p_organization_id, NULLIF(current_setting('app.user_id', true), '')::uuid);
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_organization(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_organization(uuid) TO authenticated;

-- Existing membership helpers are required by policies but must not be a
-- privileged public API callable by anonymous clients.
REVOKE EXECUTE ON FUNCTION public.is_active_organization_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_organization_admin_or_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_organization_admin_or_owner(uuid, uuid) TO authenticated;

-- Credential-bearing tables: membership is not sufficient to read or mutate
-- ciphertext. Organization admins/owners are the database-level minimum;
-- application authorization remains stricter where required.
DROP POLICY IF EXISTS email_account_credentials_org_member ON email_account_credentials;
CREATE POLICY email_account_credentials_admin ON email_account_credentials
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_accounts e
      WHERE e.id = email_account_credentials.email_account_id
        AND can_manage_organization(e.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_accounts e
      WHERE e.id = email_account_credentials.email_account_id
        AND can_manage_organization(e.organization_id)
    )
  );

DROP POLICY IF EXISTS org_member_all ON ai_provider_configs;
CREATE POLICY ai_provider_configs_admin ON ai_provider_configs
  FOR ALL TO authenticated
  USING (can_manage_organization(organization_id))
  WITH CHECK (can_manage_organization(organization_id));

DROP POLICY IF EXISTS org_member_all ON api_keys;
CREATE POLICY api_keys_admin ON api_keys
  FOR ALL TO authenticated
  USING (can_manage_organization(organization_id))
  WITH CHECK (can_manage_organization(organization_id));

-- Audit rows are readable by members, but cannot be modified or deleted even
-- though the general organization policy remains permissive.
DROP POLICY IF EXISTS audit_events_update_deny ON audit_events;
CREATE POLICY audit_events_update_deny ON audit_events
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS audit_events_delete_deny ON audit_events;
CREATE POLICY audit_events_delete_deny ON audit_events
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- Explicitly keep audit inserts membership-scoped.
DROP POLICY IF EXISTS audit_events_insert_member ON audit_events;
CREATE POLICY audit_events_insert_member ON audit_events
  FOR INSERT TO authenticated
  WITH CHECK (can_access_organization(organization_id));
