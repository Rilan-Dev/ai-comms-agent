# DOMAIN_MODEL.md — Domain Model (DDD View)

This document defines the **domain model** for `ai-comms-agent`: the core domain entities, their behavior, invariants, lifecycle, and relationships. It is a domain-driven design (DDD) view, distinct from `DATA-MODEL.md` (which is the persistence schema — tables, columns, indexes, RLS). The domain model is the source of truth for **what each entity means**; the data model is the source of truth for **how each entity is stored**.

Per the ChatGPT Phase 1 conditional review (correction #3), this document must define: Organization, Agent, User, Email Account, Email Message, Thread, Attachment, Memory, Embedding, Automation, Scheduled Task, WhatsApp Connection, Conversation.

This is a Phase 1 document. Behavior signatures are indicative; exact implementations are produced in the relevant phases.

---

## 1. Bounded contexts

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        ai-comms-agent domain                            │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ Identity &   │  │ Agent        │  │ Email        │  │ Messaging    ││
│  │ Tenancy      │  │ Runtime      │  │              │  │ (WhatsApp +  ││
│  │              │  │              │  │              │  │  future)     ││
│  │ Organization │  │ Agent        │  │ EmailAccount │  │ WhatsAppConn ││
│  │ User         │  │ (runtime)    │  │ EmailMessage │  │ (channel     ││
│  │ Role         │  │ Conversation │  │ Thread       │  │  instance)   ││
│  │ Permission   │  │              │  │ Attachment   │  │              ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ Knowledge &  │  │ Scheduling & │  │ Action &     │  │ Observability││
│  │ Memory       │  │ Automation   │  │ Approval     │  │ & Audit      ││
│  │              │  │              │  │              │  │              ││
│  │ Memory       │  │ ScheduledTask│  │ EmailAction  │  │ AuditEvent   ││
│  │ Embedding    │  │ Automation   │  │ Approval     │  │ UsageEvent   ││
│  │ (KB entry)   │  │              │  │              │  │              ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

Cross-context relationships are explicit (e.g., an `Agent` references `EmailAccount`s via `AgentEmailAccountAssignment`). Each context owns its entities; cross-context references use IDs only (no shared mutable state).

---

## 2. Identity & Tenancy context

### 2.1 Organization

**Purpose:** The tenant boundary. Every other entity resolves to an organization. Owns members, roles, permissions, provider credentials, agents.

**Identity:** `OrganizationId` (UUID). Stable for the organization's lifetime.

**Behavior:**
- `inviteMember(userEmail, role)` → creates a pending membership
- `removeMember(userId)` → revokes membership (soft-delete)
- `changeMemberRole(userId, newRole)` → updates role (must respect role hierarchy: owner > admin > member > viewer)
- `setPolicy(policyJsonb)` → updates sensitive-action policy (per `AUTHORIZATION.md §2`)
- `rotateCredentials()` → rotates the org's KEK-wrapped credentials (operational, per `SECURITY.md §16`)

**Invariants:**
- An organization must have exactly one `owner` at all times (ownership transfer requires MFA).
- An organization's `policy_jsonb` cannot make a sensitive action more permissive than the platform default (only more restrictive).
- An organization cannot be deleted while it has active agents or connected accounts (must archive first).

**Lifecycle:** `created` → `active` → `suspended` (billing/abuse — N/A per `RULES.md §5`, but available operationally) → `archived` → `deleted` (after retention period).

**Relationships:** has many `User` (via `Membership`), has many `Agent`, has many `EmailAccount` (via Agent), has at most N `WhatsAppConnection` (one per agent), has many `AuditEvent`.

---

### 2.2 User

**Purpose:** A human operator. Can belong to multiple organizations with different roles.

**Identity:** `UserId` (UUID). Stable for the user's lifetime.

**Behavior:**
- `enableMFA()` → starts MFA enrollment (returns TOTP secret)
- `confirmMFA(code)` → completes enrollment
- `disableMFA(code)` → disables MFA (requires current code)
- `selectOrganization(orgId)` → switches active org (for session)
- `createApiKey(name, scopes)` → issues an API key (hashed at rest)

**Invariants:**
- A user's email is unique (case-insensitive).
- MFA is required for `owner` and `admin` roles (enforced at role assignment).
- A user cannot remove themselves as owner if they are the only owner.

**Lifecycle:** `created` → `active` → `suspended` (admin action) → `deleted` (soft-delete; PII retained per org policy, then hard-deleted).

**Relationships:** has many `Organization` (via `Membership`), owns `ApiKey`s, is actor on `AuditEvent`s.

---

### 2.3 Role & Permission

**Purpose:** RBAC. Roles are per-organization; permissions are a system-defined catalogue.

**Roles:** `owner`, `admin`, `member`, `viewer`. Custom roles (per-org) are optional (Phase 3).

**Permission catalogue:** `agent.read`, `agent.write`, `agent.deploy`, `email_account.read`, `email_account.write`, `email.send`, `email.delete`, `email.modify_bulk`, `whatsapp.send`, `whatsapp.read`, `schedule.read`, `schedule.write`, `audit.read`, `org.members.read`, `org.members.write`.

**Invariants:**
- `viewer` has only `*.read` permissions.
- `member` has `*.read` + `*.write` for agents/email/whatsapp/schedule, but NOT `org.members.write`.
- `admin` has all except `org.delete`.
- `owner` has all including `org.delete` (requires MFA).
- A role cannot grant a permission not in the catalogue.

---

## 3. Agent Runtime context

### 3.1 Agent

**Purpose:** The unit of AI configuration and action. An agent has an identity, a versioned configuration, a current deployment, connected channels (email accounts + one WhatsApp connection), schedules, automations, and an activity history.

**Identity:** `AgentId` (UUID). Stable for the agent's lifetime.

**Behavior:**
- `createDraftVersion(configChanges)` → creates a new `AgentVersion` (draft, not deployed)
- `promoteVersion(versionId)` → sets version as current; creates an `AgentDeployment`
- `rollbackToVersion(versionId)` → creates a new deployment pointing at an old version
- `connectEmailAccount(accountId, role)` → assigns an email account (primary/read-only/send-only)
- `disconnectEmailAccount(accountId)` → unassigns
- `connectWhatsApp(whatsappConnectionId)` → assigns the WhatsApp connection (1:1 — ADR-004)
- `pause()` / `resume()` → suspends agent activity without archiving
- `archive()` → soft-delete (preserves history; agent cannot act)

**Invariants:**
- An agent belongs to exactly one `Organization`.
- An agent has at most one `WhatsAppConnection` (ADR-004).
- An agent's `current_version_id` always points at a deployed version (never a draft).
- An agent's `allowed_tools` config cannot include tools the org has not enabled.
- An agent's security policy cannot be more permissive than the org's policy (per `AUTHORIZATION.md §2.3`).

**Lifecycle:** `draft` (initial) → `active` (after first deployment) → `paused` → `archived`.

**Relationships:** belongs to `Organization`; has many `AgentVersion` (immutable); has one current `AgentDeployment`; has many `EmailAccount` (via `AgentEmailAccountAssignment`); has at most one `WhatsAppConnection`; has many `ScheduledTask`; has many `Automation`; has many `Conversation`.

---

### 3.2 Conversation

**Purpose:** An agent-facing conversation across a channel (chat, voice, WhatsApp). Distinct from raw email/WhatsApp messages (which are channel-bound). A conversation is the unit of multi-turn agent interaction.

**Identity:** `ConversationId` (UUID).

**Behavior:**
- `appendMessage(role, content)` → adds a message; updates `last_message_at`
- `startTurn(intent, request)` → creates a `ConversationTurn` (for telemetry)
- `endTurn(turnId, status, usage)` → closes the turn with token usage
- `close()` → marks conversation as ended (no further messages)

**Invariants:**
- A conversation belongs to exactly one `Agent` and one `Organization`.
- A conversation has exactly one `channel` (chat / voice / whatsapp) — does not change.
- Messages are append-only (no edit, no delete — audit integrity).

**Lifecycle:** `active` → `ended` (user-initiated or timeout) → archived (after retention).

**Relationships:** belongs to `Agent`; has many `ConversationMessage`; has many `ConversationTurn`; may be referenced by `EmailAction`, `ScheduledTaskRun`, `AutomationRun`.

---

## 4. Email context

### 4.1 Email Account

**Purpose:** A connected email account (Gmail, IMAP/SMTP, Zoho). Owned by an organization; assigned to agents (many-to-many).

**Identity:** `EmailAccountId` (UUID).

**Behavior:**
- `connect(provider, credentials)` → establishes connection; discovers capabilities; performs initial sync
- `disconnect()` → revokes credentials; stops sync; preserves synced messages (soft-disconnect)
- `refreshCredentials()` → refreshes OAuth token (or rotates app password)
- `discoverCapabilities()` → queries provider for supported capabilities; persists to `capabilities` jsonb
- `sync()` → triggers sync (initial or incremental); updates `EmailSyncState`
- `listFolders()` / `listLabels()` → queries provider (capability-gated)

**Invariants:**
- An account belongs to exactly one `Organization`.
- An account's `provider` is immutable (cannot change Gmail → IMAP; must disconnect and reconnect).
- An account's `capabilities` is refreshed daily and on provider-reported config changes.
- An account with `status='revoked'` or `status='expired'` cannot sync; user must re-onboard.
- Credentials are encrypted at rest (envelope encryption — per `SECURITY.md §4`).

**Lifecycle:** `connecting` → `active` → `expired` (token expired, refresh needed) → `revoked` (user or provider revoked) → `disconnected` (soft; data preserved) → `deleted` (hard; data purged per retention).

**Relationships:** belongs to `Organization`; has many `EmailFolder`, `EmailLabel`, `EmailThread`, `EmailMessage`; has one `EmailSyncState`; has many `EmailSyncEvent`; assigned to many `Agent` (via `AgentEmailAccountAssignment`).

---

### 4.2 Email Message

**Purpose:** A single email message (RFC-822). Stored locally on sync. Authoritative copy in PostgreSQL; semantic index in Qdrant.

**Identity:** `EmailMessageId` (UUID, internal) + `provider_message_id` (provider's ID, for dedup) + `message_id_header` (RFC-822 Message-ID, for threading).

**Behavior:**
- `classify()` → computes `importance_score` and `action_required` flag (via classifier worker)
- `extractDeadlines()` → extracts dates/deadlines from content (via classifier worker)
- `generateEmbedding()` → embeds content for semantic search (via embedding worker)
- `markRead(isRead)` → updates `is_read` (provider-side, capability-gated)
- `archive()` / `move(folderId)` / `applyLabels(labelIds)` → provider-side mutations (capability-gated)
- `createDraftReply(params)` → creates a draft reply (linked via `in_reply_to`)

**Invariants:**
- A message belongs to exactly one `EmailAccount` and one `EmailThread`.
- A message's `html_body` is sanitized at ingest (per `SECURITY.md §14`) — raw HTML is never stored.
- A message's `text_body` is the plain-text alternative (or stripped from HTML if no text part).
- A message's `embedding_status` transitions: `pending` → `indexed` (success) or `failed` (permanent) or `skipped` (ClamAV flagged attachment, etc.).
- A message with `is_draft=true` is not synced to provider's Drafts folder automatically (drafts are local until sent).
- A message's `search_tsv` is a generated column (PostgreSQL `tsvector`) for full-text search.

**Lifecycle:** Synced once (immutable after sync, except for `is_read`, `is_starred`, `folder_id`, `label_ids`, `importance_score`, `action_required`, `embedding_status` which can be updated). Hard-deleted only when provider-side deletion is detected AND the org's retention policy allows.

**Relationships:** belongs to `EmailAccount`, `EmailThread`, `EmailFolder`; has many `EmailAttachment`; has one `Embedding` (in Qdrant, by `message_id`); may be source for `Summary`; may be target of `EmailAction`.

---

### 4.3 Thread

**Purpose:** A logical conversation thread (group of messages). Cross-folder (a thread may span Inbox, Sent, Archive). Deduplicated by provider thread ID (Gmail native) or `References` header grouping (IMAP/Zoho).

**Identity:** `ThreadId` (UUID, internal) + `provider_thread_id` (provider's ID, where available).

**Behavior:**
- `addMessage(message)` → adds; updates `message_count`, `last_message_at`, `snippet`
- `computeImportance()` → recomputes `importance_score` from member messages
- `markAllRead()` → marks all member messages as read (provider-side, capability-gated)
- `summarize()` → generates a thread summary (via summary worker)

**Invariants:**
- A thread belongs to exactly one `EmailAccount` (threads do not cross accounts).
- A thread's `subject` is derived from the first message (Re:/Fwd: prefixes stripped for grouping).
- A thread's `is_unread` is true if any member message is unread.
- A thread's `importance_score` is the max of member messages' scores.

**Lifecycle:** Created on first sync; updated as new messages arrive; never deleted (archived with the account).

**Relationships:** belongs to `EmailAccount`; has many `EmailMessage`; may be source for `Summary`.

---

### 4.4 Attachment

**Purpose:** A file attached to an email message. Stored in Supabase Storage; metadata in PostgreSQL.

**Identity:** `AttachmentId` (UUID).

**Behavior:**
- `download()` → returns a signed URL (15-min expiry)
- `scan()` → runs ClamAV scan; updates `virus_scan_status`
- `quarantine()` → moves to quarantine bucket (not user-accessible)

**Invariants:**
- An attachment belongs to exactly one `EmailMessage`.
- An attachment's `content_hash` (SHA-256) is computed at ingest; duplicates within an account are deduplicated (single storage blob, multiple metadata rows).
- An attachment with `virus_scan_status='infected'` is quarantined and not downloadable.
- An attachment's MIME type is validated against magic bytes (per `SECURITY.md §13`).
- Executable extensions (`.exe`, `.bat`, `.sh`, etc.) are blocked even if MIME matches.

**Lifecycle:** `pending_scan` → `clean` (downloadable) / `infected` (quarantined) / `skipped` (ClamAV unavailable; flagged for manual review).

**Relationships:** belongs to `EmailMessage`; stored in Supabase Storage bucket `email-attachments/{org_id}/{account_id}/`.

---

## 5. Knowledge & Memory context

### 5.1 Memory

**Purpose:** Long-term agent memory. Optional, per-agent. Stored as KB entries (Clara KB contracts). NOT auto-populated — users explicitly mark summaries or facts for memory.

**Identity:** `MemoryId` (UUID) = KB entry ID.

**Behavior:**
- `create(agentId, content, metadata)` → creates a memory entry; embeds; indexes in Qdrant
- `recall(query, limit)` → semantic search (via Clara RAG)
- `forget(memoryId)` → deletes the entry and its embedding

**Invariants:**
- A memory belongs to exactly one `Agent`.
- Memory content is sanitized (same HTML allowlist as email).
- Memory embeddings are stored in Qdrant (semantic index) — Qdrant is NOT authoritative (rebuilt from PostgreSQL if lost).
- Memory is scoped to the agent — not shared across agents (even within the same org) unless explicitly bound to a shared KB.

**Lifecycle:** `active` → `forgotten` (soft-delete; embedding removed; content retained for audit per retention policy).

**Relationships:** belongs to `Agent`; indexed in `Embedding` (Qdrant).

---

### 5.2 Embedding

**Purpose:** A vector embedding of a text source (email message, KB document, memory entry). Stored in Qdrant for semantic retrieval. NOT authoritative — the source lives in PostgreSQL.

**Identity:** `EmbeddingId` = `{source_type}:{source_id}:{model}` (composite, per `EVENT-CONTRACTS.md §15` idempotency key).

**Behavior:**
- `generate(sourceType, sourceId, model)` → fetches source text, calls Clara's `embed()`, stores in Qdrant
- `query(queryText, model, limit)` → embeds query, searches Qdrant, returns source IDs (host fetches full content from PostgreSQL)
- `reindex(sourceType, sourceId)` → regenerates embedding (e.g., after content edit)

**Invariants:**
- An embedding's source MUST exist in PostgreSQL (Qdrant never holds the source text, only the vector + source ID).
- An embedding is model-specific (changing models requires re-embedding all sources).
- Query embeddings are cached (via Clara's `rag/query-embedding-cache.ts`) — 24h TTL.
- Embeddings are NOT PII — they are numerical vectors. But the source text (in PostgreSQL) is PII and RLS-enforced.

**Lifecycle:** `pending` → `indexed` (in Qdrant) / `failed` (permanent; source still searchable via full-text) / `skipped` (per org policy, e.g., messages from blocked senders).

**Relationships:** references source (`EmailMessage` / `Memory` / KB document) by ID. Does not own the source.

---

## 6. Scheduling & Automation context

### 6.1 Scheduled Task

**Purpose:** A durable, recoverable scheduled job. Fires an agent action at a configured time (one-shot or recurring cron). Durable = survives worker restart; recoverable = missed fires are caught up within a grace period.

**Identity:** `ScheduledTaskId` (UUID).

**Behavior:**
- `schedule(agentId, cron | oneFireAt, intent, params)` → creates the task; computes `next_fire_at`
- `pause()` / `resume()` → suspends/resumes firing
- `cancel()` → marks as cancelled; no further fires
- `fire(fireAt)` → enqueues `agent.schedule` message (idempotent per `(task_id, fire_at)`)
- `recordRun(runId, status, result)` → persists a `ScheduledTaskRun`

**Invariants:**
- A task belongs to exactly one `Agent` and one `Organization`.
- A task has either `cron` (recurring) or `one_fire_at` (one-shot), never both.
- A task's `intent` must be in the intent taxonomy (per `AI-ARCHITECTURE.md §3`).
- A task's `next_fire_at` is recomputed after each fire (for cron) or set to null (for one-shot after firing).
- Missed fires (worker was down) are caught up on restart IF within the grace period (default 1 hour); older missed fires are skipped and audited.
- A task with `status='error'` (3 consecutive failures) is paused; user must acknowledge to resume.

**Lifecycle:** `active` → `paused` (user or error) → `cancelled` → `archived`.

**Relationships:** belongs to `Agent`; has many `ScheduledTaskRun`; fires `Conversation`s (one per fire, if the intent creates a conversation).

---

### 6.2 Automation

**Purpose:** A user-defined event-triggered rule. When a trigger fires, an action executes (draft reply, send WhatsApp summary, classify and label, etc.).

**Identity:** `AutomationId` (UUID).

**Behavior:**
- `define(agentId, trigger, action)` → creates the rule
- `enable()` / `disable()` → toggles
- `evaluate(event)` → checks if `event` matches `trigger`; if yes, enqueues the action
- `recordRun(runId, status, result)` → persists an `AutomationRun`

**Invariants:**
- An automation belongs to exactly one `Agent`.
- An automation's `trigger` must be a known trigger type (email arrived, email classified, scheduled time, etc.).
- An automation's `action` must be a known intent (per `AI-ARCHITECTURE.md §3`).
- Sensitive actions (send, forward, delete) still go through the approval policy (per `AUTHORIZATION.md`) — automations do not bypass approval.
- An automation's run rate is limited (per-org: max 100 runs/hour) to prevent runaway rules.

**Lifecycle:** `active` → `disabled` → `archived`.

**Relationships:** belongs to `Agent`; has many `AutomationRun`; triggers may reference `EmailMessage` or `Thread` or `Conversation`.

---

## 7. Messaging context

### 7.1 WhatsApp Connection

**Purpose:** A connected WhatsApp Business account (one phone number). Owned by an organization; assigned to at most one agent (ADR-004). This is one concrete implementation of the `MessagingChannel` abstraction (per `MESSAGING_CHANNEL_ARCHITECTURE.md`).

**Identity:** `WhatsAppConnectionId` (UUID) + `phone_number_id` (Meta's ID, unique).

**Behavior:**
- `connect(wabaId, phoneNumberId, systemUserToken, verifyToken)` → establishes connection; verifies webhook
- `disconnect()` → revokes; preserves message history
- `receiveInbound(rawEvent)` → parses; deduplicates by `provider_event_id`; persists; routes to bound agent
- `send(contactPhone, message)` → enqueues outbound (template compliance enforced)
- `submitTemplate(name, language, parameters)` → submits to Meta for approval
- `listTemplates()` → lists approved/pending templates

**Invariants:**
- A WhatsApp connection belongs to exactly one `Organization`.
- A WhatsApp connection is assigned to at most one `Agent` (1:1 — ADR-004). Multiple agents may share a connection only if the user explicitly configures it (UI warns).
- Outbound to a new contact (no inbound in last 24h) MUST use an approved template (Meta requirement; enforced by runtime, not LLM).
- Inbound events are deduplicated by `provider_event_id` (immutable in `whatsapp_webhook_events`).
- System User token is envelope-encrypted at rest.
- Webhook signature verification is mandatory on every inbound.

**Lifecycle:** `pending_verification` (webhook not yet verified) → `active` → `revoked` (user or Meta revoked) → `disconnected` (soft; data preserved) → `deleted` (hard; per retention).

**Relationships:** belongs to `Organization`; assigned to at most one `Agent` (via `AgentWhatsAppAssignment`); has many `WhatsAppContact`; has many `WhatsAppMessage`; has many `WhatsAppWebhookEvent`; has many `WhatsAppTemplate`.

---

## 8. Cross-context entity summary

| Entity | Bounded context | Identity | Phase implemented |
|---|---|---|---|
| Organization | Identity & Tenancy | UUID | Phase 3 |
| User | Identity & Tenancy | UUID | Phase 3 |
| Role / Permission | Identity & Tenancy | enum + catalogue | Phase 3 |
| Agent | Agent Runtime | UUID | Phase 3 (CRUD), Phase 11 (runtime) |
| Conversation | Agent Runtime | UUID | Phase 15 |
| Email Account | Email | UUID | Phase 5 (CRUD), Phase 6-8 (providers) |
| Email Message | Email | UUID + provider_message_id + message_id_header | Phase 9 (sync), Phase 10 (intelligence) |
| Thread | Email | UUID + provider_thread_id | Phase 9 |
| Attachment | Email | UUID + content_hash | Phase 9 |
| Memory | Knowledge & Memory | UUID (= KB entry ID) | Phase 10 |
| Embedding | Knowledge & Memory | composite (source_type:source_id:model) | Phase 9 (email), Phase 10 (KB) |
| Scheduled Task | Scheduling & Automation | UUID | Phase 14 |
| Automation | Scheduling & Automation | UUID | Phase 14 |
| WhatsApp Connection | Messaging | UUID + phone_number_id | Phase 13 |

---

## 9. Domain events

Key domain events (distinct from queue messages — these are semantic events; queue messages are the transport):

- `EmailAccountConnected` / `EmailAccountDisconnected` / `EmailAccountSyncFailed`
- `EmailMessageReceived` / `EmailMessageClassified` / `EmailMessageEmbedded`
- `ThreadCreated` / `ThreadUpdated`
- `AgentCreated` / `AgentVersionPromoted` / `AgentDeployed` / `AgentArchived`
- `ConversationStarted` / `ConversationTurnCompleted` / `ConversationEnded`
- `ScheduledTaskFired` / `ScheduledTaskFailed` / `ScheduledTaskCompleted`
- `AutomationTriggered` / `AutomationRunCompleted`
- `EmailActionProposed` / `EmailActionApproved` / `EmailActionRejected` / `EmailActionExecuted`
- `WhatsAppInboundReceived` / `WhatsAppOutboundSent` / `WhatsAppOutboundFailed`
- `MemoryCreated` / `MemoryForgotten`

Each domain event is recorded as an `AuditEvent` (per `DATA-MODEL.md §11`) and may trigger downstream processing (e.g., `EmailMessageClassified` may trigger an `Automation` rule).

---

## 10. Relationship to DATA-MODEL.md

| Domain entity (this doc) | Persistence table(s) (DATA-MODEL.md) |
|---|---|
| Organization | `organizations` |
| User | `users`, `organization_memberships` |
| Role / Permission | `roles`, `permissions`, `role_permissions` |
| Agent | `agents`, `agent_versions`, `agent_deployments`, `agent_email_accounts`, `agent_whatsapp_accounts`, `agent_ai_settings` |
| Conversation | `conversations`, `conversation_messages`, `conversation_turns` |
| Email Account | `email_accounts`, `email_account_credentials`, `email_sync_states`, `email_sync_events` |
| Email Message | `email_messages` |
| Thread | `email_threads` |
| Attachment | `email_attachments` |
| Memory | `knowledge_bases/*` tables (KB entry shape) |
| Embedding | (Qdrant — no PostgreSQL table; references `email_messages.id` / KB doc ID / memory ID) |
| Scheduled Task | `scheduled_jobs`, `scheduled_job_runs` |
| Automation | `automation_rules`, `automation_runs` |
| WhatsApp Connection | `whatsapp_accounts`, `whatsapp_contacts`, `whatsapp_messages`, `whatsapp_webhook_events`, `whatsapp_templates` (Phase 13 addition) |

When the domain model and data model disagree, **the domain model wins for semantics** (what an entity means) and **the data model wins for storage** (how it's persisted). Disagreements are resolved by ChatGPT (architectural decision in `DECISIONS.md`).
