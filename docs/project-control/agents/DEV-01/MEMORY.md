

## 2026-10-16 — Clara realtime voice connection lesson
- A host voice-session row, resolved provider/model, and microphone permission do not prove realtime connectivity. The browser must instantiate the pinned Clara realtime client and await its actual ready/open event before showing connected/active transport status.
- Never treat an HTTP transcript bridge such as /api/voice/turn as a provider WebSocket/session URL. Resolver metadata and transport connection details are separate contracts.
- Reuse Clara's provider-specific session negotiation/relay, state machine, interruption, and reconnect implementation; do not create a parallel host-owned provider protocol. Keep provider keys server-side.
- Voice email turns must go through the same authorized agent/tool path as chat. ISS-026 remains FIX-01-owned; do not bypass account grants to make voice demos work.
- Substantial realtime connection defect routed to FIX-01 in issue #26; OPS-01 only owns deployment/infrastructure symptoms after a correct source implementation.
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



### 2026-10-16 — Clara email-vector API draft
- With explicit user authorization, a supported API draft was implemented in Clara-AI-Platform PR #298 on `feature/email-vector-api`. Contract: Clara `docs/plans/EMAIL-VECTOR-API-CONTRACT.md`.
- API supports deterministic org/account/message/chunk point IDs, upsert and stale cleanup, metadata-only update, message/account/org deletion, and semantic search with mandatory org + explicit allowed-account filters. Dedicated credential: `CLARA_EMAIL_VECTOR_API_KEY` (server-only, at least 32 random characters).
- The API's bearer secret authenticates the trusted worker; it does not prove mailbox grants. ai-comms-agent must authorize active agent/account bindings on every retrieval. ISS-026 remains FIX-01-owned/open; do not bind the outbox or expose Chat/voice retrieval before closure.
- Source edits and PR creation are not verification. Tests/typecheck/lint/build/Qdrant/isolation/performance remain pending; OPS-01 owns live acceptance.



### 2026-10-16 — Unbound Clara email-vector adapter
- The worker adapter now exists at `apps/worker/src/knowledge/clara-email-vector-adapter.ts`, with contract tests. It targets Clara PR #298 and uses `CLARA_EMAIL_VECTOR_API_URL` plus server-only `CLARA_EMAIL_VECTOR_API_KEY` (at least 32 characters). Production endpoint URL must use HTTPS.
- Adapter is deliberately not wired into worker startup and the outbox loop remains stopped. ISS-026 must be closed by FIX-01 before retrieval is exposed or the adapter is activated.
- Clara API accepts nullable source timestamps and hash fields for metadata-only updates without re-embedding when content/chunk hashes match. All executable checks and runtime acceptance remain pending; OPS-01 owns live infra/ingestion/performance.

### 2026-10-16 — Email vector metadata lifecycle review

- When adapting source metadata to a vector payload, distinguish field absent (do not modify) from field present but null/empty (clear stale payload). Otherwise removed sender/folder/labels can linger in Qdrant after metadata-only updates.
- Keep an opt-in integration test that uses a real Qdrant service for filter semantics; do not call it verified unless it was actually executed against a configured endpoint.
- Clara request size limits must measure encoded bytes, not JS string length.
- ISS-026 remains FIX-01-owned/open; adapter startup and retrieval exposure stay disabled until execution-time mailbox authorization is fixed.

### 2026-10-16 — Shared hybrid retrieval implementation lessons

- Keep shared retrieval in a workspace package that both web and worker can import; inject the semantic search dependency rather than coupling the core service to transport code.
- Resolve `agent_email_accounts` grants fresh for every retrieval, exclude `send_only`, intersect requested account filters with the grant set, and fail closed for an explicitly empty account filter.
- Qdrant returns candidates, not trusted message content. Re-fetch current message rows in SQL with the same organization/account/agent/date filters and return citations to authoritative message IDs.
- Include the indexed message content hash in semantic hits and discard semantic-only candidates when the current PostgreSQL document hash differs or the source document is missing. Keep lexical fallback visibly marked degraded when Clara search fails.
- ISS-026 remains FIX-01-owned/open; never wire this service to Chat/voice or activate vector sync until the authorization fix is closed and tested.

