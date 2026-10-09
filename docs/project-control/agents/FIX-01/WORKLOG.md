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
