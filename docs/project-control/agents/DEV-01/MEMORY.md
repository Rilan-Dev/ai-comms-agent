

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

## 2026-10-19 — C1 private catch-up

Implemented C1; session `sessions/DEV01-CATCHUP-C1-20261018.md` records evidence and limits. Next: C2 stable manifests/coverage. Read authorization must revalidate evidence IDs/revisions as well as top-level sources; forward only allowed output fields. Prove audit atomicity with forced failure, not only successful audit rows. Multiple permissive RLS policies combine with OR: private content needs restrictive isolation plus trusted application predicates. Strict real PostgreSQL migration execution and structural checker results are separate evidence. Never equate focused green checks with full-suite acceptance.

### 2026-10-19 — ElevenLabs provider purpose isolation
- `ai_provider_configs` is keyed by organization, provider **and purpose**. A saved `elevenlabs:realtime` API key does NOT imply enabled `elevenlabs:tts` or `elevenlabs:stt` keys; 409 `provider_configuration_required` originates in the app BEFORE provider network calls. No secret can be inferred from absence of vendor traffic.
- Credential reuse must be explicitly administrator-initiated (`organization.update`), same org/provider, only from enabled decryptable source, and never overwrite existing keys/models or bypass disabled purposes. Keep ciphertext in database for copying; no browser secret. Show each capability status and actionable catalog errors. Stored key row mapping requires `Boolean(encrypted_api_key)` when decrypted lookup does not select `has_api_key`.
- The owner pasted a session cookie in curl; advise session invalidation and NEVER repeat or test with it; exclude from docs/issues/tests and logs. Vercel build-rate-limit is OPS-01, not a compiler verdict. 29/29 static GitHub assertions pass; actual dependency/Vitest/web/worker/Clara/db/browser/provider tests NOT run in this environment. Session `DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019`.

### 2026-10-19 — Explicit date mail scope and honest data completeness
- For user-selected calendar ranges require explicit two valid ISO dates and UTC interpretation; don't infer them from model history. Refuse malformed/reversed/out-of-cap date ranges, ambiguous sender and unsupported filters rather than treating them as all mail. Keep max 366 days and 1000 chars input.
- Apply existing actor email.read, registered per-agent search/list tool and per-account primary/read_only entitlements; unchanged sent/draft exclusion; derive counted 500 cap from DB. Use `received_at >= start UTC` and `received_at < day_after_end UTC` to include all last-day PostgreSQL microseconds; keep old rolling 24h semantics separate. Report local sync caveat; never promise live provider completeness or semantic analysis.
- When adding a shared argument to incident-corrected code, preserve/execute original regression; initial literal `\\n` inside // comment was caught on code review and corrected before passing exact source tests.
- Source-matched local Node tests 16/16 PASS, isolated tsc for two modules PASS, GitHub source contracts 19/19; full pnpm/db/browser/live provider unverified. Repo session `DEV01-EXPLICIT-DATE-MAIL-20261019`. User exposed host/server and app session secrets previously: never use, owner must rotate/revoke. Roles FIX-01 runtime/security, OPS-01 infrastructure/CI/provider sync.

### 2026-10-19 — ElevenLabs TTS/STT live versus documented models
- ElevenLabs Voice Chat uses **separate** saved encrypted purpose-specific keys for `tts` and `stt`; `realtime` is a third independently configured capability. `provider_configuration_required` occurs before vendor fetch if that purpose's enabled decryptable key is absent; it does not prove API invalidity. UI already has an authorized confirmation-only same-organization Realtime→missing enabled TTS/STT reuse action; do not add silent fallback or plaintext key copies.
- Official ElevenLabs `GET /v1/models` lists TTS capabilities; **batch** Scribe `scribe_v2` is documented separately, not guaranteed to appear as an account-specific live STT model list. **Realtime** WebSocket STT is `scribe_v2_realtime`. Treat STT as `source:documented, capability:batch_stt` only after same saved enabled org STT key gate. Separate live TTS model list remains live; never fabricate a vendor HTTP result.
- 2026-10-19 main commits from starting `b207f06a` introduced catalog API, selector labels, source tests and UI. Source contract checks 15/15 passed, full dynamic/build/browser/provider not executed. Detailed session `DEV01-ELEVENLABS-STT-CATALOG-20261019`. Primary NEXT_ACTION from C1 remains **C2** immutable manifests/selection; this is a bounded prior-report defect repair, no phase transition.
- The owner's pasted curl included an apparently active access cookie; recommend invalidating that login; never embed/replay stored cookies in logs/test code.

