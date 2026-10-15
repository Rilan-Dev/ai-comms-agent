# FIX-01 Role-Local Worklog

Append-only operational history for FIX-01. This is not the source of authorization.

## Entry format

### <SESSION-ID> / <DATE>
- **Task:** <task>
- **Authorization:** <reference or safe-maintenance classification>
- **Started from:** <commit/ref>
- **Actions:** <what was done>
- **Files/code:** <paths>
- **Evidence:** <tests/checks/observations>
- **Blockers/dependencies:** <none or exact>
- **Lesson:** <reusable lesson or none>
- **Next action:** <exact next action>

<!-- Append new entries below. -->

### FIX-01-AUTH-20261009 / 2026-10-09
- **Task:** Re-triage persistent browser login redirect to `/login?reason=not_provisioned`.
- **Authorization:** User-explicit FIX-01 bug/error remediation request; source scope limited to auth failure diagnosis, smallest corrective fix, and regression protection.
- **Started from:** `main` at `2ab9c66640cc5132bc7f7686d0f008015b79620d`.
- **Actions:** Recovered shared/role-local memory and project-control records; traced middleware → login POST → session cookie → root layout → `getAuthenticatedAppContext()`; inspected current auth implementation and commit ancestry; confirmed the prior source fixes are already ancestors of current `main`; classified the remaining defect as live-runtime/build/database state rather than a new login-page source defect; routed to OPS-01.
- **Files/code:** `apps/web/src/app/layout.tsx`; `apps/web/src/app/login/page.tsx`; `apps/web/src/app/api/auth/login/route.ts`; `apps/web/src/lib/identity/local-auth.ts`; `apps/web/src/lib/identity/repository.ts`; `apps/web/src/middleware.ts`; auth regression tests.
- **Evidence:** `main` includes commits `52fb3318...`, `56f9088a...`, and `3cd19bdb...`; source shows `reason=not_provisioned` only in the protected root layout; current `main` is `2ab9c66640cc5132bc7f7686d0f008015b79620d`; direct curl from this environment cannot reach `100.72.192.28:3300`, so no live runtime claim is made.
- **Blockers/dependencies:** OPS-01 live runtime/container/database access.
- **Lesson:** The redirect reason identifies the branch: `next=/` means cookie absent at middleware; `reason=not_provisioned` means the request passed middleware with a cookie but server application context was null. Do not repeat client-navigation fixes until the runtime session/user/membership state is inspected.
- **Next action:** OPS-01 independently recover runtime authorization and correct the smallest concrete deployment/runtime/database defect; FIX-01 remains available for any source defect uncovered by that evidence.

