# DATA-MODEL.md — Entity Definitions and Relationships

This document defines the data model for `ai-comms-agent`. PostgreSQL (Supabase) is the authoritative store. The model below is the **target schema** — exact column types, constraints, indexes, and migrations are produced in Phase 4 (Database foundation). RLS (Row-Level Security) enforces organization isolation; `authenticated` alone is never authorization.

The model is grouped into domains: identity/tenancy, agents, email, WhatsApp, conversations, scheduling/automation, actions/approvals, AI/usage, voice, and audit.

---

## 1. Identity and tenancy

### `organizations`
Top-level tenant. Every other entity resolves to an organization.
- `id` (uuid, pk)
- `name` (text, not null)
- `slug` (text, unique, not null)
- `created_at`, `updated_at`, `deleted_at` (timestamptz)

### `users`
- `id` (uuid, pk)
- `email` (citext, unique, not null)
- `name` (text)
- `avatar_url` (text)
- `mfa_enabled` (bool, default false)
- `created_at`, `updated_at`, `deleted_at`

### `organization_memberships`
A user can belong to multiple organizations.
- `id` (uuid, pk)
- `organization_id` (uuid, fk → organizations, not null)
- `user_id` (uuid, fk → users, not null)
- `role` (enum: `owner`, `admin`, `member`, `viewer`, not null)
- `created_at`, `updated_at`
- unique(`organization_id`, `user_id`)

### `roles` / `permissions`
Role definitions and permission catalogue. Roles are organization-scoped; permissions are global enum-like.
- `roles(id, organization_id, name, description, created_at)`
- `permissions(id, name, description)` — system-defined catalogue (e.g., `agent.read`, `agent.write`, `email.send`, `whatsapp.send`, `audit.read`)
- `role_permissions(role_id, permission_id)`

### `api_keys`
For programmatic access (optional — used by automations and webhooks).
- `id`, `organization_id`, `name`, `hashed_key`, `scopes`, `last_used_at`, `expires_at`, `created_at`, `revoked_at`

---

## 2. Agents

### `agents`
- `id` (uuid, pk)
- `organization_id` (uuid, fk, not null)
- `name` (text, not null)
- `slug` (text, not null) — unique within org
- `description` (text)
- `status` (enum: `draft`, `active`, `paused`, `archived`)
- `current_version_id` (uuid, fk → agent_versions, nullable)
- `current_deployment_id` (uuid, fk → agent_deployments, nullable)
- `created_by` (uuid, fk → users)
- `created_at`, `updated_at`

### `agent_versions`
Immutable snapshots of agent configuration. Uses Clara's `agent-versioning` semantics.
- `id` (uuid, pk)
- `agent_id` (uuid, fk, not null)
- `version_number` (int, not null)
- `config` (jsonb, not null) — AI config, voice config, tools, KB bindings, prompts, policies
- `created_by`, `created_at`
- `diff_from_previous` (jsonb) — computed via Clara's `agent-versioning/core/diff.ts`
- unique(`agent_id`, `version_number`)

### `agent_deployments`
Binds a version to "live" status.
- `id` (uuid, pk)
- `agent_id` (uuid, fk)
- `version_id` (uuid, fk)
- `environment` (enum: `production`, `preview`)
- `deployed_by`, `deployed_at`, `retired_at`

### `agent_email_accounts`
Many-to-many: an agent can connect multiple email accounts.
- `id`, `agent_id`, `email_account_id`, `role` (enum: `primary`, `read_only`, `send_only`), `created_at`
- unique(`agent_id`, `email_account_id`)

### `agent_whatsapp_accounts`
**One-to-one**: an agent has at most one WhatsApp Business account (ADR-004).
- `id`, `agent_id` (unique), `whatsapp_account_id`, `created_at`

### `agent_ai_settings`
Per-agent AI provider/model settings. Maps to Clara's `organisations/core/agent-ai-settings-db.ts`.
- `id`, `agent_id`, `ai_provider_config_id`, `model_overrides` (jsonb), `feature_flags` (jsonb), `updated_at`

