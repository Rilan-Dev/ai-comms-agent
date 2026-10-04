# DEPLOYMENT.md — Deployment Architecture

This document defines the deployment architecture: where each component runs, how it's configured, how it's verified, and how it's operated. Per the master operating prompt §32, a successful local build does not equal production readiness — deployment verification is mandatory.

This is a Phase 1 document. Concrete deployment configurations are produced in Phase 19 (Deployment and production verification).

---

## 1. Components and where they run

| Component | Runtime | Hosting | Provisioned in |
|---|---|---|---|
| Web UI + API (Next.js) | Node 20+ | Vercel | Phase 2 (already linked) |
| Worker processes (Node) | Node 20+ | Worker host (TBD — see ADR-007) | Phase 4 (infra setup) |
| PostgreSQL | Supabase | Supabase | Phase 4 |
| Qdrant | Self-hosted on worker host OR Qdrant Cloud | TBD | Phase 10 |
| Redis | Upstash | Upstash | Phase 4 |
| RabbitMQ | CloudAMQP OR self-hosted on worker host | TBD | Phase 4 |
| ClamAV (attachment scan) | Worker host | Worker host | Phase 9 |
| Relay (Sarvam/Gemini voice) | Worker host | Worker host | Phase 16 |

The worker host (single host running workers, RabbitMQ, Qdrant, ClamAV, voice relay) is the leading candidate for simplicity. If scale demands, components split to dedicated hosts in a future phase.

---

## 2. Vercel project configuration

- **Project name**: `ai-comms-agent`
- **Project ID**: `prj_VdO5pwIma53uGKqtt5EzRiry7JtG`
- **Team ID**: `team_UQKWM8HLJvyr4sBGNHIidVwH`
- **Production branch**: `main`
- **Preview branches**: all other branches (auto-deploy)
- **Framework**: Next.js
- **Build command**: `next build` (default)
- **Output directory**: `.next` (default)
- **Install command**: `npm ci` (or `pnpm install --frozen-lockfile` if pnpm)
- **Node version**: 20 (set in `package.json` `engines` or Vercel project settings)
- **Functions**: default Vercel function config; some routes may need `maxDuration` increase (e.g., voice session token issuance, webhook processing) — set per-route in `next.config.js`
- **Environment variables** (server-only, never exposed to the browser bundle):
  - `DATABASE_URL` (Supabase connection string)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only — workers use this; API uses anon+RLS where possible)
  - `SUPABASE_ANON_KEY` (safe for browser)
  - `SUPABASE_URL`
  - `CREDENTIALS_MASTER_KEY` (KEK for envelope encryption)
  - `SESSION_SIGNING_KEY`
  - `REDIS_URL` (Upstash)
  - `RABBITMQ_URL` (CloudAMQP or worker host)
  - `QDRANT_URL`
  - `QDRANT_API_KEY` (if Qdrant Cloud)
  - `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`
  - `ZOHO_OAUTH_CLIENT_ID`, `ZOHO_OAUTH_CLIENT_SECRET`
  - `WHATSAPP_APP_SECRET` (for webhook signature verification)
  - `WHATSAPP_SYSTEM_USER_TOKEN` (if workers share it; otherwise per-worker)
  - `OPENAI_API_KEY` (if platform-default; org-level keys are in DB)
  - `GEMINI_API_KEY`, `SARVAM_API_KEY`, `ELEVENLABS_API_KEY` (same)
  - `CLAMAV_HOST` (worker host; not needed on Vercel)
  - `NEXT_PUBLIC_*` (browser-safe): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`

Vercel preview deploys get the same env vars (no separate staging env in Phase 1; Phase 17 may add a staging Supabase project).

---

## 3. Worker host configuration

- **Host**: Railway / Fly.io / Render / self-hosted VM (decision in Phase 4 — ADR-007).
- **Process manager**: `systemd` or `pm2` or Docker Compose (decided in Phase 4).
- **Workers** (one process per queue group, or one process per queue):
  - `worker.email-sync` (consumes `email.sync`)
  - `worker.email-parse` (consumes `email.parse`)
  - `worker.email-index` (consumes `email.index`, `embedding.generate`)
  - `worker.email-attachments` (consumes `email.attachments`)
  - `worker.email-classify` (consumes `email.classify`)
  - `worker.email-draft` (consumes `email.draft`)
  - `worker.email-send` (consumes `email.send`, `email.action`)
  - `worker.whatsapp-inbound` (consumes `whatsapp.inbound`)
  - `worker.whatsapp-outbound` (consumes `whatsapp.outbound`)
  - `worker.agent-schedule` (consumes `agent.schedule`)
  - `worker.agent-execute` (consumes `agent.execute`)
  - `worker.summary-generate` (consumes `summary.generate`)
  - `worker.voice-telemetry` (consumes `voice.telemetry`)
  - `worker.audit-persist` (consumes `audit.persist`)
  - `cron-loop` (per-minute tick to fire scheduled jobs — enqueues `agent.schedule`)
- **Co-located services** (on the same host):
  - RabbitMQ (if self-hosted)
  - Qdrant (if self-hosted)
  - ClamAV
  - Voice relay (Sarvam wire, Gemini Live relay)
- **Env vars** (subset of Vercel env vars + worker-only):
  - `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
  - `CREDENTIALS_MASTER_KEY`
  - `REDIS_URL`, `RABBITMQ_URL`, `QDRANT_URL`
  - All provider API keys (workers make provider calls)
  - `CLAMAV_HOST` (localhost if co-located)