### FIX-01-AUTH-FIX-20261009
- Authorization: user explicitly requested FIX-01 to fix the login-loop and commit to the same branch.
- Root cause: valid credentials were sufficient for session creation even when application provisioning lacked an active organization membership; protected layout then rejected the new session.
- Remedy: membership check before session creation; explicit 403 `account_not_provisioned`; regression assertion in `auth-boundary.test.ts`.
- Prevention: never treat credential authentication as equivalent to application provisioning.
- Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`.
- Next: OPS-01 deploy/restart and perform one runtime browser verification; no CI/Vercel waiting.


### FIX01-WORKER-CREDENTIALS-20261009 / 2026-10-09
- **Task:** Fix Docker worker build TypeScript errors in credential snapshot handling.
- **Authorization:** Explicit user request for FIX-01 diagnosis, smallest corrective source change, and regression protection; unrelated scope excluded.
- **Started from:** GitHub main and user-provided Docker build log.
- **Actions:** Traced TS2322 at adapter union and TS2345 at credential persistence to mismatched snapshot and repository types. Changed Gmail snapshot return type to EmailCredentials; spread typed credentials into a persistence record; added a focused Gmail adapter test.
- **Files/code:** apps/worker/src/email/gmail-adapter.ts; apps/worker/src/email/mailbox-sync-worker.ts; apps/web/tests/gmail-adapter.test.ts.
- **Evidence:** GitHub commits caad1d753b0199a895d63056704c4db9c423f382, 04a2345b6b901ebbc55d084dc5860f39ae9416d8, a98c0e7fa1ee8e22ff60726475e6fb91624626c8. pnpm, TypeScript, Docker, and tests were not run in this session; no PASS claimed.
- **Blockers/dependencies:** Dependency-equipped environment required for execution. Docker/dependency/CI issues after source correction belong to OPS-01.
- **Lesson:** Keep provider snapshots typed to shared domain contracts; convert to generic persistence payload at the DB boundary.
- **Next action:** Run the focused Gmail adapter test and worker build/typecheck; route environment-only failures to OPS-01.


### FIX01-ZOHO-TEST-NEWLINES-20261009 / 2026-10-09
- **Task:** Fix the newly reported web typecheck failure.
- **Authorization:** User supplied the latest typecheck output in the active FIX-01 workflow; smallest correction and regression protection/control logging only.
- **Evidence received:** `pnpm run typecheck`: packages/shared, packages/db, packages/clara-core, and apps/worker passed; apps/web failed at `tests/zoho-oauth-settings.test.ts(84,54)` and adjacent positions with TS1127/TS1434.
- **Root cause:** Three assertions contained literal `\n` characters rather than actual newlines.
- **Change:** Replaced the exact malformed source sequence with real line breaks; no OAuth runtime code changed.
- **Commit:** `39857c40820940b500dcf452331dfe82ae35b861`.
- **Failed approaches to avoid:** Do not broaden into OAuth implementation changes; do not route this source parser defect to OPS-01.
- **Verification status:** User's output is pre-fix. Post-fix typecheck and focused test have not been executed; no PASS claimed.
- **Next action:** Run `pnpm run typecheck` and the focused Zoho OAuth settings test. If an unrelated environment/CI/deployment problem remains, route it to OPS-01.


### FIX01-ZOHO-ASSERTIONS-20261009 / 2026-10-09
- **Task:** Fix two focused Zoho OAuth test failures reported after correcting the test parser error.
- **Authorization:** User supplied fresh typecheck and focused test evidence in the active FIX-01 workflow; test-only correction and durable records authorized.
- **Evidence received:** `pnpm run typecheck` passed all workspaces. Focused Vitest: 8 passed, 2 failed.
- **Root cause:** HTTP raw-IP is intentionally rejected by the DNS-only rule before HTTPS validation, so the error is about raw IP; source assertion rejected any mention of `NEXT_PUBLIC_APP_URL`, including documentation in a comment.
- **Change:** Updated the raw-IP test to expect `/raw IP/`; narrowed source assertion to absence of `process.env.NEXT_PUBLIC_APP_URL`. No runtime implementation changed.
- **Commit:** `c58d6d442767f471c694ef978fdb06eca6d29850`.
- **Verification:** The corrected focused test has not been rerun; do not claim PASS.
- **Next action:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/zoho-oauth-settings.test.ts`; continue independent authorized development without waiting for CI/Vercel.


### FIX01-SCHEMA-REDIS-20261009 / 2026-10-09
- **Task:** Remediate live mailbox-sync HTTP 500s and improve Redis lease diagnostics.
- **Authorization:** User supplied live runtime logs for active FIX-01 remediation.
- **Started from:** Current GitHub `main`; reported errors were missing `ai_provider_configs.model`, missing `email_sync_states.last_attempt_at`, and generic Redis command rejection.
- **Actions:** Added forward-only idempotent migration `0029_runtime_schema_reconciliation.sql`; it adds provider/mailbox columns and backfills legacy sync checkpoint columns when available. Redis RESP errors now include a bounded server response. Added a WRONGPASS regression test.
- **Files/code:** `supabase/migrations/0029_runtime_schema_reconciliation.sql`; `apps/worker/src/email/redis-lease.ts`; `apps/worker/tests/redis-lease.test.ts`.
- **Evidence:** GitHub commits `a4fab9df07deafa5fd47879217616e3cb6d1c03f`, `71616ac887f3efb79f90039245d6064c4662a77c`, `0fa3e751cae2e5105b212083e93a7cc87bf00468`. Source accepted; no tests/typecheck/build/migration/runtime checks executed.
- **Blockers/dependencies:** OPS-01 needs access to live PostgreSQL and Docker/runtime configuration to apply migration and roll out matching images; Redis response must be inspected after diagnostic patch.
- **Lesson:** Do not infer Redis is usable from environment-variable presence or health checks; preserve bounded server error responses and never bypass the distributed lease on command failure.
- **Next action:** OPS-01 apply migrations through `0029`, roll out web/worker images, and correct Redis AUTH/ACL/TLS/URL only from the exact Redis error. No runtime PASS claimed.


