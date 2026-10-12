# Email Operations & Agent Tooling — Implementation Plan

**Plan ID:** EMAIL-OPS-01  
**Owner:** DEV-01 / Forge  
**Status:** IMPLEMENTATION IN PROGRESS — owner has directed DEV-01 to proceed with the next slices  
**Baseline:** `main` at `4dc991fa5616f9a04ed3050a7c748e489c6e75f5` (2026-10-12)  
**Scope:** Reliable multi-account email ingestion, synchronization, mailbox operations, and complete host-authorized AI-agent access to email features across chat, realtime voice, WhatsApp, and scheduled execution.

This plan is a proposal and does not itself authorize architecture changes, production activation, a provider/library migration, or claims of runtime readiness.

## 1. Repository recovery and current findings

### Existing architecture to preserve

- Monorepo: Next.js web app, Node worker, shared contracts, DB repositories, and a Clara adapter boundary.
- Email adapter sources: `apps/worker/src/email/gmail-adapter.ts`, `imap-smtp-adapter.ts`, `zoho-adapter.ts`, `provider-runtime.ts`, `mailbox-sync-worker.ts`, `provider-draft-worker.ts`, and `action-worker.ts`.
- Queue integration: `apps/worker/src/queues/email-sync-rabbitmq.ts`; PostgreSQL-driven polling remains a recovery/fallback path.
- AI boundary: Clara exposes a narrow host-bound runtime tool interface (not a general email tool registry). The application must own email tools and enforce its permissions/policy/audit before adapter calls.
- Contracts and policy references: `docs/architecture/EMAIL_AGENT_ARCHITECTURE.md`, `EMAIL-PROVIDER-ARCHITECTURE.md`, `AI-ARCHITECTURE.md`, `SECURITY_MODEL.md`, `docs/specs/TOOL-CONTRACTS.md`, `AUTHORIZATION.md`, `PROVIDER-CONTRACTS.md`, and `EVENT-CONTRACTS.md`.

### Confirmed source-level gaps and risks

1. **Gmail sync deltas are incomplete:** `GmailAdapter.sync()` currently returns no `updated` or `deleted` entries, processes only one history response page, and must be checked for complete label, trash/delete, and history pagination semantics.
2. **Gmail message conversion is too coarse:** the current adapter has basic MIME/body decoding and comma-splits address headers; charset handling, multipart alternatives, RFC 2047 headers, nested MIME, attachment metadata, and sanitization need dedicated tested parsers.
3. **Thread-safe action semantics need review:** Gmail `reply()` currently creates and immediately sends a new draft without explicit RFC thread metadata; `forward()` also sends immediately. The host action/policy layer must control whether these methods may send; adapter convenience methods must not bypass approval.
4. **Provider capabilities are not equal to product intent:** Zoho currently declares `send: false` and `forward: false`; IMAP/SMTP must report only actually implemented operations. Do not claim an operation merely because the interface describes it.
5. **Account identity must remain explicit:** provider-level IDs such as the current Gmail adapter's `email_account_id: "gmail"` must never be treated as the real tenant/account ID. Map provider DTOs to host account/org identity at a clear boundary.
6. **AI coverage is incomplete:** role-local history says chat email context has existed, but a bounded context query is not equivalent to an authorized, schema-validated, complete email tool catalogue shared by chat, voice, WhatsApp, and schedules.
7. **Operational dependencies remain separate blockers:** the latest durable OPS record says a running environment had a placeholder RabbitMQ vhost and Redis `WRONGPASS`, with queued Gmail sync but zero stored messages. Source plans cannot resolve live credentials/configuration. OPS-01 owns runtime configuration and ingestion proof; FIX-01 owns substantial source bugs and regression remediation.
8. **Verification is incomplete:** GitHub source writes and static assertions are not executed tests, provider integration, persisted mailbox ingestion, build, or deployment evidence.

These are source/document observations, not claims that every issue remains unchanged in the live deployment. Re-check each file and active issue immediately before implementation.

## 2. Product outcomes

