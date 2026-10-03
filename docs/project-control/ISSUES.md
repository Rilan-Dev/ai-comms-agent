# ISSUES.md — Open Issues

Open issues that block or affect progress but are not architectural decisions (architectural decisions live in `DECISIONS.md`). Each issue has an ID, date opened, severity, owner, status, and resolution plan.

Statuses: `open`, `in_progress`, `blocked`, `resolved`, `wont_fix`.

---

## ISS-001 — Awaiting ChatGPT architect review of Phase 1 documentation package

- **Opened:** 2026-10-03
- **Severity:** blocker (gates Phase 2)
- **Owner:** ChatGPT
- **Status:** open
- **Description:** Phase 1 documentation is complete and committed, but per the master operating prompt §26, only ChatGPT can authorize a phase transition. Z.AI is in STOP state.
- **Resolution plan:** ChatGPT reviews the artifacts listed in `NEXT_ACTION.md`. Outcome is one of: approve (issue Phase 2 handoff), reject (issue correction handoff for fundamental gaps), or correct (issue correction handoff for specific changes). After the decision, update `PROJECT_STATE.md`, `VERIFICATION_STATE.md`, `CURRENT_PHASE.md`, and `NEXT_ACTION.md`.

---

## ISS-002 — Clara library inspected shallowly (depth-1 clone)

- **Opened:** 2026-10-03
- **Severity:** medium
- **Owner:** Z.AI (Phase 2)
- **Status:** open
- **Description:** The Clara library at `Rilan-Dev/ai-reusable-libraries` was cloned with `--depth 1` for Phase 1 inspection. The high-level structure, AGENTS.md, REFERENCE-MAP.md, and IMPLEMENTATION-PLAYBOOK.md were read in full, plus spot-reads of `ai-core/types.ts`, `voice-core/types.ts`, `ai-governance/core/types.ts`, and `doable-source/AI_RAG_ARCHITECTURE.md`. A deep dependency audit (every file, every import, every test) was deferred to Phase 2.
- **Resolution plan:** In Phase 2 (or earlier if ChatGPT directs), do a full clone and run Clara's `scripts/verify-extraction.mjs` to validate the immutable extraction manifest. Cross-reference every capability the architecture references against the actual Clara source.

---

## ISS-003 — `.github/` directory exists but is intentionally empty

- **Opened:** 2026-10-03
- **Severity:** low
- **Owner:** Z.AI (Phase 2)
- **Status:** open
- **Description:** The `.github/` directory was created during scaffolding for future CI workflows. It is intentionally empty — CI design is part of Phase 2's "application foundation" scope (per `docs/plans/ROADMAP.md`).
- **Resolution plan:** In Phase 2, add `.github/workflows/ci.yml` covering typecheck, lint, unit tests, build. Do not add release/deploy workflows until Phase 19.

---

## ISS-004 — Worker host not yet selected

- **Opened:** 2026-10-03
- **Severity:** medium (blocks Phase 9 implementation)
- **Owner:** ChatGPT (architectural decision) — see ADR-007
- **Status:** open
- **Description:** ADR-007 proposes Next.js on Vercel for web/API, Supabase for PostgreSQL, but the worker host (for RabbitMQ consumers) is not yet decided. Candidates: Railway, Fly.io, Render, a Vercel-independent container host. Vercel does not natively host long-lived RabbitMQ consumers.
- **Resolution plan:** ChatGPT decides worker host before Phase 9 (Email synchronization + queues + workers). Worker host selection influences env-var layout, secret management, and observability.

---

## ISS-005 — Clara has no generic standalone tool/MCP framework (narrow `rag_search` only)

- **Opened:** 2026-10-03
- **Severity:** medium (affects Phase 11 tool registry design)
- **Owner:** Z.AI (Phase 11 implementation)
- **Status:** open — **refined in Phase 2 deep audit**
- **Description:** The Phase 2 deep audit (full clone of `Rilan-Dev/ai-reusable-libraries`, reading `clara-core/source/src/modules/ai-platform-core/clara-runtime.ts` in full) refined the Phase 1 finding. The precise current finding is:
  - Clara has **no generic standalone application tool/MCP framework**.
  - Clara **does have a narrow host-binding runtime tool interface**: the `claraRuntime.tools` property, with `list()` and `invoke(ctx, name, input)` methods.
  - The **only observed Clara tool capability is `rag_search`** — a thin wrapper around `claraRuntime.retrieve()` that calls `groundClaraContext()` for KB retrieval.
  - Any other tool name passed to `claraRuntime.tools.invoke()` throws `"Unsupported Clara tool: " + name`.
  - The `enableMcp: boolean` flag exists in `rag/config.ts` (line 12, parsed from `ENABLE_MCP` env var, default `false`) but has **no backing MCP client/server implementation** in the extracted source.
  - **ai-comms-agent still owns its application `ToolRegistry`** for email, WhatsApp, scheduling, approvals, etc. (per `TOOL-CONTRACTS.md`). The host `kb.search` tool wraps `claraRuntime.retrieve()` for KB retrieval with host-owned authorization and audit.
- **Resolution plan:** Phase 11 implements the application-specific `ToolRegistry`. The host `kb.search` tool calls `claraRuntime.retrieve()` directly. Clara's `rag_search` is not exposed to the LLM as a passthrough — the host's `kb.search` tool wraps the same capability. MCP is revisited as a separate architectural decision (record in `DECISIONS.md`) if/when Clara extracts an MCP runtime or if business requirements demand it.

---

## Issue history

| ID | Date opened | Date resolved | Summary |
|---|---|---|---|
| (none resolved yet) | | | |