### FIX01-SCHEMA-REDIS-20261009 / 2026-10-09
- **Task:** Remediate live mailbox-sync HTTP 500s and improve Redis lease diagnostics.
- **Authorization:** User supplied live runtime logs for active FIX-01 remediation.
- **Started from:** Current GitHub `main`; reported errors were missing `ai_provider_configs.model`, missing `email_sync_states.last_attempt_at`, and generic Redis command rejection.
- **Actions:** Added forward-only idempotent migration `0029_runtime_schema_reconciliation.sql`; it adds provider/mailbox columns and backfills legacy sync checkpoint columns when available. Redis RESP errors now include a bounded server response. Added a WRONGPASS regression test.
- **Files/code:** `supabase/migrations/0029_runtime_schema_reconciliation.sql`; `apps/worker/src/email/redis-lease.ts`; `apps/worker/tests/redis-lease.test.ts`.
- **Evidence:** GitHub commits `a4fab9df07deafa5fd47879217616e3cb6d1c03f`, `71616ac887f3efb79f90039245d6064c4662a77c`, `0fa3e751cae2e5105b212083e93a7cc87bf00468`. Source accepted; no tests/typecheck/build/migration/runtime checks executed.
- **Blockers/dependencies:** OPS-01 needs access to live PostgreSQL and Docker/runtime configuration to apply migration and roll out matching images; Redis response must be inspected after diagnostic patch.
- **Lesson:** Do not infer Redis is usable from environment-variable presence or health checks; preserve bounded server error responses and never bypass the distributed lease on command failure.
- **Next action:** OPS-01 apply migrations through `0029`, roll out web/worker images, and correct Redis AUTH/ACL/TLS/URL only from the exact Redis error. No runtime PASS claimed.

### FIX01-INBOX-SCHEMA-REDIS-20261009 / 2026-10-09
- **Task:** Continue production mail sync incident from new logs.
- **Authorization:** User supplied fresh production logs and reported no emails in inbox after the sync endpoint returned queued.
- **Actions:** Confirmed `202 queued` only acknowledges scheduling; worker cannot process while Redis AUTH returns WRONGPASS. Added forward-only migration `0030_email_messages_runtime_reconciliation.sql` for canonical inbox message columns and legacy-column backfills; added static migration assertions.
- **Files:** `supabase/migrations/0030_email_messages_runtime_reconciliation.sql`, `apps/web/tests/migration-verification.test.ts`.
- **Commits:** `69c51678c8c12e0a0c070214dc09db77e0758dae`, `e7a1e7ee396d542ffdf3edada895938a087b6a27`.
- **Evidence:** Source commits only. Tests/build and runtime migration not run. Redis AUTH is still failing in user logs; no imported-message count or successful inbox query is established.
- **Next action:** OPS-01 applies migrations 0029/0030, rolls out matching images, fixes Redis URL credentials/ACL, and verifies actual persisted email rows and inbox loading. Never bypass distributed locking.

### FIX01-INBOX-WORKFLOW-CODE-ANALYSIS-20261009 / 2026-10-09
- **Task:** Analyze why manual Gmail sync was accepted but inbox remained empty; review code against the actual email import workflow.
- **Authorization:** User explicitly requested code analysis and correction to make the business workflow work.
- **Actions:** Inspected sync API, polling/queue worker, persisted message insert, inbox repository query, and historical email/sync migrations. Fixed invalid dollar quoting in migration 0030; corrected all inbox search ILIKE placeholders; added migration 0031 to normalize legacy JSONB cursor to a separate text cursor token and updated worker reads/writes. Added static regression assertions.
- **Files/code:** `supabase/migrations/0030_email_messages_runtime_reconciliation.sql`; `supabase/migrations/0031_email_sync_cursor_compatibility.sql`; `packages/db/src/email/repository.ts`; `apps/worker/src/email/mailbox-sync-worker.ts`; `apps/web/tests/migration-verification.test.ts`.
- **Evidence:** Commits `baccc392374fd473b9bcec72c2a7ebc639b40c7a`, `1bbcfdb7d65cc8d2b2a653c2128043aa0ac3e1e7`, `b26239046138c18e689498f1857b154c000de452`, `bf6ffa846f9690722309803173dd5fafb920106e`, `0c1857f0ee56a30dd0d5560d5a8e34e32bf3540c`, `34945eb5dc152ff76fee3a6bd2f4bd7a9abaf649`.
- **Verification:** Static source inspection only. Tests, typecheck, database migration, worker deployment, Redis AUTH, and actual mailbox import remain unverified.
- **Blockers/dependencies:** OPS-01 must apply migrations through 0031 and fix Redis WRONGPASS in the live container configuration.
- **Lesson:** HTTP 202 proves only queue acceptance; verify each link in the chain: queue/poller → Redis lease → provider fetch → DB persistence → tenant-scoped inbox query. Legacy JSONB cursor shape is not interchangeable with provider string pagination tokens.
- **Next action:** OPS-01 apply migrations 0029–0031, rebuild/restart web and worker from current main, correct Redis ACL credentials, then confirm persisted message rows and inbox rendering. Do not disable distributed locking.

 
### FIX01-PNPM-LOCKFILE-20261009 / 2026-10-09
- **Task:** Resolve user-reported `pnpm run typecheck` failure before workspace typechecking.
- **Evidence:** `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` for `amqplib@2.2.0`.
- **Code analysis:** `pnpm-lock.yaml` contained two YAML documents; the first was stray pnpm self-package metadata. The actual workspace document referenced `amqplib@2.2.0` in the worker importer but had no matching package/snapshot entries.
- **Fix:** Replaced the multi-document lockfile with the workspace document and restored the package resolution and snapshot.
- **Commit:** `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`.
- **Verification:** Post-commit source structure checked; pnpm frozen install and typecheck not run. No PASS claimed.
- **Next:** User pulls latest `main`, runs `pnpm install --frozen-lockfile` and `pnpm run typecheck`; continue directly to any remaining independent issues without waiting for CI/Vercel.

