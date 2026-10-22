

### DEV-01 / Forge — 2026-10-16 — Clara realtime voice transport diagnosis
- Request: User reports voice UI shows an active session and ready microphone, but no WebSocket starts; they cannot speak to Clara to enquire about emails.
- Inspected: apps/web/src/app/ai-voice/voice-workspace.tsx, packages/clara-core/src/runtime.ts, packages/shared/src/voice/transport.ts, and voice architecture/control records.
- Finding: Workspace only obtains mic permission and uses /api/voice/turn for manually entered transcript turns; it never instantiates a VoiceTransportAdapter. Clara resolveVoice() currently returns that HTTP endpoint as sessionEndpoint, which is not a provider realtime endpoint. Thus “session active”/“transport resolved” overstates actual connectivity.
- Action: Opened FIX-01 issue #26 with evidence, acceptance criteria, role boundaries and verification limitations. Updated central NEXT_ACTION, AGENT_SESSIONS, AGENT_EVENTS and DEV-01 memory.
- Role boundary: Did not implement a competing realtime transport or take FIX-01's substantial bug ownership. OPS-01 is not engaged unless a correctly implemented source path fails due to deployment/infrastructure.
- Verification: GitHub source inspection only; no tests/typecheck/build/browser/WebSocket/provider/deployment checks. No PASS or live connectivity claimed.
- Next: FIX-01 uses Clara's pinned realtime client/session negotiation, makes connected state depend on actual transport readiness, bridges voice to the existing authorized host turn pipeline, and adds lifecycle regression tests. DEV-01 continues other independent authorized product work without waiting for CI/Vercel.
# DEV-01 Role-Local Worklog

Append-only operational history for DEV-01. This is not the source of authorization.

## Entry format

### <SESSION-ID> / <DATE>
- **Task:** <task>
- **Authorization:** <reference or safe-maintenance classification>
- **Started from:** <commit/ref>
- **Actions:** <what was done>
- **Files/code:** <paths>
- **Evidence:** <tests/checks/observations>
- **Blockers/dependencies:** <none or exact>
- **Lesson:** <reusable lesson or none>
- **Next action:** <exact next action>

<!-- Append new entries below. -->


### DEV01-DRAFT-SEARCH-20261009 / 2026-10-09
- **Task:** Continue the authorized connected-mailbox product slice.
- **Authorization:** Existing development-first owner instruction and `docs/project-control/NEXT_ACTION.md` connected-mailbox action.
- **Started from:** GitHub `main`; product change committed as `8ccf1cb24039cb3bc745a51576a73ee68007e946`.
- **Actions:** Recovered repository controls and role boundaries; added Drafts search across subject, body, recipients, and mailbox address, plus a no-match state; recorded central session, lesson, and cross-agent routing.
- **Files/code:** `apps/web/src/app/mail/drafts/drafts-client.tsx`; `docs/project-control/AGENT_SESSIONS.md`; `AGENT_MEMORY.md`; `AGENT_BACKLOG.md`; `AGENT_EVENTS.md`; `NEXT_ACTION.md`.
- **Evidence:** GitHub accepted the source and control-plane updates. No local test, typecheck, build, browser check, runtime migration, provider connection, or deployment verification was executed.
- **Blockers/dependencies:** FIX-01 owns BKL-008 (Drafts tenant context and Inbox SQL search placeholders). Zoho/IMAP provider credentials and live runtime are not available in this session.
- **Lesson:** A source commit is not verification evidence; record only what was actually observed.
- **Next action:** Trace and complete Zoho/IMAP sync persistence, ensure provider-synced drafts appear in Drafts, and wire persisted mail/drafts to authorized Clara tools without waiting for CI/Vercel.
- Follow-up: added a static contract assertion in `apps/web/tests/mail-draft-action-contract.test.ts` for the search input, all four searchable fields, and no-match state. Commit `b0fd74f45a06a1cb8e2f3c4c152d242314711d39`. The test was not executed in this session.


### DEV01-CHAT-EMAIL-CONTEXT-20261009 / 2026-10-09
- **Task:** Connected-mailbox sync and chat email access.
- **Authorization:** `docs/project-control/NEXT_ACTION.md` connected-mailbox vertical slice.
- **Actions:** Inspected the chat route and provider worker/adapters. Confirmed chat previously passed conversation text to Clara without querying PostgreSQL email records. Added organization-scoped email context for email-related prompts, constrained to connected accounts and both organization IDs, limited to 20 rows, with untrusted-content delimiters. Added static contract assertions.
- **Commits:** Chat changes include `b9db5774a5b8c2177e606298804d4e1704b75d53` and follow-up corrections through `5c84fd4bd105586ed26272168fdee68b999ae94c`; test contract `93d353864256a49368ecaf4354aec0bfffb05889`.
- **Important finding:** `mailbox-sync-worker.ts` currently selects only Gmail; `ZohoAdapter.sync()` and `ImapSmtpAdapter.sync()` return empty added/updated/deleted arrays. IMAP list/get/search and draft methods are worker placeholders. Thus Zoho and IMAP/SMTP mail sync is not complete yet.
- **Evidence:** GitHub accepted source commits. No test suite, typecheck, build, live chat, provider auth, or sync run was executed; no runtime PASS claimed.
- **Next action:** Implement provider-specific sync + message parsing and safely generalize the worker; connect a host-owned, authorized email.read/draft tool to chat. FIX-01 owns BKL-008.

### DEV01-ZOHO-SYNC-20261009 / 2026-10-09
- **Task:** Implement actual Zoho sync path and generalize the connected-mailbox worker.
- **Authorization:** Existing development-first connected-mailbox vertical slice in `docs/project-control/NEXT_ACTION.md`.
- **Started from:** GitHub `main` after the chat email-context source slice.
- **Actions:** Added Zoho paginated initial import using a folder/offset cursor; added bounded newest-page refresh after initial completion; added encrypted credential snapshot support for refreshed Zoho tokens; generalized worker adapter dispatch and startup for Gmail/Zoho; throttled completed account syncs; updated static sync contracts. IMAP is explicitly excluded from polling until its real UID/FETCH parser is implemented, to avoid marking an empty sync as successful.
- **Files/code:** `apps/worker/src/email/zoho-adapter.ts`, `apps/worker/src/email/mailbox-sync-worker.ts`, `apps/worker/src/index.ts`, `apps/web/tests/gmail-mailbox-sync.test.ts`, `docs/project-control/NEXT_ACTION.md`.
- **Commits:** `403884433e7c2085b5a16e61b9a140e6f0670642`, `7c1afaf285cd7eef2346d99c322d4c1b9bb0e9ff`, `1906efe6253d6586fe07bdb6150722d9eeb0560f`, `41a15f05bfab6c540264c439eb1225126513d0a2`, `00665ee353efb8ff80d5a0af4ca0f7c225630f41`, `597c07ad49ccf8fd409302a46331d004fcef9e01`, `f2df3efc1c31a553b00fe39d114339affb85c6ab`, `c354bf7d3e07158d9417f5e02b00bdd574dba651`, `eb3c8d45ae2f947a252c06f6f00541a3b77208ac`, `77e03fa89ad63c2ddf45aa6034666d93f6ed8645`.
- **Evidence:** GitHub accepted source commits; source text confirms the Zoho sync method now lists folders and paginates messages, and worker dispatch supports Zoho. No test runner, typecheck, build, live Zoho API, PostgreSQL import, or chat turn was executed. No PASS claimed.
- **Known limitation:** IMAP/SMTP sync is not yet implemented and remains excluded from the polling query. End-to-end acceptance is pending.
- **Next action:** Implement IMAP UID-based search/FETCH and RFC822 parsing, complete provider-specific sync state, then test provider sync-to-PostgreSQL-to-Clara chat. Do not wait for CI/Vercel; FIX-01 still owns BKL-008.

- Follow-up corrections: incremental Zoho refresh now starts from the newest page of each folder instead of re-entering the initial-import cursor; Zoho tracks provider message-to-folder mapping and draft identity across the subsequent message-detail fetch. Static assertions were aligned in commit `42a692829dcec696d4ef327a03641344cede9c3f`; folder/draft preservation was added in `65331b15a83f10d5b4fcb899713e0710d72e7497`. These corrections remain untested at runtime.


### DEV01-IMAP-INFRA-20261009 / 2026-10-09
- **Task:** Continue the authorized email sync slice and audit Qdrant/Redis/RabbitMQ integration.
- **Actions:** Implemented IMAP UID SEARCH/FETCH scanning, bounded UID batches, RFC822 header/body extraction, folder-derived draft flags, UIDVALIDITY-aware cursor fields, per-folder high-water checkpoint state, list/get/search methods, and worker dispatch/polling for IMAP/SMTP. Added a deterministic parser regression test and updated capability expectations to avoid claiming IDLE, draft CRUD, or SMTP send support that remains unimplemented. Enabled the opt-in local-infra Compose profile services (PostgreSQL, Redis, RabbitMQ, Qdrant). Added infrastructure integration status map with current data flow and missing implementation points.
- **Commits:** `cd3d85f9a64a016639cabf7b7e74da9e6f27ca9c`, `19806091f6f96f378ea94190cfd8f74bfa1f78c1`, `33379545125a97f6ed7db881eb57e147b0c4e007`, `2fc1384530ee82bb766cb54cf89e2ff4e72154ea`, `131fdc712b2023e71e5ecd4a6c5d2624f7203686`, `26c90fe94093a953973492c5276b50a13c4d078f`, `b2d82ddfe6f656740bd2077dc1300cad895645f7`, `d72d444a1d71c9675fa52b4a9bcb3b957150cc56`, `c3b61ba1b688137cf917bdb224b51fef433430d5`, `63312b53db66a42d10cceb67b3b1f6a283511642`.
- **Evidence:** GitHub accepted source/control commits. Test source added/updated but not executed. No typecheck, build, live IMAP/Zoho session, PostgreSQL import, or Clara Chat turn was run.
- **Limitations:** IMAP parsing is basic line-oriented RFC822 handling; multipart parsing is partial, charset/attachment support is incomplete, and the low-level response reader has not been tested against real servers. Redis/RabbitMQ have no active app client paths found; Qdrant is configured/expected behind Clara RAG but no email indexing pipeline is implemented. Enabling Compose services does not enable those app integrations.
- **Next action:** Run focused adapter tests and typecheck; correct defects; validate provider-to-PostgreSQL-to-chat flow with configured accounts. Then implement Clara-supported email vector indexing, Redis client usage, and RabbitMQ durable sync queue/retry path. FIX-01 retains BKL-008; OPS-01 retains production infra/deployment.


### Follow-up — IMAP parser test and infrastructure activation (2026-10-09)
- Added a deterministic mocked Zoho sync test for initial folder import and repeat incremental refresh: commit `54f026281666b9d600909f947789204b94bd48b4`.
- Added IMAP parser contract coverage and corrected adapter capability assertions: `26c90fe94093a953973492c5276b50a13c4d078f`, `b2d82ddfe6f656740bd2077dc1300cad895645f7`; updated worker selection test after enabling IMAP polling: `d72d444a1d71c9675fa52b4a9bcb3b957150cc56`.
- Enabled the opt-in local Compose profile for PostgreSQL/Redis/RabbitMQ/Qdrant: `c3b61ba1b688137cf917bdb224b51fef433430d5`. Added `docs/architecture/INFRASTRUCTURE-INTEGRATION-STATUS.md` documenting actual data flow and integration gaps: `63312b53db66a42d10cceb67b3b1f6a283511642`.
- **Not verified:** No test suite, typecheck, build, live mailbox, deployed database, Clara turn, or infrastructure container was executed. GitHub accepted the commits only. Redis and RabbitMQ still lack real application client paths; Qdrant email indexing is not implemented. Do not claim those app integrations are enabled just because endpoints or local containers exist.


### DEV01-ADAPTER-CORRECTIONS-20261009 — 2026-10-09
- **Task:** Continue the focused provider test/typecheck pass and correct defects identified by source review.
- **Source fixes:** Zoho `updateDraft()` now performs a provider PUT with only supplied draft fields; IMAP checkpoints are decoded on both initial and incremental runs and persisted on bounded UID continuation; SMTP AUTH PLAIN now uses NUL separators in its credential payload.
- **Commits:** Zoho `72f05f5f642beea07cc5543fbc744051a083f922`; IMAP `5d2c3f3bcbab6698a56449afda407921c05b7760`.
- **Verification attempt:** Tried to check out the repository locally. Node is available, but pnpm is not installed and outbound DNS cannot resolve github.com, so the test/typecheck commands could not be executed here. GitHub source reads/writes succeeded; this is not test evidence.
- **Still pending:** Focused Zoho/IMAP tests, worker and web typechecks, real IMAP/SMTP server validation, live PostgreSQL ingestion, tenant-scoped Clara Chat acceptance, Clara Core RAG indexing, and real Redis/RabbitMQ application integrations. FIX-01 retains BKL-008; OPS-01 retains production infrastructure/deployment.

