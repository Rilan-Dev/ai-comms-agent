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

## ISS-019 — Web typecheck missing UI dependency and strict focus/test diagnostics

- **Opened:** 2026-10-09
- **Severity:** high (blocks web typecheck)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress
- **Description:** User-reported web typecheck found undeclared lucide-react imports across migrated UI, strict indexed-access errors in two focus traps, and an undefined newAgentPage test source variable.
- **Source correction:** Declared Lucide in the web workspace and pnpm lockfile with published SHA-512 integrity; narrowed focus element types after the explicit empty-array guard; added the new-agent page source binding. Commits: 8f09785a, 7b1136e6, 3e35c1f5, a9dcb8e5, 52a4e348.
- **Resolution evidence still pending:** frozen install, focused tests, and web/worker typechecks. Do not mark resolved until actual execution output is available.

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

## ISS-016 — Live inbox schema drift, sync cursor compatibility, and Redis authentication
- **Opened:** 2026-10-09
- **Severity:** high
- **Owner:** OPS-01 for live Redis credentials and migration rollout; FIX-01 for source/schema compatibility
- **Status:** in_progress
- **Evidence:** User-provided production logs show `email_messages.from_name` missing during inbox loading and Redis `WRONGPASS invalid username-password pair or user is disabled`; batches are skipped when the Redis lease fails. The sync endpoint's HTTP 202 / `queued: true` means accepted for processing, not imported.
- **Code-analysis findings fixed:** migration `0030` had an invalid single-dollar `DO $` delimiter, now corrected to `DO $$`; inbox search SQL omitted PostgreSQL `$` parameter markers for several ILIKE predicates; legacy schema has `email_sync_states.cursor jsonb` while current provider adapters require opaque text cursors.
- **Source remedies:** migration `0030_email_messages_runtime_reconciliation.sql` adds canonical inbox message columns and compatible legacy backfills; inbox search binds all five predicates to the same parameter; migration `0031_email_sync_cursor_compatibility.sql` introduces `cursor_token text` and preserves recoverable scalar/object legacy checkpoints; worker reads/writes `cursor_token`.
- **Relevant commits:** inbox migration quote fix `baccc392374fd473b9bcec72c2a7ebc639b40c7a`; inbox search `1bbcfdb7d65cc8d2b2a653c2128043aa0ac3e1e7`; migration `0031` `b26239046138c18e689498f1857b154c000de452`; worker cursor update `bf6ffa846f9690722309803173dd5fafb920106e`; regression tests `0c1857f0ee56a30dd0d5560d5a8e34e32bf3540c`, `34945eb5dc152ff76fee3a6bd2f4bd7a9abaf649`.
- **Verification:** GitHub source inspected; no tests, typecheck, PostgreSQL migration execution, Redis authentication, image rollout, or live mailbox import have been executed/confirmed. No PASS claimed.
- **Next action:** OPS-01 applies migrations through `0031` to the exact database used by web/worker, deploys matching images, fixes `REDIS_URL` username/password against the actual Redis ACL/user without exposing secrets, and triggers sync. Confirm worker completion logs, persisted `email_messages` row count, and inbox results.
- **Safety:** Do not bypass Redis lease locking or report success from queue acceptance. Revoke/rotate exposed session/access values from the pasted curl and restart OAuth as needed.

