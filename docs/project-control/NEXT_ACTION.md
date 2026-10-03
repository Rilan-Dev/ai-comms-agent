# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Perform the Phase 3 acceptance review. Decide one of:
    (a) ACCEPT — Phase 3 is accepted; issue the Phase 4 Z.AI_HANDOFF.
    (b) REJECT  — Phase 3 has fundamental gaps; issue a correction handoff.
    (c) CORRECT — Phase 3 is mostly accepted but specific corrections are required.

context:
  phase_3_implementation: "complete"
  developer_verification: "complete (typecheck 5/5, build pass, 40/40 tests pass, secret scan clean)"
  chatgpt_acceptance: "pending"

artifacts_to_review:
  # Schema
  - supabase/migrations/0001_identity_rbac.sql
  # Shared types
  - packages/shared/src/identity/types.ts
  # DB layer
  - packages/db/src/identity/repository.ts
  - packages/db/src/identity/in-memory.ts
  # Authorization API
  - apps/web/src/lib/identity/authorization.ts
  - apps/web/src/lib/identity/dev-adapter.ts
  - apps/web/src/lib/identity/repository.ts
  # API routes
  - apps/web/src/app/api/organizations/[id]/route.ts
  - apps/web/src/app/api/organizations/[id]/members/route.ts
  - apps/web/src/app/api/dev/seed/route.ts
  # Tests
  - apps/web/tests/auth.test.ts
  - apps/web/tests/organization-isolation.test.ts
  - apps/web/tests/rbac.test.ts
  - apps/web/tests/database-constraints.test.ts
  - apps/web/tests/dev-adapter-guard.test.ts

review_dimensions:
  - "Identity abstraction (no fake production auth; dev stub impossible in production)"
  - "Organization/membership model (explicit, not user.organizationId)"
  - "RBAC (owner/admin/member/viewer; least privilege; viewer has only organization.read)"
  - "Server-side authorization (requireAuthenticatedUser, requireOrganizationMember, requirePermission, authorize)"
  - "Organization isolation (IDOR protection, cross-org denial, body orgId cannot bypass)"
  - "Database constraints (unique slug, unique email, membership uniqueness, FK, RLS)"
  - "Dev-adapter production guard (throws in production)"
  - "No secrets, no Clara modification, no Phase 4 work"
```

---

## STOP instruction

**Z.AI must STOP after Phase 3 implementation.**

Z.AI must NOT:
- start Phase 4 implementation
- provision production Supabase
- create production database migrations
- implement email/WhatsApp/agent/scheduling/voice
- modify Clara source
- make any unrelated code changes

Z.AI is in **STOP** state, awaiting ChatGPT's Phase 3 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 documentation → CONDITIONAL APPROVAL → corrections → FINAL APPROVAL |
| 2026-10-03 | Phase 2 application foundation → implementation → Vercel deployment fix → APPROVED |
| 2026-10-03 | Phase 3 identity/RBAC implemented. Next action: ChatGPT Phase 3 acceptance review. Z.AI must STOP. |
