

### EVT-DEV01-CLARA-REALTIME-VOICE-20261016
- Agent/session: DEV-01 / Forge — SESSION-066
- Type: SOURCE_DIAGNOSIS / ROLE_HANDOFF
- Finding: The voice workspace requests microphone permission and calls the host transcript HTTP API, but never creates a realtime transport. Clara resolveVoice() exposes /api/voice/turn as sessionEndpoint, although that is not a provider WebSocket endpoint.
- Impact: UI can imply an active session without a live provider connection; natural spoken turns and spoken email enquiries are unavailable.
- Owner: FIX-01 / Sentinel for the substantial source bug, issue #26. OPS-01 owns any separate deployment/infrastructure failure after source transport correctness.
- Security: Keep provider keys server-side and retain the same authorization/approval/audit boundary for voice email actions; ISS-026 remains FIX-01-owned.
- Verification: Source inspection only; no tests, typecheck, browser, socket/provider, build or deployment verification.
- Next: Implement Clara-supported transport negotiation/client and only mark connected after actual transport readiness; test error, reconnect, interruption and teardown.
# APCP Central Agent Events

Append-only central event log for material cross-agent events. This is not a replacement for WORKLOG.md or project-control state.

## Use when

Record:
- cross-agent blockers/routing;
- significant errors and corrections;
- requirement-impact discoveries;
- handoff creation/completion;
- agent-session takeover/switching;
- material lessons that affect multiple roles;
- governance/process incidents.

Routine implementation details belong in the owning agent's WORKLOG.md.

## Event format

### <EVENT-ID> — <YYYY-MM-DD>
- **Agent/session:** <agent id / session id>
- **Type:** <BLOCKER | ROUTE | ERROR | CORRECTION | HANDOFF | REQUIREMENT | SESSION | LESSON>
- **Summary:** <one paragraph>
- **Impact:** <none / local / cross-agent / scope>
- **Owner:** <agent id>
- **Suggested next action:** <concrete action>
- **Related records:** <paths / issue ids / commits>

### EVT-FIX01-WHATSAPP-IDEMPOTENCY-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel — WhatsApp outbound 42P10 correction
- **Type:** CORRECTION / ROUTE
- **Summary:** User-provided production logs show POST /api/whatsapp/messages returning internal_server_error because PostgreSQL raises SQLSTATE 42P10 for ON CONFLICT (organization_id, idempotency_key). Source migration 0004 declares whatsapp_messages_idempotency_uniq as a partial unique index with WHERE idempotency_key IS NOT NULL, while queueWhatsAppOutboundMessage omitted that predicate in its conflict target. Corrected the INSERT conflict target to match the partial index and added a static regression test.
- **Impact:** outbound WhatsApp queueing blocked at database insert.
- **Owner:** FIX-01 for source correction and regression; OPS-01 for deployed database/index confirmation, image rollout and live send verification.
- **Evidence:** Source commit ea8c19cfd9e235319323ed1bb7345e0395f5534e; regression source commit 4243afe7748d43ae371c06315f85d47f249cc814; OPS-01 issue #33. Source inspected; test execution and live runtime verification not performed.
- **Security/reliability:** Preserve organization authorization, connected-account guard, and idempotency semantics. If the partial unique index is absent in production, the SQL correction alone is insufficient; OPS-01 must inspect the exact DB schema.
- **Next:** OPS-01 deploys matching source, confirms the index exists in the web container's DB, then verifies queueing, worker processing, provider result and duplicate-key behavior. Do not claim live send success from container health or HTTP 202 alone.

<!-- Append new events above this marker. -->

### EVT-FIX01-AUTH-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** ROUTE
- **Summary:** Reopened browser login failure: password login succeeds, but the live HTTP deployment returns to `/login?reason=not_provisioned`. Current `main` already contains the prior source corrections for HTTP-aware session-cookie security (`52fb3318...`), full browser navigation after login (`56f9088a...`), and explicit cookie propagation in the protected root layout (`3cd19bdb...`). Source tracing shows `reason=not_provisioned` is emitted only after middleware has accepted an `aca-access-token` and `getAuthenticatedAppContext()` still returns null. The remaining runtime possibilities are an invalid/revoked/expired session, inactive user, missing active organization membership, stale application build, or inconsistent runtime database/environment.
- **Impact:** cross-agent
- **Owner:** OPS-01
- **Suggested next action:** Inspect the actual service at `100.72.192.28:3300`: confirm the running image/commit contains the current auth fixes, confirm web requests use the intended `DATABASE_URL`, and inspect the authenticated account's active `organization_memberships` plus the newly-created `auth_sessions` row. If runtime code is stale, rebuild/restart from current `main`; otherwise correct the concrete runtime state without weakening authentication.
- **Related records:** ISS-007; HOF-FIX01-OPS-AUTH-20261009; auth source files; commits `52fb3318c28f11f3bcc9314c117200f780399e90`, `56f9088a7366ad8e71b66b7c1f2d1671cbeaaa5a`, `3cd19bdb4b6e34fb02e0e8ef93af2ac38af56310`.

### EVT-FIX01-AUTH-20261009-FIX — SOURCE REMEDIATION
- Owner: FIX-01 / Sentinel
- Type: FIX
- Symptom: login API reported success, browser entered protected shell, then returned to `/login?reason=not_provisioned`.
- Root cause: session issuance occurred before application authorization context (active organization membership) was checked.
- Remedy: require an active organization membership before minting the session; return `403 account_not_provisioned` otherwise.
- Prevention: authentication and application provisioning are now enforced at the same login boundary, preventing false-success sessions and the redirect loop.