---

## 4. Supabase project configuration

- **Project name**: `ai-comms-agent` (or `ai-comms-agent-prod` if separate staging)
- **Region**: same as Vercel deployment region (lowest latency)
- **Plan**: Pro (for backups, PITR)
- **Database**: PostgreSQL 15+ (Supabase default)
- **Extensions**: `pgcrypto` (UUID), `pg_trgm` (trigram search), `unaccent` (accent-insensitive search), `citext` (case-insensitive text)
- **Auth**: Supabase Auth (optional — we may use our own auth; decided in Phase 3)
- **Storage**: Supabase Storage (for email attachments, KB documents)
- **RLS**: enabled on every tenant-scoped table
- **Migrations**: forward-only, named `NNNN_description.sql`, applied via `supabase migration` CLI
- **Backups**: daily (Supabase Pro default), PITR enabled
- **Connection pooling**: PgBouncer (Supabase default), connection limit monitored

Supabase project is provisioned by the user before Phase 4 (per RSK-001).

---

## 5. CI/CD pipeline

CI is added in Phase 2 (`.github/workflows/ci.yml`). The pipeline:

1. **On every PR**:
   - Install dependencies (`npm ci`)
   - Typecheck (`tsc --noEmit`)
   - Lint (`eslint .`)
   - Unit tests (`npm test`)
   - Build (`npm run build`)
   - Secret scan (git-secrets or similar)
2. **On push to `main`**:
   - All PR checks
   - Vercel auto-deploys to production
   - Migration dry-run (if migrations changed)
3. **On tag `v*`**:
   - All PR checks
   - Build artifact
   - (Optional) publish to worker host

Migration application is **manual** (not auto-applied in CI) — per `RULES.md §11`, no destructive database operation should be performed casually. Migrations are reviewed by ChatGPT and applied by an admin via `supabase migration apply`.

---

## 6. Environment strategy

- **Production**: Vercel production deployment + production Supabase + production worker host.
- **Preview**: Vercel preview deployment per branch + production Supabase (read-only where possible) + production worker host (shared). Preview deploys do not run their own workers — they share the production worker host. (Phase 17 may add a staging Supabase if needed.)
- **Local development**: Vercel dev + local Supabase (Docker) + local RabbitMQ (Docker) + local Redis (Docker) + local Qdrant (Docker). Setup script in Phase 2.

Local development does not connect to production providers. Test email accounts (Gmail test accounts, Meta test number) are used.

---


## 6A. Local Docker manual verification and testing

The repository now provides a reproducible Docker path for manual testing without relying on GitHub Actions. This is **not production deployment** and does not provision Supabase.