### 2026-10-18 — Model discovery and credential-scoped selection
- Read Clara-AI-Platform `ai-governance/core/live-catalog.ts` before building provider settings. Vendor catalog endpoints are capability-specific; OpenAI models need kind filtering, Gemini models need `supportedGenerationMethods` and pagination, and ElevenLabs has separate TTS and voice listing resources.
- A global provider key or unauthorized static fallback is never a substitute for organization-bound configured provider credentials. Check `organization.read` before decrypting/fetching; use fixed vendor HTTPS origins; do not expose secrets in any JSON response.
- A dropdown must never invent compatibility. The current Sarvam chat runtime calls v1, so V2-only live models must not be offered until runtime changes are authorized. Vendor TTS/STT model-list absence must be stated plainly; do not create static 'live' choices.
- Models used for TTS and STT require two separate saved values. Preserve legacy selections visibly as unavailable rather than silently resetting them.
- Do not mark GitHub source writes as Vitest/typecheck/build/browser/live-credential verification. Session: `DEV01-LIVE-MODEL-CATALOG-20261018`.

### 2026-10-18 — Offline verification reproducibility
- When a merged feature's source is accessible via GitHub connector but private clone/npm DNS is unavailable, reconstruct the small standalone module and check `git hash-object` against the actual GitHub blob before executing tests. This proves exact source identity, not entire repo readiness.
- Node 22.16+ `--experimental-strip-types --test` runs no-dependency provider-adapter mock tests. Record the tested code's SHA and results; keep Vitest/Next/React, live HTTP, credentials and browser as separate unverified gates.
- PR merge status can advance concurrently; a stale `NEXT_ACTION` calling it "draft/unmerged" must be superseded with fresh GitHub truth. Vercel `build-rate-limit` routes to OPS-01, not DEV-01 source.
- Session `DEV01-LIVE-MODEL-VERIFY-20261018`; 6/6 mocked adapter and 13/13 source checks PASS, module-only typecheck PASS.

### 2026-10-18 — Direct-main owner instruction and AI runtime field mapping
- User explicitly said to work directly on `main` and **not create branches** for continuing this task; PR #34/#35 already merged. Follow this in future continuation until the owner changes it.
- `GET /api/settings/ai-runtime` emits camelCase repository settings; the UI/PUT uses snake_case. Mapping only the realtime fields silently replaces persisted `knowledgeBaseId`, `defaultProvider`, `voiceId`, `systemPrompt`, etc. with client defaults on save. New mapper `apps/web/src/lib/ai/runtime-settings-state.ts` normalizes all eight. Test KB and prompt round trips, including temperature 0 and blank model, to prevent loss.
- Do not hard-code a realtime model ID as a new-org default in a vendor-live-only selector.
- Recorded exact-source tests: Node 6/6 live adapter mocks, Node 4/4 hydration, isolated tsc both pure modules passed. Full web/Vitest/Next/provider/browser/production remains unverified. Session: `docs/project-control/sessions/DEV01-MAIN-RUNTIME-MODEL-20261018.md`.

### 2026-10-18 — Provider editor safety and multi-purpose readiness
- Owner instruction remains: make continuing changes directly on `main`, never create feature branches/PRs without new direction.
- Credential entry in `AIProviderSetupShared` is stateful: selecting another provider must call a single clearing handler for BOTH card and dropdown, or an unsaved secret can be accidentally saved to another vendor.
- `fetch` resolves for 4xx/5xx. Saving/deleting credentials must inspect `response.ok` and GET reload status before claiming success. Removing credentials must invalidate any fetched model list (refresh key).
- Voice chat requires separate TTS and STT keys/config rows; a first-match badge falsely reports active if only one exists. Use `providerConfigStatus` helper to require both; use `incomplete` and `saved (disabled)` honestly.
- Actual limited tests: mocked adapter 6/6, hydration 4/4, provider helper 5/5, three isolated module TypeScript checks and 5 GitHub source assertions PASS. No full pnpm/UI/live provider/build acceptance. Session `DEV01-PROVIDER-SETUP-HARDENING-20261018`.

