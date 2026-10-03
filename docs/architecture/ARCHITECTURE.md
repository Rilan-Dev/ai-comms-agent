# ARCHITECTURE.md — Overall System Architecture

This document is the top-level architecture for `ai-comms-agent`. It defines every major subsystem, their responsibilities, and their boundaries. Lower-level architecture documents (`DATA-MODEL.md`, `AI-ARCHITECTURE.md`, `REALTIME-VOICE-ARCHITECTURE.md`, `EMAIL-PROVIDER-ARCHITECTURE.md`, `WHATSAPP-ARCHITECTURE.md`, `EVENTS-AND-QUEUES.md`, `SECURITY.md`, `OBSERVABILITY.md`, `UI-UX.md`, `DEPLOYMENT.md`, `CLARA-INTEGRATION.md`) elaborate on each subsystem.

This is a **Phase 1 document**. It defines the system completely before any application code is written. Per the master operating prompt §31, the application template must emerge from the architecture — not the other way around.

---

## 1. Product summary

`ai-comms-agent` is an organization-owned internal/product application that gives a user a single AI agent capable of operating across four communication surfaces (email, WhatsApp, chat, voice) plus scheduling. The agent has one tool registry; each surface is a thin transport adapter that normalizes input into a common `AgentRequest` and routes it through one `intent → context → policy → authorization → execution → audit` pipeline. The product is not a SaaS billing product (per `RULES.md §5`).

---

## 2. System diagram

```text
                                  ┌────────────────────────────────────────────────────┐
                                  │                    USER                              │
                                  └────────────────────────────────────────────────────┘
                                                            │
                          ┌────────────────────┬───────────┴────────────┬────────────────────┐
                          ▼                    ▼                        ▼                    ▼
                    ┌──────────┐        ┌────────────┐          ┌──────────────┐      ┌──────────────┐
                    │  Web UI  │        │  WhatsApp  │          │  Chat (web)  │      │  Voice (web) │
                    │ (Vercel) │        │  Business  │          │  Clara chat  │      │ Clara realtime│
                    └─────┬────┘        └─────┬──────┘          └──────┬───────┘      └──────┬───────┘
                          │                   │                        │                     │
                          │                   │ (webhook)              │                     │
                          ▼                   ▼                        ▼                     ▼
              ┌─────────────────────────────────────────────────────────────────────────────────┐
              │                       Next.js API (Vercel)                                       │
              │   auth · orgs · agents · email accounts · whatsapp · schedules · audit           │
              └──────────────┬──────────────────────────────────────────────┬───────────────────┘
                             │                                                │
                             │ enqueues                                       │ invokes
                             ▼                                                ▼
              ┌──────────────────────────────┐                ┌─────────────────────────────────┐
              │       RabbitMQ queues         │                │        Agent runtime             │
              │  email.sync · email.parse ·   │                │  intent → context → policy →    │
              │  email.index · email.send ·   │                │  authorization → execution →    │
              │  whatsapp.in/out ·            │                │  audit                          │
              │  agent.execute · summary ·    │                │  ┌─────────────────────────┐    │
              │  embedding · audit · ...      │                │  │   Tool registry          │   │
              └──────────────┬───────────────┘                │  │  (email.read, email.draft,│   │
                             │                                 │  │   email.send, whatsapp.*, │   │
                             ▼                                 │  │   summary.*, voice.* ...) │   │
              ┌──────────────────────────────┐                │  └────────────┬────────────┘    │
              │       Worker processes         │                │               │                 │
              │  (Node, RabbitMQ consumers)    │◀───────────────┼───────────────┘                 │
              │  sync · parse · index · send   │                │                                 │
              │  classify · draft · schedule   │                ▼                                 │
              └──────────────┬───────────────┘                ┌─────────────────────────────────┐
                             │                                 │      Clara reusable core          │
                             │                                 │  ai-core · ai-governance ·        │
                             │                                 │  voice-core · rag · knowledge ·   │
                             │                                 │  agent-versioning · embed          │
                             │                                 └──────────────┬──────────────────┘
                             │                                                │
                             ▼                                                ▼
              ┌─────────────────────────────────────────────────────────────────────────┐
              │                              Providers                                    │
              │  Gmail · IMAP/SMTP · Zoho · WhatsApp · OpenAI · Gemini · Sarvam ·        │
              │  ElevenLabs · Qdrant · Resend (transactional)                              │
              └─────────────────────────────────────────────────────────────────────────┘
                             │                                                │
                             ▼                                                ▼
              ┌──────────────────────────────┐                ┌─────────────────────────────────┐
              │   PostgreSQL (Supabase)       │                │   Qdrant (vector index)          │
              │   authoritative state         │                │   email/KB embeddings            │
              └──────────────────────────────┘                └─────────────────────────────────┘
              ┌──────────────────────────────┐                ┌─────────────────────────────────┐
              │   Redis (Upstash)             │                │   RabbitMQ (CloudAMQP)           │
              │   transient / hot state        │                │   async event/work queue         │
              └──────────────────────────────┘                └─────────────────────────────────┘
```