- Connect multiple independent Gmail, IMAP/SMTP, and Zoho accounts per authorized agent/organization; preserve the existing rule of exactly one WhatsApp Business account per agent.
- Import historical mail, continue incremental sync, recover from expired/invalid cursors, and reconcile flags, labels/folders, thread membership, drafts, sent mail, deletions/trash, and provider changes.
- Make inbox listing, folder/label listing, search, thread/detail reads, attachment metadata/download, draft create/update/delete, reply/forward draft creation, send, mark read/unread, star/unstar, archive, move, labels, and bulk operations discoverable as AI tools **only when** provider capability, account grant, agent grant, organization permission, and execution-time policy allow them.
- Use one host-owned tool catalogue/runtime for chat, realtime voice, WhatsApp, and scheduled jobs. Channel differences must not create duplicate authorization logic.
- Keep PostgreSQL authoritative; queues are transport; Redis leases are coordination; Qdrant is an optional retrieval index and never the authoritative mail store.
- Report honest partial failures and unsupported operations; never convert empty/failed provider results into a successful sync.
- Treat every message, attachment, HTML body, quoted thread, subject, sender display name, and provider error as untrusted data.

## 3. Target code organization

Refactor incrementally. Do not move every existing file in one large commit or introduce a new framework before mapping current imports/tests.

```text
apps/worker/src/email/
  domain/
    email-message.ts              # normalized domain DTOs and invariants
    email-capabilities.ts         # capability vocabulary/operation map
    email-errors.ts               # typed provider/sync errors
  providers/
    gmail/
      gmail-adapter.ts            # provider API calls + capability declaration
      gmail-mapper.ts             # Gmail DTO -> normalized DTO
      gmail-mime.ts               # RFC/MIME decoding and message construction
      gmail-sync.ts               # initial/history sync strategy
    imap-smtp/
      imap-smtp-adapter.ts
      imap-response-reader.ts     # only if extraction reduces current risk
      imap-mapper.ts
      rfc822-mime.ts
      imap-sync.ts
    zoho/
      zoho-adapter.ts
      zoho-mapper.ts
      zoho-sync.ts
  sync/
    sync-orchestrator.ts           # provider-neutral run lifecycle
    cursor-store.ts                # durable cursor/checkpoint contract
    reconcile-mailbox.ts           # update/delete/label/folder reconciliation
    retry-policy.ts                # bounded retry classification/backoff
    sync-run-repository.ts          # run state/diagnostics if schema supports it
  parsing/
    parse-message.ts
    sanitize-html.ts
    address-parser.ts
    header-decoder.ts
  attachments/
    attachment-service.ts
    attachment-policy.ts           # size/type/scan/storage contract
  search/
    email-search-service.ts        # tenant-scoped DB search
    email-query-schema.ts
  actions/
    draft-service.ts
    reply-service.ts
    forward-service.ts
    send-service.ts
    mailbox-mutation-service.ts
  agent-tools/
    email-tool-catalog.ts          # one catalogue of schemas/capabilities/sensitivity
    email-tool-handlers.ts         # thin handlers into services
    email-tool-authorization.ts     # reusable execution-time checks
  observability/
    email-sync-events.ts
    email-redaction.ts
```

This is the target modularity, not a mandate to create empty folders. Start by extracting pure mappers/parsers and sync logic from current files when tests make the boundary safer. Shared domain contracts remain under `packages/shared/src/email/`; DB operations remain in `packages/db/`; routes remain in `apps/web/src/app/api/`; Clara is integrated through `packages/clara-core/`.

## 4. Implementation workstreams and order

### Workstream A — Inventory and contract freeze

- Inventory all existing email routes, DB tables/migrations/repositories, queue events, sync cursors, draft/send/approval paths, and existing tests.
- Build an operation matrix by provider with `implemented`, `not supported`, `partial`, and `not verified` states. Compare advertised capabilities to actual methods and tests.
- Establish canonical identity tuple: `organization_id`, `agent_id`, `email_account_id`, provider message ID, provider thread ID, and local row ID. Never infer tenant identity from provider DTOs.
- Reconcile docs that still describe a future/deferred architecture with current implementation. Preserve historical records; add dated status notes rather than silently rewriting history.

**Exit evidence:** reviewed operation matrix, route/service inventory, test inventory, explicit no-claim list, and owner approval of any required schema/contract changes.

