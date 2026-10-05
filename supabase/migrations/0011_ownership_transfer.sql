-- Phase 4: transactional database ownership transfer.
CREATE OR REPLACE FUNCTION transfer_organization_ownership(
  p_organization_id uuid,
  p_new_owner_id uuid,
  p_new_owner_role membership_role DEFAULT 'admin'
)
RETURNS SETOF organization_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner organization_memberships%ROWTYPE;
  target_member organization_memberships%ROWTYPE;
  caller_role membership_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_new_owner_role = 'owner' THEN
    RAISE EXCEPTION 'new owner role must be non-owner' USING ERRCODE='check_violation';
  END IF;

  SELECT role INTO caller_role
  FROM organization_memberships
  WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  FOR UPDATE;

  IF caller_role IS NULL OR caller_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only an organization owner or admin can transfer ownership' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO current_owner
  FROM organization_memberships
  WHERE organization_id = p_organization_id
    AND role = 'owner'
    AND status = 'active'
  FOR UPDATE;

  IF current_owner.id IS NULL THEN
    RAISE EXCEPTION 'Organization has no active owner' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO target_member
  FROM organization_memberships
  WHERE organization_id = p_organization_id
    AND user_id = p_new_owner_id
    AND status = 'active'
  FOR UPDATE;

  IF target_member.id IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active organization member' USING ERRCODE='check_violation';
  END IF;

  IF target_member.id = current_owner.id THEN
    RETURN NEXT current_owner;
    RETURN;
  END IF;

  UPDATE organization_memberships
  SET role = p_new_owner_role, updated_at = now()
  WHERE id = current_owner.id;

  UPDATE organization_memberships
  SET role = 'owner', updated_at = now()
  WHERE id = target_member.id;

  RETURN QUERY
  SELECT *
  FROM organization_memberships
  WHERE id IN (current_owner.id, target_member.id)
  ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END;
END;
$$;

REVOKE EXECUTE ON FUNCTION transfer_organization_ownership(uuid,uuid,membership_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION transfer_organization_ownership(uuid,uuid,membership_role) FROM anon;
GRANT EXECUTE ON FUNCTION transfer_organization_ownership(uuid,uuid,membership_role) TO authenticated;
