# FIX-01 Role-Local Memory

This is durable memory for FIX-01. It supplements, but never overrides, shared APCP memory or repository authority.

## Read before work
- docs/project-control/AGENT_MEMORY.md
- docs/project-control/AGENT_EVENTS.md
- docs/project-control/AGENT_SESSIONS.md
- docs/project-control/AGENT_HANDOFF.md
- docs/project-control/AGENT_BACKLOG.md
- this file
- current project-control state and applicable architecture/plan

## Record
- recurring issues;
- role-specific mistakes and prevention;
- successful patterns;
- failed approaches;
- environment-specific observations;
- lessons that should be promoted to AGENT_MEMORY.md when cross-agent.

## Do not store
Secrets, tokens, passwords, private keys, or sensitive personal data.

<!-- Append durable FIX-01 lessons below. -->

### FIX-01 / Sentinel — 2026-10-09 — Authentication loop re-triage
- **Issue/symptom:** Successful password login at the live HTTP deployment is followed by `/login?reason=not_provisioned`.
- **Root cause:** The current source path no longer matches the original cookie/navigation failure. `reason=not_provisioned` is produced only by the protected root layout after a cookie-bearing request reaches `getAuthenticatedAppContext()` and that context is null. Exact live branch remains unconfirmed because the private runtime is not reachable from this execution environment.
- **Failed approach:** Full browser navigation, explicit cookie propagation in the root layout, and HTTP-aware `Secure` handling are already present on `main` and did not eliminate the live symptom.
- **Remedy:** Route runtime/build/database diagnosis to OPS-01; do not weaken provisioning/auth checks.
- **Prevention:** Treat `login?next=/` and `login?reason=not_provisioned` as different failure branches; inspect cookie presence and application identity/session/membership state before changing login UI again.
- **Related record:** ISS-007 / EVT-FIX01-AUTH-20261009 / HOF-FIX01-OPS-AUTH-20261009

### FIX-01-AUTH-FIX-20261009
The authentication loop was traced to session issuance preceding active organization-membership authorization. Fixed `loginWithPassword` to check `getMembershipsForUser(user.id)` and throw `AccountNotProvisionedError` when no active membership exists; the login route returns 403 and does not mint a session. Added auth-boundary regression protection. Commit `197e6535eab0cafde3e84db8f0605b7a174b3b03`. Do not weaken fail-closed authorization or auto-provision memberships.


### FIX-01 / Sentinel — 2026-10-09 — Worker credential snapshot typing
- **Symptom:** Worker Docker build failed with TS2322 at mailbox-sync-worker.ts:156 and TS2345 at line 201.
- **Root cause:** Gmail returned a generic record where orchestration expected EmailCredentials; the database accepts Record<string, unknown>, which EmailCredentials does not implicitly satisfy.
- **Failed approach:** An adapter intersection does not fix incompatible method signatures; direct interface-to-record assignment is invalid.
- **Remedy:** Gmail snapshot returns EmailCredentials; worker spreads the snapshot into a plain record at persistence; added a focused contract test.
- **Prevention:** Keep provider snapshots on shared domain types and convert only at the storage boundary.
- **Evidence/status:** Commits caad1d75, 04a2345b, a98c0e7f; source committed, tests/typecheck/build unexecuted.
- **Next:** Run focused test and worker build; route Docker/environment failures to OPS-01.


### FIX-01 / Sentinel — 2026-10-09 — Zoho OAuth test parser failure
- **Symptom:** Web TypeScript reports TS1127/TS1434 at `apps/web/tests/zoho-oauth-settings.test.ts:84`; shared/db/clara-core and worker typechecks passed in user's output.
- **Root cause:** Literal `\n` text was committed between assertions instead of actual source newlines.
- **Failed approach:** Avoid modifying OAuth runtime implementation; parser failure is in the test file.
- **Remedy:** Replaced the exact malformed sequence with real line breaks. Commit `39857c40820940b500dcf452331dfe82ae35b861`.
- **Prevention:** Check escaping after generated/API writes so newline escapes do not become literal source characters.
- **Status:** Source correction committed; post-fix typecheck and test still pending.
- **Next action:** Re-run `pnpm run typecheck` and the focused Zoho OAuth test; route unrelated infrastructure/deployment failures to OPS-01.


### FIX-01 / Sentinel — 2026-10-09 — OAuth focused assertions
- User-reported typecheck now passes all workspaces; focused test output initially showed 8 pass / 2 fail.
- Raw IP validation intentionally precedes HTTPS validation; assert the raw-IP/DNS error for any raw IP, including HTTP. Do not encode incidental validation ordering as a protocol requirement.
- A source test forbidding environment-variable use should assert absence of `process.env.NEXT_PUBLIC_APP_URL`, not absence of every textual mention, since comments may explain the policy.
- Test-only correction commit: `c58d6d442767f471c694ef978fdb06eca6d29850`. Rerun remains pending.


### FIX-01 / Sentinel — 2026-10-09 — Migration and worker contract test drift
- **Symptom:** Migration static tests failed on audit policies/DO delimiters; worker tests failed on retry metadata and Qdrant exclusion.
- **Root cause:** Test expectations were coupled to named dollar tags/over-escaped regexes; the Phase 4 base migration did not carry the expected audit policy names/read policy; retry metadata was preserved through object spread, and a comment mentioning Qdrant tripped a blanket negative assertion.
- **Failed approaches:** Avoid rewriting valid SQL delimiter style, adding redundant fields to runtime objects, or deleting useful comments to satisfy brittle regexes.
- **Remedy:** Forward-only migration 0032 adds tenant-scoped audit insert/read policies and restrictive update/delete denial. Static assertions now allow valid DO delimiters, inspect the new migration, verify envelope spread, and forbid actual vector-client imports/calls.
- **Evidence:** Commits 7557a6cd, ee85b554, ceca e73e, c4d4abd0, 96996d82 (worker source/test and migration test source commits); tests NOT RUN.
- **Prevention:** Assert runtime contracts rather than exact implementation spelling. Inspect source after API writes; no source-only PASS claims.
- **Next:** Pull latest main, compare lockfile to origin/main, run focused tests and sequential web/worker typechecks.
