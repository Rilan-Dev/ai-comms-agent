# APCP Central Agent Backlog

Cross-agent coordination backlog. This records ownership and dependencies; it does not authorize implementation.

## Entry format

### <BACKLOG-ID> — <YYYY-MM-DD>
- **Work:** <task>
- **Owner:** <DEV-01 | FIX-01 | OPS-01 | WORK-01>
- **State:** <READY | ACTIVE | BLOCKED | ROUTED | DONE | SUPERSEDED>
- **Dependency:** <none or exact dependency>
- **Authorization:** <authorization reference>
- **Suggested next action:** <concrete action>
- **Related session/event/handoff:** <ids>

## Routing rule

If a task belongs to another agent, create or update a backlog entry and continue independent work. Do not poll repeatedly for the dependency.

### BKL-007 — 2026-10-09
- **Work:** Diagnose and correct live `/login?reason=not_provisioned` loop at `100.72.192.28:3300`
- **Owner:** OPS-01
- **State:** ROUTED
- **Dependency:** Access to the live self-hosted runtime/container and its runtime environment/database connection
- **Authorization:** User-explicit FIX-01 bug-remediation request; OPS-01 must independently confirm runtime/deployment scope
- **Suggested next action:** Verify running source/build revision, auth cookie/session state, `DATABASE_URL` consistency, active session, and active organization membership. Rebuild/restart only if stale runtime code is confirmed; otherwise repair the concrete runtime/config/data defect without weakening authentication.
- **Related session/event/handoff:** FIX-01/Sentinel; EVT-FIX01-AUTH-20261009; HOF-FIX01-OPS-AUTH-20261009; ISS-007

