# Phase 4 — Database Foundation Implementation Plan

## Goal
Implement the complete PostgreSQL persistence foundation for ai-comms-agent as a forward-only migration set, preserving Phase 3 identity/RBAC invariants and the approved product model. Runtime/provider behavior will be built on top of these stable contracts.

## Constraints
- PostgreSQL/Supabase is authoritative.
- Existing `0001_identity_rbac.sql` remains immutable after acceptance except for corrections.
- Do not modify `vendor/clara/`.
- No billing, subscriptions, plans, or marketplace.
- Every tenant-scoped row carries an organization boundary directly or through an explicitly documented parent relation.
- RLS is enabled on every exposed tenant table.
- Sensitive credential payloads are ciphertext only; application code owns encryption/decryption.
- Audit events are append-only.
- Webhook/event ingestion is idempotent.
- Timestamps are UTC timestamptz.
- Forward-only migrations; no destructive down migration.

## Migration slices

### 0002 — Agent foundation
- agents
- agent_versions
- agent_deployments
- agent_email_accounts
- agent_whatsapp_accounts
- agent_ai_settings
- agent_policies
- agent_tools
- indexes, uniqueness, deployment/version invariants
- organization-scoped RLS

### 0003 — Email domain
- email_accounts
- email_account_credentials
- email_folders
- email_labels
- email_threads
- email_messages
- email_attachments
- email_sync_states
- email_sync_events
- provider/message/thread uniqueness and sync indexes
- organization-scoped RLS

### 0004 — Messaging
- whatsapp_accounts
- whatsapp_contacts
- whatsapp_messages
- whatsapp_webhook_events
- conversation channel linkage
- idempotency and provider-message indexes
- organization-scoped RLS

### 0005 — Conversations, automation, scheduling
- conversations
- conversation_messages
- conversation_turns
- scheduled_jobs
- scheduled_job_runs
- automation_rules
- automation_runs
- summaries
- summary_sources
- organization-scoped RLS

### 0006 — Actions, approvals, AI usage, voice, audit
- email_actions
- email_action_approvals
- ai_provider_configs
- ai_usage_events
- voice_sessions
- voice_telemetry
- audit_events
- append-only and idempotency constraints
- organization-scoped RLS

### 0007 — Storage/search readiness
- search/vector metadata tables where application-owned metadata is required
- storage object references for attachments and knowledge documents
- FTS indexes
- operational indexes and retention metadata

## Repository contract
The DB package will expose typed server-side repositories behind interfaces. Route handlers never issue ad-hoc SQL. Organization context is mandatory for tenant operations.

## RLS strategy
- Identity policies remain in 0001.
- New tenant tables use a reusable SECURITY DEFINER membership predicate from 0001.
- Policies are explicit per table and operation.
- Service-role worker operations remain server-only.
- No client receives a service-role credential.
- UPDATE policies include both USING and WITH CHECK.
- DELETE is limited by organization membership/role according to domain policy.

## Verification after development
The test suite will later verify:
1. migration syntax/runtime;
2. foreign keys and unique constraints;
3. cross-organization isolation;
4. append-only audit behavior;
5. webhook/idempotency behavior;
6. FTS/index behavior;
7. repository contract behavior;
8. typecheck/build/security scan;
9. staging Supabase migration application.

Development continues without waiting for CI; verification remains the final acceptance gate.
