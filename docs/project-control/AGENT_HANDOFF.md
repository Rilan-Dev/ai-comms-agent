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

### HOF-DEV01-FIX01-EMAIL-HTML-SANITIZER-20261018
- **From:** DEV-01 / Forge (`DEV01-CHAT-FIRST-VOICE-MAIL-20261018`)
- **To:** FIX-01 / Sentinel
- **Reason:** During mail HTML preview work, found `apps/worker/src/email/mailbox-sync-worker.ts` inserts raw `message.html_body` into `email_messages.html_body_sanitized`. This conflicts with `docs/architecture/SECURITY.md §14` server-side HTML allowlist requirement; a sandboxed client iframe alone is insufficient defense.
- **Repository state:** `main`, 2026-10-18; preserve concurrent DEV-01 UX work.
- **Work completed:** Tenant-scoped query exposes HTML under reader field; opaque-origin CSP-restricted iframe UI written. Opened [issue #36](https://github.com/Rilan-Dev/ai-comms-agent/issues/36) with exact vulnerability/evidence, fix/tests/backfill requirements and Mailflow sanitizer reference.
- **Remaining FIX-01:** Robust parse-based sanitizer on every provider ingestion path, old-row quarantine/backfill plan, CSS/URL/image tracking tests, security review. **Do not** downgrade existing auth/mailbox grants. OPS-01 performs migration/deployment only after source acceptance.
- **Status:** OPEN; DEV-01 continues independent UI work without polling or taking FIX-01 bug role.
- **Evidence:** `docs/project-control/sessions/DEV01-CHAT-FIRST-VOICE-MAIL-20261018.md`, `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`.

### HOF-DEV01-FIX01-SCHEDULER-RELIABILITY-20261018 — 2026-10-18
- **From:** DEV-01 / DEV01-CATCHUP-ROUTINES-20261018
- **To:** FIX-01 / Sentinel
- **Reason:** Existing recurring creation/update and execution recovery can prevent or strand scheduled work; new routines must not depend on these defects.
- **Repository state:** main `ba9e948b4b58a4f270d5382f919957843e6eecb5`.
- **Work completed:** Source audit: API omits `nextFireAt`; repository defaults recurring next fire to null; due query excludes null. Catch-up minutes unused; no reclaim lease; INSERT error catch does not restore aborted transaction; unconditional completion can overwrite pause/edit. Eleven focused scheduler/automation tests pass but do not prove these runtime invariants.
- **Remaining work:** Reproduce recurring first-fire/PATCH defects and repair existing behavior; add isolated PostgreSQL duplicate/crash/concurrency/transaction tests. Establish revision-safe completion, lease/retry recovery and explicit recurrence/misfire contract before new activation. Coordinate proposed defaults with reviewed routine design instead of silently approving them.
- **Evidence/records:** `packages/db/src/automation/repository.ts`; schedules API; worker scheduling directory; session and routines plan R1/R3.
- **Authorization:** Owner instructed routing substantial bugs to FIX-01; receiving role must recover repair authorization. New feature/authorization design remains proposed. No production DB mutation authorized here.
- **Stop condition:** Stop on unreviewed architecture/policy expansion or unavailable safe database target; report exact evidence and continue unaffected authorized work.
- **Status:** OPEN — repository handoff, not a claim another agent accepted or implemented it.

### HOF-DEV01-FIX01-AUTOMATION-TENANCY-20261018 — 2026-10-18
- **From:** DEV-01 / DEV01-CATCHUP-ROUTINES-20261018
- **To:** FIX-01 / Sentinel
- **Reason:** Event evaluator loads all active rules and lacks a mandatory event/rule organization comparison; trigger key drift can also prevent intended matches.
- **Repository state:** main `ba9e948b4b58a4f270d5382f919957843e6eecb5`.
- **Work completed:** Read-only trace of `listActiveAutomationRules`, `automationMatches`, event payload dispatch and UI `trigger.event` versus worker `trigger.type`; no live exploit or external event replay.
- **Remaining work:** Establish trusted ingestion organization/event identity; tenant-scope rule lookup, matching, dedup and dispatch. Deny missing/spoofed tenant identity. Correct trigger serialization compatibly without activating unrelated legacy rules. Add org A/B tests with generic matching events and SQL-backed run/payload assertions; retain idempotency and account checks.
- **Evidence/records:** `apps/worker/src/automation/automation-engine.ts`; `packages/db/src/automation/repository.ts`; automations API/UI; session; routines plan R5.
- **Authorization:** Owner requested substantial-bug routing; receiving role recovers repair scope. DEV-01 blocks new event-routine activation; this record does not grant production data access.
- **Stop condition:** No tenant bypass or silent legacy-rule activation; route infrastructure separately and report blocked tests honestly.
- **Status:** OPEN.

### HOF-DEV01-OPS01-DIGEST-VALIDATION-20261018 — 2026-10-18
- **From:** DEV-01 / DEV01-CATCHUP-ROUTINES-20261018
- **To:** OPS-01 / Shipwright
- **Reason:** Planned catch-up/routine acceptance needs isolated SQL/RLS/crash tests, authenticated browser fixtures and approved test-recipient delivery.
- **Repository state:** main `ba9e948b4b58a4f270d5382f919957843e6eecb5`.
- **Work completed:** Dependency installation, all workspace typechecks, web production build and 41 focused tests pass locally. No new product infrastructure/configuration or provider actions. Earlier current-host pnpm absence is no longer a blocker here; other hosts remain independently unverified.
- **Remaining work:** Prepare disposable PostgreSQL roles/fixtures, isolated Redis/RabbitMQ namespaces as needed, approved test identities/recipients, secure provider bindings, Meta template/callback fixtures and artifact capture. Verify migration target identity (existing ISS-037 postgres/aca mismatch), TLS and upgrade/fresh chains before any application. Review new migrations only when authored; none exist in this planning slice. Keep live data out of tests.
- **Evidence/records:** Session evidence table; Catch-up C4a harness; routines R3/R4/R6; existing HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018 and HOF-DEV01-OPS-LIVE-MODEL-VERIFY-20261018.
- **Authorization:** Owner routes infrastructure to OPS-01; preparation proposal only where runtime/credentials/deployment authorization is not already established. No secret values or live send/deploy authorization conveyed by this record.
- **Stop condition:** Do not use a production database as a disposable target or claim provider acceptance without evidence. Recover target authorization before mutations; keep off-by-default flags until required review/tests.
- **Status:** OPEN.

### HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018 — 2026-10-18
- **From:** DEV-01 / DEV01-CATCHUP-ROUTINES-20261018
- **To:** FIX-01 / Sentinel
- **Reason:** Newly integrated main fails an executable final-prompt validation regression; direct helper probes expose completed-ID reuse and tool-name mismatch acceptance.
- **Repository state:** Upstream source `959ff5a6c055baf9a1f14af5d29c5f51643b77c0`; integrated locally with documentation only.
- **Work completed:** `pnpm --filter @ai-comms-agent/clara-core test` → 24 passed/1 failed. Minimal `node --experimental-strip-types --test packages/clara-core/tests/tool-result-final.test.mjs` → 5 passed/1 failed. Read-only triage: line 32 expects `/Duplicate/`, gets incomplete-batch rejection. The exact fixture fails closed; adding the reused ID's result makes the helper accept two completed pairs, and a result name different from its declaration is also accepted. No provider/network action or live bypass reproduced.
- **Remaining work:** Track history-wide call ID uniqueness separately from outstanding calls, validate declaration/result name binding, add behavioral cases for completed duplicate pairs and mismatched names, and preserve orphan/incomplete/size protections. Inspect trusted-host construction impact without assuming exploitability. Do not weaken the existing assertion solely to get green output.
- **Evidence/records:** `packages/clara-core/src/tool-result-final.ts:14`–`:30`; `packages/clara-core/tests/tool-result-final.test.mjs:29`; session final integration section; local `dev01-clara-integrated.log`.
- **Authorization:** Owner explicitly routes substantial defects to FIX-01; receiving role recovers repair authority. DEV-01 preserved concurrent source and made no fix or deployment.
- **Stop condition:** Stop on authorization-model changes or unapproved scope expansion; report actual unit/integration evidence and preserve host approvals.
- **Status:** OPEN.

## HOF-DEV01-FIX01-C1-WORKSPACE-FAILURES-20261019

Owner FIX-01. C1 full-suite validation found worker 13 failures and web 43 failed tests/21 failed files outside changed C1 areas; do not weaken tests. Worker areas: vector/source metadata, account purge/deletion, null metadata, HTTP mutation confirmation, privileged retrieval scope, provider registry, due mailbox publishing, and two WhatsApp test files unable to resolve Vitest. Web areas: auth boundary, provider registry/Gmail sync/webhook, email repository contracts, live models, Lovable UI, draft actions, RBAC persistence, realtime voice and WhatsApp approval/idempotency. Reproduce `pnpm test` and separately `pnpm --filter @ai-comms-agent/web test` in sanitized environment. Logs `/workspace/.onboarding/ai-comms-agent/c1/{workspace-tests,web-full-tests}.log`. Baseline attribution not fully proved; triage before fixing. C1 focused checks pass; this handoff is not full-product acceptance.

## HOF-DEV01-OPS01-C1-VALIDATION-20261019

Owner OPS-01. Reconcile `bash scripts/verify-migration-chain.sh` duplicate-canonical-object failure against strict native psql success on all 69 migrations, fresh and seeded upgrade. Triage test tooling/collection, manual-deployment migration host and migration-verification/lockfile failures with FIX-01. Verify actual deployment-role privileges and schema drift before eventual rollout; no deployment authorized here. Disposable container `ai-comms-c1-testdb` remains available on loopback 55432/tmpfs; no external services used. Evidence in C1 session and local artifact directory. This is a repository handoff, not an external notification.

## HOF-DEV01-FIX01-OPS01-C2-FINAL-20261019

FIX-01: final merged worker13failures/web40failed tests (20files), exact names in docs/reviews/CATCHUP-C2-SUITE-FAILURES-20261019.md. Permission-Set bug fixed; canonical publication compatibility corrected. OPS migration structural checker now passes; no stale duplicate-DDL blocker claim. OPS-01/FIX-01: incident commit c99252a4 introduced executable obfuscated build hooks, now removed; see sessions/FIX01-OPS01-BUILD-HOOK-INCIDENT-20261019.md for exposure uncertainty, clean-environment and credential-rotation assessment. No external messages, deployment or rotations performed.


## DEV-01 current handoff — 2026-10-19, final repository synchronization

See [current handoff](sessions/DEV01-CURRENT-HANDOFF-20261019.md) for completed, in-progress, pending and next work. C1/C2 focused implementation is complete; C3 worker/grounding integration is next, then C4 authenticated UX acceptance. Phase 4 remains implementation_in_progress. Latest upstream operator/vector fixes preserved; affected checks pass 35/35 and 11/11. Earlier full-suite counts are a pre-final-merge baseline. Security follow-up remains open. Existing entries retained as history.

### HOF-FIX01-OPS-AGENT-MAIL-RUNTIME-20261020 — 2026-10-20
- **From/to:** FIX-01 / Sentinel → OPS-01 / Shipwright
- **Reason:** Operational verification only after source correction to failed agent email unbind and clearer chat policy denial. No FIX-01 infrastructure or production mutation performed.
- **Source commits:** 9cf971b4 (scoped SQL), 61f819d0 (chat diagnosis), a4d7b72c (agent UI), ca936db9 (regression). Audit: FIX-01 role WORKLOG and root worklog, central event/session.
- **Evidence:** Source check 16/16; full Vitest/typecheck/PostgreSQL/live browser not run. The persisted agent Policy allowedTools value is unknown in this GitHub-only session; do not assume the production 403 is an infrastructure error.
- **OPS-01 actions:** Verify serving source SHA before concluding deployment; run approved safe tenant A/B DELETE+role/security negatives with disposable/authorized DB; inspect sanitized actual agent policy enabled-tool list, organization membership email.read, binding role/status and synced mailbox rows; retest PATCH unbind and Chat SSE from an authorized session only. Route genuine source failures back to FIX-01. No credentials/cookies in logs or source.
- **Security:** User-pasted authentication cookie must be revoked/rotated; do not replay it or copy it to reports.
- **Stop condition:** Evidence obtained or a concrete infrastructure/runtime blocker documented; do not change application policy implicitly or auto-enable email tools.

### HOF-FIX01-IMAP-TLS-DEADLINE-20261020-OPS — 2026-10-20
- **From/to:** FIX-01 / Sentinel → OPS-01 / Shipwright.
- **Issue:** Persisted IMAP/SMTP Gmail-address mailbox has 0 imported out of 50, `status=error`, no successful sync, last reported `TLS response timeout`.
- **Source finding:** Worker TLS handshake timer survived successful negotiation and destroyed live sockets after 10 seconds, producing reader timeout. Commits `91bc19b1` and `018f4fcd`; 14/14 GitHub source checks. No claim of actual deployed fix or remote provider throttling.
- **OPS-owned acceptance:** Verify running worker commit includes source fix; inspect sanitized worker logs and DNS/route/TCP/TLS reachability to configured IMAP 993 and SMTP 465 endpoints (without credentials/tokens); only after authorized rollout safely retry existing account via application Sync and confirm pending/error state clears, `lastSuccessAt` becomes non-null, messages import (bounded initial limit) and message queries work. Compare live network error and source timeout if failure persists.
- **Scope boundary:** Do not disable certificate checks, copy/replay pasted auth cookie, expose stored credentials or recreate/delete mailbox to force sync. Source follow-up belongs to FIX-01, infrastructure/env to OPS-01, unrelated product development to DEV-01.
- **Stop condition:** Record current deployed SHA and actual status/row count, or exact host/network blocker. Do not label an HTTP 202 queue response as completed import.

### HOF-FIX01-IMAP-GMAIL-SELECT-IDLE-20261021-OPS — 2026-10-21
- **From/to:** FIX-01 / Sentinel → OPS-01 / Shipwright, deployment/infrastructure/runtime only.
- **User evidence:** IMAP/SMTP Gmail-address account stays 0/50, lastSuccessAt null. Gmail NO NONEXISTENT on `SELECT "[Gmail]"`, IDLE credential_type failure, sync.retry attempts.
- **FIX-01 source commits:** `1c1b5796` Gmail selectable LIST flags, `06f9b14f` tests; `1184576e` claim RETURNING comma; `d3fa0af4` legacy type fallback; `53702ac8` future encrypted type; `a655ce4e` tests; `d43f16b7` serialized IMAP reads and completed mode, `2e131fb8` tests.
- **Acceptance:** On approved current-main worker image, run focused Node/typechecks before deploy; verify running worker SHA, retry existing mailbox via normal Sync after rollout (do NOT delete/recreate/reset DB), inspect sanitized `worker.email-sync` errors and record actual SQL account status, sync_mode, imported count, lastSuccessAt. Observe no Unknown Mailbox [Gmail] / credential type failure. Require actual message rows when remote account has mail; queued/Connected alone is not PASS.
- **Security:** No replay or recording of leaked `aca-access-token`. Owner must revoke session. Do not lower TLS trust, log credentials or touch DEV-01 C3/routine feature flags.
- **Stop:** Handoff closes only on recorded executed validation or explicit sanitized remaining blocker. Return new source errors to FIX-01.

### HOF-FIX01-IMAP-UID-STAGING-20261022-OPS — 2026-10-22
- **From/to:** FIX-01/Sentinel → OPS-01/Shipwright for deployment, infrastructure and production validation only.
- **Symptom:** Connected IMAP/SMTP account with initial import 0/50 and pending 0, running for minutes, no last success. Worker startup and RabbitMQ ready, no sync result in supplied window. Docker output reports older deployed `d0ded84d`; host Redis/Qdrant marked unhealthy.
- **Application source finding:** IMAP sync discovery downloaded complete MIME messages before persisting any IDs, then worker downloaded same messages again, producing silent delay. Large 25-message fetch group delayed DB import; transient fetch errors were marked missing and acked. No evidence of user-password failure in newest logs.
- **Fix commits on Development:** `2a8c5933`, `db3d629b`, `b0550e52`, `631d96a2`, `2c0e3f8a`. 17/17 source invariants, actual Node/live checks pending.
- **OPS acceptance:** Review approved Development changes for deployment, run focused worker/DB checks on matching SHA, merge/roll out using existing deployment process, verify running worker code revision; use existing account's authorized Sync once previous active claim completes/is stale; watch *count-only* claim/staged/batch logs and correct DB/HTTP count/lastSuccessAt/sync_mode. Do not reset DB, delete account, reenter credentials, bypass TLS, or assert success from HTTP 202 or queue/health logs.
- **Separate OPS environment:** Redis and Qdrant containers showed unhealthy; determine exact health errors independently (RabbitMQ consumer ready does not establish Redis lease or Qdrant readiness). Never replay pasted access cookie; request session revocation.

### HOF-FIX01-IMAP-MIME-RICH-BODY-20261022-OPS — 2026-10-22
- **From/to:** FIX-01/Sentinel → OPS-01/Shipwright for approved promotion/deploy and authenticated provider/DB/browser acceptance.
- **Evidence:** User screenshot shows Anthropic message formatted in Gmail vs raw QP and absent HTML in app. Live raw MIME not supplied. Source traced to bypassed shared parser/discarded HTML and QP byte/case bugs.
- **Changes on Development:** `5add7d2a` canonical byte-correct shared MIME parser, `83c77c6d` IMAP BODY[] literal extraction + HTML preservation, `20d0b026` representative regression test, `cbf403fa` fixture correction. Source invariants 16/16; host execution not run.
- **Acceptance:** Run focused worker `imap-smtp-adapter.test.ts`, shared + worker typecheck and approved deploy on matching source SHA. For an existing previously corrupted message, use authorized **account-scoped** provider re-fetch/re-persist/upsert without deleting the mailbox, resetting credentials, or rewriting other tenants; confirm text no longer contains `=E2=80=87`, sender body shows intended content and stored HTML opens through existing sandboxed iframe with formatting. Check remote tracking blocked. Confirm raw HTML ingestion sanitizer gate #36 remains open, security follow-up assigned FIX-01.
- **Security:** No pasted session cookies, customer full bodies or raw MIME in worklog; redact evidence. No unsandboxed markup, remote scripts/images or silent force-reset.

### HOF-FIX01-IMAP-FOLDER-COPY-DUPES-20261022-OPS — 2026-10-22
- **From/to:** FIX-01/Sentinel → OPS-01/Shipwright; approved Development rollout/runtime acceptance only.
- **Evidence:** User sees two identical ACA Inbox rows for one Gmail test message, both pointing to `/mail/thread/54db2434-dcda-4198-8bbf-addc5aa28fbd`. Source worker imports INBOX and All Mail with folder-specific UIDs; unfiltered Inbox and thread queries display duplicated stored copies.
- **Fix refs:** `cce92f98` IMAP Inbox member filter and thread Message-ID ranking, `0cc16a77` correct list-thread counts, `7d94e1d2` five Vitest contracts; 17/17 source invariants, no live execution.
- **Acceptance:** Run focused Vitest and DB typecheck on approved matching SHA, perform authorized deployment, verify one row in /mail/inbox and one visible copy in thread and accurate list-thread count. Confirm with tenant/account-scoped read-only query that two underlying rows share a nonblank internet_message_id and have distinct INBOX vs All Mail folder names if further diagnosis needed.
- **Constraints:** No destructive cleanup, no mailbox recreation, no credential exposure, no global dedup, no deployed-PASS claim from a source check; provider/infra/release remain OPS-01.

### HOF-FIX01-AGENT-SELF-SERVICE-POLICY-20261022-OPS — 2026-10-22
- **From/to:** FIX-01/Sentinel → OPS-01/Shipwright for server access and production account/policy validation (not authorization to alter grants).
- **Access:** Attempted reachability to user-supplied SSH port from FIX-01 environment was refused; no login or credentials used. Do not distribute the user-posted plaintext password; request rotation and temporary key-based or secure operator-controlled access.
- **Source fixes on Development:** `084f36ba` 16 registered opt-in tool checkboxes; `68b3ec81` guided setup/optional JSON; `e7735b4b` connected-only DB binding; `93fbc354` disabled invalid picker; `11c760c2` actionable tenant-bound 422; `51134e6d` readable connected mailbox configuration gate, `424d89c1` diagnostic display. Regression `816d9558,787c8ca9,df860960`. 24/24 static source checks only.
- **OPS evidence request:** With authorized secure access and secrets redacted, verify deployed revision and read-only organization-scoped agent records (agent status/current version, policy allowed_tool names, agent_email_accounts binding roles, email_accounts status/capabilities and email_sync_states.last_success_at). Do not print decrypted passwords, secret configs, message content or all tenants. Compare effective tools to registered runtime and user `email.read` privileges; distinguish configured, granted, bound, connected and synchronized. If SSH remains inaccessible, record network/daemon/security group reason and hand back sanitized result.
- **Stop:** No live success claim without real account/policy/browser evidence; no automatic granting/deployment by FIX-01. DEV-01 owns later larger end-to-end onboarding wizard.