### Workstream B — Reliable sync lifecycle

- Define a typed `SyncRunResult` with cursor/checkpoint, added/updated/deleted IDs, changed labels/folders, counts, partial errors, retryability, and completion status.
- Initial import: stable baseline cursor, bounded pages, resumable checkpoints, idempotent upserts, and only mark the account connected after successful persisted work.
- Incremental sync: fully page provider deltas; persist cursor only after corresponding changes have been safely persisted; replay safely after crash; reconcile changed labels/read/star/folder/thread state and deletions/trash according to provider semantics.
- Gmail: handle `historyId` pagination, 404/expired history by idempotent re-baselining, label changes, message/thread updates, deletion/trash semantics, 429 quota/rate limits, Retry-After, 5xx, invalid grant, and partial batch errors.
- Zoho: keep folder/offset cursor durable; distinguish initial import from bounded incremental refresh; verify provider API pagination/order and handle messages moving folders without duplicating rows.
- IMAP/SMTP: use per-folder UIDVALIDITY + UID/modseq where supported; reset cursor on UIDVALIDITY changes; process FETCH literals by byte count; preserve partial failures; implement MIME parsing separately; use IDLE only after reconnect/timeout handling is tested.
- Sync scheduling: provider webhook/IDLE should accelerate, not replace periodic reconciliation. Queue delivery is at-least-once; PostgreSQL constraints and idempotency are authoritative. A failed RabbitMQ path must not silently starve the direct fallback.
- Add per-account concurrency control, bounded timeouts, cancellation, backoff/jitter, maximum batch sizes, retry classification, dead-letter/replay visibility, and sanitized per-run diagnostics.
- Never advance a durable cursor on a failed or only partially persisted page.

**Exit evidence:** deterministic tests for initial pagination, resume after crash, duplicate delivery, expired cursor, history pagination, updated/deleted message reconciliation, concurrent claims, retry/DLQ, and zero-message/error distinction.

### Workstream C — Canonical parsing, threads, and attachments

- Extract provider-specific mappers from adapters and share tested parsing primitives where semantics genuinely overlap.
- Parse From/To/Cc/Bcc with RFC-aware address parsing; decode encoded headers and declared body charsets; handle multipart/alternative, nested multipart, transfer encodings, text/plain vs text/html, malformed messages, and size limits.
- Store only sanitized/render-safe HTML or keep raw data in a separately protected path only if the architecture explicitly authorizes it; sanitize scripts, active content, event handlers, dangerous URL schemes, and remote tracking where required.
- Preserve `Message-ID`, `In-Reply-To`, `References`, provider thread IDs, received/sent dates, flags, labels/folders, and stable ordering. Thread grouping must not collapse unrelated messages or lose provider-native thread IDs.
- Treat attachment metadata and bytes separately. Enforce byte/size/type limits, malware/quarantine status, tenant-scoped storage, hashes, deduplication, authorization on download, and no auto-open/execute.
- Ensure parsing failure is visible and retryable where safe; do not silently replace unknown encoding or partial content with false complete content.

**Exit evidence:** fixture-driven MIME/header/parser tests including malicious HTML, unusual charsets, nested multipart, inline/regular attachments, malformed boundaries, and threading headers.

### Workstream D — Complete mailbox operations

Implement through application services, not direct route-to-provider calls:
- Read surfaces: account list/status, folders, labels, paginated inbox, message detail, thread detail, provider/local search, date/range filtering, sender/recipient/subject/body query, unread/starred/attachments filters, summaries and extraction.
- Safe mutations: mark read/unread, star/unstar, archive, move, apply/remove labels, draft create/update/delete. Apply multi-message operations with bounded batches, explicit result per target, and no false all-or-nothing claim when provider APIs are partial.
- Sensitive operations: send, reply-send, forward-send, trash/delete, bulk destructive actions, and provider settings/rules. Keep draft creation separate from sending. Replies must include proper thread ID, In-Reply-To, References, recipient semantics, and quote policy. Forwarding must preserve required headers/body/attachments per supported provider.
- For send: persist immutable approved payload snapshot/hash, recipients, account, action ID, actor, policy decision, approval identity/time, idempotency key, and audit record. Handle uncertain network outcomes without blind resend; reconcile with provider sent folder/API before retrying.
- Correct capability metadata to match implemented behavior. Unsupported means structured `CapabilityNotSupported`, never a stub returning empty success.

