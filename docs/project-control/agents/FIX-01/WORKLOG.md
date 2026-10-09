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
