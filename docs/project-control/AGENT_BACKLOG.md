# APCP Central Agent Backlog

Cross-agent coordination backlog. This records ownership and dependencies; it does not authorize implementation.

## Entry format

### <BACKLOG-ID> — <YYYY-MM-DD>
- **Work:** <task>
- **Owner:** <DEV-01 | FIX-01 | OPS-01 | WORK-01>
- **State:** <READY | ACTIVE | BLOCKED | ROUTED | DONE | SUPERSEDED>
- **Dependency:** <none or exact dependency>
- **Authorization:** <authorization reference>
- **Suggested next action:** <concrete action>
- **Related session/event/handoff:** <ids>

## Routing rule

If a task belongs to another agent, create or update a backlog entry and continue independent work. Do not poll repeatedly for the dependency.

### BKL-007 — 2026-10-09
- **Work:** Diagnose and correct live `/login?reason=not_provisioned` loop at `100.72.192.28:3300`
- **Owner:** OPS-01
- **State:** ROUTED
- **Dependency:** Access to the live self-hosted runtime/container and its runtime environment/database connection
- **Authorization:** User-explicit FIX-01 bug-remediation request; OPS-01 must independently confirm runtime/deployment scope
- **Suggested next action:** Verify running source/build revision, auth cookie/session state, `DATABASE_URL` consistency, active session, and active organization membership. Rebuild/restart only if stale runtime code is confirmed; otherwise repair the concrete runtime/config/data defect without weakening authentication.
- **Related session/event/handoff:** FIX-01/Sentinel; EVT-FIX01-AUTH-20261009; HOF-FIX01-OPS-AUTH-20261009; ISS-007

### BKL-007-FIX — Authentication false-success loop
- Owner: FIX-01 / Sentinel
- State: SOURCE_FIXED
- Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`
- The login boundary now refuses to create sessions for accounts lacking an active organization membership, eliminating the success → `not_provisioned` redirect loop. Runtime deployment/verification remains with OPS-01.
