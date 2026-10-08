# APCP Shared Agent Memory

This is the shared, durable memory layer for all APCP agents. It is a memory/lessons record, not an authorization source.

## Authority order

1. Current explicit owner requirement
2. Repository-local governing instructions
3. GitHub committed source/state
4. Active authorization and project-control state
5. This shared memory
6. Per-agent memory
7. Chat/session memory

Memory never overrides current requirements, authorization, or repository truth.

## Purpose

Record reusable lessons so a newly invoked agent can avoid repeating known mistakes without needing a previous chat.

Record:
- recurring bugs and root causes;
- failed approaches and why they failed;
- successful remedies;
- regression-prevention rules;
- environment/deployment lessons;
- cross-agent lessons that materially affect future work.

Never record secrets, tokens, passwords, private keys, or sensitive personal data.

## Read-first rule

Every invoked agent reads this file before starting work, then reads its own role-local MEMORY.md and WORKLOG.md. The agent also reads AGENT_EVENTS.md, AGENT_SESSIONS.md, AGENT_HANDOFF.md, and AGENT_BACKLOG.md when relevant.

## Entry format

Append lessons under the owning agent section:

- **Date/session:** <date / session id>
- **Agent:** <agent id>
- **Issue/symptom:** <what happened>
- **Root cause:** <confirmed cause>
- **Failed approach:** <what did not work and why>
- **Remedy:** <what worked>
- **Prevention:** <how future agents should avoid recurrence>
- **Related record:** <issue/event/commit/path>

## Agent memory sections

### DEV-01 / Forge
<!-- Append durable development lessons here. -->

### FIX-01 / Sentinel
<!-- Append durable error/root-cause lessons here. -->

### OPS-01 / Shipwright
<!-- Append durable CI/CD/deployment/infrastructure lessons here. -->

### WORK-01 / Rover
<!-- Append durable daily-worker/maintenance lessons here. -->

## Memory conflict rule

If shared memory conflicts with current repository state or current requirements, ignore the stale memory, record the conflict in AGENT_EVENTS.md or ISSUES.md when material, and follow current repository truth.


### FIX-01 / Sentinel — 2026-10-09
- **Issue/symptom:** Live agent creation failed with SQLSTATE 23502 on `audit_events.resource_type` after the latest migration chain passed.
- **Root cause:** `CREATE TABLE IF NOT EXISTS` does not reconcile old table shape. The live database kept retired `resource_type` and `outcome` NOT NULL columns while current code writes `target_type` and `decision`.
- **Failed approach:** Adding only missing current columns (`agent_id`, `decision`) was insufficient because legacy constraints still rejected new writes.
- **Remedy:** Use a forward-only conditional migration to relax NOT NULL on retired compatibility columns, guarded by `information_schema.columns`; retain historical data and don't manually alter production schema.
- **Prevention:** For every live schema-drift incident, compare the full set of required/legacy columns and constraints against current INSERT statements, not just missing-column errors.
- **Related record:** ISS-008; migration `0024_audit_legacy_column_compatibility.sql`; commits `14bea1c3`, `4ef3921d`.


### FIX-01 / Sentinel — 2026-10-09
- **Issue/symptom:** `POST /api/email-accounts` returned `403 not_member` for the organization ID selected by the UI.
- **Root cause:** The email-account server page used the seeded development organization rather than the active organization resolved for the authenticated user.
- **Failed approach:** Treating every `not_member` response as a membership-provisioning defect or weakening the authorization check would hide a client tenant-context bug and risk cross-tenant access.
- **Remedy:** Use `getAuthenticatedAppContext()` with request headers in the server page and pass that membership's organization ID into both the query and client; keep API membership/role authorization intact.
- **Prevention:** Every tenant-scoped server page must derive its organization from the authenticated request context, not dev seed globals or arbitrary client values. Add regression tests for this boundary.
- **Related record:** ISS-009; commits `4536332f`, `7a3cfba2`.


### DEV-01 / Forge — 2026-10-09
- Issue/symptom: Gmail OAuth start required static GMAIL_OAUTH_CLIENT_ID and SESSION_SIGNING_KEY environment configuration; user needs multiple configurable Gmail OAuth clients.
- Root cause: OAuth start/callback were environment-bound and always used the development identity context.
- Remedy: Persist organization-scoped OAuth client records, encrypt client secrets with the existing server-side credentials master key, expose admin-only Settings CRUD, let mailbox connection select a client, and store the selected client credentials inside the encrypted account credential envelope so worker refresh uses the same client.
- Prevention: Provider-specific client registrations are runtime configuration data, not code constants or deployment env vars. Keep only the root encryption key as infrastructure secret; never store the root key in the database it protects or expose provider secrets to the browser.
- Related record: ISS-010; migration 0026_gmail_oauth_configuration.sql.


### DEV-01 / Forge — 2026-10-09 migration sequencing
- Check existing migration filenames before adding a migration and avoid colliding with the current/latest sequence even though older historical migration groups contain duplicate prefixes. The recent sequence is guarded by a regression test.
- Gmail OAuth configuration migration is `0026_gmail_oauth_configuration.sql`; WhatsApp outbound claim lifecycle is `0025_whatsapp_outbound_claim_lifecycle.sql`.
