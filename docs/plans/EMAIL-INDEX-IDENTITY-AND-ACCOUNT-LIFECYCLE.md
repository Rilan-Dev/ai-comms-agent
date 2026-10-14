## Implementation progress — 2026-10-14

Implemented on branch `feature/email-index-lifecycle-v1` (not merged):

- Added `email-index-identity.ts` with stable SHA-256 source identity, content and metadata hashes, and deterministic UUID-shaped vector point IDs based on source identity + chunk index.
- Updated the email knowledge indexer to persist hashes in document metadata, avoid rebuilding chunks for metadata-only changes, and enqueue idempotent vector upsert jobs after PostgreSQL document/chunk writes.
- Updated mailbox message upserts to reset `indexed_at` when retrieval-relevant content or metadata changes. Corrected canonical DB field mappings in the background indexer and ensured drafts/empty messages are processed so stale knowledge documents are removed.
- Message hard deletes enqueue account-scoped vector-delete jobs and remove the PostgreSQL email knowledge document. Account removal queues an account-wide vector purge and deletes account-scoped email knowledge documents before the account row is removed.
- Added migration `0048_email_knowledge_sync_jobs.sql` for a durable outbox with distinct upsert-message, delete-message, and delete-account operations and idempotency indexes.
- Added an injected vector-adapter contract and retryable outbox processor. Stale upsert jobs check the authoritative current message; stale delete jobs do not remove vectors when the message exists again. Account purge waits for in-flight message jobs.
- Extracted execution-time allowlist and all-of/any-of capability checks and added regression tests. Added hash/point-ID, outbox migration contract, and vector lifecycle retry tests.

### Important incomplete integration boundary

The repository currently has no supported Clara RAG/vector adapter or direct Qdrant client. Per the existing architecture contract, this change intentionally does not invent a parallel Qdrant collection or an undocumented endpoint. The durable outbox processor is implemented as an injected adapter boundary, but **the production vector adapter and worker startup wiring are still pending**. Until that is supplied, PostgreSQL inbox/document reconciliation and outbox persistence are source changes; live vector upsert/deletion is not complete and queued vector jobs must not be reported as completed.

### Verification state

- No local checkout exists in the current execution environment, so provider-contract, worker-loop, executor, new hash/policy/outbox/lifecycle tests, and Clara/worker TypeScript checks have **not been run**.
- No test/build/typecheck/runtime PASS is claimed.
- Before merge, use a real checkout to run the focused tests and typechecks, fix concrete failures, and bind the vector adapter to Clara's supported RAG API. FIX-01 retains ISS-026 ownership; OPS-01 retains live infrastructure and ingestion verification.
- Do not expose the email tool catalogue to the live model before transport integration and security checks are complete.

---

# Email Index Identity and Account-Lifecycle Reconciliation Plan

Date: 2026-10-14
Owner: DEV-01 / Forge (source implementation); FIX-01 owns security defects; OPS-01 owns live infrastructure and ingestion verification.
Status: PLANNED — source behavior reviewed; implementation and runtime verification pending.

## Goal

Keep the email inbox in PostgreSQL and the Clara retrieval index consistent across multiple connected accounts, provider-side edits/actions, hard deletes, account removal, and reconnects. A change to one account must never delete or overwrite another account's indexed email, even if two providers/accounts reuse the same provider message ID or two messages have identical bodies.

## Current source findings

- apps/worker/src/knowledge/email-knowledge-indexer.ts writes one knowledge_documents row per email under storage_bucket='email-account' and storage_path=accountId/encodeURIComponent(providerMessageId). Metadata already records provider, account ID, and provider message ID; sha256 currently represents the indexable body.
- apps/worker/src/knowledge/email-knowledge-indexer-worker.ts indexes only email_messages.indexed_at IS NULL. Existing upserts in mailbox-sync-worker.ts do not visibly reset indexed_at when a previously indexed message's content changes, so a modified message may never be re-indexed.
- Provider hard-delete reconciliation deletes the local message and calls deleteEmailKnowledge(org, account, providerMessageId), which deletes the PostgreSQL document and its cascading chunks. This is scoped to an account and is replay-safe at the SQL layer.
- The indexer does not itself demonstrate Qdrant/vector-point deletion or metadata synchronization. Account removal also needs an explicit account-wide derived-index cleanup path; removing credentials alone is insufficient.
- indexed_at alone does not distinguish “indexed content is current” from “message indexed once.” The source needs a durable content/metadata version comparison and a retryable deletion/reconciliation record.