- `infra/docker-compose.verify.yml`: disposable PostgreSQL 17 used for migration/runtime verification.
- `scripts/migrate.sh`: applies all forward migrations in lexical order and records SHA-256 checksums; an already-applied migration that changes fails closed.
- `scripts/migration-changes.sh`: detects migration drift against the local migration ledger.
- `scripts/verify-docker.sh`: starts PostgreSQL, applies/checks migrations, verifies the Phase 3 owner invariant, and verifies direct ownerless organization creation is rejected.
- `scripts/verify.sh`: the complete local gate — Docker DB verification, workspace typecheck, web tests/build, and worker build.
- `infra/docker-compose.manual.yml`: full manual stack (Next.js web, worker, PostgreSQL, Redis, RabbitMQ, Qdrant). The `migrate` service automatically applies migrations before web/worker start.
- `scripts/manual-up.sh` / `scripts/manual-down.sh`: start/stop the manual stack.

Typical manual verification:

```bash
bash scripts/verify.sh
bash scripts/manual-up.sh
```

The CI workflow delegates to `scripts/verify.sh`, keeping local and CI verification on the same implementation rather than maintaining two independent test procedures.

## 7. Deployment verification (Phase 19)

Per the master operating prompt §32:

```text
Z.AI implementation → ChatGPT review → Vercel/Supabase operations → deployment → runtime verification → production acceptance
```

Phase 19 verifies:

1. **Build**: `npm run build` succeeds in CI.
2. **Vercel deploy**: production deployment succeeds; deployment URL responds 200.
3. **Supabase migrations**: all migrations applied; schema verified; RLS policies verified; advisors run.
4. **Smoke tests**: auth flow, agent creation, email account connection (test Gmail account), WhatsApp send (Meta test number), chat turn, voice session start, scheduled job fire.
5. **Observability**: logs flow to aggregator; metrics scrape; traces export; alerts route.
6. **Security**: pen test (internal); secret scan; RLS bypass attempts; prompt injection attempts.
7. **Performance**: load test (representative traffic); p95 latencies within budgets.
8. **Backup/restore**: Supabase backup verified; restore tested in staging.

Each verification produces evidence (logs, screenshots, test reports) committed to the repo under `docs/verification/phase-19/`.

---

## 8. Rollback

- **Vercel**: instant rollback to previous deployment (one click in Vercel dashboard).
- **Supabase migrations**: forward-only — rollback is a forward migration that reverses the change. No `down.sql` files. (Per `RULES.md §11`, no destructive database operation should be performed casually — rollback migrations are reviewed like forward migrations.)
- **Worker host**: previous container image redeployed (if using Docker) or previous binary restarted.
- **Clara library**: pinned version in `package.json`; upgrades are explicit and reviewed.

---

## 9. Operational runbooks

Phase 17 produces runbooks for:

- On-call rotation and escalation
- DLQ message investigation and replay
- Provider outage response (Gmail, WhatsApp, AI providers)
- Supabase incident response
- Worker host incident response
- Secret rotation (KEK, provider keys, session signing key)
- Audit log export
- Backup restore

Runbooks live in `docs/runbooks/` (created in Phase 17).

---

## 10. Cost management

- **Vercel**: Pro plan (per user). Bandwidth and function execution monitored.
- **Supabase**: Pro plan (per project). Database size and egress monitored.
- **Upstash**: pay-as-you-go. Redis commands per day monitored.
- **CloudAMQP**: pay-as-you-go or fixed tier. Queue depth and message rate monitored.
- **Worker host**: per-instance. CPU/memory monitored.
- **AI providers**: per-org cost tracking in `ai_usage_events` (per `OBSERVABILITY.md §9`).

Cost dashboards are part of the admin observability dashboard (Phase 17).

---

## 11. What is deferred to Phase 19

- Concrete worker host selection and provisioning.
- Concrete observability vendor selection.
- Concrete CI/CD pipeline implementation.
- Concrete runbook authoring.
- Concrete deployment verification execution.

Phase 19 is the final phase before production acceptance. ChatGPT review gates every step.
