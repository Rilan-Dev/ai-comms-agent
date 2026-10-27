# ai-comms-agent

> Multi-channel AI communications agent — email, WhatsApp, chat, and realtime voice — built on the local agent runtime core (`packages/agent-core`).

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
| **Voice** | Same agent operations exposed through realtime voice. Reuses the shared runtime's realtime architecture — not a second voice system. |
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

## 6. Agent runtime core

The AI runtime boundary is owned by this repository at [`packages/agent-core`](packages/agent-core): a self-contained local package providing:

- AI provider/model resolution and governance (OpenAI, Gemini, Sarvam, TEI)
- Agent runtime, versioning, and deployment
- RAG grounding and retrieval
- Knowledge-base runtime contracts
- Realtime voice — provider-neutral contracts plus OpenAI/Gemini/Sarvam/ElevenLabs transports
- Usage, quotas, entitlements, audit, observability
- Events, queues, and background execution contracts
- Public/embed runtime

The rule is: do not recreate runtime functionality; reuse `packages/agent-core` directly, adapt through a thin adapter, or — only if genuinely necessary — write application-specific code. The historical integration plan is retained in [`docs/architecture/CLARA-INTEGRATION.md`](docs/architecture/CLARA-INTEGRATION.md) (the external reference repository is no longer a submodule and is not a runtime dependency).

---

## 7. License

MIT. See [`LICENSE`](LICENSE).

## AI Project Control

This repository uses repository-first APCP governance. Start with `docs/project-control/NAVIGATION.md`, then follow `CHAT_CONTINUITY.md` → current state/phase → `NEXT_ACTION.md` → authorization/handoff → verification and ledgers. For adaptive requirements, agent routing, no-wait continuation, and copy/paste prompts, use `docs/project-control/ADAPTIVE_PROJECT_CONTROL.md`. This governance layer does not change the product implementation plan.

## APCP agent control

This repository supports independently invokable autonomous APCP roles:

- **DEV-01 / Forge** — product development.
- **FIX-01 / Sentinel** — error diagnosis and remediation.
- **OPS-01 / Shipwright** — CI/CD, deployment, and infrastructure.

Start with `docs/project-control/NAVIGATION.md`. For role behavior use `docs/project-control/AGENT_SKILLS.md`; for direct assignment prompts use `docs/project-control/AGENT_INVOCATION.md`; for ownership use `docs/project-control/AGENT_REGISTRY.md`; for the governance file audit use `docs/project-control/FILES.md`.

These role controls allow a new agent chat to begin while another agent is still working. The new agent recovers its own authorized work from GitHub and does not depend on the other conversation.



## APCP — How to use agents

You can start a brand-new ChatGPT chat with any APCP agent without explaining the project again. The agent must recover the architecture, current work, authorization, project-control state, shared lessons, known mistakes, sessions, and next action from GitHub.

**Human quick guide:** `docs/project-control/HOW_TO_USE_AGENTS.md`

Use it when you need to know **which agent to call, when to call it, how to continue where you left off, how to assign daily/unplanned work, how to run agents concurrently, and which copy/paste prompt to use**.

Registered roles:
- **DEV-01 / Forge** — planned product development.
- **FIX-01 / Sentinel** — bugs, failures, regressions, root-cause correction.
- **OPS-01 / Shipwright** — CI/CD, GitHub Actions, Vercel, Docker, deployment, infrastructure.
- **WORK-01 / Rover** — daily/simple/unplanned safe work and investigations.

Starting an agent selects its role; it does not grant authorization. Shared and role-local memories preserve lessons and prevent repeat mistakes, while current GitHub/project-control state remains authoritative.
