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
