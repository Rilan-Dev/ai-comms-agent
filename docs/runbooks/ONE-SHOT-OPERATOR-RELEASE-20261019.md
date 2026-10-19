# One-invocation operator verify → migrate → release

**Date:** 2026-10-19. **Owner:** human operator / OPS-01 for production execution. This is source tooling only; assistant has not connected to or migrated production.

From a **clean checkout already on `main`**, on the deployment host, run this one command in an **interactive terminal**:

```bash
git pull --ff-only origin main && bash scripts/operator-one-shot.sh
```

The script asks for a target: `vercel`, `docker`, or `migration`. It then asks for the **actual PostgreSQL database name**, displays the read-only migration plan, asks for your independent restorable-backup reference, and requires you to type `APPLY <confirmed_database_name>` **before writing SQL**. This is *one invocation*, not an unsafe noninteractive migration. No token or password should be pasted into chat.

## Preconditions

- Linux host/terminal with Git, Node 20+ (Node 24 preferred), Docker + Compose v2, access to private GitHub repository, and an unmodified `main` checkout. No uncommitted/untracked changes. Existing `.env` securely configures the real target database for the Compose migration service.
- For **Vercel**: install and authenticate Vercel CLI, link the exact approved Vercel project first (`.vercel/project.json` required), ensure account has build allowance. **Vercel build-rate-limit remains an external blocker**; the script cannot bypass it. Vercel production env settings remain configured separately; no keys are migrated into Vercel.
- For **Docker**: provide a separately reviewed production Compose file when prompted or set `ACA_PRODUCTION_COMPOSE_FILE`; the bundled `docker-compose.yml` is **development-only** and explicitly rejected for production startup because it enables development identity. The selected migration Compose file may still use the local-default file **only as a one-off build/test/migration container**, never as a production deployment.
- For **migration** target: runs all source checks and applies/verifies migration ledger, then stops without deploying the application; suitable if web deployment will be performed separately.
- **Do not run against an existing data-bearing DB without a tested and restorable backup/snapshot.** The operator-supplied backup reference is an acknowledgement, not a backup the script made. Managed database snapshot/pg_dump and actual restore validation are external operator responsibilities.
- Existing database migration ledger must be consistent. No `--allow-fresh`, reset, truncation, checksum overrides or silent SQL skip exceptions are available here. Fresh database bootstraps need the separate reviewed manual runbook.

## Execution stages, in order

1. Detect deployment mode and validate that a reviewed Vercel project or production Docker Compose configuration is available, **before** making SQL changes.
2. Fast-forward `main` only; run the existing operator Node regression tests (including Bash syntax/fail-closed tests) and SQL chain verifier.
3. Build current web image, which performs `next build`. Run workspace typechecks and **all** package test suites inside the image with read-only scripts/docs/SQL mounts. If Docker target, build reviewed production images before database writes.
4. Read-only operator migration plan enforces a typed `--expect-db` name and existing ledger/checksums. Review `DATABASE:`, `LEDGER:`, `APPLIED:`, `PENDING:` and each planned migration; **do not approve an unexpected plan**.
5. Operator independently confirms a restorable backup and approves typed `APPLY <database>`. `scripts/operator-migrate.sh apply` performs another preflight, forward-only migration runner and ledger verification; subsequent explicit verify must pass.
6. Deploy only the requested target: Vercel CLI production deploy (subject to quota) or a specifically reviewed Docker Compose web/worker startup. Migration-only mode never starts services.
7. Optional `ACA_HEALTH_URL=https://aca.starcitytechnical.com/api/health` lets the script perform a basic HTTP health probe after a successful deployment. This is **not** acceptance of real providers, session security, email/WhatsApp grants, voice WebSockets or end-to-end browser workflows.

## Example: already linked Vercel project

```bash
# Run in the repository root. Interactive prompts are still mandatory.
ACA_RELEASE_TARGET=vercel ACA_HEALTH_URL=https://aca.starcitytechnical.com/api/health \
  bash scripts/operator-one-shot.sh
```

If the project hasn't been linked, link/authenticate the Vercel CLI first using its own documented workflow; the one-shot script will refuse to guess the deployment target. If Vercel's build-rate limit rejects the deploy, the script stops without claiming success. The DB migration may already have completed, so **do not reset or replay migrations**; use `bash scripts/operator-migrate.sh verify --expect-db CONFIRMED_DATABASE` and coordinate deployment with OPS-01.

For production Docker, point to an approved production Compose file with **no development identity**:

```bash
ACA_RELEASE_TARGET=docker ACA_PRODUCTION_COMPOSE_FILE=path/to/approved-prod-compose.yml \
  bash scripts/operator-one-shot.sh
```

## Security and support notes

- `.env` stays ignored and local. Never paste `DATABASE_URL`, authentication cookies, provider API keys, full rendered Compose config or backups into a chat/log. Previously exposed `aca-access-token` **must be revoked and renewed**.
- The reported ElevenLabs `provider_configuration_required` for `tts` and `stt` is a per-purpose **credential configuration** issue, not a missing SQL migration. After deploying web code, have an authorized org administrator explicitly save/enable TTS and STT keys or choose the auditable same-org Realtime-key reuse UI. This script never copies encrypted credentials.
- The script stops on test/build/plan/preflight/migration/deployment errors; it is deliberately **not** "ignore failures then deploy." See `docs/runbooks/OPERATOR-MIGRATION-20261019.md` for target and ledger diagnostics.
- Production acceptance requires separately recorded real authenticated provider API, mailbox/agent permissions, approvals, realtime voice and browser workflows. FIX-01 owns existing source/runtime defects; OPS-01 owns actual production rollout and build-rate-limit.
