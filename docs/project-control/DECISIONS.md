# DECISIONS.md — Architectural Decisions Log

ADR-style log of architectural decisions. Each decision has an ID, date, status, context, decision, consequences, and authority. **Only ChatGPT may approve architectural decisions.** Decisions recorded here are either (a) decisions made by ChatGPT in a prior conversation and recorded here for continuity, or (b) decisions documented by Z.AI during Phase 1 architecture work that **await ChatGPT ratification**.

Statuses: `proposed` (recorded by Z.AI, awaiting ChatGPT), `accepted` (ratified by ChatGPT), `superseded` (replaced by a later ADR), `deprecated` (no longer relevant).

---

## ADR-001 — Reuse Clara reusable AI library as the AI/RAG/voice/agent-runtime core

- **Date:** 2026-10-03
- **Status:** proposed (recorded by Z.AI during Phase 1; the rule itself originates from the master operating prompt §4)
- **Authority:** Master operating prompt §4 (pending ChatGPT ratification of how the rule applies here)
- **Context:** The product requires AI providers, model configuration, chat, realtime voice, RAG, embeddings, agent runtime, tool calling, usage tracking, and AI telemetry. The Clara reusable library at `Rilan-Dev/ai-reusable-libraries` already provides all of these as immutable, byte-for-byte-extracted modules.
- **Decision:** Use Clara directly for AI provider resolution, governance, RAG grounding/retrieval, agent versioning, realtime voice contracts, usage/metering, and embed runtime. Provide thin host adapters for identity, tenancy, secrets, HTTP/Next.js handlers, vendor webhooks, and deployment. Do not create a second abstraction layer on top of Clara.
- **Consequences:** Faster time-to-implementation for AI/voice features. Strong coupling to Clara's module boundary — upgrades to Clara must be coordinated. The host application must not modify `clara-core/source/` files. Detailed in `docs/architecture/CLARA-INTEGRATION.md`.

---

## ADR-002 — PostgreSQL as authoritative store, Qdrant (via Clara) as semantic index, Redis as transient, RabbitMQ as async queue