### EVT-FIX01-MAIL-TENANT-20261009 — SOURCE FIX COMMITTED
- **Owner:** FIX-01 / Sentinel
- **Type:** FIX
- **Symptom:** `POST /api/email-accounts` returned `403 not_member` for the organization ID supplied by the account page.
- **Root cause:** `/mail/accounts` selected the seeded development organization rather than the authenticated user's active organization.
- **Remedy:** Page now derives the tenant from `getAuthenticatedAppContext()`; added static regression coverage. API membership/role enforcement remains unchanged.
- **Commits:** `4536332f` (source), `7a3cfba2` (test).
- **Remaining:** Pull current main, apply pending migration 0024 via `bash scripts/manual-up.sh`, sign in with a fresh session, and retry from the UI. Runtime not yet verified.
- **Related:** ISS-009; NEXT_ACTION.md.


### EVT-DEV01-GMAIL-OAUTH-20261009 — CONFIGURABLE MULTI-CLIENT SOURCE IMPLEMENTATION
- Owner: DEV-01 / Forge (ChatGPT primary implementer)
- Requirement: configure multiple Gmail OAuth client IDs/secrets through Settings, not .env or source constants.
- Remedy: migration 0025; organization-scoped encrypted OAuth config API; Settings management UI; selected-client Gmail start/callback; encrypted per-account client data for worker refresh; static regression tests.
- Security: OAuth client secrets are never returned to the browser. CREDENTIALS_MASTER_KEY remains a server-only root encryption key; Gmail OAuth state no longer requires SESSION_SIGNING_KEY.
- Commits: bf02ac6d, 37518326, 4ad9578c, 78bb9d2c, 6980d091, 5b7ba0bf, e2279785, dd947b50.
- Verification: tests/build/migrations/live OAuth not run. No PASS claimed.
- Related issue: ISS-010; NEXT_ACTION.md.


### EVT-DEV01-GMAIL-OAUTH-SEQUENCE-20261009 — MIGRATION AND EDIT VALIDATION HARDENING
- Owner: DEV-01 / Forge (ChatGPT primary implementer)
- Changes: moved Gmail OAuth configuration migration to 0026 because 0025 is already used by WhatsApp outbound claim lifecycle; removed the duplicate-prefix file; added a regression test for the latest two migration slots; require a matching new secret when a saved Google OAuth client ID changes.
- Commits: migration resequence `90aed0dd`, old-file removal `71c4399d`, migration test correction `b8fcab61`, client ID/secret guard `4a7d9c9f`, test `286d2bea`.
- Validation: source and documentation committed; tests, deployment, migration application and live Google OAuth remain unverified.
- Next action: pull `main`, run `bash scripts/manual-up.sh` to apply 0024–0026, configure the OAuth client in Settings, register the exact callback URI in Google Cloud Console, and test mailbox connection.


### EVT-DEV01-DYNAMIC-OAUTH-ZOHO-20261009 — REQUEST-ORIGIN CALLBACKS AND ZOHO UI
- Owner: DEV-01 / Forge (ChatGPT primary implementer)
- Changes: dynamic callback URI helper; Gmail start/callback uses request-origin callback in signed state; HTTPS and DNS-host checks; organization-scoped Zoho OAuth configuration migration/API/UI; Zoho selector in Mail Accounts; worker token refresh uses per-account saved OAuth credentials.
- Migration: `0027_zoho_oauth_configuration.sql`.
- Regression coverage added/updated: Gmail settings, Zoho settings/callback, and Zoho worker refresh.
- Validation: source reviewed; tests/build/typecheck/runtime not run. No PASS claimed.
- Next: pull main; run manual deploy for migrations 0024–0027; use HTTPS DNS domain and register exact provider callback URIs; verify both providers end-to-end.

- Follow-up hardening: reject all raw IP callback hosts (including HTTPS) and simplify IPv6 hostname normalization. This is source-reviewed only; tests have not been executed.


### EVT-DEV01-MAIL-ROUTING-20261009 — MAIL DEFECTS ROUTED
- **Agent/session:** DEV-01 / Forge — DEV01-DRAFT-SEARCH-20261009
- **Type:** ROUTE
- **Summary:** While adding draft discoverability, source inspection found the Drafts server page still chooses the seeded development organization rather than authenticated request context. The Inbox repository search predicate also appears to interpolate bare parameter indexes for several `ILIKE` terms instead of `$n` placeholders.
- **Impact:** Cross-tenant correctness and inbox search reliability.
- **Owner:** FIX-01 / Sentinel
- **Suggested next action:** Verify both findings against current `main`, correct the minimal source defect(s), and add regression coverage without weakening API authorization.
- **Related records:** `apps/web/src/app/mail/drafts/page.tsx`; `packages/db/src/email/repository.ts`; BKL-008; DEV01-DRAFT-SEARCH-20261009.

### EVT-FIX01-WORKER-CREDENTIALS-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel — FIX01-WORKER-CREDENTIALS-20261009
- **Type:** CORRECTION
- **Summary:** Corrected worker TypeScript build errors by aligning Gmail credential snapshot return type with shared EmailCredentials and converting it to a plain persistence record at the DB boundary. Added focused snapshot contract regression coverage.
- **Impact:** Worker build blocker
- **Owner:** FIX-01
- **Suggested next action:** Execute the focused Gmail adapter test and worker build/typecheck; source commits alone are not a PASS.
- **Related records:** ISS-013; apps/worker/src/email/gmail-adapter.ts; apps/worker/src/email/mailbox-sync-worker.ts; apps/web/tests/gmail-adapter.test.ts; commits caad1d75, 04a2345b, a98c0e7f.


