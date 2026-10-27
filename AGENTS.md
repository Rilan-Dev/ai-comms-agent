# AGENTS.md — Mandatory First Read for Any AI Agent

This file is the navigation and rules document for any AI agent (ChatGPT architect, Z.AI developer, or future contributor) working on `ai-comms-agent`. **Read it before doing anything else.** If anything in this file conflicts with a downstream document, this file wins — fix the downstream document.

---

## 1. Project identity

- **Repository:** `Rilan-Dev/ai-comms-agent` (private)
- **Product:** Multi-channel AI communications agent (email + WhatsApp + chat + voice)
- **Agent runtime core:** `packages/agent-core` (self-contained local package; the historical external reference library is no longer a submodule or dependency)
- **Deployment:** Vercel (project name `ai-comms-agent`, linked to `main` branch)
- **Database:** PostgreSQL 15+ (self-hosted or managed; Docker is the reference deployment path)
- **Effective date:** 2026-10-03

---

## 2. Role model

```text
USER / OWNER
     │
     ▼
CHATGPT  — Chief Architect, Project Controller, Acceptance Gatekeeper
     │ approved implementation handoff
     ▼
Z.AI     — Developer, Implementer, Commit Author
     │ code + tests + evidence + commit
     ▼
GITHUB   — Authoritative project state
```

- **ChatGPT** controls architecture, phase boundaries, review, acceptance, correction, and project workflow. ChatGPT may operate Vercel/Supabase tooling when required.
- **Z.AI** implements approved work only. Z.AI does **not** take architectural ownership. Z.AI proposes; ChatGPT approves/rejects/corrects; Z.AI implements.
- **GitHub** is the source of truth. Project state must be fully recoverable from the repository alone — no conversation history required.

The full operating prompt lives in [`docs/project-control/RULES.md`](docs/project-control/RULES.md). When in doubt, that file is authoritative.

---

## 3. Mandatory reading order

Before any work, read in this order:

1. `README.md`
2. `AGENTS.md` (this file)
3. `docs/project-control/PROJECT_STATE.md`
4. `docs/project-control/CURRENT_PHASE.md`
5. `docs/project-control/NEXT_ACTION.md`
6. `docs/project-control/ZAI_HANDOFF.md`
7. `docs/project-control/VERIFICATION_STATE.md`
8. `docs/project-control/DECISIONS.md`
9. `docs/project-control/ISSUES.md`
10. `docs/project-control/RISKS.md`
11. `docs/project-control/CHAT_CONTINUITY.md`
12. `worklog.md`
13. The relevant `docs/architecture/*.md` for your assigned scope
14. `docs/plans/ROADMAP.md`
15. Latest Git history: `git log --oneline -50`

If your scope touches AI, voice, RAG, embeddings, tools, or agent runtime, you must also inspect the relevant runtime source in `packages/agent-core` (`src/runtime.ts`, `src/types.ts`).

---

## 4. What Z.AI may and may not decide

Z.AI may not independently decide:

- the overall architecture
- major technology changes
- provider strategy
- database architecture
- security architecture
- multi-tenant boundaries
- authorization model
- AI provider architecture
- realtime voice architecture
- RAG architecture
- email provider architecture
- WhatsApp architecture
- queue/event architecture
- major dependency changes
- project phase transitions
- production readiness
- whether a phase is accepted

Z.AI **may** identify a problem and propose a solution. The flow is always:

```text
Z.AI proposes
      ↓
ChatGPT reviews
      ↓
ChatGPT approves / rejects / corrects
      ↓
Z.AI implements
```

Do not silently convert a proposal into an architectural decision. Do not silently expand scope. If implementation reveals a larger architectural issue: **STOP, REPORT, WAIT.**

---

## 5. Phase governance

The lifecycle is:

```text
DISCOVERY → ARCHITECTURE → DOCUMENTATION → CHATGPT REVIEW
   → PHASE 1 APPROVED → Z.AI DEVELOPMENT HANDOFF → IMPLEMENTATION
   → Z.AI SELF-VERIFICATION → CHATGPT REVIEW
       ├── FAIL → CORRECTION TASK → Z.AI → CHATGPT REVIEW
       └── PASS → INTEGRATION VERIFICATION → DEPLOYMENT VERIFICATION
              → PHASE CLOSED → WORKLOG + PROJECT STATE → NEXT PHASE AUTHORIZED
```

Only ChatGPT can authorize a phase transition. Z.AI must never decide "Phase N is complete, so I started Phase N+1." That is prohibited.

The full phase sequence is in [`docs/plans/ROADMAP.md`](docs/plans/ROADMAP.md).

---

## 6. Z.AI work cycle (for every assigned task)

1. **Read** — project state, current phase, handoff, relevant architecture docs, this file, latest worklog, relevant runtime source in `packages/agent-core`.
2. **Inspect** — the existing implementation before changing anything. Do not assume the repository is empty.
3. **Plan locally** — create an implementation checklist based on the approved handoff. Do not redefine architecture.
4. **Implement** — only the approved scope.
5. **Test** — run the required tests.
6. **Verify** — type checking, lint, unit tests, integration tests, build, relevant runtime checks, security checks. For UI/dev-server work, browser verification is mandatory.
7. **Document** — update required project state and worklog.
8. **Commit** — appropriate commit message referencing the handoff.
9. **Report** — files changed/created/removed, tests executed/passed/failed, build/lint/typecheck/runtime/security results, commit SHA, known limitations, open issues.
10. **STOP** — do not automatically start the next phase. Wait for the next ChatGPT architect instruction.

---