### BKL-007-FIX — Authentication false-success loop
- Owner: FIX-01 / Sentinel
- State: SOURCE_FIXED
- Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`
- The login boundary now refuses to create sessions for accounts lacking an active organization membership, eliminating the success → `not_provisioned` redirect loop. Runtime deployment/verification remains with OPS-01.


### BKL-008 — Mail tenant-context and inbox search query defects
- **Work:** Inspect and correct the Drafts server page's use of `getDevOrgId()` instead of authenticated organization context; inspect Inbox repository SQL parameter placeholders and add regression coverage.
- **Owner:** FIX-01 / Sentinel
- **State:** ROUTED
- **Dependency:** None for source diagnosis; runtime verification remains separate.
- **Authorization:** Existing product security requirements and explicit instruction to route substantial bugs to FIX-01.
- **Suggested next action:** Trace `/mail/drafts` organization resolution and `listInboxMessages()` SQL; preserve fail-closed organization authorization, correct confirmed defects, and add targeted tests.
- **Related session/event/handoff:** DEV01-DRAFT-SEARCH-20261009; EVT-DEV01-MAIL-ROUTING-20261009.

### BKL-009 — Worker credential snapshot build failure
- **Work:** Execute the focused regression test and worker typecheck/build after the snapshot contract fix.
- **Owner:** FIX-01 / Sentinel for source; OPS-01 for remaining Docker/dependency/environment defects.
- **State:** ACTIVE
- **Dependency:** Dependency-equipped environment to run pnpm commands.
- **Authorization:** User-explicit FIX-01 bug-remediation request.
- **Suggested next action:** Run Gmail adapter regression and worker build; record actual output in VERIFICATION_STATE.md. Do not claim success from source commits alone.
- **Related records:** FIX01-WORKER-CREDENTIALS-20261009; EVT-FIX01-WORKER-CREDENTIALS-20261009; ISS-013.


### BKL-010 — Zoho OAuth settings test parser failure
- **Work:** Execute post-fix web typecheck and focused Zoho OAuth settings test.
- **Owner:** FIX-01 / Sentinel for source defect; OPS-01 only for any separate infrastructure/CI/deployment failure.
- **State:** ASSERTIONS_CORRECTED_FOCUSED_RERUN_PENDING
- **Symptom/history:** Original TS1127/TS1434 parser error is corrected in `39857c40820940b500dcf452331dfe82ae35b861`. User's latest `pnpm run typecheck` passes all workspaces; focused test reported 8 passed / 2 failed because of stale expectations.
- **Latest test-only correction:** `c58d6d442767f471c694ef978fdb06eca6d29850`.
- **Next action:** Rerun `pnpm --filter @ai-comms-agent/web exec vitest run tests/zoho-oauth-settings.test.ts`; then update verification from actual output.
- **Related:** ISS-014; EVT-FIX01-ZOHO-TEST-NEWLINES-20261009.

### BKL-011 — Live database schema reconciliation and Redis lease rejection
- **Work:** Apply migration `0029_runtime_schema_reconciliation.sql` to the exact production database, roll out matching web/worker images, and diagnose the specific Redis error reply.
- **Owner:** OPS-01 / Shipwright for live database/container/configuration actions; FIX-01 / Sentinel for source defects uncovered.
- **State:** ROUTED
- **Dependency:** Authorized access to the live self-hosted containers and runtime environment.
- **Authorization:** User-supplied live runtime logs and active FIX-01 incident.
- **Suggested next action:** Pull latest `main`; apply migrations through `0029` using the repository migration procedure; verify web and worker share the intended PostgreSQL endpoint; rebuild/restart both images; inspect the Redis error after the diagnostic patch. Fix AUTH/ACL/TLS/URL as evidenced. Do not disable lease locking or force unsafe concurrent polling.
- **Related records:** ISS-015; FIX-01 worklog entry dated 2026-10-09.

### BKL-012 — 2026-10-09
- **Work:** Correct Mail Approvals organization context. The server page previously called `ensureDevSeed()` and `getDevOrgId()`; it now resolves `getAuthenticatedAppContext()` from request headers and redirects unauthenticated users to login.
- **Owner:** FIX-01 / Sentinel (source correction applied during cross-route review)
- **State:** SOURCE FIX COMMITTED; regression source added; runtime verification pending
- **Source commit:** `19b8c0fd`; regression assertion update `da2502bd`.
- **Dependency:** Runtime verification is separate; no API-side permission checks were weakened.
- **Authorization:** Existing product security/tenant-isolation requirements and DEV-01 source discovery while executing the authorized UI migration.
- **Next action:** Run focused web tests/typecheck when convenient and verify with a user belonging to a non-development organization. Do not weaken authorization.
- **Related session/event/handoff:** DEV01-LOVABLE-UI-MIGRATION-20261009; `apps/web/src/app/mail/approvals/page.tsx`.

### BKL-013 — Live inbox schema and Redis authentication (2026-10-09)
- **Work:** Apply schema reconciliation migrations through `0030`, correct Redis WRONGPASS, deploy matching web/worker source, and verify imported email rows appear in the inbox.
- **Owner:** OPS-01 / Shipwright for runtime, DB, container and secret configuration; FIX-01 / Sentinel for source fixes.
- **State:** ROUTED
- **Dependency:** Access to the self-hosted database, Docker environment, and Redis ACL/user configuration.
- **Authorization:** User supplied live error logs and reported missing inbox results.
- **Suggested next action:** Check which DB the web/worker containers use; apply migrations `0029` and `0030`; compare the configured `REDIS_URL` username/password with the Redis ACL/user configuration without printing secrets; rebuild/restart web and worker; trigger sync and confirm message row counts and inbox query.
- **Safety:** Do not disable Redis lease acquisition or claim sync completion from HTTP queue acceptance.

### BKL-014 — Repair malformed pnpm lockfile
- **Work:** Verify the corrected single-document `pnpm-lock.yaml` installs frozen and allows workspace typecheck.
- **Owner:** FIX-01 / Sentinel
- **State:** SOURCE_CORRECTED; LOCAL_RERUN_PENDING
- **Symptom:** User's typecheck command failed during pnpm dependency resolution with missing lockfile entry for `amqplib@2.2.0`.
- **Fix commit:** `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`; removed the stray first YAML document and restored the worker dependency package/snapshot records.
- **Next action:** Pull latest `main`; run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`. Record actual output. No typecheck PASS claimed until rerun.
- **Related:** ISS-017; FIX01-PNPM-LOCKFILE-20261009.

