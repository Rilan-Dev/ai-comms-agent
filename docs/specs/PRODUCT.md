# PRODUCT.md — Product Specification

This document specifies the product: who it's for, what it does, and the boundaries of its scope. It is the canonical product reference for all phases.

---

## 1. Product purpose

`ai-comms-agent` is an organization-owned internal/product application that gives a user a single AI agent capable of operating across four communication surfaces — email, WhatsApp, chat, and realtime voice — plus durable scheduling. The agent connects to the user's existing email accounts (Gmail, IMAP/SMTP, Zoho), connects to exactly one WhatsApp Business account, and exposes a web UI for chat plus a realtime voice mode.

The product is **not** a SaaS billing product. It does not have subscription plans, customer billing, marketplace billing, or usage-based customer invoicing (per `RULES.md §5`). It is an internal/product tool for an organization.

---

## 2. Users

- **Organization owners**: configure the organization, manage members, manage provider credentials, set security policy.
- **Administrators**: do everything owners can except delete the organization.
- **Members**: create and manage agents, connect email/WhatsApp accounts, use chat/voice/WhatsApp, manage their own schedules and automations.
- **Viewers**: read-only access to agents, activity, audit (no mutations).

A user can belong to multiple organizations. Role is per-organization.

---

## 3. Agents

An agent is the unit of AI configuration and action. Each agent has:

- An identity (name, description, slug).
- A versioned configuration (AI model, voice, prompts, tool allowlist, KB bindings, security policy).
- A current deployment (which version is live).
- Connected email accounts (multiple, with per-account role).
- One connected WhatsApp Business account (at most).
- Schedules (durable, recoverable).
- Automation rules (event-triggered).
- An activity history and audit trail.

Multiple agents can coexist in one organization. Each agent operates independently.

---

## 4. Email capability

An agent can:

- Connect multiple Gmail accounts.
- Connect multiple generic IMAP/SMTP accounts.
- Connect Zoho accounts.
- Support future email providers through adapters (per `EMAIL-PROVIDER-ARCHITECTURE.md`).
- Continuously synchronize email (initial sync + incremental sync, with webhook + poll fallback).
- Store synchronized email locally (PostgreSQL authoritative; Qdrant for semantic index).
- Preserve threads (grouped by provider thread ID or `References` header).
- Preserve folders and labels (provider-specific).
- Search email (server-side where supported, client-side fallback, plus semantic search via Qdrant).
- Summarize email (per-thread, per-day, per-custom-range).
- Identify important email (classifier assigns `importance_score`).
- Identify action-required email (classifier sets `action_required` flag).
- Identify deadlines (extract dates from email content; surface in summary).
- Create drafts (not sent).
- Create reply drafts (not sent).
- Send email **only when authorized** (per `AUTHORIZATION.md`).
- Support future operations (forward, move, archive) — added in later phases.

The agent maintains provider synchronization state (`email_sync_states`) so that sync survives worker restarts and is resumable.

---

## 5. WhatsApp capability

Each agent may connect exactly one WhatsApp Business account/phone number (per `WHATSAPP-ARCHITECTURE.md`).

The agent can:

- Receive WhatsApp messages (via Meta Cloud API webhook).
- Interpret messages as commands (intent classification, same as chat).
- Respond through WhatsApp (outbound via Meta Cloud API).
- Invoke approved agent tools (same tool registry as chat/voice).
- Send email-related results through WhatsApp (e.g., "you have 3 important emails today...").
- Send scheduled summaries to WhatsApp (per schedule).
- Maintain WhatsApp conversation history (`whatsapp_messages`, `whatsapp_contacts`).
- Process webhook status events (`sent`, `delivered`, `read`, `failed`).

Template message compliance is enforced (first outbound to a new contact must use an approved template — per `WHATSAPP-ARCHITECTURE.md §5`).

---

## 6. Chat capability

Users can ask the agent natural-language questions and give commands through the web UI chat panel. Example requests:

- "Summarize today's emails."
- "Summarize the last 24 hours."
- "Summarize the last 2 days."
- "Summarize the last 3 days."
- "Show important emails."
- "Show action-required emails."
- "Find emails from Alice."
- "Draft a response to Bob's email about the project."
- "Prepare a reply to the thread about Q4 planning."
- "Send an email to Charlie when authorized."

Chat uses streaming (SSE). Tool calls are shown inline. Sensitive actions require inline approval.

---

## 7. Voice capability

Users can perform the same agent operations through Clara realtime voice. The voice architecture reuses Clara's existing realtime architecture (per `REALTIME-VOICE-ARCHITECTURE.md`) — it is not a second voice system.

Voice supports:

- OpenAI Realtime
- Gemini Live
- Sarvam
- ElevenLabs

Voice-specific concerns (cancellation, latency, reconnect) are handled by Clara's `voice-core/realtime/*` modules.

---

## 8. Scheduling capability

Users can schedule durable, recoverable actions. Example:

> "Every day at 08:00, summarize the last 24 hours of important/action-required emails and send the summary to WhatsApp."

Scheduled jobs are:

- Stored in PostgreSQL (`scheduled_jobs`) — durable.
- Fired by a cron-loop worker.
- Idempotent per fire (one execution per `(scheduled_job_id, fire_at)`).
- Recoverable (if the cron-loop is down, missed fires are caught up on restart, within a configurable grace period).
- Audited (`scheduled_job_runs`).

Schedules can be one-shot (`one_fire_at`) or recurring (`cron`).

---

## 9. Automation capability

Users can define automation rules: trigger + action.

- **Triggers**: email from X arrives, email marked action-required, email classified as important, scheduled time, etc.
- **Actions**: draft reply, send WhatsApp summary, classify and label, extract information, etc.

Automation rules are stored in `automation_rules`. Each fire creates an `automation_runs` row for audit.

Automation rules can be enabled/disabled per rule. They are scoped to an agent.

---

## 10. Authorization model (summary)

Per `AUTHORIZATION.md`:

- **Safe operations** (read, search, summarize, classify, extract, draft): auto-execute.
- **Sensitive operations** (send, forward, delete, bulk modify, mailbox rule changes, external side effects): require explicit authorization policy. The LLM never authorizes — a deterministic policy engine does.

Per-organization policy overrides (auto-approve / always-ask / never-allow) are configurable.

Email content is untrusted input — it never becomes authority (per `RULES.md §9`).

---

## 11. Out of scope (Phase 1)

- No application code.
- No database migrations.
- No deployment.
- No CI.
- No OAuth client registration (Gmail, Zoho).
- No WhatsApp Business Account registration.
- No Supabase project provisioning.

These are tracked in `ISSUES.md` and `RISKS.md` and addressed in their respective phases.

---

## 12. Long-term vision (informational)

Future phases (post-Phase-19) may add:

- Additional email providers (Outlook Graph, Proton Mail Bridge).
- Additional voice providers.
- Mobile app (separate from responsive web).
- Multi-agent orchestration (one agent invokes another).
- Knowledge marketplace (share KBs across organizations — but no billing).
- On-prem deployment option.

These are **not** in the Phase 1-19 scope. They are recorded here for context only.
