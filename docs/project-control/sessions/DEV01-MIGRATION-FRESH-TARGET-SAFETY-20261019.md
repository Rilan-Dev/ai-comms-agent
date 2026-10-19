# DEV-01 — Operator migration continuation: safe fresh-database preflight (2026-10-19)

## User authorization and scope
User originally asked to create migration scripts and commit them to GitHub, then said "Please proceed where you left." Owner plans to deploy and migrate using the script; assistant must **not** operate production, copy credentials, delete schema history, create branches or PRs. Role boundary: DEV-01 can deliver the requested source and tests; OPS-01 owns deployment environment, the backup/restore, migrations, CI, infrastructure and production acceptance.

## Recovered current main
Started at `72732585895e44e8cac32b5fbc8146253dec4a5f`. Found the operator migration tooling ALREADY committed to main:
- `scripts/operator-migrate.sh` (`plan|apply|verify`, manual-only, Compose-based, DB identity required, backup flag required, checksums/ledger verification)
- `scripts/operator-one-shot.sh` (interactive menu for migration-only, Vercel, or approved Docker; source tests/builds before DB review, explicit `APPLY database`)
- `packages/db/operator-migration-{check,core}.mjs`
- `docs/runbooks/OPERATOR-MIGRATION-20261019.md` and `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`
- Existing forward-only `supabase/migrations/*.sql` through `0051_microsoft_oauth_platform_configs.sql`

**No new SQL migration is required by the previously pasted ElevenLabs `provider_configuration_required` response.** The error means a per-organization TTS/STT key for that purpose was not saved/enabled (or cannot be read by the current deployed runtime); migrating SQL alone cannot configure it.

## Safety gap discovered and corrected
The prior `--allow-fresh` path treated an absent or empty `aca._aca_schema_migrations` history as eligible for fresh bootstrap. But the migration runner applies statements individually; a failed earlier run can leave user tables before recording a ledger row. A data-bearing DB with a missing ledger must **not** be silently treated as new.

Source changes committed directly to `main`, no branch/PR:
1. `packages/db/operator-migration-core.mjs` — `assertFreshDatabaseEmpty` refuses any existing user relations or ambiguous inspection result; requires exactly Boolean `false`.
2. `packages/db/operator-migration-check.mjs` — only during `preflight --allow-fresh` when zero applied migrations are recorded, performs **read-only** `pg_catalog.pg_class`/namespace query across all user schemas for tables, partitioned tables, views, materialized views, sequences and foreign tables, excluding extension-owned objects and only the migration ledger itself. Refuses a user-data-bearing target.
3. `scripts/tests/operator-migration-core.test.mjs` — tests positively empty `false`, rejects `true` and null/ambiguous values.
4. `scripts/tests/operator-migrate-script.test.mjs` — source-contract tests verify live catalogue query is in the preflight, excludes only PostgreSQL internals/extension dependencies, and does not bypass the existing backup gate.
5. `docs/runbooks/OPERATOR-MIGRATION-20261019.md` — documented the new fresh-bootstrap refusal/recovery.

Commits: `65b3a1e5`, `a7025523`, `f4333c8c`, `03d8958f`, `2c8ac71b`.

## Verification
- Current code inspected by the GitHub connector and narrow source-contract checks. **No connected PostgreSQL target or production migrations were run.**
- **Not executed in this environment:** complete original Node migration test suites, full web/worker/Clara CI, Docker production build, live `plan`, restore-validated backup, `apply`, `verify`, user provider/browser acceptance. Authenticated full checkout and the operator Docker host are not available in this assistant environment.
- Existing main `NEXT_ACTION` records an operator-host attempt: 29/29 operator tests, web image build, six TypeScript checks and 26 Clara Core tests passed, but web Vitest attempted external Ethereum RPC DNS under an intentionally offline network and worker tests were SIGKILLed. OPS-01 issue #38 owns the environment/infrastructure blocker. This does **not** establish a compilation failure, and no DB migration/deploy happened during that attempt.

## Exact next action for authorized operator (NO automatic apply)
```bash
git checkout main
git pull --ff-only origin main
node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs scripts/tests/operator-one-shot-script.test.mjs
bash scripts/verify-migration-chain.sh
# Set ACA_COMPOSE_FILE to your independently approved production migration Compose file.
docker compose --project-directory "$PWD" --env-file .env -f "${ACA_COMPOSE_FILE:-docker-compose.yml}" build web
bash scripts/operator-migrate.sh plan
```
STOP on wrong `DATABASE:` name, missing/ambiguous history, checksum changes or any failed verification. Perform and RESTORE-TEST an independent backup only after the reviewed plan and full preflight tests pass.

For a reviewed existing database with correct migration history and a restorable backup:
```bash
bash scripts/operator-migrate.sh apply --expect-db CONFIRMED_DATABASE_NAME --backup-confirmed
bash scripts/operator-migrate.sh verify --expect-db CONFIRMED_DATABASE_NAME
```
`--allow-fresh` is ONLY for an actually empty database. It now rejects existing user relations. It cannot repair partial historical migrations; OPS-01 must reconcile those safely.

**Status:** source safety amendment committed, no branch or PR, no production action. Phase 4 remains implementation in progress.
