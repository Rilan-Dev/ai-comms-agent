# ROADMAP.md — Phase-by-Phase Implementation Plan

This document is the canonical phase-by-phase implementation plan for `ai-comms-agent`. It is the planning baseline from the master operating prompt §30 — ChatGPT may change the sequence after reviewing the actual repository and Clara Core.

**Only ChatGPT can authorize a phase transition.** Z.AI must never decide "Phase N is complete, so I started Phase N+1." Each phase has exit criteria; meeting exit criteria triggers a ChatGPT review, not an automatic transition.

---

## Phase 1 — Project Definition and Architecture ✅ (this phase)

- **Objective**: Completely define the project before Z.AI begins implementation.
- **Scope**: Documentation only — no application code, no migrations, no deployment.
- **Deliverables**: All files in `docs/project-control/`, `docs/architecture/`, `docs/specs/`, `docs/plans/`, plus `README.md`, `AGENTS.md`, `worklog.md`, `LICENSE`, `.gitignore`.
- **Exit criteria**:
  - All deliverables committed.
  - Fresh-chat recovery test passed.
  - ChatGPT architect review: approve / reject / correct.
- **Status**: Documentation complete; awaiting ChatGPT review.

---

## Phase 2 — Application Foundation and Approved Project Template

- **Objective**: Produce the application template (emerging from the architecture, not the other way around — per `RULES.md §31`).
- **Scope**:
  - Monorepo setup (pnpm or turborepo — decided in Phase 2).
  - `apps/web` (Next.js App Router, TypeScript, Tailwind, shadcn/ui).
  - `apps/worker` (Node, RabbitMQ consumer framework).
  - `packages/shared` (types, schemas, utilities).
  - `packages/db` (PostgreSQL client, migration framework, RLS helpers).
  - CI workflow (`.github/workflows/ci.yml`): typecheck, lint, unit tests, build, secret scan.
  - Local development setup (Docker Compose for PostgreSQL, RabbitMQ, Redis, Qdrant).
  - Deep audit of Clara library (per `CLARA-INTEGRATION.md §8`).
  - Clara integration (package dependency or submodule).
  - Thin end-to-end vertical slice: auth stub + one read-only email view (mock data) to de-risk the architecture.
- **Exit criteria**:
  - `npm run build` succeeds in CI.
  - Local dev environment runs (`docker compose up` + `npm run dev`).
  - Vertical slice renders in the browser.
  - Clara deep audit complete; `CLARA-INTEGRATION.md` updated with corrections.
  - ChatGPT review: approve / reject / correct.

---

## Phase 3 — Authentication / Organization / Users / RBAC

- **Objective**: Implement the identity and tenancy layer.
- **Scope**:
  - Email + password auth (argon2 hash).
  - Magic-link auth (optional in Phase 3; required by Phase 19).
  - MFA (TOTP, RFC 6238).
  - Session management (HttpOnly cookies, JWT, refresh token rotation).
  - OAuth providers (Google, GitHub — optional).
  - Organizations, memberships, roles, permissions.
  - Custom roles (optional).
  - API keys (optional in Phase 3).
  - RLS policies for all tenant-scoped tables.
  - Envelope encryption for credentials (`email_account_credentials`, `ai_provider_configs`, etc.).
- **Exit criteria**:
  - Login / logout / MFA flows work end-to-end.
  - Org switcher works.
  - Member invite / remove / role change works.
  - RLS verified: cross-org access fails.
  - Encryption verified: credentials in DB are ciphertext.
  - ChatGPT review: approve / reject / correct.

---

## Phase 4 — Database Foundation and Migrations

- **Objective**: Stand up the full database schema and migration pipeline.
- **Scope**:
  - Provision or connect any PostgreSQL 15+ deployment (self-hosted Docker is supported and preferred for the current environment).
  - Forward-only migration framework (`supabase migration`).
  - All migrations for Phase 1-3 entities plus the full application domain schema on PostgreSQL.
  - All migrations for email/WhatsApp/conversation/schedule/automation/summary/usage/voice/audit entities.
  - RLS policies on every tenant-scoped table.
  - Indexes (per `DATA-MODEL.md`).
  - PostgreSQL-compatible object-storage adapter boundary for attachments/KB documents; local filesystem/S3-compatible storage is selected by deployment.
  - `pg.Pool` connection pooling and optional PgBouncer verification.
  - Worker host selection and provisioning (per ADR-007 / ISS-004 — ChatGPT decides before Phase 4 starts).
  - RabbitMQ / Redis / Qdrant provisioning (worker host).
