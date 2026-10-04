# Phase 4 — Database Foundation Implementation Plan

## Goal
Implement the complete PostgreSQL persistence foundation for ai-comms-agent as a forward-only migration set, preserving Phase 3 identity/RBAC invariants and the approved product model. Runtime/provider behavior is built on top of these stable contracts.

## Constraints
- PostgreSQL/Supabase is authoritative.
- Phase 3 system roles remain TypeScript-authoritative; custom role persistence stays deferred.
- Do not modify `vendor/clara/`.
- No billing, subscriptions, plans, or marketplace.
- Every tenant-scoped row carries an organization boundary directly or through a documented parent relation.
- RLS is enabled on every exposed tenant table.
- Sensitive credential payloads are ciphertext only.
- Audit events are append-only.
- Provider/webhook identifiers have uniqueness constraints where required for idempotency.
- Timestamps use UTC `timestamptz`.
- Forward-only migrations; no destructive down migration.
- CI is temporarily manual-only during active implementation by explicit project-owner instruction.

## Migration slices
### 0001 — Identity/RBAC
Existing Phase 3 migration. Exactly-one-active-owner is enforced transactionally and RLS recursion is hardened.

### 0002 — Full domain database foundation
Implemented as the first Phase 4 schema slice:
- agents, versions, deployments, agent email/WhatsApp assignments, AI settings
- AI provider configurations
- email accounts, encrypted credentials, folders, labels, threads, messages, attachments, sync state/events
- WhatsApp accounts, contacts, messages, webhook events
- conversations, messages, turns
- scheduled jobs/runs and automation rules/runs
- email actions/approvals and summaries/sources
- AI usage and voice sessions/telemetry
- append-only audit events
- hashed API keys
- indexes, foreign keys, uniqueness, lifecycle/check constraints, generated FTS
- organization-aware RLS for direct and parent-scoped tables

## Repository contract
The DB package exposes typed server-side repositories behind interfaces. Route handlers must not issue ad-hoc SQL. Organization context is mandatory for tenant operations. Existing identity repository remains the first concrete implementation surface.

## RLS strategy
- Identity policies remain in 0001.
- New tenant tables use membership-aware predicates from 0001.
- Policies are explicit and include `WITH CHECK` for writes.
- Service-role worker operations remain server-only.
- No client receives a service-role credential.
- Child tables inherit tenant access through their parent organization boundary.
- Audit updates/deletes are denied through RLS.

### 0003/0004 — Security and agent policy corrections
- least-privilege credential/API-key RLS
- restricted execution of membership helper functions
- persisted per-agent security policy and tool bindings

## Remaining Phase 4 implementation
1. Add static schema regression coverage for the complete table inventory, RLS enablement, credential ciphertext columns, indexes, and audit immutability.
2. Expand the DB repository layer where application services need typed persistence.
3. Add storage configuration/metadata for attachments and knowledge documents without provisioning production resources.
4. Add staging/runtime verification scripts and cross-org isolation tests.
5. Re-enable CI after implementation is complete and run the full verification suite.
6. Provision/apply staging Supabase and verify RLS before formal Phase 4 acceptance.

## Exit criteria
- All Phase 4 schema entities exist in forward-only migrations.
- All tenant-scoped tables have RLS enabled.
- Organization isolation is represented by membership-aware policies.
- Sensitive credential fields are ciphertext-only database fields.
- Required search/idempotency/index constraints exist.
- DB repository surface is ready for provider/runtime phases.
- CI is re-enabled and green.
- Staging Supabase is provisioned/applied and runtime RLS is verified before Phase 4 acceptance.

Development continues without waiting for CI; verification remains the final acceptance gate.


## Downstream implementation already started

Per explicit project-owner instruction to complete code changes before verification, implementation has also begun on the next provider layers without claiming Phase 4 acceptance:
- normalized email capability helpers
- Gmail REST adapter
- Gmail OAuth PKCE/token refresh client
- email provider registry/service
- Supabase email-account repository with encrypted credential storage