---

## 3. Email

### `email_accounts`
- `id` (uuid, pk)
- `organization_id` (uuid, fk)
- `provider` (enum: `gmail`, `imap_smtp`, `zoho`)
- `email_address` (citext, not null)
- `display_name` (text)
- `connection_config` (jsonb) — provider-specific (host, port, scopes, client_id)
- `capabilities` (jsonb) — discovered at connect time, refreshed periodically
- `status` (enum: `active`, `expired`, `revoked`, `error`)
- `last_sync_at`, `last_error_at`, `created_at`, `updated_at`

### `email_account_credentials`
Encrypted OAuth tokens / passwords. Never exposed to the browser.
- `id` (uuid, pk)
- `email_account_id` (uuid, fk, unique)
- `credential_type` (enum: `oauth_token`, `password`, `app_password`)
- `encrypted_payload` (bytea, not null) — envelope-encrypted (DEK + KEK pattern)
- `expires_at` (timestamptz, nullable)
- `rotated_at`, `created_at`, `updated_at`

### `email_folders`
Per-account folder list (provider-supplied).
- `id`, `email_account_id`, `provider_folder_id`, `name`, `parent_id` (self-ref, nullable), `role` (enum: `inbox`, `sent`, `drafts`, `trash`, `spam`, `archive`, `custom`), `unread_count`, `last_synced_at`

### `email_labels`
Gmail-style labels (where supported).
- `id`, `email_account_id`, `provider_label_id`, `name`, `color`, `label_type` (enum: `system`, `user`)

### `email_threads`
Logical conversation thread (cross-folder, deduplicated by provider thread id where available).
- `id` (uuid, pk)
- `email_account_id` (uuid, fk)
- `provider_thread_id` (text, nullable)
- `subject` (text)
- `snippet` (text)
- `last_message_at` (timestamptz)
- `message_count` (int)
- `is_unread` (bool)
- `importance_score` (real, nullable) — set by classifier
- `action_required` (bool, default false)
- `created_at`, `updated_at`

### `email_messages`
- `id` (uuid, pk)
- `email_account_id` (uuid, fk)
- `thread_id` (uuid, fk → email_threads)
- `folder_id` (uuid, fk → email_folders)
- `provider_message_id` (text, nullable)
- `message_id_header` (text) — RFC-822 Message-ID
- `in_reply_to` (text, nullable)
- `references` (text[], nullable)
- `from_address`, `to_addresses` (jsonb), `cc_addresses` (jsonb), `bcc_addresses` (jsonb)
- `subject` (text)
- `text_body` (text)
- `html_body` (text) — sanitized at ingest (see `SECURITY.md`)
- `snippet` (text)
- `received_at` (timestamptz)
- `is_read`, `is_starred`, `is_draft`, `is_outbound`
- `importance_score` (real)
- `has_attachments` (bool)
- `embedding_status` (enum: `pending`, `indexed`, `failed`, `skipped`)
- `search_tsv` (tsvector) — generated column for full-text search
- `created_at`, `updated_at`
- index on `(email_account_id, received_at desc)`, `(thread_id, received_at)`, `(search_tsv gin)`, `(importance_score desc)`

### `email_attachments`
- `id`, `email_message_id`, `filename`, `mime_type`, `size_bytes`, `storage_url` (Supabase Storage), `content_hash` (sha256), `virus_scan_status` (enum: `pending`, `clean`, `infected`, `skipped`), `created_at`

### `email_sync_states`
Per-account sync cursor.
- `id`, `email_account_id` (unique), `cursor` (jsonb), `history_token` (text, nullable), `last_sync_at`, `last_full_sync_at`, `sync_mode` (enum: `initial`, `incremental`), `error_state` (jsonb)

