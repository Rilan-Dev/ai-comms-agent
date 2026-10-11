# OPS-01 Role-Local Worklog

Append-only operational history for OPS-01. This is not the source of authorization.

## Entry format

### <SESSION-ID> / <DATE>
- **Task:** <task>
- **Authorization:** <reference or safe-maintenance classification>
- **Started from:** <commit/ref>
- **Actions:** <what was done>
- **Files/code:** <paths>
- **Evidence:** <tests/checks/observations>
- **Blockers/dependencies:** <none or exact>
- **Lesson:** <reusable lesson or none>
- **Next action:** <exact next action>

<!-- Append new entries below. -->

### OPS-01-MAIL-SYNC-20261010 / 2026-10-10
- **Task:** Follow up live inbox schema error, RabbitMQ queue failures, and draft endpoint role denial.
- **Authorization:** Explicit user request to check issue logs and fix the reported live defects.
- **Started from:** User-reported runtime after successful migration 0032 and Docker web/worker startup.
- **Actions:** Diagnosed legacy attachment column mismatch (`email_message_id` vs `message_id`), role hierarchy omission, and lack of direct-sync fallback after RabbitMQ producer failure. Committed migration 0033, hierarchical role checks, leased fallback, safe RabbitMQ diagnostics, and static regression assertions.
- **Files/code:** `supabase/migrations/0033_email_attachment_message_id_compatibility.sql`; `apps/web/src/lib/identity/authorization.ts`; `apps/worker/src/email/mailbox-sync-worker.ts`; `apps/worker/src/queues/email-sync-rabbitmq.ts`; focused tests.
- **Evidence:** User's log establishes the three runtime symptoms. GitHub source commits: `de8a79b2`, `0ab61969`, `a0124202`, `d058b5e1`, `27d960eb`. No runtime access from this tool session; tests/build/migration/provider fetch remain unverified.
- **Blockers/dependencies:** User must pull latest main and rerun manual-up. RabbitMQ may have invalid endpoint/auth/vhost/TLS; Redis distributed lease may also fail. Never bypass lease coordination.
- **Lesson:** Legacy schema reconciliation must cover FK column names as well as message fields; role guards that specify a minimum role must respect the role hierarchy; broker failure must not silently suppress all mailbox sync attempts.
- **Next action:** Pull latest main, rebuild/restart, apply 0033, inspect sanitized worker logs, confirm direct fallback and Redis lease behavior, then verify nonzero persisted provider message rows and inbox rendering. Revoke the access token included in the user's pasted curl.

## 2026-10-10 — OAuth mailbox sync blocked by live worker infrastructure configuration
- **Owner:** OPS-01 / runtime operator; ChatGPT architecture review.
- **Evidence:** User ran `bash scripts/diagnose-email-accounts.sh`. Public and local `/api/health` returned 200, but Gmail account remained pending/idle with no attempt/success timestamps and zero stored messages after manual sync returned 202. Sanitized worker logs show RabbitMQ URI virtual host literal `YOUR_EXISTING_VHOST`, repeated AMQP connection-close errors, and Redis `WRONGPASS` errors. The Redis lease failure causes the worker to skip its batch rather than run without distributed coordination.
- **Action required on host:** Correct `RABBITMQ_URL` in the deployed `.env.docker` to the real broker endpoint/credentials/actual vhost and correct `REDIS_URL` to the active Redis ACL/auth/TLS/database settings. Do not share the URLs or secrets. Recreate/restart the worker so it receives updated environment variables.
- **Recovery:** Confirm sanitized logs no longer show either error; trigger Gmail sync; verify account sync timestamps/state and actual persisted message count. 202/queued and health 200 do not prove ingestion. If the sync advances but messages still remain zero, route back to FIX-01 with the new sanitized worker/provider error.
- **Status:** Root cause for the observed no-fetch is identified as worker infrastructure configuration; actual mailbox ingestion is not yet verified. Never bypass the Redis lease.