---

## 3. Subsystem responsibilities

### 3.1 Web UI (Vercel, Next.js App Router)

- Renders the operational navigation: Overview, Agents, Mail (Accounts/Inbox/Threads/Drafts), WhatsApp, Automations, Schedules, AI & Voice, Knowledge, Activity, Audit, Settings (see `UI-UX.md`).
- Agent configuration surface: Overview, AI, Voice, Email, WhatsApp, Knowledge, Tools, Automations, Schedules, Security, Activity, Versions.
- Talks only to the Next.js API routes (same Vercel project). Never talks to providers, Qdrant, RabbitMQ, Redis, or Supabase directly. Provider credentials are never exposed to the browser.
- Realtime voice transport runs in the browser via Clara's `voice-core/realtime` modules; the browser connects to provider realtime endpoints through a relay (Clara's existing pattern). The browser never sees provider API keys — it receives short-lived session tokens issued by the API.

### 3.2 Next.js API (Vercel, Next.js Route Handlers / Server Actions)

- Auth (login, session, MFA, organization membership, RBAC).
- CRUD for organizations, users, agents, email accounts, WhatsApp accounts, schedules, automations.
- Webhook receivers: WhatsApp inbound, email provider notifications (Gmail Pub/Sub, IMAP IDLE, Zoho webhooks), OAuth callbacks.
- Issues short-lived realtime voice session tokens to the browser.
- Enqueues work to RabbitMQ for async processing.
- Invokes the agent runtime synchronously for chat (streamed) and asynchronously for scheduled/WhatsApp-triggered work.

### 3.3 Agent runtime (in-process within API + worker)

- One runtime, one tool registry. Three input surfaces (chat, voice, WhatsApp) normalize into a common `AgentRequest`.
- Pipeline: `intent → context → policy → authorization → execution → audit`. See `AI-ARCHITECTURE.md`.
- Built on Clara's `ai-core`, `ai-governance`, `agent-versioning`, `rag`, and `voice-core` modules. See `CLARA-INTEGRATION.md`.

### 3.4 Worker processes (Node, RabbitMQ consumers, deployed on a worker host — see ADR-007)

- Long-lived Node processes consuming RabbitMQ queues.
- One consumer per queue (or one process per group of related queues). Concurrency is per-queue, configurable.
- Consumers: `email.sync`, `email.parse`, `email.index`, `email.attachments`, `email.classify`, `email.draft`, `email.send`, `email.action`, `whatsapp.inbound`, `whatsapp.outbound`, `agent.schedule`, `agent.execute`, `summary.generate`, `embedding.generate`, `voice.telemetry`, `audit.persist`.
- Idempotency: every consumer deduplicates by `idempotency_key` (derived from provider event ID + content hash). Dead-letter queue per source queue with exponential backoff.

### 3.5 PostgreSQL (Supabase) — authoritative state