### EVT-FIX01-ZOHO-TEST-NEWLINES-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel — FIX01-ZOHO-TEST-NEWLINES-20261009
- **Type:** CORRECTION
- **Summary:** Fixed a web TypeScript parser failure by replacing literal backslash-n sequences between three assertions in apps/web/tests/zoho-oauth-settings.test.ts with actual source newlines.
- **Root cause:** Malformed test source, not an OAuth runtime defect.
- **Evidence:** User's pnpm typecheck output: packages/shared, packages/db, packages/clara-core, and apps/worker passed; apps/web failed with TS1127/TS1434 at line 84. Fix commit 39857c40820940b500dcf452331dfe82ae35b861.
- **Status:** Source correction committed; post-fix typecheck/test not yet run.
- **Next action:** Re-run `pnpm run typecheck` and focused Zoho OAuth settings test. Route unrelated environment/CI/deploy issues to OPS-01.


### EVT-FIX01-ZOHO-ASSERTIONS-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION
- **Summary:** User reran `pnpm run typecheck` successfully across all workspaces. The focused Zoho OAuth test reported 8 passed and 2 failed because one assertion expected an HTTPS error for an HTTP raw-IP host although the implementation rejects raw IP hosts first, and another assertion rejected the helper's explanatory comment mentioning `NEXT_PUBLIC_APP_URL`.
- **Impact:** Local regression test only; no runtime OAuth behavior changed.
- **Owner:** FIX-01
- **Remedy:** Updated assertions to expect the documented DNS-only/raw-IP rejection and to forbid only `process.env.NEXT_PUBLIC_APP_URL` usage. Commit `c58d6d442767f471c694ef978fdb06eca6d29850`.
- **Verification:** Corrected focused test has not yet been rerun; no test PASS claimed.
- **Next action:** Rerun focused Zoho OAuth settings Vitest and continue independent implementation without waiting for CI/Vercel.
- **Related records:** ISS-014; BKL-010; FIX01-ZOHO-TEST-NEWLINES-20261009.


### EVT-DEV01-LOVABLE-UI-20261009 — 2026-10-09
- **Agent/session:** DEV-01 / Forge — DEV01-LOVABLE-UI-MIGRATION-20261009
- **Type:** REQUIREMENT
- **Summary:** User explicitly authorized migration of the existing application UI to the committed `source/lovable-ui` design, requiring the Lovable visual language, responsive behavior and iconography while preserving existing application functionality and frontend validations. This supersedes the older migration-note default of preserving the previous source UI theme; it does not authorize replacing the application framework or weakening server-side authorization.
- **Impact:** scope
- **Owner:** DEV-01 / Forge
- **Suggested next action:** Continue screen-by-screen adaptation using Lovable tokens/components as visual reference; preserve Next.js app/server contracts and real persisted-data states. Route bugs to FIX-01 and infrastructure issues to OPS-01.
- **Related records:** `source/lovable-ui/src/styles.css`, `source/lovable-ui/src/components/workspace-shell.tsx`, `source/lovable-ui/src/routes/index.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/sidebar.tsx`, `apps/web/src/components/top-bar.tsx`, `apps/web/src/app/page.tsx`.


### EVT-FIX01-SCHEMA-REDIS-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** ROUTE
- **Summary:** User-reported live runtime failures show stale PostgreSQL schema for provider settings and mailbox sync, plus Redis lease command rejection. Added forward migration `0029`, surfaced bounded Redis server error details, and added regression source.
- **Impact:** cross-agent
- **Owner:** OPS-01 for production migration/container rollout and Redis configuration; FIX-01 for source defects exposed by runtime evidence.
- **Suggested next action:** Apply migrations through `0029` to the exact database used by both containers, roll out matching images, and inspect the specific Redis response. Preserve fail-closed locking.
- **Related records:** ISS-015; BKL-011; commits `a4fab9df07deafa5fd47879217616e3cb6d1c03f`, `71616ac887f3efb79f90039245d6064c4662a77c`, `0fa3e751cae2e5105b212083e93a7cc87bf00468`.


### EVT-FIX01-SCHEMA-REDIS-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** ROUTE
- **Summary:** User-reported live runtime failures show stale PostgreSQL schema for provider settings and mailbox sync, plus Redis lease command rejection. Added forward migration `0029`, surfaced bounded Redis error details, and added regression source.
- **Impact:** cross-agent
- **Owner:** OPS-01 for production migration/container rollout and Redis configuration; FIX-01 for source defects exposed by runtime evidence.
- **Suggested next action:** Apply migrations through `0029` to the exact database used by both containers, roll out matching images, and inspect the specific Redis response. Preserve fail-closed locking.
- **Related records:** ISS-015; BKL-011; commits `a4fab9df07deafa5fd47879217616e3cb6d1c03f`, `71616ac887f3efb79f90039245d6064c4662a77c`, `0fa3e751cae2e5105b212083e93a7cc87bf00468`.

### EVT-DEV01-APPROVALS-TENANT-20261009 — 2026-10-09
- **Agent/session:** DEV-01 / Forge — DEV01-LOVABLE-UI-MIGRATION-20261009
- **Type:** ROUTE
- **Summary:** During UI route inventory, DEV-01 found that `apps/web/src/app/mail/approvals/page.tsx` selects `getDevOrgId()` after `ensureDevSeed()`, unlike the authenticated organization context used by the Inbox, Drafts and Compose pages. This may show the wrong approval scope and violates the established rule that tenant-scoped pages derive organization identity from the authenticated request.
- **Impact:** Cross-tenant correctness/security; not modified in this UI session.
- **Owner:** FIX-01 / Sentinel
- **Suggested next action:** Verify the defect, change only the server-side organization resolution, preserve authorization checks, and add focused regression coverage.
- **Related records:** BKL-012; `apps/web/src/app/mail/approvals/page.tsx`.


