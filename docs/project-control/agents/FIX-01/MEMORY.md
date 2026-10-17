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


### FIX-01 / Sentinel — 2026-10-10 — Membership role rank exhaustiveness
- **Symptom:** Docker web build failed during Next.js TypeScript validation because `Record<MembershipRole, number>` lacked `viewer`.
- **Root cause:** The role union includes viewer, but the authorization hierarchy map listed only member/admin/owner.
- **Failed approaches:** Do not cast around the missing role, loosen the Record type, or delete viewer from the domain union.
- **Remedy:** Set ranks to viewer=0, member=1, admin=2, owner=3 and test minimum-role semantics.
- **Evidence:** `44a08522f23e807755114ebe46b8b1e04e6056da`, `3853ecf046c175e15a4f824e9679f50fb7132cf9`. Post-fix tests/typecheck/build not run.
- **Prevention:** Update exhaustive records and RBAC tests whenever a shared union type includes a new variant.
- **Next action:** Run focused RBAC Vitest, web typecheck, then manual-up; OPS-01 owns independent infrastructure/deployment/environment issues.


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


### FIX-01 / Sentinel — 2026-10-16 — Decrypted email credentials typed at runtime boundary
- `loadCredentials()` returns a generic record; do not assert it directly as `EmailCredentials` because `credential_type` is required.
- Validate the discriminant at each provider-worker boundary, reject unsupported/missing values, and pass a spread object with the narrowed discriminant. Avoid `as unknown as` casts.
- Build evidence from user: worker TypeScript build failed at Gmail watch renewal and IMAP IDLE startup. Fix commits are on `main`; rerun worker typecheck/build to verify.


### FIX-01 / Sentinel — 2026-10-16 — Provider enum/schema mismatch
- When worker SQL rejects a provider label with PostgreSQL 22P02, compare the exact enum bound to the persisted column against every migration and the current application provider union.
- A similarly named enum such as email_account_provider does not update email_provider; change the exact type referenced by the failing column.
- Prefer a forward-only migration and a source regression assertion. Do not remove supported provider values from polling queries to silence the error.
- Distinguish deterministic source/schema errors from separate subscription prerequisites and deployment/runtime evidence. Migration execution and live sync remain OPS-01 verification.


### FIX-01 / Sentinel — 2026-10-17 — WhatsApp error 131047
- Meta error 131047 with the explicit 24-hour-window explanation means free-form text was rejected as an out-of-window re-engagement message. Use an eligible approved template or wait for a customer reply; never bypass Meta policy.
- Queue acknowledgement is not delivery confirmation. Treat queued/provider-accepted/sent/delivered/read/failed as distinct states.
- If the UI contradicts a supplied failed webhook event, trace the exact provider message ID through webhook response, tenant/account-scoped persistence, and UI refresh before changing code. Route live deployment/database/webhook-delivery issues to OPS-01.

### FIX-01 / Sentinel — 2026-10-17 — Chat provider override fallback
- The per-agent AI configuration feature must not require an `organization_ai_runtime_settings` row before reading `agent_ai_settings` and `ai_provider_configs`. A missing org-default row previously caused `organizationAIConfig` to return null and silently use the environment default (OpenAI), bypassing a saved Sarvam/Gemini override.
- Preserve the distinction between source cause and runtime confirmation: verify the live org row and serving revision before claiming this explains a particular deployment.
- Do not add a default OpenAI key to mask incorrect provider selection. Regression source test: `apps/web/tests/clara-agent-provider-resolution.test.ts`; source fix `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`. Tests/deployment remain unverified.


### FIX-01 / Sentinel — 2026-10-18 — Nullable membership at chat tool-context boundary
- `AuthSubject.membership` is nullable in the shared type even though `authorize()` only returns after `requireOrganizationMember()` has found an active membership. TypeScript still requires narrowing at the caller.
- Small safe fix: immediately after `authorize()`, explicitly return 403 if membership is absent; then construct `ToolContext.auth_subject.role` from the narrowed membership. Never default the role or cast away nullability.
- Add regression protection for guard-before-context ordering. Static test source is not test execution; keep build/test status pending until rerun evidence arrives.
- Commits: `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`, `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`.

