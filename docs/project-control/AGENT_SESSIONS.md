# APCP Central Agent Sessions

Central index of autonomous agent sessions. Each agent also maintains its own role-local WORKLOG.md and MEMORY.md.

## Why this exists

A fresh chat may invoke any agent at any time. The next agent must be able to discover that another agent was active, what it was doing, what it left pending, and what lessons were learned without reopening the old chat.

## Session entry

### <SESSION-ID> — <YYYY-MM-DD>
- **Agent:** <DEV-01 | FIX-01 | OPS-01 | WORK-01>
- **Invocation:** <prompt/task summary>
- **Started from:** <commit/ref>
- **Scope:** <authorized task or safe maintenance task>
- **Status:** <ACTIVE | PAUSED | HANDOFF | COMPLETE | BLOCKED>
- **Completed:** <summary>
- **Pending:** <exact remaining work>
- **Blockers:** <none or durable blocker>
- **Handoff:** <AGENT_HANDOFF entry or none>
- **Next action:** <exact next action>

## Concurrency rule

Multiple sessions may be ACTIVE simultaneously. Session records are coordination evidence only; they do not grant authorization and do not require another agent to stop.


### FIX01-MAIL-TENANT-20261009 — 2026-10-09
- **Agent:** FIX-01 / Sentinel
- **Invocation:** Diagnose and fix the user's `/api/email-accounts` 403 `not_member` response.
- **Started from:** `main` after audit migration 0024 source correction.
- **Scope:** Root-cause diagnosis, minimal source fix, regression test, project-control records.
- **Status:** HANDOFF
- **Completed:** Found that `/mail/accounts` chose `getDevOrgId()`; changed it to use the authenticated active organization and added a static test.
- **Pending:** User/runtime deployment must pull latest main, apply migration 0024, and retry with a fresh session. No runtime PASS claimed.
- **Blockers:** Runtime access and deployment confirmation are external to this source correction.
- **Handoff:** ISS-009 / EVT-FIX01-MAIL-TENANT-20261009.
- **Next action:** Follow `docs/project-control/NEXT_ACTION.md`; do not weaken membership authorization.


### DEV01-GMAIL-OAUTH-SETTINGS-20261009 — 2026-10-09
- **Agent:** DEV-01 / Forge
- **Invocation:** Replace environment-bound Gmail OAuth with platform-managed multiple client configurations.
- **Started from:** main during user-reported provider_configuration_required response.
- **Scope:** Migration, authenticated settings API/UI, OAuth start/callback, worker refresh credentials, regression test and control records.
- **Status:** HANDOFF
- **Completed:** Added organization-scoped OAuth client storage, encrypted secret CRUD, UI configuration, per-connection client selection, callback use of the saved client, and encrypted account-level client credentials for worker refresh.
- **Pending:** Pull main; run manual deployment migration chain through 0026; configure OAuth client(s); register callback URI in Google Cloud Console; test end-to-end.
- **Blockers:** Live runtime and Google OAuth credentials are user-operated; no runtime PASS claimed.
- **Handoff:** ISS-010 / EVT-DEV01-GMAIL-OAUTH-20261009.
- **Next action:** Follow NEXT_ACTION.md; keep CREDENTIALS_MASTER_KEY server-only and never return client secrets to the browser.


## 2026-10-09 — Dynamic OAuth callback + Zoho client settings
- Read project-control continuity and NEXT_ACTION before editing.
- Completed source changes on main for request-derived Gmail/Zoho callbacks and multi-client Zoho OAuth management, including encrypted secrets and worker refresh credentials.
- Added migration 0027 and source-level regression tests. Tests/build/typecheck/live migration and provider flows were not run.
- Important operator constraint: current raw HTTP private IP cannot be used as the public OAuth callback. Use an HTTPS DNS domain; Google additionally rejects raw IP hosts. Exact callback URI must be registered in the provider console.
- Next action remains deployment/configuration and end-to-end testing; see NEXT_ACTION.md.


### DEV01-DRAFT-SEARCH-20261009 — 2026-10-09
- **Agent:** DEV-01 / Forge
- **Invocation:** Recover repository state and continue the next authorized product-development action.
- **Started from:** `main` before commit `8ccf1cb24039cb3bc745a51576a73ee68007e946`.
- **Scope:** Continue connected-mailbox/Mail vertical slice; improve persisted draft discoverability; route unrelated defects to owning agents.
- **Status:** ACTIVE
- **Completed:** Added search to persisted Drafts UI across subject, body, recipients, and mailbox address; added a no-results state. Commit: `8ccf1cb24039cb3bc745a51576a73ee68007e946`.
- **Pending:** Verify provider-synced drafts appear in the persisted list and continue Zoho/IMAP ingestion plus authorized agent-tool wiring.
- **Blockers:** Tests and live provider verification were not run. Drafts page organization context and Inbox SQL search placeholders are routed to FIX-01.
- **Handoff:** BKL-008 / EVT-DEV01-MAIL-ROUTING-20261009.
- **Next action:** Trace provider sync persistence for Zoho and IMAP/SMTP and connect persisted mail/drafts to authorized agent tools; do not wait for CI/Vercel.