## ISS-017 — Malformed pnpm lockfile blocks workspace typecheck
- **Opened:** 2026-10-09
- **Severity:** high (developer verification/install blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** lockfile_source_corrected_rerun_pending
- **Evidence:** User ran `git pull --ff-only origin main` then `pnpm run typecheck`; pnpm failed before typechecking with `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`, reporting no lockfile entry for `amqplib@2.2.0`.
- **Root cause:** `pnpm-lock.yaml` contained two YAML documents concatenated together. The first was a stray pnpm self-package lock section; the actual workspace lockfile was the second document, whose `apps/worker` importer referenced `amqplib@2.2.0` without corresponding `packages` and `snapshots` entries.
- **Source remedy:** Replaced the multi-document file with the actual workspace lockfile and added the missing package resolution and empty snapshot for `amqplib@2.2.0`. Commit: `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`.
- **Verification:** Source structure inspected after commit (one lockfile document; importer/package/snapshot entries present). pnpm install/typecheck has not yet been rerun; no PASS claimed.
- **Next action:** Pull latest `main`, run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`. If frozen install reports further lockfile mismatch, regenerate using repository-pinned pnpm 12.8.1 and commit the generated lockfile. Do not wait for CI/Vercel.

## ISS-017 follow-up — 2026-10-09
- **Update:** Current main already contains the lockfile correction at `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`. FIX-01 added regression source assertions in `apps/web/tests/migration-verification.test.ts`, commit `b9ba0c6738e32cf4ef8b670a4b65857a56eb50f2`.
- **Root cause / failed remedy reaffirmed:** malformed concatenated lockfile documents plus missing `amqplib@2.2.0` package/snapshot records; `pnpm install --fix-lockfile` reproduced the same error.
- **Status:** source_corrected_verification_pending. Frozen install, test, typecheck, and Docker build have not been run after the correction.
- **Next action:** Pull latest main, run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`. Route unrelated Docker host/build infrastructure defects to OPS-01.

## ISS-017 follow-up — missing tarball integrity (2026-10-09)
- **New user evidence:** After pulling through `a164425`, `pnpm install --frozen-lockfile` and subsequent typecheck/Vitest commands all stopped with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`: `amqplib@2.2.0` had no `integrity` field.
- **Root cause:** Previous correction restored the package/snapshot entries but set only a tarball URL. pnpm's supply-chain policy refused to install a package whose tarball could not be verified.
- **Source remedy:** Added the published SHA-512 SRI to `pnpm-lock.yaml` in `644d578170801785c1252a569fa976b0b33476eb`; tightened the static lockfile test in `21837f32157ff43a7a1243b3f3095bb1eb2f1df6` and `d115e1b0293b48571cd0902849cb5f0030963bc7`.
- **Status:** Source correction committed; verification pending. No install, typecheck, Vitest, or Docker PASS claimed.
- **Next action:** Pull latest main and rerun frozen install. Only after success run typecheck and focused Vitest. Do not disable integrity policy or fabricate hashes.

### ISS-017 regression-test source review — 2026-10-09
- **Finding:** The first integrity assertion source had over-escaped regex literals. FIX-01 corrected the regexes to actual JavaScript regex syntax and scoped the integrity check to the `amqplib@2.2.0` entry.
- **Commit:** `162183e8d7c67b8346c15989ef850327e487cfc4`.
- **State:** Test source corrected; execution still pending successful frozen install.

## ISS-018 — Worker RabbitMQ URL type and stale migration verification paths
- **Opened:** 2026-10-09
- **Severity:** high (workspace typecheck blocker and focused test collection blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** source_corrected_verification_pending
- **User evidence:** pnpm install --frozen-lockfile passed (lockfile supply-chain policies passed for 534 entries). pnpm run typecheck reported TS2345 at apps/worker/src/queues/email-sync-rabbitmq.ts:165 (string | undefined not assignable to string | Connect); the worker typecheck was SIGKILLed. Focused migration Vitest failed collection with ENOENT for supabase/migrations/0003_database_security_hardening.sql.
- **Root causes:** RabbitMQ consumer URL remained optional in the nested reconnect boot closure; migration static test referenced old filenames after renumbering. Canonical files are 0013_database_security_hardening.sql (historical renumber commit 1506bdda) and 0005_agent_policy_configuration.sql (historical renumber commit 42627f2b).
- **Source remedy:** Normalize the consumer URL with process.env.RABBITMQ_URL?.trim() ?? "", retain early return when empty, and add a static regression assertion. Update migration-verification.test.ts to use canonical migration filenames. Commits 09e4df46, a24edec3, ffc98b30.
- **Verification:** Frozen install PASS is user-observed. Post-fix focused tests and typechecks NOT RUN. The pre-fix worker SIGKILL is not proof of another code error. No overall PASS claimed.
- **Next action:** Pull latest main; run focused migration Vitest and worker RabbitMQ contract test; run web and worker typechecks sequentially, then full workspace typecheck if resources permit. Do not recreate obsolete migrations or wait for CI/Vercel.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


## ISS-019 — Migration audit policy and worker contract-test drift
- **Opened:** 2026-10-09
- **Severity:** high (database access-contract gap plus focused test failures)
- **Owner:** FIX-01 / Sentinel
- **Status:** source_corrected_verification_pending
- **Symptom:** User reported 15 migration verification failures and two worker RabbitMQ test failures. Migration assertions expected named DO delimiters and audit policy identifiers/documentation; worker assertions expected explicit retry metadata assignments and rejected any mention of Qdrant/vector-store.
- **Root cause:** Static SQL assertions were coupled to a specific dollar-tag spelling and were over-escaped in the reported test source; the base migration did not include the expected audit insert/read policy names or append-only comment; worker retry code preserved metadata through `...envelope`, and the broad negative regex matched an explanatory comment rather than a client operation.
- **Remedy:** Added forward-only migration `0032_audit_event_access_hardening.sql` with organization-scoped insert/read and restrictive update/delete denial. Corrected static tests to accept valid PostgreSQL dollar-quoting, test the new forward migration, verify retry-envelope spread semantics, and detect actual vector client imports/calls.
- **Commits:** `7557a6cd820e8a199f434d9e5e6effa77f2a3178`, `ee85b55401b9154c42a795400589589fbb930b1d`, `cecae73edf181771396d6c8c30e1bad3c622c3fd`, `c4d4abd06f6001f4198c23c42f0b2312ea7601eb`, `96996d82ea034688485b1b9e92ed78fb0d024aee`.
- **Failed approaches:** Do not rewrite every valid DO block for a test-only tag expectation; do not add redundant fields to the retry object; do not remove accurate documentation to satisfy a blanket word-ban.
- **Verification:** GitHub source writes and re-fetch succeeded. Focused tests, typechecks, and migration execution NOT RUN. No PASS claimed.
- **Lockfile discrepancy:** User's local output reports two lockfile documents, but current main has exactly one `lockfileVersion:` and one `importers:` header. Local checkout/diff is needed to determine whether the duplicate is uncommitted or stale.
- **Next action:** Pull latest main; compare local lockfile with `origin/main`; run focused migration Vitest and worker RabbitMQ test, then web and worker typechecks sequentially. Route Docker/CI/deployment/environment defects to OPS-01.


## ISS-020 — Phase 4 migration test targeted wrong migration (2026-10-10)
- **Severity:** medium (focused test failure; source schema artifacts exist in later migrations)
- **Owner:** FIX-01
- **Status:** test_source_corrected_verification_pending
- **Finding:** The test asserted `summary_sources` and its tenant policy against `0002_application_domain.sql`, but the table is created in `0003_phase4_schema_alignment.sql` and its RLS policy is created in `0004_phase4_schema_cleanup.sql`.
- **Correction:** Static test now verifies those artifacts in the migrations that actually own them.
- **Commit:** `c51d5a79dfd999dd4382cc60005798531e5517be` on `fix/migration-verification-phase4-contract`.
- **Verification pending:** Focused Vitest, worker tests, typechecks, migration execution, and runtime checks. No PASS claimed.
- **Separate local issue:** User's local `pnpm-lock.yaml` showed two YAML documents, while fetched current main contains one. Compare local checkout to current remote before editing lockfile.


## ISS-021 — PostgreSQL dollar-quote test false positives and local lockfile drift (2026-10-10)
- **Severity:** medium (static verification false positives; local test run also blocked by a divergent lockfile)
- **Owner:** FIX-01
- **Status:** assertions_corrected_retest_pending
- **Finding:** Bootstrap verification expected `END\n$;` instead of a valid double-dollar terminator, while `/^AS \$/m` and `/^\$/m` also matched the prefix of valid `$$` delimiters.
- **Correction:** Test now checks for a valid `$$` closing delimiter and detects a single dollar only when it is not followed by another dollar.
- **Commit:** `58730eb8b0fa46bfdd5fca581295209921582dbe`.
- **Separate local state:** Local `pnpm-lock.yaml` has two document headers and is marked modified; the fetched PR branch lockfile has one. Do not overwrite until local backups/status are preserved; restore/reconcile from the PR branch once confirmed.
- **Verification pending:** Rerun focused Vitest after local lockfile reconciliation. No PASS claimed.


## ISS-022 — Audit hardening migration assumes public schema (2026-10-10)
- Severity: high (manual deployment blocked before app services start)
- Owner: OPS-01 / FIX-01
- Status: source_corrected_execution_pending
- User evidence: Docker images built, migrations 0000–0031 were skipped, and migration 0032 failed because public.audit_events was absent.
- Root cause: the base migration creates audit_events without schema qualification. With search_path=aca,public this resolves to aca.audit_events, but migration 0032 required public.audit_events.
- Correction: migration 0032 now checks and operates on audit_events through the active connection search_path; the organization helper remains explicitly qualified as public.can_access_organization. Added a static regression assertion rejecting the old hard-coded prerequisite.
- Commits: migration 387c7e50f258c13e0e4aa03ae5b319896b27eabc; test 4e455f4d55051ffa16bb7a52f85baf1c3218e3f5.
- Migration-history caution: the reported database failed before recording 0032. Any database that already recorded the old 0032 checksum may reject the updated file; inspect its migration ledger before rollout and do not delete ledger entries blindly.
- Verification: GitHub source writes only. No SQL migration, focused test, typecheck, build, or runtime deployment was run. No PASS claimed.
- Follow-up from user's rerun (2026-10-10): schema resolution passed, but PostgreSQL rejected the DELETE deny policy because DELETE policies accept USING and not WITH CHECK. Corrected `audit_events_delete_deny` to `USING (false)` only; UPDATE deny policy retains `USING (false) WITH CHECK (false)`. Added static regression coverage. Commits: SQL `03f8e87c039c097784e0acb9e671ba853f5ca852`; test `b955d4bb2a076616de5d396f7b14f3ff23bdc772`.
- Verification pending: user must pull latest main and rerun manual-up; no migration success or runtime PASS claimed.

## ISS-023 — Legacy attachment schema breaks inbox and role hierarchy rejects organization owners (2026-10-10)
- **Severity:** high (mail inbox fails to load; drafts endpoint rejects higher-privilege organization members; mailbox sync can remain queued when RabbitMQ is unavailable).
- **Owner:** FIX-01 for source/schema/auth; OPS-01 for live broker/database/runtime evidence.
- **User evidence:** After migration 0032 succeeded, Docker web logs showed `column ea.message_id does not exist` from inbox loading. The worker repeatedly logged RabbitMQ startup failures (`Expected ConnectionOpenOk; got <ConnectionClose channel:0>`) and queue producer poll failures. Draft GET returned 403 `insufficient_role` / `Requires one of: member`.
- **Root cause A:** Legacy `0002_application_domain.sql` creates `email_attachments.email_message_id`, but the current DB repository queries `email_attachments.message_id`. Migration 0030 reconciles message fields but not this attachment foreign-key rename.
- **Correction A:** Added forward-only, idempotent migration `0033_email_attachment_message_id_compatibility.sql`; it adds `message_id`, copies legacy references, rejects orphaned rows instead of silently disconnecting them, and indexes the canonical column.
- **Root cause B:** `requireRole` only let owners satisfy admin guards; it did not implement the implied minimum-role hierarchy, so owners/admins could be denied endpoints requiring `member`.
- **Correction B:** Implemented hierarchical role ranks `member < admin < owner` and added a static auth regression assertion.
- **Root cause C / reliability gap:** When `RABBITMQ_URL` was set but RabbitMQ enqueue failed, the polling loop logged the error and did not attempt its existing leased direct-sync batch, leaving eligible mailboxes dependent on a broken broker.
- **Correction C:** Queue producer failures now attempt `processMailboxSyncBatch`, which still fails closed if the Redis distributed lease is unavailable. RabbitMQ startup logs now include sanitized endpoint and protocol error metadata without credentials; a regression assertion covers the fallback.
- **Commits:** migration `de8a79b2d94fb303d14327867d93e9d1337e58bf`; auth `0ab61969e007721858e3fb408c99dd8bcdcc2b88`; auth test `25d3523668d6d1c1a7e3a63173ebda40410233f8`; migration test `65ca6a0da10710cc864fb33202b0cdf51814f20f`; worker fallback `a01242027807722e7ea1c4d85461c92d7b189f7a`; RabbitMQ diagnostics `d058b5e1cbdc4b4e4a04625aada25c15d0ae0208`, corrected safe vhost parsing `27d960eb433fd20726c3d247160e95ddc07f69e8`; fallback test `c45f6a9dc1bc1b1cba289f1b6fac1ca689199993`.
- **Verification:** Source committed only. Tests, typechecks, image rebuild, migration 0033 execution, provider fetch, queue/Redis authentication, and live API behavior have NOT been run here. Do not claim inbox/sync/drafts are fixed until the user reruns the stack.
- **Security note:** User's pasted curl included session cookies and an access token. Treat the token as exposed: revoke/logout and obtain a fresh session; never paste or commit credentials.
- **Next action:** Pull latest `main`, rebuild/restart web and worker and run `bash scripts/manual-up.sh`. Confirm migration 0033 applies, inbox no longer errors, and drafts GET works for owner/admin/member. Inspect sanitized RabbitMQ diagnostics. If queue remains unavailable, check the direct-sync fallback result and Redis lease error; never bypass the distributed lease. Confirm actual provider sync completion and persisted email rows rather than treating queued/HTTP 202 as success.


## ISS-020 — Membership role rank map omits viewer

- **Opened:** 2026-10-10
- **Severity:** blocker (web production build/typecheck)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress
- **Description:** User's `bash scripts/manual-up.sh` failed in the Docker web build after Next.js compilation, during type validation: `apps/web/src/lib/identity/authorization.ts:109` declared `Record<MembershipRole, number>` with only member/admin/owner. Shared `MembershipRole` also contains viewer.
- **Root cause:** Exhaustive rank record was not updated when the role union included viewer. The intended minimum-role hierarchy is viewer < member < admin < owner.
- **Remedy:** Added `viewer: 0` to the rank map (commit `44a08522f23e807755114ebe46b8b1e04e6056da`) and added RBAC regression cases (commit `3853ecf046c175e15a4f824e9679f50fb7132cf9`).
- **Verification state:** Source committed; focused Vitest, web typecheck, Docker build, and runtime checks not yet run after the fix.
- **Next action:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/rbac.test.ts`, then `pnpm --filter @ai-comms-agent/web typecheck`, then rerun `bash scripts/manual-up.sh` and capture output. Route separate infrastructure/deployment defects to OPS-01.
- **Verification follow-up:** The user's first focused run found a test-only bug: `fixture.adminA` does not exist, causing an unauthenticated subject and TS2339. Corrected in commit `113b2b3ee094042e9380404f3073c39b17e07951` by promoting `fixture.memberA` to admin through the repository. Retest/typecheck/build remain pending.


## ISS-024 — Email account setup returns 502; OAuth mailbox sync unverified

- **Opened:** 2026-10-10
- **Severity:** high (mailbox connection and core email ingestion)
- **Owner:** FIX-01 / Sentinel for source defects; OPS-01 for confirmed deployment/runtime/network defects
- **Status:** diagnostics_committed_waiting_for_server_evidence
- **Description:** User reports `POST /api/email-accounts` returns HTTP 502 when configuring IMAP/SMTP and OAuth-connected mailboxes are not syncing/fetching messages. Their deployment log shows web/worker images built, migrations completed, and both containers started, but does not include authenticated API response bodies, per-account sync state, message counts, or worker failure evidence.
- **Source findings:** The account API deliberately returns 502 when IMAP/SMTP connection testing fails. The manual sync endpoint accepts Gmail only (returns 409 for Zoho/IMAP-SMTP), while the worker's periodic due-account query includes Gmail, Zoho and IMAP-SMTP. OAuth callback completion and HTTP 202 are not evidence that messages were persisted.
- **Remedy so far:** Added `scripts/diagnose-email-accounts.sh` in commit `a529ffe43915495d099c17b353fb517d53fac10b` to compare public Cloudflare and local origin, test the provider connection without saving, inspect PostgreSQL sync state/message counts, and capture sanitized web/worker logs.
- **Verification:** Script source committed; not yet executed on the user's host. Live root cause remains unknown. No fix/pass claimed for the reported runtime failures.
- **Next action:** User executes script from repo root and shares the sanitized report. FIX-01 corrects source bugs; OPS-01 handles confirmed DNS/outbound network, reverse-proxy, database/Redis/RabbitMQ, container configuration or runtime deployment defects.

## ISS-025 — Live OAuth mailbox sync blocked by worker infrastructure configuration (2026-10-10)
- **Severity:** critical (core email ingestion currently nonfunctional for the observed account)
- **Owner:** OPS-01 for deployed runtime configuration; FIX-01 only if a source defect remains after configuration correction.
- **Status:** runtime_configuration_correction_required
- **Evidence:** User-run `scripts/diagnose-email-accounts.sh` report dated 2026-10-10: public and local health both return HTTP 200, but that health check only reports configuration presence. Gmail account `7fc144d9-f2c8-492f-aade-c112f17bfddc` remains `pending`, sync status `idle`, no last attempt/success, and zero stored messages after manual sync returned HTTP 202. Worker logs repeatedly show RabbitMQ consumer failure with virtual host literal `YOUR_EXISTING_VHOST` and Redis lease authentication `WRONGPASS`; fallback safely skips the batch when Redis lease acquisition fails. These two runtime failures are sufficient to explain why the queued sync has not run.
- **Separate test only:** the non-persistent IMAP/SMTP probe returned `IMAP authentication failed`, and the entered username differed from the mailbox address entered earlier. This does not validate or invalidate the OAuth token.
- **Required correction:** On the server, inspect `.env.docker` locally without sharing secrets. Replace the RabbitMQ URL's placeholder username/password/virtual host with the real broker credentials and actual vhost; correct `REDIS_URL` to match the active Redis ACL username/password, database and TLS mode. Use URL-encoding for reserved characters. Do not copy values from example templates. Restart/recreate the worker after updating env. Never bypass the distributed Redis lease.
- **Recovery sequence:** verify worker logs no longer show RabbitMQ `ConnectionClose` or Redis `WRONGPASS`; requeue Gmail sync; then confirm account status/sync timestamps advance and persisted `email_messages` count increases. HTTP 202 alone is not success. Check inbox only after rows are persisted.
- **Security:** Do not paste environment URLs, credentials, cookies, OAuth codes, access tokens or mailbox contents into chat or project-control files.
- **Verification:** Source-level RabbitMQ test passed 10/10 in user terminal; migration static test passed 86/87 with a separate local duplicate-lockfile-header failure. Neither is a live sync PASS. Live provider ingestion remains blocked/unverified.


## ISS-026 — Chat email context is organization-scoped rather than agent-account-scoped
- **Opened:** 2026-10-13
- **Severity:** critical (cross-agent mailbox isolation)
- **Owner:** FIX-01 / Sentinel
- **Status:** remediation_committed_runtime_sql_verified_live_endpoint_pending — source fix landed on main (99fd6793); runtime SQL behavior verified against live Supabase (all 6 scenarios PASS on both violation sites); live Vercel endpoint check deferred pending Vercel deploy of 99fd6793
- **Evidence:** `apps/web/src/app/api/chat/stream/route.ts` calls `loadEmailContext(organizationId, content)`. Its SQL filters by organization and connected account status but does not join `agent_email_accounts` or filter by the active `agentId`. An agent can therefore receive local email context from another agent's mailbox in the same organization, even though account bindings are the product authorization boundary.
- **Required remedy:** FIX-01 must make email context account-scoped to the active agent's bindings and permitted binding roles, pass `agentId` into the loader, add cross-agent/cross-account regression coverage, and ensure email content remains marked untrusted. Do not rely on organization membership alone for agent mailbox access.
- **Remedy applied (2026-10-16, commit 99fd6793):**
  - `apps/web/src/app/api/chat/stream/route.ts:loadEmailContext()` signature changed from `(organizationId, content)` to `(organizationId, agentId, content)`.
  - SQL `JOIN agent_email_accounts b ON b.email_account_id=a.id AND b.agent_id=$2 AND b.role IN ('primary','read_only')` added. `send_only` agents cannot read inbox emails via this path.
  - Caller in the POST handler now passes `agentId` from the request body (already validated against the agent repository).
  - `packages/clara-core/src/runtime.ts:groundContext()` — the hybrid retriever's `email_messages` direct query also JOINs `agent_email_accounts` with the same role filter, closing the second violation site (the runtime RAG path is called via `claraRuntime.createChatTurn({ ragMode: "hybrid" })` from both chat and realtime voice).
  - Pre-existing parameter-layout bug in `groundContext` (SQL referenced `$4` for textQuery but params started with `[orgId, textQuery, ...]` so `$4` actually pointed at an email address) fixed. New layout: `$1=orgId, $2=agentId, $3=textQuery, $4=lookupTerms[]`.
  - 7 new regression assertions in `apps/web/tests/chat-memory-regression.test.ts` covering: signature change, caller update, SQL JOIN + role filter, parameter layout, runtime-side JOIN, runtime-side parameter layout, agent-scoped empty-result message. All 13 tests PASS.
- **Runtime verification (2026-10-16, by FIX-01 acting for OPS-01):**
  - ✅ Step 1 — `agent_email_accounts` schema in `aca` schema matches JOIN column names (agent_id, email_account_id, role).
  - ✅ Step 2 — `loadEmailContext` SQL: all 6 scenarios PASS against live Supabase.
    - Scenario D (no binding): 0 rows ✅
    - Scenario A (primary): 20 rows ✅
    - Scenario B (read_only): 20 rows ✅
    - Scenario C (send_only): 0 rows ✅
    - Scenario E (no binding, second agent): 0 rows ✅
    - Scenario E2 (cross-agent isolation, OpenAI=primary + Sarvam=send_only on same mailbox): OpenAI=20, Sarvam=0 ✅
  - ✅ Step 3 — `groundContext` SQL: same 6 scenarios PASS.
  - ⚠️ Step 4 — Live `/api/chat/stream` on Vercel: DEFERRED. Vercel has not auto-deployed commit `99fd6793` as of 06:58 UTC (20 minutes post-push). Response still shows pre-ISS-026 20-email dump behavior. User must trigger manual Vercel deploy or wait for auto-deploy queue to drain. OPS-01 should re-run Step 4 once Vercel deploys.
  - Verification report: `/home/z/my-project/download/iss026-runtime-verification.md`.
  - Test artifacts: `/home/z/my-project/scripts/verify-iss026-step{1,2,3,4}-*.mjs`.
- **Verification:** Runtime SQL behavior verified against live Supabase for all 6 scenarios on both violation sites (web route + clara-core runtime). Live Vercel endpoint check deferred pending deploy. No production PASS claimed until Vercel serves `99fd6793`.
- **Role routing:** DEV-01 does not take ownership of this substantial security bug; continue modular tool work against the bound-account repository contract. OPS-01 remains responsible for infrastructure/deployment defects and runtime verification of the ISS-026 fix (specifically, re-running Step 4 once Vercel deploys `99fd6793`).


## ISS-027 — Email vector sync outbox has no supported Clara email-vector API
- **Opened:** 2026-10-14
- **Severity:** high (email retrieval consistency and account-removal data lifecycle)
- **Owner:** DEV-01 / Forge for supported adapter integration; OPS-01 only for live infrastructure/ingestion verification after source integration.
- **Status:** clara_api_source_implemented_verification_pending_and_ISS-026_open
- **Evidence:** ai-comms-agent persists email-derived `knowledge_documents` and `knowledge_chunks` in PostgreSQL and has a durable `email_knowledge_sync_jobs` outbox plus an injected retryable vector adapter contract. Clara PR #298 now contains a draft authenticated email-vector API with deterministic point IDs, account-filtered search, lifecycle operations, and content hashes. The API remains unmerged and has not been runtime-verified; do not treat the draft as production-ready.
- **Security prerequisite:** ISS-026 remains open and FIX-01-owned. Do not bind/start the adapter or expose vector retrieval until active agent-to-account authorization is established.
- **Required next action:** Verify and land Clara PR #298 only after its API contract is sufficiently reviewed/tested. After FIX-01 closes ISS-026 and the Clara API is verified, bind the existing worker adapter to the durable outbox and start the sync loop. OPS-01 owns live Qdrant, ingestion, isolation evidence, and latency/correctness acceptance.
- **Verification:** Source inspection/docs only; no tests, typecheck, build, endpoint calls, live Qdrant operations, ingestion, or latency verification. No vector sync PASS claimed.
- **Boundaries:** FIX-01 retains ISS-026 ownership; OPS-01 owns live infrastructure and ingestion/performance verification.


## ISS-027 — Worker build rejects unchecked decrypted credential records

- **Opened:** 2026-10-16
- **Severity:** high (worker image build blocker)
- **Owner:** FIX-01
- **Status:** in_progress — source correction committed; verification pending
- **Description:** Clean Docker build failed TypeScript compilation in `gmail-watch-worker.ts` and `imap-idle-worker.ts`: generic `Record<string, unknown>` credential data was asserted as `EmailCredentials` despite the required `credential_type` discriminant.
- **Root cause:** Decrypted credential repository results are a generic record and the provider-worker consumers did not validate the credential discriminant before adapter use.
- **Remedy:** Validate `credential_type` against `oauth_token`, `password`, and `app_password`; pass a spread object with the narrowed discriminant; remove unsafe assertions.
- **Failed approaches:** Do not bypass the compiler with `as unknown as EmailCredentials`; it would suppress a meaningful trust-boundary check. No other attempted remedy is evidenced.
- **Evidence:** User-provided Docker build log; source correction commits `185b729d`, `60fadabf`, `e3ba38c9`, `18948e08`. Typecheck, tests, and Docker rebuild have not yet been rerun.
- **Prevention:** Validate decrypted/persisted JSON at the consumer boundary and use the worker TypeScript build as regression protection.
- **Next action:** Run worker typecheck, targeted tests, and worker image rebuild. Route unrelated environment/deployment faults to OPS-01.


## ISS-028 — Worker queries Microsoft Graph value missing from email_provider enum

- **Opened:** 2026-10-16
- **Severity:** high (mailbox sync poll and queue retry paths fail repeatedly)
- **Owner:** FIX-01 / Sentinel for source/schema correction; OPS-01 for migration execution, worker rollout, and runtime verification.
- **Status:** source_corrected_verification_pending
- **Symptom:** User-provided worker logs repeatedly show SQLSTATE 22P02, invalid input value for enum email_provider: "microsoft_graph", from both due-mailbox polling and single-account lookup. Queue attempts advance through retry and dead-letter queues while the same provider filter fails. Microsoft Graph subscription worker also logs that subscriptions are disabled because DB/credential encryption/HTTPS prerequisites are missing; that warning is a separate prerequisite and does not explain the enum error.
- **Root cause:** 0002_application_domain.sql defines email_provider with gmail, imap_smtp, and zoho. 0003_email_domain.sql defines a separate email_account_provider enum containing microsoft_graph, but that does not extend email_provider, which is used by email_accounts.provider and the failing worker query. Application code was advanced to use microsoft_graph without a forward migration updating the actual enum.
- **Failed approaches:** Queue retry and leased direct-sync fallback execute the same invalid query. The separate email_account_provider enum is not a substitute. Removing Microsoft Graph from the query would mask the schema defect and suppress intended provider support.
- **Remedy:** Added supabase/migrations/0034_email_provider_microsoft_graph.sql with ALTER TYPE email_provider ADD VALUE IF NOT EXISTS 'microsoft_graph'; added static regression assertions in apps/web/tests/migration-verification.test.ts.
- **Evidence:** User-provided logs show SQLSTATE 22P02; source inspection confirmed enum mismatch; migration and test commits are recorded in GitHub history. Migration execution, tests, typechecks, and runtime sync remain unverified.
- **Prevention lesson:** When a provider is added, update the exact enum used by the persisted column, not a similarly named parallel enum; add a forward-only migration and regression assertion alongside application support.
- **Next action:** OPS-01 applies migrations with the normal migration runner, rebuilds/restarts the matching worker, confirms the enum error is gone, then checks account sync timestamps and persisted message counts. Keep runtime verification pending until observed.


## ISS-029 — WhatsApp outbound insert fails with PostgreSQL 42P10

- **Opened:** 2026-10-17
- **Severity:** high (outbound WhatsApp messages cannot be queued on the observed deployment)
- **Owner:** FIX-01 / Sentinel for source correction and regression coverage; OPS-01 for database/index confirmation, container rollout, and live runtime verification.
- **Status:** source_corrected_runtime_verification_pending
- **Symptom:** User's deployed POST /api/whatsapp/messages returns internal_server_error. Web logs show SQLSTATE 42P10 on INSERT ... ON CONFLICT (organization_id, idempotency_key) DO NOTHING.
- **Root cause:** Migration 0004 declares whatsapp_messages_idempotency_uniq as a partial unique index on (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL. The outbound INSERT conflict target omitted the predicate, so PostgreSQL could not infer the partial index.
- **Remedy:** Updated packages/db/src/messaging/whatsapp-repository.ts to include WHERE idempotency_key IS NOT NULL in the conflict target (commit ea8c19cfd9e235319323ed1bb7345e0395f5534e). Added apps/web/tests/whatsapp-idempotency-conflict-target.test.ts (commit 4243afe7748d43ae371c06315f85d47f249cc814).
- **Verification:** GitHub source writes only. Regression test, typecheck, deployed schema/index, Docker rebuild, API queueing, worker processing, Meta delivery, and idempotency replay have NOT been verified.
- **Next action:** OPS-01 confirms the unique index exists on the exact production database, deploys the matching source, then verifies queue row persistence, worker/provider outcome, same-key deduplication, and different-payload conflict. See [OPS-01 issue #33](https://github.com/Rilan-Dev/ai-comms-agent/issues/33) and `docs/project-control/sessions/FIX01-WHATSAPP-IDEMPOTENCY-20261017.md`.

## ISS-NEW — Chat provider override falls back to OpenAI when org defaults row is absent
- **Opened:** 2026-10-17
- **Severity:** high (agent chat unavailable for saved non-OpenAI provider overrides under affected DB state)
- **Owner:** OPS-01 for live DB/deployment verification; FIX-01 for source correction already committed
- **Status:** in_progress
- **Description:** User configured per-agent Sarvam chat, but `POST /api/chat/stream` returned `AI provider openai is not configured`. Source trace found `organizationAIConfig` returned null before reading per-agent settings when `organization_ai_runtime_settings` had no row. That path silently falls back to process environment selection (OpenAI by default), bypassing saved agent provider settings.
- **Source correction:** Commit `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0` supplies safe defaults and continues per-agent provider lookup. Regression test authored at `apps/web/tests/clara-agent-provider-resolution.test.ts`.
- **Verification:** Actual live row condition not confirmed. Test/typecheck/build/deployment not run. No production PASS claimed.
- **Resolution plan:** OPS-01 confirms serving revision and tenant-scoped presence of org settings, agent override, and provider credential metadata; deploy/restart via existing manual process and verify a Sarvam chat turn. If org defaults row exists, diagnose stale build or missing/disabled provider row. Do not add OpenAI key as a workaround.


## ISS-030 — Chat stream dereferences nullable authorization membership

- **Opened:** 2026-10-18
- **Severity:** high (web production build blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress — source corrected; post-fix build/test evidence pending
- **Symptom:** User's Docker web build failed type validation at `apps/web/src/app/api/chat/stream/route.ts:384`, TS nullable access on `subject.membership.role`. Next.js compilation itself succeeded and worker image built.
- **Root cause:** The shared `AuthSubject` type allows nullable membership. The successful `authorize()` implementation ensures active membership, but the route did not narrow the public type before building trusted `ToolContext`.
- **Failed approaches rejected:** Defaulting the role, using non-null assertions/casts, weakening authorization, or broad unrelated type redesign.
- **Remedy:** Added a fail-closed 403 guard after `authorize()`; added static regression coverage for guard-before-context ordering. Commits `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9` and `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`.
- **Prevention:** Explicitly narrow shared auth types at security-sensitive call sites even when a helper enforces a stronger runtime invariant. Keep source errors separate from environment toolchain failures.
- **Evidence/verification:** Patch and regression source are committed; no post-patch web build or test execution is yet evidenced.
- **Next action:** Pull latest main and rerun Docker Compose build; then run focused test. Host-native `pnpm: command not found` is routed separately to OPS-01.


## ISS-031 — WhatsApp template row strict nullability blocks web build

- **Opened:** 2026-10-18
- **Severity:** high (web production build blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress — source corrected; post-fix build/test evidence pending
- **Symptom:** User's Docker build failed type validation at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119`, TS18048: `synced.rows[0]` may be undefined. Next.js compilation succeeded and worker image was exported.
- **Root cause:** A `rows.length` check did not narrow direct indexed access to `synced.rows[0].components`.
- **Failed approaches rejected:** Non-null assertion, cast, compiler relaxation, or changing template approval policy.
- **Remedy:** Explicitly bind and guard `syncedTemplate`, preserving the existing 409 `template_not_synced` fail-closed response; add a regression source assertion. Commits `90fac5e0774b695446e1e0c3ab51072639ba5f06` and `41734923651b1173a703d747f0ac0aa93317a5b9`.
- **Prevention:** Narrow the actual database-returned row before reading fields.
- **Evidence/verification:** Source/test committed; no post-fix build or test execution is evidenced.
- **Next action:** Pull latest main, rerun manual Docker deployment build, then run focused `whatsapp-send-approval.test.ts`. Keep build status pending until output is observed.


## ISS-032 — Duplicate generationId declaration blocks voice workspace build

- **Opened:** 2026-10-18
- **Severity:** high (web production build blocker)
- **Owner:** FIX-01 / Sentinel
- **Status:** in_progress — source corrected; post-fix build/test evidence pending
- **Symptom:** User's `bash scripts/update-and-up.sh` reports webpack parse failure in `apps/web/src/app/ai-voice/voice-workspace.tsx` at line 340: `Identifier 'generationId' has already been declared`.
- **Root cause:** The Sarvam/ElevenLabs speech branch declared `const generationId` before attempting streaming TTS, then declared the same identifier again in the same lexical block for HTTP speech fallback playback. Both declarations use the same session/sequence value.
- **Remedy:** Reuse the first declaration for fallback playback; preserve generation tracking and playback callbacks. Added regression assertion that the provider speech branch has exactly one declaration and assigns that identifier to `ttsGenerationRef.current`.
- **Commits:** source `f6efffdb42dbd75df38841fab43b985eb565ee3f`; regression test `05519965adae7ebab837a03e4d7a0d2306e3f0c1`.
- **Evidence/verification:** User's log proves worker image build/export and web webpack parse failure before correction. Post-fix build and test are NOT RUN / NOT VERIFIED.
- **Prevention lesson:** When adding a fallback branch within an existing lexical scope, reuse the request/generation identity already computed rather than redeclaring a `const`.
- **Next action:** Pull latest main, rerun `bash scripts/update-and-up.sh`; if compilation passes, run focused `voice-realtime-transport.test.ts`. Record actual output before closing.



## ISS-033 — Voice audio resampling indexed sample nullability (2026-10-18)
- **Owner:** FIX-01 / Sentinel for source correction; OPS-01 only for separate environment/deployment failures.
- **Evidence:** User's Docker deployment log shows Next.js compilation succeeds but TypeScript fails at `apps/web/src/app/ai-voice/voice-workspace.tsx:331`: `input[i]` has type `number | undefined` and is passed to `Math.min`.
- **Root cause:** Typed-array indexed reads are possibly undefined under the project's strict indexed-access settings; the same risk exists in the averaging loop.
- **Correction:** Treat an absent indexed sample as zero in both same-rate conversion and downsampling accumulation. This is defensive and preserves finite audio conversion without weakening type checks.
- **Regression:** Added a focused source-contract assertion in `apps/web/tests/voice-realtime-transport.test.ts` for both fallback guards.
- **Commits:** source `baa9746142297322c5bf796e7c6fb94060bbc9cf`; regression `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Verification:** Source and test are committed on `main`; post-fix Docker build and focused test are NOT RUN / NOT VERIFIED.
- **Next action:** Pull latest `main`, rerun `bash scripts/update-and-up.sh`, then run `pnpm --filter @ai-comms-agent/web exec vitest run tests/voice-realtime-transport.test.ts` if the build succeeds and pnpm is available. Continue with any subsequent source error; do not mark build green without actual output.

## ISS-034 — Strict indexed access and trusted voice context typecheck (2026-10-18)
- **Owner:** FIX-01 / Sentinel for source and regression fixes; OPS-01 only for separate host/deployment failures.
- **User evidence:** After the prior resampling guard was merged, the web TypeScript check surfaced more strict-indexed-access errors at voice workspace lines 368, 432, and 606, plus /api/voice/turn/route.ts nullable membership and non-string conversation ID typing, and WhatsApp template selection destructuring at whatsapp-client.tsx:202.
- **Root cause:** Strict indexed-access types permit undefined for typed-array reads and split-array elements; the shared authorization/session contracts are broader than the runtime assumptions at this call site.
- **Correction:** Guard indexed PCM/WAV samples with ?? 0; narrow voice-turn membership with an explicit 403 fail-closed guard; pass a validated string conversation ID or session ID fallback; give template-selection destructured fields safe defaults. No compiler settings or security checks were weakened.
- **Regression coverage:** Extend voice-realtime-transport.test.ts for audio sample guards, membership narrowing and conversation ID type; extend whatsapp-send-approval.test.ts for safe template selection defaults.
- **Commits:** voice workspace 1fb045298ed77cd218a36d7babdc911e17b2211d; voice turn route 9a9e09ee4f6a8c3e2ece81d0b717e9ef22403281; WhatsApp UI 5946168a22cd316e03c7e859c17d5a53724d48f3; voice test 57618396c400863cf9de31a3dde6de1869447a6b; WhatsApp test fee2a2394dfe1e687a470c0caa24a26a9039a20b.
- **Verification:** Source and regression changes are committed. The user's logs are pre-fix; post-fix web typecheck, tests, Docker build, and deployment are NOT RUN / NOT VERIFIED.
- **Next action:** Pull latest main; rerun pnpm typecheck and bash scripts/update-and-up.sh. If further compiler errors appear, continue narrow source fixes and keep deployment/test claims tied to actual output.

## ISS-035 — Manual deployment Compose environment flag incompatibility

- **Opened:** 2026-10-18
- **Severity:** high (blocks manual migration/startup after image build)
- **Owner:** OPS-01
- **Status:** in_progress
- **Evidence:** User's current `bash scripts/update-and-up.sh` output shows both worker and web images built successfully, including the Next.js production build. Deployment then stops at migration DB configuration with `unknown flag: --environment`, emitted by `docker compose config --environment`.
- **Root cause:** `scripts/manual-up.sh` relied exclusively on a newer Docker Compose config option unsupported by the user's installed Compose version.
- **Correction:** Source commit `a93176b3cbba730c30a016b4e47a9dd3dd46039c` adds a compatibility fallback that first checks host `DATABASE_URL`, then reads the key from the script's `.env` interpolation file; unresolved interpolation and missing values fail closed. It does not print the DSN. Regression source-contract test commit: `0386f03fa9534ff2d53db84b7ffbd2b5fe864154`.
- **Verification:** User's log verifies image builds only. Compatibility test execution, migrations, container startup, health, and runtime behavior remain pending.
- **Next action:** Pull latest `main`; run `node --test scripts/tests/manual-up-compose-env.test.mjs`, then `bash scripts/update-and-up.sh`. Capture whether migration execution and `docker compose up -d` complete. Do not share the database URL or other secrets.

## ISS-036 — Manual Compose references missing parent env file

- Opened: 2026-10-18
- Severity: high (blocks application startup)
- Owner: OPS-01
- Status: in_progress
- Evidence: User log shows image builds succeeded and migration chain completed, then Compose failed because `/home/techadmin/docker/.env` was missing.
- Root cause: `docker-compose.yml` referenced `../.env`, but `scripts/manual-up.sh` uses repository-root `.env`. Compose resolves `env_file` paths relative to the Compose file.
- Correction: Both service paths changed to `.env` in commit `5072621a66eab0016bf8c29e76df8683070baa14`. Regression assertion added in commit `2649466dd53f5a545bfaa2dd52ecaa9df959ba00`.
- Verification: Source only. Focused test, Compose startup and health remain pending.
- Next: Pull latest main, run `node --test scripts/tests/manual-up-compose-env.test.mjs`, then rerun `bash scripts/update-and-up.sh`. Share sanitized output only.


## ISS-037 — Host-side migration runner cannot resolve Docker-only PostgreSQL hostname

- **Opened:** 2026-10-18
- **Severity:** high — migrations fail before deployment validation
- **Owner:** OPS-01
- **Status:** in_progress — OPS-01 source/test committed; actual migration and live health verification pending
- **Symptom/evidence:** User ran `bash scripts/update-and-up.sh`; image build completed, then `packages/db/migrate.js` logged a masked URL whose host was `postgres:5432` and failed with `getaddrinfo ENOTFOUND postgres`. The script then continued to container startup. User's container inspection showed `aca-postgres`, web and worker attached to `ai-comms-agent_default`; PostgreSQL had network alias `postgres`. Host `pg_isready -h 127.0.0.1 -p 5433` and in-container `pg_isready` succeeded.
- **Root cause:** `scripts/manual-up.sh` runs `node packages/db/migrate.js` on the host. The hostname `postgres` is Compose-network DNS, not host DNS. The script's existing translation only rewrites `host.docker.internal`, so it does not make `postgres` resolvable on the host.
- **Recent history:** Current main was `2cf9a52266af0fd69df809b40f482bb0eb95fb5c` (`fix(docker): update Postgres port mapping to avoid conflict`, host mapping changed from `5432:5432` to `5433:5432`). Earlier OPS-01 commits `a93176b3cbba730c30a016b4e47a9dd3dd46039c` and `0386f03fa9534ff2d53db84b7ffbd2b5fe864154` address unsupported Compose `config --environment`, not Docker-only hostname resolution. The new error is a separate failure after that fallback.
- **Failed approaches:** Running the migration runner on the host with `postgres:5432` fails DNS. Changing application URLs to `host.docker.internal:5433` is not the requested architecture and would route app database traffic through the host-published port. Do not use that as the fix.
- **Remedy for OPS-01:** Run the migration runner as a one-off Compose service container so it uses Compose DNS and the same internal network, preserving `postgres:5432`. Important implementation detail: the current Dockerfile copies `apps` and `packages` but not `supabase/`; the migration runner auto-detects `/workspace/supabase/migrations`. Therefore mount the repository's `supabase` directory read-only into the one-off container at `/workspace/supabase`, or make the smallest reviewed image change that includes migration files. Add a regression test proving the migration invocation runs in Docker, uses the internal hostname, and does not rewrite app connection URLs to the host. Do not print database URLs or credentials.
- **Configuration caution:** Compose initializes `POSTGRES_DB=aca`, while the user's supplied URL ended in `/postgres`. Do not silently change the target database; OPS-01 must confirm which database is the intended application database before applying migrations.
- **Verification state:** Source/config inspection plus user-provided command output only. No migration was successfully rerun in a container, no database target was confirmed, and no post-fix deployment/health PASS exists.
- **Next action:** OPS-01 owns the corrective deployment-script/migration-container change and regression test, then the user runs the focused test and deployment script. Record migration result and container health separately. FIX-01 makes no deployment/infrastructure source change.


### ISS-037 implementation update — 2026-10-18
- OPS-01 committed the minimal source correction in `scripts/manual-up.sh`: migrations now run in a one-off Compose `web` container with `supabase/` mounted read-only at `/workspace/supabase`. App DB URLs remain on internal service DNS; host-side URL rewriting was removed.
- Regression tests updated in `scripts/tests/manual-up-compose-env.test.mjs`. `bash -n` passed; isolated focused Node test passed 4/4 using fetched source/test and a Compose env-file fixture. The full checkout test has not been run.
- The existing warning-and-continue startup policy remains unchanged.
- **Not yet verified:** Actual target database, migration completion, Docker image/Compose execution, or runtime health. Prior user URL targets `/postgres`; local Compose default is `aca`. Operator must confirm the intended database before rerunning migrations.
- **Next:** Confirm database target, run the focused test in the actual checkout, run deployment, and record migration outcome separately from container health.

## ISS-FIX01-IMAP-GMAIL-SELECT-20261021 — IMAP initial sync selects Gmail nonselectable folder and IDLE rejects saved credentials
- **Opened:** 2026-10-21
- **Severity:** high — connected account cannot import any messages.
- **Owner:** FIX-01 / Sentinel (source/regression); OPS-01 / Shipwright (test host, deployment and production acceptance).
- **Status:** in_progress — source corrected, actual runtime not verified.
- **Symptom/evidence:** Gmail `A0055 NO [NONEXISTENT] Unknown Mailbox: [Gmail]` during `SELECT`, initial 0/50, no last success; independent `Encrypted IMAP credentials have an invalid credential type` in IDLE worker.
- **Root cause:** listFolders did not skip `\\Noselect` container; password credential type not serialized into encrypted payload; missing SQL RETURNING comma, incomplete sync_mode commit and concurrency on one IMAP socket.
- **Remedy:** `1c1b5796,06f9b14f,1184576e,d3fa0af4,53702ac8,a655ce4e,d43f16b7,2e131fb8`. Source invariant checks 13/13; regression Node, typechecks and live import unexecuted.
- **Failed approaches/prevention:** Earlier TLS handshake timer fix alone could not address protocol-level SELECT NO. Only selectable mailbox names reach SELECT; existing credentials must normalize narrowly and new encrypted saves retain discriminants; stage and commit durable sync state correctly; serialize IMAP commands.
- **Next:** OPS-01 verify current deployed SHA and perform safe existing-account import + IDLE acceptance, record non-null lastSuccessAt and actual matching persisted row count. FIX-01 run focused tests/typechecks and fix any specific new source failure. Rotate leaked session.

### Follow-up to ISS-FIX01-IMAP-GMAIL-SELECT-20261021 — FIX01-IMAP-UID-STAGING-20261022, 2026-10-22
- **Status:** in_progress — additional source correction on `Development`, operator/live acceptance pending.
- **New symptom:** After deploy at `d0ded84d`, account `running`/initial, imported and pending both zero, lastSuccessAt null; worker emits only ready/health logs. Builds and migrations report success, not ingestion.
- **New root cause:** `ImapSmtpAdapter.sync()` fetched full MIME data for up to 50 UIDs before it returned identifiers; `processAccount` staged none until this expensive work completed and later fetched bodies again. 25-message IMAP fetch batches delayed first DB writes; failed transport reads were acked as permanently missing.
- **Remedy:** `2a8c5933` stage UIDs only, `db3d629b` tests, `b0550e52` five-message commits + progress logs, `631d96a2` preserve failed fetch IDs, `2c0e3f8a` regression. Source checks 17/17 PASS; actual package tests/production mailbox not checked.
- **Next:** OPS-01 verify deployed SHA, merge/deploy through approved workflow, actual imported rows and state; separately inspect unhealthy Redis/Qdrant; FIX-01 further bug only with reproduced source evidence. No credentials copied.

### Follow-up to email HTML ingest sanitizer gate #36 — FIX01-IMAP-MIME-RICH-BODY-20261022, 2026-10-22
- **Issue/symptom:** Existing IMAP Gmail-address mailbox stored decoded MIME incorrectly. App thread displayed quoted-printable fragments and lost sender's HTML; Gmail itself showed a rich formatted email. FIX-01's task targets MIME correctness, not global email redesign.
- **Root cause:** Inline IMAP parser mishandled nested transfer encoding and discarded html_body; shared parseRfc822 mishandled QP UTF-8 byte order and MIME boundary case; original BODY[] protocol literal framing leaked into parsing.
- **Remedy:** `5add7d2a,83c77c6d,20d0b026,cbf403fa` on Development. Preserve untrusted HTML isolation in existing sandboxed CSP iframe. HTML ingestion sanitizer security gate #36 **still open**; never claim database `html_body_sanitized` actually sanitizes source.
- **Evidence/next:** 16/16 source checks; real Node, typecheck, live MIME/browser acceptance and scoped re-fetch of previously imported mangled rows pending. OPS-01 owns rollout and authorized scoped repair; FIX-01 addresses further reproduced MIME or sanitation failures. Never delete/recreate account merely to refresh mail.
