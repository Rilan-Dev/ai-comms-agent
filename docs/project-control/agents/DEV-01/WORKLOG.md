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