- All application state: organizations, users, roles, permissions, agents, agent_versions, agent_deployments, email_accounts, email_folders, email_threads, email_messages, email_attachments, email_sync_states, whatsapp_accounts, whatsapp_contacts, whatsapp_messages, conversations, conversation_messages, scheduled_jobs, automation_rules, email_actions, summaries, ai_provider_configs, ai_usage_events, voice_sessions, audit_events. See `DATA-MODEL.md`.
- RLS enforced for organization isolation. `authenticated` alone is never authorization — explicit RBAC checks are mandatory.

### 3.6 Qdrant — semantic index (operated via Clara)

- Embeddings for email messages, knowledge-base documents, and (optionally) agent memory.
- **Not authoritative** — the source of truth is PostgreSQL. Qdrant is rebuilt from PostgreSQL if lost.
- Operated via Clara's `knowledge-bases/core/vector-store.ts` and `admin/core/vector-store.ts` contracts.

### 3.7 Redis (Upstash) — transient / hot state

- Rate-limit counters, session cache, idempotency dedup window, realtime voice session state, queue backoff state.
- Never holds authoritative data — losing Redis is recoverable from PostgreSQL + RabbitMQ.

### 3.8 RabbitMQ (CloudAMQP) — async event/work queue

- Topology and contracts in `EVENTS-AND-QUEUES.md`.
- Every queue has a dead-letter exchange. Every message has `idempotency_key`, `correlation_id`, `producer`, `consumer`, `attempt_count`, `enqueued_at`, `payload`.

### 3.9 Providers (external)

- Email: Gmail (OAuth + Pub/Sub), IMAP/SMTP (OAuth or password), Zoho (OAuth + IMAP).
- WhatsApp: WhatsApp Business Cloud API (Meta).
- AI: OpenAI, Gemini, Sarvam, TEI (embeddings) — operated via Clara's `ai-core` provider abstraction.
- Voice: OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs — operated via Clara's `voice-core` provider abstraction.
- Vector: Qdrant.
- Transactional email (for product notifications, not user email): Resend (or similar).

---

## 4. Architectural principles

1. **PostgreSQL is authoritative.** The vector store is a semantic index, not the source of truth. Redis is transient. RabbitMQ is async.
2. **Clara is reused, not recreated.** AI/RAG/voice/agent-runtime capabilities come from Clara. Host adapters wrap host-bound concerns (identity, tenancy, secrets, HTTP handlers, vendor webhooks).
3. **One agent runtime, one tool registry.** Chat, voice, and WhatsApp are transport adapters, not separate runtimes.
4. **Email content is untrusted.** Email never becomes authority. The LLM never authorizes sensitive actions — a deterministic policy engine does.
5. **No secrets in the repo.** `.gitignore` enforces this defensively. Secrets live in Vercel/Supabase project env vars (post-Phase-2).
6. **Idempotency everywhere.** Every async operation has an idempotency key and deduplicates. Every queue has a DLQ.
7. **Capability discovery over assumption.** Email providers declare their capabilities at runtime. The runtime queries before invoking.
8. **Observability is a first-class subsystem.** Every request, every queue message, every tool execution emits structured logs, metrics, and traces. See `OBSERVABILITY.md`.

---

## 5. Request flows

### 5.1 Chat: "summarize today's important emails"

```text
User → Web UI → POST /api/chat/stream
  → API: authn/authz → resolve agent → build AgentRequest
  → Agent runtime:
      intent: summarize_emails
      context: today's important emails (read from PostgreSQL via email.read tool)
      policy: safe (read-only) — auto-execute
      authorization: implicit (user owns the agent)
      execution: invoke email.read → summarize → stream response
      audit: append audit_events
  → SSE stream → Web UI
```

### 5.2 Chat: "send an email to X"

