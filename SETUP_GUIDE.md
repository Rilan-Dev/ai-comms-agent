# ai-comms-agent — Project Setup Guide

This guide walks you through cloning, configuring, and running the ai-comms-agent platform locally and on Vercel.

> **Not technical?** If you are a business owner or non-technical user setting up a workspace on an already-running deployment, use [`FIRST_TIME_SETUP_GUIDE.md`](FIRST_TIME_SETUP_GUIDE.md) instead — it covers first-time registration, workspace naming, and everyday setup without any server work.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | >=20.0.0 | JavaScript runtime |
| pnpm | 12.8.1 (via corepack) | Package manager (monorepo) |
| PostgreSQL | 15+ (or Prisma Postgres) | Primary database |
| Redis | 7+ (or Redis Cloud) | Transient state / lease coordination |
| RabbitMQ | 3.13+ (or CloudAMQP) | Background job queue |
| Qdrant | 1.12+ (or Qdrant Cloud) | Vector search (optional, for RAG) |
| Git | any | Clone the repository |

---

## 1. Clone & Install

```bash
git clone https://github.com/Rilan-Dev/ai-comms-agent.git
cd ai-comms-agent
corepack enable pnpm                       # enable pnpm via corepack
pnpm install --no-frozen-lockfile          # install all workspace deps
```

## 2. Configure Environment

```bash
cp .env.example .env.docker                # for worker + docker
cp .env.example apps/web/.env.local         # for Next.js web app
```

Edit BOTH files and replace ALL placeholder values with your real credentials. See `.env.example` for detailed comments on each variable.

### Critical variables to set:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Prisma Postgres Data Proxy URL |
| `REDIS_URL` | Redis Cloud connection string |
| `RABBITMQ_URL` | CloudAMQP connection string |
| `QDRANT_URL` + `QDRANT_API_KEY` | Qdrant Cloud cluster URL + API key |
| `CREDENTIALS_MASTER_KEY` | Generate: `openssl rand -base64 32` |
| `SESSION_SIGNING_KEY` | Generate: `openssl rand -base64 32` |
| `AUTH_BOOTSTRAP_TOKEN` | Generate: `openssl rand -base64 32` (min 32 chars) |
| `AI_PROVIDER` | `openai`, `gemini`, or `sarvam` |
| At least one AI API key | `OPENAI_API_KEY` / `GEMINI_API_KEY` / `SARVAM_API_KEY` |

## 3. Run Database Migrations

```bash
# Option A: Use the Node.js migration runner (recommended when psql is not available)
cd packages/db
DATABASE_URL="your-postgres-url" node migrate.js

# Option B: Use the project's shell script (requires psql)
cd ../..
bash scripts/migrate.sh

# Option C: Full reset + migrate (destructive — drops and recreates schemas)
RESET_DATABASE_CONFIRM=YES bash scripts/reset-and-migrate.sh
```

## 4. Build & Start

```bash
# Build the Next.js web app
pnpm --filter @ai-comms-agent/web build

# Start the production web server (port 3000)
pnpm --filter @ai-comms-agent/web start

# In a separate terminal, start the background worker
pnpm --filter @ai-comms-agent/worker start
```

Or use the idempotent launcher:

```bash
bash start-stack.sh    # starts web + worker if not already running
```

## 5. Bootstrap the First Admin Account

Open `http://localhost:3000/setup` in your browser and fill in:
- **Bootstrap token**: the `AUTH_BOOTSTRAP_TOKEN` value from your `.env`
- **Your name**: e.g. "Rilan Owner"
- **Email**: e.g. `owner@ai-comms-agent.local`
- **Password**: min 12 chars with uppercase, lowercase, and a number
- **Organization name**: e.g. "My Workspace"
- **Organization slug**: e.g. `my-workspace` (lowercase, alphanumeric + hyphens)

After bootstrap, sign in at `http://localhost:3000/login` with the email and password you chose.

## 6. Configure Gmail / Zoho OAuth