### 2026-10-18 — Organization switching safeguards in AI configuration
- User continues to require direct commits to `main`, **no new branches**.
- Both `AIProviderSetupShared` and legacy `AIProviderSettings` must clear unsaved API keys, invalidate old org config, abort previous GET, ignore old fulfillment, and gate all writes on `loadedOrganizationId === organizationId` after loading. A provider switch and an organization switch are independent credential-isolation events.
- `LiveModelSelect` catches errors on an aborted fetch but must ALSO check `signal.aborted` before `setModels` on successful JSON; otherwise old tenant model IDs can render after new tenant selection. Clear `loading` in no-org branch.
- Evidence recorded: 15 old Node tests, 3 isolated TS modules, 12 source-contract assertions PASS; *new* Node/Vitest, full web/worker/browser/provider/live verification not run. Session `docs/project-control/sessions/DEV01-ORG-CREDENTIAL-ISOLATION-20261018.md`. OPS-01 owns environment and deployment, FIX-01 voice/WhatsApp source bugs.

### 2026-10-18 — Clara email-vector service request hardening
- For privileged Clara vector search/upsert/delete, require an explicit authenticated org/account scope before network access, and use no-redirect fetch with clean HTTP(S) endpoint URLs (HTTPS-only production). Bearer credentials must stay server-only; do not forward into arbitrary redirect/authenticated URLs.
- Actual 5/5 exact-source Node behavioral tests and combined 20/20 portable tests passed; isolated TypeScript with type-only local declarations passed. Full pnpm/browser/Qdrant/deploy still UNVERIFIED.
- Clara PR #298 is merged to Vite-Converted branch, but RAG outbox/startup and live account grant enforcement remain blocked until ISS-026 endpoint verification and actual Clara deployment proof. Owner wants direct edits on main; never create branches absent new direction.
- Full session: `docs/project-control/sessions/DEV01-CLARA-VECTOR-BOUNDARY-20261018.md`.

### 2026-10-18 — Worker test discoverability and privileged vector adapter gates
- A `src/**/*.test.ts` file can be excluded from both tsconfig and the worker Node test glob; additionally Vitest was not a worker dependency. Always verify the actual package test command before writing regression tests. Worker is `node --import tsx --test tests/*.test.ts`, so prefer `apps/worker/tests/*.test.ts` with `node:test` and `node:assert/strict`.
- Tests with mocked `Response` must use a fresh body for each sequential HTTP call (e.g. `response.clone()`) since fetch response bodies are one-time consumable.
- Privileged Clara vector worker adapter should reject malformed org/account/provider-message IDs, source identity and content/metadata hashes **before** service credential-bearing network I/O. This is defense-in-depth, not a substitute for runtime org/agent/mailbox authorization. Do not enable outbox/Chat/Voice vector flows before live Clara API + ISS-026 verified.
- Actual tests 20/20 prior exact standalone sources plus 12/12 GitHub source assertions PASS; new worker test, pnpm suite, build, database, browser, provider endpoints **not tested** in this environment. Direct main only; no branches/PRs.

### 2026-10-18 — Live REST model catalog versus documented realtime WebSocket model
- `/v2/models` at Sarvam covers chat completions, **not** Saaras realtime STT. Do not claim an authenticated per-key live realtime catalogue exists; vendor WebSocket documentation explicitly accepts `saaras:v3-realtime` and `saaras:v4`.
- ElevenLabs current runtime uses `scribe_v2_realtime` for streaming transcription and TTS + host Clara turns. `elevenlabs-conversational` was an obsolete display marker and is NOT a Scribe model; native ElevenAgents requires a completely different `agent_id` and signed conversation URL contract.
- Offer genuinely documented streaming STT options in a separately labeled source, behind same org authentication/encrypted enabled key; never mark them `source:live`, never reuse for unrelated purposes. Refuse malformed legacy IDs on update; do not silently migrate users. Use selected Sarvam model in persisted authorized voice session and relay WebSocket.
- Exact source Git blobs executed locally: catalog `70bdd8ca7483fb8f1e4d866cffff350242969aae`, test `000a8062eead4646203ca46f8c18d7114c605189`. Catalog 9/9, total isolated 23/23 PASS, isolated tsc and 13 GitHub assertions PASS; no full pnpm/build/browser/live/deployment PASS. Direct main only. Session DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018.