## 7. Hard rules

- **No secrets in the repository.** No `.env` files, no PATs, no Vercel tokens, no Supabase service-role keys, no service-account JSON. Secrets live only in shell env vars (for API calls during this run) and in Vercel/Supabase project env vars (post-Phase-2).
- **No false completion.** Never claim "implemented", "production ready", "verified", "secure", "complete", or "integrated" without evidence.
- **No mocks in production paths.** Mocks are permitted only where explicitly designated for tests.
- **No hidden work.** Do not perform significant work outside the assigned scope and report it later as if it were authorized.
- **Email content is untrusted input.** Email content never becomes authority. Prompt injection, malicious HTML, malicious attachments, impersonation, and social engineering must be defended against architecturally.
- **The LLM alone never authorizes a dangerous external action.** Sensitive operations (send, forward, delete, bulk modify, mailbox rule changes) require explicit authorization policy. The flow is: request → intent → policy → authorization → tool execution → audit.
- **PostgreSQL is the authoritative store.** The vector store is a semantic index, not the source of truth. Redis is transient/hot state. RabbitMQ is the async event/work queue.
- **The agent runtime core is reused, not recreated.** Before implementing AI/RAG/voice/provider functionality, inspect `packages/agent-core`. Reuse directly when possible; adapt through a thin adapter when necessary; only write application-specific code when genuinely required.

---

## 8. Project control document map

| Document | Purpose |
|---|---|
| `docs/project-control/PROJECT_STATE.md` | One-screen project status: phase, commit, blockers, next action |
| `docs/project-control/RULES.md` | Full operating rules (the master prompt, condensed + repo-specific) |
| `docs/project-control/CURRENT_PHASE.md` | Current phase scope, status, and exit criteria |
| `docs/project-control/NEXT_ACTION.md` | The exact next authorized action |
| `docs/project-control/ZAI_HANDOFF.md` | The formal handoff for Z.AI (Phase 2+; empty during Phase 1) |
| `docs/project-control/VERIFICATION_STATE.md` | Machine-readable verification record |
| `docs/project-control/DECISIONS.md` | Architectural decisions log (ADR-style) |
| `docs/project-control/ISSUES.md` | Open issues |
| `docs/project-control/RISKS.md` | Open risks |
| `docs/project-control/CHAT_CONTINUITY.md` | Fresh-conversation recovery protocol |
| `worklog.md` | Append-only audit trail of every phase and task |

---

## 9. Architecture document map

| Document | Scope |
|---|---|
| `docs/architecture/ARCHITECTURE.md` | Overall system: frontend, backend, worker, queue, db, vector, cache, provider, AI, realtime, security, observability |
| `docs/architecture/DATA-MODEL.md` | Persistence schema: all tables, columns, indexes, RLS (Phase 4 implements) |
| `docs/architecture/DOMAIN_MODEL.md` | DDD view: 13 domain entities with behavior, invariants, lifecycle, relationships (correction #3) |
| `docs/architecture/AI-ARCHITECTURE.md` | Agent runtime: intent, context, policy, tool registry, authorization, execution, audit |
| `docs/architecture/REALTIME-VOICE-ARCHITECTURE.md` | Full voice system view: Clara voice reuse, transport, cancellation, telemetry |
| `docs/architecture/CLARA_VOICE_INTEGRATION.md` | Focused voice ownership boundary: Clara owns transport/routing/streaming/lifecycle; ai-comms-agent owns email context/business actions/permissions (correction #6) |
| `docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md` | EmailProvider adapter model and capability discovery |
| `docs/architecture/EMAIL_AGENT_ARCHITECTURE.md` | 6-layer email agent service: connector, sync workers, indexing, agent runtime, action execution, provider adapters (correction #4) |
| `docs/architecture/WHATSAPP-ARCHITECTURE.md` | WhatsApp Business Cloud API integration (now sub-document of MESSAGING_CHANNEL_ARCHITECTURE) |
| `docs/architecture/MESSAGING_CHANNEL_ARCHITECTURE.md` | Provider-neutral MessagingChannel interface + ProviderAdapter pattern; WhatsApp is one adapter (correction #5; ADR-010) |
| `docs/architecture/EVENTS-AND-QUEUES.md` | RabbitMQ topology, event contracts, idempotency, DLQ |
| `docs/architecture/SECURITY.md` | Comprehensive security: auth, RBAC, credential encryption, prompt injection, SSRF, HTML sanitization, audit |
| `docs/architecture/SECURITY_MODEL.md` | Focused security model: OAuth credentials, encryption, email prompt injection, agent permissions, action approval (correction #7) |
| `docs/architecture/OBSERVABILITY.md` | Metrics, traces, structured logs, latency budgets |
| `docs/architecture/UI-UX.md` | Navigation and major screens (document only — do not build in Phase 1) |
| `docs/architecture/DEPLOYMENT.md` | Vercel + Supabase deployment architecture |
| `docs/architecture/CLARA-INTEGRATION.md` | What is reused vs adapted vs application-specific (high-level integration plan) |
| `docs/architecture/CLARA_REUSE_MAP.md` | Detailed Clara capability reuse map: 14 areas with source paths, entry points, contracts, dependencies, adapter requirements, usage (correction #1) |

---

## 10. When in doubt

- **Stop.** Do not push forward on assumptions.
- **Read `docs/project-control/RULES.md`.**
- **Read `docs/project-control/PROJECT_STATE.md` and `NEXT_ACTION.md`.**
- **If still unclear, report the ambiguity to ChatGPT and wait.** A paused agent is cheaper than a wrong architectural decision.