### 2026-10-19 — ElevenLabs capability key checks and partial-save prevention
- Provider config row uniqueness is `(organization_id, provider, purpose)`. Realtime key is separate from TTS and STT. Catalog errors `provider_configuration_required` mean purpose-specific enabled/decryptable credential missing *before* vendor model lookup, not proof of an ElevenLabs model outage.
- Existing opt-in Realtime→Voice key reuse is authorized `organization.update`, same org, encrypted DB copy, preserves disabled rows and existing models/keys; it must not be automatic or inferred from badge.
- Voice Chat Save is two separate HTTP PUTs. Run a pure both-purpose credential preflight when no new key is entered, before any request, or an existing TTS save can persist before missing STT fails. Provider PUT should reject `keepExistingKey:true` unless the same org+provider+purpose row already has a credential. Trim whitespace-only passwords; after voice save/remove reload TTS/STT **plus read-only Realtime metadata** so reuse status remains visible. Network errors between PUTs still require future atomic backend work.
- Evidence: 8/8 actually executed isolated Node cases, TS helper noEmit PASS, 10/10 fresh source checks PASS; full provider and build not checked. User shared live cookie earlier: never propagate it, recommend revocation. Session DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019.

### 2026-10-19 — ElevenLabs missing purpose model catalogue = configuration, not API failure
- TTS/STT model discovery must use a saved enabled *purpose-specific* encrypted key, even when the same ElevenLabs API key is also configured in Realtime Voice. Do not bypass the organization/purpose boundary or silently inherit Realtime credentials from a GET.
- Current main already supports a strictly explicit user-confirmed same-org Realtime→TTS/STT credential copy, server `organization.update`, decryptability check, audit, and no overwrite for disabled/existing keys. Recovery UI should surface this option **at each failed TTS/STT picker** only when the server returns `canReuseRealtimeKey`; no source means configure TTS/STT keys, encrypted key decrypt failure means admin, vendor HTTP failure is distinct 502.
- User supplied an active-looking session cookie; never use, echo, preserve in GitHub docs or live tests. Recommend revocation and fresh sign-in. Exact helper SHA `3108547c5ebe73975fee37198e71a69afc1b21c5`, 8/8 executed isolated Node tests, isolated TS PASS, 15/15 GitHub source assertions PASS. Full app tests/deployed account not verified.
- Session `DEV01-ELEVENLABS-TTS-STT-CATALOG-RECOVERY-20261019`, main-only, no PR/branches; OPS-01 deploy, FIX-01 unrelated runtime issues.

### 2026-10-19 — Forward-only operator migration safety / ElevenLabs 409
- The repository already has `ai_provider_configs` and independent `realtime`, `tts`, `stt` purposes (0007 + 0044 SQL). A 409 `provider_configuration_required` means a purpose-specific enabled/decryptable API key is absent, not necessarily a schema issue. Never silently transfer encrypted keys by migration; approved same-org key reuse belongs to explicit authenticated UI workflow.
- The existing Node migration runner ledger uses SHA256 per **full filename** under `aca._aca_schema_migrations`; mixed prefix migrations exist. Use plan/preflight/verify with exact checkout manifest; deny unexpected applied versions and changed SQL. The manual startup script may continue after migration errors, so only treat fail-closed operator output and DB verification as migration acceptance.
- New `scripts/operator-migrate.sh` requires target database name, independent backup attestation, and `--allow-fresh` only for new DB. It uses one-off Compose web container so internal PostgreSQL DNS resolves, read-only `supabase` mount and fixed .env. Owner/operator/OPS-01 performs actual backups/deploy/migration.
- 17 GitHub static assertions PASS; new tests not executed, no live DB/migration or deployment acceptance. Session `OPERATOR-MIGRATION-SCRIPT-20261019`.