### EVT-DEV01-WHATSAPP-CONNECT-20261009 — 2026-10-09
- Agent/session: DEV-01 / Forge — DEV01-WHATSAPP-CONNECT-20261009
- Type: IMPLEMENTATION
- Summary: Connected the WhatsApp route to its existing real client using authenticated organization context; the previously inert Connect WhatsApp Business button now opens the encrypted Meta Cloud API credential workflow.
- Impact: Restores user-visible connection workflow continuity without inventing new APIs or falsely reporting verified status.
- Source commits: 58ba5541, 94878571, 49c94de3, 2cbe4ab9, 9eb3a168.
- Verification: NOT RUN — tests/typecheck/build/browser/Meta/webhook/live messaging not executed.
- Next: Knowledge UI with real org-scoped persisted state, then remaining route migration. OPS-01 retains live database/Redis remediation; FIX-01 retains unrelated substantial bugs.
- Session record: docs/project-control/sessions/DEV01-WHATSAPP-CONNECT-20261009.md.


### EVT-CHATGPT-APPROVALS-TENANT-FIX-20261009 — 2026-10-09
- Agent/session: ChatGPT cross-route review continuation.
- Type: SECURITY / ROUTE CORRECTION
- Summary: Mail Approvals server page no longer selects the seeded development organization; it resolves the authenticated active organization from request headers and redirects unauthenticated requests to login. Existing API authorization is unchanged.
- Source commit: 19b8c0fd. Regression assertion update: da2502bd.
- Verification: NOT RUN — no tests, typecheck, build, browser or live multi-tenant acceptance executed.
- Next: continue cross-route responsive/accessibility review and retain runtime tenant verification as pending.

### EVT-FIX01-PNPM-LOCKFILE-REGRESSION-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel — FIX01-PNPM-LOCKFILE-REGRESSION-20261009
- **Type:** CORRECTION
- **Summary:** Recovered the repeated `amqplib@2.2.0` lockfile failure. The original source correction is already on current main; added static regression coverage for one lockfile document and worker package/snapshot records.
- **Root cause:** Concatenated YAML lockfile documents and missing worker dependency resolution/snapshot entries at the user's reported revision. `pnpm install --fix-lockfile` repeated the same missing-dependency error.
- **Impact:** Workspace install/typecheck and Docker builds blocked before compilation.
- **Owner:** FIX-01 for lockfile source and regression protection; OPS-01 only for separate Docker host/build environment issues after lockfile validation.
- **Commits:** `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e` (lockfile repair); `b9ba0c6738e32cf4ef8b670a4b65857a56eb50f2` (regression source).
- **Verification:** Static source inspected; frozen install, test, typecheck and Docker build not run after fix. No PASS claimed.
- **Next action:** Pull latest main and run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`; route host/build-environment failures to OPS-01.

### EVT-FIX01-PNPM-TARBALL-INTEGRITY-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel — FIX01-PNPM-TARBALL-INTEGRITY-20261009
- **Type:** CORRECTION
- **Summary:** Follow-up to ISS-017. User's frozen install exposed a second lockfile defect: amqplib's package record lacked tarball integrity metadata.
- **Root cause:** Prior fix restored package/snapshot records but used a tarball URL without the published SHA-512 SRI, so pnpm's supply-chain policy correctly refused installation.
- **Remedy:** Added the published integrity value to `pnpm-lock.yaml` (commit `644d5781`); added a focused integrity assertion in the existing lockfile regression test (commits `21837f32`, `d115e1b0`).
- **Verification:** GitHub source changes committed; no post-fix install/test/typecheck/build run. No PASS claimed.
- **Next action:** User pulls latest main and runs frozen install, then typecheck and focused Vitest. OPS-01 owns only independent infrastructure defects.

### EVT-FIX01-LOCKFILE-TEST-REGEX-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** TEST CORRECTION
- **Summary:** Source review found over-escaped regex tokens in the newly added pnpm lockfile regression assertions. Corrected them to match actual TypeScript regex semantics and scope integrity validation to the amqplib entry.
- **Commit:** `162183e8d7c67b8346c15989ef850327e487cfc4`.
- **Verification:** Source reviewed only; focused Vitest remains NOT RUN pending successful dependency installation.

### EVT-FIX01-WORKER-MIGRATION-PATHS-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION
- **Summary:** User's latest run confirms frozen install succeeds. Fixed the captured optional RabbitMQ URL type and aligned migration test paths with canonical renumbered SQL files (0013_database_security_hardening.sql, 0005_agent_policy_configuration.sql).
- **Impact:** local
- **Owner:** FIX-01
- **Remedy commits:** 09e4df46 (worker source), a24edec3 (worker contract test), ffc98b30 (migration test paths).
- **Verification:** User's pre-fix install PASS; pre-fix typecheck/test failures captured. Post-fix tests/typecheck NOT RUN; no PASS claimed.
- **Suggested next action:** Run focused migration Vitest and worker RabbitMQ test; run web and worker typechecks sequentially, then full workspace typecheck if resources permit.
- **Related records:** ISS-018; BKL-015; FIX01-WORKER-TYPECHECK-MIGRATION-PATHS-20261009.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


### EVT-FIX01-WEB-TYPECHECK-UI-DEPENDENCY-FOCUS-TEST-20261009 — 2026-10-09
- Agent/session: FIX-01 / Sentinel.
- Type: CORRECTION.
- Summary: Declared the missing Lucide runtime dependency and lockfile records, corrected strict focus-trap element typing after the empty-array guard, and defined the missing new-agent source binding in the static UI migration test.
- Commits: 8f09785a, 7b1136e6, 3e35c1f5, a9dcb8e5, 52a4e348.
- Verification: source changes only. Install, tests and typechecks pending; no PASS claimed.
- Next action: frozen install, focused tests, then sequential web/worker typechecks. Do not wait for CI/Vercel.


### EVT-FIX01-MIGRATION-WORKER-TEST-DRIFT-20261009 — 2026-10-09
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION
- **Summary:** Corrected migration and worker contract-test drift. Added forward-only audit-event access hardening because the base migration artifact lacked the expected organization-scoped audit read/insert policies; corrected delimiter assertions to accept valid PostgreSQL dollar-quoting; changed worker assertions to test preserved envelope fields via spread and detect actual vector-client use rather than a comment.
- **Impact:** cross-agent
- **Owner:** FIX-01
- **Commits:** 7557a6cd, ee85b554, cecae73e, c4d4abd0, 96996d82.
- **Verification:** Source re-fetched after commits; focused tests/typechecks/migration execution NOT RUN. No PASS claimed.
- **Next action:** Pull latest main, reconcile local lockfile against origin/main, run focused web migration and worker RabbitMQ tests, then web/worker typechecks sequentially.
- **Related records:** ISS-019; FIX01-MIGRATION-WORKER-TEST-DRIFT-20261009; migration 0032.


### EVT-FIX01-AUTH-ROLE-RANK-20261010 — 2026-10-10
- **Agent/session:** FIX-01 / Sentinel — FIX01-AUTH-ROLE-RANK-20261010
- **Type:** CORRECTION
- **Summary:** Corrected a web production-build TypeScript error in the exhaustive membership-role rank map and added RBAC regression coverage.
- **Root cause:** `MembershipRole` includes `viewer`, but the rank map omitted it.
- **Impact:** local — web image build blocked at Next.js type validation after compilation succeeded.
- **Owner:** FIX-01 for source and RBAC regression; OPS-01 only for independent Docker/runtime/environment defects.
- **Commits:** `44a08522f23e807755114ebe46b8b1e04e6056da`; `3853ecf046c175e15a4f824e9679f50fb7132cf9`.
- **Verification:** Source changes committed; focused test/typecheck/build NOT RUN after fix. No PASS claimed.
- **Next action:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/rbac.test.ts` and `pnpm --filter @ai-comms-agent/web typecheck`; route infrastructure/build environment issues to OPS-01.


