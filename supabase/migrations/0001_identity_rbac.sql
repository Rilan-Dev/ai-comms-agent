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
-- Roles (per-organization role definitions, per DATA-MODEL.md §1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_system_role  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Role name uniqueness within an organization
CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_uniq
  ON roles (organization_id, name);

CREATE INDEX IF NOT EXISTS roles_org_idx
  ON roles (organization_id);

-- ============================================================================
-- Role-Permission Mapping (many-to-many, per DATA-MODEL.md §1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON role_permissions (permission_id);

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
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

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

-- Roles/permissions are visible to members of the owning organization
CREATE POLICY roles_member_visibility ON roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.organization_id = roles.organization_id
        AND m.user_id = current_setting('app.user_id', true)::uuid
        AND m.status = 'active'
    )
  );

-- Permissions catalogue is globally readable (it's a system reference table)
CREATE POLICY permissions_global_read ON permissions
  FOR SELECT USING (true);

-- Role-permissions visible when the role's org is visible
CREATE POLICY role_permissions_member_visibility ON role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN organization_memberships m ON m.organization_id = r.organization_id
      WHERE r.id = role_permissions.role_id
        AND m.user_id = current_setting('app.user_id', true)::uuid
        AND m.status = 'active'
    )
  );

-- ============================================================================
-- Seed: System permission catalogue (per SECURITY_MODEL.md §4.2)
-- Only permissions required by the Phase 3 authorization foundation are seeded.
-- Future feature permissions are defined as planned but NOT seeded as existing.
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
  -- Organization
  ('organization.read',          'View organization details'),
  ('organization.update',        'Update organization settings'),
  ('organization.members.read',  'View organization members'),
  ('organization.members.manage', 'Invite, remove, or change member roles'),
  -- Users
  ('users.read',                 'View user profiles within the organization'),
  ('users.manage',               'Manage user accounts'),
  -- Audit
  ('audit.read',                 'View audit log'),
  -- Settings
  ('settings.read',              'View organization settings'),
  ('settings.manage',            'Manage organization settings')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Seed: System role templates (created per-organization via application layer)
-- The application layer creates owner/admin/member/viewer roles for each org
-- and assigns the appropriate permissions. This is done in the repository
-- layer, not in this migration, to keep the migration idempotent.
-- ============================================================================

-- Role permission mapping (documented here, applied by application layer):
--
-- owner:   all permissions (organization.*, users.*, audit.*, settings.*)
-- admin:   organization.read, organization.members.read, users.read, audit.read, settings.read, settings.manage
-- member:  organization.read, users.read
-- viewer:  organization.read