### FIX01-PNPM-LOCKFILE-REGRESSION-20261009 / 2026-10-09
- **Task:** Re-triage the user's repeated Docker install and workspace typecheck failure for `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` / `amqplib@2.2.0`.
- **Authorization:** User-explicit FIX-01 root-cause, minimal corrective change, regression protection and durable-record request. Scope excludes unrelated product work and Docker/environment ownership.
- **Started from:** User reports pulls through `1bbcfdb`; current GitHub `main` already includes lockfile correction `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`.
- **Root cause:** At the reported revision, `pnpm-lock.yaml` was malformed: two concatenated YAML documents and the actual workspace lockfile's worker importer referenced `amqplib@2.2.0` without package/snapshot entries. The failed `pnpm install --fix-lockfile` did not recover it; the same error persisted.
- **Failed approaches:** Retrying Docker build, rerunning typecheck, and `pnpm install --fix-lockfile` against the broken lockfile; all fail before code typechecking and do not establish a valid dependency graph.
- **Remedy already on current main:** commit `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e` normalizes the lockfile to one workspace document and adds package/snapshot entries. Added static regression assertions to `apps/web/tests/migration-verification.test.ts` in commit `b9ba0c6738e32cf4ef8b670a4b65857a56eb50f2` to guard the worker importer and both resolution sections.
- **Evidence:** Current main lockfile has one visible lockfile header, an `apps/worker` importer, `amqplib@2.2.0` under `packages`, and its snapshot. Regression source committed. No install, test, typecheck, Docker build, or runtime check executed by this session.
- **Prevention lesson:** Lockfile repair is not verified by the repair command finishing or by source inspection alone. Reproduce with the pinned package manager and run `pnpm install --frozen-lockfile`; never continue to typecheck if dependency resolution fails.
- **Next action:** User pulls latest main (including `27f04065` and `b9ba0c67`), runs `pnpm install --frozen-lockfile`, then `pnpm run typecheck`. If the source-level lockfile regression test itself fails, correct that test narrowly. Docker daemon/base image/build environment errors belong to OPS-01.

### FIX01-PNPM-LOCKFILE-REGRESSION-FOLLOWUP-20261009
- **Update:** Strengthened the regression test to count exactly one `lockfileVersion:` and one top-level `importers:` key, so concatenated documents without an explicit YAML separator are also detected.
- **Commit:** `93ae720cd8d77c4c40583bdeb61fffd6593f7898`.
- **Verification:** Test source only; no test or frozen install executed.