### EVT-FIX01-RBAC-TEST-FIXTURE-FOLLOWUP-20261010 — 2026-10-10
- **Agent/session:** FIX-01 / Sentinel
- **Type:** REGRESSION_TEST_CORRECTION
- **Summary:** User executed the focused RBAC suite after the role-rank fix and exposed a bug in the newly added test: it referenced nonexistent `fixture.adminA`.
- **Evidence:** User output: 15 tests passed, 1 failed with `UnauthorizedError: Authentication required`; typecheck reported TS2339 for `TestFixture.adminA`.
- **Root cause:** Undefined test fixture user caused auth failure before role ranking was exercised.
- **Remedy:** Commit `113b2b3ee094042e9380404f3073c39b17e07951` promotes the existing `memberA` to admin using the fixture repository, then tests admin and owner.
- **Verification:** Corrected source re-fetch/commit only. Retest, typecheck and Docker build remain pending. No PASS claimed.
- **Next action:** Focused RBAC Vitest → web typecheck → manual-up. Preserve local modified lockfile; OPS-01 only for independent environment defects.


### EVT-FIX01-EMAIL-ACCOUNT-RUNTIME-DIAGNOSTICS-20261010 — 2026-10-10
- **Agent/session:** FIX-01 / Sentinel
- **Type:** BLOCKER
- **Summary:** User's application starts after Docker build/migrations but IMAP/SMTP configuration returns 502 and OAuth mailboxes do not sync. Source inspection distinguishes an application-generated provider connection 502 from a Cloudflare/upstream 502 and confirms the manual-sync endpoint is Gmail-only while the periodic worker scans Gmail, Zoho, and IMAP-SMTP.
- **Impact:** Core mailbox connection and ingestion are unverified in production.
- **Owner:** FIX-01 for source defects; OPS-01 for confirmed environment/network/runtime issues.
- **Suggested next action:** Run `scripts/diagnose-email-accounts.sh` on the server and review public/local responses, sync DB state, message counts, and sanitized worker logs.
- **Related records:** ISS-024; `scripts/diagnose-email-accounts.sh`; commit `a529ffe43915495d099c17b353fb517d53fac10b`.


### EVT-FIX01-WORKSPACE-TEST-COMMAND-MISMATCH-20261010 — 2026-10-10
- **Agent/session:** FIX-01 / Sentinel
- **Type:** VERIFICATION BLOCKER
- **Evidence:** User ran `npm test -- src/modules/integrations/oauth-app-validation.test.ts src/modules/integrations/oauth-setup-guides.test.ts` from the `ai-comms-agent` root after pulling `main` from `6d935ab` to `f938fd3`.
- **Root cause:** Those requested paths belong to the separate Clara AI Platform workstream and are not paths in this monorepo. Root `npm test` executes `pnpm -r test`, which forwards the arguments into every workspace package rather than targeting the intended Clara repo tests. The web Vitest include is `tests/**/*.test.ts`; therefore it reported no tests found. The worker process was then killed with `SIGKILL`; the provided output does not establish an assertion failure or its cause.
- **Failed approach:** Running Clara-specific test paths through the ai-comms-agent recursive root script. Do not copy Clara OAuth files into this repo merely to make this command pass.
- **Remedy:** Use workspace-relative test paths in this repo, e.g. `pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts` and `pnpm --filter @ai-comms-agent/worker exec node --import tsx --test tests/email-sync-rabbitmq.test.ts`. Run one workspace at a time to isolate resource kills.
- **Next action precedence:** The active email runtime issue still requires `bash scripts/diagnose-email-accounts.sh` from repository root and review of its sanitized report. This test-command mismatch does not diagnose the IMAP/SMTP 502 or OAuth mailbox import issue.
- **Verification:** User's output confirms the web no-tests-found condition and worker SIGKILL. Corrected commands and live diagnostics have not yet been run. No test PASS claimed.