- **Threading follow-up:** IMAP parser now uses the first/root References identifier and falls back to Message-ID then folder/UID, rather than using the last reference or an empty string. Added a parser assertion. Commits: `e21fd2fad824a41180deb6cf89b4f7aafb051f7c`, `d5dbd54cb7cb7b224d39b9b4e836b62501c575d3`. Test remains unexecuted.


### 2026-10-09 — Zoho/IMAP focused-test source corrections
- Fixed Zoho mocked-fetch setup to answer the adapter's initial `/api/accounts` request, which previously would have thrown before the sync/draft assertions.
- Fixed IMAP LIST command to emit a correctly quoted mailbox pattern followed by escaped CRLF; aligned Zoho incremental capability metadata with the bounded newest-page refresh implementation.
- Commits: `f04eb93d27ee01934970e64679be381d6dec6500`, `fe3e2d39157f74c66741772966125cfee81055a1`, `5a59ec5745f8d3a3f735220f9496e14c79dece22`.
- No test/typecheck/live-server commands were executed. Do not interpret source fixes as verification. Continue with focused test/typecheck execution, real mailbox ingestion and Clara Chat checks; then RAG email indexing and Redis/RabbitMQ app integration. FIX-01 retains BKL-008; OPS-01 retains production infrastructure/deployment.


### DEV01-IMAP-LITERAL-20261009 / 2026-10-09
- **Task:** Improve IMAP response handling so FETCH literals are consumed by octet count rather than parsed as line-oriented responses.
- **Authorization:** Existing development-first owner instruction and connected-mailbox action in `docs/project-control/NEXT_ACTION.md`.
- **Started from:** Main source blob `fced2bed6967a0db94b99bd8bf45f886140d5f22` for `apps/worker/src/email/imap-smtp-adapter.ts`.
- **Actions:** Changed the socket reader buffer to retain raw bytes, added an exact-length byte reader and an IMAP response reader that recognizes literal markers and enforces a 50 MiB literal limit, then routed LIST and general IMAP command response reads through it.
- **Files/code:** `apps/worker/src/email/imap-smtp-adapter.ts`.
- **Evidence:** GitHub accepted source commit `f7df46f3d0d90bf1c0aae3407b448bd83aeca855`. No focused test, typecheck, fake-server run, live IMAP session, database sync, or chat verification was executed.
- **Limitations:** This improves octet-boundary handling but does not establish complete IMAP grammar compliance. Literal continuation parsing, unsolicited responses, BODYSTRUCTURE/MIME, charsets, and server-specific variants still need tests. Existing line reader remains used for greeting/login/SMTP.
- **Next action:** Add fake IMAP server tests covering a literal containing CRLF, a UTF-8 body, fragmented literal delivery, multiple literals in one response, and oversized-literal rejection; then run adapter tests and worker/web typechecks when dependencies are available.


### DEV01-IMAP-LITERAL-TESTS-20261009 / 2026-10-09
- **Task:** Add regression coverage for the literal-aware IMAP response reader.
- **Authorization:** Connected-mailbox development-first action.
- **Started from:** Literal reader source commit `f7df46f3d0d90bf1c0aae3407b448bd83aeca855`.
- **Actions:** Exported the reader for module-level testing and added tests for CRLF inside a body literal, multiple literals in one FETCH response, retaining the subsequent tagged completion response, and rejection of a literal larger than 50 MiB.
- **Files/code:** `apps/worker/src/email/imap-smtp-adapter.ts`, `apps/worker/tests/imap-smtp-adapter.test.ts`.
- **Commits:** `d4a5c6589f2e28a00277a725cf6c628ea8b56eb5`, `b20c6423c6ded123a49ff6301a40de6385832a26`.
- **Evidence:** GitHub accepted both source and test commits. Test source has not been executed; no typecheck or server session was run.
- **Next action:** Execute worker IMAP/Zoho tests and worker/web typechecks where pnpm dependencies are available; fix any failures. Add fragmented network delivery coverage and validate against a real IMAP server when credentials/runtime are available.

- Follow-up correction: fixed double-escaped CRLF sequences in the newly added literal tests so the fixture contains actual IMAP wire CRLF bytes. Current test-source commit: `b20c6423c6ded123a49ff6301a40de6385832a26`. Tests still have not been executed.


### DEV01-REDIS-MAILBOX-LEASE-20261009 / 2026-10-09
- **Task:** Give REDIS_URL a concrete application use case without adding a runtime package dependency.
- **Authorization:** Development-first connected-mailbox action in NEXT_ACTION.md; independent of FIX-01 BKL-008 and OPS-01 deployment ownership.
- **Actions:** Added a small RESP2 client supporting redis:// and rediss://, optional username/password authentication and database selection; added token-owned SET NX PX lease acquisition and Lua compare-and-delete release; wired the lease around mailbox-sync batches with a 10-minute TTL. If configured Redis is unavailable, the batch is skipped rather than proceeding without cross-replica coordination. PostgreSQL per-account claims remain authoritative.
- **Files/code:** apps/worker/src/email/redis-lease.ts; apps/worker/src/email/mailbox-sync-worker.ts; docs/architecture/INFRASTRUCTURE-INTEGRATION-STATUS.md.
- **Commits:** d7228495f5bd03483154ac194cba865fbf3b00e5; 0e10e647b029ea065b467e120180248e1eb1b27d; bd6368d7f56f39660cf28b913026fcb8fd0a0004.
- **Evidence:** GitHub accepted source changes. No test/typecheck or live Redis/worker test was executed. Connection-failure, contention, expiry, TLS and AUTH behavior remain unverified.
- **Next action:** Add focused tests for Redis RESP commands/lease semantics and run worker/web typechecks when dependencies are available; continue Clara Core-supported email indexing and RabbitMQ durable queue integration.


### DEV01-REDIS-LEASE-TESTS-20261009 / 2026-10-09
- **Task:** Add deterministic protocol-level coverage for the Redis mailbox lease.
- **Actions:** Added a fake TCP Redis RESP2 server and tests for SET NX PX success/contention, token-checked EVAL release, and URL AUTH/database selection.
- **Files:** apps/worker/tests/redis-lease.test.ts.
- **Commit:** fbd07ca9dee64a3fbe114bb16cf08fadcfa695f1.
- **Evidence:** Test source accepted by GitHub; not executed in this environment. Live Redis and typecheck remain pending.


## 2026-10-09 — Fragmented IMAP literal regression

- Added a PassThrough-socket regression for an IMAP FETCH literal whose marker, CRLF-containing payload, and following tagged response arrive in separate chunks.
- Updated `docs/project-control/NEXT_ACTION.md` and `docs/architecture/INFRASTRUCTURE-INTEGRATION-STATUS.md` to reflect the additional source coverage.
- Commits: test `d90d7756216609cd3ec772f1fc77b14089561ca6`; next action `6af2d9a0278f144981f72231ee6e9f87dda3500b`; architecture status `5adc59f407583356aba2a8cc6fc94429c3bc0a75`.
- No tests, typechecks, or live IMAP checks were run. Continue implementation without waiting for CI/Vercel; next independent work remains the Clara Core indexing boundary and RabbitMQ queue integration.


## 2026-10-09 — Email sync queue contract groundwork and Clara boundary audit

- Added transport-neutral `email.sync` queue envelope builder and focused test source: `d4d9f9bcce45dfcc72d5a5fb8192d7564185844b`, `fac69129474eea539755d282ed053a32f588e27f`.
- Envelope includes UUID validation, account/history idempotency key, correlation/message IDs, timestamps, bounded attempt count, producer/consumer and documented routing key.
- Audited the local Clara boundary: retrieval exists, but no indexing method; local embed methods fail closed. Reference Clara Qdrant helpers are not a drop-in host API due to Clara-specific dependencies. Avoid direct Qdrant writes until a supported adapter boundary is defined.
- RabbitMQ remains unimplemented. No test/typecheck/live broker run performed. Continue independent source implementation; do not wait for CI/Vercel.


### DEV01-LOVABLE-UI-MIGRATION-20261009 / 2026-10-09
- **Task:** Adopt the Lovable-generated Agentic AI Studio UI/UX in the current application while preserving all application functionality and validations.
- **Authorization:** Explicit user instruction in this session; existing development-first product implementation authority.
- **Started from:** GitHub `main`; source files under `source/lovable-ui` were inspected before changes.
- **Actions:** Analyzed the Lovable README/package/design tokens/workspace shell/overview. Adapted semantic tokens and typography into the existing Tailwind v4 app, replaced text-glyph navigation with inline SVG iconography, made the sidebar responsive/mobile-openable, redesigned header/search behavior, aligned the app content offset with the fixed sidebar, and rebuilt the overview around real persisted API data and honest loading/error/empty states.
- **Files/code:** `apps/web/src/app/globals.css`; `apps/web/src/app/layout.tsx`; `apps/web/src/components/sidebar.tsx`; `apps/web/src/components/top-bar.tsx`; `apps/web/src/app/page.tsx`.
- **Commits:** `a9083acaf0af1a4a97dba938e5543d86fe144426`, `47ef723959076dfac0175bd181bd633d692d1b9c`, `13c35cb4dc92f9b01cf1330d466fb4a574307256`, `8bfacdff848ce8ebde9bfc6b2f677b4b6e3cb37a`, `fe547ceece224619e158dec2d32518309400dde2`, `1a06340836edec45a1e300ab6b710822d3c59c0c`.
- **Evidence:** GitHub accepted each source update. No local typecheck, tests, build, browser check, or runtime validation was performed. No PASS is claimed.
- **Blockers/dependencies:** Full UI migration remains in progress; no dependency blocker to source work. Verification environment unavailable in this session.
- **Lesson:** Reuse the Lovable design tokens and component patterns, not its TanStack Start runtime wholesale. Keep existing Next.js server routes, auth/RBAC, real API data, validations, and truthful error states. Treat visual reference/demo-only behaviors as reference, never as production functionality.
- **Next action:** Continue screen-by-screen migration of the remaining app routes, beginning with Mail and Agents, preserving every existing action and validation; update migration/control records as slices land.


