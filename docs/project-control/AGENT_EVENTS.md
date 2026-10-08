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
