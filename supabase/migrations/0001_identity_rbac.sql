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

CREATE POLICY organizations_member_visibility ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.organization_id = organizations.id
        AND m.user_id = current_setting('app.user_id', true)::uuid
        AND m.status = 'active'
    )
  );

CREATE POLICY users_self_visibility ON users
  FOR SELECT USING (
    id = current_setting('app.user_id', true)::uuid
  );

CREATE POLICY memberships_member_visibility ON organization_memberships
  FOR SELECT USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM organization_memberships m2
      WHERE m2.organization_id = organization_memberships.organization_id
        AND m2.user_id = current_setting('app.user_id', true)::uuid
        AND m2.status = 'active'
        AND m2.role IN ('owner', 'admin')
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