### DEV01-LOVABLE-UI-MIGRATION-20261009 — Follow-up slice
- **Actions:** Harmonized legacy card/button radius and shadows with the Lovable compact geometry; refined shared heading/form-control typography; replaced the login/setup and inbox indigo/blue ambient gradients with the warm green/ivory palette; connected the global header search form's `q` query parameter to the Inbox client's controlled search state.
- **Files:** `apps/web/src/app/globals.css`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/setup/page.tsx`, `apps/web/src/app/mail/inbox/inbox-client.tsx`.
- **Commits:** `b894e43f9b0ae46390b468353b804a386b51e399`, `c9b07207a297874b831b850bacc09c58bc6fcf69`, `ebd95586b310658c8e13587db8c2150ab6c862c5`, `9b4c7fb64270a5d34c04486044c83f5be0bc5bbc`, `a85f0261ac18d19bcabe4b59e2ed327248bfd6df`, `3ed3c28fe7aba734789880de407582cdc525b2cc`.
- **Evidence:** GitHub accepted source writes only. No tests/typecheck/build/browser/runtime checks executed.
- **Next action:** Continue visual adaptation of Agents and remaining Mail screens, preserving current validation and API behavior.


### DEV01-LOVABLE-UI-MIGRATION-20261009 — Contract coverage
- Added `apps/web/tests/lovable-ui-migration.test.ts` covering Lovable palette/font tokens, preserved Next.js auth shell and route navigation, header-to-Inbox query search, persisted overview loading/error/empty behavior, and login form validation/API flow.
- Also updated Chat, AI Voice and mail thread ambient gradients to the Lovable green accent, and synchronized Inbox search state when the query string changes.
- Commits: `239a38c936629486e3bfd1be2908f2d74e06193c`, `130c810e44f284f4e9b5390a27b3e2b1fa8a2a1a`, `c7bc510e3aedfa266713c48340cc2d0c3bcf9a3b`, `eeb717c5c4e0dbe79f493631e8b2c1024592776f`, `3ccad8c19694500961668fdfb60a8e41652a4af4`.
- No tests/typecheck/build/browser/runtime checks were run; the contract test is source-only evidence at this point.
- **Next:** Continue adapting Agents and Mail subpages, then remaining routes; preserve functionality and validation. Do not wait for CI/Vercel.


### DEV01-LOVABLE-UI-MIGRATION-20261009 — Agents list alignment
- Replaced decorative text glyphs on agent list and empty state with inline SVG sparkle iconography from the Lovable design language. Preserved existing agent POST flow, slugification/validation, notification feedback, status filtering and navigation.
- Added test assertions for the SVG mark and preserved create flow in `apps/web/tests/lovable-ui-migration.test.ts`.
- Commits: `0a79f7f3a9321d30dbc4d01fa5c611c1356d5021`, `2c949dc92d524f484d5e689603afd26106f9d801`.
- Tests/typecheck/build/browser/runtime checks remain unexecuted. Continue with Mail subpages and remaining routes.


### DEV01-LOVABLE-UI-MIGRATION-20261009 — Nested Mail navigation
- Fixed the sidebar active-state logic to keep Mail expanded on Inbox, Threads, Drafts, Accounts and nested detail routes rather than only under Accounts. Added a static UI contract assertion.
- Commits: `a6c0abb0b5521aa0b6d636c48f83dc7f301a2c44`, `11ff84aac3a8379b09de78a191d704bd845512d6`.
- A stale-blob GitHub update returned 409; refetched the current file SHA and applied the focused change safely. No force update or history rewrite.
- No tests/typecheck/build/browser/runtime checks executed. Continue the remaining UI migration.

### DEV01-LOVABLE-UI-MIGRATION-20261009 — Inbox + Agents tranche
- Continued from GitHub main after reading the active NEXT_ACTION and role memory/worklog. Reviewed the Lovable reference inbox route, workspace shell, semantic styles and the production Next.js Inbox/Agents implementations.
- Updated `apps/web/src/app/mail/inbox/inbox-client.tsx` to match the Lovable compact editorial layout, semantic icon-led headers, warm-neutral palette, compact borders and typography. Preserved persisted Inbox API refresh/search, mailbox/unread/action filters, read/unread mutation, archive/move operations, Compose/Approvals/Mailboxes navigation, empty state, and alert/error reporting.
- Updated `apps/web/src/app/agents/agents-client.tsx` to align typography, metrics, compact list rows, semantic status colors, form fields and buttons with the Lovable design. Preserved API-backed creation, slug pattern validation, 500-character purpose limit, notifications, filtering, refresh, and configuration navigation.
- Extended `apps/web/tests/lovable-ui-migration.test.ts` to assert the preserved Inbox actions, empty/error states, Agent validation, and design markers.
- Commits: `9de78b0f3c889114c976b60242b1de80a3305549`, `c9641d9d99d95b7556d88267336790b3cc3f5195`, `0aef87b0db4e249173d7ed62d7e3d664bd7cb9bf`, control pointer `39423d765416b506b75d437aa6ee8031d1ea8d49`.
- Verification: GitHub source writes accepted. No test/typecheck/build/browser/runtime checks executed; no PASS claimed.
- Next: continue remaining Mail subpages (Accounts, Drafts, Threads, Compose, Approvals), then WhatsApp, Automations, Schedules, Chat, AI & Voice, Knowledge, Activity, Audit, Operations and Settings. Keep the queued connected-mailbox/Clara integration work after the UI tranche.

### DEV01-LOVABLE-UI-MIGRATION-20261009 — Mail screen group continuation
- Continued the authorized screen-level adaptation through Mail Accounts, Drafts, Threads, Compose and Approvals. Reused the source Lovable visual language: warm neutral background, ink/green primary/accent, DM Sans body, Space Grotesk headings, compact borders, restrained icon-led sections and compact controls.
- Preserved mailbox OAuth/configuration/IMAP forms and test/disconnect/remove actions; Drafts persisted search, provider sync, edit and delete; Compose draft save and explicit send-approval request; approval queue refresh and explicit approve/reject decisions; and truthful Threads empty state.
- Repaired the Drafts server fallback JSX during source inspection before continuing. Extended `lovable-ui-migration.test.ts` to cover Accounts, Drafts, Compose, Threads, Approvals and agent/inbox contracts. Test source remains unexecuted.
- Additional commits: `9da036acb8340e2f4f0bfbe4cf8aeffd34679531`, `0e70c42eb8edd4c0f062502c3ab3a66969eeb9fc`, `e84075ebdd270388403da4fe159a290ef935f3aa`, `52be6d66468291dab4f067d314c1c5a3491b3336`, `706b46eb126cf9c875110a5cbc418ef798dcfd12`, `295b038f930f31b5ecb8863edd244b16abedfd03`, `224146d0162ac106eef1f21e3179653c1541e88a`, `e7bba79cf89da010b62e3bdf5396302f1d090d75`, `a47edb7202c06d0ff32dddfdd94e74e5580cd6ea`, `737ab08e96bc816a2a74a3184b8c290859d06a11`, `052eed69143f6b135c8559f9944002d25f4486c2`, `c25fdf7c5a3c16c8edffa585fe3b4a99ea47b632`.
- Routing: discovered that the Approvals server page uses `getDevOrgId()`; recorded BKL-012 / EVT-DEV01-APPROVALS-TENANT-20261009 for FIX-01. No fix to tenant selection was attempted in this DEV-01 session.
- Verification: GitHub source writes only; no tests, typecheck, build, browser, live-provider or runtime checks executed. No PASS claimed.
- Exact next action: continue Lovable visual adaptation on WhatsApp, Automations, Schedules, Chat, AI & Voice, Knowledge, Activity, Audit, Operations and Settings. Resume queued connected-mailbox/Clara work after the UI tranche.

### DEV01-LOVABLE-UI-MIGRATION-20261009 — Operational screen continuation
- Continued adapting supporting screens with Lovable's warm-neutral/ink/green theme, Space Grotesk headings, compact borders and inline SVG icons: WhatsApp overview presentation, Knowledge, Activity, and AI Voice workspace/fallback presentation.
- Source commits from this continuation: `09c9047c726329e0b4a956e706e979420e722f06` (WhatsApp presentation), `b919fbe4ca328840d3a30e72fe97cd83d9a7a3c1` (Knowledge), `9ce8ff420179a1cdebbf6f56997764bc80bd07ff` (Activity), `e73552a8949c63a6afac511a88bb15a4818cbdcb` (AI Voice unavailable state), `889c468240fd681db6d21a7d00b23054e7e71198` (AI Voice workspace).
- Concurrent main-branch updates caused GitHub 409 conflicts while editing WhatsApp route and UI contract tests. Per the no-repeated-poll rule, stopped retrying overlapping paths and recovered the current authoritative NEXT_ACTION; another active source change is also touching the Lovable migration/test surface.
- Important implementation finding: a persisted `whatsapp-client.tsx` exists with server-side credential submission, account list/disconnect, persisted message polling, and idempotent outbound queueing, but the visible `whatsapp/page.tsx` was still a static preview at the point inspected. The required route wiring must be completed without losing the existing authenticated organization context. Do not present the static Connect button as functional.
- Verification: no tests, typecheck, build, browser or runtime checks executed. No PASS claimed.
- Exact next action: follow the current `docs/project-control/NEXT_ACTION.md` (the latest main version names WhatsApp route-group integration as the immediate UI tranche). First reconcile the current route against the existing `whatsapp-client.tsx` and authenticated organization context, then continue remaining route groups. Do not repeatedly retry a stale SHA conflict; route substantial tenant bugs to FIX-01 and runtime/infrastructure to OPS-01.

### DEV01-EMAIL-OPS-PLAN-20261012 / 2026-10-12
- **Task:** Recover current GitHub state and prepare a comprehensive modular email operations + AI tool access plan.
- **Authorization:** Explicit owner request to inspect and prepare implementation plans; planning/documentation only, not material implementation authorization.
- **Started from:** `main` `4dc991fa5616f9a04ed3050a7c748e489c6e75f5`.
- **Actions:** Inspected project-control and role-local records, email provider/agent architecture, provider adapters, sync worker/queue, shared email/tool contracts, Clara reuse boundary, current issues and active role routing. Added `docs/plans/EMAIL-OPS-01-IMPLEMENTATION-PLAN.md` and session record.
- **Files/code:** Plan and session documents only; no product code changed.
- **Evidence:** GitHub accepted plan commit `53c2b7ec` and session commit `6f042417`. Tests/typechecks/build/browser/provider/database/deployment checks NOT RUN.
- **Blockers/dependencies:** OPS-01 owns live RabbitMQ vhost/Redis WRONGPASS and runtime ingestion proof; FIX-01 owns substantial source bugs/test failures. Tool/schema/policy/provider-scope decisions require owner/architect approval.
- **Lesson:** Adapter declarations and HTTP 202 are not ingestion proof. The host app owns email tools; all channels must share execution-time authorization and audit. Cursor advancement follows persisted/reconciled work.
- **Next action:** Owner/architect review the plan and approve/correct E1 (Gmail sync correctness) and E3 (host-owned email tool catalogue) before material implementation.

### DEV01-EMAIL-OPS-IMPLEMENT-20261013 / 2026-10-13
- **Task:** Continue EMAIL-OPS-01 with Gmail history reconciliation and the shared email tool contract inventory.
- **Authorization:** User explicitly said to proceed with the next after the plan; implementation of E1/E3 began on a dedicated feature branch.
- **Started from:** `main` with prior plan/control records; working branch `feature/email-ops-e1-e3`.
- **Actions:** Paged Gmail history, classified additions/label changes/deletions, handled expired history cursor fallback, persisted account/org-scoped local deletions and thread counts before advancing the checkpoint, removed derived email knowledge documents, added history pagination regression coverage, failed closed on incomplete Gmail reply/forward capability flags, and added/exported the shared email tool descriptor contract and capability/allowlist filtering plus focused tests.
- **Files/code:** `apps/worker/src/email/gmail-adapter.ts`; `apps/worker/src/email/mailbox-sync-worker.ts`; `apps/worker/src/knowledge/email-knowledge-indexer.ts`; `apps/web/tests/gmail-adapter.test.ts`; `packages/shared/src/agent/types.ts`; `packages/shared/src/agent/intents.ts`; `packages/shared/src/index.ts`; `docs/specs/TOOL-CONTRACTS.md`; `docs/plans/EMAIL-OPS-01-IMPLEMENTATION-PLAN.md`.
- **Evidence:** GitHub accepted source changes and test source writes on the feature branch. Tests/typecheck/build/live-provider/database/browser/deployment verification NOT RUN.
- **Blockers/dependencies:** Tool descriptors are contract metadata, not yet executable host handlers. OPS-01 retains the RabbitMQ/Redis runtime issue and persisted-ingestion proof. FIX-01 retains substantial source defects and regression remediation.
- **Lesson:** Do not advance Gmail history checkpoints before every history page and resulting database reconciliation completes. Do not expose a tool merely because a contract/capability flag exists.
- **Next action:** Implement the actual host registry and tenant-scoped email handlers, starting with read-only operations; prove account binding, permission/capability checks, schema validation, output bounds/redaction, and audit before exposing them to any model/channel.


### DEV01-EMAIL-OPS-IMPLEMENT-20261013 / 2026-10-13
- User authorized continuation of EMAIL-OPS-01 on `feature/email-ops-e1-e3`.
- Updated Gmail history paging/classification and local reconciliation; added regression coverage. Added/exported shared email tool contract metadata with capability/allowlist filtering.
- Verification: source writes only; tests/typecheck/build/runtime not run. Tool contracts are not executable handlers.
- Next: implement the shared host registry and read-only tenant-scoped handlers with execution-time authorization and audit. OPS-01 retains infrastructure; FIX-01 retains substantial bug remediation.

### DEV01-EMAIL-OPS-IMPLEMENT-20261013 — continuation
- Added `packages/shared/src/agent/registry.ts` with registration duplicate protection, lookup/listing, fail-closed agent allowlist discovery and schema validation; exported it from the shared package and added focused registry tests.
- Updated TOOL-CONTRACTS and EMAIL-OPS-01 plan to document the registry boundary. It does not yet authorize account access, evaluate approvals, or persist audit records.
- **Exact next action:** wire executable read-only email handlers to the registry with tenant/account binding, permissions, capability checks, bounded outputs and audit; keep contract-only descriptors unavailable to the model until then.

### DEV01-EMAIL-OPS-IMPLEMENT-20261013 — read handler continuation
- Added `apps/worker/src/agent/email-read-tools.ts` with safe read-only account/capability/folder/label/message/thread/search/sync-status handlers. Account-scoped calls recheck org + agent binding; send-only bindings cannot read. Outputs are bounded and error summaries are sanitized.
- Added a registration helper; actual channel runtime registration and durable audit persistence remain pending.
- **Exact next action:** wire the handlers into the shared runtime, enforce allowlist/permission/schema/capability/policy at invocation, persist audit, and ensure chat/voice/WhatsApp/schedules use one path. Verification remains unrun.

### DEV01-EMAIL-OPS-IMPLEMENT-20261013 — runtime factory continuation
- Added `apps/worker/src/agent/tool-executor.ts` as the shared invocation pipeline and `apps/worker/src/agent/email-tool-runtime.ts` to load the persisted agent allowlist, register read-only handlers, recheck mailbox grants/capabilities, and write sanitized tool-call audit events.
- Added test source for allowlist denial, schema rejection, authorization denial, and audit handling. Tests were not executed.
- **Next action:** connect `invokeEmailReadTool()` to the actual chat/realtime voice/WhatsApp/scheduled transport and model tool-call loop. Do not expose catalogue descriptors before that path is used. FIX-01 owns ISS-026; OPS-01 owns live infrastructure verification.


### DEV01-EMAIL-TOOL-LOOP-20261013 — provider adapter and bounded loop
- **Task:** Continue the next authorized email runtime feature after the shared registry/runtime groundwork.
- **Authorization:** Existing EMAIL-OPS-01 plan and user instruction to proceed with the next feature.
- **Started from:** `feature/email-ops-e1-e3`; latest source baseline was the Clara boundary on `main`.
- **Actions:** Added provider-neutral tool-call contracts; native non-streaming tool-call mappings for OpenAI-compatible and Gemini; explicit fail-closed behavior for Sarvam; malformed-argument fail-closed response; bounded worker loop using registered/allowlisted handlers and shared executor/audit.
- **Files:** `packages/clara-core/src/types.ts`, `packages/clara-core/src/index.ts`, `packages/clara-core/src/runtime.ts`, `apps/worker/src/agent/email-agent-loop.ts`, `apps/worker/tests/email-agent-loop.test.ts`, `apps/worker/tests/clara-tool-calling.test.ts`, `apps/worker/tests/tool-executor.test.ts`, `docs/reviews/EMAIL-OPS-01-DEV01-SELF-REVIEW-20261013.md`.
- **Evidence:** GitHub accepted source writes. No tests, typecheck, lint, build, provider API, database, live mailbox, browser, CI, or deployment verification was executed.
- **Self-review:** External `ai-reusable-libraries` repository could not be resolved through connected repository calls; comparison is against the current `main` baseline only. New loop is not transport-wired; only read handlers are registered; Sarvam tool calling remains unsupported; FIX-01 ISS-026 remains a critical dependency; OPS-01 live infra blocker remains.
- **Next action:** Run the newly added OpenAI/Gemini provider-contract tests and worker-loop tests, then run Clara/worker typechecks if a local checkout is available. Fix concrete failures and record actual output. Keep PR draft and unmerged.


### DEV01-EMAIL-AUTH-RECHECK-20261013 — execution-time authorization hardening
- **Actions:** Updated `email-tool-runtime.ts` to reload persisted agent allowlist on each tool invocation and check descriptor all-of/any-of provider capabilities, retaining fail-closed authorization behavior.
- **Evidence:** GitHub accepted source update only; no tests/typecheck/runtime checks were run.
- **Next:** Add regression tests for mid-turn policy revocation and multi-capability denial, then run focused tests/typechecks if local checkout is available.


### DEV01-EMAIL-INDEX-LIFECYCLE-20261014 — account-scoped vector sync outbox
- Added branch `feature/email-index-lifecycle-v1`: stable source identity/content/metadata hashes, deterministic chunk point IDs, metadata-only refresh behavior, changed-message requeueing, and draft/empty-message cleanup.
- Added `email_knowledge_sync_jobs` migration/outbox for upsert, message delete and account purge. Account deletion queues purge before deleting the account and removes account-scoped PostgreSQL email knowledge docs. Added an injected vector adapter processor with retries and stale-job checks.
- Added allowlist-revocation/capability tests, hash/point-ID tests, outbox migration contract test, and vector sync lifecycle tests.
- **Not complete:** no supported Clara RAG/vector adapter exists in the repo and the new outbox worker is not wired to worker startup. Do not claim live vector sync until the supported adapter is bound.
- **Verification:** no local checkout available; tests/typechecks were not run. No PASS claimed. Next action: bind the supported Clara RAG adapter, run focused tests and Clara/worker typechecks, fix concrete failures.


### DEV01-EMAIL-RAG-REVIEW-20261016 / 2026-10-16
- **Task:** Review existing email indexing/retrieval and recommend the best architecture for fast accurate email RAG in Chat and realtime voice before changing product code.
- **Authorization:** Explicit user request for current-code inspection, self-critique, PostgreSQL vs Qdrant recommendation, and session/lesson/next-action records; explicit instruction to review before touching code. Product code changes intentionally deferred.
- **Started from:** GitHub main; source/control refs observed during review point to `5d8d2dbc70fd4a36b665e709816cb24c65419b6d`.
- **Actions:** Inspected indexer chunking, PostgreSQL knowledge tables, durable vector outbox/adapter contract, worker startup, local Clara retrieval/embedding code, email read handlers, Chat email-context loader, control docs, and Clara Core reference map/agent rules. Wrote `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`.
- **Files/code:** One new proposal document only; no application code changed.
- **Evidence:** GitHub accepted proposal commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`. No tests/typechecks/build/Qdrant calls/provider ingestion/latency/runtime isolation checks executed.
- **Blockers/dependencies:** FIX-01 must close ISS-026 and establish active-agent account retrieval scope; a supported Clara server-to-server email-vector adapter is not bound; vector outbox loop is not wired into worker startup; architecture review required before material implementation.
- **Lesson:** SQL chunk persistence is not vector retrieval. Exact time/count/latest questions need SQL; semantic topic questions benefit from filtered Qdrant plus lexical search and authoritative revalidation. Avoid unsupported Qdrant endpoint/collection guesses.
- **Next action:** Review/correct the proposal, confirm the supported Clara adapter contract, coordinate with FIX-01 on ISS-026, then implement only after the retrieval authorization boundary is established. OPS-01 handles live runtime and latency acceptance.


