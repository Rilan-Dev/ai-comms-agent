# ISSUES.md — Open Issues

Open issues that block or affect progress but are not architectural decisions (architectural decisions live in `DECISIONS.md`). Each issue has an ID, date opened, severity, owner, status, and resolution plan.

Statuses: `open`, `in_progress`, `blocked`, `resolved`, `wont_fix`.

---

## ISS-001 — Historical Phase 2 acceptance record

- **Opened:** 2026-10-03 (originally opened for Phase 1 review; repurposed for Phase 2 on 2026-10-03)
- **Severity:** blocker (gates Phase 3)
- **Owner:** ChatGPT
- **Status:** resolved
- **Description:** Phase 1 review is complete (FINAL APPROVAL issued 2026-10-03). Phase 2 implementation is complete (commit `13835dd`) and developer verification is complete (typecheck, build, browser verification, security scan all pass). ChatGPT reviewed the Phase 2 implementation and identified stale/contradictory project-control records; a control-state correction was authorized and implemented. The current blocker is awaiting ChatGPT's **final Phase 2 acceptance** decision after reviewing the corrected control-state.
- **Resolution plan:** ChatGPT reviews the corrected Phase 2 state (this commit). Outcome is one of: (a) ACCEPT — Phase 2 accepted; issue Phase 3 Z.AI_HANDOFF; (b) REJECT — fundamental gaps; issue correction handoff; (c) CORRECT — specific corrections; issue correction handoff. After the decision, update `PROJECT_STATE.md`, `VERIFICATION_STATE.md`, `CURRENT_PHASE.md`, and `NEXT_ACTION.md`.

---

## ISS-002 — Clara library deep audit (RESOLVED in Phase 2)

- **Opened:** 2026-10-03
- **Resolved:** 2026-10-03
- **Severity:** medium (was: Phase 2 dependency)
- **Owner:** Z.AI (Phase 2)
- **Status:** resolved
- **Description (original):** The Clara library at `Rilan-Dev/ai-reusable-libraries` was cloned with `--depth 1` for Phase 1 inspection. A deep dependency audit was deferred to Phase 2.
- **Resolution:** Phase 2 deep Clara audit completed. Findings:
  - Full clone of `Rilan-Dev/ai-reusable-libraries` completed (42 commits, 108 extracted files — not depth-1).
  - Extraction manifest (`clara-core/extraction-manifest.json`) inspected: 108 entries, schema_version 1, immutable: true.
  - Target-side verification performed (the original `verify-extraction.mjs` requires the Clara-AI-Platform source repo; a target-side verifier was written that checks every `target_path` exists in HEAD and its blob SHA matches `source_blob_sha`).
  - **106/108 manifest checks passed.** Two failures identified as manifest SHA recording errors (typos in `source_blob_sha`), NOT file content mutations:
    - `clara-core/source/src/modules/rag/knowledge-topics.ts`: manifest SHA is 41 chars (malformed — SHA-1 is 40 chars); actual git blob SHA is the 40-char prefix.
    - `clara-core/source/src/modules/language-core/config-types.ts`: manifest SHA differs from actual at 1 hex position (39 chars vs 40 chars).
  - `claraRuntime` export verified: `export const claraRuntime = { ... } as const;` (a const object literal, not a class).
  - Narrow `rag_search` tool interface verified: `claraRuntime.tools.list()` returns `[{ name: "rag_search", ... }]`; `claraRuntime.tools.invoke()` supports `rag_search` only.
  - No generic standalone application ToolRegistry/MCP framework found in the audited extracted Clara source.
  - No hidden coupling found in the audited extracted source. The `doable-source/engine-resolver.ts` (which has SQL coupling per `AI_RAG_ARCHITECTURE.md`) is NOT in the extracted `clara-core/source/` and is NOT used by our integration.
- **Note:** The two manifest SHA recording errors have NOT been fixed in Clara (they are upstream Clara library defects). They are not file content mutations and do not affect our integration. They should be reported upstream to `Rilan-Dev/ai-reusable-libraries`.

---

## ISS-003 — CI workflow (RESOLVED in Phase 2 control-state correction)