**Exit evidence:** per-operation provider contract tests, action approval tests, retries/uncertain-send tests, and truthful UI/API states.

### Workstream E — Agent tool harness for all email operations

- Implement/extend a single host-owned email tool catalogue based on `docs/specs/TOOL-CONTRACTS.md`, with stable names, JSON Schemas, descriptions, sensitivity, required permissions, required provider capability, idempotency, timeout, and audit metadata.
- Group tools by task but expose operations granularly. Candidate groups:
  - discovery: `email.accounts.list`, `email.capabilities.get`, `email.folders.list`, `email.labels.list`
  - reads: `email.messages.list`, `email.message.get`, `email.thread.get`, `email.search`, `email.attachment.metadata`, `email.attachment.download`
  - intelligence: `email.summarize`, `email.classify`, `email.extract`
  - drafts: `email.draft.create`, `email.draft.update`, `email.draft.delete`, `email.reply.draft`, `email.forward.draft`
  - mutations: `email.message.mark_read`, `email.message.star`, `email.message.archive`, `email.message.move`, `email.labels.apply`
  - sensitive execution: `email.send`, `email.reply.send`, `email.forward.send`, `email.message.trash`, `email.bulk_action`
- These names are proposals; reconcile with existing catalogue and current API/tool names before adoption to avoid duplicate or breaking contracts.
- Tools accept logical account selection only after server-side resolution. The runtime must validate org membership, agent-to-account grant, actor/channel identity, account active status, provider capability, input schema, policy, and approval state at execution time. LLM-provided organization IDs, user IDs, grants, or claims are never trusted.
- Tool discovery is filtered to tools the current agent/channel can actually use; discovery is not authorization. Repeat checks immediately before execution and before sensitive side effects.
- All tool handlers call the same domain services used by UI/API; chat, realtime voice, WhatsApp, and schedules must share this exact path and audit format. Do not build a separate email implementation per channel.
- Return structured, bounded results; never pass whole mailboxes, tokens, raw attachments, or unbounded bodies into the model. Summaries include message references/IDs and tenant-bound provenance.
- Email and attachment content are untrusted data wrapped/labelled as such. Prompt injection cannot change tool grants or action policy.
- Add policy checks and audit for every read and mutation, with PII/content redaction. Enforce per-agent allowed-tool settings and permission revocation immediately.

**Exit evidence:** catalogue/schema tests, authorization matrix tests, capability-filtering tests, execution-time revocation tests, injection tests, and same-tool-path tests for chat/voice/WhatsApp/scheduled entry points.

### Workstream F — Search, indexing, and intelligence

- PostgreSQL is canonical for exact search, filters, paging, and message state. Add/verify indexes and safe query parameterization.
- Qdrant/Clara indexing is asynchronous and rebuildable. Persist index state/version and retry safely; a missing index must not make mail disappear from inbox/search.
- Index only authorized, tenant-scoped, appropriately sanitized fields. Recheck org/account grants at retrieval time and resolve message IDs back through PostgreSQL before returning content.
- Summaries/classification are derived data with model/version/time provenance and source message IDs; refresh after content changes without overwriting the original message.
- Scheduled summaries reuse the same authorized read/summarize tools and durable scheduler, then invoke the existing channel delivery authorization.

**Exit evidence:** full-text and semantic/hybrid search tests, tenant isolation tests, stale-index tests, re-index/replay tests, and source provenance checks.

### Workstream G — Observability and recovery

- Provide per-account `last_attempt_at`, `last_success_at`, cursor/phase, pages/messages processed, retry count, sanitized last error, next retry time, and sync-run correlation ID.
- Distinguish `queued`, `running`, `partial`, `succeeded`, `retrying`, `failed`, `reauth_required`, and `unsupported` as appropriate; don't claim sync from HTTP 202.
- Provide a safe admin requeue/replay flow with audit and idempotency.
- Add bounded structured logs/metrics without OAuth tokens, passwords, full bodies, attachment bytes, cookies, or unredacted provider error payloads.