### BKL-014 follow-up — 2026-10-09
- **Work:** Guard against recurrence of the malformed pnpm lockfile / missing `amqplib@2.2.0` dependency graph.
- **Owner:** FIX-01 / Sentinel
- **State:** SOURCE_CORRECTED; LOCAL_RERUN_PENDING
- **Dependency:** A local environment with the repository-pinned pnpm package manager for frozen install and test execution.
- **Authorization:** User-explicit FIX-01 request for minimal correction and regression protection.
- **Suggested next action:** Pull latest main; run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`. If the install succeeds but Docker fails for host/network/base-image reasons, route that separate failure to OPS-01.
- **Related:** ISS-017; FIX01-PNPM-LOCKFILE-REGRESSION-20261009; commits `27f04065`, `b9ba0c67`.

### BKL-014 follow-up — tarball integrity
- **Update:** User's frozen install found a second lockfile defect after the missing dependency records were repaired: `amqplib@2.2.0` had no SRI integrity field.
- **Owner:** FIX-01 / Sentinel
- **State:** SOURCE_CORRECTED; LOCAL_RERUN_PENDING
- **Commits:** lockfile `644d5781`; focused regression assertion `d115e1b0`.
- **Next action:** Pull latest main, run `pnpm install --frozen-lockfile`, then workspace typecheck and focused lockfile Vitest. Preserve supply-chain integrity checks.

### BKL-015 — Worker RabbitMQ URL type and stale migration test paths
- **Owner:** FIX-01 / Sentinel
- **State:** SOURCE_CORRECTED; LOCAL_RERUN_PENDING
- **Evidence:** User's frozen install passed; workspace typecheck reported TS2345 at email-sync-rabbitmq.ts:165 and worker SIGKILL; focused migration Vitest failed before test collection because it referenced removed migration filenames.
- **Fix commits:** 09e4df46, a24edec3, ffc98b30.
- **Next action:** Run focused migration Vitest and worker RabbitMQ contract test; then web and worker typechecks sequentially. Full workspace typecheck afterward if resources allow.
- **Related:** ISS-018; FIX01-WORKER-TYPECHECK-MIGRATION-PATHS-20261009.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


### BKL-016 — Web typecheck: missing Lucide dependency and strict focus/test errors
- Owner: FIX-01 / Sentinel.
- State: SOURCE_CORRECTED; LOCAL_RERUN_PENDING.
- Evidence: User-reported web typecheck has TS2307 for lucide-react, TS18048 in Agent Detail and sidebar focus traps, and TS2304 for the missing newAgentPage test source.
- Correction commits: 8f09785a (web dependency), 7b1136e6 (lockfile), 3e35c1f5 and a9dcb8e5 (focus typing), 52a4e348 (test binding).
- Next action: Pull latest main; frozen install; run focused web migration and worker RabbitMQ tests; run web and worker typechecks sequentially. Record actual results; no source-only PASS claim.

### BKL-EMAIL-OPS-01 — Complete email operations and shared AI tool harness
- **Scope:** Deliver reliable Gmail/Zoho/IMAP-SMTP sync and complete authorized email operations through one host-owned AI tool catalogue shared across chat, realtime voice, WhatsApp and schedules.
- **Owner:** DEV-01 / Forge for approved product implementation; FIX-01 for substantial source bugs/regressions; OPS-01 for live runtime, deployment and infrastructure.
- **State:** PLAN_PREPARED; OWNER_REVIEW_REQUIRED before material implementation.
- **Plan:** `docs/plans/EMAIL-OPS-01-IMPLEMENTATION-PLAN.md`.
- **Initial slices proposed:** E1 Gmail incremental-sync correctness; E3 host-owned email tool catalogue/authorization inventory; sequence and contracts to be confirmed after source inventory.
- **Known dependencies:** current schema/cursor inventory; current tool registry/runtime route inventory; existing OAuth scopes; provider capability tests; execution-time organization/agent/account grants; current RabbitMQ/Redis live incident.
- **Acceptance outline:** resumable/idempotent sync with durable cursors and correct delta reconciliation; complete tested capability matrix; modular provider mappers/parsers/services; one channel-independent tool path; sensitive actions require deterministic policy/approval; cross-tenant and prompt-injection regression coverage; separate source and runtime verification records.
- **Safety:** This backlog entry and plan do not authorize schema, dependency, OAuth-scope, architecture or policy changes by themselves. Do not disable Redis lease coordination or claim sync success from HTTP 202.


### BKL-EMAIL-OPS-RUNTIME-01 — 2026-10-13
- **Work:** Connect email tool descriptors to executable host handlers and the shared registry.
- **Owner:** DEV-01 / Forge.
- **State:** PARTIALLY IMPLEMENTED — shared runtime factory exists; channel integration pending.
- **Authorization:** User instructed DEV-01 to proceed after the EMAIL-OPS-01 plan.
- **Dependency:** Resolve current authenticated organization context, agent-to-account binding, policy engine and audit repository before wiring tool handlers.
- **Progress:** Shared registry, schema validator, read-only email handlers, invocation pipeline, agent-scoped runtime factory, provider tool-call adapter (OpenAI-compatible/Gemini only), and bounded worker loop are source-implemented. Source tests exist but are not run. The loop is not wired to any transport. Source tests now cover provider contracts, loop bounds, and executor audit/denial paths, but have not been run.
- **Next:** Run the newly added mocked provider contract/worker-loop tests and typechecks. Then wire through a trusted server transport only after FIX-01 resolves ISS-026. Keep contract-only tools unavailable; add sensitive actions only through approval policy.

- **Safety:** Contract descriptors must remain unavailable to the model until executable handlers and runtime checks exist. OPS-01 and FIX-01 retain their own responsibilities.


### FIX01-HANDOFF-ISS-026 — Cross-agent email context isolation
- **Owner:** FIX-01 / Sentinel.
- **Severity:** Critical.
- **Source:** `apps/web/src/app/api/chat/stream/route.ts` — `loadEmailContext` scopes by organization but not by active agent's `agent_email_accounts` bindings.
- **Required work:** Pass the authenticated agent ID into the loader, restrict context rows to that agent's permitted account bindings/roles, and add cross-agent/cross-account regression tests. Preserve untrusted-email-content wrapping.
- **DEV-01 boundary:** This is a substantial security bug and remains FIX-01-owned; do not duplicate its remediation in the email-tool feature branch.


### BKL-FIX01-WORKER-CREDENTIAL-TYPE-20261016 — 2026-10-16
- **Work:** Re-run worker typecheck/build and targeted Gmail History/IMAP IDLE tests after credential discriminant correction.
- **Owner:** FIX-01
- **State:** READY
- **Dependency:** Access to the deployment checkout or CI runner for execution evidence; no dependency on DEV-01.
- **Authorization:** User-explicit FIX-01 root-cause and smallest corrective change request dated 2026-10-16.
- **Suggested next action:** Execute worker typecheck/tests, then rebuild Docker worker. Route only environment/compose/deployment failures to OPS-01.
- **Related session/event/handoff:** `FIX01-WORKER-CREDENTIAL-TYPE-20261016`, `EVT-FIX01-WORKER-CREDENTIAL-TYPE-20261016`


### BKL-DEV01-EMAIL-RAG-HYBRID-20261016 — Email RAG hybrid retrieval
- **Owner:** DEV-01 / Forge
- **Status:** BLOCKED_ON_ARCHITECTURE_AND_SECURITY_CONTRACT
- **Priority:** High
- **Request:** Accurate, low-latency email search and summaries across Chat and realtime voice, supporting relative/absolute time ranges, exact sender/subject/business/topic queries, thread summaries, and source-backed answers.
- **Current evidence:** Review plan `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md` (commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`).
- **Blockers:** ISS-026 is open and FIX-01-owned; no supported concrete Clara server-to-server email vector adapter is bound; the outbox sync loop is not started in worker entrypoint; architecture approval/correction is needed before material retrieval/vector changes.
- **Next:** Approve/correct the hybrid design, establish allowed-account retrieval contract with FIX-01, inspect the current Clara RAG adapter source-of-truth, then wire vector sync and shared retrieval behind that contract.
- **Acceptance:** Exact date/count/latest queries use authoritative SQL; semantic queries use mandatory org + allowed-account vector filters plus final SQL revalidation; Chat and realtime voice share one authorized retrieval service; indexing is idempotent and deletion-safe; citations/freshness are explicit; regression coverage proves cross-account denial; measured p50/p95/recall/freshness benchmark before any 10x claim.


