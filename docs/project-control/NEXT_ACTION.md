# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Review the Phase 3 correction set. Decide one of:
    (a) ACCEPT — Phase 3 is accepted; issue the Phase 4 Z.AI_HANDOFF.
    (b) REJECT  — Phase 3 has fundamental gaps; issue another correction handoff.
    (c) CORRECT — specific corrections still required.

corrections_implemented:
  - "Finding A: RBAC persistence (Option A — removed roles/role_permissions tables; SYSTEM_ROLE_PERMISSIONS is authoritative)"
  - "Finding B: Owner invariant enforced (createMembership, updateMembershipRole, updateMembershipStatus; transferOwnership method; OwnerInvariantError)"
  - "Finding C: Permission catalogue boundary documented (SECURITY_MODEL.md §4.2a)"
  - "Finding D: PROJECT_STATE.md synchronized with Phase 3 correction state"

artifacts_to_review:
  - supabase/migrations/0001_identity_rbac.sql (roles/role_permissions removed; Option A documented)
  - packages/db/src/identity/in-memory.ts (owner invariant + transferOwnership + OwnerInvariantError)
  - packages/db/src/identity/repository.ts (transferOwnership in interface)
  - packages/db/src/index.ts (OwnerInvariantError exported)
  - apps/web/tests/owner-invariant.test.ts (14 new tests)
  - apps/web/tests/rbac-persistence-consistency.test.ts (8 new tests)
  - apps/web/tests/rbac.test.ts (fixed: ownership transfer test uses transferOwnership)
  - docs/architecture/SECURITY_MODEL.md (§4.2a Phase 3 permission catalogue boundary)
  - docs/project-control/PROJECT_STATE.md (Phase 3 correction state)
  - docs/project-control/CURRENT_PHASE.md (correction summary)
  - worklog.md (Phase 3 correction entry)
```

---

## STOP instruction

**Z.AI must STOP after this correction commit.**

Z.AI must NOT:
- start Phase 4 implementation
- provision production Supabase
- implement email/WhatsApp/agent/scheduling/voice
- modify Clara source
- make any unrelated code changes

Z.AI is in **STOP** state, awaiting ChatGPT's Phase 3 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 → FINAL APPROVAL. Phase 2 → APPROVED. |
| 2026-10-03 | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). |
| 2026-10-03 | ChatGPT review: CORRECTION REQUIRED (Findings A-D). |
| 2026-10-03 | Z.AI implemented Phase 3 corrections (this commit). Next action: ChatGPT Phase 3 acceptance review. Z.AI must STOP. |