### FIX01-PNPM-TARBALL-INTEGRITY-20261009 / 2026-10-09
- **Task:** Continue the authorized lockfile incident after the user's frozen install revealed `ERR_PNPM_MISSING_TARBALL_INTEGRITY` for `amqplib@2.2.0`.
- **Authorization:** User's explicit FIX-01 instruction to trace root cause, make the smallest corrective change, add regression protection, and record the incident.
- **Started from:** User reports local pull to `a164425`; current main was inspected directly.
- **Root cause:** The prior lockfile repair added the amqplib package and snapshot records but used a tarball-only `resolution` with no SRI integrity. pnpm 12.8.1's supply-chain policy correctly rejected an unverifiable tarball.
- **Failed approach:** `pnpm install --frozen-lockfile`, `pnpm run typecheck`, and the focused Vitest command all stop at dependency installation with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`; none reaches typecheck or test execution. The previous repair fixed missing package/snapshot records but missed the integrity field.
- **Remedy:** Added the published tarball's SHA-512 SRI to the existing `amqplib@2.2.0` package entry without changing the version or dependency range. Commit `644d578170801785c1252a569fa976b0b33476eb`.
- **Regression protection:** Strengthened `apps/web/tests/migration-verification.test.ts` to require an integrity-form resolution specifically adjacent to the `amqplib@2.2.0` entry. Commits `21837f32157ff43a7a1243b3f3095bb1eb2f1df6` and `d115e1b0293b48571cd0902849cb5f0030963bc7`.
- **Evidence:** Current lockfile entry now contains `resolution: {integrity: sha512-VifzN9aHs/Q3zTruVHXh2yCisQyXexBN91CQ2E5iSyUKyNjH6ilYhJGte5AXZH/Bj1PaH7SwPhyuSf6Msd2udw==}`; same SRI appears in independent published pnpm lockfiles. GitHub source writes succeeded. No local install/test/typecheck/build was executed after this change.
- **Prevention lesson:** A dependency entry is not complete merely because package/snapshot records exist; registry resolutions must retain the exact published integrity hash. Never invent a hash or disable integrity policy to make installation pass.
- **Next action:** Pull latest main and rerun `pnpm install --frozen-lockfile`; only after success run `pnpm run typecheck` and the focused Vitest test. Record real outputs. Route separate host/Docker infrastructure failures to OPS-01.

### FIX01-LOCKFILE-TEST-REGEX-CORRECTION-20261009
- **Finding:** Source review of the newly added lockfile regression test found over-escaped regex tokens; the assertions would not reliably match the lockfile's actual worker importer and amqplib entries.
- **Correction:** Rewrote the regex literals with correct JavaScript regex escaping, scoped the SHA-512 assertion to the amqplib package entry, and retained checks for the worker importer, package entry and snapshot.
- **Commit:** `162183e8d7c67b8346c15989ef850327e487cfc4`.
- **Verification:** Source inspection only; Vitest has not run because pnpm install previously failed.

### FIX01-WORKER-TYPECHECK-MIGRATION-PATHS-20261009 — 2026-10-09
- **Invocation/evidence:** User's frozen install passed (534 entries; one package installed). Workspace typecheck reported TS2345 at apps/worker/src/queues/email-sync-rabbitmq.ts:165; worker typecheck was SIGKILLed. Focused migration Vitest failed collection with ENOENT for the old 0003_database_security_hardening.sql path.
- **Root causes:** (1) the optional RabbitMQ URL was captured in the reconnecting boot closure as string | undefined; (2) static migration tests retained pre-renumbering filenames. Canonical files are 0013_database_security_hardening.sql (renumbered by 1506bdda) and 0005_agent_policy_configuration.sql (renumbered by 42627f2b).
- **Remedy:** Normalize the consumer URL with process.env.RABBITMQ_URL?.trim() ?? "" while retaining the no-URL early return; add a source-contract regression assertion. Update test references to canonical 0013 and 0005 rather than recreating obsolete migration files.
- **Commits:** worker source 09e4df46558f7f4f2f384d65a0ac8089194e7e0f; worker assertion a24edec36fd59fc293f6242e25ae01d0ee3f0b3b; migration paths ffc98b3063203d2781da495c417d04b1f976abc7.
- **Failed approaches:** Recreating old-numbered migration files would duplicate canonical migrations. The pre-fix worker SIGKILL is not itself a TypeScript diagnosis.
- **Verification:** Source committed; no post-fix typecheck, worker test, or migration Vitest run by FIX-01. No PASS claimed beyond the user's observed frozen install.
- **Prevention:** Keep static path contracts synchronized with canonical migration filenames; normalize optional config to a definite type before using it in asynchronous closures.
- **Next action:** Pull latest main. Run focused migration Vitest and worker RabbitMQ contract test; then run web and worker typechecks sequentially to avoid resource contention. Run full workspace typecheck afterward if resources allow. Do not wait for CI/Vercel.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


### FIX01-WEB-TYPECHECK-UI-DEPENDENCY-FOCUS-TEST-20261009
- User-reported web typecheck found missing lucide-react imports, strict focus-trap indexed-access errors in Agent Detail/sidebar, and an undefined newAgentPage test variable.
- Corrections: added lucide-react ^0.575.0 to the web workspace and pnpm lockfile using the published SHA-512 integrity; narrowed focus element types after the existing non-empty guard; loaded the new-agent route source in the migration test.
- Commits: 8f09785a, 7b1136e6, 3e35c1f5, a9dcb8e5, 52a4e348.
- Verification: source only. Frozen install, tests and typechecks have NOT been rerun; no PASS claimed.
- Next: pull latest main, run frozen install, focused web migration and worker RabbitMQ tests, then web/worker typechecks sequentially. Do not wait for CI/Vercel.


### FIX01-MIGRATION-WORKER-TEST-DRIFT-20261009 / 2026-10-09
- **Task:** Trace the reported migration-verification and RabbitMQ email-sync test failures; apply minimal authorized fixes and add regression protection.
- **Authorization:** User explicitly invoked FIX-01 / Sentinel and requested root-cause-first diagnosis, smallest corrective change, regression protection, and durable recording.
- **Started from:** User-provided local test output; repository source recovered from current GitHub main.
- **Actions:** Compared reported expectations with canonical migration/test/worker sources. Found that base migration 0002 uses valid standard `DO $$` blocks while the static test expected a named tag; the current test contained over-escaped delimiter regexes. The audit test expected insert/read policy names and append-only wording not present in migration 0002. Worker retry object spreads the existing envelope (preserving idempotency/correlation), but the test required explicit properties; a blanket qdrant/vector-store word ban matched explanatory documentation.
- **Remedy/files:** Added forward-only `supabase/migrations/0032_audit_event_access_hardening.sql` (organization-scoped insert/read; restrictive update/delete denial; append-only comment). Updated `apps/web/tests/migration-verification.test.ts` and `apps/worker/tests/email-sync-rabbitmq.test.ts` to assert valid SQL delimiter forms, new forward migration protections, retry envelope spread, and absence of actual vector client imports/calls.
- **Commits:** `7557a6cd820e8a199f434d9e5e6effa77f2a3178`; `ee85b55401b9154c42a795400589589fbb930b1d`; `cecae73edf181771396d6c8c30e1bad3c622c3fd`; `c4d4abd06f6001f4198c23c42f0b2312ea7601eb`; `96996d82ea034688485b1b9e92ed78fb0d024aee`.
- **Evidence:** GitHub source commits were accepted and re-fetched. No pnpm install, Vitest, typecheck, migration execution, or runtime test was executed in this session. No PASS claimed.
- **Discrepancy:** User's local output says pnpm-lock.yaml contains two lockfile documents; current main's file has exactly one `lockfileVersion:` and one `importers:` header. Treat the local duplicate as stale/uncommitted/local merge state until `git status` and diff against origin/main identify its origin; do not make a needless lockfile edit on current main.
- **Failed approaches to avoid:** Don't rewrite valid DO blocks to appease a named-tag-only test; don't add redundant retry metadata; don't remove the Qdrant explanatory comment; don't edit historical migration 0002/0013 for a live schema correction.
- **Next action:** Pull latest main; inspect local `git status --short` and compare `pnpm-lock.yaml` to `origin/main`; run focused migration-verification and worker RabbitMQ tests; then run web and worker typechecks sequentially. Route Docker/CI/deployment/environment failures to OPS-01.

### FIX01-WORKER-CONTRACT-20261010 / 2026-10-10
- **Task:** Correct worker test-suite startup failures and the reported email/provider contract regressions.
- **Authorization:** User explicitly requested repository inspection/fixes/commits on GitHub; current `NEXT_ACTION.md`.
- **Started from:** `fix/migration-verification-phase4-contract` at `f8fe225aa392dab26e23779d64e9bbe613aa3c30`.
- **Actions:** Converted three worker Vitest-based contract tests to `node:test`; replaced ESM-incompatible `__dirname` in six worker test files; used the existing bounded retry helper for capability discovery; corrected IMAP RFC 2047 encoded-word matching; preserved non-canonical informational messageId metadata; adjusted the Clara source assertion to strip comments; corrected IMAP literal regex and Zoho OAuth body/account-discovery mocks; moved email approval/recovery assertions to the DB repository and action worker.
- **Files/code:** Worker test files, `apps/worker/src/email/provider-verification.ts`, `apps/worker/src/email/imap-smtp-adapter.ts`, `apps/worker/src/events/provider-events.ts`, `apps/web/tests/email-action-contract.test.ts`, and project-control records.
- **Evidence:** GitHub connector accepted commits. No tests/typechecks/build/runtime/deployment were executed in this session. Do not mark PASS.
- **Blockers/dependencies:** Local test execution is needed to validate these corrections and reveal any remaining suite failures. Preserve local `pnpm-lock.yaml` and backups.
- **Lesson:** Align source-text contracts with the module that owns the behavior; use the package's existing test runner and ESM path conventions rather than introducing unnecessary dependencies.
- **Next action:** Follow `docs/project-control/NEXT_ACTION.md`; run focused web tests, worker suite, and web/worker typechecks locally without waiting for CI/Vercel.



### FIX01-AUTH-ROLE-RANK-20261010 — 2026-10-10
- **Task:** Fix the reported web Docker build TypeScript error without expanding scope.
- **Authorization:** User explicitly invoked FIX-01 / Sentinel and authorized root-cause-first diagnosis, smallest corrective change, regression protection, and durable records. No DEV-01 dependency; OPS-01 boundary preserved.
- **Repository/context:** `Rilan-Dev/ai-comms-agent`, branch `main`; user reported `git pull --ff-only origin main` already up to date. Error surfaced after Next.js compilation at `apps/web/src/lib/identity/authorization.ts:109`.
- **Symptom:** `Record<MembershipRole, number>` literal had member/admin/owner but TypeScript required viewer as well.
- **Root cause:** `packages/shared/src/identity/types.ts` defines `MembershipRole = "owner" | "admin" | "member" | "viewer"`. The hierarchy map failed to include viewer.
- **Failed approaches:** No retries, casts, role-union changes, or infrastructure changes. The compiler error is deterministic source/type drift, not a Docker daemon or deployment defect.
- **Remedy:** Add `viewer: 0` to preserve viewer < member < admin < owner. Added tests proving viewer does not satisfy a minimum member role and admin/owner do.
- **Files/commits:** `apps/web/src/lib/identity/authorization.ts` — `44a08522f23e807755114ebe46b8b1e04e6056da`; `apps/web/tests/rbac.test.ts` — `3853ecf046c175e15a4f824e9679f50fb7132cf9`.
- **Evidence:** GitHub accepted both source commits. Tests, web typecheck, Docker build and runtime were NOT executed after the fix; no PASS claimed.
- **Prevention lesson:** Exhaustive records must track every member of their canonical union. Regression tests must preserve role hierarchy semantics, especially least privilege for viewer.
- **Next action:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/rbac.test.ts`; then `pnpm --filter @ai-comms-agent/web typecheck`; then `bash scripts/manual-up.sh`. Route any separate Docker/build-host/network/runtime issue to OPS-01.