### BKL-DEV01-EMAIL-RAG-ADAPTER-20261016 — Supported Clara email-vector API
- **Owner:** DEV-01 / Forge for source integration; OPS-01 for live runtime/ingestion/performance.
- **Status:** API_DRAFT_PR_OPEN; UNBOUND_ADAPTER_AUTHORED; BLOCKED_ON_ISS-026_AND_EXECUTABLE_VERIFICATION
- **Finding:** Explicit user authorization received. Clara API draft is implemented on `feature/email-vector-api` and proposed in [PR #298](https://github.com/Rilan-Dev/Clara-AI-Platform/pull/298). It has not been merged or executable-verified.
- **Contract:** Clara `docs/plans/EMAIL-VECTOR-API-CONTRACT.md`; authenticated POST `/api/internal/email-vectors`; deterministic IDs; upsert/reindex and stale cleanup; metadata-only update; message/account/org purge; semantic search with mandatory org + explicit allowed-account filters.
- **Security:** API service credential does not replace mailbox grant checks. ISS-026 remains open/FIX-01-owned. Do not bind the outbox or expose Chat/voice retrieval until ISS-026 closes.
- **Adapter:** `apps/worker/src/knowledge/clara-email-vector-adapter.ts` and request-contract tests are authored but unbound; worker startup does not import the adapter or start the outbox loop.
- **Next:** Run focused worker adapter tests/typecheck and Clara typecheck/tests/lint/build plus Qdrant integration coverage when a dependency-equipped checkout is available. After ISS-026 closes, bind adapter + outbox loop and shared PostgreSQL/Qdrant retrieval. OPS-01 handles live runtime/ingestion/latency acceptance.
- **Retrieval implementation update (2026-10-16):** shared service now authored at `packages/db/src/email/hybrid-retrieval.ts`; Clara search client at `packages/db/src/email/clara-vector-search.ts`; source tests added. It is not yet connected to Chat/voice and is not runtime-verified. ISS-026 remains a hard gate for transport wiring and outbox activation.

### BKL-FIX01-CHAT-PROVIDER-20261017
- **Work:** Verify live chat provider resolution after source fix for agent-specific Sarvam/Gemini configuration.
- **Owner:** OPS-01
- **State:** ROUTED
- **Dependency:** Access to the actual deployed revision and tenant-scoped database metadata for organization runtime settings, agent override, and provider configuration.
- **Authorization:** User-explicit FIX-01 incident investigation and corrective change.
- **Suggested next action:** Deploy/restart revision containing `8d7aecc` via the existing manual procedure; inspect sanitized provider metadata and verify one chat turn selects Sarvam. Do not print secrets or add OpenAI credentials as workaround.
- **Related session/event/handoff:** `SESSION-FIX01-CHAT-PROVIDER-20261017`; `EVT-FIX01-CHAT-PROVIDER-OVERRIDE-20261017`; `HOF-FIX01-OPS-CHAT-PROVIDER-OVERRIDE-20261017`.


### BKL-OPS01-HOST-PNPM-20261018
- **Work:** Triage native host shell missing pnpm command.
- **Owner:** OPS-01 / Shipwright
- **State:** ROUTED
- **Evidence:** `pnpm: command not found` in host shell; user Docker build's Corepack/pnpm stage ran and worker target built.
- **Scope:** Toolchain/environment setup only; no app source or lockfile changes unless separately authorized and evidenced as required.
- **Related handoff:** `HOF-FIX01-OPS-HOST-PNPM-20261018`.


### BKL-FIX01-WHATSAPP-TEMPLATE-ROW-20261018
- **Work:** Verify the strict-nullability correction for the WhatsApp approved-template sync row.
- **Owner:** FIX-01 / Sentinel
- **State:** ACTIVE — source corrected; post-fix verification pending
- **Dependency:** Updated main checkout and Docker build/test output.
- **Authorization:** User-supplied production-build error and explicit FIX-01 instructions.
- **Correction commits:** `90fac5e0774b695446e1e0c3ab51072639ba5f06`; `41734923651b1173a703d747f0ac0aa93317a5b9`.
- **Next action:** Pull latest main; rerun `bash scripts/update-and-up.sh`; if build passes, run focused `whatsapp-send-approval.test.ts`. Do not claim PASS until observed.
- **Related issue/session/event:** ISS-031; FIX01-WHATSAPP-TEMPLATE-ROW-20261018; EVT-FIX01-WHATSAPP-TEMPLATE-ROW-20261018.

### BKL-DEV01-ELEVENAGENTS-NATIVE-CONVERSATION-20261018 — Native ElevenLabs Conversational AI agent integration
- **Work:** Optional separate feature to expose user-owned ElevenAgents via authenticated `GET /v1/convai/agents`, select an `agent_id`, obtain a scoped signed conversation WebSocket URL and bridge only authorized turns/actions into host policy. This is NOT `scribe_v2_realtime` STT/TTS host relay.
- **Owner:** DEV-01 for future authorized source design; FIX-01 for existing realtime voice bug remediation; OPS-01 for provider/live credentials and deployment.
- **State:** NOT IMPLEMENTED — DESIGN/OWNER REVIEW REQUIRED. The annotated `/settings/ai-provider-setup` selector fix covers the currently executable ElevenLabs Scribe realtime STT + host-authorized Clara/TTS pipeline only. Legacy `elevenlabs-conversational` is not a runnable model ID and is rejected on new realtime model saves.
- **Prerequisites:** Owner approves separate conversation-agent mode; assess security/approval/agent-account tool boundaries; confirm ElevenLabs API permissions and signed URL lifecycle, transport teardown/interruption, tenant-scoped agent IDs and session policy.
- **Next:** Do not pretend to support ElevenAgents by inserting a fake model into `/v1/models`. If full native feature authorized, add a separate agent resource selector and transport tests, then real-provider verification.
- **Related:** `docs/project-control/sessions/DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018.md`.


### BKL-OPS01-MIGRATION-IN-CONTAINER-20261018 — Run migrations on the Compose network
- **Work:** Correct host-side migration DNS failure while preserving internal container-to-container PostgreSQL routing.
- **Owner:** OPS-01 / Shipwright
- **State:** OPEN — handoff from FIX-01; no source change by FIX-01
- **Authorization:** User requested root-cause-first correction and durable evidence; APCP assigns Docker/deployment scripts and environment to OPS-01.
- **Evidence:** On main `2cf9a52266af0fd69df809b40f482bb0eb95fb5c`, `scripts/manual-up.sh` invokes the Node migration runner on the host. User output reports `getaddrinfo ENOTFOUND postgres`; the web/worker/Postgres containers share `ai-comms-agent_default`, where `postgres` is an alias.
- **Implementation caution:** Dockerfile currently does not copy `supabase/`; if migration is run in the web container, mount `$PROJECT_ROOT/supabase` read-only at `/workspace/supabase` or deliberately include migrations in the image. Confirm intended DB name: user URL used `/postgres`, Compose default is `aca`.
- **Do not:** Change app DATABASE_URL to host-published routing; do not change DB name blindly; do not claim success from build-only output.
- **Next:** Implement the one-off container migration invocation and regression assertion in `scripts/tests/manual-up-compose-env.test.mjs`; run focused test, then deployment/migration and health verification. Preserve the user's existing intended startup-on-migration-failure policy unless explicitly changed.
- **Related:** ISS-037; `FIX01-MIGRATION-NETWORK-20261018`; `HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018`.


### BKL-OPS01-MIGRATION-IN-CONTAINER-20261018 — implementation update
- **State:** SOURCE + REGRESSION TEST COMMITTED; runtime verification pending.
- **Source commit:** `65a215151ecd14900fac3c9ba9a421fb7a777a77`.
- **Regression test:** `6cd93638bffa0e2f6a9e8d6ce2f3f2664b13341b` (final test assertion correction).
- **Verification evidence:** Bash syntax PASS; isolated Node focused test 4/4 PASS. This was not a complete checkout or live Docker/database test.
- **Remaining:** Operator confirms `/postgres` versus `/aca`, runs focused test in the actual checkout, reruns deployment, and records migration and health outcomes. No deployment PASS claimed.