## 2026-10-19 — DEV01-CATCHUP-C2-20261019

C2 complete locally, final merge/push receipt in session.34SQL,25domain,37web,3integrity checks pass; typechecks/build pass. Preserve source/review scoping and UUID cursor UI compatibility. Claim canonical sources, reauthorize scheduled mutations, retain precise server boundaries and compare manifest provenance counts. Prior C1 support sessions finished; independent C2 reviewer complete, FIX-01 compatibility/security support complete, OPS-01 restore/read-only incident assessment complete. No hidden active implementer task remains. Next C3 orchestration/grounding and C4 browser acceptance; security incident and broader suites retain role owners.

### 2026-10-19 — Operator preflight test logs and dangerous regex escaping
- A JavaScript regex character class `/[\\u0000-\\u001f\\u007f]/` does NOT mean NUL-to-US+DEL: the doubled backslashes make it match ordinary letters and digits, breaking valid organization/account/message IDs. Use `/[\u0000-\u001f\u007f]/`, and execute both positive normal-ID and negative control-char tests. Catch the bug before claiming source-contract checks substitute for runtime.
- Clara knowledge retrieval runtime `to_tsquery('simple', $3)` for `textQuery` and `LIMIT $4`; a worker source test had mistakenly expected `$4` for search. Keep the source assertion matched to actual bound SQL roles, not a stale placeholder.
- `pnpm -r test` concurrent child failures may SIGKILL sibling tests: status lines marked failing without assertion details are not conclusive. Isolate failing suites on same source image. An offline web test attempting `eth-mainnet.public.blastapi.io` is an unexplained external dependency requiring OPS/source audit; NEVER remove network isolation or use production credentials just to pass.
- Current host log passed 29 operator and 26 Clara Core tests and all TypeScript packages, but stopped prior to DB confirmation and migration. OPS-01 issue #38; source fixes on direct main, 6/6 source + actual regex check PASS, whole suite and deployment not verified. Session `DEV01-OPERATOR-TEST-TRIAGE-20261019`.

### 2026-10-19 — Fresh migration target must be truly empty
- Operator migration wrappers already exist on main: `scripts/operator-migrate.sh` for manual plan/apply/verify and `scripts/operator-one-shot.sh` for owner-triggered preflight/release. Do not create duplicate scripts or invent new SQL without an actual schema requirement.
- **Critical safety lesson:** the migration runner executes separate SQL statements and records the ledger after a file; interrupted/failed execution can leave unledgered user tables. `--allow-fresh` must fail closed unless a live `pg_catalog` inspection confirms zero non-extension user relations, even when the `aca` ledger is absent/empty.
- User (not DEV-01) deploys and migrates; OPS-01 owns migration host, test execution, tested backup/restoration, version-specific Compose/env, Vercel/Docker and CI. Earlier host verified several gates but full offline web Vitest and worker SIGKILL remain blocked under issue #38. Never infer production acceptance from source checks alone.
- Latest session `docs/project-control/sessions/DEV01-MIGRATION-FRESH-TARGET-SAFETY-20261019.md`: 18/18 current GitHub static source checks passed; new Node tests/full Docker/connected Postgres not executed. No SQL schema changes, branch or PR.


## 2026-10-19 — owner-requested commit and recovery checkpoint

Preserved concurrent main changes and both sides of eight documentation conflicts. Current status: C1/C2 focused implementation done; C3 integration then C4 browser acceptance next. Security and broad-suite follow-up remain FIX-01/OPS-01. See docs/project-control/sessions/DEV01-CURRENT-HANDOFF-20261019.md. Lesson: after a rejected push, inspect and integrate current upstream; never overwrite shared project memory or force push.