**Exit evidence:** test transient broker/Redis/provider failures, cursor recovery, safe replay, and sanitized diagnostics.

## 5. Authorization and safety invariants

1. PostgreSQL is source of truth; provider APIs are authoritative for remote operations; Qdrant is only a derived index.
2. Organization/agent/account grant is enforced in server-side repositories and at tool execution, not inferred from the LLM or frontend.
3. Read permissions and sensitive mutation permissions are distinct. Approval policy is deterministic and fails closed for send/forward/delete/bulk destructive changes.
4. Email content, sender names, HTML, attachments, quoted replies, URLs, and tool results derived from mail are untrusted input.
5. No arbitrary URL fetching from email. Any future fetch capability requires SSRF protections and separate authorization.
6. Provider capability declarations are truthful and per-account; never infer support from the interface or plan.
7. Idempotency is required for repeated reads/sync and action processing. Exactly-once remote sending cannot be assumed; ambiguous outcomes require reconciliation.
8. No credentials, tokens, message bodies, cookies, or private mailbox data in logs, source, tests, or GitHub issues.
9. No raw Gmail/Zoho credentials enter the LLM context.
10. Queue/Redis failure must be observable and must not silently bypass lease safety or lose the durable sync checkpoint.

## 6. Test strategy

- **Unit:** mapping, RFC address/header/MIME parsing, capability contract, cursor encoding, retry classifier, query schema, policy rules, tool result redaction.
- **Adapter contract:** every adapter is tested against the same capability-aware contract suite; unsupported operations must fail explicitly.
- **Provider fixtures:** Gmail history pagination/deletion/label changes, expired history, 429 Retry-After, OAuth refresh/revocation; Zoho folder pagination/token refresh/moved message; IMAP UIDVALIDITY changes, fragmented literals, IDLE disconnect/reconnect, SMTP timeout.
- **Worker integration:** Postgres transactions/upserts, duplicate queue deliveries, cursor persistence, concurrent account claims, partial batch failures, retry/DLQ/replay, Redis lease behavior.
- **Agent security:** org/agent/account isolation, grants revoked during a turn, tool schema abuse, prompt injection in email body/HTML/attachment text, approval bypass, cross-channel shared registry, redaction.
- **End-to-end:** connect test mailbox → initial import → inbox query → incremental update → read/thread/search → draft/reply/forward draft → approval → send → provider reconciliation → audit trail.
- **Performance:** bounded batch sizes, API quota behavior, large mailbox initial import, mailbox with huge thread/attachment, concurrent accounts.
- Tests, typecheck, build, browser, live provider, DB and deployment verification are separate evidence categories. Never infer one from another.

## 7. Suggested delivery slices

1. **E0 — Inventory and operation matrix** (this plan + source map; no behavior changes).
2. **E1 — Sync correctness**: Gmail history pagination/delta semantics, durable cursor checkpoints, idempotent reconciliation and truthful state.
3. **E2 — Parsing isolation**: dedicated Gmail mapping/MIME/address/header tests; sanitize HTML at correct persistence/render boundary.
4. **E3 — Agent tool catalogue**: reconcile existing tool registry, define complete email schemas and shared host handlers, wire one path into chat first.
5. **E4 — Permission/capability gates**: prove execution-time account grants and per-tool policy; then expose same runtime path to realtime voice, WhatsApp, and schedules.
6. **E5 — Mailbox operations**: drafts, proper reply/forward construction, flags/labels/folders, move/archive/trash, attachments.
7. **E6 — Zoho parity**: implement send/forward/attachment capabilities only after tests prove support.
8. **E7 — IMAP/SMTP parity**: finish RFC822/MIME, draft CRUD, SMTP send, reconnect/IDLE, server-specific capabilities.
9. **E8 — Search/indexing and scheduled intelligence**: exact DB search first; Clara/Qdrant as derived optional index.
10. **E9 — End-to-end hardening**: integration evidence, recovery, security and performance.