### 2026-10-18 — Chat-first UI with voice and Mail preview
- Root Next App Router page can re-export the authenticated `/chat/page` server component so `/` becomes Chat without duplicating tenant/agent loading; move existing dashboard to `/overview`.
- Single-offset invariant: root layout already applies `md:ml-[248px]`; TopBar must not apply it again. Sidebar Mail nested links should start open independently of route, with collapse button and `aria-expanded`.
- Embed existing Clara `VoiceWorkspace` from Chat (lazy import, explicit start action) instead of rebuilding provider runtime. Never let a parent Chat toggle unmount a live voice session without teardown; real host state/DELETE outcome belongs to FIX-01 review.
- MailFlow security patterns: sender HTML CSS in opaque sandbox + restrictive CSP with remote loads blocked, not `dangerouslySetInnerHTML`; in-frame sizing/inline CID/remote proxies are later work. `html_body_sanitized` is not proof of sanitization; FIX-01 #36 confirms raw provider body can reach it. Do not claim secure ingest or expose unsanitized archived rows without review.
- Scoped session `DEV01-CHAT-FIRST-WORKSPACE-20261018`; 13/13 GitHub source checks PASS only. No full pnpm/new Vitest/browser/provider/deployment verified. Work on `main`, no branches, no phase transition.

### 2026-10-18 — Chat-first shell + voice-in-chat + secure mail reader
- Owner authorizes DEV-01 source UX redesign on direct `main` only; project phase 4 remains implementation. Continue independently of CI/Vercel.
- Correct nav geometry: sidebar is fixed 248px on desktop, `RootLayout` content wrapper owns `md:ml-[248px]`, `TopBar` must **not** repeat it. Chat is `/`, former Overview is `/overview`, `/chat` remains deep link. Mail expanded by default with separate accessible toggle and Inbox/Drafts/Threads/Accounts entries.
- Voice must be launched in Chat through existing Clara transport, not a new generic mic layer. Embed `VoiceWorkspace` lazily, pass selected agent, keep draft, disallow agent switch while voice is open. Leaving a live panel must stop actual mic/WebSocket/audio and request host session end; always distinguish local teardown from confirmed server completion.
- Email reader's `m.html_body` was missing because thread query used `SELECT m.*` and stored field is `html_body_sanitized`. Alias for UI under tenant-scoped query; use opaque sandboxed iframe with restrictive CSP rather than React unsafe HTML; plain text fallback. **Important:** Mailbox sync seems to store raw `message.html_body` in the sanitized column, so never assume column name proves a server allowlist. FIX-01 issue #36 owns sanitizer/backfill, OPS-01 migration/deploy.
- User owns `Rilan-Dev/mailflow`: inspect its `MessageBodyView.jsx`, `emailFrameDoc.js`, `emailFrameHeight.js`, and backend `emailSanitizer.js` for design lessons; no blind code copies. Duplicate unreferenced helper was removed after concurrently authored CSP preview landed.
- 14/14 current GitHub source contract checks PASS; newly authored Vitest/source work **not run** due environment. No full typecheck/build/browser/provider/deployed acceptance. Full session `DEV01-CHAT-FIRST-VOICE-MAIL-20261018`; plan `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`. Next independent source: real `/mail/threads` list and accessibility/focus polish.

