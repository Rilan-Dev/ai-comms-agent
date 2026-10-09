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


### 2026-10-09 — ISS-008 follow-up: host-side migration DNS failure
- The next migration attempt exposed the actual database boundary error: `psql: could not translate host name "host.docker.internal" to address`.
- This is expected when the migration script runs in the host shell rather than inside a Compose container. The PostgreSQL service is published to host port `65432`; only the host-side migration URL must use `127.0.0.1`. The app containers retain `host.docker.internal` in `.env.docker`.
- Fixed `scripts/manual-up.sh` to translate the hostname for the migration subprocess and added `apps/web/tests/manual-deploy-migration-host.test.ts`.
- Commits: `6e1decb7031ca28c685565cc15e475c2867e1d95`, `740d3d4d57e2b3e38b0975aad7cc23d2d9ed2ea9`.
- **Status remains in_progress** until `bash scripts/manual-up.sh` confirms the migration chain completes and authenticated runtime requests succeed.


### ISS-008 follow-up — legacy audit columns still required (2026-10-09)
- **Symptom:** After migration 0023 completed and the rebuilt web/worker containers started, authenticated agent creation failed with PostgreSQL SQLSTATE 23502: null value in `audit_events.resource_type`.
- **Root cause:** The live `aca.audit_events` table predates the current audit contract and still contains legacy `resource_type` and `outcome` columns marked NOT NULL. The current repository writer inserts `target_type` and `decision`; `CREATE TABLE IF NOT EXISTS` and migration 0023 did not reconcile the nullability of the retired columns.
- **Remedy:** Added forward-only migration `0024_audit_legacy_column_compatibility.sql`. It conditionally drops NOT NULL from legacy columns only when they exist and are currently NOT NULL, preserving existing rows and leaving current columns/contracts unchanged.
- **Regression prevention:** Added static tests that assert both legacy columns are reconciled conditionally.
- **Commits:** migration `14bea1c3`; test `4ef3921d`.
- **Verification:** User-provided logs confirm migrations through 0023 and application startup; 0024 has not yet been applied to the live database. Runtime agent creation remains failing/unverified until the new migration is applied and the request is retried.
- **Next action:** pull main and run `bash scripts/manual-up.sh`; then retry authenticated agent creation. Share only redacted error output if it still fails.


## ISS-009 — Email accounts page selects development organization instead of authenticated tenant

- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** ChatGPT / FIX-01 Sentinel
- **Status:** source fix committed; runtime retry pending
- **Symptom:** `POST /api/email-accounts` returned HTTP 403 with `reason: not_member` for the organization ID submitted by the email-account screen.
- **Root cause:** `apps/web/src/app/mail/accounts/page.tsx` called `ensureDevSeed()` and used `getDevOrgId()` to load accounts and initialize the client. That development organization is not necessarily the authenticated user's active organization. The API's membership denial was correct; the page was supplying the wrong tenant context.
- **Remedy:** The page now calls `getAuthenticatedAppContext()` with request headers and uses that active membership's `organizationId` for both the account query and client. This follows the existing `/mail/inbox` pattern. Added `apps/web/tests/email-account-organization-context.test.ts`.
- **Security invariant:** Do not weaken `authorize()`, auto-create membership, or trust arbitrary organization IDs to make this request pass. The UI must use the authenticated tenant; the API must continue enforcing membership and role.
- **Commits:** page fix `4536332f`; regression test `7a3cfba2`.
- **Verification:** Source commits are present. No live retry or runtime PASS has been observed yet. The pending migration 0024 also still needs to be applied per ISS-008 before re-testing the overall flow.
- **Next:** pull main, run `bash scripts/manual-up.sh`, sign in with a fresh session, and retry the account test from `/mail/accounts`. Redact tokens and provider credentials from any logs.


## ISS-010 — Gmail OAuth provider configuration is environment-bound

- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** ChatGPT / DEV-01
- **Status:** source implementation committed; migration/runtime verification pending
- **Symptom:** `GET /api/oauth/gmail/start` returned `provider_configuration_required` and instructed the operator to set `GMAIL_OAUTH_CLIENT_ID` and `SESSION_SIGNING_KEY` on the server.
- **Requirement:** OAuth client IDs/secrets must be configurable through platform Settings, not static code or per-provider environment variables. The platform must support multiple Gmail OAuth clients and allow selecting the client when connecting a mailbox.
- **Remedy:** Added organization-scoped `gmail_oauth_configs` table in migration `0026_gmail_oauth_configuration.sql`; Settings CRUD encrypts client secrets using the existing platform credential encryption key; Gmail account connection UI selects among enabled configurations; OAuth start/callback use the selected stored client; worker credentials retain that account's client ID/secret inside the existing encrypted credential envelope for token refresh. Gmail OAuth state no longer requires `SESSION_SIGNING_KEY`; it is signed with the existing server-only `CREDENTIALS_MASTER_KEY`.
- **Security boundary:** `CREDENTIALS_MASTER_KEY` remains an infrastructure secret because it encrypts database secrets. Do not store the key that encrypts the database secrets inside that same database. OAuth client secrets are never returned to the browser. Admin/owner authorization and tenant scope remain enforced.
- **Commits:** migration `bf02ac6d` (original migration was resequenced as 0026 to avoid colliding with the WhatsApp 0025 migration); settings API `37518326`; OAuth start `4ad9578c`; callback `951ce1f8` / `78bb9d2c`; worker refresh `6980d091`; settings UI `5b7ba0bf`; account selector `e2279785`; tests `dd947b50`.
- **Verification:** Static test source is committed; tests, build, migration application and live OAuth flow have not been run. No runtime PASS is claimed.
- **Next:** Pull current main and run `bash scripts/manual-up.sh` to apply migrations 0024 and 0025, configure one or more clients in Settings, add the callback URI to Google Cloud Console, and retry Gmail connection.


### 2026-10-09 — Migration sequence collision correction
- **Finding:** the main branch contained both `0025_gmail_oauth_configuration.sql` and `0025_whatsapp_outbound_claim_lifecycle.sql`. The runner sorts filenames and records each full filename, but duplicate numeric prefixes make deployment history ambiguous and increase operator error risk.
- **Remedy:** the Gmail configuration migration is now sequenced as `0026_gmail_oauth_configuration.sql`; WhatsApp retains `0025_whatsapp_outbound_claim_lifecycle.sql`. Gmail migration test and current deployment instructions now reference 0026.
- **Compatibility:** the migration body is unchanged and uses `CREATE TABLE/INDEX IF NOT EXISTS`, so a database that had already applied the old Gmail filename can safely apply the renamed migration; the migration ledger will contain both filenames in that case.
- **Verification:** source/docs only; migration has not been applied or runtime-verified.

### 2026-10-09 — Gmail OAuth follow-up safeguards
- Resequenced Gmail configuration migration to 0026 because 0025 is used by WhatsApp outbound claim lifecycle. Added a migration-prefix uniqueness assertion to prevent recurrence.
- Editing a saved OAuth client ID now requires entering the matching new client secret; blank secret still preserves the existing secret only when the client ID is unchanged.
- Source changes are committed; automated tests and live migration/OAuth remain unverified.


## ISS-011 — OAuth callback origin and Zoho client configuration
- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** ChatGPT
- **Status:** in_progress (source changes committed; deployment/provider registration pending)
- **Description:** Gmail callback resolution used stale `NEXT_PUBLIC_APP_URL` and Zoho OAuth required environment client credentials and lacked settings UI. Both providers now derive callback URLs from the active request origin; Zoho has organization-scoped OAuth client settings and the account selector. Provider callback URIs must still be registered in provider consoles, and public callbacks must use HTTPS. Google does not allow raw IP hosts for web redirect URIs.
- **Next:** pull main, run manual deployment for migrations 0024–0027, access the app through its HTTPS domain, register the exact displayed callbacks, and test Gmail and Zoho consent/token/worker refresh flows. Do not claim runtime acceptance until evidence is available.


### 2026-10-09 — ISS-011 follow-up: internal localhost origin behind proxy

