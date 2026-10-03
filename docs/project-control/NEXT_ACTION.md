# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Acceptance Gatekeeper

action: |
  Review the Phase 2 application foundation. Decide one of:
    (a) APPROVE — Phase 2 is accepted; issue the Phase 3 Z.AI_HANDOFF.
    (b) REJECT  — Phase 2 has fundamental gaps; issue a correction handoff.
    (c) CORRECT — Phase 2 is mostly accepted but specific corrections are required.

artifacts_to_review:
  # New application foundation
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - .gitmodules
  - .npmrc
  - .env.example
  - apps/web/ (Next.js 15 App Router + TypeScript + Tailwind v4)
  - apps/worker/ (Node.js worker — health-check loop)
  - packages/clara-core/ (Clara integration boundary)
  - packages/shared/ (shared types: agent, email, messaging)
  - packages/db/ (Supabase client factory)
  - vendor/clara/ (Clara git submodule, pinned to b47e587)
  - infra/docker-compose.yml (local Postgres, Redis, RabbitMQ, Qdrant)

  # Updated architecture docs (Clara audit results)
  - docs/architecture/CLARA_REUSE_MAP.md (§2.3 corrected: claraRuntime const, not class; §2.4 refined: narrow rag_search tool interface; §2.5 clarified)
  - docs/architecture/CLARA-INTEGRATION.md (§8a added: Phase 2 deep-audit results)

  # Updated project-control
  - docs/project-control/PROJECT_STATE.md
  - docs/project-control/CURRENT_PHASE.md
  - docs/project-control/NEXT_ACTION.md (this file)
  - docs/project-control/VERIFICATION_STATE.md
  - docs/project-control/ISSUES.md (ISS-005 refined)
  - worklog.md

review_dimensions:
  - "Does the monorepo structure match the approved Phase 1 architecture?"
  - "Is the Clara integration boundary correct (git submodule + packages/clara-core adapter)?"
  - "Is Clara source immutability preserved (no modifications to vendor/clara/)?"
  - "Does the foundation vertical slice validate the architecture (web renders, worker boots, packages resolve)?"
  - "Is the Clara deep audit complete and accurate (verifier result, claraRuntime export, tools/MCP finding)?"
  - "Are the CLARA_REUSE_MAP corrections accurate per the audit?"
  - "Is security verified (no secrets, no client-side keys, no .env committed)?"
  - "Is local infrastructure configuration valid (docker-compose)?"
  - "Is the project ready for Phase 3 (auth/RBAC) authorization?"

after_decision:
  if_approved: |
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

## What Z.AI must NOT do next

- Z.AI must not start Phase 3 implementation.
- Z.AI must not create authentication, RBAC, or organization management code.
- Z.AI must not create database migrations.
- Z.AI must not provision production Supabase.
- Z.AI must not modify the architecture without ChatGPT approval.

Z.AI is in **STOP** state, awaiting ChatGPT's Phase 2 review decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Initial: ChatGPT to review Phase 1 documentation package |
| 2026-10-03 | ChatGPT issued CONDITIONAL APPROVAL with 8 required corrections |
| 2026-10-03 | Z.AI implemented all 8 corrections. Next action: ChatGPT to re-review. |
| 2026-10-03 | ChatGPT granted FINAL Phase 1 approval. Phase 2 authorized. |
| 2026-10-03 | Z.AI implemented Phase 2 application foundation (this commit). Next action: ChatGPT to review Phase 2. |