- **Date:** 2026-10-03
- **Status:** proposed (recorded by Z.AI during Phase 1; the rule itself originates from the master operating prompt §14)
- **Authority:** Master operating prompt §14 (pending ChatGPT ratification of store selection)
- **Context:** The product has an authoritative email store (must be PostgreSQL), a semantic retrieval index (vector store), transient hot state (caches, rate-limit counters, session state), and asynchronous work (sync workers, embedding generation, scheduled jobs).
- **Decision:** PostgreSQL (Supabase) is the authoritative application state. Qdrant (operated via Clara's existing vector-store contracts) is the semantic retrieval index — the vector store is **not** the authoritative email store. Redis is transient/hot state only. RabbitMQ is the asynchronous event/work queue.
- **Consequences:** Three additional infrastructure components beyond PostgreSQL (Qdrant, Redis, RabbitMQ). Operational complexity increases; observability and deployment architecture must account for all four. Email content lives in PostgreSQL; only embeddings live in Qdrant. Detailed in `docs/architecture/DATA-MODEL.md` and `docs/architecture/EVENTS-AND-QUEUES.md`.

---

## ADR-003 — Email provider adapter model with capability discovery

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §9 (pending ChatGPT ratification)
- **Context:** Email must support Gmail, generic IMAP/SMTP, Zoho, and future providers. Not every provider supports every capability (Gmail has labels, IMAP has folders, Zoho has its own folder/label hybrid). The system must not assume a uniform capability surface.
- **Decision:** Define a provider-neutral `EmailProvider` interface with a `capabilities()` method that returns the supported capability set at runtime. Concrete adapters (`GmailAdapter`, `ImapSmtpAdapter`, `ZohoAdapter`) declare their capabilities; the agent runtime and UI query capabilities before invoking an operation. Operations include connect, disconnect, account discovery, folders, labels, synchronization, messages, threads, search, drafts, update draft, send, reply, forward, read/unread, archive, move, labels.
- **Consequences:** Slightly more complex runtime (must check capabilities before each operation), but enables provider diversity without if/else sprawl. Future providers (e.g., Outlook Graph API) can be added with a new adapter and no changes to the runtime. Detailed in `docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md` and `docs/specs/PROVIDER-CONTRACTS.md`.

---

## ADR-004 — Exactly one WhatsApp Business account per agent

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §7 (pending ChatGPT ratification)
- **Context:** The product allows multiple email accounts per agent but constrains WhatsApp to exactly one Business account per agent.
- **Decision:** Model `agent_whatsapp_accounts` as a 1:1 relationship between `agents` and `whatsapp_accounts`. The schema enforces uniqueness on `(agent_id)`. Multiple agents may share the same WhatsApp Business number only if the user explicitly configures it (this is an operational decision, not an architectural one — the schema allows it but the UI warns).
- **Consequences:** Simpler WhatsApp runtime (no per-account routing). One webhook endpoint per WhatsApp Business account. Webhook events are routed to the owning agent(s) via a lookup. Detailed in `docs/architecture/WHATSAPP-ARCHITECTURE.md`.

---

## ADR-005 — Agent runtime: one tool registry, three input surfaces (chat, voice, WhatsApp)

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §10 (pending ChatGPT ratification)
- **Context:** The same agent tools must be invocable from web chat, realtime voice, and WhatsApp. Three separate agent implementations would fragment authorization, audit, and tool maintenance.
- **Decision:** Build one agent runtime with a shared tool registry. Each input surface (chat, voice, WhatsApp) normalizes its input into a common `AgentRequest` shape (intent, context, authorization subject, audit metadata) and routes it through the same `intent → context → policy → authorization → execution → audit` pipeline. Surface-specific concerns (voice cancellation, WhatsApp message segmentation, chat streaming) live in thin transport adapters.
- **Consequences:** Strong consistency across surfaces. Adding a new tool once makes it available everywhere. Voice-specific concerns (cancellation, latency) are isolated to the voice transport adapter and the Clara realtime runtime. Detailed in `docs/architecture/AI-ARCHITECTURE.md`.

---

## ADR-006 — Email content is untrusted input; the LLM never authorizes sensitive actions

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §11 and §12 (pending ChatGPT ratification)
- **Context:** Email content can contain prompt injection, malicious HTML, malicious attachments, impersonation, and social-engineering attempts. The LLM must not be the authority for sensitive external actions (send, forward, delete, bulk modify, mailbox rule changes).
- **Decision:** All email content is treated as untrusted data — it is parsed, sanitized, and embedded but never executed as instructions. The authorization flow is `request → intent → policy → authorization → tool execution → audit`. Sensitive operations require explicit authorization policy (per-user, per-agent, per-organization). The LLM proposes an action; a deterministic policy engine decides whether to execute it.
- **Consequences:** Two-tier tool registry: "safe" tools (read, search, summarize, classify, draft) execute inline; "sensitive" tools require approval (immediate or queued). User-configurable approval policies (auto-approve, always-ask, never-allow). Detailed in `docs/architecture/SECURITY.md` and `docs/specs/AUTHORIZATION.md`.

---

## ADR-007 — Next.js (Vercel) frontend + API routes, Supabase PostgreSQL, RabbitMQ workers

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §1, §32, §33, §34 (pending ChatGPT ratification)
- **Context:** The product needs a web UI, server-side API, async workers, a PostgreSQL database, and async queues. Vercel and Supabase are mandated by the master prompt. RabbitMQ is the chosen queue (per ADR-002).
- **Decision:** Frontend + API live in a Next.js application deployed on Vercel. PostgreSQL runs on Supabase. Async workers (sync, parse, index, classify, draft, send, schedule, embedding, summary) run as separate long-lived Node processes (deployed on a worker host — likely Railway, Fly.io, or a Vercel-independent host; final decision in Phase 4) consuming RabbitMQ queues. Redis (Upstash) for transient state.
- **Consequences:** Two deployment targets (Vercel for web/API, worker host for queues). Workers must be operational before sync features can ship. Environment variable strategy must distinguish web vs worker secrets. Detailed in `docs/architecture/DEPLOYMENT.md`.

---

## ADR-008 — Phased delivery: 19 phases from Phase 1 (this) through Phase 19 (deployment verification)

- **Date:** 2026-10-03
- **Status:** proposed
- **Authority:** Master operating prompt §30 (pending ChatGPT ratification; ChatGPT may change the sequence after reviewing the actual repository and Clara Core)
- **Context:** The product is large. Phased delivery with explicit exit criteria and ChatGPT review gates is the mandated governance model.
- **Decision:** The 19-phase roadmap in `docs/plans/ROADMAP.md` is the planning baseline. Each phase has a stated objective, scope, exit criteria, and dependencies. Only ChatGPT can authorize a phase transition. The sequence is a baseline, not an automatic implementation order — ChatGPT may change it.
- **Consequences:** Long delivery timeline. Explicit review gates between every phase. No phase begins without a formal handoff in `ZAI_HANDOFF.md`. Detailed in `docs/plans/ROADMAP.md`.

---

## How to add a new decision

1. Append a new ADR section with the next sequential ID.
2. Status starts as `proposed` if recorded by Z.AI. ChatGPT ratification upgrades it to `accepted`.
3. If a decision supersedes an earlier one, mark the earlier one as `superseded by ADR-N` and reference it in the new decision's context.
4. Update `worklog.md` to record the decision.