- **Opened:** 2026-10-03
- **Resolved:** 2026-10-03
- **Severity:** low (was: Phase 2 scope item)
- **Owner:** Z.AI (Phase 2)
- **Status:** resolved
- **Description (original):** The `.github/` directory was created during scaffolding for future CI workflows. It was intentionally empty — CI design was part of Phase 2's "application foundation" scope (per `docs/plans/ROADMAP.md` line 31: "CI workflow (`.github/workflows/ci.yml`): typecheck, lint, unit tests, build, secret scan" and line 37: "`npm run build` succeeds in CI").
- **Resolution:** Inspected the canonical Phase 2 scope (`docs/plans/ROADMAP.md`, Phase 1 approved baseline). CI workflow IS listed as Phase 2 scope and as an exit criterion ("`npm run build` succeeds in CI"). The Phase 2 handoff did not defer CI. Therefore, the minimum approved CI workflow was implemented in the control-state correction commit:
  - `.github/workflows/ci.yml` created.
  - Triggers: push to main, pull request to main.
  - Steps: checkout (with submodules), setup pnpm + Node 20, `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/worker build`, secret scan (grep for `ghp_*`, `vcp_*` patterns across tracked files).
  - No unit tests in CI (none exist in Phase 2 — unit tests begin in Phase 3).
  - No release/deploy workflows (those are Phase 19).
  - CI workflow verified locally: valid YAML, all steps pass locally (typecheck 5/5, web build success, worker build success, secret scan clean).
- **Note:** The CI workflow has not yet been triggered on GitHub Actions (it will trigger on the next push to main). Local verification of all CI steps was performed.

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
- **Severity:** low (informational; affects Phase 11 tool registry design but is NOT a blocker for Phase 2)
- **Owner:** Z.AI (Phase 11 implementation)
- **Status:** open — **refined in Phase 2 deep audit**
- **Description:** The Phase 2 deep audit (full clone of `Rilan-Dev/ai-reusable-libraries`, reading `clara-core/source/src/modules/ai-platform-core/clara-runtime.ts` in full) refined the Phase 1 finding. The precise current finding is:
  - Clara has `claraRuntime.tools` — a narrow host-binding runtime tool interface with `list()` and `invoke(ctx, name, input)` methods.
  - The observed supported tool is `rag_search` — a thin wrapper around `claraRuntime.retrieve()` that calls `groundClaraContext()` for KB retrieval.
  - Clara does **not** provide the generic application `ToolRegistry` needed by ai-comms-agent (for email, WhatsApp, scheduling, approvals, etc.).
  - The host owns the application `ToolRegistry` (per `TOOL-CONTRACTS.md`). The host `kb.search` tool wraps `claraRuntime.retrieve()` for KB retrieval with host-owned authorization and audit.
  - The `enableMcp: boolean` flag exists in `rag/config.ts` (line 12, parsed from `ENABLE_MCP` env var, default `false`) but has **no backing MCP client/server implementation** in the extracted source.
  - MCP is not implemented by ai-comms-agent in Phase 2.
- **Resolution plan:** Phase 11 implements the application-specific `ToolRegistry`. The host `kb.search` tool calls `claraRuntime.retrieve()` directly. Clara's `rag_search` is not exposed to the LLM as a passthrough — the host's `kb.search` tool wraps the same capability. MCP is revisited as a separate architectural decision (record in `DECISIONS.md`) if/when Clara extracts an MCP runtime or if business requirements demand it. This issue is NOT a blocker for Phase 2 acceptance.

---

## Issue history

| ID | Date opened | Date resolved | Summary |
|---|---|---|---|
| ISS-002 | 2026-10-03 | 2026-10-03 | Clara deep audit completed in Phase 2; 106/108 manifest checks pass; 2 manifest SHA typos identified (upstream Clara issue); claraRuntime export verified; no hidden coupling. |
| ISS-003 | 2026-10-03 | 2026-10-03 | CI workflow implemented in Phase 2 control-state correction (.github/workflows/ci.yml); minimum approved workflow per ROADMAP.md Phase 2 scope. |


## ISS-006 — Phase 4 runtime migration verification pending

- **Opened:** 2026-10-06
- **Severity:** medium
- **Owner:** ChatGPT
- **Status:** in_progress
- **Description:** Phase 4 schema migrations are implemented directly by ChatGPT. Runtime application against disposable PostgreSQL is required before Phase 4 acceptance. GitHub Actions and Vercel completion are not prerequisites for continued implementation.
- **Resolution plan:** Continue schema alignment, collect runtime migration/RLS evidence when execution is available, then accept or correct Phase 4.

## ISS-007 — Live browser login returns to not_provisioned after successful password authentication

- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** OPS-01
- **Status:** in_progress
- **Description:** At `http://100.72.192.28:3300`, the user reports that `POST /api/auth/login` succeeds but the browser returns to `/login?reason=not_provisioned` instead of the application home/dashboard.
- **Root-cause trace:** Current `main` already contains the prior source fixes: HTTP-aware session-cookie security (`52fb3318...`), full browser navigation after login (`56f9088a...`), and explicit cookie propagation in the protected root layout (`3cd19bdb...`). In current source, `reason=not_provisioned` is emitted by the root layout only when middleware has allowed the request through with a cookie and `getAuthenticatedAppContext()` resolves to null. The remaining concrete runtime causes are invalid/revoked/expired session, inactive user, absent/inactive organization membership, stale application build, or inconsistent runtime database/environment. The exact runtime branch cannot be confirmed because the private host is not reachable from this execution environment.
- **Failed approaches:** Router/RSC refresh navigation fix; explicit cookie propagation in the root layout; HTTP-aware Secure-cookie correction. Those source changes are present on `main` but the live symptom persists.
- **Remedy:** Route live-runtime inspection to OPS-01. Verify running build revision, session cookie/session row, active user, active membership, and shared `DATABASE_URL`; rebuild/restart only when stale deployment is confirmed. Do not weaken the fail-closed provisioning/auth boundary.
- **Prevention lesson:** Distinguish middleware `login?next=/` (cookie absent) from layout `login?reason=not_provisioned` (cookie present but application context unresolved). Trace the full request state and runtime database before changing login UI again.
- **Evidence:** `main` at `2ab9c66640cc5132bc7f7686d0f008015b79620d`; source/commit ancestry confirms the earlier fixes are present; direct curl from this environment cannot reach `100.72.192.28:3300`, so no live-runtime PASS/FAIL is claimed.
- **Next action:** OPS-01 performs live runtime diagnosis and the smallest infrastructure/runtime correction, then records evidence back to ISS-007.

### 2026-10-09 — FIX-01 corrective source hardening
- Root-cause boundary confirmed in current source: password authentication could return success and mint a session before checking whether the user had any active organization membership; the next protected render then rejected that session as `not_provisioned`, creating the reported success → login-loop experience.
- Corrected `loginWithPassword` to require at least one active organization membership before session creation. Unprovisioned accounts now receive `403 account_not_provisioned` and no authenticated session is minted.
- Added a production auth-boundary regression assertion for the membership guard and error route.
- This is fail-closed: it does not reactivate memberships or invent an organization. Any genuinely unprovisioned account must be provisioned through the authorized organization workflow.
- Commit chain ends at `197e6535eab0cafde3e84db8f0605b7a174b3b03`.


## ISS-008 — Manual runtime database schema drift breaks audit and agent writes

- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** ChatGPT
- **Status:** in_progress
- **Description:** After the owner→admin authorization correction was deployed, authenticated requests reached the organization boundary but the live PostgreSQL schema was behind the application contract. `/api/overview` failed with PostgreSQL `42703` because `audit_events.decision` did not exist; agent creation failed because `audit_events.agent_id` did not exist. The worker health check showed PostgreSQL connectivity/configuration was present, so this is schema drift / missing migration application rather than missing database connectivity.
- **Root cause:** `scripts/manual-up.sh` rebuilt and started the containers but did not run `scripts/migrate.sh`. In addition, older databases can already have `audit_events`; the original `CREATE TABLE IF NOT EXISTS` migration does not add newly required columns to an existing table. Therefore rebuilding the application could not reconcile the deployed schema.
- **Remedy:** Added forward-only migration `0023_audit_schema_reconciliation.sql` to add missing `audit_events.agent_id` and `audit_events.decision` columns and indexes idempotently. Updated `scripts/manual-up.sh` to resolve `DATABASE_URL` from `.env.docker`, run the canonical migration ledger before starting the application, and then start Compose with the same env file. Added static regression coverage for both the reconciliation migration and startup migration boundary.
- **Prevention:** Manual deployment now applies the same forward-only migration chain before exposing the rebuilt application. Existing audit tables are explicitly reconciled by a new migration rather than relying on `CREATE TABLE IF NOT EXISTS`.
- **Evidence:** Live web logs at 2026-10-08T21:52–21:53Z showed `column "decision" does not exist` and `column "agent_id" of relation "audit_events" does not exist`; worker logs simultaneously reported `postgres_configured:true` and `worker ready`. The manual startup script previously contained no migration invocation.
- **Commits:** `54f2c883c4c7250f9e83c6bde8e1c6a8fe64d83a` (migration), `7fe343eb06e96344e9f53dddb8488801b38fa4df` (manual startup migration), `25c37101d8fc4c2520d6ee0b4586cb723b2d46a9` (regression coverage).
- **Next action:** Rebuild/pull current `main`, run `bash scripts/manual-up.sh` so the migration chain is applied before startup, then retry authenticated overview and agent creation. Do not wait for CI/Vercel.