### EVT-OPS01-OAUTH-SYNC-RUNTIME-20261010
- **Owner:** OPS-01
- **Type:** RUNTIME BLOCKER
- **Summary:** User-provided sanitized diagnostic confirms queued Gmail sync is not processed: account stays pending/idle with zero stored messages; worker RabbitMQ URL exposes literal placeholder vhost `YOUR_EXISTING_VHOST`; Redis lease authentication returns `WRONGPASS`.
- **Action:** Correct deployed RabbitMQ and Redis URLs/credentials/ACL/vhost/TLS settings, recreate worker, requeue sync, and verify persisted message count. Never bypass distributed lease coordination.
- **Verification:** Live ingestion not yet verified; HTTP 200 health and HTTP 202 queue acceptance are insufficient.

### EVT-DEV01-EMAIL-OPS-PLAN-20261012
- **Agent/session:** DEV-01 / Forge — `DEV01-EMAIL-OPS-PLAN-20261012`
- **Type:** PLAN_PREPARED / ARCHITECT_REVIEW_REQUIRED
- **Summary:** Prepared a phased email operations plan covering provider sync reconciliation, MIME parsing, truthful capability matrix, drafts/send safety, host-owned email tools, execution-time authorization across channels, indexing and recovery.
- **Plan:** `docs/plans/EMAIL-OPS-01-IMPLEMENTATION-PLAN.md`
- **Authorization boundary:** Current user request authorizes research/planning. New tool contracts, schema changes, OAuth scope changes, provider dependency decisions and policy changes are proposed only; do not silently implement them.
- **Verification:** GitHub source inspection and docs writes only; no runtime/test/build evidence.
- **Blockers/owners:** OPS-01 owns RabbitMQ/Redis/runtime ingestion; FIX-01 owns substantial source bugs and regression remediation.
- **Next action:** Owner/architect reviews plan and authorizes/corrects E1 + E3 before material implementation.


### EVT-DEV01-EMAIL-OPS-IMPLEMENT-20261013
- **Agent/session:** DEV-01 / Forge — `DEV01-EMAIL-OPS-IMPLEMENT-20261013`
- **Type:** LESSON
- **Summary:** Gmail history paging and deletion reconciliation now have source changes and regression coverage. Shared email tool descriptors and capability filtering are in place; descriptors are not executable handlers.
- **Owner:** DEV-01 for host runtime/tool work; FIX-01 for substantial bugs; OPS-01 for runtime/deployment.
- **Next:** Implement read-only host handlers with execution-time tenant authorization and audit before exposing catalogue entries.


### EVT-FIX01-WORKER-CREDENTIAL-TYPE-20261016 — 2026-10-16
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION
- **Summary:** User's clean Docker build failed worker TypeScript compilation because Gmail watch renewal and IMAP IDLE startup asserted generic decrypted credential records directly as `EmailCredentials`, which requires `credential_type`. Both paths now validate the supported discriminant and avoid unsafe assertions.
- **Impact:** local
- **Owner:** FIX-01
- **Suggested next action:** Run worker typecheck/build and targeted tests on the deployment host; report any remaining Docker build or runtime issue to the correct owner.
- **Related records:** `docs/project-control/agents/FIX-01/WORKLOG.md`, `docs/project-control/agents/FIX-01/MEMORY.md`, commits `185b729d`, `60fadabf`, `e3ba38c9`, `18948e08`


