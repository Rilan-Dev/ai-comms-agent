# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Perform the final Phase 3 acceptance review. Decide one of:
    (a) ACCEPT — Phase 3 is accepted; issue the Phase 4 Z.AI_HANDOFF.
    (b) REJECT  — Phase 3 has fundamental gaps; issue another correction handoff.
    (c) CORRECT — specific corrections still required.

context:
  phase_3_final_correction_commit: "d4aa08b03edb0bb007a1249c79169654af09c095"
  developer_verification: "complete (typecheck 5/5, 69/69 tests, build pass, secret scan clean)"
  vercel_deployment: "READY (commit d4aa08b, UID dpl_iBWryx25cRAqRFXmgTuwcMcjVtgY)"
  chatgpt_acceptance: "pending"

corrections_implemented:
  final_correction:
    - "Correction 2: PostgreSQL trigger enforce_owner_invariant() in migration (at most one active owner, owner must be active, final owner cannot be demoted/suspended)"
    - "Correction 3: createOrganizationWithOwner() — atomic org + initial owner creation"
    - "Correction 4: transferOwnership newOwnerRole typed as NonOwnerRole (admin|member|viewer); runtime guard; default 'admin'"
    - "Owner membership status enforcement: createMembership rejects non-active owner memberships"
  prior_correction:
    - "Finding A: Option A RBAC persistence (roles/role_permissions deferred; SYSTEM_ROLE_PERMISSIONS authoritative)"
    - "Finding B: Owner invariant in-memory (createMembership, updateMembershipRole, updateMembershipStatus, transferOwnership)"
    - "Finding C: Permission catalogue boundary documented (SECURITY_MODEL.md §4.2a)"
    - "Finding D: PROJECT_STATE.md synchronized"

tests:
  total: 69
  files: 7
  breakdown:
    auth: 4
    organization-isolation: 7
    rbac: 14
    database-constraints: 10
    dev-adapter-guard: 5
    owner-invariant: 21
    rbac-persistence-consistency: 8
```

---

## STOP instruction

**Z.AI must STOP after this final correction commit.**

Z.AI must NOT:
- start Phase 4 implementation
- provision production Supabase
- implement email/WhatsApp/agent/scheduling/voice
- modify Clara source
- make any unrelated code changes

Z.AI is in **STOP** state, awaiting ChatGPT's final Phase 3 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 → FINAL APPROVAL. Phase 2 → APPROVED. |
| 2026-10-03 | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). |
| 2026-10-03 | ChatGPT review: CORRECTION REQUIRED (Findings A-D). |
| 2026-10-03 | Z.AI implemented Phase 3 correction pass 1 (commit bf8dea7). 62 tests. |
| 2026-10-03 | ChatGPT review: FINAL CORRECTION required (4 items). |
| 2026-10-03 | Z.AI implemented Phase 3 final correction (commit d4aa08b). 69 tests. Vercel READY. Next action: ChatGPT final Phase 3 acceptance. Z.AI must STOP. |
