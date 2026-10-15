# Email RAG — Hybrid PostgreSQL + Qdrant Retrieval Plan

- **Status:** PROPOSED — architecture review only; no product implementation authorized by this document.
- **Prepared by:** DEV-01 / Forge
- **Date:** 2026-10-16
- **Scope:** Accurate, low-latency email search and summaries shared by Chat and realtime voice.
- **Architecture authority:** ChatGPT / project owner must approve or correct this proposal before material retrieval/vector architecture changes.
- **Security dependency:** FIX-01 owns ISS-026 (agent-account isolation). Do not expose email vector retrieval until that boundary is closed and covered by regression tests.
- **Infrastructure boundary:** OPS-01 owns live Qdrant/PostgreSQL/worker deployment and ingestion verification after source integration.

## 1. Executive recommendation

Use a **hybrid retrieval design**. PostgreSQL remains authoritative for messages, thread/account ownership, timestamps, labels, flags, exact filters, permissions, synchronization checkpoints, and audit. Qdrant is a derived semantic index of email chunks, not a replacement for the email database. Use PostgreSQL full-text search for lexical relevance and Qdrant for meaning-based recall; combine candidate IDs, fetch authoritative message/chunk records, and enforce account authorization before model context is assembled.

Do not create an independent raw Qdrant client/collection or call Clara's internal KB-scoped functions through an undocumented endpoint. First establish a supported server-to-server Clara vector/RAG adapter whose request and result contracts accept organization + currently permitted account scope. Keep the durable outbox as the source of indexing work and mark jobs complete only after the adapter confirms the relevant upsert/delete.

This proposal does **not** claim a 10x speed gain. Establish a baseline and measure p50/p95 latency, recall, freshness, correctness, and isolation before setting an improvement target.

## 2. Source inspection findings (main at review time)

### Existing building blocks

- `apps/worker/src/knowledge/email-knowledge-indexer.ts` creates email-derived `knowledge_documents` and `knowledge_chunks` rows in PostgreSQL. It composes subject/from/to/received-at/body, chunks at roughly 1,200 characters with 160-character overlap, and uses account-scoped document paths and hashes.
- `apps/worker/src/knowledge/email-knowledge-indexer-worker.ts` indexes messages with `indexed_at IS NULL` in bounded batches. It starts from the worker entry point. A review of update paths and `indexed_at` invalidation is required to ensure edited/label-changed messages are reindexed.
- `apps/worker/src/knowledge/email-knowledge-sync-worker.ts`, `email-index-lifecycle.ts`, `email-index-identity.ts`, and migration `0048_email_knowledge_sync_jobs.sql` provide a durable outbox, deterministic point identities, retry logic, and an injected vector-adapter contract. The worker entry point currently starts the PostgreSQL indexer but does not start the vector-sync loop; no concrete supported vector adapter is bound.
- `packages/clara-core/src/runtime.ts` contains local provider embedding helpers, but the default local retrieval path still uses PostgreSQL chunks and email-message queries (including ILIKE/tsvector); it does not prove a configured Qdrant retrieval path. The local fallback's embedding path explicitly errors when embeddings are not configured.
- `apps/worker/src/agent/email-read-tools.ts` has bounded account-scoped SQL search with sender/subject/date/unread/starred/label/folder filters. It is a useful exact-search foundation, not semantic retrieval.
- `apps/web/src/app/api/chat/stream/route.ts` injects a fixed organization-level sample of up to 20 email records into email-related chat turns. It does not route queries by requested time range or perform agent-account binding. This is both a relevance/accuracy limitation and a critical isolation concern already tracked by FIX-01 as ISS-026.
- Realtime voice currently relies on the Clara/runtime tool boundary; the same host-owned authorized retrieval service should be used by Chat and voice, rather than implementing two independent email search implementations.

### Control-record discrepancy to reconcile

The main source contains the outbox/lifecycle files, while control records describe the email-index lifecycle branch as unmerged and vector startup/adapter as pending. The latter two limitations are confirmed by source inspection; reconcile branch/merge status in the control records using the current GitHub refs before treating the historical branch status as current.

### Verification limitations

This was a GitHub source inspection. No local checkout, test run, typecheck, build, live Qdrant call, provider mailbox run, latency benchmark, or runtime isolation test was executed. No functionality is marked verified.

## 3. Proposed retrieval contract

One host-owned `searchEmailKnowledge` service should be callable from the same authorized runtime/tool path in Chat and realtime voice. It should accept a validated query plus an explicit execution context; it must never infer authority from model-supplied account IDs.