## Identity and hashing contract

Keep these concepts separate; do not use one hash for all purposes.

1. **Source identity hash** — stable for one provider message in one local connected account:
   SHA-256(canonicalEncode(organization_id, provider, email_account_id, provider_message_id)).
   Use a deterministic, unambiguous encoding (canonical JSON with fixed keys or length-prefixed fields). Preserve provider message ID case and bytes; do not normalize opaque provider IDs as email addresses. Never hash just the body or provider message ID alone.
2. **Content hash** — SHA-256 of the canonical text sent for embedding (subject, sender/recipients/date fields that are deliberately part of retrieval content, and body/snippet, with stable newline/whitespace rules). A content-hash change requires chunk reconciliation and embedding refresh.
3. **Metadata hash** — SHA-256 of canonical retrieval metadata (provider/account identity, thread, labels/folders, read/star/archive/trash/outbound state, relevant timestamps, sender/recipient metadata). A metadata-only change should update stored metadata/vector payload without needlessly re-embedding identical text.
4. **Chunk/vector point identity** — deterministic identity derived from the source identity hash plus chunk identity/version, not from chunk text alone. Identical content in two accounts must produce separate points. Content hashes remain useful for change detection, not as the sole ownership key.

Persist the source identity hash, content hash, metadata hash, indexing version, provider/account/message IDs, and lifecycle generation in document/chunk/vector metadata. Add appropriate unique indexes/constraints only after checking the existing schema and backfill strategy. The PostgreSQL rows remain authoritative.

## Required lifecycle behavior

### A. Initial sync and multiple accounts

- Each connected account has its own sync state, local message key, source identity hash, and indexing checkpoint.
- Initial import upserts inbox messages and schedules indexing only after the message transaction commits.
- For two or more accounts, queries, indexing, updates, and deletes always constrain organization + local account ID + provider message ID. Do not scope by address, provider message ID alone, or organization alone.
- Duplicate delivery/replay must be idempotent.

### B. Message content edits

- Recompute the canonical content hash on each provider upsert.
- If content hash changed, mark indexing dirty (or upsert a durable index job), replace the document's chunk set atomically where possible, refresh embeddings/vector points, and mark the indexed version only after successful persistence.
- If content is unchanged but metadata hash changed, update retrieval metadata/vector payload and do not repeat embedding work.
- Never set indexed_at to “current” after a failed partial index write. Record error/retry state and leave the job eligible for retry.

### C. Inbox actions

- Read/unread, star/unstar, labels, folder, archive, sent/draft state, and provider-updated timestamps must be persisted in PostgreSQL and reflected in vector metadata when those fields are indexed.
- A metadata-only action must not create duplicate chunks or vector points.
- Trash/delete semantics must be explicit: if a message is removed from the inbox but remains in provider trash, follow a documented retrieval policy; hard-deleted messages must be removed from the derived index.
- Avoid treating every UI action as body-content change; separate content and metadata hashes.

### D. Remove/disconnect an account

- Preserve the existing distinction between **disconnect** (stop sync/revoke credentials; retain local mail if current product semantics say so) and **remove account/data** (explicitly purge its derived index and account-owned email records according to retention policy).
- On remove, atomically mark the account as deleting/disabled and create a durable cleanup/outbox job before deleting credentials or making the account invisible to workers.
- Cleanup must remove all knowledge_documents in email-account for that organization/account, cascading knowledge_chunks, and delete all corresponding Qdrant/vector points by source identity/account filter. Do not delete user-uploaded knowledge documents.
- Cleanup must be retryable and idempotent. Keep a tombstone/lifecycle generation so delayed index jobs cannot recreate vectors for a removed account.
- Mark cleanup complete only after PostgreSQL derived rows and the vector backend both confirm deletion; expose pending/failed cleanup to operations.
- If provider revocation fails, still disable new sync/index work and retry revocation separately; do not leave indexing active.

### E. Reconnect and stale jobs