### 2026-10-18 — Incremental text generation and authorized tools
- Real email threads must be queried in PostgreSQL using org+account+thread joins; do not fake thread grouping from the first 100 inbox messages. Use per-thread SQL window counts/search, hasMore sentinel row, bounded account UUID, authorization before API lookup, disabled cache. Abort late search requests on filter switch.
- Chat SSE chunks can split headers/JSON/UTF-8 anywhere; a fetch read is NOT a full SSE frame. Use shared `readSseEvents`, append model delta on receipt, show in-progress status, require explicit `done` and preserve partial answer if stream fails.
- The existing authorized email/WhatsApp host tool loop calls a non-streaming provider adapter, so it cannot truthfully claim token streaming. Start status early and emit final after tool approval; never make completed text appear "streamed" by fake timeouts. Native provider streaming **tool-call** handling is a separate scoped feature needing safe deferral/validation of calls and cross-account tests.
- Voice `/api/voice/turn` must authorize org/agent/user/session and increment turn BEFORE SSE. Non-tool conversation may use `claraRuntime.createChatTurn` real tokens; never use model-only path for actionable email intent. Keep JSON backward compatibility. Voice text can stream even if TTS audio still starts after complete answer; record that limit. Gemini :generateContent buffers; use :streamGenerateContent?alt=sse and keep OpenAI-compatible SSE EOF safety.
- Evidence exact files: SSE helper `a53568b7c1923b13ec3c2fe41d153da483ec28c8`, Node tests `31d793842f93bf0c1dbc21989f89b432a266eecd`, 5/5 runtime PASS, standalone tsc PASS, 23/23 GitHub source checks PASS. Full app tests/browser/provider not run.

### 2026-10-18 — Read-only tool result streaming must never reinterpret approved actions
- A host tool result is already final and bounded/authorized. To stream another provider rendition safely, the only permissible model output is an **exact prefix of the canonical host answer**. Guard provider chunks before UI; abort/denied/sensitive/pending action must not reach an unguarded presentation LLM. A provider's exact-copy prompt alone is **not** an authorization mechanism.
- Implemented `emitVerifiedToolAnswer` + `claraRuntime.streamCanonicalToolAnswer` optional second model generation after completed safe read-only tools in Chat/Voice. Eligibility must be derived from the actually registered tool's `sensitivity === safe`, `required_permission === email.read/whatsapp.read`, actual successful result and zero Voice pending approvals, not untrusted function-call names. Limit canonical to 6k, model output 3.5k tokens, fallback one unchanged remainder if drift/provider error. Extra model call adds latency/cost and is interim, not native function-call streaming.
- Verified exact Git source/test hashes `ab488dfa888066bf86399cae7227ba3c996d24df`/`33fae517247b47c5776796d4db83cfb5bb87965f`: eight real Node tests, isolated tsc, 16 static repo contracts PASS. Full pnpm/web/worker/migrations/browser/provider not run. Next safe native OpenAI/Gemini tool-call SSE adapters and complete integration; do not claim production acceptance.

### 2026-10-18 — Cancellation and approval-marker fail-closed requirement
- A streaming generator's `finally` reader.cancel on early return is not sufficient to interrupt a `fetch()` response still blocked on its next read. Carry client `AbortSignal` from Chat/Voice → `streamCanonicalToolAnswer` → `chatStream` → Gemini/OpenAI-compatible fetch. Keep cleanup/finalizer too.
- Server-registered `safe` + read permission alone does not prove the *result* is immediately streamable: even `result.ok` can have `status:pending_approval` or `approval_required:true` in output. Check both markers and require none before `readOnly` on Chat and Voice loops.
- Evidence pure-helper source/test hash matched GitHub, 8/8 actual Node tests and exact helper isolated TypeScript PASS, 12/12 fresh GitHub source contract checks PASS; new full Vitest/worker approval test, builds/browser/provider remained unverified. Maintain no-branch main work and FIX-01/OPS-01 ownership.

