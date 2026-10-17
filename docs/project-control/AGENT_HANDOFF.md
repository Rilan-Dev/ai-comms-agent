# APCP Central Agent Handoffs

Cross-agent handoff register. A handoff transfers context, not authority.

## Required fields

### <HANDOFF-ID> — <YYYY-MM-DD>
- **From:** <agent id / session id>
- **To:** <agent id>
- **Reason:** <why another role is needed>
- **Repository state:** <commit/ref>
- **Work completed:** <summary>
- **Remaining work:** <exact task>
- **Evidence/records:** <paths, issue/event ids>
- **Authorization:** <existing authorization reference or "not authorized; proposal only">
- **Stop condition:** <when receiving agent must stop>
- **Status:** <OPEN | ACCEPTED | COMPLETE | SUPERSEDED>

## Rules

- Never invent authority through a handoff.
- The receiving agent must independently recover current authorization.
- A handoff can be accepted while the sending agent continues unrelated independent work.
- Close or supersede stale handoffs when state changes materially.

### HOF-FIX01-OPS-AUTH-20261009 — 2026-10-09
- **From:** FIX-01 / Sentinel
- **To:** OPS-01
- **Reason:** The reported login loop remains on the live self-hosted HTTP runtime after the source-level authentication corrections are already present on `main`.
- **Repository state:** `main` at `2ab9c66640cc5132bc7f7686d0f008015b79620d`
- **Work completed:** Recovered project-control state and traced middleware → login POST → session cookie → root layout → application identity context. Current source already reads the cookie explicitly and uses PostgreSQL-backed session resolution.
- **Remaining work:** On `100.72.192.28:3300`, identify whether the running build is stale or whether session/account/membership/database configuration differs from the successful login request. Apply the smallest runtime correction and preserve fail-closed auth.
- **Evidence/records:** ISS-007; EVT-FIX01-AUTH-20261009; `apps/web/src/app/layout.tsx`; `apps/web/src/app/login/page.tsx`; `apps/web/src/lib/identity/repository.ts`; `apps/web/src/lib/identity/local-auth.ts`.
- **Authorization:** User's explicit FIX-01 bug-remediation request authorizes diagnosis/correction of this incident; OPS-01 must independently confirm runtime/deployment scope before changing infrastructure.
- **Stop condition:** Stop after the live runtime cause is corrected or a concrete missing external dependency/configuration is identified and recorded; do not weaken auth or expand product scope.
- **Status:** OPEN

### HOF-FIX01-AUTH-FIX-20261009
- From: FIX-01 / Sentinel
- To: OPS-01 / runtime verification as needed
- State: SOURCE FIX COMMITTED
- Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`
- Change: require an active organization membership before creating a login session; return explicit 403 for unprovisioned accounts; add regression protection.
- Remaining runtime action: deploy/restart the commit in the affected environment and verify a provisioned account reaches the application shell. Do not wait for CI/Vercel; runtime verification remains OPS-01 scope.


### HOF-FIX01-WHATSAPP-STATUS-20261017
- **From:** FIX-01 / Sentinel
- **To:** OPS-01 / live runtime investigation
- **State:** OPEN — runtime evidence required
- **Symptom:** Meta webhook payload for the attempted outbound message reports `failed`, error 131047 (24-hour customer-service window expired), while the conversation UI displayed `sent`.
- **Confirmed provider cause:** free-form text is not permitted outside the 24-hour window; use an approved template or wait for a customer reply. No source policy bypass is authorized.
- **OPS-01 action:** Identify serving commit; inspect redacted webhook HTTP status/body and accepted count; trace exact provider message ID in the organization/account-scoped row including status/provider_error; verify UI refresh/state mapping. Do not expose tokens or message secrets in logs.
- **FIX-01 boundary:** After runtime evidence isolates a source defect, add the smallest status-persistence/UI correction and regression test. Do not claim live delivery based on queue acknowledgement.
- **Evidence record:** `docs/project-control/sessions/FIX01-WHATSAPP-131047-20261017.md`.

### HOF-FIX01-OPS-WHATSAPP-DISPLAY-STATUS-20261017
- **From:** FIX-01 / Sentinel
- **To:** OPS-01 / Shipwright
- **Reason:** Continue live runtime investigation of WhatsApp provider status mismatch; confirm the custom display-name fix reaches the serving revision.
- **Repository state:** `main`; source fix `fd1fda7429363091098825dbf37bba0f30be3d0f`; regression test `79f0e6a12511afaa07249005d24e6e50fc3c7d2b`. Last observed pre-fix production deployment `dpl_5zjzPd6V3uBGuMK2LppXqsRTkirK` served `0e355bc75df6ab6c41ac619050be561faeb7c3e7`.
- **Work completed:** Identified and corrected the display-name overwrite: account verification was persisting Meta's `verified_name` over the user-entered label. Added a static regression test. Inspected the provider-status webhook and scoped DB update contract. Vercel's available runtime-error summary only exposed older Oct 10–11 DB constraint failures; runtime logs for the relevant historic window are not retained, and the exact live DB row was not accessible.
- **Remaining work:** Confirm current deployed revision. For the exact failed provider message ID supplied in the original incident, inspect redacted Meta webhook delivery details and server request record; record HTTP status/body and `accepted` count. Query only the relevant organization/account row and compare provider message ID, status, provider error, and updated_at with the API GET response and UI. Correct deployment/database/environment only if evidence establishes that cause. If the row is failed but the UI renders sent, hand the isolated source defect to FIX-01.
- **Evidence/records:** `docs/project-control/sessions/FIX01-WHATSAPP-DISPLAY-STATUS-20261017.md`; `apps/web/src/app/api/whatsapp/accounts/route.ts`; `apps/web/src/app/api/whatsapp/webhook/route.ts`; `packages/db/src/messaging/whatsapp-repository.ts`; test `apps/web/tests/whatsapp-account-display-name.test.ts`.
- **Authorization:** Existing user request authorizes diagnosis and smallest corrective fix. OPS-01 must confirm its deployment/infrastructure scope before changing runtime or database configuration.
- **Stop condition:** Stop when serving revision and row/webhook/UI status are reconciled, or record the precise external access/retention blocker. Never expose tokens or cross-tenant rows; do not weaken HMAC or tenant scoping.
- **Status:** OPEN
