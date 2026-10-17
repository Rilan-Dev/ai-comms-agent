# Infrastructure Integration Status

Last updated: 2026-10-09. This document distinguishes a configured endpoint or running container from an application integration that actually performs work.

## Service map

| Service | Current role in code | Active use | Missing integration |
|---|---|---|---|
| PostgreSQL | Authoritative application state | Connected accounts, encrypted provider credentials, sync cursors, email threads/messages/drafts, chat conversations and history | Runtime acceptance still needs shared web/worker DB and migration verification |
| Qdrant | Intended vector store behind Clara RAG/knowledge | The chat route invokes Clara Core with the selected organization KB and hybrid RAG; application code has no direct Qdrant client or email embedding/indexing worker | Verify Clara KB points to configured Qdrant; implement email chunk/embed/upsert and deletion/update reconciliation using Clara's supported RAG APIs, never a parallel vector implementation |
| Redis | Mailbox batch coordination lease plus health visibility | When REDIS_URL is configured, worker uses SET NX PX to coordinate one mailbox-sync batch across worker replicas; release uses compare-and-delete Lua and lease expiry recovers abandoned ownership | Validate against real Redis and test contention, connection failure, expiry, TLS, and authentication. No Redis means PostgreSQL per-account claim remains active; configured-but-unavailable Redis skips that batch rather than proceeding without distributed coordination |
| RabbitMQ | Declared endpoint and health visibility; architecture describes event queues | RABBITMQ_URL is read by health reporting and operations status; provider outcomes currently route directly to the host automation evaluator | No active AMQP producer/consumer or durable email.sync queue was found. Implement durable queues, publisher confirms, acknowledgements, retry/dead-letter behavior, and PostgreSQL cursor/idempotency as source of truth before claiming queue-backed sync |
| Clara Core | AI/chat and hybrid RAG runtime | /api/chat/stream calls claraRuntime.createChatTurn; email-related prompts receive tenant-scoped records from PostgreSQL as untrusted context | Live provider, KB, and mailbox-to-chat acceptance still pending |

## Connected email account data flow

1. OAuth or IMAP/SMTP account connection creates an email_accounts row scoped to organization_id.
2. Provider credentials are stored through PostgresEmailAccountRepository encrypted with CREDENTIALS_MASTER_KEY; plaintext tokens/passwords must never be sent to the browser or committed.
3. The worker reads due, non-deleted accounts and their encrypted credentials, connects the matching provider adapter, persists sync state in email_sync_states, and upserts email_threads / email_messages. Provider message IDs are unique per account so retries can be idempotent.
4. The chat stream route authorizes the organization and agent, then loads at most 20 records from connected accounts where both message and account organization IDs match the authenticated organization. Email content is explicitly marked untrusted before it is passed to Clara.
5. This PostgreSQL context path is the current immediate read path for chat. It does not mean all historical mail has been synchronized, nor that chat can perform provider-side read/draft/send actions through an authorized tool registry. A successful chat response is grounded only in the rows retrieved for that turn.

## Local infrastructure

infra/docker-compose.yml now contains runnable PostgreSQL, Redis, RabbitMQ, and Qdrant services under the opt-in local-infra Compose profile. Start them explicitly with:

    docker compose -f infra/docker-compose.yml --profile local-infra up -d

This is local-development infrastructure only. The manual app stack in infra/docker-compose.yml intentionally uses external endpoints from .env.docker; enabling local containers does not automatically connect application code to them. Replace local-only credentials before any network exposure. Production service provisioning and deployment remain OPS-01's responsibility.

## Completion criteria before calling these services enabled

- Qdrant: prove a configured Clara KB can retrieve an indexed item; add email indexing only through supported Clara RAG interfaces, and reconcile edits/deletions.
- Redis: add a real client-backed use case with bounded timeouts, TTL, and health/failure policy; do not treat an environment variable as integration.
- RabbitMQ: add a real publisher/consumer and durable queue topology, idempotency, retry/DLQ, and graceful fallback/recovery against PostgreSQL sync cursors.
- End-to-end email: verify Gmail, Zoho, and IMAP/SMTP ingestion into PostgreSQL, then verify the same records are used by Clara Chat in the correct organization. Run focused tests and live runtime acceptance when credentials and deployed services are available.

## 2026-10-09 — Redis mailbox lease source update

