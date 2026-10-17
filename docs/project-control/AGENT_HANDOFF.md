# APCP Central Agent Handoffs

Cross-agent handoff register. A handoff transfers context, not authority.

## Required fields

### <HANDOFF-ID> — <YYYY-MM-DD>
- **From:** <agent id / session id>
- **To:** <agent id>
- **Reason:** <why another role is needed>
- **Repository state:** <commit/ref>
- **Work completed:** <summary>
- **Remaining work:** <exact task>
- **Evidence/records:** <paths, issue/event ids>
- **Authorization:** <existing authorization reference or "not authorized; proposal only">
- **Stop condition:** <when receiving agent must stop>
- **Status:** <OPEN | ACCEPTED | COMPLETE | SUPERSEDED>

## Rules

- Never invent authority through a handoff.
- The receiving agent must independently recover current authorization.
- A handoff can be accepted while the sending agent continues unrelated independent work.
- Close or supersede stale handoffs when state changes materially.

### HOF-FIX01-OPS-AUTH-20261009 — 2026-10-09
- **From:** FIX-01 / Sentinel
- **To:** OPS-01
- **Reason:** The reported login loop remains on the live self-hosted HTTP runtime after the source-level authentication corrections are already present on `main`.
- **Repository state:** `main` at `2ab9c66640cc5132bc7f7686d0f008015b79620d`
- **Work completed:** Recovered project-control state and traced middleware → login POST → session cookie → root layout → application identity context. Current source already reads the cookie explicitly and uses PostgreSQL-backed session resolution.
- **Remaining work:** On `100.72.192.28:3300`, identify whether the running build is stale or whether session/account/membership/database configuration differs from the successful login request. Apply the smallest runtime correction and preserve fail-closed auth.
- **Evidence/records:** ISS-007; EVT-FIX01-AUTH-20261009; `apps/web/src/app/layout.tsx`; `apps/web/src/app/login/page.tsx`; `apps/web/src/lib/identity/repository.ts`; `apps/web/src/lib/identity/local-auth.ts`.
- **Authorization:** User's explicit FIX-01 bug-remediation request authorizes diagnosis/correction of this incident; OPS-01 must independently confirm runtime/deployment scope before changing infrastructure.
- **Stop condition:** Stop after the live runtime cause is corrected or a concrete missing external dependency/configuration is identified and recorded; do not weaken auth or expand product scope.
- **Status:** OPEN

