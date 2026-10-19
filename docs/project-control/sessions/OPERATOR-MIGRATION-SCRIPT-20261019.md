# Owner-requested operator migration preparation — 2026-10-19

## Authorization and boundaries

User requested: "Create migrate scrip and commit them into GitHub I will deploy and migrate using scrip." Existing project convention is direct commits to `main`, without branches/PRs; user, not assistant, will deploy and migrate. Prepared the scripts for OPS-01/operator use; **did not connect to a live database, copy provider secrets, deploy or execute migrations.** Started from `main` `0f514b1d628b6a313237ade662ed211156d17c49`.

## Existing repository findings

- `packages/db/migrate.js` already runs all `supabase/migrations/*.sql` and records SHA256 checksums in `aca._aca_schema_migrations`; latest migration in this checkout was `0051_microsoft_oauth_platform_configs.sql`. `supabase/migrations/0007_actions_ai_voice_audit.sql` created `ai_provider_configs` and `0044_ai_provider_setup.sql` added TTS/STT/RealtIme purposes. **No new schema DDL is needed to resolve ElevenLabs provider_configuration_required (409).**
- `scripts/manual-up.sh` builds images and runs migrations inside Compose networking, but deliberately continues startup when migrations fail. That legacy workflow should not be used as a schema-acceptance gate.
- `docker-compose.yml` is documented as local development; the operator must choose and review the actual Compose/env file and target DB. Earlier OPS-01 findings indicated `/postgres` versus `/aca` target ambiguity. Do not assume the name.

## Source commits delivered directly to main

- `packages/db/operator-migration-core.mjs`: pure sorted SQL migration manifest checks for SHA256 drift, unknown applied migrations, missing/empty ledger, incomplete verification and expected database-name validity.
- `packages/db/operator-migration-check.mjs`: read-only PostgreSQL plan/preflight/verify using *the same* Compose service database connection, `current_database()` guard, strict `aca` ledger inspection, public shadow-ledger detection; never exposes credentials.
- `scripts/operator-migrate.sh`: manual `plan|apply|verify` operator CLI, Compose internal DNS, fixed project-root `.env`, read-only SQL bind mount, `--expect-db` and `--backup-confirmed` required for writes, `--allow-fresh` required on empty ledger, underlying checksum-enforcing migration runner, fail-closed on nonzero status and privilege/duplicate skipped-statement warnings, live post-apply verification. **It never calls `docker compose up -d`, resets a schema or copies any provider API key.**
- `scripts/tests/operator-migration-core.test.mjs`: offline Node tests covering pending/applied checks, new ledger, SHA drift, unknown versions, duplicates, verification and DB-label protection.
- `scripts/tests/operator-migrate-script.test.mjs`: Bash syntax, flag validation, Compose DB boundary and warning-path contracts.
- `docs/runbooks/OPERATOR-MIGRATION-20261019.md`: copyable operator instructions, restore-tested backup prerequisite, plan/apply/verify, development-only Compose warning, failure recovery and authenticated ElevenLabs TTS/STT purpose-key setup instructions.

## Verification evidence

- **Actually performed:** fetched the exact committed GitHub files after writing; checked **17/17 current-source contract assertions PASS** for mandatory confirm/backup, read-only bind mount, target/ledger validation, SHA integrity, no deploy/reset, drift/unknown guard, warning failure, and test presence.
- **Not executed:** Newly committed Node/Bash tests, `bash -n` in a complete checkout, image build, Docker Compose run, PostgreSQL connectivity, production migration, tests/typechecks/browser/provider endpoints and actual backup restore. **Do not claim successful migration or production deployment.**
- The supplied production browser cookie in the earlier ElevenLabs report is a secret and must be revoked/rotated; no tool call used or repeated it.

## Exact next operator action

```bash
git checkout main
git pull --ff-only origin main
git status --short
docker compose --project-directory "$PWD" --env-file .env -f "${ACA_COMPOSE_FILE:-docker-compose.yml}" build web
node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs
bash scripts/operator-migrate.sh plan
# Confirm database target and create/restore-test an independent backup first.
bash scripts/operator-migrate.sh apply --expect-db YOUR_CONFIRMED_DATABASE_NAME --backup-confirmed
bash scripts/operator-migrate.sh verify --expect-db YOUR_CONFIRMED_DATABASE_NAME
```

Set `ACA_COMPOSE_FILE` to the separately approved production configuration when appropriate, and inspect `.env`; the checked-in `docker-compose.yml` is local-development-only. For a genuinely new database, reviewed `--allow-fresh` may be added to apply; **never** use it to bypass an unknown existing ledger. Deploy the application *separately after successful verification*. OPS-01 owns backup/host/CI/migration execution/deployment and incident response, FIX-01 owns unrelated runtime/security defects. After web deployment, an authenticated admin must explicitly save/enable ElevenLabs TTS and STT API keys or use the existing audited same-org **Use saved Realtime key** action; migrating tables cannot solve a missing credential.

**Current status:** source complete on main, operator execution and acceptance pending.
