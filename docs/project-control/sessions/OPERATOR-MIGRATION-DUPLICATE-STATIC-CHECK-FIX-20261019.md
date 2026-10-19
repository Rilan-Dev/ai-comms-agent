# Operator migration `plan` static duplicate false-positive — source fix (2026-10-19)

## Report / authorization
Operator supplied actual terminal output after pulling `main` at `ae01b33579f50b62578b7719be4102acaf3758a9`:
- Existing offline operator test suites: **14/14 PASS**, reported by operator.
- `docker compose --env-file .env -f docker-compose.yml build web`: **completed successfully**, reported by operator.
- `bash scripts/operator-migrate.sh plan`: failed immediately during `scripts/verify-migration-chain.sh` with `ERROR: duplicate canonical table object(s): aca\nagent_ai_settings\n...`.
- The wrapper executes the static source verifier **before** any Docker/database commands, so this error was **not a migration execution or observed database failure**. No database writes by the assistant.

## Root cause and correction
The old static verifier used `grep -RhoE 'CREATE TABLE IF NOT EXISTS ...'`, captured only the **first** identifier after `CREATE TABLE IF NOT EXISTS` (thus mistakenly calling the schema qualifier `aca` a table object) and applied `sort | uniq -d` to every occurrence. This is incompatible with actual historical SQL: both `0002_application_domain.sql` and `0002_database_foundation.sql` deliberately use repeated idempotent `CREATE TABLE IF NOT EXISTS` declarations; enum definitions are reasserted inside `DO $$ ... EXCEPTION WHEN duplicate_object ... $$` blocks. They are not evidence of two unsafe canonical creates.

**Changes direct on main; no branch/PR:**
1. `scripts/verify-migration-chain.sh`: replaced broken blanket duplicate-grep block with invocation of `scripts/check-migration-declarations.mjs`. Retains required migration files, forbidden legacy names, escaped newlines, `auth.uid()`, single-dollar function syntax and RLS helper checks.
2. New pure Node checker skips idempotent IF NOT EXISTS and dollar-quoted/quoted/comment content; extracts actual unqualified and schema-qualified names with normalized default `aca` schema. Rejects repeat **non-idempotent, unguarded** `CREATE TABLE` and top-level `CREATE TYPE ... AS ENUM` declarations. The checker is a best-effort static structural audit, **not a substitute for SQL execution, schema inspection, checksums or database permissions**.
3. `scripts/tests/operator-migrate-script.test.mjs`: five regression tests: allowed historical IF NOT EXISTS + duplicate_object guards; rejected genuinely duplicated unguarded table and enum DDL; comments/procedural blocks/different schemas ignored; whole structural verifier succeeds on representative historical fixture and fails for unsafe fixture; checker added to Node syntax checks.

## Verification evidence and limits
- **Locally executed:** Node v22.16.0 `node --check` of the exact new checker; `git hash-object` confirmed checker SHA **`e1518eff9be87adb9dc7dba633ce02c50958d149`**, exactly GitHub committed blob; three direct pure-source fixtures PASS (safe historical reassertion, dangerous duplicate fail, quoted/comment/different schema exclusions); a local structural-verifier copy passed historical fixture and rejected repeated unsafe `aca.unsafe_table`. Local shell copy was functionally equivalent but not byte-identical to GitHub; do not count this as full repository Bash test.
- **Authenticated GitHub inspection:** all 70 committed `supabase/migrations/*.sql` files inspected in four bounded batches for unconditional `CREATE TABLE` / `CREATE TYPE AS ENUM` lines. Found 5 distinct new bare table names in `0050_personal_mail_briefings.sql`; other bare enum candidates had distinct names, with no repeated unguarded candidate names observed. This does **not** replace running the entire static verifier on a complete checkout.
- **Not executed by assistant:** new complete `node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs` against the authenticated full checkout; the complete actual 70-SQL-file `bash scripts/verify-migration-chain.sh`; `operator-migrate.sh plan` connected to operator's PostgreSQL; `apply`, `verify`, DB checksums/migration effects, deployment, API/Vercel testing.
- Operator's earlier 14/14 and Docker build PASS are supplied observations **before** this fix; cannot count them as validating the new change.

## Exact operator next actions — read only until plan succeeds
```bash
git checkout main
git pull --ff-only origin main
node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs
bash scripts/verify-migration-chain.sh
bash scripts/operator-migrate.sh plan
```
Read `DATABASE:`, `LEDGER:`, `APPLIED`, `PENDING`, drift/unknown information. If **any** check fails, **STOP** and share redacted messages (never `.env` or `DATABASE_URL`). If the plan shows no ledger on an existing DB, do **not** use `--allow-fresh` to bypass. Inspect/resolve schema/ledger provenance with OPS-01 before migration.

Only after identifying correct production target, reviewing each pending migration, rebuilding the matching current-main web image, and independently creating **and testing a restorable backup**, operator may run:
```bash
bash scripts/operator-migrate.sh apply --expect-db CONFIRMED_DATABASE_NAME --backup-confirmed
bash scripts/operator-migrate.sh verify --expect-db CONFIRMED_DATABASE_NAME
```
Never assume the schema label `aca` is the PostgreSQL **database** name; `--expect-db` compares actual `current_database()`. No `apply` or deployment was performed by the assistant. OPS-01/operator retains live DB/deployment responsibility; phase 4 is not accepted.
