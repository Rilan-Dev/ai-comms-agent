# APCP Central Agent Sessions

Central index of autonomous agent sessions. Each agent also maintains its own role-local WORKLOG.md and MEMORY.md.

## Why this exists

A fresh chat may invoke any agent at any time. The next agent must be able to discover that another agent was active, what it was doing, what it left pending, and what lessons were learned without reopening the old chat.

## Session entry

### <SESSION-ID> — <YYYY-MM-DD>
- **Agent:** <DEV-01 | FIX-01 | OPS-01 | WORK-01>
- **Invocation:** <prompt/task summary>
- **Started from:** <commit/ref>
- **Scope:** <authorized task or safe maintenance task>
- **Status:** <ACTIVE | PAUSED | HANDOFF | COMPLETE | BLOCKED>
- **Completed:** <summary>
- **Pending:** <exact remaining work>
- **Blockers:** <none or durable blocker>
- **Handoff:** <AGENT_HANDOFF entry or none>
- **Next action:** <exact next action>

## Concurrency rule

Multiple sessions may be ACTIVE simultaneously. Session records are coordination evidence only; they do not grant authorization and do not require another agent to stop.


### FIX01-MAIL-TENANT-20261009 — 2026-10-09
- **Agent:** FIX-01 / Sentinel
- **Invocation:** Diagnose and fix the user's `/api/email-accounts` 403 `not_member` response.
- **Started from:** `main` after audit migration 0024 source correction.
- **Scope:** Root-cause diagnosis, minimal source fix, regression test, project-control records.
- **Status:** HANDOFF
- **Completed:** Found that `/mail/accounts` chose `getDevOrgId()`; changed it to use the authenticated active organization and added a static test.
- **Pending:** User/runtime deployment must pull latest main, apply migration 0024, and retry with a fresh session. No runtime PASS claimed.
- **Blockers:** Runtime access and deployment confirmation are external to this source correction.
- **Handoff:** ISS-009 / EVT-FIX01-MAIL-TENANT-20261009.
- **Next action:** Follow `docs/project-control/NEXT_ACTION.md`; do not weaken membership authorization.


### DEV01-GMAIL-OAUTH-SETTINGS-20261009 — 2026-10-09
- **Agent:** DEV-01 / Forge
- **Invocation:** Replace environment-bound Gmail OAuth with platform-managed multiple client configurations.
- **Started from:** main during user-reported provider_configuration_required response.
- **Scope:** Migration, authenticated settings API/UI, OAuth start/callback, worker refresh credentials, regression test and control records.
- **Status:** HANDOFF
- **Completed:** Added organization-scoped OAuth client storage, encrypted secret CRUD, UI configuration, per-connection client selection, callback use of the saved client, and encrypted account-level client credentials for worker refresh.
- **Pending:** Pull main; run manual deployment migration chain through 0026; configure OAuth client(s); register callback URI in Google Cloud Console; test end-to-end.
- **Blockers:** Live runtime and Google OAuth credentials are user-operated; no runtime PASS claimed.
- **Handoff:** ISS-010 / EVT-DEV01-GMAIL-OAUTH-20261009.
- **Next action:** Follow NEXT_ACTION.md; keep CREDENTIALS_MASTER_KEY server-only and never return client secrets to the browser.
