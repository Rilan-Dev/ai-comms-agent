# DEV-01 Role-Local Memory

This is durable memory for DEV-01. It supplements, but never overrides, shared APCP memory or repository authority.

## Read before work
- docs/project-control/AGENT_MEMORY.md
- docs/project-control/AGENT_EVENTS.md
- docs/project-control/AGENT_SESSIONS.md
- docs/project-control/AGENT_HANDOFF.md
- docs/project-control/AGENT_BACKLOG.md
- this file
- current project-control state and applicable architecture/plan

## Record
- recurring issues;
- role-specific mistakes and prevention;
- successful patterns;
- failed approaches;
- environment-specific observations;
- lessons that should be promoted to AGENT_MEMORY.md when cross-agent.

## Do not store
Secrets, tokens, passwords, private keys, or sensitive personal data.

<!-- Append durable DEV-01 lessons below. -->


### 2026-10-09 — Draft discoverability
- For bounded, organization-scoped persisted draft lists, client-side search across subject, body, recipients, and mailbox address improves discoverability without changing the API trust boundary.
- Render a separate no-match state; do not tell users there are no drafts when their current query simply matches none.
- Keep source/runtime verification claims separate: a successful GitHub source write is not a test, build, browser, provider, or deployment pass.
- Related: `apps/web/src/app/mail/drafts/drafts-client.tsx`, commit `8ccf1cb24039cb3bc745a51576a73ee68007e946`.

### 2026-10-09 — Lovable UI adaptation
- Treat `source/lovable-ui` as the authoritative visual reference for this task: warm off-white/ink/soft green palette, DM Sans body typography, Space Grotesk display typography, restrained 6px-ish radius, thin borders, compact icon-led navigation, and spacious editorial overview layout.
- The Lovable project uses Vite/TanStack Start; the current product remains Next.js. Copy design patterns/tokens and adapt components, never transplant framework bootstrapping or replace server/API behavior.
- Preserve real API-backed values, auth/session boundaries, organization scope, form validations, loading/empty/error states and approval/audit behavior. Preview-only controls from the design reference must not replace working application actions.
- Source edits made through GitHub API are not tests. Clearly record typecheck/build/browser/runtime checks as pending unless actually executed.

### 2026-10-12 — Email sync and AI-tool architecture
- Treat the repository's email capability matrix as an assertion to verify, not proof of working behavior. In the current source review, Gmail sync returns empty updated/deleted arrays and must be checked for history pagination and label/delete reconciliation; Gmail reply/forward convenience methods send immediately, so the host approval boundary must be enforced independently.
- Separate provider mapping/parsing from provider transport and orchestration. Prefer incremental extraction into feature-specific modules with contract tests over a risky all-at-once folder migration.
- A bounded chat-context query is not equivalent to a complete tool harness. Clara's tool interface is narrow; host-owned email tools must share schemas, permission/capability checks, execution-time grants, policy and audit across chat, realtime voice, WhatsApp and scheduled jobs.
- Runtime issue ownership remains distinct: OPS-01 handles RabbitMQ/Redis/config/deployment and persisted-ingestion proof; FIX-01 handles substantial source defects and regression tests. Do not claim verification from GitHub source writes.

### 2026-10-13 — Gmail history and email tool contracts
- Gmail history requires full pagination and separate handling for messageAdded, labelAdded, labelRemoved and messageDeleted. Keep the old cursor on any page failure; persist message updates/deletions and derived-index cleanup before writing the new cursor.
- When a provider operation has incorrect/incomplete thread semantics, set its capability false until the implementation and contract tests prove it. Reply/forward must not be made available solely because a method exists.
- The shared email catalogue currently describes schemas, permissions, sensitivity, channels and capabilities only. It is not a live registry and must not be advertised to the model until executable host handlers and runtime checks are connected.


### 2026-10-13 — Email operations implementation
- Gmail history must be fully paginated; classify message additions, label changes, and deletions, and do not advance the cursor until local reconciliation and derived email-document cleanup finish.
- If provider reply/forward semantics are incomplete, fail closed by disabling those capability flags until adapter tests prove support.
- The shared email tool catalogue is contract metadata only. Do not expose descriptors to a model until executable host handlers and execution-time authorization/policy/audit are wired.


### 2026-10-16 — Hybrid email RAG
- Current main source has an email chunker writing PostgreSQL `knowledge_documents` / `knowledge_chunks`; this is not the same as a functioning Qdrant vector index.
- The durable email vector-sync outbox and injected adapter processor exist in source, but no supported Clara email-vector adapter is bound and `apps/worker/src/index.ts` does not start the vector-sync loop. The existing PostgreSQL indexer loop is started.
- The local Clara runtime uses PostgreSQL chunk/metadata and message SQL search (tsvector/ILIKE); an embedding helper exists, but that alone does not establish Qdrant retrieval.
- Chat's current email context loader takes up to 20 organization-scoped messages and does not enforce active agent-to-account bindings. This is ISS-026, owned by FIX-01; do not duplicate or route around the fix.
- Recommended design to propose, not silently impose: PostgreSQL exact filters + FTS + authoritative re-fetch; Qdrant semantic candidates with mandatory org/allowed-account/date payload filters; rank fusion and final authorization; one shared retrieval service for Chat and realtime voice.
- A source review or GitHub write is not test/runtime evidence. No 10x claim without baseline benchmarks.


### 2026-10-16 — Clara adapter contract follow-up
- Follow-up inspection of Clara main confirmed no supported cross-repo email-vector API. `upsertDocumentsKb` and `deleteDocumentChunks` are internal KB/document functions; `/api/embed/search` is KB-scoped and does not expose email account filters or vector lifecycle operations.
- Do not invent/call an endpoint or import Clara internals. An explicit authenticated email-vector API must be implemented in Clara before the ai-comms-agent adapter can be bound.
- ISS-026 remains FIX-01-owned and open; no retrieval exposure or adapter startup until it closes. OPS-01 owns live infra acceptance.
