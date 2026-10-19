# Manual database migration runbook (operator-owned)

**Created:** 2026-10-19 — Source prepared on GitHub `main`; **nothing was deployed or migrated by the author**.

Use `scripts/operator-migrate.sh` to run existing, forward-only `supabase/migrations/*.sql` through the established Node/pg migration runner. The script is a manual operator tool, **not** an automatic application deploy, a SQL reset or a secret-management process.

## 0. Safety requirements

- Work from an approved **current main** checkout with a clean working tree. Confirm that the target is the intended database and environment; the existing Compose example is marked **local development only**. Supply your approved production Compose file through `ACA_COMPOSE_FILE` if appropriate.
- The script always uses the checkout's `.env` for Compose. Check that this file and the Compose service's `env_file: .env` describe the **same** production target. Do **not** paste its contents, `DATABASE_URL`, tokens or provider API keys in tickets/chats/logs.
- Ensure the PostgreSQL endpoint is reachable **from the web Compose container**. Internal service names such as `postgres` work only on the correct Docker network; `--no-deps` deliberately does not start the database.
- Make a real backup/snapshot using your PostgreSQL operator/managed-DB tooling **and test that it can be restored**. `--backup-confirmed` is your confirmation, **not** an automated backup step. Migration runner statements may auto-commit; a failed migration can leave partial DDL.
- Never run `scripts/reset-and-migrate.sh` on an existing database. The legacy `scripts/manual-up.sh` has an existing *start-app-even-if-migration-fails* policy and is **not** the acceptance mechanism for a production schema change.
- If a database has a migration applied at a different SHA or a migration not in this checkout, stop. Do not edit old migration files, delete ledger entries or force timestamps to match.
- The exposed login session from the prior provider-model report needs to be revoked before using the production UI again.

## 1. Prepare current source/image

On your Linux deployment host (choose the authorized production Compose file, if different):

```bash
git checkout main
git pull --ff-only origin main
git status --short

# Production: use your approved production Compose config if different.
# export ACA_COMPOSE_FILE=path/to/approved-production-compose.yml
# This project uses .env as the Compose service environment.
docker compose --project-directory "$PWD" --env-file .env -f "${ACA_COMPOSE_FILE:-docker-compose.yml}" build web

# Run isolated, offline source tests (no database calls).
node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs
```

The `web` image must be built from the same checkout as the migration files; the operator checks and migrations run inside that image with a **read-only mounted** `supabase/` directory. No host-side database URL rewrite is performed.

## 2. Read-only plan (never applies SQL)

```bash
bash scripts/operator-migrate.sh plan
```

Read `DATABASE: <name>`, `LEDGER`, `APPLIED`, `PENDING` and every `PENDING <filename>` line. If this is the wrong database, fix the Compose environment **before proceeding**. You can additionally require an exact name in the read-only plan:

```bash
bash scripts/operator-migrate.sh plan --expect-db YOUR_CONFIRMED_DATABASE_NAME
```

The plan detects changed checksums, migrations that were applied by a newer/other checkout and unexpected `public`-schema migration-ledger drift. It does not copy or decrypt API keys.

## 3. Backup, then apply explicitly

After you have a restorable backup, and **only** when `YOUR_CONFIRMED_DATABASE_NAME` matches the name printed by the plan:

```bash
bash scripts/operator-migrate.sh apply --expect-db YOUR_CONFIRMED_DATABASE_NAME --backup-confirmed
```

This runs an additional live preflight against that target, executes the repository's normal migration runner and then verifies the complete migration ledger against local SQL checksums. It **fails** if the runner exits nonzero, fails to print completion, or reports skipped privilege/duplicate statements. Stop the rollout on any failure; a failure does **not** imply that partial DDL was rolled back.

For a genuinely **empty, reviewed, new** database with no applied migrations, use the explicit exception:

```bash
bash scripts/operator-migrate.sh apply --expect-db YOUR_NEW_DATABASE_NAME --backup-confirmed --allow-fresh
```

Do not use `--allow-fresh` to paper over an old/unknown migration ledger on production.

## 4. Verify, then perform your deployment

```bash
bash scripts/operator-migrate.sh verify --expect-db YOUR_CONFIRMED_DATABASE_NAME
```

Only a printed `MIGRATION_VERIFICATION: PASS` means the database has a complete, checksum-matching migration ledger. **This does not verify application compilation, RLS business invariants, live provider credentials or health.** Run your separately approved image release/startup and post-deploy browser/permission checks. Record the deployed commit and any migration warnings. Existing CI/Vercel build-rate-limit blockers remain separately owned by OPS-01.

If anything fails, do not launch the new application code. Keep the log private, review the original error/backup, and reconcile forward-only; never blindly rerun a destructive reset.

## 5. About the ElevenLabs TTS/STT 409

The repository already contains the `ai_provider_configs` and purpose-specific `tts` / `stt` / `realtime` schema changes in `supabase/migrations/0007_actions_ai_voice_audit.sql` and `0044_ai_provider_setup.sql`. **There is no new schema column required just to resolve `provider_configuration_required`.** The error means the selected organization lacks a saved and enabled ElevenLabs credential for that specific purpose. Running SQL migrations alone will **not** resolve that 409.

After deploying updated web code, sign in with a **new** session as an administrator and explicitly choose **Use saved Realtime key for TTS/STT** in AI Provider Setup, if an enabled same-organization Realtime key is eligible. Otherwise save/enable each purpose's secret normally. This uses the audited, organization-authorized application API; the migration script deliberately **never** duplicates encrypted API keys or overwrites disabled/different-purpose config rows. Re-test each TTS/STT model endpoint using authenticated browser access without sharing tokens.

## Troubleshooting

- `DATABASE mismatch`: fix `DATABASE_URL` / target Compose environment; **never** change the expected name to silence the error.
- `No aca migration ledger`: fresh database requires reviewed `--allow-fresh`; an existing database needs manual ledger/schema inspection, **not** automatic bootstrap.
- `CHECKSUM_MISMATCH` / `UNKNOWN_APPLIED`: stop. You may have applied different SQL or are using an older code revision.
- `ECONNREFUSED` / `ENOTFOUND`: confirm DB is running and reachable from the one-off web container on the chosen network.
- Skipped `GRANT`/`REVOKE`/other privilege/duplicate statements: the legacy Node migration runner may warn and continue; this operator wrapper deliberately reports **failure** so you investigate required security/RLS permissions.
- Missing operator checker in image: build the image from the current checkout before running commands.

**Ownership:** The operator (OPS-01) runs migration/deployment and validates backups/host conditions. DEV-01 prepared the scripts and source-level tests. FIX-01 owns unrelated runtime and HTML-ingest security defects.