### DEV01-EMAIL-RAG-ADAPTER-INVESTIGATION-20261016 — follow-up
- **Action:** Continued the authorized next step by inspecting the current Clara AI Platform main source for a supported server-to-server vector adapter.
- **Evidence:** `src/modules/admin/core/vector-store-kb.ts` exposes internal KB-scoped upsert/delete functions; `src/app/api/embed/search/route.ts` is KB-scoped retrieval with quota and KB/provider resolution. Neither is a supported account-scoped email-vector API. The existing upsert uses random point IDs and KB/document payloads, not the deterministic account-scoped lifecycle contract required by ai-comms-agent.
- **Decision:** Do not call internal functions across repository boundaries, use `/api/embed/search` for email retrieval, or place email vectors in a shared KB. No supported API exists in the inspected current source. No Clara repo or product code was modified.
- **Security:** ISS-026 is still open and FIX-01-owned. No vector retrieval was exposed or outbox adapter bound.
- **Artifact:** Updated `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`, commit `0994cdd0a9388ee10b57ebc759d05a2eb4117f20`.
- **Verification:** Source inspection only; no endpoint calls, tests, typechecks, builds, DB/Qdrant operations, or performance tests.
- **Exact next action:** Establish an explicit authenticated Clara email-vector API contract and implement it in the Clara source-of-truth repository, with deterministic point IDs, upsert/metadata-update/delete/purge operations, mandatory organization + allowed-account search filters, and citation-bearing results. After FIX-01 closes ISS-026, bind that supported contract in ai-comms-agent, wire the outbox worker, and implement shared retrieval. OPS-01 retains live runtime/ingestion/latency acceptance.



### 2026-10-16 — Clara email-vector API draft implementation
- **Scope:** Implemented Clara's explicit supported email-vector API after user authorization; updated ai-comms-agent plan/control records.
- **Artifacts:** Clara draft PR #298 (https://github.com/Rilan-Dev/Clara-AI-Platform/pull/298), contract docs, route boundary tests, Clara handoff/session log, and updated hybrid RAG plan.
- **Security:** API search requires org + non-empty explicit allowed-account IDs and rechecks returned payloads. The service token is not a mailbox authorization substitute. ISS-026 remains FIX-01-owned/open; no adapter binding or retrieval exposure.
- **Verification:** No tests/typecheck/lint/build/live Qdrant/embedding/isolation/performance tests run.
- **Exact next action:** Run focused executable checks and Qdrant integration coverage for the Clara API draft; prepare ai-comms-agent adapter contract but keep it disabled until ISS-026 closes. OPS-01 handles live infrastructure, ingestion, and latency acceptance.



### 2026-10-16 — Unbound Clara vector adapter
- **Added:** `apps/worker/src/knowledge/clara-email-vector-adapter.ts` implementing the existing injected adapter contract; `clara-email-vector-adapter.test.ts` covers upsert payload mapping, cleanup mapping, missing credentials, and HTTP failure handling.
- **Contract:** Clara PR #298 now accepts nullable received timestamps and content/metadata/chunk hashes for a metadata-only fast path.
- **Boundary:** Adapter is not imported in `apps/worker/src/index.ts`; outbox loop remains unstarted. ISS-026 remains FIX-01-owned/open; do not expose Chat/realtime-voice retrieval.
- **Verification:** No tests/typecheck/build or live Qdrant/embedding/isolation/performance checks were run.
- **Next:** Execute focused tests/typecheck when a dependency-equipped checkout is available; continue independent source work without waiting on CI; activate only after ISS-026 closes and Clara API verification is complete.

### DEV01-EMAIL-VECTOR-REVIEW-CORRECTIONS-20261016

- Task: Continue focused source review of Clara email-vector API and the ai-comms-agent adapter.
- Changes: Fixed stale sender/folder metadata clearing in the worker adapter and Clara API contract; fixed UTF-8 request-body byte cap in Clara; added an opt-in Qdrant integration test for org/account filtering and scoped deletion.
- Artifacts: Clara PR #298; ai-comms-agent PR #23. Both remain draft and unmerged.
- Verification: GitHub source edits only. No tests/typechecks/lint/build or live Qdrant requests were run in this work session; do not mark PASS.
- Security boundary: ISS-026 remains FIX-01-owned/open. Adapter remains unbound and outbox loop stopped.
- Next: run targeted worker/Clara tests and typechecks in a dependency-equipped environment; execute Qdrant integration test only against an explicit test endpoint. After FIX-01 closes ISS-026, bind adapter/outbox and implement shared authorized SQL + Qdrant retrieval. OPS-01 owns live ingestion/isolation/performance acceptance.
- Additional Clara review correction: deterministic point-ID and embedding-model hash inputs now use actual NUL separators rather than the two-character backslash-zero sequence, preventing ambiguous concatenation of identifier parts. This remains source-only and untested.

### DEV01-SHARED-EMAIL-HYBRID-RETRIEVAL-20261016

- **Task:** Implement the shared PostgreSQL + Clara/Qdrant retrieval core without bypassing ISS-026.
- **Changes:** Added `packages/db/src/email/hybrid-retrieval.ts`, `packages/db/src/email/clara-vector-search.ts`, package exports, and tests for grant scoping, final SQL revalidation, lexical fallback and Clara response filtering. Clara search hits now include contentHash; semantic-only candidates are checked against current PostgreSQL document hashes.
- **Files:** ai-comms-agent PR #23; Clara PR #298.
- **Verification:** Source edits only. Tests/typecheck/lint/build/live API/Qdrant were not run.
- **Boundary:** No transport wiring or worker outbox startup; ISS-026 remains open/FIX-01-owned. OPS-01 owns live Qdrant, ingestion, runtime isolation and performance acceptance.
- **Next:** focused review, then targeted tests/typechecks when dependency-equipped; after FIX-01 closes ISS-026, connect shared service to Chat + realtime voice and bind/start outbox.


## 2026-10-17 — Interactive chat tool loop and WhatsApp send approval

- Connected interactive chat to the host-authorized tool loop using server-derived tenant/user/role/permissions, per-agent tool allowlists, execution-time policy checks, bounded rounds/calls, and untrusted host context.
- Implemented WhatsApp pending send actions, approval queue/decision API and UI, Meta template submit/status refresh, supported text-body template send, and worker-time checks for the inbound 24-hour window, live template approval, connected account, and agent/account binding.
- Changed scheduled/product WhatsApp actions from direct queueing to pending human approval. Registered whatsapp.send only as an approval-proposal tool; it cannot queue directly.
- Added email.read / whatsapp.read / whatsapp.send feature permissions and RBAC coverage.
- **Verification:** Source only. Tests, typecheck, build, migration execution, browser flow, Meta API, provider send, and deployment were not run. No PASS claimed.
- **Next:** Focused test/typecheck; inspect web-to-worker import boundary; apply migrations; verify text-window and approved-template sends against Meta.
- **Session:** docs/project-control/sessions/DEV01-CHAT-WHATSAPP-TOOL-APPROVAL-20261017.md

