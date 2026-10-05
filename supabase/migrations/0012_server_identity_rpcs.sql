-- Phase 4: server-side organization creation transaction.
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name text,
  p_slug text,
  p_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_org organizations%ROWTYPE;
  created_membership organization_memberships%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_id IS NULL AND false
    ) THEN
      RAISE EXCEPTION 'Authenticated caller may only create an organization for self' USING ERRCODE='insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO organizations(name,slug)
  VALUES (p_name,p_slug)
  RETURNING * INTO created_org;

  INSERT INTO organization_memberships(organization_id,user_id,role,status)
  VALUES (created_org.id,p_owner_id,'owner','active')
  RETURNING * INTO created_membership;

  RETURN jsonb_build_object(
    'organization', to_jsonb(created_org),
    'membership', to_jsonb(created_membership)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION create_organization_with_owner(text,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_organization_with_owner(text,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION create_organization_with_owner(text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_with_owner(text,text,uuid) TO service_role;

GRANT EXECUTE ON FUNCTION transfer_organization_ownership(uuid,uuid,membership_role) TO service_role;