### `email_sync_events`
Sync log per account (used for reconciliation and observability).
- `id`, `email_account_id`, `event_type` (enum: `started`, `completed`, `failed`, `token_refreshed`, `partial`), `details` (jsonb), `started_at`, `completed_at`, `error`

---

## 4. WhatsApp

### `whatsapp_accounts`
- `id` (uuid, pk)
- `organization_id` (uuid, fk)
- `phone_number_id` (text, unique)
- `display_name` (text)
- `waba_id` (text) — WhatsApp Business Account ID
- `verify_token` (text) — webhook verification
- `encrypted_credentials` (bytea) — system-user access token (envelope-encrypted)
- `status` (enum: `active`, `pending_verification`, `revoked`)
- `created_at`, `updated_at`

### `whatsapp_contacts`
- `id`, `whatsapp_account_id`, `phone_number` (text), `display_name` (text), `first_seen_at`, `last_message_at`, `metadata` (jsonb)
- unique(`whatsapp_account_id`, `phone_number`)

### `whatsapp_messages`
- `id`, `whatsapp_account_id`, `contact_id`, `direction` (enum: `inbound`, `outbound`), `provider_message_id` (text, unique), `body` (text), `media` (jsonb), `status` (enum: `queued`, `sent`, `delivered`, `read`, `failed`), `created_at`, `delivered_at`, `read_at`

### `whatsapp_webhook_events`
Raw webhook events (audit + dedup).
- `id`, `whatsapp_account_id`, `provider_event_id` (text, unique), `event_type` (text), `payload` (jsonb), `received_at`, `processed_at`, `processing_error`

---

## 5. Conversations

Agent-facing conversation history. Distinct from email/WhatsApp raw messages (which are channel-bound).
- `conversations` (id, agent_id, organization_id, channel: `chat`/`whatsapp`/`voice`, subject, status, created_at, updated_at, last_message_at)
- `conversation_messages` (id, conversation_id, role: `user`/`assistant`/`system`/`tool`, content text, content jsonb, parent_message_id, tool_call_id, tool_name, created_at)
- `conversation_turns` (id, conversation_id, started_at, ended_at, intent, status, token_usage jsonb) — for telemetry

---

## 6. Scheduling and automation

### `scheduled_jobs`
Durable, recoverable scheduled actions.
- `id`, `agent_id`, `organization_id`, `name`, `cron` (text, nullable), `one_fire_at` (timestamptz, nullable), `intent` (text — e.g., `scheduled_summarize`), `params` (jsonb), `next_fire_at`, `last_fire_at`, `status` (enum: `active`, `paused`, `archived`, `error`), `created_by`, `created_at`, `updated_at`

### `scheduled_job_runs`
Per-fire audit.
- `id`, `scheduled_job_id`, `fire_at`, `started_at`, `completed_at`, `status` (enum: `success`, `failed`, `skipped`, `in_progress`), `error`, `result` (jsonb), `conversation_id` (nullable, if a conversation was created)

### `automation_rules`
User-defined triggers (e.g., "when an email from X arrives, draft a reply").
- `id`, `agent_id`, `name`, `trigger` (jsonb — event/condition), `action` (jsonb — intent + params), `enabled`, `created_by`, `created_at`, `updated_at`

### `automation_runs`
Per-fire audit for automations.
- `id`, `automation_rule_id`, `triggered_at`, `trigger_event` (jsonb), `status`, `result` (jsonb), `conversation_id` (nullable)

---

## 7. Actions and approvals

For sensitive operations (send, forward, delete, bulk modify).
- `email_actions` (id, agent_id, email_account_id, action_type, target_message_ids uuid[], draft_id uuid nullable, status enum: `pending_approval`, `approved`, `executing`, `completed`, `rejected`, `failed`, requested_by, requested_at, approved_by, approved_at, executed_at, error, audit_event_id)
- `email_action_approvals` (id, email_action_id, decision enum: `approved`/`rejected`, decided_by, decided_at, reason)