### 2026-10-18 — Native streaming function-call safety and testing
- OpenAI Chat Completions SSE function tool calls can split id/name/arguments at arbitrary bytes; wait for `finish_reason=tool_calls` **and** `[DONE]`, parse complete JSON object, enforce size/count/index/ID validation before passing *data only* to unchanged agent-aware host tool executor. Gemini `streamGenerateContent?alt=sse` returns JSON functionCall parts; wait for EOF + `STOP`, reject changed repeated same-name snapshots, and never execute truncated output.
- Host tool authorization/audit is independent from decoder success. Preserve agent/mailbox binding, actor permissions, approval, schema and bounded loop; do not trust provider names or treat a streamed tool fragment as execution authority. Legacy gateway JSON fallback remains source-supported.
- Exact parser sources and tests were copied into isolated Node v22.16 environment and hash-matched to GitHub: OpenAI 10/10, Gemini 9/9, combined 19/19 PASS. Strict isolated TS PASS; full monorepo tests and provider/browser acceptance NOT done.
- Provider-native **tool decision** streaming differs from final answer streaming: current read-only approved result display can use an extra exact-copy model pass, which should be replaced by direct final-turn provider streaming after proper integration tests. Avoid fake progressive output. Session DEV01-NATIVE-TOOL-SSE-20261018.

### 2026-10-18 — Source-safe direct final post-tool response streaming
- The prior canonical text-copy LLM request cost extra tokens/latency and often fell back to one completed delta. New direct native provider final text stream uses already-completed read-only host tool result history, **not** prior full answer copied again. Only one successful first batch of <=4 registered safe email.read/WhatsApp.read calls can use callback. No tools in final chatStream request. Other tool loops remain unchanged.
- Query/account/agent scope is host-verified, and untrusted message data must never become a system instruction. Reject orphaned, duplicate-after-consumption and oversized tool-call histories; first executed Node test found the consumed duplicate loophole and was corrected. After tool execution, NEVER catch a generic `unsupported` and switch to unguarded model mode; pre-tool unsupported is the only fallback.
- Exact files and evidence `DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018.md`: SHA-matched Node 7/7 PASS, isolated strict TypeScript PASS; no full pnpm web/worker/browser/live provider/deploy acceptance. FIX-01 #26/#36 and OPS-01 workflows unchanged.

### 2026-10-18 — Personal catch-up and routine delegation
- Presence, personal review, routine generation and external delivery are independent facts. Personal acknowledgements must never suppress scheduled summaries; delivery must never mark mail reviewed/read. Each routine has its own source-revision coverage, including late arrivals and missed windows.
- Every derived-content read revalidates all contributing sources; asynchronous invalidation alone cannot prevent revoked cached text leaking. Multi-source aggregations need all-source checks.
- One user-approved digest routine is a narrow scoped grant, not general WhatsApp authority. Confirm exact recipient/sender/mailboxes/cadence/limits/template content; recheck policy and source access before submission. Provider-accepted/unknown is not delivered; submission already started cannot be recalled by pause.
- Daily local time differs from elapsed 24 hours. Quiet-hour eligibility differs from processing misfire; freeze windows and use durable occurrence/lease/revision identity.
- Existing source-contract tests can pass despite null recurring first-fire and tenant-event gaps. Require real DB/crash/negative tests; route bugs to FIX-01 and runtime/CI/deploy to OPS-01.
- Canonical proposal/spec/plans and exact next action: session DEV01-CATCHUP-ROUTINES-20261018. Planning does not activate new mailbox grants or standing consent. Current baseline build/typechecks and 41 focused tests passed; no live acceptance.

#### 2026-10-18 — Preserve concurrent source and bind evidence to its revision
- During catch-up planning main advanced from ba9e948b to 959ff5a6 with native tool/final streaming. Preserve both agents' source/records; do not carry an earlier green result onto changed source. Latest focused checks: 91 passed/1 failed, typecheck/build pass.
- A completed-tool ID removed from the outstanding set can be reused later; final-prompt validation needs history-wide uniqueness and declared/result-name binding. Unit acceptance is not proof of a live authorization bypass. FIX-01 owns HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018.