### Gmail OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/oauth/gmail/callback` (local dev)
   - `https://YOUR-VERCEL-URL.vercel.app/api/oauth/gmail/callback` (production)
4. Copy the Client ID and Client Secret
5. In the app: go to **Settings → Gmail OAuth** and save the client ID/secret
6. Go to **Mail → Accounts → Connect Gmail** and complete the OAuth consent flow

### Zoho Mail OAuth
1. Go to [Zoho API Console](https://api-console.zoho.com/) → Server-based Applications
2. Add authorized redirect URIs:
   - `http://localhost:3000/api/oauth/zoho/callback` (local dev)
   - `https://YOUR-VERCEL-URL.vercel.app/api/oauth/zoho/callback` (production)
3. Copy the Client ID and Client Secret
4. In the app: go to **Settings → Zoho OAuth** and save the client ID/secret
5. Go to **Mail → Accounts → Connect Zoho** and complete the OAuth consent flow

> **Note on Zoho data centers**: Zoho has multiple data centers (.com, .in, .eu, .au, etc.). Make sure the data center you select in Settings matches your Zoho Mail account's actual data center. Check your Zoho Mail URL — if it's `mail.zoho.in`, your DC is India (.in).

## 7. Configure IMAP/SMTP (non-OAuth email providers)

For email providers that don't support OAuth (or when you prefer password auth):
1. Go to **Mail → Accounts → Connect IMAP/SMTP**
2. Enter the IMAP host, port (usually 993 for IMAPS), SMTP host, port (usually 465 for SMTPS)
3. Enter the email username and password (for Gmail, use an [App Password](https://myaccount.google.com/apppasswords))
4. The connection test validates IMAP LOGIN + SMTP AUTH PLAIN before saving

## 8. Configure AI Providers

AI providers can be configured in two ways:

### A. Environment Variables (platform-level fallback)
Set in `.env` or Vercel Project Settings:
- `AI_PROVIDER` — default provider (openai, gemini, sarvam)
- `OPENAI_API_KEY` / `GEMINI_API_KEY` / `SARVAM_API_KEY`
- `REALTIME_VOICE_PROVIDER` — voice provider
- `ELEVENLABS_API_KEY` — for ElevenLabs voice

### B. Database (per-organization, takes priority)
Go to **Settings → AI Providers** in the UI:
- Save provider API keys (encrypted with `CREDENTIALS_MASTER_KEY`)
- Select models dynamically (fetched from the provider's API via `GET /api/settings/ai-models?provider=openai`)
- Configure per-organization AI runtime settings (default provider, temperature, max tokens, system prompt, voice settings)

> **Dynamic models**: The `GET /api/settings/ai-models?provider=openai` endpoint calls OpenAI's `/v1/models` API (or Gemini's `/v1beta/models`) to fetch the live list of available models. Falls back to a curated static list when the API is unreachable (region-blocked, no key, etc.).

## 9. Deploy to Vercel

1. Push your code to GitHub `main` branch — Vercel auto-deploys
2. Or trigger a deployment via the Vercel API:
   ```bash
   curl -X POST "https://api.vercel.com/v13/deployments?projectId=YOUR_PROJECT_ID" \
     -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"ai-comms-agent","gitSource":{"type":"github","org":"Rilan-Dev","repo":"ai-comms-agent","ref":"main"},"target":"production","source":"cli"}'
   ```
3. Set all environment variables in Vercel Project Settings → Environment Variables
4. Set `APP_ORIGIN` and `NEXT_PUBLIC_APP_URL` to your Vercel production URL
5. Disable Vercel SSO Protection (Project Settings → Deployment Protection) for public access

### Vercel production URLs
The project has multiple automatic aliases:
- `https://YOUR-PROJECT.vercel.app` (short alias)
- `https://YOUR-PROJECT-git-main-TEAM.vercel.app` (branch alias)
- `https://YOUR-DEPLOYMENT-TEAM.vercel.app` (deployment-specific)

All `*.vercel.app` origins are accepted by the same-origin check.

---

## Architecture Overview

```
User Browser ──▶ Next.js Web App (Vercel / local)
                    │
                    ├── PostgreSQL (Prisma Postgres) — primary data store
                    ├── Redis (Redis Cloud) — transient state / leases
                    ├── RabbitMQ (CloudAMQP) — background job queue
                    ├── Qdrant (Qdrant Cloud) — vector search (RAG)
                    │
                    └── Background Worker (local / Docker)
                          ├── Email sync (IMAP / Gmail API / Zoho API)
                          ├── RabbitMQ consumer (email.sync queue)
                          ├── Scheduled jobs (cron-loop)
                          └── WhatsApp inbound/outbound
```

## Key Commands

| Command | Description |
|---|---|
| `pnpm --filter @ai-comms-agent/web dev` | Start Next.js dev server (hot reload) |
| `pnpm --filter @ai-comms-agent/web build` | Build production web app |
| `pnpm --filter @ai-comms-agent/web start` | Start production web server |
| `pnpm --filter @ai-comms-agent/worker start` | Start background worker |
| `pnpm --filter @ai-comms-agent/web test` | Run vitest test suite |
| `pnpm --filter @ai-comms-agent/web typecheck` | TypeScript type checking |
| `bash start-stack.sh` | Idempotent launcher (starts web + worker) |
| `bash scripts/e2e-final.sh` | End-to-end smoke test |
| `bash scripts/manual-up.sh` | Docker Compose stack (requires Docker) |

## Login Credentials (after bootstrap)

| Field | Value |
|---|---|
| Login URL | `http://localhost:3000/login` (local) or `https://YOUR-VERCEL-URL.vercel.app/login` |
| Email | The email you chose during bootstrap |
| Password | The password you chose during bootstrap |

## Troubleshooting

### "Invalid request origin" on login
The `APP_ORIGIN` env var doesn't match the URL you're accessing. For Vercel, any `*.vercel.app` subdomain is accepted. For custom domains, set `APP_ORIGIN` to your custom domain.

### "ensureDevSeed MUST NOT be called in production"
Fixed — `ensureDevSeed()` is now a no-op in production. If you see this error, you're running an older build. Pull latest `main` and redeploy.

### "AGENT_KB_ID is not configured"
Fixed — KB ID is now optional (defaults to "default"). RAG features are skipped when no KB is configured. Basic chat/voice works without a knowledge base.

### Zoho OAuth "rejected the authorization code"
1. Verify the redirect URI in Zoho API Console matches EXACTLY: `https://YOUR-VERCEL-URL.vercel.app/api/oauth/zoho/callback`
2. Make sure the data center (.in, .eu, etc.) matches your Zoho Mail account
3. Restart the OAuth flow from Settings → Zoho OAuth

### IMAP/SMTP "authentication failed"
1. For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) (not your regular password)
2. The app password format `abcd efgh ijkl mnop` works with or without spaces
3. If you see "TLS response timeout", the IMAP server may be rate-limiting after many retries. Wait 24h or use a different IP.

### Chat "AI provider request failed"
1. Check that `AI_PROVIDER` is set to a supported provider (`openai`, `gemini`, `sarvam`)
2. Check that the corresponding API key is set (env var or DB-stored via Settings → AI Providers)
3. OpenAI may return 403 `unsupported_country_region_territory` — switch to Sarvam or Gemini if your Vercel region is blocked

### Voice session stays in "starting" state
Fixed — `configureStartingVoiceSessionForOrganization` now sets `status='active'` and `connected_at=now()` in the same UPDATE. If you see this, you're running an older build.

### Email sync errors
Check the worker log (`worker.log`) for the specific error. Common causes:
- Missing schema columns (run the latest migrations — see `supabase/migrations/`)
- IMAP rate limiting (wait for cooldown)
- Gmail API quota exceeded (use OAuth instead of IMAP for higher quotas)
