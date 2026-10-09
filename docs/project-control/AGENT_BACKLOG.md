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


### BKL-008 — Mail tenant-context and inbox search query defects
- **Work:** Inspect and correct the Drafts server page's use of `getDevOrgId()` instead of authenticated organization context; inspect Inbox repository SQL parameter placeholders and add regression coverage.
- **Owner:** FIX-01 / Sentinel
- **State:** ROUTED
- **Dependency:** None for source diagnosis; runtime verification remains separate.
- **Authorization:** Existing product security requirements and explicit instruction to route substantial bugs to FIX-01.
- **Suggested next action:** Trace `/mail/drafts` organization resolution and `listInboxMessages()` SQL; preserve fail-closed organization authorization, correct confirmed defects, and add targeted tests.
- **Related session/event/handoff:** DEV01-DRAFT-SEARCH-20261009; EVT-DEV01-MAIL-ROUTING-20261009.

### BKL-009 — Worker credential snapshot build failure
- **Work:** Execute the focused regression test and worker typecheck/build after the snapshot contract fix.
- **Owner:** FIX-01 / Sentinel for source; OPS-01 for remaining Docker/dependency/environment defects.
- **State:** ACTIVE
- **Dependency:** Dependency-equipped environment to run pnpm commands.
- **Authorization:** User-explicit FIX-01 bug-remediation request.
- **Suggested next action:** Run Gmail adapter regression and worker build; record actual output in VERIFICATION_STATE.md. Do not claim success from source commits alone.
- **Related records:** FIX01-WORKER-CREDENTIALS-20261009; EVT-FIX01-WORKER-CREDENTIALS-20261009; ISS-013.


### BKL-010 — Zoho OAuth settings test parser failure
- **Work:** Execute post-fix web typecheck and focused Zoho OAuth settings test.
- **Owner:** FIX-01 / Sentinel for source defect; OPS-01 only for any separate infrastructure/CI/deployment failure.
- **State:** ASSERTIONS_CORRECTED_FOCUSED_RERUN_PENDING
- **Symptom/history:** Original TS1127/TS1434 parser error is corrected in `39857c40820940b500dcf452331dfe82ae35b861`. User's latest `pnpm run typecheck` passes all workspaces; focused test reported 8 passed / 2 failed because of stale expectations.
- **Latest test-only correction:** `c58d6d442767f471c694ef978fdb06eca6d29850`.
- **Next action:** Rerun `pnpm --filter @ai-comms-agent/web exec vitest run tests/zoho-oauth-settings.test.ts`; then update verification from actual output.
- **Related:** ISS-014; EVT-FIX01-ZOHO-TEST-NEWLINES-20261009.