### FIX01-GMAIL-SYNC-20261009 — 2026-10-09
- **Agent:** FIX-01 / Sentinel
- **Invocation:** Fix OAuth-connected Gmail accounts stuck at Pending with no initial synchronization; ensure Gmail messages and drafts become available to the platform.
- **Started from:** main after user-reported persisted account status Pending and last sync Not synchronized.
- **Scope:** Trace callback → account persistence → worker lifecycle → Gmail adapter → persisted messages/drafts → mailbox UI; implement the missing sync lifecycle and regression coverage.
- **Status:** HANDOFF
- **Completed:** Added a PostgreSQL-backed Gmail sync worker loop and worker lifecycle wiring; paginated initial import; incremental history cursor and expired-cursor recovery; encrypted access-token refresh persistence; OAuth refresh-token preservation; idempotent email/thread persistence; HTML-only text extraction; imported Gmail draft resource mapping; protected manual sync endpoint and UI action; automatic status polling; authenticated organization context for drafts/compose; source regression tests and project-control updates.
- **Pending:** Deploy/rebuild web and worker from latest main, apply migrations through 0028, verify Gmail account transitions to Connected and last_synced_at is populated, confirm inbox and drafts data, inspect worker errors if it does not sync. No tests/build/migration/live provider verification was run here.
- **Blockers:** Live host and Google mailbox are not directly accessible in this source-edit session.
- **Handoff:** ISS-012.
- **Next action:** Follow docs/project-control/NEXT_ACTION.md; after runtime confirmation, continue Zoho/IMAP sync and connect persisted email data to authorized agent tools.


### DEV01-CHAT-EMAIL-CONTEXT-20261009 — 2026-10-09
- **Agent:** DEV-01 / Forge
- **Task:** Continue connected-mailbox vertical slice and determine whether Clara chat can access synced email.
- **Finding:** The chat route called Clara's chat runtime but did not load local email records or expose the host email-read tool. Provider sync worker is Gmail-only; Zoho `sync()` and IMAP/SMTP `sync()` currently return empty result sets, and IMAP message methods are placeholders.
- **Implemented:** Chat now loads up to 20 recent/saved draft records from PostgreSQL for email-related prompts, only where both message and account organization IDs match the authorized organization and account is connected. Email content is marked untrusted. Commits `b9db5774a5b8c2177e606298804d4e1704b75d53`, `f12fee359d0de340209ae6733e02825c136364a3`, `7a7d4e659b7b312753f2a23896d14929b608b525`, `9c8d53d3bd8df37328a04623a72d9a5d162b1f74`, `38d0d94b477c2918e733d86d0474dd8090c824f6`, `d5c7cc145fee4fdce477294c93025e8d7edd41ad`, `a2b4c28b167aba222ace0995b294b99f267e2407`, `5c84fd4bd105586ed26272168fdee68b999ae94c`.
- **Test contract:** Added static chat context assertions in `apps/web/tests/mail-draft-action-contract.test.ts`, commit `93d353864256a49368ecaf4354aec0bfffb05889`.
- **Not verified:** Test execution, typecheck/build, live chat turn, live mailbox connection/sync. Runtime acceptance remains pending.
- **Next:** Complete real Zoho full/incremental sync, IMAP UID-based sync/parser and SMTP draft/send implementation; generalize worker safely across providers; then wire an authorized email.read/draft tool into Clara chat rather than relying solely on preloaded context. FIX-01 retains BKL-008.

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
- **Task:** Correct source-level defects found while reviewing the focused Zoho/IMAP test targets.
- **Implemented:** Zoho provider draft updates now call the API instead of throwing; IMAP per-folder checkpoints survive bounded initial import continuations; SMTP AUTH PLAIN uses NUL-delimited credentials.
- **Commits:** `72f05f5f642beea07cc5543fbc744051a083f922`, `5d2c3f3bcbab6698a56449afda407921c05b7760`.
- **Verification:** Attempted local checkout, but pnpm is unavailable and github.com DNS resolution fails in this environment. No focused test or typecheck result is available; no PASS claimed.
- **Next:** Run the focused tests and worker/web typechecks in a dependency-equipped environment, then continue real-server and provider→PostgreSQL→Clara acceptance. Redis, RabbitMQ, and Qdrant email indexing remain incomplete at application level. FIX-01 owns BKL-008; OPS-01 owns production infrastructure/deployment.