### DEV01-LIVE-MODEL-CATALOG-20261018 / 2026-10-18
- **Task:** Replace manual/curated model inputs with Clara-style, vendor-live, provider/capability-filtered model dropdowns.
- **Authorization:** Owner's 2026-10-18 explicit product requirement; Phase 4 development-first instruction. DEV-01 scope.
- **Started from:** main `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`, branch `feature/dev01-live-provider-model-catalog-20261018`.
- **Actions:** Inspected Clara live-catalog implementation, existing org credentials/config and agent/runtime settings. Added secure tenant-scoped live list API; built reusable dropdown; connected organization provider setup, main Settings, runtime realtime model and six per-agent model fields; made TTS/STT independent; retired static endpoint; wrote mocked-fetch tests.
- **Files/code:** `apps/web/src/lib/ai/live-model-catalog.ts`, `apps/web/src/app/api/settings/ai-models/route.ts`, `apps/web/src/components/live-model-select.tsx`, `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`, `apps/web/src/app/settings/ai-provider-settings.tsx`, `apps/web/src/app/settings/ai-runtime-settings.tsx`, `apps/web/src/app/agents/[id]/agent-ai-settings-panel.tsx`, legacy config routes and targeted tests.
- **Evidence:** GitHub accepted commits on feature branch; source readback confirmed scope. Tests/typecheck/build/live provider and browser not executed. No runtime PASS or merge.
- **Blockers:** Missing vendor listing APIs for Sarvam voice, TEI, ElevenLabs realtime. Live credentials, build/deployment and end-to-end verification not available here. FIX-01 and OPS-01 retain their existing independent issues.
- **Lesson:** A selectable model list is only trustworthy if live, capability-filtered and obtained using credentials scoped to the authorized organization; a silently substituted static catalog is misleading. Keep credential-first setup and distinct TTS/STT IDs.
- **Next action:** Execute focused Vitest and web typecheck in a full checkout, then test real encrypted keys/catalogues and save/reload; request architect review, route deployment to OPS-01. Session: `docs/project-control/sessions/DEV01-LIVE-MODEL-CATALOG-20261018.md`.

### DEV01-LIVE-MODEL-VERIFY-20261018 / 2026-10-18
- **Task:** Continue owner-authorized live provider dropdown feature verification.
- **Authorization:** Owner follow-up "proceed" from DEV-01 NEXT_ACTION; PR #34 merged (do not treat prior unmerged description as authoritative).
- **Started from:** Main merge commit `5413468`, feature verification branch `feature/dev01-live-model-offline-verification-20261018`.
- **Actions:** Confirmed GitHub blob SHA of exact catalog source; locally typechecked isolated module; ran six provider behavior tests; performed 13 API/UI/source authorization assertions on current main; committed repeatable dependency-free Node test.
- **Files:** `apps/web/tests/live-model-catalog-standalone.test.mjs`; session + project-control records.
- **Evidence:** 6/6 Node mocked-vendor tests, 13/13 source assertions, exact module TypeScript standalone exit=0, local and committed test blob SHA `35e1521a0619430a784a351d42e400b08c13cf5d`.
- **Blockers:** No private checkout/pnpm due DNS, no live vendor keys/browser, Vercel build-rate-limit belongs OPS-01. Repository Vitest/typecheck/build and runtime checks remain NOT VERIFIED.
- **Lesson:** Verify exact Git object against tested bytes; executable adapter tests support limited claims, never full app/production acceptance. Record merge-state correction promptly when concurrent agents merge a PR.
- **Next action:** Run full focused Vitest and web typecheck/build in available checkout; validate org-scoped live APIs and UI save/reload; route OPS deployment and infrastructure separately.

### DEV01-MAIN-RUNTIME-MODEL-20261018 / 2026-10-18
- **Task:** Continue live provider model flow verification without another branch.
- **Authorization:** Owner explicitly directed all follow-up edits onto `main`.
- **Started from:** Existing merge of PR #35 at `e58c0bf3993e6480fdf586192adfed39b06a7b8b`.
- **Actions:** Confirmed both PRs merged, verified catalog tests, audited provider + runtime UI/API; found and corrected snake/camel hydration defect which could erase saved KB or prompt during model edits. Added pure mapper, Node and Vitest regression tests, and removed static initial realtime voice model default.
- **Commits direct main:** `ec06d126`, `dad58b5d`, `5076248d`, `040d5730`, `98116cbb`, `39bacaf1`.
- **Evidence:** Node mocked providers 6/6, Node runtime hydration 4/4, isolated tsc both modules PASS; hashes recorded in session.
- **Blocks:** Full pnpm tests/typecheck/Next build, browser/provider credentials and deployment remain UNVERIFIED; OPS-01 owns environment and Vercel build rate limit.
- **Lesson:** Backend GET may be camelCase while PUT accepts snake_case; normalize every editable value before saving and test that the KB ID/policy are retained. Do not mix per-feature bug fix with unrelated FIX-01 runtime work. Owner requested direct-main workflow.
- **Next:** Full web suite in equipped checkout on main and tenant-scoped real provider+UI smoke checks.

### DEV01-PROVIDER-SETUP-HARDENING-20261018 / 2026-10-18
- **Task:** Continue authorized core AI provider UX/correctness enhancements on `main`.
- **Authorization:** Owner "Please proceed", preserving previous explicit no-branch/direct-main instruction.
- **Started from:** main `2864975b32d79a61257b63806aff4031560258a9`.
- **Changes:** Switched both provider selectors to an API-key-clearing handler, validated DELETE and configuration reload responses before success, invalidated catalog after key deletion; added aggregate TTS/STT readiness indicator and tests. Commits: `f85a2240`, `f64222e1`, `6f4ae958`, `9b0a6262`, `2a295ae7`, `df55f31b`.
- **Evidence:** 6/6 Node vendor mocks, 4/4 runtime hydration, 5/5 provider-status tests, 3 pure-module isolated tsc checks, 5/5 GitHub source-contract assertions. SHA identity verified for new status helper/test. Node source-safety and Vitest tests created but not separately run.
- **Blockers:** No local full private repo or working pnpm npm registry; live vendor credentials/browser/OPS environment inaccessible; Vercel build-rate-limit separate. Nothing merged via branch.
- **Lesson:** A provider switch must discard unsaved vendor secrets; multi-purpose readiness requires all capabilities, not the first matching record; check HTTP status before success toast.
- **Next:** Full web Vitest/Next/typecheck and live UI provider settings flow in OPS-enabled checkout; resume approved email AI capabilities / RAG after security/Clara endpoint gates.

### DEV01-ORG-CREDENTIAL-ISOLATION-20261018 / 2026-10-18
- **Task:** Continue development verification and hardening directly on `main`, no branches/PRs per user.
- **Work:** Provider setup and old chat provider screen both retained a typed key and old configs across `organizationId` changes, and allowed save before new org configs loaded; async GET race could mix tenants. Added abort/cancellation, org-readiness gates, secret clearing, retry. Live model selector now rejects fulfilled stale responses after abort and clears loading when no org.
- **Commits:** `0fe7ce37`, `f5407bf1`, `c7ac01fb`, `74a2fcca`, `a28bf2d5`, `e0931386`, `a94705cf`. All directly on main.
- **ACTUAL TESTS:** existing local Node catalog 6/6, state 4/4, provider readiness 5/5 PASS (15 total); three pure-module isolated TS checks PASS; 12 authenticated GitHub source assertions PASS. New Node source-contract and Vitest tests committed but not executed locally.
- **Cannot claim:** Full pnpm install, web/worker typecheck/build, live app/browser, real provider keys, cross-tenant API integration, Vercel/deployment. Browser connector lacked originating browser context; no full checkout/working registry.
- **Next:** Full repo test/build then organization switch/cross-org live smoke; continue secure email tools and RAG behind FIX-01's runtime isolation and verified Clara API.

### DEV01-CLARA-VECTOR-BOUNDARY-20261018 — 2026-10-18
- **Authorized:** Continue approved RAG work on main only; no branches.
- **Code:** `packages/db/src/email/clara-vector-search.ts` invalid scope/query/limit rejection before sending service token, URL sanitizer and redirect:error; `apps/worker/src/knowledge/clara-email-vector-adapter.ts` symmetric URL/redirect restrictions. Added `packages/db/tests/clara-vector-search-standalone.test.mjs` and extended worker Vitest test.
- **Commits:** `b630da65`, `1203c374`, `b31b4db2`, `6c167816`, `3577fe79`.
- **Evidence:** 5/5 new exact-source Node tests and combined 20/20 Node pass; module-only TS check with declaration-only stubs passed. No full app build, worker Vitest, real Clara/Qdrant or browser test.
- **Source dependency:** Clara PR #298 merged into Vite-Converted (does not establish a live deployed endpoint). ISS-026 live endpoint denial checks still required; do not wire RAG outbox or expose semantic retrieval without those gates.
- **Next:** Execute dependency-equipped web/worker tests and builds, confirm Clara Qdrant and tenant filtering, then resume approved email/RAG integration. Do not claim production ready.

### DEV01-WORKER-VECTOR-TEST-COVERAGE-20261018 — 2026-10-18
- User direction: Proceed with web/worker verification then email RAG/tools; edit `main` only, no branch/PR.
- Found `apps/worker/src/knowledge/clara-email-vector-adapter.test.ts` was Vitest-only, worker package had no Vitest devDependency and its test runner only discovers `tests/*.test.ts`. Fixed by migrating coverage to `apps/worker/tests/clara-email-vector-adapter.test.ts` with `node:test`; removed old undiscovered suite. Also enforced nonblank/valid identities and SHA-256 content/metadata on worker privileged Clara API requests before network; added negative zero-I/O test.
- Source commits: `1513f237`, `6cdde3fe`, `8bc21242`, `dccd8a7f`, `247e5a6c`; no new branch. Local prior standalone Node modules pass 20/20 (actual command and exit 0), GitHub static source/runner checks pass 12/12. **New worker test not executed** without full checkout/pnpm; no full app or deployed checks.
- Next: OPS-enabled main checkout runs new worker adapter test, worker suite and typecheck/build, web test/typecheck/Next build, migration structure check; validate server-to-server Clara and tenant/account isolation before enabling RAG outbox. FIX-01 unrelated source incidents remain out of scope.

### DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018 — 2026-10-18
- User annotated two `/settings/ai-provider-setup` realtime screenshots; Sarvam `saaras:v3-realtime` and ElevenLabs old `elevenlabs-conversational` both gave unsupported live-list error with enabled API key. Existing main-only/no-branch instruction retained.
- Root cause `supportsLiveCatalog` excluded both realtime capabilities. Sarvam `/v2/models` only lists chat models; ElevenLabs live model list not a convai agent selection. Offered documented current *streaming STT* model choices with `source:documented` only behind authenticated enabled-key check; no fabricated live results. ElevenLabs conversational agent stays a separate future feature.
- Added model selection persistence in voice session, Sarvam relay honors selected supported model, resolver sanitizes unsupported labels, PUT rejects bad legacy ID; UX now describes relay mode. Added Node + Vitest/test assertions. Direct-main source commits documented in session `DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018`.
- Actual: updated catalog source and Node test hash-identical to GitHub; catalog 9/9, combined standalone 23/23, isolated TypeScript catalog PASS, GitHub integration/source checks 13/13 PASS. No web/worker full tests/build/migrations/browser/live API/deploy. Vercel build-rate-limit unresolved, OPS-01.
- Next: equipped checkout runs full focused suites, Next/worker build, migrations and authenticated browser/model-save/relay audio; do not claim user screenshot resolved on deployed site until OPS-01 deploys matching main and retests. FIX-01 unrelated incidents.

### DEV01-CHAT-FIRST-WORKSPACE-20261018 / 2026-10-18
- **Task:** Continue authorized product development from current GitHub state; Chat-first UI with voice inside Chat, top sidebar, expanded Mail, navbar alignment, HTML previews.
- **Authorization:** Current explicit owner requirements; direct `main` no-branch/no-PR preference; retained Phase 4 scope.
- **Initial head:** `9081fb89932e44eaa4b6cfb217b1ee1346ba0010` (independent OPS-01 changes already present; main advanced throughout).
- **Actions/files:** `app/page.tsx`, `app/overview/page.tsx`, `components/sidebar.tsx`, `components/top-bar.tsx`, `app/chat/chat-client.tsx`, `app/ai-voice/voice-workspace.tsx`, `app/mail/thread/[threadId]/thread-client.tsx`, `lib/email/html-preview-document.ts`, new tests `tests/chat-first-workspace.test.ts` and `tests/mail-html-preview.test.ts`. 2026-10-18 plan in `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md`.
- **Evidence:** 13/13 current GitHub source assertions PASS. New Vitest tests not run; full pnpm build/typecheck, browser, live provider, security, deployment unverified. User CI run `39079140157` is older SHA failure routed to OPS.
- **Known risk/handoff:** FIX-01 #36: `html_body_sanitized` may be assigned unsanitized provider HTML; no owner change, iframe defense in depth only. FIX-01 #26 owns voice end-state failures.
- **Lesson:** Chat is one screen with two modes; parent UI cannot directly unmount active media; nav left margin belongs to one layout component; mail HTML renders only in opaque CSP frame after server sanitation acceptance.
- **Next:** Focused Vitest + full web typecheck/build on current main, mobile/browser/voice/malicious HTML cases; improve remaining DEV-01 UX independently.

