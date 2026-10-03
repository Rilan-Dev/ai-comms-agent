# Phase 3 Acceptance and Phase 4 Database Foundation Implementation Plan

> **For agentic workers:** Use this plan task-by-task with TDD and verification before completion.

**Goal:** Complete the remaining Phase 3 database invariant correction, formally accept Phase 3, then implement the approved Phase 4 PostgreSQL/Supabase database foundation without changing the product objective.

**Architecture:** PostgreSQL/Supabase is the authoritative persistence layer. Phase 3 system RBAC remains TypeScript-authoritative; Phase 4 adds the production database adapter and approved domain schema incrementally. Clara remains a pinned immutable submodule and is consumed only through the existing `packages/clara-core` boundary.

**Tech Stack:** Next.js 15, TypeScript, pnpm, PostgreSQL/Supabase, Vitest, Vercel, Clara submodule.

**Spec:** `docs/plans/ROADMAP.md`, `docs/architecture/DATA-MODEL.md`, `docs/architecture/DOMAIN_MODEL.md`, `docs/architecture/SECURITY_MODEL.md`, `docs/project-control/RULES.md`.

## Global Constraints

- Preserve the approved product objective and phase ordering.
- Do not modify `vendor/clara/` or Clara source.
- Do not introduce billing/subscriptions/marketplace functionality.
- PostgreSQL/Supabase remains authoritative persistence.
- System roles remain owner/admin/member/viewer; custom-role persistence remains deferred.
- Every existing organization must have exactly one active owner.
- Sensitive authorization remains server-side.
- Do not claim production database verification until an actual database is provisioned and tested.
- Update project-control documents and `worklog.md` on every implementation commit.
- GitHub `main` remains the source of truth; no history rewriting.

## Review Focus

1. Final-owner deletion must fail at transaction commit while replacement-owner transactions succeed.
2. Organization creation must never expose a path that intentionally leaves an ownerless organization.
3. Phase 4 migrations must preserve identity/RBAC invariants and RLS.
4. Database adapter behavior must match repository contracts and organization isolation.
5. UI must never expose privileged actions without server-side authorization.

### Task 1: Close the Phase 3 owner-invariant gap

**Files:**
- Modify: `supabase/migrations/0001_identity_rbac.sql`
- Modify: `apps/web/tests/migration-verification.test.ts`
- Modify: `docs/project-control/PROJECT_STATE.md`
- Modify: `docs/project-control/CURRENT_PHASE.md`
- Modify: `docs/project-control/NEXT_ACTION.md`
- Modify: `docs/project-control/VERIFICATION_STATE.md`
- Modify: `worklog.md`

**Interfaces:** Preserve `createOrganizationWithOwner()`, `NonOwnerRole`, and `transferOwnership()`. The deferred SQL trigger must validate affected existing organizations even when the final membership row was deleted.

- [ ] Add static regression assertions for INSERT/UPDATE/DELETE affected-org handling and zero-membership detection.
- [ ] Replace the deferred function body with transaction-end validation of each affected existing organization, including OLD/NEW IDs.
- [ ] Keep the immediate owner-status trigger.
- [ ] Run migration-verification and owner-invariant tests.
- [ ] Update governance after verification.
- [ ] Commit and push.

### Task 2: Phase 3 acceptance gate

**Files:** project-control files.

- [ ] Verify actual GitHub HEAD and the complete Phase 3 diff.
- [ ] Verify the final Vercel deployment.
- [ ] Record Phase 3 APPROVED and Phase 4 AUTHORIZED only after evidence is green.
- [ ] Commit the governance transition.

### Task 3: Phase 4 database foundation planning

**Files:**
- Create: `docs/superpowers/plans/2026-10-04-phase-4-database-foundation.md`
- Modify: project-control files as needed.

- [ ] Map Phase 4 entities to migrations and repository interfaces.
- [ ] Identify indexes, foreign keys, RLS, audit/idempotency requirements.
- [ ] Produce the executable Phase 4 implementation plan.
- [ ] Commit the plan and governance update.

### Task 4: Phase 4 PostgreSQL/Supabase implementation

**Files:** determined by Task 3.

- [ ] Implement migrations incrementally.
- [ ] Add failing database/repository tests before each behavior.
- [ ] Implement the Supabase/PostgreSQL repository.
- [ ] Verify organization isolation and RBAC against database semantics.
- [ ] Run typecheck, tests, build, security checks.
- [ ] Provision/apply Supabase only when the approved Phase 4 environment requirements are satisfied.

### Task 5: Phase 4 completion and handoff

**Files:** project-control documents and `worklog.md`.

- [ ] Perform whole-branch review.
- [ ] Fix Critical/Important findings with RED→GREEN tests.
- [ ] Verify deployment.
- [ ] Record Phase 4 acceptance state.
- [ ] Prepare the next phase handoff without starting Phase 5 prematurely.