### FIX01-RBAC-TEST-FIXTURE-FOLLOWUP-20261010
- **User-provided evidence:** Focused Vitest reported 15 passed / 1 failed. The new ADMIN/OWNER minimum-role test failed with `UnauthorizedError: Authentication required`; web typecheck reported TS2339 because `TestFixture` has no `adminA` property at `tests/rbac.test.ts:312`.
- **Root cause:** The regression test referenced a nonexistent fixture user (`fixture.adminA`). The undefined ID caused the auth adapter to resolve no user, so the test failed before reaching `requireRole`. This was a test-fixture defect, not evidence that the production rank comparison was wrong.
- **Failed approach:** Assuming a preconfigured admin fixture exists. Do not add a fake fixture property or weaken authentication to make the test pass.
- **Correction:** Commit `113b2b3ee094042e9380404f3073c39b17e07951` changes the test to promote the existing `fixture.memberA` to admin through the repository, then verifies that authenticated admin and owner subjects both satisfy `requireRole(subject, "member")`.
- **Verification:** User's pre-correction run proves 15/16 tests passed and typecheck failed on the invalid fixture reference. The corrected test source has been committed, but the focused test, typecheck, and Docker build have NOT been rerun after correction. No PASS claimed.
- **Environment preservation:** User reports local `pnpm-lock.yaml` is modified. Do not overwrite or restore it as part of this source fix; inspect its diff separately against `origin/main`.
- **Next action:** Rerun the focused RBAC test, then web typecheck, then `bash scripts/manual-up.sh`; record actual output. Do not wait for CI/Vercel. Route only independent Docker/registry/daemon/runtime environment defects to OPS-01.