### FIX-01 / Sentinel — 2026-10-18 — WhatsApp synced template row nullability

- **Symptom:** User's Docker deployment build reports Next.js compilation success, then TS18048 at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119`: `synced.rows[0]` may be undefined when reading `.components`.
- **Root cause:** The existing `if (!synced.rows.length)` guard does not narrow TypeScript's indexed array access under strict checking. The later direct access `synced.rows[0].components` remains unsafe to the type checker.
- **Failed approach:** Treating a nonzero `rows.length` check as proof that `rows[0]` is narrowed. Do not use a non-null assertion or relax compiler settings.
- **Remedy:** Bind `synced.rows[0]` to `syncedTemplate`, return the existing fail-closed 409 `template_not_synced` response if absent, then access `syncedTemplate.components`. Added a regression source assertion for the explicit row guard and safe access.
- **Prevention:** Narrow array elements directly after database writes/RETURNING operations; keep an explicit absent-row response even when a length check is present.
- **Evidence:** Source commit `90fac5e0774b695446e1e0c3ab51072639ba5f06`; regression test commit `41734923651b1173a703d747f0ac0aa93317a5b9`. User log shows worker image built/exported and web compile succeeded before type validation failed. No post-fix test or build has been run/observed.
- **Next action:** Pull latest `main` and rerun `bash scripts/update-and-up.sh` (or the documented Docker Compose build). If the build passes, run the focused `whatsapp-send-approval.test.ts` suite. Record actual results; do not infer success from source commits.


### FIX01-VOICE-GENERATION-ID-20261018 — 2026-10-18
- **Symptom:** Web build failed webpack parse with duplicate `generationId` in `apps/web/src/app/ai-voice/voice-workspace.tsx`; worker image built/exported.
- **Root cause:** Two `const generationId` declarations in one Sarvam/ElevenLabs speech fallback block.
- **Fix/test:** Reuse the existing identifier; regression assertion checks a single declaration in the provider branch. Commits `f6efffdb42dbd75df38841fab43b985eb565ee3f` and `05519965adae7ebab837a03e4d7a0d2306e3f0c1`.
- **Verification:** Post-fix build/test pending; no green claim.
- **Next:** Pull main, rebuild, run focused voice transport test, update records with actual output.



### FIX01-VOICE-RESAMPLING-INDEX-20261018 — 2026-10-18
- **Symptom:** Next.js compile succeeded; strict typecheck failed at voice workspace audio resampling because indexed Float32Array reads can be undefined.
- **Fix/test:** Guarded both direct sample conversion and averaging-loop sample reads with `?? 0`; added source-contract regression assertions. Commits `baa9746142297322c5bf796e7c6fb94060bbc9cf`, `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Verification:** Post-fix Docker build and focused test remain unverified.
- **Next:** Pull main and rerun manual build; continue source-error remediation without claiming unobserved success.

### FIX01-STRICT-INDEXED-ACCESS-VOICE-CONTEXT-20261018
- Strict indexed-access applies to Int16Array, Float32Array, and split() results; guard reads directly rather than disabling compiler checks.
- Voice-turn trust context must explicitly fail closed if membership is null and must provide a real string conversation ID; do not cast unknown session metadata.
- Source/test commits: 1fb04529, 9a9e09ee, 5946168a, 57618396, fee2a239. Verification pending; user logs are pre-fix.


### FIX01-MIGRATION-NETWORK-20261018 — 2026-10-18
- **Symptom:** Manual deployment build completed, then migration failed with `getaddrinfo ENOTFOUND postgres`; script continued startup.
- **Root cause:** `scripts/manual-up.sh` runs the migration Node process on the host, but its DB hostname `postgres` is only a Compose network alias.
- **Failed approaches:** Host-side runner with Compose DNS; using `host.docker.internal:5433` for app traffic, which conflicts with the requested internal network route.
- **Remedy/owner:** Routed deployment script and migration execution to OPS-01. Migration should run as a one-off Compose container; ensure `supabase/migrations` exists inside the runner (current Dockerfile does not copy it). Do not silently change the DB name.
- **Evidence:** User output + source inspection; no post-fix tests or deployment verification.
- **Prevention:** Verify the process network namespace and required migration files before changing URLs; separate source diagnosis from deployment PASS.