- Every account removal/reconnect cycle gets a lifecycle generation or equivalent durable tombstone.
- An index job carries account ID + generation + message ID + expected content hash. The worker rechecks account state/generation immediately before writing vector points.
- Stale jobs for deleted accounts or older generations become terminal no-ops and cannot recreate data.
- A reconciliation task compares authoritative email rows, email-derived documents/chunks, and vector point IDs to repair missing/orphaned records.

## Proposed data flow

1. Provider delta -> persist email row + latest provider metadata in PostgreSQL.
2. Transactionally record an email_index_outbox event (upsert/delete/account purge), keyed idempotently by account + source identity + version.
3. Index worker claims event; validates organization/account lifecycle generation; calculates source/content/metadata hashes.
4. Content changed -> rebuild chunks and embeddings using deterministic account-scoped vector IDs. Metadata-only changed -> patch payload only. Delete/purge -> delete SQL derived rows and vector points.
5. Mark event complete and advance the source/index version only after the relevant SQL and vector operations succeed.
6. Reconciliation scans for stale/missing index state and retries without blocking provider sync.

If the repository's existing queue/outbox abstraction can satisfy this contract, extend it instead of creating a competing queue. Do not rely on RabbitMQ alone as the source of truth.

## Implementation slices

1. **Inventory and contracts**
   - Inspect migrations/schema for knowledge documents/chunks, vector IDs, embedding storage, account removal routes, and existing outbox/job primitives.
   - Define canonical hash helpers and typed index event states.
   - Add golden tests for stable hashes, provider-ID scoping, identical bodies across accounts, and hash changes for content vs metadata.
2. **Content-change reindex**
   - Detect changed content during email upsert and enqueue/re-mark the exact account/message for indexing.
   - Replace indexed_at IS NULL as the only eligibility signal with expected/current index version or a durable dirty status.
   - Add update, replay, and partial-failure tests.
3. **Vector ownership**
   - Ensure each vector point has deterministic account-scoped identity and metadata; implement safe upsert/delete/payload-update against the actual vector adapter.
   - Add mocked adapter tests for retries and deletion of one of two accounts without affecting the other.
4. **Account removal**
   - Implement a durable account-purge request, lifecycle tombstone/generation, account-scoped SQL cleanup, vector cleanup, and UI/API status.
   - Add tests for remove while indexing is queued/running, retry after partial vector deletion, disconnect-vs-remove, and reconnect.
5. **Reconciliation and operations**
   - Add orphan/missing-point reconciliation, counts/status/error telemetry, and an operator replay path.
   - OPS-01 verifies live PostgreSQL/RabbitMQ/Redis/Qdrant configuration and ingestion; DEV-01 does not claim live success.
6. **Security and acceptance**
   - Verify tenant/account isolation and delayed-job safety.
   - Keep FIX-01's ISS-026 ownership unchanged; do not wire the model transport around that security handoff.
   - Run focused worker tests and worker/Clara typechecks in a real local checkout; record actual output. Live acceptance remains OPS-01-owned.

## Acceptance criteria

- Same provider message ID in two connected accounts yields different source identities and vector point IDs.
- Identical bodies across accounts do not collide and can be deleted independently.
- A body/subject change updates chunks and vectors exactly once per version.
- A metadata-only inbox action updates vector metadata without duplicate embeddings/chunks.
- A provider hard delete removes its PostgreSQL email row, email-derived document/chunks, and all corresponding vector points before its sync checkpoint is committed.
- Removing an account prevents new sync/index work and eventually removes every email-derived vector point/document/chunk for that account; retries are safe.
- Delayed jobs cannot resurrect a removed account's indexed emails.
- Disconnect semantics are explicit and do not accidentally purge retained mail unless the user chose remove/delete.
- Reconciliation detects and repairs both orphaned vectors and missing vectors.
- Unit/contract tests cover all cases; live Qdrant and mailbox acceptance is reported only with actual OPS-01 evidence.

## Boundaries and verification

- Current main contains the merged PR #15 email-tool and Gmail history work. PR #15 is closed/merged (merge commit reported by GitHub: d444cf1b35939008058532b0754b46daef7cc312).
- This plan is a source-level design update, not an implementation or runtime PASS.
- A local checkout is not available in this execution environment and outbound DNS to GitHub failed, so the provider/loop/executor tests and TypeScript checks could not be run here. Run them in the user's local checkout and record real output.
- FIX-01 owns ISS-026. OPS-01 owns live infrastructure and ingestion verification.