## 2026-10-20 — DEV-01 C3 worker integration lesson
GitHub main start `16d3fb6f`; added isolated unregistered C3 worker core at `7da1d2b5`. Bounded generation and canonical claim/heartbeat/completion existed but no worker glue. Never register before grant-checked canonical source loader + Clara provider adaptation and actual worker/typecheck tests. Lease heartbeats are advisory; fenced transactional completion must remain authoritative. No production feature activation. See `../../sessions/DEV01-C3-WORKER-CORE-20261020.md`.


## 2026-10-20 — C3 source/Clara milestone
Latest main source `464ab70d`. Source manifest grant/revision/lease revalidation implemented; Clara no-ambient-retrieval path; model partial/invented candidate prevention and provider 429/timeout retry via leased recovery. 11/11 source checks; new Node/TypeScript tests not run. Avoid `createChatTurn` RAG for private mail. Source and failure analysis: `../../sessions/DEV01-C3-CANONICAL-CLARA-20261020.md`. No feature activation.


## 2026-10-20 — C3 multi-mailbox source-loading lesson
A durable C2 manifest can span mailboxes A+B while a 50-source batch includes only A. The C1 scopeVersion hashes the complete mailbox set, so resolving the batch's subset and comparing to manifest scope rejects valid work. Corrected in `f036d6bf`: resolve the entire manifest grants then intersect claimed mailbox subset. User reported 27/27 C3 tests on earlier code, but the additional two post-fix tests and TypeScript are **not yet run**. See `../../sessions/DEV01-C3-MULTI-MAILBOX-BATCH-SCOPE-20261020.md`.


## 2026-10-20 — C3 actual host verification and PostgreSQL boundary
The user actually ran all 29 focused C3 Node tests and four package TypeScript checks successfully at main `daa89ffd`. This is stronger than earlier source-only assertions, but does not prove SQL security. Added a separate C3 DB integration file at `4cda8ee5` using the existing fail-closed disposable localhost/tmpfs fixture, not the production DATABASE_URL. Never register the catch-up worker until the DB test demonstrates real post-claim grant and revision authorization. Session `../../sessions/DEV01-C3-HOST-VERIFIED-DB-GATE-20261020.md`.

## 2026-10-20 — R1a clock/consent and catch-up product lesson
- Human-first inbox needs truthful **last-review/source coverage**, not a login timestamp or sample unread count. Continuous authorized provider sync must continue while a person is away; no duplicate raw-email store.
- Daily 09:00 in a saved IANA zone is wall-clock/calendar time. Every 24 hours is UTC elapsed time. For nonexistent local hours skip and record; for repeated local hours choose the first UTC instant only. Preview must show next three instants and UTC offsets.
- A pure preview (`nextRoutineOccurrences`) carries NO side-effect authority. Confirmed revision-bound host grants and real source/recipient/provider permissions are prerequisites for scheduled or WhatsApp delivery. Do not let a model's intent text activate a routine.
- R1a code/tests at `2b2342f3`, `7b4a0d96`, `9eb4edc0` + three exports. Ten GitHub source invariants inspected; Node/TS tests **NOT RUN** on new code. Design extension `docs/superpowers/plans/2026-10-20-ai-email-command-center-ux-rollout.md` and session `../../sessions/DEV01-EMAIL-COMMAND-CENTER-R1A-20261020.md`.
- Do not use historical migration IDs 0051/0052 from 2026-10-18 plans without checking latest main. No feature activation before runtime/security evidence.