- **User-observed symptom:** Gmail Settings displayed `https://localhost:3000/api/oauth/gmail/callback` even though the intended provider callback is on the public HTTPS domain.
- **Source root cause:** `getOAuthRedirectUri()` used only `new URL(request.url).origin`. Behind the current proxy path, that request URL can represent the internal Next.js origin rather than the browser-facing host.
- **Correction committed:** callback resolution now prefers a single validated `X-Forwarded-Host` + `X-Forwarded-Proto` pair and rejects partial or comma-separated values. Gmail and Zoho callback success/error redirects use the same public origin helper. Added regression coverage for internal localhost URL + public proxy headers and invalid forwarding chains.
- **Security requirement:** the reverse proxy must validate incoming Host values and overwrite both forwarding headers. Never trust arbitrary client-supplied forwarding headers; never weaken OAuth state/redirect URI equality checks.
- **Verification:** source changes committed; focused tests, typecheck, deployment, proxy behavior, and live Google OAuth have not been executed in this session. No PASS claimed.
- **Next:** configure/confirm the trusted proxy forwarding headers, deploy current main, reload Settings through the HTTPS domain, confirm both displayed callbacks, register exact URIs with providers, and restart the OAuth flow.

## ISS-011 — AI provider and Clara runtime configuration was environment-only

- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** ChatGPT
- **Status:** in_progress
- **Description:** The live chat route returned `configuration_required` because it required process-level `CLARA_KB_ID`. AI provider keys/model defaults and voice settings also had no complete organization-facing configuration flow, despite the Settings and provider architecture expecting these controls.
- **Implemented source slice:** migration `0028_organization_ai_runtime_settings.sql`; organization-scoped runtime settings API and UI; encrypted per-organization chat provider credentials; server-side OpenAI/Gemini model catalog fetching; Clara runtime resolution of stored provider/model/generation/voice preferences; chat, voice and worker knowledge-base lookup from organization settings with environment fallback.
- **Security boundaries:** provider credentials are encrypted with `CREDENTIALS_MASTER_KEY`; plaintext keys are never returned by GET APIs; writes require `organization.update`; reads require active organization membership and `organization.read`.
- **Not yet verified:** tests, typecheck, builds, migration application, live model catalog requests, live chat streaming, realtime voice transport, and deployment. No PASS is claimed.
- **Remaining work:** continue the screen-by-screen configuration audit, cover voice-provider-specific credentials/transport readiness, add visible readiness checks and tests, then deploy and manually verify. Do not wait for CI/Vercel before continuing independent implementation.

## ISS-012 — Gmail OAuth accounts remained pending because no mailbox sync consumer was running

- **Opened:** 2026-10-09
- **Severity:** blocker for connected-mailbox functionality
- **Owner:** ChatGPT
- **Status:** in_progress (source implementation committed; deployment/runtime verification pending)
- **Symptoms:** OAuth callback persisted encrypted Gmail credentials but deliberately left the account `pending`. The worker process started provider-draft, WhatsApp, and scheduler loops, but had no Gmail mailbox sync loop. Consequently no initial import ran, `last_synced_at` stayed empty, and email content/drafts never reached PostgreSQL for AI use.
- **Root causes fixed in source:** added a durable PostgreSQL-backed Gmail sync polling worker and wired it into worker startup/shutdown; added pagination for initial full mailbox import; persisted messages and threads idempotently; persisted refreshed OAuth access tokens back into encrypted account credentials; recovered expired Gmail history cursors by restarting a full paginated import; preserved an existing Google refresh token if a reconnect response omits one; added an organization-admin-only manual sync API and UI action; added automatic mailbox status refresh in the UI.
- **Worker behavior:** polls pending/connected/error Gmail accounts, claims each account through `email_sync_states`, imports message details into `email_messages` and `email_threads`, discovers folders/labels, updates sync cursor/last-success state, marks successful mailboxes connected, and records retry/error state without exposing credentials.
- **Remaining:** review/apply the complete migration chain through `0028`, deploy the web and worker images, verify a real mailbox transitions from pending to connected with a populated `last_synced_at`, confirm inbox/drafts are persisted, and validate refresh/revocation recovery. Tests/build/migration/live Google API execution have not been run from this environment; no runtime PASS is claimed.
- **Operational dependency:** the worker must be running with the same PostgreSQL database and `CREDENTIALS_MASTER_KEY` as the web application. A web-only deployment cannot perform background synchronization.

