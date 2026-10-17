# OPS-01 Role-Local Memory

This is durable memory for OPS-01. It supplements, but never overrides, shared APCP memory or repository authority.

## Read before work
- docs/project-control/AGENT_MEMORY.md
- docs/project-control/AGENT_EVENTS.md
- docs/project-control/AGENT_SESSIONS.md
- docs/project-control/AGENT_HANDOFF.md
- docs/project-control/AGENT_BACKLOG.md
- this file
- current project-control state and applicable architecture/plan

## Record
- recurring issues;
- role-specific mistakes and prevention;
- successful patterns;
- failed approaches;
- environment-specific observations;
- lessons that should be promoted to AGENT_MEMORY.md when cross-agent.

## Do not store
Secrets, tokens, passwords, private keys, or sensitive personal data.

<!-- Append durable OPS-01 lessons below. -->


### OPS01-MIGRATION-CONTAINER-20261018 — 2026-10-18
- Host-run migrations cannot resolve Compose-only `postgres` DNS. Keep the application DB URL on `postgres:5432`; execute migrations in a one-off Compose container.
- Mount `$PROJECT_ROOT/supabase` read-only at `/workspace/supabase`, because the current image does not COPY migration files and the runner auto-detects that path.
- Retain the established continue-startup-on-migration-failure behavior; don't alter it without explicit authorization.
- Focused regression test covers internal-network invocation, migration mount, no host-side DSN rewrite, and failure policy. Shell syntax passed; isolated test harness 4/4. Real database/migration/live startup are not verified.
- Database target needs operator confirmation: configured URL in prior evidence used `/postgres`, local Compose default is `aca`. Never silently change it.
