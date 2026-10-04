-- Phase 3: Identity, Organization, Users, Roles & RBAC
--
-- This migration establishes the identity and authorization foundation.
-- Per Phase 3 scope: no production Supabase provisioning. This is a schema
-- artifact. Forward-only migration, named per DATA-MODEL.md conventions.
--
-- Extensions required: pgcrypto (for gen_random_uuid()), citext (case-insensitive email).
--
-- Per ADR-009: PostgreSQL/Supabase remains approved infrastructure.
-- Per SECURITY_MODEL.md §4: RBAC with owner/admin/member/viewer roles.
-- Per DOMAIN_MODEL.md §2: Organization, User, Membership, Role, Permission.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- Enumerations
-- ============================================================================

-- Organization membership role (per DOMAIN_MODEL.md §2.3)
DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Membership status (per Phase 3 handoff §9: active/suspended/invited)
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('active', 'suspended', 'invited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User status (per DOMAIN_MODEL.md §2.2 lifecycle)
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Organization status (per DOMAIN_MODEL.md §2.1 lifecycle)
DO $$ BEGIN
  CREATE TYPE organization_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL,
  status      organization_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Unique organization slug (per Phase 3 handoff §7)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_uniq
  ON organizations (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS organizations_status_idx
  ON organizations (status);

-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  name        text,
  avatar_url  text,
  status      user_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Email uniqueness (case-insensitive via citext) for non-deleted users
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq
  ON users (email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS users_status_idx
  ON users (status);

-- ============================================================================
-- Organization Memberships (explicit, per Phase 3 handoff §9)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            membership_role NOT NULL,
  status          membership_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- A user can have only one membership per organization (per DATA-MODEL.md §1)
CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_org_user_uniq
  ON organization_memberships (organization_id, user_id);

CREATE INDEX IF NOT EXISTS organization_memberships_user_idx
  ON organization_memberships (user_id);

CREATE INDEX IF NOT EXISTS organization_memberships_org_idx
  ON organization_memberships (organization_id);

CREATE INDEX IF NOT EXISTS organization_memberships_status_idx
  ON organization_memberships (status);

-- ============================================================================
-- Permissions (system-defined catalogue, per SECURITY_MODEL.md §4.2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Permission name uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS permissions_name_uniq
  ON permissions (name);

-- ============================================================================
-- Roles & Role-Permissions: DEFERRED (Phase 3 correction — Option A)
-- ============================================================================
--
-- Phase 3 uses four immutable system roles (owner, admin, member, viewer)
-- resolved via the TypeScript SYSTEM_ROLE_PERMISSIONS mapping in
-- packages/shared/src/identity/types.ts. The persisted `roles` and
-- `role_permissions` tables are NOT needed for system-role authorization
-- and would create a disconnected competing RBAC model (dead data).
--
-- Per DATA-MODEL.md §1, the `roles`/`role_permissions` tables are the
-- target schema for when custom per-organization roles are introduced.
-- Custom roles are explicitly "optional (Phase 3)" per DOMAIN_MODEL.md §2.3
-- and ROADMAP.md Phase 3 scope. They are deferred to a later phase.
--
-- The `permissions` catalogue table below is retained as a reference
-- table (it documents the system permission catalogue and is harmless),
-- but it is NOT consulted at runtime — the TypeScript PERMISSION_CATALOGUE
-- is the authoritative source for Phase 3.

-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS organization_memberships_updated_at ON organization_memberships;
CREATE TRIGGER organization_memberships_updated_at BEFORE UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Owner Invariant Enforcement (Phase 3 — transaction-safe final correction)
-- ============================================================================
-- Per DOMAIN_MODEL.md §2.1: "An organization must have exactly one owner at
-- all times." This is a CROSS-ROW, CROSS-STATEMENT invariant that cannot be
-- enforced by a simple CHECK constraint or a statement-level BEFORE trigger.
--
-- A valid ownership transfer requires a transient intermediate state within
-- a single transaction:
--   Statement 1: old owner -> admin (temporarily zero owners)
--   Statement 2: target member -> owner (back to one owner)
--   COMMIT -> invariant satisfied
--
-- A statement-level BEFORE trigger would reject statement 1, making transfers
-- impossible. Therefore we use a two-layer mechanism:
--
-- Layer 1 (immediate, BEFORE INSERT OR UPDATE):
--   enforce_owner_status_active() — a per-row check that owner memberships
--   must have status='active'. This does NOT conflict with ownership transfer
--   because the status of an owner is always 'active' (you cannot have an
--   invited or suspended owner).
--
-- Layer 2 (deferred, CONSTRAINT TRIGGER AFTER INSERT OR UPDATE OR DELETE,
--   DEFERRABLE INITIALLY DEFERRED):
--   enforce_exactly_one_owner() — fires at transaction COMMIT. Checks every
--   organization that was touched by the transaction has exactly one active
--   owner. This allows transient intermediate states within the transaction
--   while guaranteeing the invariant at COMMIT.
--
-- This is a schema-level invariant intended for production application of the
-- migration. Phase 3 does NOT provision Supabase or apply this migration to
-- production — it is a schema artifact.

-- ---------------------------------------------------------------------------
-- Layer 1: Immediate per-row check — owner status must be active
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_owner_status_active()
RETURNS TRIGGER AS $$
BEGIN
  -- An owner membership must be active (cannot be invited/suspended).
  -- This is safe to enforce immediately because it never conflicts with
  -- ownership transfer — an owner is always active.
  IF NEW.role = 'owner' AND NEW.status != 'active' THEN
    RAISE EXCEPTION 'Owner membership must have status active (got: %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_memberships_owner_status ON organization_memberships;
CREATE TRIGGER organization_memberships_owner_status
  BEFORE INSERT OR UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION enforce_owner_status_active();

-- ---------------------------------------------------------------------------
-- Layer 2: Deferred constraint trigger — exactly one active owner at COMMIT
-- ---------------------------------------------------------------------------

-- Collects all organizations touched by the current transaction (via INSERT,
-- UPDATE, or DELETE on organization_memberships) and verifies each has
-- exactly one active owner. Fires at COMMIT due to DEFERRABLE INITIALLY
-- DEFERRED.

CREATE OR REPLACE FUNCTION enforce_exactly_one_owner()
RETURNS TRIGGER AS $$
DECLARE
  affected_org_id uuid;
  owner_count integer;
  org_exists boolean;
BEGIN
  /*
   * This is a deferred constraint trigger, so this function observes the
   * transaction's final state. We validate every organization whose
   * membership rows were affected by this trigger invocation.
   *
   * INSERT: NEW organization is affected.
   * DELETE: OLD organization is affected, including the final membership
   *         deletion that leaves no membership rows to iterate over.
   * UPDATE: NEW organization is affected; if organization_id is ever changed,
   *         OLD is also affected so the old organization cannot become
   *         ownerless.
   *
   * An organization being deleted itself is intentionally skipped: its
   * membership rows may be removed by ON DELETE CASCADE, but the organization
   * no longer exists and therefore does not violate the invariant.
   */
  IF TG_OP = 'INSERT' THEN
    affected_org_id := NEW.organization_id;

    SELECT EXISTS (
      SELECT 1 FROM organizations WHERE id = affected_org_id
    ) INTO org_exists;

    IF org_exists THEN
      SELECT count(*) INTO owner_count
      FROM organization_memberships
      WHERE organization_id = affected_org_id
        AND role = 'owner'
        AND status = 'active';

      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Organization % has no active owner at commit (exactly one required)',
          affected_org_id
          USING ERRCODE = 'check_violation';
      ELSIF owner_count > 1 THEN
        RAISE EXCEPTION 'Organization % has % active owners at commit (exactly one required)',
          affected_org_id, owner_count
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    affected_org_id := OLD.organization_id;

    SELECT EXISTS (
      SELECT 1 FROM organizations WHERE id = affected_org_id
    ) INTO org_exists;

    IF org_exists THEN
      SELECT count(*) INTO owner_count
      FROM organization_memberships
      WHERE organization_id = affected_org_id
        AND role = 'owner'
        AND status = 'active';

      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Organization % has no active owner at commit (exactly one required)',
          affected_org_id
          USING ERRCODE = 'check_violation';
      ELSIF owner_count > 1 THEN
        RAISE EXCEPTION 'Organization % has % active owners at commit (exactly one required)',
          affected_org_id, owner_count
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

  ELSE
    -- UPDATE: validate NEW organization and, defensively, OLD organization
    -- when organization_id changes in the same row update.
    affected_org_id := NEW.organization_id;

    SELECT EXISTS (
      SELECT 1 FROM organizations WHERE id = affected_org_id
    ) INTO org_exists;

    IF org_exists THEN
      SELECT count(*) INTO owner_count
      FROM organization_memberships
      WHERE organization_id = affected_org_id
        AND role = 'owner'
        AND status = 'active';

      IF owner_count = 0 THEN
        RAISE EXCEPTION 'Organization % has no active owner at commit (exactly one required)',
          affected_org_id
          USING ERRCODE = 'check_violation';
      ELSIF owner_count > 1 THEN
        RAISE EXCEPTION 'Organization % has % active owners at commit (exactly one required)',
          affected_org_id, owner_count
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      affected_org_id := OLD.organization_id;

      SELECT EXISTS (
        SELECT 1 FROM organizations WHERE id = affected_org_id
      ) INTO org_exists;

      IF org_exists THEN
        SELECT count(*) INTO owner_count
        FROM organization_memberships
        WHERE organization_id = affected_org_id
          AND role = 'owner'
          AND status = 'active';

        IF owner_count != 1 THEN
          RAISE EXCEPTION 'Organization % has % active owners at commit (exactly one required)',
            affected_org_id, owner_count
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- CONSTRAINT TRIGGER with DEFERRABLE INITIALLY DEFERRED:
-- This fires at COMMIT, not at each statement. This allows ownership transfer
-- transactions (old owner -> admin, then target -> owner) to have a transient
-- zero-owner state, while still rejecting a transaction that commits with
-- zero or multiple active owners. DELETE is included so removing the final
-- membership cannot leave an existing organization ownerless.
DROP TRIGGER IF EXISTS organization_memberships_owner_count ON organization_memberships;
CREATE CONSTRAINT TRIGGER organization_memberships_owner_count
  AFTER INSERT OR UPDATE OR DELETE ON organization_memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_exactly_one_owner();

-- An INSERT into organizations does not fire the membership trigger. Add a
-- deferred trigger on organizations so direct SQL cannot commit an existing
-- organization with zero memberships/owners. The membership trigger above
-- still validates membership INSERT/UPDATE/DELETE and ownership transfers.
CREATE OR REPLACE FUNCTION enforce_organization_has_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_count integer;
BEGIN
  -- For INSERT/UPDATE, the organization exists at deferred execution time.
  -- DELETE is intentionally not included: deleting the organization itself
  -- removes the invariant's subject, and membership rows are removed by the
  -- organization_memberships FK cascade.
  SELECT count(*) INTO owner_count
  FROM organization_memberships
  WHERE organization_id = NEW.id
    AND role = 'owner'
    AND status = 'active';

  IF owner_count = 0 THEN
    RAISE EXCEPTION 'Organization % has no active owner at commit (exactly one required)',
      NEW.id
      USING ERRCODE = 'check_violation';
  ELSIF owner_count > 1 THEN
    RAISE EXCEPTION 'Organization % has % active owners at commit (exactly one required)',
      NEW.id, owner_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_owner_count ON organizations;
CREATE CONSTRAINT TRIGGER organizations_owner_count
  AFTER INSERT OR UPDATE ON organizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_organization_has_owner();

-- ============================================================================
-- Row-Level Security (per SECURITY_MODEL.md §3 and RULES.md §11)
-- "authenticated alone is never authorization"
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can see organizations they are a member of.
-- The application layer (authorization API) enforces fine-grained permissions.
-- Service-role bypasses RLS (workers only); anon/authenticated use these policies.
--
-- IMPORTANT: policies must not directly query organization_memberships because
-- that table is itself protected by RLS. Direct/self-referential policy
-- subqueries can recurse (SQLSTATE 42P17). The membership checks therefore
-- live in SECURITY DEFINER helpers with a pinned search_path. The functions
-- are read-only and reproduce the exact membership predicate required by the
-- policies while bypassing RLS for their internal membership lookup.

CREATE OR REPLACE FUNCTION is_active_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = p_user_id
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
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  );
$$;

CREATE POLICY organizations_member_visibility ON organizations
  FOR SELECT USING (
    is_active_organization_member(
      organizations.id,
      current_setting('app.user_id', true)::uuid
    )
  );

CREATE POLICY users_self_visibility ON users
  FOR SELECT USING (
    id = current_setting('app.user_id', true)::uuid
  );

CREATE POLICY memberships_member_visibility ON organization_memberships
  FOR SELECT USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR is_active_organization_admin_or_owner(
      organization_memberships.organization_id,
      current_setting('app.user_id', true)::uuid
    )
  );

-- Permissions catalogue is globally readable (it's a system reference table)
CREATE POLICY permissions_global_read ON permissions
  FOR SELECT USING (true);

-- ============================================================================
-- Seed: System permission catalogue (Phase 3 identity/RBAC foundation only)
-- ============================================================================
--
-- Per Phase 3 correction Finding C: Phase 3 implements the identity and
-- organization RBAC foundation permissions only. Feature-domain permissions
-- (agent.*, email.*, whatsapp.*, schedule.*) are introduced with their
-- respective feature phases and must not be treated as missing Phase 3
-- functionality.
--
-- The TypeScript PERMISSION_CATALOGUE in packages/shared/src/identity/types.ts
-- is the authoritative source. This SQL seed is a reference/documentation
-- artifact; runtime authorization uses SYSTEM_ROLE_PERMISSIONS (TypeScript).

INSERT INTO permissions (name, description) VALUES
  -- Organization (Phase 3)
  ('organization.read',          'View organization details'),
  ('organization.update',        'Update organization settings'),
  ('organization.members.read',  'View organization members'),
  ('organization.members.manage', 'Invite, remove, or change member roles'),
  -- Users (Phase 3)
  ('users.read',                 'View user profiles within the organization'),
  ('users.manage',               'Manage user accounts'),
  -- Audit (Phase 3)
  ('audit.read',                 'View audit log'),
  -- Settings (Phase 3)
  ('settings.read',              'View organization settings'),
  ('settings.manage',            'Manage organization settings')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- System role → permission mapping (authoritative: TypeScript, documented here)
-- ============================================================================
--
-- The authoritative role-permission mapping for Phase 3 is the TypeScript
-- constant SYSTEM_ROLE_PERMISSIONS in packages/shared/src/identity/types.ts.
-- It is NOT persisted in the database because system roles are immutable.
--
--   owner:  all 9 Phase 3 permissions
--   admin:  organization.read, organization.members.read, users.read,
--           audit.read, settings.read, settings.manage (6 permissions)
--   member: organization.read, users.read (2 permissions)
--   viewer: organization.read (1 permission — least privilege)
--
-- Custom per-organization roles (with persisted role_permissions) are
-- deferred to a later phase. When introduced, a new migration will create
-- the `roles` and `role_permissions` tables and the application layer will
-- consult them for custom roles while continuing to use SYSTEM_ROLE_PERMISSIONS
-- for the four system roles.