- **Exit criteria**:
  - All migrations applied to staging Supabase.
  - Schema verified against `DATA-MODEL.md`.
  - RLS verified (cross-org access fails for every table).
  - Worker host operational (workers can connect to RabbitMQ, Redis, Qdrant, Supabase).
  - ChatGPT review: approve / reject / correct.

---

## Phase 5 — Email Provider Abstraction

- **Objective**: Build the `EmailProvider` interface and a mock adapter.
- **Scope**:
  - `EmailProvider` interface (`packages/shared/src/email/provider.ts`).
  - `CapabilitySet` and `CapabilityNotSupported` error.
  - Mock adapter (returns canned data; for testing the runtime without real providers).
  - `email_accounts`, `email_account_credentials`, `email_folders`, `email_labels` CRUD.
  - Email account connection UI (provider selection, OAuth flow start, IMAP form).
  - Capability discovery runtime.
- **Exit criteria**:
  - Mock adapter passes capability discovery tests.
  - Email account connect/disconnect flows work end-to-end with mock.
  - Capability matrix document validated against interface (real-provider validation in Phases 6-8).
  - ChatGPT review: approve / reject / correct.

---

## Phase 6 — Gmail Integration

- **Objective**: Implement the `GmailAdapter`.
- **Scope**:
  - Gmail OAuth client registration (user-provided).
  - `GmailAdapter` (connect, sync, list, search, draft, send, reply, forward, modify, attachments).
  - Gmail Pub/Sub webhook receiver.
  - Token refresh worker.
  - Capability matrix validation against real Gmail API.
- **Exit criteria**:
  - Real Gmail account connects.
  - Initial sync completes (test account with 100+ messages).
  - Incremental sync via Pub/Sub webhook works.
  - Draft / send / reply / forward work end-to-end.
  - Capability matrix in `EMAIL-PROVIDER-ARCHITECTURE.md` validated.
  - ChatGPT review: approve / reject / correct.

---

## Phase 7 — Generic IMAP/SMTP Integration

- **Objective**: Implement the `ImapSmtpAdapter`.
- **Scope**:
  - IMAP/SMTP library selection (likely `imapflow` + `nodemailer`).
  - OAuth 2.0 (RFC 7628) where supported; app-password fallback.
  - `ImapSmtpAdapter` (all capabilities).
  - IMAP IDLE for realtime push (where supported); poller fallback.
  - UIDVALIDITY + modseq-based incremental sync.
  - Threading by `References` header.
- **Exit criteria**:
  - Real IMAP/SMTP account connects (test with Fastmail, ProtonMail Bridge, or self-hosted).
  - Initial sync, incremental sync, IDLE, search, draft, send, reply, forward work.
  - Capability matrix validated.
  - ChatGPT review: approve / reject / correct.

---

## Phase 8 — Zoho Integration

- **Objective**: Implement the `ZohoAdapter`.
- **Scope**:
  - Zoho OAuth client registration (user-provided).
  - `ZohoAdapter` (REST API + IMAP fallback).
  - Zoho webhook receiver.
  - Zoho-specific folder/label hybrid mapping.
- **Exit criteria**:
  - Real Zoho Mail account connects.
  - Sync, search, draft, send, reply, forward work.
  - Capability matrix validated.
  - ChatGPT review: approve / reject / correct.

---

## Phase 9 — Email Synchronization + Queues + Workers

- **Objective**: Full sync pipeline with queues and workers.
- **Scope**:
  - All email queues (`email.sync`, `email.parse`, `email.index`, `email.attachments`, `email.classify`).
  - All email workers (sync, parse, index, attachments, classify).
  - Idempotency dedup (Redis).
  - Retry / DLQ.
  - HTML sanitization at ingest.
  - Attachment virus scan (ClamAV).
  - Full-text search (`tsvector`).
  - Semantic search (Qdrant embeddings via Clara).
  - Sync observability (latency, error rate, queue depth).
- **Exit criteria**:
  - Sync completes for 1000+ message test account within latency budget.
  - Idempotency verified (duplicate events do not duplicate messages).
  - DLQ works (forced failure → DLQ → replay).
  - Search returns relevant results (full-text + semantic).
  - ChatGPT review: approve / reject / correct.

---

## Phase 10 — Email Intelligence + Indexing + RAG

- **Objective**: AI-powered email features.
- **Scope**:
  - Classifier (importance_score, action_required).
  - Deadline extraction.
  - Per-thread / per-day / per-custom-range summarization.
  - RAG over email content (Clara `rag/grounding.ts`, Qdrant-backed).
  - Cross-lingual search (Clara `rag/cross-lingual.ts`).
