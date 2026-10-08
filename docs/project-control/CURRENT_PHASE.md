# CURRENT_PHASE.md — Phase 4 Database Foundation and Migrations

---

```yaml
phase: 4
phase_name: "Database Foundation and Migrations"
status: "implementation_in_progress"
start_date: 2026-10-03
phase_3_completion_date: 2026-10-04
architect: "ChatGPT"
developer: "ChatGPT"
chatgpt_acceptance_phase_3: "deferred while development proceeds by explicit project-owner instruction"
phase_4_authorized: true

phase_4_scope_authorized: |
  Stand up the complete PostgreSQL/PostgreSQL schema and migration foundation, including tenant RLS, indexes, constraints, credential encryption primitives, storage configuration, and typed database contracts. CI verification is intentionally deferred until the implementation set is complete.

phase_3_historical_scope: |
  Establish the production-grade identity, organization, user, membership,
  role, permission, and authorization foundation. Identity abstraction
  (not real auth provider). Organization/membership/RBAC model. Server-side
  authorization API. Dev-only identity stub (clearly marked). No production
  PostgreSQL. No Phase 4 work.

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
  - "SQL migration artifact (postgresql/migrations/0001_identity_rbac.sql)"
  - "In-memory identity repository (for tests + dev)"
  - "40 automated tests (auth, org isolation, RBAC, constraints, dev-adapter guard)"

deliverables:
  schema:
    - postgresql/migrations/0001_identity_rbac.sql
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
  - "Phase 4 database work (production PostgreSQL provisioning, full data model)"
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

**Phase 3 correction pass 1 (2026-10-03, commit bf8dea7):**
ChatGPT review found 4 corrections required:
- **Finding A (RBAC persistence)**: Removed disconnected `roles` and `role_permissions` tables from migration (Option A — defer custom-role persistence). Phase 3 uses the TypeScript `SYSTEM_ROLE_PERMISSIONS` mapping as the single authoritative RBAC model. The `permissions` catalogue table is retained as a reference table.
- **Finding B (Owner invariant)**: Enforced exactly-one-owner invariant in `InMemoryIdentityRepository`. `createMembership`, `updateMembershipRole`, and `updateMembershipStatus` now reject operations that would produce zero or multiple owners. Added `transferOwnership` method for atomic ownership transfer. Added `OwnerInvariantError` class.
- **Finding C (Permission catalogue documentation)**: Added §4.2a to `SECURITY_MODEL.md` documenting that Phase 3 implements identity/RBAC foundation permissions only; feature-domain permissions (agent.*, email.*, etc.) are deferred to their respective feature phases.
- **Finding D (Governance sync)**: Updated `PROJECT_STATE.md` to reflect Phase 3 correction state (removed stale Phase 2 language).

**Phase 3 final correction pass (2026-10-03, commit d4aa08b):**
ChatGPT review found 4 remaining items:
- **Correction 2 (SQL owner invariant)**: Added PostgreSQL trigger `enforce_owner_invariant()` to migration — enforces at most one active owner, owner must be active, final owner cannot be demoted/suspended. Schema-level invariant for production.
- **Correction 3 (Atomic org creation)**: Added `createOrganizationWithOwner()` to repository interface + in-memory implementation. Atomically creates organization + initial active owner. No window where org exists without owner.
- **Correction 4 (transferOwnership type safety)**: Changed `newOwnerRole` type from `MembershipRole` to `NonOwnerRole` (= `Exclude<MembershipRole, "owner">`). Compile-time error to pass "owner". Added runtime guard. Default remains "admin".
- **Owner membership status**: `createMembership` now rejects owner memberships with non-active status (matches SQL trigger Rule 2).

**Phase 3 transaction-safe owner invariant (2026-10-03, commit 4289e53):**
ChatGPT review found the statement-level BEFORE trigger was not transaction-safe (blocked valid ownership transfers, didn't cover DELETE). Corrected:
- **Layer 1 (immediate)**: `enforce_owner_status_active()` BEFORE INSERT OR UPDATE — per-row check that owner status must be active. Does not conflict with transfers.
- **Layer 2 (deferred)**: `enforce_exactly_one_owner()` CONSTRAINT TRIGGER AFTER INSERT OR UPDATE OR DELETE, DEFERRABLE INITIALLY DEFERRED — fires at COMMIT. Checks every org with memberships has exactly one active owner. Allows transient intermediate states within a transaction (ownership transfer). Covers DELETE (cannot delete final owner).
- **Organization creation boundary**: `createOrganization` marked `@internal`; `createOrganizationWithOwner` is the sole public creation workflow.
- **Test fixture**: uses `createOrganizationWithOwner` (not `createOrganization` + separate `createMembership`).
- **Migration static verification**: added `migration-verification.test.ts` (21 tests) verifying DEFERRABLE constraint trigger exists, covers INSERT/UPDATE/DELETE, roles/role_permissions absent, permissions catalogue present.

Tests: 91 total (8 files) — 40 original + 22 owner-invariant + 8 RBAC-persistence-consistency + 21 migration-verification. All pass.

RBAC persistence: Option A (system roles via TypeScript SYSTEM_ROLE_PERMISSIONS; `roles`/`role_permissions` tables deferred). Permission catalogue: 9 Phase 3 identity/RBAC foundation permissions only (feature-domain permissions deferred to feature phases).


**Takeover update (2026-10-04):** ChatGPT is now the primary implementer. The final PostgreSQL owner-invariant correction validates the affected organization directly for INSERT/UPDATE/DELETE, including the final-owner deletion case where no membership rows remain. CI now executes the web test suite and uses Node 24 to match the deployed runtime. Phase 3 acceptance remains pending until final verification evidence is complete.


**Latest acceptance findings (2026-10-04):** direct SQL organization INSERTs are now covered by a deferred organization-level owner trigger, and RLS membership checks now use pinned SECURITY DEFINER helpers to avoid recursive policy evaluation. Phase 4 remains unauthorized.


## ChatGPT takeover — runtime verification gate (2026-10-04)

The migration is now backed by disposable PostgreSQL 17 CI runtime verification. Phase 3 is still gated: do not authorize Phase 4 until the workflow proves the migration executes successfully and the owner invariant behaves correctly at transaction commit.


## Phase 4 — Database Foundation and Domain Schema

**Status: IMPLEMENTATION IN PROGRESS.** ChatGPT is primary implementer. Per explicit project-controller instruction on 2026-10-04, development continues without waiting for GitHub Actions/Vercel validation jobs. Validation remains a mandatory final gate after feature development is substantially complete.

Implemented so far: forward-only Phase 4 domain migration covering agents/versioning/deployments, multi-provider email accounts and mailbox data, sync state/events, WhatsApp, agent policies/tools, conversations, approvals, schedules, summaries, audit, AI usage, and realtime voice telemetry, with organization-scoped RLS and server-only credential/webhook policies.

UI implementation is also proceeding as a first-class product surface: modern workspace shell, dashboard, agents, mail accounts/inbox/threads/drafts, WhatsApp, automations, schedules, AI & Voice, Knowledge, Activity, Audit, and Settings workspaces.


### Development-first continuation update — 2026-10-04
Phase 4 is now the active development phase under the explicit development-first directive. The database foundation has been implemented as forward-only migrations 0002–0011 covering agents, email, WhatsApp, conversations, scheduling, automation, summaries, actions/approvals, AI usage, voice telemetry, audit, API keys, knowledge/storage metadata, cross-tenant integrity, RLS helper hardening, and server identity transaction RPCs. UI/UX modernization is continuing in parallel where it consumes stable host contracts. Do not claim Phase 4 acceptance until staging/runtime verification is completed.


current_commit: "fa8061d96628f8b1c59dadb3afde12d4f8588e3e"
\n\n### Phase 4 development authorization — 2026-10-04\nChatGPT has begun Phase 4 database-foundation implementation per the project owner's explicit instruction to continue development without waiting for CI verification. GitHub Actions push/PR triggers are enabled and include disposable PostgreSQL runtime verification. Phase acceptance remains gated on later runtime verification.\n

## Active Phase 4 implementation record

- `0002_database_foundation.sql` implements the full approved domain schema.
- `0003_database_security_hardening.sql` hardens helper exposure and secret-bearing RLS.
- `postgresql/config.toml` defines private attachment and knowledge-document buckets.
- `packages/db/src/security/envelope.ts` implements AES-256-GCM envelope encryption primitives.
- Automatic CI triggers are enabled; runtime verification remains mandatory before acceptance.


### Runtime gate update — 2026-10-04
- Main code baseline: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- Added disposable PostgreSQL runtime migration verification and ownerless-organization negative test to CI.
- GitHub Actions currently exposes no workflow run for the verification PR; therefore runtime execution is **PENDING**, not PASS.
- Vercel's latest production deployment for this commit was canceled by the project's ignored-build/build-rate-limit path; no latest READY claim is made.
- **Phase 3 acceptance: PENDING. Phase 4: NOT AUTHORIZED.**


### PostgreSQL-native continuation — 2026-10-05
- Database runtime is provider-neutral PostgreSQL 15+; Supabase is not required.
- Added the application foundation migration covering agents, email, WhatsApp, conversations, scheduling, automations, approvals, summaries, AI provider configuration, usage, voice, and audit.
- Added tenant RLS helpers and append-only audit enforcement.
- Replaced the DB runtime boundary with node-postgres and self-hosted Docker PostgreSQL.
- Real secrets remain outside Git; `.env.docker.example` is the committed host template and `.env.docker` is intentionally ignored.
\n

**External infrastructure correction (2026-10-05):** PostgreSQL, Redis, RabbitMQ, and Qdrant are no longer treated as automatically provisioned development services. Docker Compose services are explicitly gated behind the `local-infra` profile. The application/deployment contract uses externally provisioned connection URLs. The tracked local `.env` was removed; `.env.example` now documents external-service variables only.

**Additional migration hardening:** corrected remaining malformed PostgreSQL dollar-quote terminators, rejected `owner` as the previous owner's replacement role in SQL ownership transfer, and moved SECURITY DEFINER RLS helpers into a non-exposed `private` schema with pinned empty search_path and restricted EXECUTE grants.

## 2026-10-05 — Infrastructure boundary and verification correction

- **Deployment infrastructure policy:** PostgreSQL, Redis, RabbitMQ, and Qdrant are external runtime dependencies; Docker Compose services are opt-in under the `local-infra` profile and are never started by the normal source verification path.
- **Verification policy:** `pnpm run verify` / `scripts/verify.sh` performs source/type/test/build checks only. `scripts/verify-docker.sh` is explicit opt-in disposable PostgreSQL verification.
- **Latest infrastructure correction:** `infra/docker-compose.verify.yml` now uses the actual `postgres` service hostname.
- **CI:** GitHub Actions uses its own disposable PostgreSQL service for runtime migration checks; this is CI infrastructure, not deployment provisioning.
- **Latest known Vercel status:** the Vercel status for the latest code is `failure` due to build-rate-limit; no READY claim is made.
- **Phase 4:** remains the active development phase under the project-owner development-first instruction. Runtime validation remains a release/acceptance gate, not a source-development blocker.


### 2026-10-05 — Phase 4 migration-chain correction
- Local disposable PostgreSQL verification exposed a real schema defect: `0002_agent_foundation.sql` and `0002_application_foundation.sql` both defined `agents`, `agent_versions`, and related objects with incompatible columns. The application migration attempted to add `agents_current_version_fk` against a column that did not exist on the already-created table.
- Corrective action: `0002_application_foundation.sql` is now the single authoritative Phase 4 application/agent foundation migration. The richer agent version/deployment/policy fields were consolidated into it, and the duplicate `0002_agent_foundation.sql` migration was removed before production application.
- Latest correction commit: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- Required next verification: pull `main` and rerun `bash scripts/verify-docker.sh`; then inspect CI runtime result. Do not claim Phase 4 acceptance until the full migration chain passes.


### Runtime verification finding — 2026-10-05
- Local disposable PostgreSQL verification reached `0002_database_foundation.sql` successfully but failed because its `can_access_organization()` helper referenced Phase 3 RLS helpers without the `private.` schema qualification.
- Corrected in commit `d2da078e406a96fce7245dcd753b2e7f1ab87d74`: `private.is_active_organization_member(...)` and `private.is_active_organization_admin_or_owner(...)` are now explicitly qualified.
- This is a real runtime migration defect caught by the verification harness; it is not a false-positive static test issue.
- Phase 3 acceptance remains pending until the disposable PostgreSQL verification is rerun successfully, including ownerless-organization rejection.
- Phase 4 remains NOT AUTHORIZED.


### ChatGPT takeover verification update — 2026-10-06

- Latest code correction commit: `557951a49fd93d07877ef4361f616d331be4d226`.
- CI now provisions PostgreSQL 17, applies `supabase/migrations/0001_identity_rbac.sql`, then executes runtime owner/RLS verification and an expected-failure ownerless-organization check.
- Static migration verification now checks the actual private SECURITY DEFINER helper declarations and their pinned empty search_path.
- Phase 3 acceptance remains pending until CI produces a successful runtime result. Phase 4 remains unauthorized.


## ChatGPT authorization — 2026-10-06

Phase 4 is now the active implementation phase. ChatGPT has taken primary implementation ownership and authorized direct implementation of the approved database foundation. GitHub Actions and Vercel completion are verification evidence, not prerequisites for continuing implementation. PostgreSQL runtime migration/RLS verification remains required for Phase 4 acceptance. Phase 5 remains unauthorized until Phase 4 exit criteria are met.


### 2026-10-06 — Email Accounts development checkpoint
ChatGPT is continuing the product-completion Email Accounts slice under the development-first override. Current implementation includes persisted IMAP/SMTP connection testing and reconnect, provider-aware reconnect UI, connection error visibility, Gmail/Zoho OAuth flows, and Zoho regional refresh hardening. No runtime/provider credential verification is claimed.


### 2026-10-06 — Mail implementation continuation
Development-first Mail work now includes real persisted thread navigation, read-state mutation, reply approval requests, and a pending approval queue. Sensitive provider execution remains isolated to the worker executor. Continue the Mail slice before advancing the product-completion menu gate.
\n\n### 2026-10-06 — Mail draft/action continuation\nImplementation continues under Phase 4 development-first execution. Persisted drafts now have list/retrieve/update/delete lifecycle and Forward is wired to approval-safe actions. Runtime acceptance remains a later gate. Next concrete implementation target is provider-backed draft result synchronization and secure attachment retrieval/handling.\n

### 2026-10-06 — Durable scheduler and automation runtime
- Implemented PostgreSQL `FOR UPDATE SKIP LOCKED` claiming for due scheduled jobs and durable scheduled-job run lifecycle updates.
- Added timezone-aware five-field cron matching/next-fire calculation in the worker.
- Added a worker-owned agent execution dispatch boundary shared by schedule and automation sources; unsupported execution reports configuration-required instead of fabricating provider/AI success.
- Added deterministic automation trigger/condition evaluation and durable automation run lifecycle.
- Worker lifecycle now runs the scheduler tick every 15 seconds when PostgreSQL is configured.
- Added worker tests for cron calculation and automation matching.
- **Next:** implement the Clara-backed agent execution adapter, then route concrete scheduled/automation actions through the existing approval-safe email/WhatsApp workers.


### 2026-10-06 — Clara-backed execution continuation
The worker execution boundary now calls Clara's immutable `claraRuntime.createChatTurn()` with tenant/agent context and hybrid RAG, consuming the returned stream and persisting provider/model/output in scheduled and automation runs. `CLARA_KB_ID` is an explicit runtime configuration boundary; missing configuration fails truthfully.
\n\n### 2026-10-06 — Settings / Organization implementation continuation
- Added organization settings and membership read APIs with organization-scoped authorization.
- Added authorized member role/status management and owner-transfer routing through the invariant-safe repository method.
- Settings UI now renders persisted organization/member state and exposes live role/status controls; owner cannot be demoted directly.
- Next product implementation: Activity/Audit/Operations surfaces and security-sensitive audit visibility.


### 2026-10-06 — Activity/Audit/Operations + E2E hardening continuation
- Activity/Audit/Operations now has server-side filtering, authorized JSON/CSV export, organization-scoped operational signals, and a real Operations workspace.
- Automated agent execution now rejects email accounts that are not owned by the current organization and explicitly bound to the executing agent; automated email/WhatsApp action requests are audited.
- Overview metrics/activity are now loaded from persisted organization state instead of hard-coded demo values.
- Added product-completion contract tests for authorization, export, overview integrity, and cross-tenant execution boundaries.
- Continue cross-surface E2E hardening without waiting for CI/Vercel.

### 2026-10-07 — Scheduled fire idempotency hardening

ChatGPT continued development-first cross-surface hardening. Scheduled job claims now persist the exact `fire_at` timestamp and use a PostgreSQL unique index on `(scheduled_job_id, fire_at)` with conflict-safe claiming, preventing duplicate run creation when multiple worker ticks race on the same due fire. Added a deterministic worker contract fixture for the migration/repository boundary. Runtime validation remains deferred; do not wait for CI/Vercel.


### 2026-10-08 — Deterministic cross-surface scenario runner
The deterministic PostgreSQL E2E path is now executable through a dedicated scenario runner. It connects the existing stable fixtures to real database repositories for email approval retries, WhatsApp outbound retries, scheduled claims, organization isolation, and correlation-scoped audit reads. Provider delivery remains intentionally external and un-fabricated.

**Next:** sensitive-action worker execution/error routing, including deterministic failure propagation and audit continuity.