### DEV01-CHAT-FIRST-VOICE-MAIL-20261018 / 2026-10-18
- **Task/authorization:** User assigned DEV-01/Forge to redesign Chat as main, embed realtime Clara voice, reorder/default-expand Mail nav, fix navbar gap, improve HTML email preview using their Mailflow repo. Source directly on main, no branch/PR; Phase 4 authorized ongoing only.
- **Starting source:** main `9081fb89932e44eaa4b6cfb217b1ee1346ba0010`. Recovered architecture, phase, NEXT_ACTION, active sessions, issues, DECISIONS/ROADMAP, shared memory/events/handoff/backlog, local role memory/worklog. CI run 39079140157 failed on different earlier SHA; log unavailable, OPS ownership unchanged.
- **Actions:** Moved former `/` Overview to `/overview` and made `/` server Chat; sidebar Chat first, Mail expanded with Inbox/Drafts/Threads/Accounts, removed top-level voice menu; corrected duplicate navbar margin found and independently fixed by concurrent DEV-01 commit. Added lazy embedded VoiceWorkspace entry in Chat, initial agent propagation, return-to-chat, best-effort host/microphone teardown. Alias DB HTML body for tenant-scoped thread UI; reviewed Mailflow HTML frame + sanitizer; concurrent preview implementation uses opaque CSP iframe with Text/expand. Avoided overwriting concurrent editor and removed duplicated unused preview helper.
- **Security incident:** Identified raw provider HTML written to `html_body_sanitized` without observed allowlist; opened FIX-01 issue #36 and formal central handoff. No sanitizer implementation or migrations by DEV-01.
- **Files:** `apps/web/src/app/page.tsx`, `app/overview/page.tsx`, `components/sidebar.tsx`, `app/chat/chat-client.tsx`, `app/ai-voice/voice-workspace.tsx`, `packages/db/src/email/repository.ts`, `apps/web/tests/workspace-shell.test.ts`, `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`; preserve independently updated `components/top-bar.tsx`, mail HTML frame/helper/tests.
- **Evidence:** 14/14 actual current GitHub source checks PASS. New Vitest suite `workspace-shell.test.ts` authored, **NOT RUN**; no full Next/worker TS/build/browser/real provider/migration/deploy PASS. Session `docs/project-control/sessions/DEV01-CHAT-FIRST-VOICE-MAIL-20261018.md`.
- **Lesson:** One parent owns sidebar width/margin; avoid separate topbar offset. Treat streaming microphone transport as permissioned session and end on panel exit. HTML column naming is not a sanitizer. Re-check source SHA during concurrent main edits to avoid duplicate work.
- **Exact next:** Equipped main checkout executes `pnpm --filter @ai-comms-agent/web exec vitest run tests/workspace-shell.test.ts tests/mail-html-preview.test.ts`, web typecheck/build, worker tests/typecheck, migration chain structure; browser/mobile/voice/HTML/tenant-negative tests. Then build real `/mail/threads` list and focus/scroll polish. FIX-01 #36; OPS-01 CI/CD/deployment.

### DEV01-MAIL-THREADS-STREAMING-20261018 — 2026-10-18
- **Task:** Owner continued Chat-first redesign and specifically requested AI answers display incrementally in Chat and realtime voice; no branches/PRs, main only.
- **Actions:** Replaced /mail/threads placeholder with tenant-scoped PostgreSQL listing via `listMailThreadsForOrganization`, authorized no-store GET API, filters/search/unread/page/abort UX and direct open; fixed page to use established authenticated headers; Chat mobile and focus return. Added reusable SSE browser decoder and progressive Chat output status/delta/done; direct non-tool Chat stream avoids blocking tool-intent resolution; voice accept:SSE under same authenticated voice session returns actual Clara provider tokens for non-tool replies; legacy JSON and host-authorized email tool approvals retained. Gemini moved from blocking generateContent to SSE streamGenerateContent; OpenAI/Sarvam SSE EOF flush fixed. Added contract/Node tests and safe read-only model prompts.
- **Verification:** Exact Git hash identity SSE helper/test; Node test 5/5 PASS, isolated tsc PASS; 23/23 GitHub source invariants PASS. No full pnpm/Vitest/Next/DB/browser/providers or live audio tests.
- **Critical next limitation:** Tool-backed final answers still buffered; implement provider SSE tool completions without speculative response/action claims, then real provider + WebSocket/TTS QA. Existing FIX-01 #36 and voice defects, OPS-01 rollout unchanged.
- **Session:** `docs/project-control/sessions/DEV01-MAIL-THREADS-STREAMING-20261018.md`.

### DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018 — 2026-10-18
- Authorized: user explicitly requested continue of safe tool-backed Chat and Voice text streaming; direct main only/no branch. Read current NEXT_ACTION, previous DEV-01 session, role memory and existing Clara + host tool loops. Started `ba9e948b4b58a4f270d5382f919957843e6eecb5`.
- Implemented a read-only second model stream AFTER approved bounded host tool loop for safe successful read tools only. Trust comes from *registered* permission/sensitivity plus result.ok, zero pending Voice approvals, not provider tool call name. `streamCanonicalToolAnswer` uses org/agent provider config, no tool descriptions, bounded output; `emitVerifiedToolAnswer` prefix-gates each true provider token to exact canonical answer, one-chunk fallback on drift/error, abort suppresses completion. Sensitive/send/move/denied/noncomplete remain canonical. Worker email tool summary records readOnly; added worker test assertion, Vitest policy contract and eight Node tests.
- Test executed: Node 8/8 PASS on exact Git-hash verified sources, global tsc standalone PASS, 16 authenticated source contracts PASS. No full pnpm/Next/worker/browser/API/deployment, no production acceptance. Tool-call generation itself still non-streamed; extra provider call/cost possible, native tool-call SSE next.
- Session `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`; explicit commands `NEXT_ACTION.md`. FIX-01 #26/#36 unchanged, OPS-01 deployment unchanged.

### DEV01-VERIFIED-TOOL-ANSWER-STREAMING-FOLLOWUP — 2026-10-18
- User requested to continue prior DEV-01 work. No branches/PRs; only main.
- Completed abort signal routing for extra read-only post-tool provider stream all the way into OpenAI/Sarvam/Gemini HTTP fetch; source previously canceled readers on generator close but didn't abort pending HTTP when the client left. Added Chat/Voice request.signal into runtime method.
- Fail-closed approval-shaped results: even host-registered `safe` + `email.read`/`whatsapp.read` tool returns with `status:pending_approval` / `approval_required:true` cannot trigger extra model streaming. Added worker regression and web Vitest source assertions.
- Actual exact-Git pure-helper Node 8/8 and global tsc PASS, current GitHub source 12/12 checks PASS. New app tests and full pnpm TypeScript/Next/browser/provider **not run**, no prod deploy.
- Follow-up session `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`; exact next actions in `NEXT_ACTION.md`. FIX-01/OPS-01 boundaries preserved.

### DEV01-NATIVE-TOOL-SSE-20261018 — 2026-10-18
- **Owner:** "Please continue where you left." Resume after prior verified read-only tool-answer stream work, direct main/no PR. Current earlier follow-up already had cancel and approval safeguards; did not overwrite them.
- **Source:** Built `packages/clara-core/src/tool-call-stream.ts` for fragmented OpenAI SSE tool calls and `gemini-tool-stream.ts` for Gemini streaming functionCall; strict completion/arguments/limits and host-before-execution separation. Updated Clara provider adapters to request genuine streamed tool calls, keeping existing JSON compatibility and Sarvam unsupported. Wired package Node test script, authored 19 standalone regression tests and 4 worker mock integration cases, hardened null SSE events/unique Gemini IDs/cancellation.
- **Tests executed:** Exact committed source/test Git hash match; combined Node 19/19 PASS, strict/noUncheckedIndexedAccess standalone tsc PASS. Full private monorepo pnpm/worker/Next/db CI and browser/live credentials/deploy NOT run due no checkout/pnpm/GitHub shell DNS. Source-level checks confirmed Chat/Voice still use trusted host executors.
- **Next:** Execute full Clara/worker/web/DB test+typecheck/build; fix failures; replace verified-copy second provider turn with direct streaming final response after validated tool results and test authorization, abort and provider errors. FIX-01/OPS-01 boundaries unchanged.
- **Session:** `docs/project-control/sessions/DEV01-NATIVE-TOOL-SSE-20261018.md`.

### DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018
- **Task:** Resume previous milestone from current main; native final streamed model text after host-authorized tool results, no additional verbatim-copy request. Main-only no branches/PRs. Recovered repo NEXT_ACTION, prior session, live runtime/host loops, tests.
- **Code:** Added `packages/clara-core/src/tool-result-final.ts`, runtime `streamAuthorizedReadOnlyToolAnswer`, Chat and Email Agent callbacks after 1–4 successful server-registered, audited, approval-free read-only calls; Voice SSE calls same provider-native stream. Bounded data and original request in untrusted prompt, no available tool actions in second pass. Preserved denied/approval/write/multi-round paths and old JSON clients. Tightened unsupported tool-provider fallback to **before** host execution.
- **Tests:** Added Node pure builder test and updated Vitest and worker regressed paths (worker tests not run). First source-exact Node 5/6 identified reuse of already consumed tool ID; corrected with `seen` lifetime set; rerun exact SHA-matched test **7/7 PASS**; isolated strict TS on builder **PASS**; 18/18 GitHub source invariants PASS before final hardening. Full monorepo tests/build/browser/providers not runnable here without checkout/pnpm/session, no false pass claim.
- **Next exact commands and acceptance:** `docs/project-control/sessions/DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018.md`; run full Clara/web/worker/db suite/typechecks/Next build/migration structural test on latest main, validate account/agent isolation, multi-read costs, approved/denied outcomes, live provider SSE/Voice/TTS, crash and abort. FIX-01/OPS-01 scopes respected.

### DEV01-CATCHUP-ROUTINES-20261018 — 2026-10-18
- **Request:** Recover current repository as DEV-01; plan real-world personal catch-up, scheduling/automation, WhatsApp digests and friendly UX, with phase-by-phase implementation/test checklists.
- **Baseline:** Fast-forwarded existing checkout to main ba9e948b; preserved direct-main/no-new-branch instruction. Recovered architecture/authority, phase 4, NEXT_ACTION, sessions, issues/handoffs and role/shared memory.
- **Work:** One design and two implementation plans in docs/superpowers; source audit and two independent read-only reviews; recorded owner-selected scoped one-time approval as proposed policy. Refined source/read/review coverage, late mail, evidence, grant administration, templates, DST/quiet-hours, submission races and UI harness. No product code, migrations, live routines or sends changed.
- **Evidence:** Frozen dependency install, six-package typecheck, production web build, SSE 5/5, web 25/25, scheduling/automation 11/11; 41 focused checks total. Full suite, database, authenticated browser, provider and deployment not run.
- **Routing:** New scheduler reliability and automation tenancy/trigger defects to FIX-01; isolated runtime/provider evidence to OPS-01. Existing ISS-026/#36/#26/ISS-037 retained under their owners.
- **Lessons:** Separate personal review from routine coverage; cached summaries require fresh all-source authorization; tested source presence is not runtime delivery. General WhatsApp approval stays unchanged until reviewed narrow grant implementation.
- **Exact next:** Review linked design/plans, then Catch-up C1 access/storage tests and contracts with flags off. Recheck main/migration allocation. Preserve independent native tool-streaming continuation; no repeated CI polling. Detailed session: sessions/DEV01-CATCHUP-ROUTINES-20261018.md.

#### DEV01-CATCHUP-ROUTINES-20261018 — concurrent integration and final evidence
- Integrated upstream native tool/final streaming changes through 959ff5a6 and retained both agents' additions in eight documentation conflicts. No product source edited. Earlier streaming-unimplemented statements are historical.
- Re-executed current-source checks: all typechecks/web build PASS; web31 + worker23 + Node13 + Clara24 passed = 91 passed, Clara1 failed. Not full-suite/live acceptance. Final-prompt helper unit probes accept completed ID reuse and result-name mismatch; concrete FIX-01 handoff recorded without weakening tests or taking the fix role.
- Both plan reviews have no remaining blocking design contradictions. Link/fence/secret-pattern/scope/whitespace checks passed. Local documentation commit only; no push/deployment. Exact next stays owner/architect review then Catch-up C1, with independent work preserved.

## 2026-10-19 — C1 private catch-up

Implemented C1; session `sessions/DEV01-CATCHUP-C1-20261018.md` records evidence and limits. Next: C2 stable manifests/coverage. Read authorization must revalidate evidence IDs/revisions as well as top-level sources; forward only allowed output fields. Prove audit atomicity with forced failure, not only successful audit rows. Multiple permissive RLS policies combine with OR: private content needs restrictive isolation plus trusted application predicates. Strict real PostgreSQL migration execution and structural checker results are separate evidence. Never equate focused green checks with full-suite acceptance.

### DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019
- **Task:** User shared organization-scoped `provider_configuration_required` response for ElevenLabs TTS/STT model catalog, with exposed session cookie. Advised user to invalidate/sign out; never read/use/store cookie.
- **Source trace:** `getDecryptedProviderConfig(organizationId,provider,purpose)` looks up exact purpose; Realtime key and TTS/STT are distinct encrypted rows. 409 before vendor call; no production DB knowledge, no provider API test.
- **Code direct main only:** New opt-in reuse endpoint with `organization.update` and decryptability check; atomic ciphertext copy to missing enabled TTS/STT without overwriting existing keys/model or disabled target; audit event, no secret returned. Provider config UI loads Realtime metadata in Voice Chat, shows purpose-specific readiness, prompts explicit confirmation and reload; catalog error messages distinguish disabled, absent, unreadable and reusable states. Fixed `hasApiKey` mapping when reading encrypted key. Added Vitest source contract suite.
- **Verification:** 29/29 GitHub source-contract checks PASS. New Vitest not executed; no complete pnpm install, Next/worker/Clara/db typecheck/test/build, Postgres, browser or ElevenLabs credentials. Vercel HEAD still build-rate-limit, OPS-01.
- **Lesson:** An enabled provider credential for one purpose does not authorize automatic reuse in another; prefer explicit authorized opt-in with non-overwrite semantics, no plaintext network response, and distinguish key absent/disabled/decryption failure.
- **Next:** Run full tests/build and real provider acceptance after OPS-01 authorized deploy, then user can verify in Voice Chat tab; maintain FIX-01/OPS-01 role boundaries. Session `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019.md`.

### DEV01-EXPLICIT-DATE-MAIL-20261019 / 2026-10-19
- **Task:** Continue owner-authorized DEV-01 product feature after FIX-01 24h mail summary was made source-accurate; next limitation was arbitrary date ranges/semantic analysis/fresh sync.
- **Started from:** main `a02fa371446fda90151b170e95385a9f5fa1853e`, read NEXT_ACTION and FIX-01 regression/source, role-local project context.
- **Source:** `apps/web/src/lib/mail/explicit-date-range.ts` new strict UTC ISO two-date parser; Chat route integrated with exact existing email.read + agent enabled list/search registry and agent-email-account primary/read_only SQL; rejects invalid input 422, preserves original rolling-24h route; optional formatter label; new Node/Vitest tests and updated prior source test.
- **Evidence:** Reproduced exact GitHub blobs in isolated local test tree: SHA `979dd2cca7e26bcc255e7c66a5566ada3b529d72` (new helper), `d5e23f8649e5a1820bfd3db85ace0393108b576c` (formatter), Node tests `46f0cf9fdbb3492619a529b78160fdfea9c5647a` / `bd9cffc8264c11be06d495dc3dba024b21935494`. Executed 16/16 Node PASS, isolated tsc PASS, 19/19 source checks. Found and fixed a literal escaped newline that would have commented out a required object field before final tests.
- **Blockers:** No pnpm/private repo full checkout/database/browser/vendor credentials; full Vitest/Next/Clara/worker, migration/provider sync/live tenant negative & deployment not done. Vercel status unchanged by this source work.
- **Lesson:** Explicit date constraints must be validated before model history, bounded, and never silently broadened; inclusive calendar end needs next-midnight exclusive SQL for PostgreSQL microsecond precision. Test new functionality against old incident regression after refactoring shared code. Do not use exposed credentials; owner revoke/rotate.
- **Next action:** Full commands and tests in `docs/project-control/sessions/DEV01-EXPLICIT-DATE-MAIL-20261019.md`. Follow with evidence-grounded semantic grouping/accurate sync status, keep FIX/OPS owners separate.