- **Exit criteria**:
  - Classifier produces sensible scores on test data.
  - Summaries are accurate and concise.
  - RAG retrieval returns relevant context for chat questions.
  - ChatGPT review: approve / reject / correct.

---

## Phase 11 — Agent Runtime + Tools + Authorization

- **Objective**: Build the agent runtime, tool registry, and policy engine.
- **Scope**:
  - `AgentRequest` normalizer for chat / voice / WhatsApp / schedule.
  - Intent classifier (LLM-assisted, deterministic taxonomy).
  - Context assembler (agent config + history + RAG + tool capabilities).
  - Policy engine (deterministic).
  - Tool registry (per `TOOL-CONTRACTS.md`).
  - Safe-tool execution end-to-end.
  - Sensitive-tool execution up to the approval-prompt step.
  - Audit persistence.
  - Clara integration (ai-core, ai-governance, agent-versioning, rag).
- **Exit criteria**:
  - Chat turn completes end-to-end with a safe tool call (e.g., `email.read`).
  - Sensitive tool call (e.g., `email.send`) reaches the approval-prompt step.
  - Policy engine decisions are deterministic and audited.
  - ChatGPT review: approve / reject / correct.

---

## Phase 12 — Draft / Send / Approval System

- **Objective**: Complete the sensitive-action workflow.
- **Scope**:
  - `email_actions` lifecycle (pending → approved/rejected → completed/failed/expired).
  - `email_action_approvals`.
  - Approval UI (inline chat card + standalone queue).
  - `email.send` and `email.action` workers.
  - Approval timeout (auto-expire).
  - Standing approval rules (optional, off by default).
- **Exit criteria**:
  - Approve / reject / edit-draft flows work end-to-end.
  - Send worker executes approved actions.
  - Timeout auto-expires pending actions.
  - ChatGPT review: approve / reject / correct.

---

## Phase 13 — WhatsApp Integration

- **Objective**: Full WhatsApp Business Cloud API integration.
- **Scope**:
  - Webhook receiver (signature-verified).
  - `whatsapp.inbound` worker (parse, dedupe, persist, route to agent).
  - `whatsapp.outbound` worker (send, template compliance, rate limit).
  - Template submission UI.
  - WhatsApp conversation view in UI.
  - Per-phone-number rate limiter (Redis).
  - Status event handling (`sent`, `delivered`, `read`, `failed`).
- **Exit criteria**:
  - Real WhatsApp Business account (or Meta test number) sends and receives.
  - Inbound message triggers agent turn; outbound response delivered.
  - Template compliance enforced (first outbound to new contact uses template).
  - ChatGPT review: approve / reject / correct.

---

## Phase 14 — Scheduling + Automation

- **Objective**: Durable scheduled jobs and automation rules.
- **Scope**:
  - Cron-loop worker (per-minute tick; fires `agent.schedule`).
  - `scheduled_jobs` / `scheduled_job_runs` lifecycle.
  - Missed-fire catch-up (within grace period).
  - `automation_rules` / `automation_runs` lifecycle.
  - Trigger evaluation (email arrived, email classified, scheduled time).
  - Action execution (draft reply, send WhatsApp summary, classify and label).
- **Exit criteria**:
  - Scheduled job fires at the configured time.
  - Missed fires are caught up on worker restart.
  - Automation rules fire on matching triggers.
  - ChatGPT review: approve / reject / correct.

---

## Phase 15 — Clara Chat Integration

- **Objective**: Full chat experience using Clara's chat runtime.
- **Scope**:
  - SSE streaming (per `API-CONTRACTS.md §17`).
  - Conversation persistence (`conversations`, `conversation_messages`, `conversation_turns`).
  - Cancellation (client-side cancel → propagate to LLM provider).
  - Inline tool-call cards.
  - Inline approval prompts.
  - Multi-turn conversations with context.
- **Exit criteria**:
  - Chat turn streams tokens in real time.
  - Tool calls render inline.
  - Approvals render inline.
  - Cancellation stops generation.
  - ChatGPT review: approve / reject / correct.

---

## Phase 16 — Clara Realtime Voice Integration

