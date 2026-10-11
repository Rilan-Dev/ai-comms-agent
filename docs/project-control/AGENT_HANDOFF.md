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