Each slice is separately reviewable and reusable. Reorder only after inventory reveals dependencies; preserve independent work and do not wait on CI/Vercel to design or implement unrelated slices.

## 8. Open questions requiring explicit architecture decision before affected implementation

- Should the official `googleapis` package replace selected manual Gmail REST calls, or should current fetch wrapper be hardened? Proposed default: compare coverage and tests first; adopt the official client only where it reduces OAuth/API correctness risk without broad rewrites.
- What exact OAuth scopes are already consented and supported by the live app? Least privilege; scope upgrades require re-consent and explicit product decision.
- What does the current DB schema store for remote deletions, per-folder cursors, attachment bytes/metadata, and sync run diagnostics? Inventory migrations before proposing schema changes.
- Which operations require mandatory approval vs organization-configurable policy? Preserve current default `always_ask` for send/forward/bulk modify and `never_allow` for delete unless the owner explicitly changes policy.
- Which providers' remote attachment upload, mailbox rules, snooze, scheduled send, and permanent deletion are in product scope? Represent absent operations as unsupported until decided.
- Are provider native webhook credentials/configuration provisioned in production? Webhook support cannot be treated as active based only on an adapter capability flag.

## 9. Ownership and blockers

- **DEV-01 / Forge:** feature inventory, plan, provider/domain/tool implementation after approval, tests and source documentation.
- **FIX-01 / Sentinel:** substantial source defects, failing tests, root cause and regression protection; current backlog already contains email contract/test and migration follow-ups.
- **OPS-01 / Shipwright:** live RabbitMQ vhost/Redis ACL/runtime configuration, Docker/deployment, DB rollout and proof of persisted ingestion.
- **Owner/architect:** approve material architecture, schema, dependency, permission-policy, OAuth scope, and phase/scope decisions.

Current runtime blocker from durable records: placeholder RabbitMQ vhost plus Redis `WRONGPASS` was observed in the deployed worker; the current state must be rechecked. It is not resolved by this document and must remain with OPS-01. Do not disable Redis coordination as a workaround.

## 10. Implementation progress — 2026-10-13

DEV-01 has begun the next approved development slices on branch `feature/email-ops-e1-e3`:

- **E1 source changes:** Gmail history API now pages through every history response, requests add/label/delete event types, separates added/updated/deleted provider IDs, and retains the old history checkpoint on any failed page. Expired-history 404 still falls back to idempotent initial import. The worker now applies provider-reported deletions to account/org-scoped local message rows and recalculates affected thread counts before persisting the new cursor; matching derived email knowledge documents are removed as well.
- **E1 regression test:** added a focused adapter test for paginated history, label updates and deletions.
- **Capability safety:** Gmail's reply/forward capabilities are disabled until thread-aware behavior is implemented and tested; the catalogue requires those capabilities before offering reply/forward contracts.
- **E3 source changes:** added the shared `EmailToolDescriptor` contract and a canonical email tool metadata inventory with JSON Schemas, permissions, sensitivity, channel scope, provider-capability requirements and capability/agent-allowlist filtering. Exported the inventory through the shared package entry point.
- **E3 regression test:** added a capability-filtering test for the descriptor catalogue.
- **Boundary:** E3 is **catalogue/contract groundwork only**. The current host runtime still needs registered executable handlers and end-to-end execution-time authorization/policy/audit wiring before any descriptor can be exposed to the LLM. No new tool is claimed live.
- **Not run:** no pnpm tests, typecheck, build, provider calls, database checks, browser checks, CI or deployment verification have been run from this session.

## 11. Exact next action

**DEV-01:** complete the shared host registry/executable email handlers, beginning with read-only account/folder/message/search/sync-status operations. Before exposure, prove server-side account ownership and agent binding from PostgreSQL, schema validation, provider capability checks, execution-time permission checks, bounded/redacted outputs and audit. Then add the policy-gated draft and mutation handlers. Do not expose contract-only descriptors until each handler and its authorization path is implemented and tested. FIX-01 owns substantial source bug/regression remediation; OPS-01 retains live runtime and deployment proof.

**Verification status:** GitHub source inspection only. No files modified at plan creation, no tests/typechecks/build/runtime/provider calls executed, and no feature is claimed complete or verified.
