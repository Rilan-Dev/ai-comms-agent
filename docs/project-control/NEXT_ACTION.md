# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Complete final Phase 3 verification and acceptance. If all evidence is green, accept Phase 3 and issue the Phase 4 database-foundation implementation plan under ChatGPT ownership. Do not start Phase 4 until acceptance is recorded.

context:
  phase_3_transaction_safe_commit: "ceef688bdbc482644820e927e6d05f6178177c3a"
  developer_verification: "complete (typecheck 5/5, 91/91 tests, build pass, secret scan clean)"
  vercel_deployment: "blocked/pending — Vercel build-rate-limit surfaced during rapid takeover commits; no latest READY deployment claimed"
  chatgpt_acceptance: "pending"

owner_invariant_mechanism:
  layer_1: "enforce_owner_status_active() — BEFORE INSERT OR UPDATE, per-row, immediate"
  layer_2: "enforce_exactly_one_owner() — CONSTRAINT TRIGGER AFTER INSERT OR UPDATE OR DELETE, DEFERRABLE INITIALLY DEFERRED, fires at COMMIT"
  coverage: "INSERT + UPDATE + DELETE"
  transaction_safe: true
  create_organization_boundary: "createOrganizationWithOwner is the public creation workflow; createOrganization is @internal"

tests:
  total: 91
  files: 8
  breakdown:
    auth: 4
    organization-isolation: 7
    rbac: 14
    database-constraints: 10
    dev-adapter-guard: 5
    owner-invariant: 22
    rbac-persistence-consistency: 8
    migration-verification: 21
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

Z.AI is in **STOP** state, awaiting ChatGPT's final Phase 3 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 → FINAL APPROVAL. Phase 2 → APPROVED. |
| 2026-10-03 | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). |
| 2026-10-03 | ChatGPT review: CORRECTION REQUIRED (Findings A-D). |
| 2026-10-03 | Z.AI correction pass 1 (commit bf8dea7). 62 tests. |
| 2026-10-03 | ChatGPT review: FINAL CORRECTION required (4 items). |
| 2026-10-03 | Z.AI final correction (commit d4aa08b). 69 tests. |
| 2026-10-03 | ChatGPT review: owner trigger not transaction-safe; DELETE not covered; createOrganization public. |
| 2026-10-03 | Z.AI transaction-safe owner invariant (commit 4289e53). 91 tests. Vercel READY. Next: ChatGPT final acceptance. Z.AI must STOP. |