```text
User → Web UI → POST /api/chat/stream
  → API: authn/authz → resolve agent → build AgentRequest
  → Agent runtime:
      intent: send_email
      context: draft (from email.draft tool) + recipient
      policy: SENSITIVE (send) — requires authorization
      authorization: check user's send policy
          → if auto-approve allowed: proceed
          → if always-ask: create email_action + email_action_approval, pause, surface to user
          → if never-allow: refuse with audit
      execution (if authorized): enqueue email.send
      audit: append audit_events
  → SSE stream (with approval prompt if needed) → Web UI
```

### 5.3 WhatsApp inbound

```text
Meta → POST /api/webhooks/whatsapp (signature-verified)
  → API: verify signature → dedupe by message_id
  → enqueue whatsapp.inbound { agent_id, message }
  → RabbitMQ → worker:
      parse → build AgentRequest (intent from message content)
      → Agent runtime (same pipeline as chat)
      → enqueue whatsapp.outbound { agent_id, response }
  → worker: POST WhatsApp Cloud API → Meta → user's phone
```

### 5.4 Scheduled job: "every day at 08:00, summarize last 24h"

```text
Cron (per-agent) → enqueue agent.schedule { agent_id, schedule_id, fire_at }
  → RabbitMQ → worker:
      build AgentRequest (intent: scheduled_summarize, params from schedule)
      → Agent runtime (same pipeline)
      → enqueue whatsapp.outbound { agent_id, summary }
  → worker: POST WhatsApp → user's phone
```

### 5.5 Realtime voice

```text
User → Web UI (voice mode) → POST /api/voice/session
  → API: authn/authz → resolve agent → resolve voice config (Clara voice-core)
  → issue short-lived realtime session token (provider-specific)
  → Web UI: open realtime connection to provider (via Clara relay if needed)
  → User speaks → provider transcribes → API invokes agent runtime (intent from transcription)
  → Agent runtime: same pipeline (voice transport adapter handles cancellation/latency)
  → Response text → provider TTS → user hears response
  → Telemetry: voice.telemetry queue → audit
```

---

## 6. Boundaries — what lives where

| Concern | Lives in | Rationale |
|---|---|---|
| User auth, session, MFA | Next.js API | Vercel-hosted, edge-friendly |
| OAuth callback handling | Next.js API | Needs HTTP handler |
| Email account credentials (encrypted) | PostgreSQL | Authoritative; encrypted at rest |
| Email message bodies | PostgreSQL | Authoritative; full-text search via `tsvector` + Qdrant for semantic |
| Email embeddings | Qdrant | Semantic retrieval; rebuilt from PostgreSQL if lost |
| Rate-limit counters | Redis | Hot, transient |
| Sync cursors / history | PostgreSQL (`email_sync_states`) | Must survive Redis loss |
| Scheduled job triggers | Worker process (cron loop) + PostgreSQL (`scheduled_jobs`) | Durable, recoverable |
| Webhook signature verification | Next.js API | Edge-friendly, low-latency |
| Long-running sync work | Worker process | Cannot exceed Vercel function timeout |
| Realtime voice session tokens | Next.js API (issues) + Web UI (consumes) | Short-lived; provider-specific |
| Provider API keys (Gmail, WhatsApp, AI, voice) | Vercel project env vars (server-only) | Never exposed to browser |
| Audit events | PostgreSQL (`audit_events`) | Authoritative; immutable append |

---

## 7. What this architecture explicitly defers

- The **worker host** (Railway / Fly.io / Render / other) is not yet selected. ADR-007 lists candidates; ChatGPT decides before Phase 9. See ISS-004.
- The **transactional email provider** for product notifications (distinct from user email) is not yet selected. Candidates: Resend, Postmark, SendGrid. Decided in Phase 2.
- The **OAuth client registration** for Gmail, Zoho, and (if used) IMAP providers is not yet done. The user registers OAuth clients before Phases 6/7/8.
- The **Supabase project** is not provisioned. RSK-001.
- The **WhatsApp Business Account** is not registered. RSK-004.

These deferrals are tracked in `ISSUES.md` and `RISKS.md` and are not blockers for Phase 1 (documentation-only).