### HOF-FIX01-AUTH-FIX-20261009
- From: FIX-01 / Sentinel
- To: OPS-01 / runtime verification as needed
- State: SOURCE FIX COMMITTED
- Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`
- Change: require an active organization membership before creating a login session; return explicit 403 for unprovisioned accounts; add regression protection.
- Remaining runtime action: deploy/restart the commit in the affected environment and verify a provisioned account reaches the application shell. Do not wait for CI/Vercel; runtime verification remains OPS-01 scope.


### HOF-FIX01-WHATSAPP-STATUS-20261017
- **From:** FIX-01 / Sentinel
- **To:** OPS-01 / live runtime investigation
- **State:** OPEN — runtime evidence required
- **Symptom:** Meta webhook payload for the attempted outbound message reports `failed`, error 131047 (24-hour customer-service window expired), while the conversation UI displayed `sent`.
- **Confirmed provider cause:** free-form text is not permitted outside the 24-hour window; use an approved template or wait for a customer reply. No source policy bypass is authorized.
- **OPS-01 action:** Identify serving commit; inspect redacted webhook HTTP status/body and accepted count; trace exact provider message ID in the organization/account-scoped row including status/provider_error; verify UI refresh/state mapping. Do not expose tokens or message secrets in logs.
- **FIX-01 boundary:** After runtime evidence isolates a source defect, add the smallest status-persistence/UI correction and regression test. Do not claim live delivery based on queue acknowledgement.
- **Evidence record:** `docs/project-control/sessions/FIX01-WHATSAPP-131047-20261017.md`.

### HOF-FIX01-OPS-WHATSAPP-DISPLAY-STATUS-20261017
- **From:** FIX-01 / Sentinel
- **To:** OPS-01 / Shipwright
- **Reason:** Continue live runtime investigation of WhatsApp provider status mismatch; confirm the custom display-name fix reaches the serving revision.
- **Repository state:** `main`; source fix `fd1fda7429363091098825dbf37bba0f30be3d0f`; regression test `79f0e6a12511afaa07249005d24e6e50fc3c7d2b`. Last observed pre-fix production deployment `dpl_5zjzPd6V3uBGuMK2LppXqsRTkirK` served `0e355bc75df6ab6c41ac619050be561faeb7c3e7`.
- **Work completed:** Identified and corrected the display-name overwrite: account verification was persisting Meta's `verified_name` over the user-entered label. Added a static regression test. Inspected the provider-status webhook and scoped DB update contract. Vercel's available runtime-error summary only exposed older Oct 10–11 DB constraint failures; runtime logs for the relevant historic window are not retained, and the exact live DB row was not accessible.
- **Remaining work:** Confirm current deployed revision. For provider message ID `wamid.HBgMOTE5NjI5NTM0NzAxFQIAERgSMjgzMTY2RjQxODQ5NTE4OTlDAA==` (Meta phone number ID `1321845321014373`, failure code `131047`), inspect redacted Meta webhook delivery details and server request record; record HTTP status/body and `accepted` count. Query only the relevant organization/account row and compare provider message ID, status, provider error, and updated_at with the API GET response and UI. Correct deployment/database/environment only if evidence establishes that cause. If the row is failed but the UI renders sent, hand the isolated source defect to FIX-01.
- **Evidence/records:** `docs/project-control/sessions/FIX01-WHATSAPP-DISPLAY-STATUS-20261017.md`; `apps/web/src/app/api/whatsapp/accounts/route.ts`; `apps/web/src/app/api/whatsapp/webhook/route.ts`; `packages/db/src/messaging/whatsapp-repository.ts`; test `apps/web/tests/whatsapp-account-display-name.test.ts`.
- **Authorization:** Existing user request authorizes diagnosis and smallest corrective fix. OPS-01 must confirm its deployment/infrastructure scope before changing runtime or database configuration.
- **Stop condition:** Stop when serving revision and row/webhook/UI status are reconciled, or record the precise external access/retention blocker. Never expose tokens or cross-tenant rows; do not weaken HMAC or tenant scoping.
- **Status:** OPEN

### HOF-FIX01-OPS-CHAT-PROVIDER-OVERRIDE-20261017
- **From:** FIX-01 / Sentinel
- **To:** OPS-01 / Shipwright
- **Reason:** Verify the live chat provider-selection failure and deploy/runtime boundary after a minimal source correction.
- **Evidence:** User reports `POST /api/chat/stream` fails with `AI provider openai is not configured` despite Sarvam chat override. User's web container logs show the same; worker health says database and credentials master key are configured. The chat route passes orgId and agentId into `claraRuntime.createChatTurn`.
- **Source fix:** `packages/clara-core/src/runtime.ts` no longer returns early when `organization_ai_runtime_settings` is absent; it supplies safe defaults and continues to resolve per-agent overrides and saved provider credentials. Commit `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`. Test authored at `apps/web/tests/clara-agent-provider-resolution.test.ts`; commits `d9e6c619320390c5290c04d29d30187a6838736f`, `c0e0a31e788ecd24e6af89f42e4f67f5100b7c73`.
- **Required runtime trace:** Confirm serving revision separately for `aca.starcitytechnical.com` and self-hosted `infra-web-1`. In the correct organization scope inspect only: presence of org runtime settings row; agent row's chat_provider/chat_model; Sarvam `purpose='chat'` provider row enabled and key-present metadata. Never log/decrypt/print secrets.
- **Action:** Rebuild/restart via existing manual deployment procedure from revision containing `8d7aecc`, then make one sanitized test request and confirm the selected provider is Sarvam. If org row exists, diagnose missing/disabled provider config or stale build. Fix infra/env/database/deploy issues within OPS-01 scope.
- **Authorization:** User explicitly authorized root-cause investigation and the smallest source correction. Do not add OpenAI key as a workaround or weaken authorization.
- **Verification:** Regression test not run; no build or live request verified. Status OPEN.


### HOF-FIX01-OPS-HOST-PNPM-20261018
- **Owner:** OPS-01 / Shipwright
- **Type:** Environment/toolchain handoff (separate from source fix)
- **Symptom:** User's host shell reports `bash: pnpm: command not found` when running `pnpm --filter @ai-comms-agent/worker build`. The subsequent Docker build shows Corepack/pnpm available inside the image and the worker image successfully built.
- **Scope:** Determine whether native host pnpm is intended/needed in this environment; if so, make the repository-supported Corepack/pnpm command available without altering application source or lockfile. Do not conflate this with the web TypeScript error.
- **Authorization:** User explicitly instructed CI/CD, deployment, infrastructure, and environment defects to be routed to OPS-01.
- **Evidence limit:** No installation or host change attempted by FIX-01. Docker worker build success is user-provided evidence; native toolchain state is not otherwise inspected.
- **Next:** OPS-01 may advise/use the repository's documented Node/Corepack setup. FIX-01 independently corrected the web source type error; rebuild from latest main to verify it.

### HOF-DEV01-OPS-LIVE-MODEL-VERIFY-20261018
- **From:** DEV-01 / `DEV01-LIVE-MODEL-VERIFY-20261018`
- **To:** OPS-01 / Shipwright
- **Reason:** Full web toolchain, live provider credentials, browser/runtime and deployment checks are inaccessible in the current development environment.
- **Repository state:** PR #34 already merged into main at `5413468fc1ff0ae0088796b25d01b680126e521c`; additional portable test on `feature/dev01-live-model-offline-verification-20261018`.
- **Work completed:** Exact-source SHA verification, isolated TypeScript check, 6/6 Node mocks, 13/13 GitHub source contracts. No application/Vercel success claimed.
- **Remaining work:** In dependency-equipped host run focused Vitest, complete web typecheck/Next build; use secure org-saved keys for live vendor model listings; verify browser dropdown/save/reload and org isolation; diagnose build-rate-limit indicator returned by Vercel status for merged commit. Do not print or disclose credentials.
- **Evidence:** `docs/project-control/sessions/DEV01-LIVE-MODEL-VERIFY-20261018.md`, source test file, Vercel commit status `failure` link containing `upgradeToPro=build-rate-limit`.
- **Authorization:** Existing owner development-first verification request; actual production deployment still under OPS-01 authorization/control.
- **Stop condition:** Finish the environment/deployment-specific checks or record exact external blocker; route source defects to FIX-01 and do not claim production PASS without runtime evidence.
- **Status:** OPEN

### HOF-FIX01-STRICT-INDEXED-ACCESS-VOICE-CONTEXT-20261018
- **From:** FIX-01 / Sentinel
- **To:** User local checkout; OPS-01 only for separate environment/deployment defects
- **Reason:** Source changes are committed; post-fix verification requires the user's dependency-equipped checkout and Docker host.
- **Source commits:** 1fb04529, 9a9e09ee, 5946168a; tests 57618396 and fee2a239.
- **Next:** Pull current main, run pnpm typecheck and focused voice/WhatsApp Vitest suites, then bash scripts/update-and-up.sh. Share full new compiler output if errors remain.
- **Evidence limit:** The provided typecheck/build logs predate this correction; no post-fix pass or live deployment claim is made.


## HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018 — Migration runner must use Compose DNS
- **From / to:** FIX-01 / Sentinel → OPS-01 / Shipwright
- **Started from:** `main` `2cf9a52266af0fd69df809b40f482bb0eb95fb5c`
- **Authorization:** Owner explicitly requested diagnosis, minimal correction, regression protection and records. APCP role registry assigns Docker, deployment scripts and environment to OPS-01.
- **Symptom:** `scripts/update-and-up.sh` built images, then migration failed with `getaddrinfo ENOTFOUND postgres`. The script proceeded to container startup.
- **Root cause:** `scripts/manual-up.sh` executes the migration runner on the host; `postgres` is only resolvable through Docker Compose network DNS. Existing substitution handles `host.docker.internal`, not `postgres`.
- **Relevant source:** `scripts/manual-up.sh`; `Dockerfile`; `packages/db/migrate.js`; `docker-compose.yml`; `scripts/tests/manual-up-compose-env.test.mjs`. Recent main commit `2cf9a522` changes published Postgres port only; OPS compatibility commits `a93176b3` / `0386f03f` fixed an earlier CLI flag issue.
- **Implementation caution:** Current Dockerfile does not copy `supabase/`; migration runner auto-detects `/workspace/supabase/migrations`. Recommended smallest execution fix: run a one-off Compose container and mount `$PROJECT_ROOT/supabase` read-only at `/workspace/supabase`; alternatively add migration files to the image with explicit review. Preserve `postgres:5432` for application containers.
- **Do not:** Route app database connections through `host.docker.internal:5433`; silently change the target database; claim migration or deployment success from image build alone.
- **Database target check:** User URL used database `postgres`, whereas Compose declares `POSTGRES_DB=aca`. Confirm which DB is intended before running migrations.
- **Evidence/status:** Source inspection and user logs only; no fix, regression test execution, migration rerun or health verification performed by FIX-01.
- **Required OPS-01 actions:** Update migration execution; add regression assertion for in-container command and migration files being available; run focused test; confirm intended DB target; have operator rerun deployment; record migration output and service health.
- **Stop condition:** Handoff is complete when OPS-01 owns the code change. FIX-01 does not edit deployment source absent a new role/authorization decision.


## HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018 — OPS-01 implementation update
- **Status:** Implementation and source-contract regression coverage committed; runtime verification pending.
- **Source:** `65a215151ecd14900fac3c9ba9a421fb7a777a77`.
- **Test:** `6cd93638bffa0e2f6a9e8d6ce2f3f2664b13341b`.
- **Change:** One-off Compose web container runs the migration runner with a read-only `supabase/` mount. Host-side DSN parsing and `host.docker.internal` translation are removed; application URLs remain internal. Startup-on-migration-failure policy is preserved.
- **Evidence:** `bash -n` passed; isolated focused Node test 4/4 passed. No actual project checkout test, Docker invocation, migration, or health result.
- **Outstanding safety check:** Confirm intended DB name (`/postgres` in the user's URL vs Compose `POSTGRES_DB=aca`) before running migrations.
- **Next:** Operator confirms DB target, runs focused test in checkout, then deploys and records migration completion separately from container health.
