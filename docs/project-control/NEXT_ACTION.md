# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Perform the final Phase 2 acceptance review of the corrected control-state.
  Decide one of:
    (a) ACCEPT — Phase 2 is accepted; issue the Phase 3 Z.AI_HANDOFF.
    (b) REJECT  — Phase 2 has fundamental gaps; issue a correction handoff.
    (c) CORRECT — Phase 2 is mostly accepted but specific corrections are required.

context:
  phase_2_implementation_commit: "13835dd8be5d608ccad3f4839e52c2a486f8bb41"
  phase_2_control_state_correction: "this commit (see git log)"
  developer_verification: "complete (typecheck, build, browser verification, security scan all pass)"
  chatgpt_acceptance: "pending"

artifacts_to_review:
  # Control-state correction (this commit)
  - docs/project-control/PROJECT_STATE.md (commit SHA recorded; status = awaiting ChatGPT acceptance)
  - docs/project-control/CURRENT_PHASE.md (Phase 2 complete, developer verification complete, ChatGPT acceptance pending, Phase 3 NOT authorized)
  - docs/project-control/NEXT_ACTION.md (this file — sole action = ChatGPT final Phase 2 acceptance review)
  - docs/project-control/VERIFICATION_STATE.md (developer verification distinguished from architect acceptance)
  - docs/project-control/ISSUES.md (ISS-001 Phase 2 blocker; ISS-002 resolved; ISS-003 resolved with CI; ISS-005 precise finding kept)
  - docs/project-control/RISKS.md (RSK-002 retired; others reviewed)
  - worklog.md (Phase 2 commit SHA recorded; ChatGPT review = CORRECTION REQUIRED)
  # New: minimum CI workflow (per ROADMAP.md Phase 2 scope)
  - .github/workflows/ci.yml

review_dimensions:
  - "Is the control-state correction accurate and complete?"
  - "Does the project-control documentation consistently distinguish developer verification from architect acceptance?"
  - "Is the Clara integration documentation consistent (claraRuntime const, rag_search tool, MCP wording)?"
  - "Is the minimum CI workflow acceptable for Phase 2?"
  - "Is Phase 2 ready for final acceptance?"

after_decision:
  if_accepted: |
    Issue the Phase 3 Z.AI_HANDOFF with the full handoff template
    (see docs/project-control/RULES.md §7). Phase 3 = "Authentication /
    Organization / Users / RBAC" — see docs/plans/ROADMAP.md for the
    approved Phase 3 scope. Update PROJECT_STATE.md, VERIFICATION_STATE.md,
    CURRENT_PHASE.md, and this file.
  if_rejected_or_corrected: |
    Append a section to docs/project-control/ISSUES.md (or DECISIONS.md if
    architectural) describing each required change, then update this
    NEXT_ACTION.md to point at the new correction handoff.
```

---

## STOP instruction

**Z.AI must STOP after this correction commit.**

Z.AI must NOT:
- start Phase 3 implementation
- implement authentication, organizations, users, or RBAC
- create database migrations
- provision production Supabase
- deploy production
- modify Clara source or the Clara submodule contents
- make any unrelated code changes

Z.AI is in **STOP** state, awaiting ChatGPT's final Phase 2 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Initial: ChatGPT to review Phase 1 documentation package |
| 2026-10-03 | ChatGPT issued CONDITIONAL APPROVAL with 8 required corrections |
| 2026-10-03 | Z.AI implemented all 8 corrections. Next action: ChatGPT to re-review. |
| 2026-10-03 | ChatGPT granted FINAL Phase 1 approval. Phase 2 authorized. |
| 2026-10-03 | Z.AI implemented Phase 2 application foundation (commit 13835dd). Next action: ChatGPT to review Phase 2. |
| 2026-10-03 | ChatGPT reviewed Phase 2: implementation substantially complete; CORRECTION REQUIRED for stale/contradictory project-control records. Control-state correction authorized. |
| 2026-10-03 | Z.AI implemented control-state correction (this commit). Next action: ChatGPT performs final Phase 2 acceptance review. Z.AI must STOP. |