- **Objective**: Voice mode using Clara's `voice-core` realtime architecture.
- **Scope**:
  - `/api/voice/session` (issue short-lived session token via Clara).
  - `/api/voice/turn` (process voice turn through agent pipeline).
  - Browser voice UI (microphone, transcript, response, latency indicator).
  - Provider wiring (OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs).
  - Relay host (Sarvam wire, Gemini Live relay — if needed).
  - Voice telemetry (`voice.telemetry` worker, `voice_telemetry` table).
  - Cancellation (Clara `generation-coordinator.ts`).
  - Reconnect (Clara `reconnect-policy.ts`).
- **Exit criteria**:
  - Voice session starts, transcribes, responds, ends.
  - TTFA within latency budget (1.5s cold, 800ms warm).
  - Cancellation works (interrupt mid-response).
  - Reconnect works (drop and resume).
  - Telemetry recorded.
  - ChatGPT review: approve / reject / correct.

---

## Phase 17 — Observability + Audit + Security Hardening

- **Objective**: Production-grade observability, audit, and security.
- **Scope**:
  - Observability vendor selection (Axiom / BetterStack / self-hosted).
  - Metric export (Prometheus client).
  - Trace export (OpenTelemetry SDK).
  - Log drain configuration (Vercel + worker host).
  - Alert routing (email, Slack/Teams, PagerDuty).
  - Admin observability dashboard.
  - Per-org dashboard.
  - Runbooks (`docs/runbooks/`).
  - Pen test (internal): prompt injection, CSRF, SSRF, RLS bypass, webhook forgery.
  - Dependency audit (`npm audit`, Snyk/Dependabot).
  - Secret scan (git-secrets in pre-commit + CI).
  - RLS verification (every table).
  - Audit log integrity (insert-only).
  - Encryption verification.
- **Exit criteria**:
  - Metrics, traces, logs flow to aggregator.
  - Alerts fire on simulated failures.
  - Pen test findings remediated (or accepted with documented risk).
  - No high-severity vulnerabilities in production deps.
  - ChatGPT review: approve / reject / correct.

---

## Phase 18 — End-to-End Testing

- **Objective**: Verify the full system end-to-end.
- **Scope**:
  - E2E test suite (Playwright or similar).
  - Test scenarios:
    - Connect Gmail, sync, search, summarize, draft, approve send.
    - Connect WhatsApp, receive inbound, agent responds.
    - Schedule daily summary, verify delivery to WhatsApp.
    - Voice session: ask for today's important emails, hear response.
    - Automation rule fires on incoming email.
    - RLS: cross-org access fails.
    - DLQ: forced failure → DLQ → replay.
    - Recovery: worker restart → missed fires caught up.
  - Load test (representative traffic; p95 within budgets).
  - Mobile E2E (responsive verification).
  - Accessibility audit (WCAG 2.1 AA).
- **Exit criteria**:
  - All E2E tests pass.
  - Load test: p95 latencies within budgets.
  - Accessibility: no critical violations.
  - ChatGPT review: approve / reject / correct.

---

## Phase 19 — Deployment and Production Verification

- **Objective**: Deploy to production and verify.
- **Scope**:
  - Production Supabase provisioning (or promotion of staging).
  - Production env vars (Vercel + worker host).
  - Production OAuth clients (Gmail, Zoho).
  - Production WhatsApp Business Account (user-provided).
  - Production domain + DNS + TLS.
  - Migration application to production Supabase (reviewed by ChatGPT).
  - Smoke tests in production.
  - Backup / restore verification.
  - Runbook validation (simulate an incident).
- **Exit criteria**:
  - Production deployment succeeds.
  - All smoke tests pass in production.
  - Backup restore tested.
  - ChatGPT sign-off: production accepted.

---

## Phase dependencies

```text
1 ─▶ 2 ─▶ 3 ─┬─▶ 4 ─┬─▶ 5 ─┬─▶ 6 ─┐
             │       │       ├─▶ 7 ─┤
             │       │       └─▶ 8 ─┤
             │       │               ├─▶ 9 ─▶ 10 ─┐
             │       │               │             ├─▶ 11 ─▶ 12 ─┐
             │       │               │             │             ├─▶ 13 ─┐
             │       │               │             │             │       ├─▶ 14 ─┐
             │       │               │             │             │       │       ├─▶ 15 ─┐
             │       │               │             │             │       │       │       ├─▶ 16 ─┐
             │       │               │             │             │       │       │       │       ├─▶ 17 ─▶ 18 ─▶ 19
```

Phases 6, 7, 8 can run in parallel after Phase 5 (but ChatGPT may sequence them).
Phases 15 and 16 can run in parallel after Phase 11 (chat) and Phase 16 (voice — depends on Phase 11).

ChatGPT may change this sequence at any time.