### ISS-012 follow-up — draft visibility and HTML-only messages

- Gmail message ingestion now extracts readable text from HTML-only messages without storing unsanitized HTML as trusted content.
- Imported Gmail drafts resolve their Gmail draft-resource ID and are marked provider-synced, avoiding the UI treating an already-existing Gmail draft as a local-only draft.
- Found and corrected another tenant-context defect: `/mail/drafts` and `/mail/compose` selected `getDevOrgId()`, so signed-in users could see an empty or wrong-organization draft list even after messages were imported. Both now use `getAuthenticatedAppContext()`; static tests guard the active-organization invariant.
- These are source-only corrections; test execution and live draft visibility are still pending.


## ISS-013 — Worker credential snapshot TypeScript build failure
- **Opened:** 2026-10-09
- **Severity:** high (worker image build blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress
- **Description:** Docker worker target failed TypeScript compilation at apps/worker/src/email/mailbox-sync-worker.ts:156 and :201. GmailAdapter snapshot returned Record<string, unknown>, conflicting with EmailCredentials; the DB saveCredentials API accepts Record<string, unknown>, which EmailCredentials does not implicitly satisfy.
- **Root cause:** Inconsistent type contracts between provider snapshot, worker orchestration, and persistence boundary.
- **Remedy applied:** Gmail snapshot now declares EmailCredentials; worker spreads the snapshot into a plain persistence record. Added a focused Gmail snapshot contract test.
- **Failed approach:** An intersection over adapters does not reconcile incompatible method return types; direct interface-to-Record assignment fails without an index signature.
- **Evidence:** Commits caad1d753b0199a895d63056704c4db9c423f382, 04a2345b6b901ebbc55d084dc5860f39ae9416d8, a98c0e7fa1ee8e22ff60726475e6fb91624626c8. The supplied Docker log evidences the original failure. Corrective tests/typecheck/build are not executed; no PASS claimed.
- **Resolution plan:** Run focused Gmail adapter test and worker build/typecheck. Route any remaining Docker, dependency installation, or deployment-environment defect to OPS-01.
- **Related records:** EVT-FIX01-WORKER-CREDENTIALS-20261009; FIX01-WORKER-CREDENTIALS-20261009.


## ISS-014 — Web typecheck parser failure from literal newline escapes in Zoho OAuth test
- **Opened:** 2026-10-09
- **Severity:** medium (web typecheck blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** test_expectations_corrected_verification_pending
- **Symptom/history:** Initial `pnpm run typecheck` failed in `apps/web/tests/zoho-oauth-settings.test.ts:84` with TS1127/TS1434; after the newline fix, user reran `pnpm run typecheck` successfully across all workspaces, then the focused Vitest run exposed two incorrect assertions.
- **Root cause:** Three `expect(helper).toContain(...)` assertions were joined by literal backslash-n characters (`\n`) instead of real newlines.
- **Failed approach to avoid:** Do not alter OAuth helper behavior, callback validation, or implementation types; the defect is confined to malformed test source.
- **Remedy:** Fixed the malformed newlines in `39857c40820940b500dcf452331dfe82ae35b861`; then aligned the raw-IP assertion with the DNS-only policy and narrowed the static env assertion to `process.env.NEXT_PUBLIC_APP_URL`. Test-only commit `c58d6d442767f471c694ef978fdb06eca6d29850`; OAuth runtime code remains unchanged.
- **Evidence:** User-provided latest output: `pnpm run typecheck` passed for all workspaces. Focused Vitest output: 8 passed, 2 failed before test-only commit `c58d6d442767f471c694ef978fdb06eca6d29850`. The corrected focused test has not yet been rerun.
- **Next action:** Re-run `pnpm --filter @ai-comms-agent/web exec vitest run tests/zoho-oauth-settings.test.ts`; then continue implementation without waiting on CI/Vercel. Typecheck already passed in the user's latest run. Route any independent infrastructure/deployment issue to OPS-01.
- **Related record:** EVT-FIX01-ZOHO-TEST-NEWLINES-20261009.

## ISS-015 — Live database schema drift and Redis mailbox lease rejection
- **Opened:** 2026-10-09
- **Severity:** high (AI provider settings API and manual mailbox sync return HTTP 500; worker skips all mailbox batches when Redis lease commands are rejected)
- **Owner:** FIX-01 / Sentinel for source and migration; OPS-01 / Shipwright for live migration application, container rollout, and runtime configuration diagnosis
- **Status:** forward_migration_committed_runtime_followup_required
- **Evidence supplied by user:** PostgreSQL reports missing `ai_provider_configs.model` during provider settings access and missing `email_sync_states.last_attempt_at` during `POST /api/email-accounts/:accountId/sync`. Worker repeatedly logs `Redis command rejected` and skips the batch. Health checks report worker and Redis configured, but this does not prove Redis AUTH/ACL works.
- **Root cause:** deployed PostgreSQL schema is behind the current query contract; the Redis lease client discards the Redis server's error payload, obscuring AUTH/ACL/configuration failures.
- **Source remedy:** forward-only idempotent migration `0029_runtime_schema_reconciliation.sql` adds missing provider/mailbox columns and backfills legacy `history_token` / `last_sync_at` where present. Redis lease errors now include a bounded server error response; added a WRONGPASS regression test.
- **Commits:** migration `a4fab9df07deafa5fd47879217616e3cb6d1c03f`; Redis diagnostics `71616ac887f3efb79f90039245d6064c4662a77c`; regression test `0fa3e751cae2e5105b212083e93a7cc87bf00468`.
- **Verification:** source accepted by GitHub only. Migration has not been applied to the live database; no typecheck/test/build, live Redis command, mailbox sync, or runtime PASS is claimed.
- **Next action:** OPS-01 pulls current `main`, applies migrations through `0029` to the exact PostgreSQL database used by both containers, rolls out matching web/worker images, and inspects the now-specific Redis error. Correct Redis credentials/ACL/TLS/URL based on the exact response; never bypass the lease failure or force uncoordinated multi-worker polling.
- **Security note:** user pasted live-looking session/access and OAuth state/verifier values. Treat as exposed; rotate/revoke applicable session/access credentials and restart the OAuth flow. Do not copy those values into logs or project docs.

## ISS-016 — Live inbox schema drift and Redis authentication
- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** OPS-01 for live Redis credentials and migration rollout; FIX-01 for source/schema compatibility
- **Status:** in_progress
- **Evidence:** User-provided production logs show `email_messages.from_name` missing when loading the inbox. Worker reports Redis `WRONGPASS invalid username-password pair or user is disabled`, so the distributed lease fails and batches are skipped. The sync endpoint's `202 queued` / `queued: true` response means accepted for processing, not imported.
- **Source remedy:** migration `0030_email_messages_runtime_reconciliation.sql` adds canonical inbox sender/recipient/body/direction columns and backfills compatible legacy names. Static migration regression source added.
- **Commits:** migration `69c51678c8c12e0a0c070214dc09db77e0758dae`; static regression `e7a1e7ee396d542ffdf3edada895938a087b6a27`.
- **Verification:** source committed only. Neither migration `0029` nor `0030` is confirmed applied; tests/build not run; Redis auth remains failing; no mailbox import success confirmed.
- **Next action:** OPS-01 applies migrations through `0030` to the exact database used by web/worker, rebuilds/restarts both containers, and corrects `REDIS_URL` username/password against the actual Redis ACL/user configuration. Then retry sync and verify persisted message counts plus inbox rows. Do not bypass lease locking.
- **UI correctness:** preserve the response as queued until worker completion; expose failed sync state and last_error rather than treating request acceptance as success.
- **Security:** live-looking access/session values were pasted in the request. Revoke/rotate applicable tokens/cookies and restart OAuth as needed; never log or commit their values.
