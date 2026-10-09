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