## 2026-10-20 — R1b human-first plan and safe proposal boundary
- Owner intent: ordinary people and employees should return after five days to sourced important mail, not browse every message; business owners need a short optional consented WhatsApp digest without always opening the app. Distinguish per-user foreground activity from review coverage and scheduled generation.
- Recovery: GitHub main `36384bb0` at read; current R1a preview committed but new TS/Node checks absent. Current migration tip already `0052_briefing_selection_coverage.sql`, conflicting with older routine plan placeholder `0051`/`0052`. Always re-audit GitHub migration directory before any new DDL.
- Product/safety: A model's proposal is not an authorized routine; require immutable canonical config hash, effective user/agent/mailbox grants, expiring revision-bound confirmation and per-action policy. Confirmed-but-disabled is not running. WhatsApp delivery is a separately reviewed external-data-export grant, not implied by user asking for a summary. Explicit empty/partial/late-sync states and non-surveillance activity status preserve trust.
- Process: Used installed Superpowers skill directions to prepare a focused proposed R1b TDD plan and separate review gate rather than invent a second scheduler or write untested production code. No dependency-equipped checkout here: GitHub DNS unavailable, pnpm absent, so no `routine-time.test.ts` or TypeScript execution was claimed.
- Evidence and continuity: plan `docs/superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md` commit `7a6bc740`; session `docs/project-control/sessions/DEV01-EMAIL-COMMAND-CENTER-R1B-PLAN-20261020.md` commit `44b13bf3`; active NEXT_ACTION updated. FIX-01/OPS-01 ownership unchanged.
- Next: run existing seven R1a tests, two package typechecks on current sanitized main; review R1b interfaces before Task 1 RED→GREEN; pursue independent C3/C4 acceptance, no delivery activation.


## 2026-10-21 — Inert routine proposal Task 1 (R1b)
- Execute approved proposal features in small TDD slices, not a single unreviewed scheduler/WhatsApp implementation. Current main received pure `normalizeRoutineDraft`, `routineConfigHash` and `previewRoutineDraft` in email-agent-runtime, public shared contracts and eight regression cases. No DB/tool/API/worker activation. Session: `../../sessions/DEV01-R1B-INERT-PROPOSALS-20261021.md`.
- Unknown top-level or nested fields including `organizationId` and `executeNow` must fail closed before a proposal can be displayed. UUID syntax checks are not mailbox grants. Calendar-local daily 09:00, UTC elapsed intervals and events require distinct previews. Stable material config hashes bind future consent to exactly what the user approved, not to a model-generated sentence.
- External WhatsApp is only preview metadata until active authorization checks prove sender/recipient/account/template, export policy and source grants. A structurally valid proposed destination cannot grant real sending authority.
- Environment: private GitHub connector read/write works, shell cannot DNS-resolve `github.com` for a checkout and pnpm is missing. Isolated Node v22 RED 0/8 to GREEN 8/8 and tsc against shims are useful early unit signals, **not** real workspace/DST/typecheck evidence. Always request exact current SHA and actual host commands for acceptance.
- Next: `cd apps/worker && node --import tsx --test tests/routine-time.test.ts tests/routine-proposal.test.ts` and shared/email-agent-runtime/worker typechecks in a clean sanctioned checkout; independently finish authorized C3 negative tests and later C4 browser UX. Do not enable worker, R1b persistence or routine WhatsApp delivery by inference.


### DEV01-EMAIL-UX-PRESETS-20261022 — Cross-surface email approval and permission safety
- A provider's native function-calling adapter, persisted agent allowlist, authenticated actor RBAC and connected agent-bound mailbox are independent prerequisites. A model's text-only answer is not a draft, an approval request or proof of provider delivery. Correct runtime deployment still belongs OPS-01.
- Deliver a reviewable, host-invoked compose path independently of model prose. The safe progression is `draft_created` (persisted but unsent) → `pending_approval` (also unsent) → explicit human approval → worker/provider outcome; do not autoapprove or call provider from voice/chat UI. Reuse existing audited tool executor, bound primary account and actor permissions.
- UI presets select only registered concrete tool names, leave individual toggles available, preserve custom/advanced saved grants and apply only after an administrator confirms. Never infer user `email.write` from an agent policy checkbox. On chat use admin-only policy GET, full restrictions preserved on confirmed PATCH, not an unchecked overwrite.
- Realtime voice must delegate email tool actions to the same authenticated voice-turn host as normal voice/chat; model/tool declarations should be filtered by actor RBAC before invocation and executor must recheck rights. Active voice session must be ended before editing drafts in chat.
- The isolated Node helper harness and 20/20 GitHub source checks are not a substitute for workspace typechecks, DB/host, provider, authenticated browser or production tests.

