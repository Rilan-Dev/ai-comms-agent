# CURRENT_PHASE.md

---

```yaml
phase: 3
phase_name: "Identity, Organization, Users, Roles & RBAC"
status: "implementation_complete_developer_verification_complete_chatgpt_acceptance_pending"
start_date: 2026-10-03
implementation_completion_date: 2026-10-03
architect: "ChatGPT (external)"
developer: "Z.AI"
chatgpt_acceptance: "pending"
phase_4_authorized: false

approved_scope: |
  Establish the production-grade identity, organization, user, membership,
  role, permission, and authorization foundation. Identity abstraction
  (not real auth provider). Organization/membership/RBAC model. Server-side
  authorization API. Dev-only identity stub (clearly marked). No production
  Supabase. No Phase 4 work.

phase_3_objectives_completed:
  - "User model (id, email, name, status, timestamps)"
  - "Organization model (id, name, slug, status, timestamps; unique slug)"
  - "OrganizationMembership model (explicit, with role + status)"
  - "Roles: owner, admin, member, viewer"
  - "Permissions: 9-entry catalogue (organization.*, users.*, audit.*, settings.*)"
  - "Role-permission mapping (SYSTEM_ROLE_PERMISSIONS)"
  - "Identity adapter abstraction (IdentityAdapter interface)"
  - "Dev-only identity stub (DevIdentityAdapter — throws in production)"
  - "Server-side authorization API (requireAuthenticatedUser, requireOrganizationMember, requirePermission, requireRole, authorize)"
  - "Organization isolation enforced (membership check, not client-supplied orgId)"
  - "SQL migration artifact (supabase/migrations/0001_identity_rbac.sql)"
  - "In-memory identity repository (for tests + dev)"
  - "40 automated tests (auth, org isolation, RBAC, constraints, dev-adapter guard)"

deliverables:
  schema:
    - supabase/migrations/0001_identity_rbac.sql
  shared_types:
    - packages/shared/src/identity/types.ts
  db_layer:
    - packages/db/src/identity/repository.ts
    - packages/db/src/identity/in-memory.ts
  authorization:
    - apps/web/src/lib/identity/authorization.ts
    - apps/web/src/lib/identity/dev-adapter.ts
    - apps/web/src/lib/identity/repository.ts
  api_routes:
    - apps/web/src/app/api/organizations/[id]/route.ts
    - apps/web/src/app/api/organizations/[id]/members/route.ts
    - apps/web/src/app/api/dev/seed/route.ts
  tests:
    - apps/web/tests/auth.test.ts (4 tests)
    - apps/web/tests/organization-isolation.test.ts (7 tests)
    - apps/web/tests/rbac.test.ts (14 tests)
    - apps/web/tests/database-constraints.test.ts (10 tests)
    - apps/web/tests/dev-adapter-guard.test.ts (5 tests)

forbidden_in_phase_3:
  - "Phase 4 database work (production Supabase provisioning, full data model)"
  - "Email/WhatsApp/agent/scheduling/voice implementation"
  - "Production authentication (password storage, OAuth, MFA)"
  - "Clara source modification"
  - "Application shell redesign"

exit_criteria:
  - "Identity, organization, membership, RBAC models exist"
  - "Server-side authorization enforced"
  - "Organization isolation tested (IDOR, cross-org denial)"
  - "Dev-only identity stub impossible to use in production"
  - "All tests pass (40/40)"
  - "Typecheck pass, build pass, secret scan clean"
  - "Existing routes (/ , /mail/inbox, /api/health) not broken"
  - "ChatGPT review: approve / reject / correct"

next_phase_if_approved: 4  # Database Foundation and Migrations
```

---

## Phase 3 status narrative

All Phase 3 objectives completed. The identity/organization/RBAC foundation is implemented with:

- **SQL migration** (`0001_identity_rbac.sql`): organizations, users, organization_memberships, roles, permissions, role_permissions tables with unique constraints (slug, email, membership), FK relationships, RLS policies, and system permission catalogue seed.
- **Shared types** (`packages/shared/src/identity/types.ts`): branded IDs (UserId, OrganizationId, etc.), entity interfaces, permission catalogue, system role-permission mapping, AuthSubject, IdentityAdapter interface, UnauthorizedError/ForbiddenError.
- **DB layer** (`packages/db/src/identity/`): IdentityRepository interface + InMemoryIdentityRepository implementation (enforces same constraints as SQL migration; for tests + dev).
- **Authorization API** (`apps/web/src/lib/identity/authorization.ts`): requireAuthenticatedUser, requireOrganizationMember, requirePermission, requireRole, authorize. Organization ID from URL path, not request body. authorizationErrorToResponse helper.
- **Dev identity stub** (`apps/web/src/lib/identity/dev-adapter.ts`): DevIdentityAdapter — reads x-dev-user-id header. **Throws in production** (structurally impossible to use). Clearly marked development-only.
- **API routes**: /api/organizations/[id] (GET, requires organization.read), /api/organizations/[id]/members (GET, requires organization.members.read), /api/dev/seed (POST, dev-only).
- **Tests** (40 tests, 5 files): auth (4), organization-isolation (7), rbac (14), database-constraints (10), dev-adapter-guard (5).

Verification: typecheck 5/5 pass, web build success (7 routes), worker build success, 40/40 tests pass, secret scan clean.

Phase 3 awaits ChatGPT acceptance review. Phase 4 NOT authorized.