- **Additional IMAP correction:** Stable thread IDs now use the oldest/root References identifier, then Message-ID, then folder/UID; parser regression assertion added. Commits `e21fd2fad824a41180deb6cf89b4f7aafb051f7c`, `d5dbd54cb7cb7b224d39b9b4e836b62501c575d3`. Tests remain unexecuted.


### DEV01-FOCUSED-TEST-REVIEW-20261009 — 2026-10-09
- **Task:** Review focused Zoho/IMAP test targets and correct deterministic source defects before runtime verification.
- **Changes:** Fixed Zoho mock setup so tests cover the adapter's actual account discovery endpoint; corrected IMAP LIST command CRLF/mailbox quoting; aligned Zoho capability metadata with its bounded incremental refresh.
- **Commits:** `f04eb93d27ee01934970e64679be381d6dec6500`, `fe3e2d39157f74c66741772966125cfee81055a1`, `5a59ec5745f8d3a3f735220f9496e14c79dece22` (intermediate IMAP source correction commits `2146facf04762ffd07fbd1458ad5a9f4256cf56`, `2f5b63e1a65b6aded5b602c0f439c689cd49c45f`).
- **Verification:** No test/typecheck command ran. These are source-review corrections, not passing-test evidence. Real-server and deployed DB/chat acceptance remain unavailable in this source-edit session.
- **Next:** Run focused Zoho/IMAP tests and worker/web typechecks in a dependency-equipped environment, then continue email-to-PostgreSQL-to-Clara verification and infrastructure integrations. FIX-01 owns BKL-008; OPS-01 owns production infrastructure/deployment.


### DEV01-IMAP-LITERAL-20261009 / 2026-10-09
- **Role:** DEV-01 / Forge
- **Change:** Added octet-counted IMAP literal consumption in the low-level socket reader; LIST and command loops now read literal-aware logical responses. Per-literal safety cap is 50 MiB.
- **Commit:** `f7df46f3d0d90bf1c0aae3407b448bd83aeca855`
- **Verification:** Source accepted by GitHub only. Tests/typechecks and real-server acceptance remain pending; no CI/Vercel waiting was performed.
- **Remaining:** Build a fake IMAP server regression suite for fragmented/multiple literals and CRLF-containing message content; validate against real IMAP servers. Continue RAG indexing, Redis-backed use case, and RabbitMQ durable sync queue separately.


### DEV01-IMAP-LITERAL-TESTS-20261009 / 2026-10-09
- **Change:** Added literal framing regression tests for CRLF-containing body payloads, multiple literals, preservation of the tagged completion response, and oversized literal rejection.
- **Commits:** `d4a5c6589f2e28a00277a725cf6c628ea8b56eb5`, `b20c6423c6ded123a49ff6301a40de6385832a26`.
- **Evidence:** Source and test files were accepted by GitHub; no tests/typechecks were run in this environment.
- **Next:** Execute focused tests and typechecks without waiting for CI/Vercel, then continue provider-to-PostgreSQL-to-Clara Chat acceptance and infrastructure integrations.


### FIX01-WORKER-CREDENTIALS-20261009 — 2026-10-09
- **Agent:** FIX-01 / Sentinel
- **Invocation:** Correct Docker worker build TypeScript errors in mailbox-sync-worker.ts.
- **Started from:** GitHub main; user-provided Docker build log.
- **Scope:** Root-cause diagnosis, smallest corrective source change, regression protection, durable control records.
- **Status:** HANDOFF
- **Completed:** Aligned Gmail credential snapshot with EmailCredentials; converted it to a plain persistence record at the repository boundary; added a focused Gmail snapshot test and control records.
- **Pending:** Execute the focused test and worker typecheck/build. No successful build is claimed.
- **Blockers:** No pnpm/TypeScript/Docker execution was available in this session.
- **Handoff:** ISS-013 / EVT-FIX01-WORKER-CREDENTIALS-20261009.
- **Next action:** Run the focused Gmail adapter test and worker build. Route any remaining Docker, dependency, or deployment-environment defect to OPS-01; do not wait for DEV-01.


### DEV01-REDIS-MAILBOX-LEASE-20261009 / 2026-10-09
- Added Redis-backed distributed mailbox batch coordination when REDIS_URL is configured. The lease uses SET NX PX, a random owner token, 10-minute TTL, and compare-and-delete Lua release; configured Redis outages skip the batch with an error log, while no REDIS_URL preserves PostgreSQL claim behavior.
- Commits: d7228495f5bd03483154ac194cba865fbf3b00e5, 0e10e647b029ea065b467e120180248e1eb1b27d, bd6368d7f56f39660cf28b913026fcb8fd0a0004.
- Verification: source only. No tests, typechecks, or live Redis checks run. Continue RAG boundary and RabbitMQ durable queue implementation without waiting for CI/Vercel.