The worker now uses a Redis lease around each mailbox-sync batch when `REDIS_URL` is configured. The lease uses a random owner token, `SET NX PX` with a 10-minute TTL, and token-checked Lua release so a stale worker cannot delete a newer worker's lease. Contending workers skip the batch. If Redis is configured but unavailable, the batch is skipped and an error is logged; when Redis is not configured, existing PostgreSQL per-account claims continue to provide the existing concurrency guard. This is source implementation only; no Redis server, contention test, worker typecheck, or live mailbox run was executed. The lease does not replace PostgreSQL sync cursors or per-account claims.

Redis lease regression test source added at `apps/worker/tests/redis-lease.test.ts` (commit `fbd07ca9dee64a3fbe114bb16cf08fadcfa695f1`) for acquisition/contention, token-checked release, and AUTH/database selection. The suite has not been executed; live Redis validation remains pending.


## 2026-10-09 — Fragmented IMAP literal regression source

Added a PassThrough-socket regression that splits the literal marker, literal payload, and following tagged response across socket chunks. This extends source coverage only; no test or live-server execution has occurred.


## 2026-10-09 — Queue contract groundwork and Clara indexing boundary audit

- Added `apps/worker/src/queues/email-sync-message.ts` with the documented `email.sync` envelope, UUID validation, stable account/history idempotency key, correlation/message IDs, timestamps, producer/consumer labels and bounded attempt count.
- Added `apps/worker/tests/email-sync-message.test.ts` for normal sync, full-sync idempotency and invalid payloads. Tests have not been executed.
- RabbitMQ is still **not integrated**: no AMQP client/transport, durable topology, publisher confirms, manual ack consumer, retry policy, or DLQ exists. This change is contract groundwork only.
- Clara boundary audit: local `packages/clara-core/src/runtime.ts` exposes `retrieve()` but no supported indexing API; `createProvider().embedText/embedBatch` deliberately reject because embeddings are not configured. The reference library contains Qdrant/indexing modules, but those rely on Clara-specific DB/provider/vector-store imports and are not a drop-in host API. No direct Qdrant indexing was added. A supported host adapter boundary must be defined before email indexing can be called complete.


## 2026-10-09 — RabbitMQ email.sync source integration

- Added `amqplib` to the worker dependencies and lockfile, plus `apps/worker/src/queues/email-sync-rabbitmq.ts`.
- Source declares durable `email.sync`, `email.sync.retry`, and `email.sync.dlq` queues; retry queue uses a 30-second TTL and dead-letter routing back to the main queue. Messages are persistent, include correlation/message/idempotency metadata, and are published on confirm channels with `waitForConfirms()`.
- Consumer uses prefetch=1 and manual ack. It publishes the next bounded retry or DLQ copy and waits for confirmation before acknowledging the original. If republish cannot be confirmed, the original is nacked/requeued.
- Worker polling publishes eligible account sync jobs when `RABBITMQ_URL` is configured; the consumer dispatches to the existing account-scoped PostgreSQL claim/provider sync implementation. Without RabbitMQ configuration, the existing PostgreSQL polling path remains active.
- Added source-level contract tests in `apps/worker/tests/email-sync-rabbitmq.test.ts`. Tests/typechecks, dependency lockfile acceptance, broker connectivity, reconnect behavior, and live delivery have not been verified. This is source integration, not runtime acceptance.
- Clara Core still has no supported indexing API identified in the host runtime; next implement an explicit supported adapter contract, not a parallel/direct Qdrant implementation.


## 2026-10-09 — Queue polling and Clara email knowledge hardening

- Fixed consumer initialization order so RabbitMQ channels are assigned before registering the callback; this prevents a queued delivery from reaching a handler with uninitialized channel references.
- Fixed mailbox producer eligibility: an existing sync cursor no longer bypasses the 15-minute freshness window. Pending/error accounts remain eligible subject to retry scheduling.
- Email knowledge adapter now chunks bodies into bounded overlapping segments and safely rebuilds a document's chunk set when content boundaries change. Host Clara lexical retrieval searches sanitized terms and preserves organization plus shared/agent document scope.
- Static regression tests added. Tests/typecheck/build and live RabbitMQ/PostgreSQL/Clara acceptance remain not run. The adapter is lexical PostgreSQL retrieval only; no embedding generation or direct Qdrant write is claimed.