---

## 8. Summaries

Generated summaries and their source messages.
- `summaries` (id, agent_id, scope enum: `daily`/`custom`/`on_demand`, period_start, period_end, content text, content jsonb — structured, model, token_usage, created_at, conversation_id nullable)
- `summary_sources` (id, summary_id, email_message_id uuid nullable, whatsapp_message_id uuid nullable, weight real)

---

## 9. AI providers and usage

### `ai_provider_configs`
Per-organization provider configuration. Maps to Clara's `ai-governance` and `organisations/core/ai-settings-db.ts`.
- `id`, `organization_id`, `provider` (enum: `openai`, `gemini`, `sarvam`, `tei`, `elevenlabs`, ...), `display_name`, `encrypted_api_key` (bytea), `model_overrides` (jsonb), `feature_flags` (jsonb), `enabled`, `created_at`, `updated_at`

### `ai_usage_events`
Per-call usage tracking. Drives the usage dashboard and quota.
- `id`, `organization_id`, `agent_id`, `provider`, `model`, `operation` (enum: `chat`/`embedding`/`voice_session`/`tool`), `input_tokens`, `output_tokens`, `voice_seconds`, `cost_usd` (numeric), `latency_ms`, `conversation_id` nullable, `created_at`
- index on `(organization_id, created_at)`, `(agent_id, created_at)`

---

## 10. Voice

### `voice_sessions`
- `id`, `agent_id`, `organization_id`, `user_id`, `provider` (enum), `provider_session_id` (text), `started_at`, `ended_at`, `duration_seconds`, `status` (enum: `active`, `ended`, `error`), `turn_count`, `connection_metadata` (jsonb)

### `voice_telemetry`
Per-turn latency and quality metrics. Maps to Clara's `voice-core/realtime/latency-tracker.ts` and `latency-log.ts`.
- `id`, `voice_session_id`, `turn_id`, `stage` (enum: `tfa`, `ttft`, `ttfa`, `total`), `latency_ms`, `provider_metadata` (jsonb), `created_at`

---

## 11. Audit

### `audit_events`
Immutable, append-only audit log. Every sensitive operation, every auth event, every tool execution emits an audit event.
- `id` (uuid, pk)
- `organization_id` (uuid, fk)
- `actor_type` (enum: `user`, `agent`, `system`)
- `actor_id` (uuid)
- `event_type` (text) — e.g., `email.send`, `agent.tool.invoke`, `auth.login`, `agent.deploy`
- `target_type` (text)
- `target_id` (uuid)
- `metadata` (jsonb)
- `correlation_id` (uuid) — links to queue message / request id
- `created_at` (timestamptz, not null)
- index on `(organization_id, created_at desc)`, `(event_type)`, `(correlation_id)`

---

## 12. RLS and security

- Every table has `organization_id` (except `users`, `permissions` which are global).
- RLS policies enforce `organization_id = current_setting('app.organization_id')` for all CRUD.
- `authenticated` alone is never authorization — explicit role/permission checks in the API layer are mandatory (per `RULES.md §11`).
- `email_account_credentials.encrypted_payload` and `ai_provider_configs.encrypted_api_key` use envelope encryption (DEK + KEK). KEK is in Vercel project env vars; DEK is per-row.
- `email_messages.html_body` is sanitized at ingest (HTML allowlist + sanitization library). Raw HTML is never rendered in the UI.
- `audit_events` is insert-only — no update, no delete (RLS denies both).

---

## 13. Migration strategy

Migrations are produced in Phase 4. They are forward-only, named `NNNN_description.sql` (e.g., `0001_init_organizations.sql`), applied via Supabase migrations tooling. Every migration is reviewed by ChatGPT before applying. No destructive operation is performed casually (per `RULES.md §11`).

The exact column types, constraint names, index names, and RLS policy text are produced in Phase 4 and recorded as a separate `db/migrations/` directory in the application repository (created in Phase 2).