### EVT-DEV01-EMAIL-RAG-REVIEW-20261016 — 2026-10-16
- **Agent:** DEV-01 / Forge
- **Type:** architecture_review / product_gap
- **Summary:** Reviewed main-source email indexing and retrieval before changing product code. Recommended hybrid PostgreSQL + Qdrant: PostgreSQL remains authoritative for exact/time/structured queries; Qdrant supplies semantically relevant chunk candidates; every result must be revalidated against current org/agent/account authorization and authoritative SQL rows.
- **Evidence:** `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`, commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`.
- **Findings:** Existing email chunks are written to PostgreSQL; no concrete supported Clara email-vector adapter is bound; vector-sync loop is not started from worker entrypoint; current local retrieval uses SQL/tsvector/ILIKE; Chat context path samples up to 20 organization emails without active-agent account binding.
- **Routing:** ISS-026 remains FIX-01-owned. OPS-01 owns live infrastructure and ingestion/latency acceptance. DEV-01 did not modify product code or take over either role.
- **Verification:** No tests/typechecks/build/live vector/provider/latency tests run. No 10x speed claim made.
- **Next:** Obtain architecture review/correction, resolve the supported Clara adapter contract and FIX-01 security dependency, then implement the authorized retrieval path.


### EVT-DEV01-EMAIL-RAG-ADAPTER-INVESTIGATION-20261016 — 2026-10-16
- **Type:** adapter_contract_blocker
- **Finding:** Current Clara source exposes internal KB-scoped Qdrant module functions and a KB-scoped search route, but no supported server-to-server email-vector API. The existing upsert's random point IDs/KB payload model does not satisfy deterministic account-scoped outbox lifecycle needs.
- **Action:** Updated the email RAG plan with source evidence at commit `0994cdd0a9388ee10b57ebc759d05a2eb4117f20`. No app code or Clara source was changed.
- **Security:** ISS-026 remains open and FIX-01-owned; no vector retrieval exposed.
- **Next:** Establish/implement an authenticated Clara email-vector API contract; after ISS-026 closure bind the adapter and worker loop. OPS-01 validates live infrastructure and latency.


### EVT-FIX01-MICROSOFT-GRAPH-ENUM-20261016
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION / SCHEMA_COMPATIBILITY
- **Summary:** Added migration 0034 to extend the actual email_provider enum with microsoft_graph; added static regression protection. Root cause was the provider label existing only in a separate email_account_provider enum.
- **Impact:** Source correction committed; runtime remains unverified.
- **Evidence:** Migration commit 83d512d5815bf7626a6b0d824a5ce92fedfa2189; regression test commit 988d78effcfa65fc9521eeb17a3c371d89173d69.
- **Next:** OPS-01 applies migration and verifies worker poll/retry errors stop and mailbox rows persist.

- EVT-FIX01-VOICE-WEBRTC-20261016: Implemented host-authorized OpenAI WebRTC negotiation and Clara-style voice workspace on `fix/voice-transport-contract`; added organization-scoped credential resolution, microphone/audio/data-channel lifecycle, final transcript bridge through the host turn route, spoken response, mute/interrupt/end and readiness timeout. Native WebRTC for Gemini/Sarvam/ElevenLabs and full authorized email action/tool integration remain outstanding. Tests/typecheck/build/browser/provider/deployment not run; PR #27 open and issue #26 remains open.

- EVT-FIX01-VOICE-EMAIL-RUNTIME-20261016: Added Gemini Live ephemeral-token transport and provider-backed Sarvam/ElevenLabs utterance pipelines; extracted `@ai-comms-agent/email-agent-runtime` for web/worker reuse; voice now uses the same bounded, allowlisted, audited email tool loop; safe draft/mailbox handlers plus pending-approval requests for send/reply/forward; voice UI shows approval IDs. Persistent Sarvam/ElevenLabs WebSocket relays and runtime verification remain outstanding.

- EVT-FIX01-VOICE-RELAY-SOURCE-20261016: Added isolated provider WebSocket relay source and client adapters for Sarvam STT/TTS and ElevenLabs Scribe/TTS, with HMAC bootstrap, short-lived session token, origin allowlist and usage telemetry. Shared email runtime is wired into voice; send/reply/forward remain explicit approval requests. Relay deployment and runtime verification remain outstanding.

- EVT-FIX01-VOICE-PR-CONTINUATION-20261016: PR #27 merged only its earlier partial commit; the subsequent multi-provider relay and shared email runtime work is in draft PR #28. Issue #26 remains open pending deployment, provider-backed missing actions and runtime evidence.

### EVT-FIX01-WHATSAPP-PENDING-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel
- **Type:** CORRECTION / ROUTE
- **Summary:** Investigated user report that deployed WhatsApp account remains pending and outbound POST returns `provider_not_connected`. Current main source already saves credentials encrypted, calls Meta Graph API for the phone-number resource, persists `connected` on success or `error` on provider rejection, and intentionally gates outbound queueing on persisted connected status. UI already has account edit state, saved-token preservation, verification retry, Meta test-phone shortcut, and a test action positioned later in setup guidance. The deployed cause is not provable from source alone: deployment drift, database/status persistence mismatch, or a real Meta token/permission/phone-number-ID issue remain possible.
- **Impact:** cross-agent
- **Owner:** OPS-01 for deployed commit/database/provider evidence; FIX-01 for any proven source defect and regression protection.
- **Evidence:** Source inspection of `apps/web/src/app/api/whatsapp/accounts/route.ts`, `apps/web/src/app/api/whatsapp/messages/route.ts`, `apps/web/src/app/whatsapp/whatsapp-client.tsx`; commits `e606c914bf23b63afe69c6bdea9ed1f3cb01533b`, `d55a3b14adcc594e128348df80d81ac95c614ad2`, `82d22e52904cbc6fda8e84be0437cc1079e1f07f`, `64afd328c4ea429a6175ab296d9d208b9b9190c1`, `dfd65f3855c77cee2958af332f5bf9a3493887de`. OPS-01 issue: https://github.com/Rilan-Dev/ai-comms-agent/issues/32. Investigation record: `docs/project-control/sessions/FIX01-WHATSAPP-PENDING-20261017.md`.
- **Security:** Do not bypass the connected-state guard or disable webhook challenge verification. The user-provided cookie-like token is exposed and should be revoked/rotated; never reproduce it.
- **Verification:** Source inspection only. No tests, live Meta API request, deployed commit inspection, database/log access, browser E2E, or deployment check performed. No runtime PASS claimed.
- **Next:** OPS-01 identifies the serving commit, verifies the correct organization/account row and status persistence, and records redacted Meta error details. FIX-01 makes the smallest source correction and targeted regression test only if evidence proves a source defect.


### EVT-FIX01-WHATSAPP-131047-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel — WhatsApp provider rejection
- **Type:** DIAGNOSIS / ROUTE
- **Summary:** User-supplied Meta webhook reports outbound message failed with code 131047; details explicitly say more than 24 hours elapsed since customer last replied. This is a provider policy rejection of free-form text, not a queue insertion defect.
- **Related source:** `apps/worker/src/messaging/whatsapp-worker.ts`, `apps/web/src/app/api/whatsapp/webhook/route.ts`, `packages/db/src/messaging/whatsapp-repository.ts`.
- **Recent commits reviewed:** `ea8c19cfd9e235319323ed1bb7345e0395f5534e` and `4243afe7748d43ae371c06315f85d47f249cc814` fix the separate 42P10 idempotency conflict-target issue; they do not fix 131047.
- **Remedy:** Use an approved template outside the 24-hour window, or send free-form text while the window is active. No source policy bypass authorized.
- **Follow-up:** UI showed “sent” despite a supplied failed status payload. Live webhook-to-row-to-UI propagation is not proven; OPS-01 must inspect deployed revision, webhook delivery/response, scoped DB status/error, and provider message ID. FIX-01 adds regression coverage once the mismatch is isolated.
- **Verification:** Source inspection and user-supplied payload only. No tests or live runtime checks executed. No delivery PASS claimed.
- **Security:** User-provided cookie-like access token must be revoked/rotated; never record the value.
- **Session:** `docs/project-control/sessions/FIX01-WHATSAPP-131047-20261017.md`

### EVT-FIX01-WHATSAPP-LABEL-STATUS-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel
- **Type:** SOURCE CORRECTION / OPS ROUTE
- **Summary:** Fixed the WhatsApp account label overwrite: after Graph API verification, Meta's `verified_name` was overwriting the user's custom `display_name`. Main now preserves the custom label and uses Meta's name only as a fallback. Added a focused static regression test.
- **Commits:** source `fd1fda7429363091098825dbf37bba0f30be3d0f`; regression test `79f0e6a12511afaa07249005d24e6e50fc3c7d2b`; investigation record `86e4627b15a8c21d36a1035856d6fc0a66c32580`.
- **Status discrepancy:** Last observed production revision was `0e355bc75df6ab6c41ac619050be561faeb7c3e7` (deployment `dpl_5zjzPd6V3uBGuMK2LppXqsRTkirK`). Historical runtime logs are unavailable beyond Vercel Hobby retention; available grouped errors are older account-save DB constraints and do not identify the exact message. Live row and webhook response could not be accessed, so no source cause for the `sent` vs `failed` mismatch is asserted.
- **Owner:** OPS-01 for deployed revision, redacted webhook delivery/HTTP response/accepted count, exact scoped row and UI comparison. FIX-01 resumes only if evidence isolates a source defect.
- **Verification:** Regression test authored, not run. Post-fix deployment not confirmed. No live status PASS claimed.
- **Session:** `docs/project-control/sessions/FIX01-WHATSAPP-DISPLAY-STATUS-20261017.md`.

### EVT-FIX01-WHATSAPP-LABEL-SECOND-CALLSITE-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel
- **Type:** SOURCE CORRECTION / REGRESSION
- **Summary:** Follow-up inspection found the worker's pending-account verifier also wrote Meta's `verified_name` over the app's custom display label. Updated it to preserve `account.display_name` first and expanded the regression test to cover both the API and worker paths.
- **Commits:** worker `7d785b36f2bae90d9d137805e1390fe9ab467550`; updated test `f9bc5ec1cc793fb69c3b2a5a7d26e8d1cf00d5fb`.
- **Verification:** Test authored but not run; deployment not confirmed.

### EVT-FIX01-CHAT-PROVIDER-OVERRIDE-20261017 — 2026-10-17
- **Agent/session:** FIX-01 / Sentinel
- **Type:** SOURCE DEFECT / OPS VERIFICATION
- **Symptom:** Chat API reports missing OpenAI key although the agent's saved chat override is Sarvam; web container logs repeat the same error.
- **Root cause:** In `packages/clara-core/src/runtime.ts`, `organizationAIConfig` returned null before querying agent overrides whenever `organization_ai_runtime_settings` had no row. Runtime then fell back to environment selection (OpenAI by default), bypassing saved agent override/provider credentials.
- **Remedy:** Use safe defaults when the organization defaults row is absent so per-agent settings and provider config resolution still execute. Source commit `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`. Static regression test `apps/web/tests/clara-agent-provider-resolution.test.ts` commits `d9e6c619320390c5290c04d29d30187a6838736f` and `c0e0a31e788ecd24e6af89f42e4f67f5100b7c73`.
- **Evidence limit:** The source branch is confirmed; the exact live database condition is not. OPS-01 must check whether the organization-default row exists and confirm deployed revision/config rows. Tests/build/deployment not verified.
- **Owner next:** OPS-01 for container/deployment/database/runtime verification; FIX-01 resumes if a source defect remains after the patched revision is serving.
- **Session:** `docs/project-control/sessions/FIX01-CHAT-PROVIDER-OVERRIDE-20261017.md`.


### EVT-FIX01-CHAT-MEMBERSHIP-NULL-20261018
- **Agent/session:** FIX-01 / Sentinel; `FIX01-CHAT-MEMBERSHIP-NULL-20261018`
- **Type:** SOURCE DEFECT / TYPECHECK FAILURE
- **Symptom:** Docker web build failed after successful Next.js compilation at `apps/web/src/app/api/chat/stream/route.ts:384`, TS nullable access `subject.membership.role`.
- **Root cause:** Shared `AuthSubject` exposes nullable membership although the successful `authorize()` path guarantees active membership. Call-site type was not narrowed.
- **Remedy:** Explicit fail-closed 403 guard immediately after `authorize()`; regression source assertion verifies the guard precedes trusted tool-context creation. Commits: `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`, `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`.
- **Failed approaches avoided:** No default role, null assertion, auth weakening, or broad type redesign. Source issue is not an OPS-01 infrastructure defect.
- **Verification:** User log shows worker image built; web compilation succeeded but typecheck failed before the patch. Post-patch build/test pending.
- **Separate environment note:** Native host shell returned `pnpm: command not found`; Docker build environment has Corepack/pnpm and built the worker. Route host toolchain availability to OPS-01 if native commands are required.
- **Next:** Pull latest main and rebuild Docker web/worker. Keep runtime PASS unclaimed until build and focused regression test are actually run.


### EVT-FIX01-WHATSAPP-TEMPLATE-ROW-20261018
- **Agent/session:** FIX-01 / Sentinel; `FIX01-WHATSAPP-TEMPLATE-ROW-20261018`
- **Type:** SOURCE DEFECT / TYPECHECK FAILURE
- **Symptom:** Docker web build's Next.js compile passed, then TS18048 failed at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119` because `synced.rows[0]` may be undefined.
- **Root cause:** The `rows.length` check does not narrow indexed array access.
- **Remedy:** Local row binding + explicit fail-closed 409 guard, then safe component access. Added source regression assertion. Commits `90fac5e0774b695446e1e0c3ab51072639ba5f06`, `41734923651b1173a703d747f0ac0aa93317a5b9`.
- **Failed approaches avoided:** No non-null assertion, cast, compiler relaxation, or template policy change.
- **Verification:** Source committed; post-fix build/test pending. Worker build and pre-fix web failure are user-provided evidence.
- **Next:** Rebuild latest main and run the focused WhatsApp approval test; update state from actual output.
