# OPS01-MIGRATION-CONTAINER-20261018

## Task
Move the database migration runner from the host into a one-off Compose container to fix `getaddrinfo ENOTFOUND postgres`, preserve internal Docker networking, and add regression protection.

## Authorization
User explicitly approved the next action in the FIX-01 → OPS-01 handoff `HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018`. Scope limited to the deployment migration path and its focused regression tests. OPS-01 owns Docker/deployment changes.

## Started from
`main` `86f5f83d0917291537eedcdb6b33f233c5b7d2bf`.

## Root cause
`scripts/manual-up.sh` executed `node packages/db/migrate.js` on the host while `DATABASE_URL` used Compose-only DNS name `postgres:5432`. The Dockerfile does not COPY `supabase/`, but the migration runner auto-detects `/workspace/supabase/migrations` inside the image.

## Change
- `scripts/manual-up.sh` now invokes `docker compose run --rm --no-deps web node packages/db/migrate.js` on the Compose network.
- Mounts `$PROJECT_ROOT/supabase` read-only at `/workspace/supabase`.
- Removes host-side database URL resolution and `host.docker.internal` rewriting.
- Preserves the existing warning-and-continue startup behavior when migrations fail.
- `scripts/tests/manual-up-compose-env.test.mjs` covers container invocation, migration mount, no host DSN resolution, no DB URL logging, and startup policy.

## Commits
- Source: `65a215151ecd14900fac3c9ba9a421fb7a777a77`
- Final test: `6cd93638bffa0e2f6a9e8d6ce2f3f2664b13341b`
- Control-state updates culminated at `926c60b35498b6de193d81ba8a6ce8d9c093ad2e`.

## Evidence
- `bash -n scripts/manual-up.sh`: PASS.
- Focused Node test: 4/4 PASS in an isolated harness with the fetched script/test and a Compose fixture matching the existing `.env` declarations.
- First regex attempt failed because the shell line continuation includes a literal backslash; corrected the assertion to check command/options/mount ordering.
- This does not establish a complete repository-checkout test, Docker invocation, migration, or live health PASS.

## Outstanding safety check
Prior user configuration used database path `/postgres`, while local Compose declares `POSTGRES_DB=aca`. Do not silently change the database. Confirm the intended target before applying migrations.

## Next action
Operator confirms the intended database, pulls latest `main`, runs `node --test scripts/tests/manual-up-compose-env.test.mjs` in the actual checkout, then runs `bash scripts/update-and-up.sh`. Record migration completion separately from container health. Keep app DB URLs on Docker internal DNS.