### DEV01-ELEVENLABS-STT-CATALOG-20261019
- **Task:** Continue main-only DEV-01 after reported ElevenLabs organization-scoped TTS/STT `provider_configuration_required` responses.
- **Baseline:** main `b207f06a082de4f6790d47af5685e13bb51c2219`. Recovered latest C1/C2 NEXT_ACTION (C2 is primary next), old credential-reuse implementation/session, catalog, UI and tests; vendor docs for TTS `/v1/models`, batch STT `scribe_v2`, realtime STT `scribe_v2_realtime`.
- **Fix:** ElevenLabs general model list now treated as TTS-only live; batch STT offered honestly as vendor-documented source after exact org enabled credential gate. Selector rejects unexpected documented source/capability. UI distinguishes TTS live, STT documented, user-approved per-purpose key reuse. Existing key handling untouched, no credentials copied, no production changes.
- **Verification:** 15/15 current GitHub source contracts PASS; full suite/build and real provider/browser NOT RUN. User pasted a live-looking cookie, instructed revocation, never pasted into code or replayed. Direct commits on main, no branch/PR.
- **Lesson:** A per-purpose 409 is local configuration, not provider outage. ElevenLabs vendor `/v1/models` is not a trustworthy account-specific STT listing; batch Scribe and realtime Scribe are distinct. Credential metadata/migration must be explicit, never silent.
- **Next:** On equipped main run focused model-catalog Node/Vitest, web typecheck/build, worker/Clara/DB verification, then authorized ElevenLabs real TTS/STT calls, tenant negatives and browser save/reload; OPS deployment only after verified release. Primary project next is C2 catch-up immutable manifests and stable selection with tests, not expanding vendor key access.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-STT-CATALOG-20261019.md`.

### DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019 — 2026-10-19
- Explicit owner continuation to fix ElevenLabs TTS/STT credential purpose and model-list errors. Started main `a7baa7fe9a4c276120b43102b2ea7d69c38e6209`, recovered current C1 catch-up NEXT_ACTION (independent agent work) and prior ElevenLabs purpose-reuse session. Did not recreate existing secure reuse mechanism, change branch or deploy.
- Implemented credential preflight before first Voice Chat PUT (both purposes must have saved key or one supplied new key); server requires actual saved purpose-specific secret for `keepExistingKey`; preserves Realtime metadata when Save/Remove reloads settings without altering source secret. API authorization unchanged.
- Tests: added Node regression `apps/web/tests/elevenlabs-voice-save-validation.test.mjs` (10 cases including API/UI source contracts). Actually ran 8 pure behavioral test scenarios using byte-identical helper Git blob SHA `5ff3d09e82186e0161807ade6d995bf54b9a1bd1` and isolated TS noEmit; 8/8 PASS. Github 10/10 source conditions PASS; full repo Node suite/Vitest/build/migrations/browser/provider/deploy NOT RUN.
- Security: user's historical browser cURL included active session cookie: never copy or use; recommended revocation. No credentials handled. Next: full tests/build plus fresh-credential browser verification, then OPS deploy and live ElevenLabs TTS/STT models. Limit: sequential PUT network failures still can partly save; future atomic backend can address. FIX-01 owns unrelated voice/runtime defects.
- Session: `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019.md`.

### DEV01-ELEVENLABS-TTS-STT-CATALOG-RECOVERY-20261019 — 2026-10-19
- Owner supplied production 409 `provider_configuration_required` for ElevenLabs TTS and STT models and requested direct-main GitHub fix; request included a session cookie, deliberately NEVER used, logged or copied; advise revoke.
- Source diagnosis: model GET requires enabled encrypted credential separately for the requested TTS/STT purpose; an enabled Realtime credential does not implicitly satisfy either. Current main already had admin-confirmed, audited, same-org Realtime→missing TTS/STT credential reuse. Missing UX was actionable recovery at exact failing model dropdown.
- Implemented restricted `modelCatalogRecovery` helper, explicit actionable reuse button for eligible TTS/STT 409 after server authorization and abort guard, distinct no-source and encryption warnings, wired both pickers to existing confirmed/reload handler. No automatic credential copying or bypass of disabled target accounts.
- Isolated exact-Git-SHA helper behavioral Node **8/8 PASS** and isolated TypeScript noEmit PASS; 15/15 current GitHub source checks PASS. Whole new regression suite, full monorepo Vitest/typecheck/Next/worker/DB, provider/browser/deploy NOT RUN.
- Session `docs/project-control/sessions/DEV01-ELEVENLABS-TTS-STT-CATALOG-RECOVERY-20261019.md`. Next equipped current-main tests then OPS-01 deployed-SHA + credential recovery validation after new login, FIX-01 unrelated source incidents.

### OWNER-OPERATOR-MIGRATION-SCRIPT-20261019
- **Authorization:** Explicit user request to prepare and commit migration scripts; existing main-only/no-branch/PR rule.
- **Task boundary:** Prepared source and tests for OPS-01 operator deployment; **did not run migrations or assume OPS-01's host/credential role**.
- **Starting main:** `0f514b1d628b6a313237ade662ed211156d17c49`.
- **Actions:** Added `scripts/operator-migrate.sh` (`plan|apply|verify`, Compose internal DNS, project-root `.env`, explicit backup/DB/allow-fresh safety flags), `packages/db/operator-migration-core.mjs` and `operator-migration-check.mjs` (ledger SHA256 drift, unknown version, live current_database, public shadow ledger guard), Node and Bash offline tests and copyable runbook. Reused existing forward-only migration runner without altering old migrations or copying encrypted AI keys.
- **Evidence:** 17/17 fresh GitHub source-contract assertions PASSED; new executable tests authored **NOT RUN**; no live DB, backup, Docker, pnpm build, provider or deployment check.
- **Lesson:** A missing provider-purpose credential is not schema drift; no SQL migration should copy encrypted keys without explicit authenticated org-admin consent. Existing manual startup may continue after a failed migration, so use a separate fail-closed, verified operator command before deploy.
- **Next action:** OPS-01/user builds current main image, runs offline tests, plan, backup/restore-test, apply with --expect-db and --backup-confirmed, verify, then separately deploys. See `docs/runbooks/OPERATOR-MIGRATION-20261019.md` and session.

## 2026-10-19 — DEV01-CATCHUP-C2-20261019

C2 complete locally, final merge/push receipt in session.34SQL,25domain,37web,3integrity checks pass; typechecks/build pass. Preserve source/review scoping and UUID cursor UI compatibility. Claim canonical sources, reauthorize scheduled mutations, retain precise server boundaries and compare manifest provenance counts. Prior C1 support sessions finished; independent C2 reviewer complete, FIX-01 compatibility/security support complete, OPS-01 restore/read-only incident assessment complete. No hidden active implementer task remains. Next C3 orchestration/grounding and C4 browser acceptance; security incident and broader suites retain role owners.

### DEV01-OPERATOR-TEST-TRIAGE-20261019
- Recovered actual operator one-shot output after owner pasted it (main `6fdeb5a3`), keeping source-scope boundaries: 29/29 operator, migration structure, Docker web cached build, 6 TypeScript and 26/26 Clara Core tests pass; web Vitest unhandled `EAI_AGAIN eth-mainnet.public.blastapi.io`; worker killed after parallel failure. No DB migration or deployment.
- Located real DEV-01 source defect in Clara vector adapter: control-character regex `/[\\u0000-\\u001f\\u007f]/` was accidentally double-escaped, so ordinary org/account/message IDs failed. Replaced with `/[\u0000-\u001f\u007f]/`, added actual NUL/DEL/newline negative tests. Fixed separate outdated keyword SQL contract assertion `$4`→`$3`, matching Clara runtime and not changing production query.
- Direct main source commits `013a230c`, `05ace89c`, `cd0590f3`, `77aadf38`; no branch/PR. Actual JS regex evaluated against normal/control inputs plus source/test contract checks 6/6 PASS. Full worker/web suite after fix NOT run; no operator container access. OPS-01 issue #38 raised for external DNS and parallel failure, with exact safe isolated commands. Phase 4 not accepted.
- Next: capture OPS-isolated tests, fix any actual own-scope failures, then proceed with independent AI/chat/voice product work. Session `docs/project-control/sessions/DEV01-OPERATOR-TEST-TRIAGE-20261019.md`.

### DEV01-MIGRATION-FRESH-TARGET-SAFETY-20261019 — 2026-10-19
- **Task/authorization:** Owner asked to create migration script committed to GitHub and said continue. Existing scripts were already delivered on main; user will perform deployment/migration. Developer source safety hardening only, no OPS role takeover.
- **Started:** main `72732585895e44e8cac32b5fbc8146253dec4a5f`; recovered operator `NEXT_ACTION`, verification, migration scripts and current host failures.
- **Implementation:** Added `assertFreshDatabaseEmpty(hasUserRelations)` to operator core (accept exact `false` only); `preflight --allow-fresh` now queries `pg_catalog.pg_class`/namespaces, excluding system/extension objects and migration ledger, to reject any occupied user schema before an unledgered fresh apply. Regression assertions added to Node tests; updated runbook. No schema SQL changed.
- **Verification:** Actual GitHub source checks 18/18 passed. Full Node suites, Docker/TypeScript builds, live PostgreSQL, backups or production migration NOT performed.
- **Lesson:** Absence of an application migration ledger does not imply the database is empty: previous partially auto-committed DDL may exist. `--allow-fresh` must prove emptiness and remain behind independently backed-up operator approval. Application provider-configuration errors cannot be fixed simply by migrating unrelated SQL.
- **Next:** OPS-01/equipped operator reruns all named tests and static migration structure, builds source, resolves issue #38 blocking offline full tests; then explicit read-only `plan`, DB name confirm, backup+restore test, `apply`, `verify` per runbook. No branch/PR.


## 2026-10-19 — owner-requested commit and recovery checkpoint

Preserved concurrent main changes and both sides of eight documentation conflicts. Current status: C1/C2 focused implementation done; C3 integration then C4 browser acceptance next. Security and broad-suite follow-up remain FIX-01/OPS-01. See docs/project-control/sessions/DEV01-CURRENT-HANDOFF-20261019.md. Lesson: after a rejected push, inspect and integrate current upstream; never overwrite shared project memory or force push.


## 2026-10-20 — C3 checkpoint
- Start `16d3fb6f`; source `7da1d2b5`; documentation `0370395c`.
- Added `apps/worker/src/briefings/briefing-worker.ts`, six-test `apps/worker/tests/briefing-worker.test.ts` on main; no branch/PR.
- Actual tests: NOT RUN (connector-only editing). No source loader, Clara model binding, worker scheduling, browser acceptance or production actions.
- Next: build canonical read-only source loader and Clara adaptation, test provider/network and recovery cases, run worker test and typecheck then gate registration.
- Session `../../sessions/DEV01-C3-WORKER-CORE-20261020.md`.


## 2026-10-20 — DEV-01 C3 continued, code committed
Start `23ceb97637e47b9326cb2df181f3c1f9208a6fbf`. Commits `1bae80c8` (canonical source + Clara adapter, 8 cases), `8f382ead` (provider retry, 2 cases), `464ab70d` (mixed invalid candidate prevents coverage, 1 case). No branches/PR/migrations/deploy. 11/11 static source checks PASS, no actual Node/tsc/browser/DB tests. Exact next: run 3 focused worker test files and worker/db/Clara typechecks on prepared host; fix failures, test grant revocation and restart, add safely disabled registration. Session `../../sessions/DEV01-C3-CANONICAL-CLARA-20261020.md`.


## 2026-10-20 — C3 test evidence and multi-mailbox fix
- Started `main` `202b58633d81a42c48ad97239406e5796cdd6d19`; owner-supplied focused host tests 27/27 passed (SHA not shown).
- Found false-denial for full-manifest grant fingerprint when a bounded batch covers a mailbox subset. Fixed canonical loader and added two focused regression tests, commit `f036d6bf434ee710aaa7e53d2444c18fa74bcb62` on main; no branch/PR/migrations/activation.
- Verification: code-path assertions only for fix; 29 post-fix tests, typechecks and disposable-db test NOT RUN.
- Next: run focused tests + four package typechecks, fix failures and validate multi-mailbox/revocation on disposable PostgreSQL before disabled-by-default registration; then C4 browser.
- Record `../../sessions/DEV01-C3-MULTI-MAILBOX-BATCH-SCOPE-20261020.md`.


## 2026-10-20 — verified host gate / disposable DB acceptance harness
- Host pulled main to `daa89ffd`, reported **29/29** C3 focused Node tests PASS and four package TypeScript checks PASS; no compile output errors; pnpm native binary fallback warning only.
- Audited existing migration/schema plus strict local DB harness; authored `packages/db/tests/briefing-c3-canonical.integration.test.mjs` with five fixture subtests covering full multi-mailbox grants, C2 batch subset, user/tenant boundaries, post-claim revoke, stale content and lease fencing. Code commit `4cda8ee5` directly on main; no branch/PR.
- **New DB tests NOT RUN** in connector-only development. Feature still OFF, no migrations/deploy/real provider sends.
- Next: host run DB guarded fixture, repair failures, then full suites and disabled-by-default worker registration; C4 browser afterward.
- Session `../../sessions/DEV01-C3-HOST-VERIFIED-DB-GATE-20261020.md`.

## DEV01-EMAIL-COMMAND-CENTER-R1A-20261020 / 2026-10-20
- **Invocation:** Owner requested independent DEV-01 product work continuing current main; human-first 5-day mail catch-up, priority views, assistant-managed schedules/automations and consented WhatsApp digests. Superpowers-style task decomposition followed; standalone Superpowers subagent skill not installed.
- **Recovery:** Current Phase 4; read CHAT_CONTINUITY/NEXT_ACTION/architecture, C3 session, DEV-01 memory/worklog, shared lessons, existing catch-up/routines Superpowers design/plans, runtime types and scheduler. Separate FIX-01/OPS-01 work preserved.
- **Implementation:** Added seven schedule preview Node tests (commit `2b2342f3`); typed RoutineTrigger/preview contracts (`7b4a0d96`); pure UTC/zone/DST aware `nextRoutineOccurrences` (`9eb4edc0`); shared/runtime/package exports (`68f7a6af`, `7dd59584`, `7daccec7`); UX/roadmap extension (`e3a3a12b`).
- **Evidence:** GitHub current-source inspection 10/10 targeted source invariants. **NOT RUN:** new Node tests, typechecks, runtime/browser/DB/provider; no features, routines, sends, migrations or worker enabled. Prior 29/29 C3 host and 6/6 DB receipts refer to older SHAs.
- **Lessons:** User-facing visit is not review coverage; local 09:00 differs from elapsed 24h at DST; external digest = scoped personal-data export; proposed product ideas do not automatically change authorization.
- **Blockers/dependencies:** C3 broader acceptance and registration; FIX-01 source/runtime scheduler and tenant proofs, older worker/web failures; OPS-01 test host/CI/migrations/provider/WhatsApp/build-hook response.
- **Session:** `../../sessions/DEV01-EMAIL-COMMAND-CENTER-R1A-20261020.md`.
- **Next:** Execute `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`; shared and email-agent-runtime typechecks on current main; then continue C3 grounding/worker acceptance and C4 authenticated UX. Keep R1/R3/R4 disabled until relevant gates are verified, while drafting R1b bounded proposal contracts independently.


## DEV01-EMAIL-COMMAND-CENTER-R1B-PLAN-20261020 — 2026-10-20
- **Role/instruction:** DEV-01 / Forge, owner-directed direct `main` continuation; personalized five-day email catch-up, evidence-backed importance, assistant-proposed schedules/automations and optional explicitly scoped WhatsApp digests. No takeover of FIX-01 or OPS-01.
- **Read/reconciled:** Live GitHub `main` at `36384bb0cb37202ff708cf9bfc48359ecc7c6075`; AGENTS/CHAT_CONTINUITY/NEXT_ACTION/phase/verification/role-local and shared memory/sessions/backlog, 2026-10-18 catch-up/routines Superpowers design/plans, 2026-10-20 UX supplement and R1a current code. Confirmed actual migration filename tip `0052_briefing_selection_coverage.sql`.
- **Work:** Wrote *proposed* explicit test-first R1b implementation plan `docs/superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md` (commit `7a6bc740de05fb1f0b4939068d9ee047330945e0`) and full session `docs/project-control/sessions/DEV01-EMAIL-COMMAND-CENTER-R1B-PLAN-20261020.md` (commit `44b13bf33cc27f6b78622c5d20dd3338e56d0584`). Updated newest `NEXT_ACTION.md` `9ddcf7a0` and DEV-01 role memory. Plan includes current code interfaces, confirmation/idempotency/tenant negative cases, feature-off implementation, UX and future R3/R4/R5 dependencies.
- **Verified:** GitHub source reads, current code/contract presence, occupied migration numbers and plan files accepted by GitHub. No test runner or local repository checkout. A shell `git ls-remote` failed due to `github.com` DNS resolution; `pnpm` missing.
- **NOT RUN:** R1a Node tests and typechecks, C3 current-tip/full suites and isolated DB, new R1b TDD tests, UX browser tests, provider/sends/migrations/CI/Vercel. No working feature activated and no new production source code in this slice. Prior 29/29 focused and 6/6 DB receipts are not new-tip evidence.
- **Dependencies:** Existing reviewed-design/authorization review for R1b DB and confirmation, FIX-01 scheduler/tenant proof and independent broad failures, OPS-01 test host/production migrations/Meta credentials/template and unresolved build-hook exposure response.
- **Next exact action:** Run `cd apps/worker && node --import tsx --test tests/routine-time.test.ts` and two root package typechecks on equipped sanitized current `main`; record SHA+output; then review R1b and implement only approved RED→GREEN pure proposal slice, while independently proceeding with C3 source-retry/grounding acceptance and C4 later.


## DEV01-R1B-INERT-PROPOSALS-20261021 — 2026-10-21

- **Invocation:** Owner: "Please proceed with next items from your side. Let me know what things has from my side to do!" As DEV-01 / Forge, continued direct `main` approved R1b Task 1 pure proposal/preview work; did not assume approval for proposal DB persistence or WhatsApp standing delivery.
- **Starting current main:** `45ef5a825a9a094e9e75a16b84c30e6887f42cf9`; 18 newer upstream commits from the prior session were inspected by GitHub compare. Their files did not overlap the routine proposal files.
- **Implementation:** New inert routine proposal types, strict recursive allowlist/UUID/time-zone/language/limits/trigger/WhatsApp-template validation, normalized change-sensitive SHA-256 configuration hash, preview-only response using the existing R1a time engine. Regression tests cover 8 behaviors. Exported shared/runtime API. Commits `99e6435d`, `e00f6cb6`, `8a9b6286`, `78e32f45`, `15a50a44`, `d0088c77`, `205023f4`.
- **Local verification:** Standalone Node v22 proposal test suite first failed **0/8** against missing implementation, then **8/8** passed against local source copy and simplified clock fixture. Targeted stand-alone `tsc --noEmit` returned 0 with matching local shared/node declaration shims. **NOT RUN:** exact repository `tsx` test, real seven-case R1a DST suite, full package TypeScript, C3 latest DB/source worker tests, web/browser/provider/delivery/infrastructure. This is a bounded local signal, **not** a current-tip repo test PASS. The shell cannot clone GitHub (DNS failure) and has no pnpm.
- **Safety:** No trusted actor or mailbox rights inferred from client IDs, no scheduler registration, no DB schema or migration, no new tool registration, no feature flags enabled, no WhatsApp message or external service operation.
- **Session:** `docs/project-control/sessions/DEV01-R1B-INERT-PROPOSALS-20261021.md`; `NEXT_ACTION.md` latest checkpoint. Older 29/29 C3 and 6/6 DB host receipts are SHA-specific.
- **Next:** Equip sanitized checkout, run two focused worker test files and shared/email-runtime/worker typechecks with exact tested SHA; fix owned findings; continue independent C3 fail/retry and C4 acceptance; R1b Task 2 database/confirmation, R3/R4 live activation require explicit scope consent and OPS/FIX proof.


### DEV01-CHAT-EMAIL-APPROVAL-PRESETS-20261022 — 2026-10-22
- **Owner scope:** DEV-01 product UX and authorized host tool integration on `Development`, starting SHA `4be377ec`, no branch/PR/CI wait; recovered shared AGENT_MEMORY, central agent records, DEV role-local context, NEXT_ACTION, issues, phases, and chat/voice/email source.
- **Problem:** Sarvam chat live allegedly says text-only and returns copyable email prose; earlier FIX-01 adapter fix is Development-only and production not verified. Users also had to toggle each email policy individually, and the chat view had no reliable saved-draft/approval confirmation surface.
- **Implementation:** Same-org assigned connected primary mailboxes only; authenticated chat mail-compose GET/POST invokes existing registered and audited `email.draft.create`/`email.send.request` with actor email.write + agent policy + mailbox/provider requirements; explicit separate draft save and human-approval request, idempotent per saved draft; no direct send/approval. Bounded owner-phrase recognition opens review-only composer; admin-only policy GET + in-chat quick preset/individual checkboxes and full-policy save confirmation, preserving advanced rules/custom grants; detailed policy shortcut and agent-scoped chat deep links. Existing voice/realtime host routing retained; voice tool definitions filtered by actual actor permissions; voice-to-chat draft-review link available when inactive.
- **Test/evidence:** New Node source tests for 4 presets, intent phrases, same-tenant compose/no-send, voice handoff and approval idempotency; augmented email-agent-loop regression. Mirrored pure helper tests 4/4 PASS and two standalone TS checks exit 0; fresh GitHub source-contract checks 20/20 PASS. Exact repo Node/Vitest/TypeScript/DB/provider/browser, Sarvam-live and production mail send NOT RUN (GitHub DNS and pnpm unavailable in runner). No actual email drafted, approved or delivered by this session.
- **Status:** SOURCE IMPLEMENTED, RUNTIME ACCEPTANCE OPEN. OPS-01 separately confirms deployed SHA, credentials/bindings/actor grants and provider-draft→pending_approval→explicit approval→worker send. DEV-01 next fixes actual repo test/type errors if an equipped checkout reports them; do not expand or activate C3/routines. Root worklog has full source/path/evidence.