### DEV01-AGENT-PERMISSION-PRESETS-20261022 — Permission presets do not confer authority by themselves
- Four simple choices (read/draft/request approval/no mail) are safe *editable previews*, not permissions granted by chat prose. Preserve opt-in individual tool toggles and separate mail/account/user RBAC, provider capabilities and sending approvals. Explicit No Mail must also revoke unknown legacy `email.*` grants without clearing non-email permissions.
- **Concurrent admin saves matter:** A chat policy preview can become stale while another administrator edits a full policy. Protect all five persisted fields atomically with a scoped PostgreSQL compare-and-set, use actual selected permission names in confirmation and show 409/reload rather than silent overwrites. Keep chat reload confirmation for unsaved selection. No schema change needed.
- `Development` session `sessions/DEV01-AGENT-PERMISSION-PRESETS-20261022.md`; source/test commits recorded there. 22/22 source checks; native runner/browser/DB still unverified. OPS deployment separate; FIX independent defects; C3/R1b activation separate and still gated.

### DEV01-OVERVIEW-FIRST-EMAIL-COMMAND-CENTER-20261023 — Presence, coverage and delivery must not be conflated
- User intent is a personal five-day return and action list, not monitoring employee attendance. Foreground visits, source review acknowledgments and delivered digests have separate owners and should not advance one another. No admin-wide mailbox access from organizational membership.
- Overview's existing `unread_mail` and `action_required` data are organization-wide metrics; never advertise them as scoped personal missed/important counts. Use C2 claim/grant/source coverage for that future card, and show partial sync/source gaps.
- If `BRIEFINGS_ENABLED` is off, do not link to a 404 preview; if Overview's API is loading or fails, do not label the feature disabled. A flag permitting a preview is **not** worker-running or delivered-WhatsApp proof.
- Explicit owner navigation preference can supersede Chat-first home while preserving `/chat` and Clara host tools. Update old shell and Lovable tests to reference their canonical routes, not obsolete root assumptions.
- 10/10 GitHub static source assertions do not prove actual Vitest, TypeScript, browser, policy, data freshness or production deployment. See session `docs/project-control/sessions/DEV01-OVERVIEW-FIRST-EMAIL-COMMAND-CENTER-20261023.md`; other roles retain FIX-01/OPS-01 boundaries.

### DEV01-MULTI-CHAT-SESSIONS-20261023 — exact conversation identity is the memory boundary
- New chat must INSERT a distinct conversation, not clear existing saved messages; resuming an earlier chat means loading its exact ID into both UI and AI model context, with the last N messages retrieved newest-first then displayed chronological. Voice return and agent switches must preserve selected ID and reject races. Existing model is organization+agent shared, **not** private by user; do not claim personal privacy without an explicitly reviewed owner/legacy schema change. Seven Vitest tests authored, native runner not executed. Plan `docs/plans/CHAT_CONVERSATION_SESSIONS_20261023.md`.

### DEV01-CHAT-PERSISTENT-CONTROLS-SIDEBAR-20261023 — Chat layout lesson
- `min-height` with a flex child `overflow-y-auto` does **not** create a bounded scroll viewport. Size the Chat route below the existing 64px app bar; make each ancestor `min-h-0` and constrain overflow; keep controls and composer outside the message log. Use an independent vertical sidebar for agent-scoped conversations, not a top horizontal strip or global app nav.
- Mobile history should open only on request, allow Escape and focus cycling, then restore focus to Chats; preserve unsent-draft confirmation, selected agent/conversation ID and voice return. Optional compose/permissions panes need their own height cap or can hide the composer.
- Session `sessions/DEV01-CHAT-PERSISTENT-CONTROLS-SIDEBAR-20261023.md`; 19/19 post-change GitHub source invariants, actual Vitest/web typecheck/browser acceptance still pending. Feature respects existing organization/agent chat visibility and does not change stored history/privacy boundaries.

### DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023 — selected time span is not detected absence
- An operator can safely offer `/catch-up?days=5` with bounded 1/5/7/30 UTC presets and actual manifest source period while `last_foreground_visit`, last review and last external delivery are not yet accepted product signals. Never equate an arbitrary five-day lookback with time absent or “fully caught up.”
- Every Overview catch-up link depends on server-authorized `catchUpAvailable`; the C4 route must still independently check `BRIEFINGS_ENABLED`, signed-in per-user account grants, source revisions and explicit mark-reviewed. Default direct catch-up remains seven days.
- Use checked-in Superpowers specs/plans and test-first slice while gated C3 worker/WhatsApp standing-consent/persistence are unapproved. Source inspection and isolated Node helpers are not native web or browser acceptance.
- Session and code: `sessions/DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023.md`; source commits `b45ed5e7,7785e189,ed11d533,3622c0e4,a727a086`; plan `a63b2745`.

### DEV01-ADMIN-EMAIL-WRITE-DEFAULT-20261023 — typed permission and default role access are separate gates
- A typed `email.write` entry in `PERMISSION_CATALOGUE` alone does NOT authorize drafts. Both PostgreSQL and in-memory `getPermissionsForRole` use `SYSTEM_ROLE_PERMISSIONS`; owner/admin were missing `email.write` even while every agent email tool was selected.
- User explicitly wants a single-workspace administrator experience, but existing organization memberships remain internal security boundaries. Grant the required permission to **active owner/admin role defaults**, not by spoofing membership or bypassing `authorize`. Member/viewer and suspended/cross-organization identities remain blocked.
- Permission is NOT a send operation: agent allowlist, connected primary mailbox, provider discovered capabilities, registered audited tool and human approval remain independent gates. No automatic send, migration or account mutation.
- Commits `61eb507d,a5123f59,7f8b4457,145d2629`; 16/16 fresh source invariants, native tests and live browser/deploy pending. Session: `sessions/DEV01-ADMIN-EMAIL-WRITE-DEFAULT-20261023.md`.

### DEV01-ROUTINE-TIMING-PREVIEW-20261023 — let users understand clocks before consenting
- **Lesson:** Product-friendly AI routines should demonstrate exact `daily 09:00 in zone` versus `every 1440 elapsed minutes` and optional event triggers before presenting any “Create” affordance. Reuse `nextRoutineOccurrences` rather than implementing UI-side DST arithmetic or another scheduler. A server-rendered private GET-only preview is inert; it conveys no standing WhatsApp consent, email permission, mailbox access or provider delivery guarantee.
- **Privacy:** Five-day selected lookback does not prove five-day user absence. Keep independent personal visit/review/delivery signals and per-user source grants; do not monitor employees.
- **Quality:** Test source-level contracts before code, align assertions with actual typed-discriminant structure, and record whether real tests were executed rather than treating a 25/25 source check as runtime acceptance. Plan P0–P7 via `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md`.
- **Boundary:** DEV-01 implements safe UX, FIX-01 independently corrects bugs, OPS-01 release/provider. C3 registration, R1b stateful consent, R3/R4 WhatsApp remain gated. Session `sessions/DEV01-ROUTINE-TIMING-PREVIEW-20261023.md`.


### DEV01-CATCHUP-COVERAGE-CLARITY-20261023 — separate selected from displayed from understood
- Treat immutable `manifest.sourceCount`, paginated source link count, generated item count, reviewed-item count and per-user presence/review history as **five independent facts**. Do not infer any one from another. A 5-day selected period is not proof of 5-day absence.
- Source pagination can honestly say "200 of 320 source email links loaded" when a cursor remains; no cursor with missing links is still not complete. Duplicate IDs must not inflate progress.
- Before any automated High/Medium/Low claim, C3 grounded AI content must exist and pass source/grant validation. Never show an inert preview as a scheduled or sent WhatsApp digest.
- Reuse canonical C4 immutable manifest, C1/C2 grants, C3 gated generation and existing R1a clock. DEV-01 source/UI owns representation; FIX-01 owns independently found defects; OPS-01 owns acceptance and deployment. Session: `DEV01-CATCHUP-COVERAGE-CLARITY-20261023`. GitHub source checks 14/14; local isolated helper 5/5; full repo test/DB/browser pending.