### FIX01-EMAIL-ACCOUNT-RUNTIME-DIAGNOSTICS-20261010
- **User report:** Deployed app starts, but `POST https://aca.ostechnologies.in/api/email-accounts` returns HTTP 502 during IMAP/SMTP configuration; connected OAuth mailboxes do not appear to import messages.
- **User-provided startup evidence:** Focused RBAC suite passed 16/16, web typecheck passed, Docker web/worker images built, migrations reported complete, and both containers started. This proves build/startup only; it does not prove mailbox sync.
- **Source findings:** `apps/web/src/app/api/email-accounts/route.ts` returns HTTP 502 with `provider_connection_failed` when the IMAP/SMTP connection test throws; DNS, TCP timeout/refusal/reset receive targeted messages. A Cloudflare 502 HTML response vs application JSON must be distinguished by comparing public and local origin. `apps/web/src/app/api/email-accounts/[accountId]/sync/route.ts` currently supports manual sync only for Gmail and returns 409 for Zoho/IMAP-SMTP; the background worker's due-account query includes Gmail, Zoho and IMAP-SMTP. OAuth completion/HTTP 202 is not proof of message persistence.
- **Diagnostic script:** Added `scripts/diagnose-email-accounts.sh` (commit `a529ffe43915495d099c17b353fb517d53fac10b`). It compares public/local liveness and account API responses, optionally runs non-persistent IMAP/SMTP tests through both paths, optionally explicitly saves after a successful test, snapshots per-account sync status/message counts from PostgreSQL, and gathers sanitized web/worker logs. It does not print the cookie/password in the report.
- **Verification:** Script committed but has NOT been run against the user's server here. No root cause for the reported live 502 or OAuth import failure is claimed yet.
- **Next action:** User runs the script from repo root and shares only the reviewed report (never cookie/password/OAuth tokens). Diagnose from public-vs-local HTTP/body, DB sync state/message counts, and worker logs before making runtime-specific code changes. Preserve local lockfile changes and do not wait for CI/Vercel.

