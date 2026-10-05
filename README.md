# ai-comms-agent

> Multi-channel AI communications agent — email, WhatsApp, chat, and realtime voice — built on the [Clara reusable AI library](https://github.com/Rilan-Dev/ai-reusable-libraries).

**Repository:** `Rilan-Dev/ai-comms-agent` (private)
**Vercel project:** `ai-comms-agent` (linked to this repo, production branch `main`)
**Effective date:** 2026-10-03
**Current phase:** Phase 4 — Database Foundation and Migrations

---

## 1. What this project is

`ai-comms-agent` is an organization-owned internal/product application that gives a user a single AI agent capable of operating across four communication surfaces:

| Surface | Capability summary |
|---|---|
| **Email** | Connect multiple Gmail / IMAP-SMTP / Zoho accounts per agent. Continuously sync, preserve threads/folders/labels, search, summarize, classify, draft replies, send when authorized. |
| **WhatsApp** | Exactly one WhatsApp Business account per agent. Receive commands, respond, invoke approved agent tools, push scheduled summaries. |
| **Chat** | Web UI for asking natural-language questions ("summarize today's important emails", "draft a reply to X", "send when authorized"). |
| **Voice** | Same agent operations exposed through Clara realtime voice. Reuses Clara's existing realtime architecture — not a second voice system. |
| **Scheduling** | Durable, recoverable scheduled jobs ("every day at 08:00, summarize last 24h of important/action-required emails and send to WhatsApp"). |

The product is **not** a SaaS billing product. There are no subscription plans, no Stripe, no marketplace billing, no per-tenant invoicing. The system does have organizations, users, roles, permissions, agents, connected accounts, audit logs, usage telemetry, and security boundaries — those are operational requirements, not billing.

---

## 2. Operating model (who does what)

This project uses a strict separation of responsibilities. The full rule set lives in [`docs/project-control/RULES.md`](docs/project-control/RULES.md). The short version:

```text
USER / OWNER
     │
     ▼
CHATGPT — Chief Architect / Project Controller
     │ approved implementation handoff
     ▼
Z.AI — Developer / Implementer
     │ code + tests + evidence + commit
     ▼
GITHUB — Authoritative project state
     │
     ├───────────────┐
     ▼               ▼
 VERCEL        SELF-HOSTED DOCKER
deployment    PostgreSQL / Redis / RabbitMQ / Qdrant
```

- **ChatGPT** leads architecture, phase boundaries, review, acceptance, and correction.
- **Z.AI** implements approved work only. Z.AI does not take architectural ownership.
- **GitHub** is the source of truth. No conversation history is required to recover the project.
- **Vercel** remains a supported web deployment target. **Self-hosted Docker + PostgreSQL** is the current reference runtime. **Tests provide evidence.**

Z.AI must not silently convert a proposal into an architectural decision. The rule is always: propose → ChatGPT reviews → ChatGPT approves/rejects/corrects → Z.AI implements.

---

## 3. Current state

| Field | Value |
|---|---|
Current Phase | Phase 3 — Identity, Organization, Users, Roles & RBAC
Phase status | Implementation in progress; runtime PostgreSQL verification pending
Application code | Foundation + Phase 3 identity/RBAC implemented
Database migrations | Phase 3 migration artifact + Docker verification tooling
Deployments | Previous Phase 3 deployment READY; latest code requires fresh verification
Last commit | See `docs/project-control/PROJECT_STATE.md`
Open blockers | See `docs/project-control/ISSUES.md`
Next action | See `docs/project-control/NEXT_ACTION.md`

The project is now in active implementation. The project-control documents are the source of truth for phase, verification, blockers, and next action.

---

## 4. Self-hosted Docker quick start

The application uses externally provisioned infrastructure in development and deployment. PostgreSQL, Redis, RabbitMQ, and Qdrant are not started automatically by the application or Vercel.

Local infrastructure is opt-in only. The default development/deployment path uses external services configured through environment variables.

If you intentionally want the disposable local infrastructure for verification, enable it explicitly:

```bash
docker compose -f infra/docker-compose.yml --profile local-infra up -d
```

For the full manual Docker stack, which is also opt-in:

```bash
cp .env.docker.example .env.docker
# Replace CREDENTIALS_MASTER_KEY and SESSION_SIGNING_KEY with real random values.
bash scripts/manual-up.sh
```

Normal web development does not start PostgreSQL, Redis, RabbitMQ, or Qdrant automatically.

For verification:

```bash
bash scripts/verify.sh
```

Real `.env` / `.env.docker` files are intentionally ignored by Git. Never commit credentials.

---

## 4. Fresh-conversation recovery procedure

If you are a fresh ChatGPT or Z.AI conversation picking up this project, read the following files **in this order**:

1. `README.md` (this file)
2. `AGENTS.md` — navigation and mandatory rules for any AI agent
3. `docs/project-control/PROJECT_STATE.md` — current phase, commit, blockers
4. `docs/project-control/CURRENT_PHASE.md` — phase status and scope
5. `docs/project-control/NEXT_ACTION.md` — the next authorized action
6. `docs/project-control/ZAI_HANDOFF.md` — the formal handoff (if any)
7. `docs/project-control/VERIFICATION_STATE.md` — what was actually verified
8. `docs/project-control/DECISIONS.md` — architectural decisions log
9. `docs/project-control/ISSUES.md` and `docs/project-control/RISKS.md`
10. `docs/project-control/CHAT_CONTINUITY.md` — full continuity protocol
11. `worklog.md` — audit trail
12. The relevant `docs/architecture/*.md` files for your assigned scope
13. The latest Git history (`git log --oneline -50`)

After reading these files, you must be able to answer: *What was planned? What was completed? What was actually verified? What failed? What remains? What is the next authorized action?* If you cannot, the project-control documentation is incomplete — flag it before doing any work.

Full continuity protocol: [`docs/project-control/CHAT_CONTINUITY.md`](docs/project-control/CHAT_CONTINUITY.md).

---

## 5. Repository layout

```text
ai-comms-agent/
├── README.md                          ← this file
├── AGENTS.md                          ← mandatory first-read for any AI agent
├── worklog.md                         ← audit trail (append-only)
├── LICENSE
├── .gitignore
│
├── docs/
│   ├── project-control/               ← durable control plane
│   │   ├── PROJECT_STATE.md
│   │   ├── RULES.md
│   │   ├── CURRENT_PHASE.md
│   │   ├── NEXT_ACTION.md
│   │   ├── ZAI_HANDOFF.md
│   │   ├── VERIFICATION_STATE.md
│   │   ├── DECISIONS.md
│   │   ├── ISSUES.md
│   │   ├── RISKS.md
│   │   ├── CHAT_CONTINUITY.md
│   │   └── sessions/                  ← per-session notes (initially empty)
│   │
│   ├── architecture/                  ← architecture documents
│   │   ├── ARCHITECTURE.md
│   │   ├── DATA-MODEL.md
│   │   ├── AI-ARCHITECTURE.md
│   │   ├── REALTIME-VOICE-ARCHITECTURE.md
│   │   ├── EMAIL-PROVIDER-ARCHITECTURE.md
│   │   ├── WHATSAPP-ARCHITECTURE.md
│   │   ├── EVENTS-AND-QUEUES.md
│   │   ├── SECURITY.md
│   │   ├── OBSERVABILITY.md
│   │   ├── UI-UX.md
│   │   ├── DEPLOYMENT.md
│   │   └── CLARA-INTEGRATION.md
│   │
│   ├── specs/                         ← contracts and specifications
│   │   ├── PRODUCT.md
│   │   ├── PROVIDER-CONTRACTS.md
│   │   ├── TOOL-CONTRACTS.md
│   │   ├── AUTHORIZATION.md
│   │   ├── EVENT-CONTRACTS.md
│   │   └── API-CONTRACTS.md
│   │
│   └── plans/
│       └── ROADMAP.md                 ← phase-by-phase implementation plan
│
└── .github/                           ← CI/workflows will land in Phase 2 (intentionally empty now)
```

No `apps/`, `packages/`, `services/`, or `src/` directories exist yet. They will be created in Phase 2 after ChatGPT approves this Phase 1 package.

---

## 6. Reference library

This project depends on the **Clara reusable AI library** at <https://github.com/Rilan-Dev/ai-reusable-libraries>. Clara provides reusable, immutable, byte-for-byte-extracted modules for:

- AI provider/model resolution and governance (OpenAI, Gemini, Sarvam, TEI)
- Agent runtime, versioning, and deployment
- RAG grounding and retrieval (Qdrant-backed)
- Knowledge-base runtime contracts
- Realtime voice — provider-neutral contracts plus OpenAI/Gemini/Sarvam/ElevenLabs transports
- Usage, quotas, entitlements, audit, observability
- Events, queues, and background execution contracts
- Public/embed runtime

Before implementing any AI-related functionality, the developer must inspect the relevant Clara source. The integration plan is in [`docs/architecture/CLARA-INTEGRATION.md`](docs/architecture/CLARA-INTEGRATION.md). The rule is: do not recreate Clara functionality; reuse it directly, adapt through a thin adapter, or — only if genuinely necessary — write application-specific code.

---

## 7. License

MIT. See [`LICENSE`](LICENSE).