### DEV01-CHAT-COMPOSE-IDENTITY-20261023 — email composition requires real identity and explicit address choices
- **Lesson:** An email mailbox's readiness/capability ranking is not permission to assume the user intended that From account. With multiple connected primary bindings leave sender empty and require an explicit choice. The AI cannot infer a recipient address from a name; require a valid, exact To before persisting drafts or requesting approval, and keep host permission/capability checks on every action.
- **Trusted profile:** `AuthSubject.user.name/email` are the only saved personal attributes currently established for this flow. A Regards signature may include the saved name; other details are UNKNOWN and must not be invented. Sanitize/bound displayed model metadata and treat it as data, not authorization. Distinguish user email.write, agent draft/write tool allowlist and provider send capability; sending still needs separate human approval. Tests and actual account acceptance remain distinct.
- **Implementation evidence:** `sessions/DEV01-CHAT-COMPOSE-IDENTITY-20261023.md`, source invariants 22/22 and new source contracts 54/54; native/test/production unverified. No implicit role grant or external send.

### DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023 — task-first provider setup
- For ordinary users, provider selection should start from *what task the AI performs* (chat, voice pipeline, realtime, knowledge), not a default vendor dropdown replicated under status cards. Keep one explicit provider card selection per capability; never preselect a provider or migrate unsaved API secrets across vendor/org switches.
- A saved key is not a saved compatible model; Voice Chat requires **both** TTS and STT independently enabled with stored model IDs; a documented realtime speech model is not a verified provider WebSocket. Status must be credential+model aware with live-connectivity caveat, and backend allowlists remain authoritative.
- Explain setup as choose capability → choose provider → save key → choose actual supported model(s) → save. A failed organization lookup should yield an accessible retry, not an indefinite spinner. Preserve tested provider-reuse paths, tenant fetch abort, offline/no-key honesty, no guessed model list, encryption and no cross-org key copying.
- Evidence: `sessions/DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023.md`; 19/19 isolated callback tests, 6/6 helper cases, native TypeScript/Vitest/real browser not run. FIX-01 code defects, OPS-01 deployment. C3/R1b gating unchanged.

- **Remount follow-on:** On a category/org change remount the entire provider editor, and remount each model select on provider change; effect-only clearing may leave one stale render of the previous vendor. Guided setup 20/20 isolated callback checks (7+5+8), native/browser acceptance pending. Source `DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023`.

### DEV01-CATCHUP-SOURCE-DETAILS-20261023 — distinguish recognizable sources from AI priority
- A selected private Catch-up manifest may expose 200 original email links, but message UUIDs are not meaningful to ordinary users. Provide bounded subject, sender and explicit UTC received date **only from canonical PostgreSQL headers after existing C1/C2 private owner+agent+mailbox/revision revalidation**; never add message bodies to the pagination response.
- Missing or malformed headers should say “unavailable,” not fabricate fields. React must render untrusted subjects as escaped text; preserve exact original links and accessible keyboard focus.
- This is P1 source usability, **not** C3 High/Medium/Low AI classification, app attendance detection, completed review or WhatsApp delivery. Keep `BRIEFINGS_ENABLED` guard, source 200-page cap and manual review-only boundary.
- Evidence: `DEV01-CATCHUP-SOURCE-DETAILS-20261023`, plan `docs/superpowers/plans/2026-10-23-human-readable-catchup-sources.md`, fresh GitHub 17/17 source assertions, isolated helper Node 3/3 + standalone strict TS; full repo/native DB/browser unverified. Future C3 registration, personal presence/consent and WhatsApp external exports still gated.


## DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023

Owner-selected Development recovered at ab7292fbb00263bb817ab2874ab4f66e10946f0f. Fresh native tests 54/54 pass (source/behavior scope only). Live Chromium login returns HTTP 522 origin timeout, so authenticated AI mail/WhatsApp acceptance is blocked with no external messages created. Current state, completed/in-progress/pending work, F01–F21 matrix and exact next action: docs/project-control/sessions/DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023.md. OPS-01 owns origin recovery; DEV-01 resumes frontend acceptance; FIX-01 owns proven application defects. Existing records and roles preserved.