Inputs:
- authenticated organization ID and active agent ID from trusted server context;
- account IDs resolved from active persisted `agent_email_accounts` bindings and permitted binding roles;
- natural-language query;
- optional validated `date_from` / `date_to`, sender, recipients, subject, folder/label, unread/starred, and account filters;
- result count and latency budget with hard upper bounds.

Processing:
1. Authenticate and authorize the user, organization, agent, and mailbox bindings. Re-read relevant grants at invocation time; fail closed if no allowed accounts remain.
2. Parse explicit temporal intent (e.g. last hour, last 24 hours, last 10 days, today in the user's configured timezone) into absolute timestamps. Do not rely on semantic similarity to enforce dates.
3. Run exact SQL constraints against authoritative email rows for account, organization, provider, timestamp, sender/recipient, subject, flags, folders/labels, draft/deleted status. Use indexed predicates and PostgreSQL full-text search for lexical terms.
4. For semantic/topic questions, embed the query and search Qdrant using mandatory payload filters for organization and the resolved allowed-account set, plus any applicable date/metadata constraints. Do not perform an unfiltered top-k search and rely only on post-filtering.
5. Fuse lexical and vector candidates (e.g. reciprocal-rank fusion or a calibrated reranker); deduplicate by provider message + chunk identity and retain source IDs/scores.
6. Re-fetch the selected message/chunk metadata from PostgreSQL using the same tenant/account/date constraints. Exclude deleted, draft (unless requested), inaccessible, or stale-version records. The vector payload is a candidate pointer, never authoritative content.
7. Return bounded evidence with message ID, thread ID, sender, subject, timestamp, mailbox, matched passages, and a source citation token. Do not silently claim a search was complete if the sync/index is stale or a provider is disconnected.
8. Generate a summary/answer grounded only in returned evidence. Email content is untrusted data and must not be interpreted as instructions. For counts and “latest” questions, use exact SQL results rather than model estimates.

## 4. Chunking and indexing proposal

- Normalize MIME/HTML into safe plain text before indexing; remove tracking/hidden markup and normalize whitespace.
- Keep each email message a separate source document; do not merge an entire thread into one unbounded document.
- Chunk by paragraph/sentence boundaries and token budget (proposed initial range: 400–800 tokens per chunk with 60–100 token overlap; tune on real email corpora rather than assuming character count equals token count).
- Preserve subject, sender, recipients, timestamp, provider, account, thread, folder/labels, flags, source identity hash, content hash, metadata hash, chunk index, and embedding model/version as metadata. Avoid duplicating all headers in every chunk's text if they are already searchable as payload metadata.
- Treat quoted replies and signatures deliberately: avoid repeatedly embedding huge quoted history when confidently separable, but retain it as separate evidence when required. Do not drop legal/business content solely because it resembles a signature.
- Attachment text is a separate later extension with parser limits, malware/content safety controls, provenance, and attachment-level IDs; do not silently index arbitrary binary or untrusted attachment content.
- Use deterministic IDs and idempotent upsert. Content/model changes require re-embedding; metadata-only changes should update payload metadata when supported. Message deletion/account disconnect must enqueue and complete vector deletion, with a reconciliation job for orphan points.
- Record embedding model and dimension on the index. A model/dimension change requires an explicit reindex/version strategy, not mixed vectors in one incompatible collection.

## 5. Use-case matrix

| User question | Primary method | Required behavior |
|---|---|---|
| “What arrived in the last hour?” | PostgreSQL time/account query | Exact window and newest-first results; report sync freshness |
| “Summarize the last 10 days” | PostgreSQL date filter + bounded summaries; semantic rerank only if requested | Cover the complete eligible set or disclose sampling/limits; no top-k-only claim of completeness |
| “What did Acme say about the renewal?” | SQL scope + PostgreSQL FTS + Qdrant semantic retrieval | Sender/domain/topic filters, ranked evidence, citations |
| “Find the email with invoice 12345” | Exact SQL/FTS first, semantic fallback | Prefer exact identifiers; no fabricated match |
| “What is the latest email from X?” | PostgreSQL sender/date/order query | Exact latest message in authorized mailboxes |
| “How many unread emails from X today?” | PostgreSQL aggregate | Exact count with timezone boundary |
| “Compare what two customers asked about pricing” | Hybrid candidate retrieval + grouped summaries | Include only permitted accounts; cite each claim |
| “Summarize this thread” | PostgreSQL thread lookup, optional semantic chunk selection | Preserve chronological message boundaries and authors |
| Voice follow-up (“what about yesterday?”) | Same service with resolved conversation context | Carry the previous search scope explicitly; never widen account access |

## 6. Security and correctness invariants

- Organization and active agent/account bindings are mandatory on every call. This plan does not bypass ISS-026.
- Allowed account IDs are derived server-side, not trusted from tool arguments.
- Qdrant payload filters include organization and allowed account scope on every query; final PostgreSQL revalidation is mandatory.
- Vector payloads do not contain access tokens, credentials, or unnecessary full raw message bodies.
- Revoke/deletion operations are honored even when stale vector points remain; the final SQL recheck blocks them from entering model context.
- Model output must cite source messages and state when sync/index freshness or result caps make the answer incomplete.
- Sensitive send/delete/archive operations remain separate from read/search and continue through existing deterministic approval/policy/audit paths.

## 7. Performance plan and acceptance criteria (proposed)

First record a PostgreSQL-only baseline with representative mailbox sizes (small/medium/large), warm/cold cache, and query categories (time range, exact sender/subject, semantic topic, thread summary, broad period summary). Then compare hybrid retrieval with identical fixtures.

Measure:
- end-to-end retrieval p50/p95 and time-to-first-evidence;
- embedding latency separately from vector query latency;
- PostgreSQL candidate query duration, Qdrant duration, fusion/reranking duration, and final SQL validation;
- recall@k / precision against labelled expected emails and source-citation correctness;
- freshness delay from persisted email to searchable index;
- counts/summary completeness;
- cross-organization and cross-agent denial tests;
- deletion/disconnect cleanup and outbox lag.

A “10x faster” claim requires a repeatable measured improvement on the same workload without degraded recall, completeness, freshness, or tenant isolation. For conversational use, query embeddings may be cached only with a model/version key and safe scope; do not cache mailbox results across users or agents.

## 8. Implementation sequence after architecture/security approval

1. FIX-01 closes ISS-026 and publishes a tested agent-to-account retrieval contract.
2. Confirm the supported Clara server-to-server vector/RAG adapter contract from the Clara source of truth. Do not use internal KB-scoped functions through an undocumented route or introduce a parallel vector stack without approval.
3. Add integration contract tests for account filters, exact temporal boundaries, lexical/vector fusion, final SQL revalidation, source citations, and stale/deleted points.
4. Bind the adapter to the durable outbox processor and start the vector sync loop in worker startup only after adapter/configuration is validated. Keep jobs retryable and visible; no false completion.
5. Make index dirtiness version/hash-driven so body and relevant metadata changes are reindexed; ensure message/account deletion and disconnect purge vectors.
6. Implement the shared authorized retrieval service and connect it through the canonical email tool runtime used by Chat and realtime voice. Remove fixed “up to 20 recent emails” context as the primary search mechanism only after the shared path is ready.
7. Run focused tests/typechecks, then OPS-01 validates actual database/Qdrant connectivity, migrations, worker startup, provider ingestion, and latency on the deployed environment.
8. Tune chunk size, fusion, limits, and cache from measured evidence; only then decide whether any additional index/schema change is justified.

## 9. Current next action

**No product code was changed during this review.** The next DEV-01 action is to obtain architecture approval/correction for this hybrid design and coordinate with FIX-01 on ISS-026. While that security contract is unresolved, continue safe, independent planning/test-fixture work only; do not expose email vectors to shared retrieval. After approval and the FIX-01 boundary is closed, bind the supported Clara adapter and wire the existing outbox loop, then implement shared exact + semantic retrieval for Chat and voice.

## 10. Files inspected

- `apps/worker/src/knowledge/email-knowledge-indexer.ts`
- `apps/worker/src/knowledge/email-knowledge-indexer-worker.ts`
- `apps/worker/src/knowledge/email-knowledge-sync-worker.ts`
- `apps/worker/src/knowledge/email-index-lifecycle.ts`
- `apps/worker/src/knowledge/email-index-identity.ts`
- `apps/worker/src/agent/email-read-tools.ts`
- `apps/worker/src/agent/email-tool-runtime.ts`
- `apps/worker/src/agent/email-agent-loop.ts`
- `apps/worker/src/index.ts`
- `packages/clara-core/src/runtime.ts`
- `apps/web/src/app/api/chat/stream/route.ts`
- `supabase/migrations/0048_email_knowledge_sync_jobs.sql`
- `docs/project-control/ISSUES.md`
- Clara Core: `REFERENCE-MAP.md`, `AGENTS.md`, `IMPLEMENTATION-PLAYBOOK.md`