### FIX01-WORKER-CREDENTIAL-TYPE-20261016 / 2026-10-16
- **Task:** Fix clean Docker worker build failing TypeScript compilation in Gmail watch renewal and IMAP IDLE startup.
- **Authorization:** Explicit user request: trace root cause, make smallest authorized correction, add regression protection where appropriate, record evidence and next action; do not expand scope or wait for DEV-01.
- **Started from:** User-provided deployment checkout had pulled `main` from `345e163` to `390546c` before the failing build. GitHub source was then corrected on `main`.
- **Actions:** Recovered project-control instructions, shared memory, FIX-01 memory/worklog, central event/session/handoff/backlog records, current phase/next-action/verification/issues, and affected source. Confirmed both failing lines cast generic `Record<string, unknown>` values to `EmailCredentials`, whose required `credential_type` field was not guaranteed. Added explicit allowlist validation for `oauth_token`, `password`, and `app_password`, spread the narrowed discriminant into the adapter input, and removed direct casts.
- **Files/code:** `apps/worker/src/email/gmail-watch-worker.ts`; `apps/worker/src/email/imap-idle-worker.ts`; project-control issue/event/session/backlog/verification/next-action; shared and role-local memory.
- **Evidence:** User-supplied Docker log: TS2352 at `gmail-watch-worker.ts(55,29)` and `imap-idle-worker.ts(69,27)`. Corrective commits: `185b729d`, `60fadabf`, `e3ba38c9`, `18948e08`; memory and tracking commits followed. No local build runner was available here, so typecheck/tests/rebuild are pending, not passed.
- **Failed approaches:** Do not suppress the error with `as unknown as EmailCredentials`; it evades runtime validation. No other failed fix was evidenced.
- **Lesson:** Validate decrypted generic records at the typed provider boundary. Required discriminants should be checked, not asserted.
- **Blockers/dependencies:** Verification requires running commands in the deployment checkout; no DEV-01 dependency. Route only subsequent environment/compose/deployment failures to OPS-01.
- **Next action:** Run worker typecheck and targeted tests, then rebuild worker image. Keep ISS-027 open until evidence is recorded.
