# DEV-01 / Forge — C3 focused host verification and disposable DB gate — 2026-10-20

## Recovery and verification receipt
- Recovered GitHub `main` at `daa89ffdcf46c237a01954cf8ca048a29459ea63` and inspected C2/C3 authorization, SQL schema, existing DB fixture and test contracts.
- User ran `git pull --ff-only origin main`; output confirms fast-forward `202b5863..daa89ffd`.
- User executed all three focused briefing test files. Output: **29 tests, 29 passed, 0 failed, 0 skipped/cancelled**; duration 773.727028 ms.
- User ran four `pnpm --filter ... typecheck` commands for `@ai-comms-agent/db`, `@ai-comms-agent/clara-core`, `@ai-comms-agent/email-agent-runtime`, `@ai-comms-agent/worker`. Each returned `tsc --noEmit` without visible diagnostics, and shell prompt returned. The native pnpm binary warning did not prevent typechecking.
- This verifies the focused C3 tests/types on the checked-out source at `daa89ffd` as shown by fast-forward, not on later commits.

## New next-gate implementation
Committed `packages/db/tests/briefing-c3-canonical.integration.test.mjs` to main, code commit `4cda8ee52e53c70b1dcf059377933e65f7ef7147`.
- Reuses the existing strongly gated, disposable PostgreSQL fixture `migrateFixture`/Docker container `ai-comms-c1-testdb` with loopback-only port 55432, tmpfs data volume and explicit `BRIEFING_TEST_DATABASE_OPT_IN`; no fallback to live `DATABASE_URL`.
- Seeds a two-mailbox C1 grant and 55 ordered first-mailbox sources plus second-mailbox mail, proving a 50-message C2 claim can load exactly its canonical source batch while scope authorization covers the **entire** manifest.
- Adds five DB subtests: successful multi-mailbox-grant batch source read, cross-user/cross-tenant/substituted mailbox denial, post-claim revocation of even the unclaimed second mailbox, post-claim message revision change, and expired/superseded lease refusal.
- All test changes run only against the disposable fixture and are unexecuted pending a suitable local host. No SQL schema migration changes, live DB connections, feature activation, live provider calls, sends, or deployment.

## Evidence quality and limitations
- **PASSED** (owner host): 29/29 Node cases, four package `tsc --noEmit` checks, previous main `daa89ffd`.
- **ADDED BUT NOT RUN**: five new PostgreSQL subtests and their migration harness, commit `4cda8ee5`. No new `node --test` run, live PostgreSQL/role isolation proof or C4 authenticated-browser acceptance.
- The existing local fixture performs guarded schema drop/recreation; do not point it at production. Docker preflight hard-denies any database other than localhost `127.0.0.1:55432/ai_comms_c1_test` and requires exact container properties.
- Tests/checks can still miss integration bugs; no change in phase classification, `implementation_in_progress`.

## Exact next authorized step
On a fast-forwarded local checkout with its **already provisioned** disposable tmpfs Docker `ai-comms-c1-testdb` container only:
```bash
git pull --ff-only origin main
BRIEFING_TEST_DATABASE_OPT_IN=disposable-local-c1 \
BRIEFING_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/ai_comms_c1_test \
node --test packages/db/tests/briefing-c3-canonical.integration.test.mjs
```
The guarded test will refuse wrong URLs/container configuration. C3 requires this DB run and review of its results before registration behind a disabled-by-default flag. Continue with full worker/web/db/Clara suites and C4 authenticated browser acceptance only after prior blockers are resolved. OPS-01 retains production migrations/deployment, FIX-01 unrelated runtime/security remediation.
