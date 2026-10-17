## DEV-01 — Chat tool loop and WhatsApp approval checkpoint — 2026-10-17

- Interactive `/api/chat/stream` now constructs a `ToolContext` from the server-authenticated organization membership, user, role and permissions; it combines only the per-agent allowlisted email/WhatsApp runtime tools, uses the bounded host-authorized invocation path (4 rounds / 8 calls / 10,000-character tool result cap), and preserves host-supplied mailbox context as explicitly untrusted data. Model arguments cannot set tenant, actor or permissions.
- Added source regression tests for the chat host tool loop.
- WhatsApp outbound API requests now create durable `whatsapp_send_actions` proposals instead of queueing sends immediately. Added an organization-scoped approval queue endpoint and authenticated approve/reject endpoint. Approval rechecks the connected account and recent **inbound** customer message; free-form text is queued only inside Meta's 24-hour customer-service window. Outside that window the action transitions to `requires_template` and no message is queued.
- Added migrations `0035_whatsapp_send_approvals.sql`, `0036_whatsapp_templates.sql`, `0037_whatsapp_send_action_outcomes.sql`, and `0038_whatsapp_feature_permissions.sql`, and `0039_email_read_tool_permission.sql`; added Meta template submission/status sync, supported text-body template delivery, approval queue/decision API, approval UI, worker-time 24-hour and live template-status checks, and WhatsApp-specific read/send RBAC for owner/admin/member roles, plus the email.read feature permission required by host email tools. `whatsapp.send` is now registered only as a proposal tool: it creates a pending approval and never directly queues/sends.
- Known integration risk: the web route imports the existing worker runtimes directly; validate the Next.js monorepo build/import boundary during normal verification and extract a dedicated shared runtime package if the build configuration rejects this dependency direction.
- Verification boundary: source changes only. Tests, typecheck, build, migration execution, browser approval UI, Meta API, and deployed behavior have **not** been run or verified. Do not claim a send succeeded from an approval or queue response; only provider-confirmed message state establishes delivery progress.
- Next: run focused web/worker tests and typechecks when available; review the Next.js import boundary for worker runtime imports; apply migrations through the normal deployment process; verify template submission/status refresh and a complete human-approved text/template send against Meta. Keep `whatsapp.send` proposal-only and do not claim delivery before provider confirmation. Do not wait for CI/Vercel polling to continue independent implementation.

---

> **WhatsApp tool runtime checkpoint (2026-10-17):** Added organization/agent-bound `whatsapp.history` plus `whatsapp.send` proposal runtime; the send tool creates only a pending approval and has no direct queue/send path. Interactive chat now calls the host-authorized loop. Static regression tests authored; test execution and live verification remain outstanding. Source-only; no tests/typecheck/build/deployment verified. See `docs/project-control/NEXT_ACTION.md`.

> **WhatsApp chat context source checkpoint (2026-10-17):** Interactive chat now injects up to 20 recent WhatsApp messages only from the current agent's connected, non-deleted, explicitly bound account and organization; bodies are marked untrusted and context is read-only. Final route blob: `5e70c07803fa2f2f2495dc454cf5b256034907cb`; static regression test: `apps/web/tests/whatsapp-chat-context.test.ts`. Source commits and limits are recorded in `docs/project-control/NEXT_ACTION.md`. Tests, typecheck, build and deployment are not verified. This does not yet enable AI-initiated outbound send through the shared tool/approval runtime.

> **Real-time email request (2026-10-16):** New branch `feature/provider-realtime-email-sync` adds visibility-aware 5-second inbox refresh and a provider-neutral implementation plan at `docs/plans/PROVIDER-REALTIME-EMAIL-SYNC-PLAN.md`. This updates the browser UI automatically after PostgreSQL persistence; it does NOT implement provider push by itself. Gmail Pub/Sub + History API and watch renewal, generic IMAP IDLE, and validated Zoho notifications remain open. See `docs/project-control/NEXT_ACTION.md`. User pasted a Gmail app password into chat; do not reuse it, and instruct the user to revoke/rotate it.


> **Latest live inbox investigation — 2026-10-14:** Root cause identified in Gmail batch response parsing: Google returns response Content-ID values prefixed with `response-`, but the adapter mapped them without stripping that prefix. This caused successful Gmail fetches to be treated as missing and acknowledged without persistence. PR #18 was merged into `main` on 2026-10-15. Its Gmail batch mapping/checkpoint fixes are present on `main`; later runtime/deployment verification remains separate. Gmail push/watch is not implemented, so this is polling-based near-real-time behavior, not push-based real-time. See `docs/project-control/NEXT_ACTION.md` for the exact verification steps and the remaining OPS-01 environment checks.


### Email index lifecycle branch — 2026-10-14
- DEV-01 source branch `feature/email-index-lifecycle-v1` adds identity/content/metadata hashes, deterministic vector point IDs, content/metadata requeueing, durable vector sync outbox and retryable adapter processor.
- Account removal queues a vector purge and purges account-scoped PostgreSQL email knowledge docs; message deletion queues vector cleanup.
- Current gap: ai-comms-agent has no supported server-to-server Clara RAG email-index API. Clara's internal vector functions are KB-scoped; wiring them before FIX-01 closes ISS-026 and establishes agent/account retrieval filters risks cross-agent mailbox leakage. Worker startup wiring remains pending; do not claim vector sync complete.
- Tests/typechecks are not run because this environment has no local checkout. Keep FIX-01/OPS-01 ownership boundaries and tool-catalogue gate unchanged.
# PROJECT_STATE.md

One-screen project status. This file is the canonical answer to "where are we?". Update it on every commit.

---

> **Active continuation (2026-10-13):** EMAIL-OPS-01 implementation is in progress on `feature/email-ops-e1-e3`, PR #15 (draft). Source now includes Gmail history reconciliation, tool registry/read handlers/executor/runtime, native OpenAI/Gemini tool-call adapter, bounded worker tool loop, and a DEV-01 self-review. The loop is not wired into transports; tests/typechecks/live provider/sync/deployment checks have NOT run. FIX-01 owns ISS-026 cross-agent email-context isolation; OPS-01 owns the live RabbitMQ/Redis ingestion blocker. Older phase/verification records contain historical drift; see `docs/project-control/NEXT_ACTION.md` and `docs/reviews/EMAIL-OPS-01-DEV01-SELF-REVIEW-20261013.md`.

```yaml
project: ai-comms-agent
repository: Rilan-Dev/ai-comms-agent
branch: main
default_branch: main
visibility: private

current_phase: 4
current_phase_name: "Database Foundation and Domain Schema"
phase_status: "implementation in progress — verification deferred until development completion"

last_completed_phase: 2
last_completed_phase_status: "APPROVED (2026-10-03)"
current_objective: "Email operations plan prepared; await owner/architect review before material implementation. OPS-01 runtime ingestion recovery and existing UI migration remain separate tracks."

architect: "ChatGPT (Chief Architect / Project Controller)"
developer: "ChatGPT (primary implementer and verifier; Z.AI no longer required)"

phase1_approved_baseline: "c8b2f2c02c2231ea4e5fdb5b9fa48124b383bdc6"
phase1_state_recording_commit: "f32616a487ba09bfaa782c39226b19f38d7b18e3"
phase2_implementation_commit: "13835dd8be5d608ccad3f4839e52c2a486f8bb41"
phase2_implementation_commit_url: "https://github.com/Rilan-Dev/ai-comms-agent/commit/13835dd8be5d608ccad3f4839e52c2a486f8bb41"
phase2_control_state_correction_commit: "000d2a9b67b852301f93a098bc0719ae97801c4c"
phase2_vercel_deployment_fix_commit: "c2868671c97af727b624b12a218d288fee936020"
current_commit: "4dc991fa5616f9a04ed3050a7c748e489c6e75f5"
current_commit_short: "4dc991fa"
current_commit_url: "https://github.com/Rilan-Dev/ai-comms-agent/commit/4dc991fa5616f9a04ed3050a7c748e489c6e75f5"
last_verified_commit: "pending_runtime_acceptance"

open_blockers:
  - "Runtime verification still pending for the PostgreSQL migration set; development continuation is explicitly authorized"
  - "ISS-011: AI provider/Clara configuration completeness implementation is in progress; migration 0028 and live chat/voice/provider validation are pending"
  - "ISS-012: Gmail OAuth mailbox sync worker and initial import are implemented on main; web/worker deployment and live mailbox sync verification are pending"
  - "BKL-008: FIX-01 to review Drafts organization context and Inbox search SQL placeholders"
  - "ISS-015 / BKL-011: OPS-01 must apply migration 0029, roll out matching web/worker containers, and diagnose Redis lease rejection"
  - "Lovable UI migration: screen-level source changes are committed, but test/typecheck/build/browser/runtime verification is unexecuted"
open_risks:
  - "Clara manifest has 2 SHA typos (Clara library issue, not file mutations — see CLARA-INTEGRATION.md §8a)"
  - "No managed database dependency; operator must provide PostgreSQL 15+ for deployment"
  - "Worker host not yet selected (ISS-004 / ADR-007) — blocks Phase 9"
required_decision:
  - "Complete Phase 4 implementation, then run CI/runtime verification and perform ChatGPT acceptance"

next_action:
  actor: "DEV-01 / Forge"
  action: "Continue cross-route responsive/accessibility review: check narrow viewport overflow, keyboard focus paths, live status announcements, dialogs, and remaining secondary controls; add focused static contract assertions and update docs/project-control/LOVABLE_UI_MIGRATION.md."
  then: "Preserve existing routes, API contracts, tenant authorization, validation, send/approval safeguards, and truthful loading/empty/error states. Do not wait for CI/Vercel. Tests/typecheck/build/browser/screen-reader/device checks remain NOT RUN. Route substantial bugs to FIX-01 and deployment/runtime issues to OPS-01; OPS-01 owns the separate PostgreSQL migration/Redis incident."

phase2_summary:
  status: "implementation_complete_awaiting_review"
  tasks_completed: 9
  tasks:
    - "✅ Task 1: Read all project-control + architecture + specs docs"
    - "✅ Task 2: Deep Clara audit (full clone, target-side verifier, REUSE_MAP validation, clara-runtime export verified, tools/MCP re-checked)"
    - "✅ Task 3: Application foundation (monorepo: apps/web, apps/worker, packages/{clara-core,shared,db})"
    - "✅ Task 4: Local infrastructure (docker-compose for Postgres/Redis/RabbitMQ/Qdrant)"
    - "✅ Task 5: Clara integration boundary (packages/clara-core; git submodule at vendor/clara/)"
    - "✅ Task 6: Foundation vertical slice (web renders, worker boots, mock email view, health check)"
    - "✅ Task 7: Testing (typecheck 5/5 pass, web build success, worker build success, browser verification pass)"
    - "✅ Task 8: Security verification (no secrets, no client-side keys, no .env committed, .env.example only)"
    - "✅ Task 9: Documentation updates (CLARA_REUSE_MAP corrected, CLARA-INTEGRATION audit results, project-control updated, worklog appended)"

  clara_audit:
    verifier_result: "106/108 PASS (2 manifest SHA typos — Clara library issue, not file mutations)"
    clara_runtime_export: "export const claraRuntime = { ... } as const (NOT a ClaraRuntime class)"
    tools_finding: "Narrow host-binding runtime tool interface (rag_search only); no generic standalone tool/MCP framework"
    integration_approach: "git submodule at vendor/clara/ (pinned to b47e587); packages/clara-core/ as adapter boundary"

  verification:
    typecheck: "5/5 packages passed (clara-core structural, db, shared, web, worker)"
    web_build: "success — routes: /, /mail/inbox, /api/health"
    worker_build: "success — dist/index.js produced"
    browser_verification: "pages load 200 OK, no blank screen, navigation renders, health check 200 healthy"
    worker_smoke_test: "boots, all checks ok, graceful shutdown"
    security_scan: "clean — no secrets, no private keys, no .env files (only .env.example)"

deployment:
  vercel_project: ai-comms-agent
  vercel_project_id: prj_VdO5pwIma53uGKqtt5EzRiry7JtG
  vercel_team_id: team_UQKWM8HLJvyr4sBGNHIidVwH
  vercel_production_branch: main
  vercel_root_directory: "apps/web"
  vercel_framework: "nextjs"
  vercel_node_version: "24.x"
  vercel_production_url: "https://ai-comms-agent.vercel.app"
  vercel_latest_deployment: "READY (commit c286867, 2026-10-03)"
  vercel_remote_verification: "PASS (/ 200, /mail/inbox 200, /api/health 200 healthy)"
  supabase_project: "(not provisioned — Phase 4; PostgreSQL/Supabase remains approved infrastructure per ADR-009)"

reference_library:
  name: ai-reusable-libraries
  repo: Rilan-Dev/ai-reusable-libraries
  visibility: public
  role: "Clara reusable AI core — AI, RAG, voice, agent runtime, usage, governance"
  integration: "git submodule at vendor/clara/ (pinned to commit b47e587)"

monorepo_layout:
  root: [package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, .gitmodules, .npmrc, .env.example]
  apps:
    web: "Next.js 15 App Router + TypeScript + Tailwind v4 (apps/web/)"
    worker: "Node.js worker — RabbitMQ consumer framework (apps/worker/)"
  packages:
    clara-core: "Clara integration boundary — re-exports claraRuntime + types (packages/clara-core/)"
    shared: "Shared types, schemas, domain primitives (packages/shared/)"
    db: "Supabase client factory (packages/db/)"
  vendor:
    clara: "Clara reusable library git submodule (vendor/clara/)"
  infra:
    docker_compose: "Local dev infrastructure — Postgres, Redis, RabbitMQ, Qdrant (infra/docker-compose.yml)"
```

---

## Change log

| Date | Phase | Author | Change |
|---|---|---|---|
| 2026-10-03 | 1 | Z.AI | Initial Phase 1 documentation created and committed (commit 2bacba0). Awaiting ChatGPT review. |
| 2026-10-03 | 1 | Z.AI | Recorded commit SHA + push verification + continuity self-test (commits ba5c819, 99c3109). |
| 2026-10-03 | 1 | ChatGPT | **CONDITIONAL APPROVAL** issued. 8 corrections required. Z.AI must NOT start Phase 2. |
| 2026-10-03 | 1 | Z.AI | Implemented all 8 conditional-approval corrections (commit c8b2f2c). 6 new architecture docs, 2 new ADRs, ISS-005 added. |
| 2026-10-03 | 1 | Z.AI | Recorded corrections commit SHA in project-control state (commit f32616a). |
| 2026-10-03 | 1 | ChatGPT | **FINAL APPROVAL** issued. Phase 2 authorized. Approved baseline: c8b2f2c. |
| 2026-10-03 | 2 | Z.AI | Phase 2 application foundation implemented: monorepo (apps/web, apps/worker, packages/{clara-core,shared,db}), Clara git submodule, local Docker infra, foundation vertical slice, all verification passing. Clara deep audit completed (106/108 verifier pass; claraRuntime export corrected; ISS-005 refined). Awaiting ChatGPT Phase 2 review. |
| 2026-10-03 | 2 | ChatGPT | Phase 2 review: implementation substantially complete; **CORRECTION REQUIRED** for stale/contradictory project-control records. Control-state correction authorized. No Phase 3. |
| 2026-10-03 | 2 | Z.AI | Control-state correction: recorded actual Phase 2 commit SHA (13835dd); implemented minimum CI workflow (.github/workflows/ci.yml) per ROADMAP.md Phase 2 scope; resolved ISS-002, retired RSK-002; corrected ISSUES/RISKS/CURRENT_PHASE/NEXT_ACTION/VERIFICATION_STATE/worklog. Awaiting ChatGPT final Phase 2 acceptance. |
| 2026-10-03 | 3 | Z.AI | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). Identity abstraction, org/membership/RBAC model, server-side authorization, dev-only identity stub, 40 tests. Awaiting ChatGPT acceptance. |
| 2026-10-03 | 3 | ChatGPT | Phase 3 review: CORRECTION REQUIRED. Findings: A (RBAC persistence disconnected), B (owner invariant not enforced), C (permission catalogue boundary undocumented), D (PROJECT_STATE stale). |
| 2026-10-03 | 3 | Z.AI | Phase 3 correction pass (commit bf8dea7): Option A RBAC persistence, owner invariant in-memory, permission catalogue docs, governance sync. 62 tests. |
| 2026-10-03 | 3 | ChatGPT | Phase 3 review: FINAL CORRECTION required. 4 items: SQL owner invariant, atomic org creation, transferOwnership type safety, governance. |
| 2026-10-03 | 3 | Z.AI | Phase 3 final correction (commit d4aa08b): PostgreSQL owner-invariant trigger, createOrganizationWithOwner, NonOwnerRole type, 69 tests. Vercel READY. Awaiting acceptance. |
| 2026-10-03 | 3 | ChatGPT | Phase 3 review: owner trigger is statement-level, not transaction-safe; createOrganization is public (violates invariant); DELETE not covered. |
| 2026-10-03 | 3 | Z.AI | Phase 3 transaction-safe owner invariant (commit 4289e53): replaced BEFORE trigger with DEFERRABLE constraint trigger (AFTER INSERT/UPDATE/DELETE); createOrganization marked @internal; 91 tests. Vercel READY. Awaiting acceptance. |
| 2026-10-04 | 3 | ChatGPT | Took over primary implementation. Corrected the remaining PostgreSQL owner-invariant gap for final membership deletion, strengthened migration static verification, and upgraded CI to run tests on Node 24. Phase 3 remains pending formal acceptance until runtime evidence is complete. |
| 2026-10-03 | 2 | Z.AI | Vercel deployment fix: root cause was framework=None + rootDirectory=None causing Vercel to look for nonexistent public/ output. Fixed via Vercel project settings (rootDirectory=apps/web, framework=nextjs, nodeVersion=24.x). Fixed health check to be production-safe (removed development-time file-existence checks). Deployment READY at https://ai-comms-agent.vercel.app. All 3 routes verified PASS (commit c286867). |


## Development-first execution directive — 2026-10-04

The project owner explicitly instructed ChatGPT to continue development without waiting for GitHub Actions/Vercel validation jobs. ChatGPT is therefore executing the approved roadmap sequentially, including database, provider, AI, messaging, automation, UI/UX, observability and production-readiness implementation. CI/runtime validation remains a mandatory final gate and is not being represented as passed prematurely.

Phase 3 is treated as development-complete for continuation purposes; formal acceptance evidence remains deferred. Phase 4 database foundation is now in implementation.

Recent implementation commits include: 5083c4a (Phase 4 plan), 4d33248 (agent foundation), 462a312 (email domain), 2b60905 (messaging), 8435b4d (conversations/scheduling), a63924a (actions/AI/voice/audit), 39ba02e (API keys/knowledge/storage), 995e9c7 (RLS helper hardening), plus UI/CI improvements.
\n\n### 2026-10-04 — Development-first execution\nChatGPT has explicitly proceeded into Phase 4 database-foundation implementation at the project owner's direction. CI automatic triggers are temporarily disabled so implementation can proceed without waiting for GitHub Actions. No acceptance or runtime verification is claimed.\n

### Phase 4 implementation baseline
- schema: `0002_database_foundation.sql`
- security correction: `0003_database_security_hardening.sql`
- storage config: `supabase/config.toml`
- credential encryption: `packages/db/src/security/envelope.ts`
- static verification: `apps/web/tests/migration-verification.test.ts`
- CI: temporarily manual-only by project-owner instruction


### 2026-10-04 takeover verification update
Runtime verification scripts are now committed on main and CI is configured with PostgreSQL 17. GitHub's commit workflow-run endpoint reports no workflow runs for the verification PR, so runtime execution remains unproven. No Phase 4 authorization has been issued.


Latest synchronization: Docker/manual verification tooling is committed at 271bd648875ce086a52aaedd7953e63bbc89421e. Runtime acceptance remains pending because this environment cannot execute Docker and GitHub Actions has not yet supplied a fresh run result.


### 2026-10-05 takeover update
- PostgreSQL is now the canonical runtime database abstraction; Supabase is not required.
- Self-hosted Docker is the active deployment path.
- Phase 4 application schema foundation and tenant RLS are implemented in 0002_application_foundation.sql.
- Email provider capability runtime groundwork is implemented; Phase 5 provider-specific adapters remain next after database verification.
- No real credentials or .env files are committed.
\n- Latest takeover hardening: external infrastructure is now the default runtime contract; local Docker services are profile-gated; migration SQL/RLS helpers received final security hardening.
- Latest code commit: fca6f3ffa603006876c64f607043fb27137ae35d.
- Vercel project currently has no configured environment variables, so external runtime configuration is not yet present there. No credentials are being invented or copied from local files.

## 2026-10-05 — Infrastructure boundary and verification correction

- **Deployment infrastructure policy:** PostgreSQL, Redis, RabbitMQ, and Qdrant are external runtime dependencies; Docker Compose services are opt-in under the `local-infra` profile and are never started by the normal source verification path.
- **Verification policy:** `pnpm run verify` / `scripts/verify.sh` performs source/type/test/build checks only. `scripts/verify-docker.sh` is explicit opt-in disposable PostgreSQL verification.
- **Latest infrastructure correction:** `infra/docker-compose.verify.yml` now uses the actual `postgres` service hostname.
- **CI:** GitHub Actions uses its own disposable PostgreSQL service for runtime migration checks; this is CI infrastructure, not deployment provisioning.
- **Latest known Vercel status:** the Vercel status for the latest code is `failure` due to build-rate-limit; no READY claim is made.
- **Phase 4:** remains the active development phase under the project-owner development-first instruction. Runtime validation remains a release/acceptance gate, not a source-development blocker.


### 2026-10-05 — Phase 4 migration-chain correction
- Local disposable PostgreSQL verification exposed a real schema defect: `0002_agent_foundation.sql` and `0002_application_foundation.sql` both defined `agents`, `agent_versions`, and related objects with incompatible columns. The application migration attempted to add `agents_current_version_fk` against a column that did not exist on the already-created table.
- Corrective action: `0002_application_foundation.sql` is now the single authoritative Phase 4 application/agent foundation migration. The richer agent version/deployment/policy fields were consolidated into it, and the duplicate `0002_agent_foundation.sql` migration was removed before production application.
- Latest correction commit: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- Required next verification: pull `main` and rerun `bash scripts/verify-docker.sh`; then inspect CI runtime result. Do not claim Phase 4 acceptance until the full migration chain passes.


### Runtime verification finding — 2026-10-05
- Local disposable PostgreSQL verification reached `0002_database_foundation.sql` successfully but failed because its `can_access_organization()` helper referenced Phase 3 RLS helpers without the `private.` schema qualification.
- Corrected in commit `d2da078e406a96fce7245dcd753b2e7f1ab87d74`: `private.is_active_organization_member(...)` and `private.is_active_organization_admin_or_owner(...)` are now explicitly qualified.
- This is a real runtime migration defect caught by the verification harness; it is not a false-positive static test issue.
- Phase 3 acceptance remains pending until the disposable PostgreSQL verification is rerun successfully, including ownerless-organization rejection.
- Phase 4 remains NOT AUTHORIZED.


## 2026-10-05 migration-chain correction

ChatGPT audited the disposable PostgreSQL failure reported from the local verification run. Root cause: conflicting legacy Phase 4 migrations shared the 0002 numeric prefix and defined incompatible versions of the same domain tables; the runner applied an obsolete `agent_versions` definition before the newer domain migration expected `version_number`. The canonical chain is now `0001_identity_rbac.sql → 0002_database_foundation.sql → 0003_database_security_hardening.sql`. Legacy `0002_application_foundation.sql`, `0002_domain_foundation.sql`, and `0003_database_foundation.sql` were removed. Invalid single-dollar function delimiters in the security migration were also corrected. A migration-chain regression guard was added and CI now applies migrations, verifies checksums, then runs runtime tests.

Acceptance remains pending until a fresh runtime/CI run is green. No production Supabase provisioning has been performed.


### 2026-10-05 — ChatGPT continuation: Phase 4 email/database contract hardening
- Added canonical forward-only migration 0014 for non-secret email connection metadata.
- Aligned the PostgreSQL email repository with the actual credential/status/sync columns.
- Registered Gmail in the server-side provider registry; mock provider remains available for deterministic tests.
- Removed stale test dependency on the deleted duplicate Phase 4 foundation migration.
- Runtime migration verification remains a required acceptance gate; no unverified deployment is claimed.


### Product completion track — 2026-10-05

- **Owner:** ChatGPT
- **Objective:** complete the actual application menu-by-menu; no placeholder controls or fake live state.
- **Current product slice:** 0 — Shared Product UX/Runtime Foundation.
- **Next complete vertical slice:** 1 — Agents.
- **Plan:** docs/superpowers/plans/2026-10-05-product-completion-menu-plan.md
- **Known UI gaps:** hard-coded/demo data on multiple menus, non-functional buttons, missing validation, inconsistent/no notifications, incomplete error/loading/empty states, incomplete persistence/API wiring.
- **Important:** roadmap phase completion and product-menu acceptance remain separate gates. No phase is marked complete merely because UI work exists.


### ChatGPT takeover update — 2026-10-06
Product completion Slice 1 (Agents) is now the active vertical implementation track. Real PostgreSQL-backed agent CRUD, versioning, deployment, policy, audit, configuration testing, email binding, and single-WhatsApp binding endpoints/UI are implemented; runtime verification remains pending.


### Verification hardening — 2026-10-06
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes transaction-level owner/RLS runtime verification, and asserts ownerless-organization rejection.
- SECURITY DEFINER helpers intentionally use `SET search_path = ''` with fully-qualified `public.*` table references; static tests now enforce this safer pinned path.
- Latest implementation commit: 5bcc9758f374de1d7187d2f9cd814d2589ecf081.
- Phase 3 acceptance remains pending until CI runtime evidence is green.


### 2026-10-06 — ChatGPT continuation
Email Accounts continuation is active under ChatGPT ownership. Corrected the email credential repository to read the canonical ciphertext column, replaced the mail/accounts demo UI with persisted PostgreSQL account state, and added an authorized disconnect API. Provider activation remains configuration-required when user-owned OAuth/IMAP credentials are absent. Latest implementation commit: 36411839ab9080762d5d9eae5ce3aeb4d3aedf46.


### 2026-10-06 — Agent vertical-slice continuation
ChatGPT corrected the remaining 0001 PostgreSQL role-bootstrap quoting defect, added persisted Agent Details editing, and replaced raw email-account UUID entry with an organization-scoped persisted account selector plus binding role. The product-completion plan remains the active execution baseline; Slice 1 Agents is still not accepted pending runtime/browser verification. Vercel continues to report build-rate-limit failure and the GitHub workflow connector exposes no push-run records, so no green verification is claimed.


### 2026-10-06 — ChatGPT continuation
- Latest implementation corrections: cross-tenant provider binding guard fixed in migration 0010; Gmail OAuth callback now validates state-cookie equality; Gmail accounts remain pending until encrypted credentials are stored successfully.
- Slice 1 Agents remains pending formal acceptance. Development-first implementation continues; no Vercel READY or CI PASS is claimed.
- Next product work remains Email Accounts provider connection hardening (Gmail, then IMAP/SMTP and Zoho), followed by Mail.


### 2026-10-06 — Email provider implementation continuation
- Fixed the IMAP/SMTP duplicate helper compile defect and added provider/security tests.
- Added outbound-target protection for user-supplied IMAP/SMTP hosts to reject localhost/private destinations before TLS connection.
- Added Zoho OAuth PKCE start/callback with regional Accounts domains, signed state-cookie validation, encrypted credential persistence, and organization admin authorization.
- Added the initial Zoho REST adapter foundation and registered Gmail, IMAP/SMTP, and Zoho in the worker registry.
- Runtime/provider credentials are not available, so no live provider connection is claimed.


### 2026-10-06 — Product development continuation
ChatGPT continued implementation without waiting for CI/Vercel: agent version configuration editing is now persisted through immutable version creation; agent email/WhatsApp unbinding is implemented and audited; channel binding rejects cross-tenant account IDs. Slice 1 remains formally unaccepted pending verification evidence. Development now proceeds into Slice 2 Email Accounts under the explicit development-first instruction.

### Current development checkpoint — 2026-10-06
- Product completion Slice 1 (Agents) remains active and not yet accepted.
- Latest implementation: bc31ded2df82e7a42b985343951381751504402b.
- Agent audit history is now persisted/read through an authorized API and visible in the detail Activity tab.
- Agent WhatsApp channel binding now discovers organization-scoped accounts instead of requiring arbitrary UUID entry.
- Agent policy API now performs strict server-side validation with field-level errors.
- Next: finish remaining Slice 1 UX/error/browser verification work, then gate advancement to Email Accounts.


### 2026-10-06 — Email Accounts continuation
ChatGPT continued the development-first Email Accounts slice without waiting for CI/Vercel. IMAP/SMTP reconnect now reuses encrypted persisted credentials for a server-side connection test and updates connection status with audit events. Email account errors/capabilities are surfaced in the UI. Zoho regional OAuth refresh routing was hardened and regression-tested. No live provider credentials are present, so no provider connectivity is claimed.


### 2026-10-06 — Email Accounts continuation
Email Accounts continuation is active under ChatGPT ownership. Corrected canonical PostgreSQL email-account schema reconciliation (status enum and credential ciphertext migration), completed core Zoho runtime operations with truthful capability metadata, added persisted folder/label discovery infrastructure, and made Gmail/Zoho OAuth reconnect idempotent. Runtime/browser verification remains deferred and is not a development blocker.


### 2026-10-06 — Capability truthfulness correction
- Aligned persisted IMAP/SMTP and Zoho capability metadata with the operations actually implemented by their adapters; unsupported draft/send/forward/attachment operations are no longer advertised as available.
- Gmail remains the fully advertised provider surface where its adapter implements the corresponding contract.
- Latest code commit: be4925cbd3e73ebeec28a951a5d062d70fba19ae.
- Runtime/browser verification remains deferred and no live provider connection is claimed.


### Latest implementation checkpoint — 2026-10-06
- Slice 2 Email Accounts is active under the development-first project-owner directive.
- Gmail/Zoho OAuth persistence now remains pending until worker verification; IMAP/SMTP persistence is idempotent and credential-save failures are fail-closed to an error state.
- No live provider credentials are fabricated. CI/Vercel remain verification gates and are not treated as development blockers.


### 2026-10-06 — Slice 2 provider lifecycle continuation
ChatGPT completed another Email Accounts hardening pass: folder/label discovery is now an atomic replacement snapshot, successful worker discovery persists runtime capabilities and connected status, discovery failures become explicit account errors, and IMAP/SMTP/Zoho capability metadata is truthful to the implemented adapter surface. Continue the Mail vertical slice after Email Accounts implementation is complete; runtime acceptance remains a separate gate.


### 2026-10-06 — ChatGPT continuation
Slice 2 Email Accounts provider lifecycle implementation is active under the development-first override; CI/Vercel remain deferred acceptance gates.
Current commit: `1972d62cffca5b1b5a5eaeb4ddcb4e7c9f53b446`.


### 2026-10-06 — Mail slice implementation checkpoint
- Development-first continuation is active under explicit project-owner instruction; CI/Vercel completion is not blocking implementation.
- Email Accounts provider lifecycle work remains in place without fabricated live credentials.
- Mail now has a PostgreSQL-backed, organization-scoped inbox query/API, real persisted inbox UI with search/status filters, and persisted thread detail.
- No Mail provider send/read mutation is claimed yet; those are the next implementation steps.
- Formal runtime acceptance remains separate and is not being represented as passed.
\n\n### 2026-10-06 — ChatGPT Email Accounts lifecycle continuation
- Added a single-connection provider verification helper with guaranteed cleanup and capability normalization.
- Refactored persisted folder/label discovery to run within the verified provider connection and update account status to connected/error truthfully.
- Added organization-scoped mailbox structure API exposing persisted folders, labels, and agent assignments without credential data.
- Added mailbox UI inspection plus provider lifecycle/contract tests.
- No real provider credentials were used; no live connectivity is claimed.
- Latest implementation commit before control synchronization: `105d41481d9523bda66b0f6ae147e73fff1c3c46`.
\n\n### 2026-10-06 — Email Accounts truthfulness hardening
- Removed synthetic mailbox discovery timestamps; UI/API now expose only persisted structure state.
- Provider lifecycle remains server-side, organization-scoped, and credential-free in responses.
- Latest implementation commit before this control update: `ee2bba7c696e2ed9672c7ff7281e0a1658951798`.


### 2026-10-06 — Slice 2 Email Accounts checkpoint
Current product slice: **Slice 2 — Email Accounts**. ChatGPT is the sole active implementer. Latest source work hardens atomic folder/label discovery persistence, provider capability contract tests, and disconnected-account recovery. Runtime/browser/provider acceptance remains pending and no live credentials are claimed.


Latest Email Accounts implementation adds user-facing OAuth failure recovery in the account UI, alongside atomic mailbox discovery and disconnected-account reconnectability. Current source baseline is control commit 98f1c2801a1cdabaf6e85ad4be592b4917d663802.


Latest source correction: repaired literal escaped-newline corruption in the email account API and added a regression guard. Email Accounts remains the active product slice; no acceptance or deployment claim is made.


### 2026-10-06 — Mail outbound action checkpoint
- Development-first execution is active under ChatGPT ownership.
- Email Accounts provider lifecycle has advanced through connection persistence, reconnect/error handling, capability truthfulness, OAuth reconnect binding, and mailbox structure discovery.
- Mail now has approval-safe persisted outbound action requests for send/reply/forward, server-side approval transitions with audit, and worker-only provider execution scaffolding.
- No live provider credentials or successful external send is claimed.
- Next implementation: provider-backed draft synchronization/result persistence, message/thread action UX, and attachment handling.


## 2026-10-06 ChatGPT takeover runtime-verification preparation

- Added disposable PostgreSQL 17 service to CI.
- Added runtime migration verification covering organization creation, ownership transfer, deferred owner invariant, and SECURITY DEFINER helper presence.
- Added expected-failure verification for direct ownerless organization insertion.
- Latest implementation commit: ede90e43f1d106206657f85b0f09efe7b5521785.
- Phase 3 remains pending CI runtime evidence; Phase 4 is not authorized.


### 2026-10-06 — Mail vertical implementation update
- Added organization-authorized thread API and functional thread UI.
- Added approval-safe reply request from thread view.
- Added persisted pending approval listing and a functional approval queue UI.
- Approval remains deterministic and worker-only for provider execution; no live send is claimed.
- Next Mail work: draft lifecycle hardening, provider-backed draft/result synchronization, forward UX, and secure attachment handling.
\n\n### 2026-10-06 — Mail draft/action continuation\n- Current implementation commit: 9b9aeee0ac9605cdcde476e93a464f78d6be3f92.\n- Persisted draft list/retrieve/update/delete is organization-scoped; Drafts UI is no longer a placeholder.\n- Thread Forward uses the existing approval-gated sensitive action API.\n- Runtime/browser validation remains deferred under the development-first override; no provider connectivity is claimed.\n- Next: provider-backed draft result synchronization and secure attachment retrieval/handling.\n
### Development-first implementation checkpoint — 2026-10-06

ChatGPT continued Product Completion Slice 2 (Email Accounts) without waiting for CI/Vercel. Added bounded provider retry handling for transient connection/discovery failures, immediate fail-closed behavior for authentication/credential failures, and provider lifecycle tests covering retry/backoff/cleanup. Existing persisted mailbox discovery and account-to-agent visibility remain in place. Phase 4 development continues; validation remains a later acceptance gate.

\n\n### 2026-10-06 — Mail provider draft synchronization continuation\n2026-10-06 — Mail continuation: implemented additive provider-draft synchronization metadata, organization-scoped draft sync repository operations, and a worker-only provider draft synchronization executor. Corrected the persisted email-action status model to include the executing state used by the worker. No live provider credentials or send success are claimed.\n

### 2026-10-06 — ChatGPT development-first continuation
- Mail follow-up implementation advanced through provider draft sync lifecycle, worker-only approved send/reply/forward execution, attachment metadata API, and secure attachment download boundary.
- WhatsApp vertical slice is now active under the explicit development-first instruction.
- Latest implementation commit: `8675e9bc39799796714b1418470733246f58e4ca8`.
- CI/Vercel are deferred validation gates; no latest runtime/deployment PASS is claimed.


### 2026-10-06 — WhatsApp vertical implementation active
- Added WhatsApp account repository/configuration API/UI with encrypted credential persistence.
- Added worker verification, signed Meta webhook ingestion, idempotent inbound persistence, queued outbound messaging, and worker-only Meta execution.
- Added forward-only `0016_whatsapp_schema_reconciliation.sql` to reconcile legacy WhatsApp schema with runtime contract.
- Latest implementation commit: `552f13e097c4ff33b7c81a5db7a216328caea078`.
- Validation remains deferred; no CI/Vercel PASS is claimed.


### 2026-10-06 development-first continuation
WhatsApp status/media/routing hardening and persisted Schedules/Automations CRUD workspaces are implemented. Runtime acceptance remains deferred by explicit project-owner instruction. Next implementation is the worker scheduler/automation execution boundary.


### 2026-10-06 — WhatsApp inbound + Chat runtime continuation
ChatGPT continued development-first implementation without waiting for CI/Vercel. WhatsApp inbound messages now have a durable processing claim lifecycle and worker-side Clara execution path that queues replies to the originating contact; inbound processing also emits `whatsapp.received` automation events. Added host-owned persisted conversation/message repository and a Clara-backed authorized SSE chat route using hybrid RAG. Latest implementation/control commit: 0d71e4e2d24cc99911913a5a15946ccb1d83fdc7. Runtime/deployment acceptance is not claimed.


### 2026-10-06 — ChatGPT continued Phase 4 development-first execution. A persisted Clara chat workspace is now implemented with organization-scoped conversations, SSE streaming, and agent-isolated history. Phase gates and CI/Vercel remain non-blocking under the active instruction.


### 2026-10-06 — Final product hardening track
- Clara realtime voice transcript bridge and shared transport contract implemented.
- Settings organization/member state and authorization-aware membership controls implemented.
- Activity and Audit now read persisted organization audit events; synthetic operational metrics were removed.
- **Next:** cross-surface hardening and E2E/deployment preparation under the development-first continuation instruction.


### 2026-10-06 — Cross-surface hardening continuation
- Activity/Audit/Operations surfaces now use persisted organization state, server-side filters, authorized JSON/CSV export, and runtime signals; the static sidebar health claim was removed.
- Automated agent actions now require the email account to belong to the organization and be bound to the executing agent, and automated email/WhatsApp requests emit audit events.
- Overview dashboard no longer presents fabricated live metrics; it loads persisted organization counts/activity with truthful configuration and empty states.
- Product-completion contract coverage added for these boundaries. Development continues toward full cross-surface E2E.

### 2026-10-07 — Scheduled run idempotency hardening
ChatGPT added migration 0021 and worker claim protection so each scheduled job/fire timestamp can produce at most one durable scheduled run. Development continues under the Phase 4 development-first execution mode; runtime/deployment validation remains a later milestone.


### 2026-10-08 — Current development checkpoint
- Cross-surface deterministic scenario runner is implemented and connected to PostgreSQL repository boundaries.
- Sensitive email and WhatsApp provider outcomes now emit worker-owned automation events on success/failure with stable identifiers and correlation continuity.
- Runtime/provider/CI/Vercel verification remains intentionally deferred and is not claimed as passed.
- **Next implementation:** sensitive-action retry/failure semantics and deterministic audit/event assertions.


### 2026-10-08 — Development-first fail-closed recovery
ChatGPT continued cross-surface hardening without waiting for CI/Vercel. Latest code/control checkpoint: 65dc65c46084ba51f0eb842c4a75789c56bf1680. Sensitive email actions and WhatsApp inbound executions now fail closed after abandoned worker leases, with manual-verification audit continuity rather than automatic replay.

Authentication is now a Phase 3 security correction. The protected UI requires an application-authenticated session; production identity uses Supabase Auth and maps to an active application user/membership. Latest code commit: c7c646f19551136d8d8decc827651891ea188780. Phase 4 remains unauthorized.


### 2026-10-08 — Authentication boundary corrected

- **Authentication:** PostgreSQL-native and application-owned; no Supabase Auth runtime dependency.
- **Credentials:** `aca.auth_credentials` stores salted scrypt password verifiers and lock state; plaintext passwords are never persisted.
- **Sessions:** `aca.auth_sessions` stores only SHA-256 token hashes with expiry/revocation metadata; browser receives an HttpOnly session cookie.
- **Abuse controls:** failed-login history, five-failure lockout window, generic invalid-credential responses, bounded password policy, origin validation, IP normalization.
- **Lifecycle:** login, logout, current-session resolution, password change, session revocation, and one-time bootstrap are implemented.
- **UI:** Settings now exposes authenticated password change with session revocation feedback.
- **No Supabase project is required for application authentication.** PostgreSQL remains the authoritative runtime dependency.


### 2026-10-08 — Provider outcome isolation hardening
- ChatGPT hardened the worker provider-event boundary so downstream automation evaluation failures cannot mutate an already-successful external provider outcome into a false failure state.
- Added deterministic injectable-evaluator coverage for the isolation contract.
- Current implementation continues under the development-first directive; CI/Vercel remain non-blocking and no runtime/deployment success is claimed.


### 2026-10-08 — Cross-surface hardening continuation
Latest implementation: 64485e8c9478c6881f488f00ae624a3657e17a07. Cross-surface deterministic adapters now cover conflicting email/WhatsApp idempotency payload rejection and scheduled duplicate-fire suppression; worker retry classification imports were corrected. Runtime/CI/Vercel verification remains intentionally deferred.


### 2026-10-08 — Communication-loop edge hardening
Provider event routing identity is now fail-closed against metadata overrides, and voice turn accounting rejects inactive/ended sessions at both route and repository layers. Latest implementation commit: `0c0a23b9bbda2574960e0c4355d631318e3cd37e`. Continue cross-surface edge hardening without waiting for CI/Vercel.


### 2026-10-08 — Sensitive approval visibility hardening
Pending and individual email approval content is now restricted to `organization.update` operators, preventing read-only members/viewers from inspecting sensitive action snapshots. Latest implementation checkpoint: `3488b3b585c8779f706dea646d78b2f4ff880657c`.


### 2026-10-08 — Communication-loop edge hardening
- Deterministic cross-surface PostgreSQL scenario coverage now treats duplicate concurrent email approval delivery as a race and requires exactly one successful approval transition.
- WhatsApp outbound failures now persist the provider error in the authoritative message row instead of discarding the error argument.
- Runtime/CI/Vercel validation remains deferred under the active development-first instruction; no success is claimed.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and audit/idempotency assertions before final runtime/deployment preparation.


### 2026-10-09 — Audit schema compatibility update

The user-provided runtime logs show migration 0023 applied and the web/worker containers started, but authenticated agent creation then failed because the existing audit_events table still required legacy resource_type/outcome columns. Forward-only migration 0024 and static regression coverage are now committed. Runtime acceptance remains pending until 0024 is applied and the failing request is retried.


### 2026-10-09 — Mailbox tenant-context correction
- `/mail/accounts` now uses the authenticated user's active organization instead of the seeded development organization. The API's `not_member` response was correct and should not be bypassed.
- Source commit: `4536332fdee1de3b2a0c060d581b3939c769f08a`; static regression test: `7a3cfba20cabc6fad88b313c258320c5961c06af`.
- Project-control records: ISS-009, EVT-FIX01-MAIL-TENANT-20261009, FIX01-MAIL-TENANT-20261009.
- Runtime status remains unverified. The independent migration 0024 deployment/retry requirement from ISS-008 remains pending.


### 2026-10-09 — Cross-surface lifecycle hardening
- AI Voice workspace now resolves the authenticated organization instead of the development seed org.
- Voice turn route rejects non-active sessions and fails closed if the session becomes inactive before the atomic turn count update.
- Voice start now persists a starting record before Clara transport setup and attempts terminal error state on startup failure.
- Email action claim/completion transitions now include organization scope in their atomic SQL updates.
- Implementation commits include 3ada3490, 75bf41fd, 2dc3bcf5, 0d773b0e, 7de1b068, and 0f72bdec. Validation remains pending; no CI/Vercel/runtime pass is claimed.


### 2026-10-09 — Configurable multi-client Gmail OAuth
Gmail OAuth client registrations are now organization-scoped platform configuration, managed through Settings and encrypted at rest. Mailbox connection UI selects an enabled client; the OAuth callback uses that exact client and stores its credentials only in the encrypted mailbox credential envelope for worker refresh. Gmail-specific client IDs/secrets and SESSION_SIGNING_KEY are no longer required as OAuth configuration variables; CREDENTIALS_MASTER_KEY remains server-only infrastructure. Source issue ISS-010. Migration 0025 and live OAuth remain unverified.


### 2026-10-09 — WhatsApp outbound concurrency correction
Added migration 0025 for the outbound `executing` state, atomic `SKIP LOCKED` claims, stale-lease fail-closed recovery, and late provider-success persistence-conflict auditing. Added worker regression tests. Validation remains pending; no CI/Vercel/runtime pass is claimed.


### 2026-10-09 — Migration sequence correction
Gmail OAuth configuration is sequenced as `0026_gmail_oauth_configuration.sql`; `0025_whatsapp_outbound_claim_lifecycle.sql` retains sequence 0025. The Gmail migration regression test now asserts unique numeric migration prefixes. Migrations and runtime remain unverified; no PASS is claimed.


### 2026-10-09 — Dynamic OAuth callbacks and Zoho settings
Gmail and Zoho OAuth callbacks now derive from the active request origin and the exact URI is signed into state for token exchange. Zoho now has organization-scoped encrypted OAuth client settings, selection on Mail Accounts, and per-account client credentials for worker refresh. Migration 0027 adds Zoho OAuth configuration. Public callbacks require HTTPS; Google does not accept raw IP callback hosts. Deployment and end-to-end tests remain pending.


Current implementation update (2026-10-09): request-derived OAuth callbacks and multi-client Zoho settings are committed. See NEXT_ACTION.md for deployment. Tests, build, migrations, and live OAuth are unverified.


## 2026-10-09 — Gmail/Zoho OAuth origin regression correction

The callback helper previously used only `request.url`, which can expose an internal Next.js origin such as `https://localhost:3000` behind a reverse proxy. Source now resolves the public origin from validated `X-Forwarded-Host` and `X-Forwarded-Proto`, keeps callback/token-exchange URIs consistent, and returns callback navigation to the public origin. Gmail and Zoho Settings now warn if the server-generated callback origin differs from the browser origin. Reverse-proxy configuration and live OAuth remain unverified; see `NEXT_ACTION.md`, `ISSUES.md`, and `VERIFICATION_STATE.md` for the exact next step.


| 2026-10-09 | DEV-01 | Added persisted Drafts search (subject/body/recipients/mailbox) and routed suspected tenant-context/Inbox SQL defects to FIX-01. Product commit `8ccf1cb24039cb3bc745a51576a73ee68007e946`; no tests or runtime verification claimed. |

| 2026-10-09 | DEV-01 | Added static regression contract for Drafts search fields/no-match state (`b0fd74f45a06a1cb8e2f3c4c152d242314711d39`); test execution pending. |


### 2026-10-09 — DEV-01 Lovable UI migration started
User explicitly directed that the existing application adopt the visual design of `source/lovable-ui`, preserving application functionality and frontend validation. DEV-01 inspected the reference styles and workspace shell, then committed design-token/font integration, responsive icon-led navigation, header search, shell alignment, and a data-backed overview redesign. Initial source commits: `a9083ac`, `47ef723`, `13c35cb`, `8bfacdf`, `fe547ce`, `1a06340`. This is a partial migration, not complete. Local tests/typecheck/build/browser/runtime checks have not been run; no PASS is claimed. Continue screen-by-screen, preserving Next.js/API/auth/RBAC behavior. After the UI tranche, return to the queued connected-mailbox/Clara integration work in NEXT_ACTION history.


### 2026-10-09 — Lovable UI adaptation follow-up
The UI adaptation now also harmonizes legacy card/button geometry and form typography, moves login/setup and Inbox/Chat/AI Voice/thread ambient surfaces toward the Lovable warm-neutral/green palette, and binds header search's `q` parameter to the actual Inbox filter state. Added `apps/web/tests/lovable-ui-migration.test.ts` to cover design tokens and preservation of authentication, route navigation, search, persisted overview data, and form validation. Test source has not been executed. Latest related commits: `3ed3c28`, `239a38c`, `130c810`, `c7bc510`, `eeb717c`, `3ccad8c`. Continue remaining screen-by-screen UI migration; no test/build/browser/runtime PASS claimed.


### 2026-10-09 — Agents screen icon alignment
The Agents list now uses inline SVG sparkle iconography matching the Lovable visual language instead of decorative text glyphs. The existing API-backed create flow, slug validation, notification feedback, status filter, and navigation to agent configuration are preserved. Added assertions to the UI migration contract test source. Commits: `0a79f7f3a9321d30dbc4d01fa5c611c1356d5021`, `2c949dc92d524f484d5e689603afd26106f9d801`. Tests not executed.


### 2026-10-09 — Live schema and Redis incident
User-provided runtime logs identified missing `ai_provider_configs.model` and `email_sync_states.last_attempt_at`, plus Redis lease command rejection. FIX-01 committed forward migration `0029_runtime_schema_reconciliation.sql`, bounded Redis server error reporting, and a WRONGPASS regression test. Source-only status: migration application, tests, builds, Redis connectivity, and mailbox runtime remain unverified. OPS-01 owns the live database/container rollout and Redis configuration diagnosis. See ISS-015 and BKL-011.


### 2026-10-09 — Mail navigation active state correction
The sidebar now treats child routes as active for the Mail group, so Accounts, Inbox, Threads, Drafts and nested detail routes keep the Mail navigation expanded. Added a static contract assertion. Commits: `a6c0abb0b5521aa0b6d636c48f83dc7f301a2c44`, `11ff84aac3a8379b09de78a191d704bd845512d6`. Test not executed.

### 2026-10-09 — Schema reconciliation regression source
Added static migration regression coverage for `0029_runtime_schema_reconciliation.sql` in `apps/web/tests/migration-verification.test.ts` (commit `282c4fea59b848e876bc65d79b250752b8339bda`). This is source coverage only; no test run, migration application, Redis validation, or live mailbox PASS is claimed.

### 2026-10-09 — Live inbox schema drift and Redis authentication
The latest logs show missing `email_messages.from_name` and Redis WRONGPASS; a queued response does not confirm import. FIX-01 committed migration `0030_email_messages_runtime_reconciliation.sql` and static assertions. OPS-01 must apply migrations 0029/0030 to the live database, roll out matching web/worker images, fix Redis credentials/ACL, and verify message rows and inbox results. Runtime remains unverified.


### 2026-10-09 — WhatsApp connection UI continuity (DEV-01)
The WhatsApp route now mounts the existing API-backed client with authenticated organization context. The Connect WhatsApp Business CTA opens the encrypted Meta Cloud API credential form; account/message actions remain connected to existing APIs. Credentials are not represented as connected until Meta/webhook verification changes the persisted status. Commits: 58ba5541, 94878571, 49c94de3, 2cbe4ab9, 9eb3a168. Verification NOT RUN (tests/typecheck/build/browser/Meta/webhook).

Next product UI action remains Knowledge UI with real organization-scoped persisted counts/status and working controls, then Activity → Audit → Operations → Settings/provider settings → Login/Setup → agent detail/version/history → responsive/accessibility review. OPS-01 still owns live schema/Redis runtime acceptance; FIX-01 owns separate substantial bugs. Do not wait for CI/Vercel.


### 2026-10-09 — Inbox and sync cursor code review
Additional source defects were found and corrected: migration 0030's PL/pgSQL block delimiter, inbox search parameter placeholders, and legacy JSONB-vs-text sync cursor incompatibility. Migration 0031 adds canonical `cursor_token`; worker reads/writes were aligned. Static regression assertions were added. Tests, migration execution, Redis AUTH, deployment, and actual email import remain unverified. OPS-01 owns live rollout and Redis correction; see ISS-016.

### 2026-10-14 — Email indexing lifecycle planning
- PR #15's email-tool/Gmail history changes are merged to main (merge commit d444cf1b35939008058532b0754b46daef7cc312).
- Added docs/plans/EMAIL-INDEX-IDENTITY-AND-ACCOUNT-LIFECYCLE.md. Key source-level gap: message content updates do not visibly invalidate indexed_at, and account removal lacks an explicit, retryable vector-index purge contract.
- No test/typecheck/build or live vector/index acceptance is claimed. The current execution environment has no local checkout and cannot resolve github.com.


### 2026-10-16 — Provider realtime email sync, RT-02 source progress

- PR #19: https://github.com/Rilan-Dev/ai-comms-agent/pull/19 — closed/merged; the original browser refresh/Gmail webhook foundation and sync-pending migration are present on `main`.
- PR #21: https://github.com/Rilan-Dev/ai-comms-agent/pull/21 — merged into `main` on 2026-10-15; focused verification remains uninspected; adds watch-on-connect, fail-closed capability/config, watch retry hardening, expanded webhook/history tests, focused test/typecheck workflow, and updated project-control docs.
- Added Gmail adapter profile/watch/stop methods and `apps/worker/src/email/gmail-watch-worker.ts`; worker starts watch registration/renewal every 12 hours when configured and renews watches expiring within 24 hours. Watch expiry/history ID are stored in account `connection_config`.
- Added `POST /api/webhooks/gmail`: Google certificate-backed RS256 verification, issuer/audience/configured service-account identity/expiry checks, bounded request body, Pub/Sub payload validation, mailbox resolution against trusted DB rows, and immediate durable sync scheduling. The worker due-query now allows a persisted `next_attempt_at` push trigger to bypass the ordinary two-minute polling delay.
- Added a small web test for missing/malformed bearer token rejection.
- **Not complete:** tests/typechecks/build were not run; valid signed push delivery, account matching, watch renewal, History API reconciliation after push, cloud Pub/Sub setup, and real-mail latency remain unverified. IMAP IDLE, Zoho verification, Outlook adapter, and end-to-end timing remain pending. Keep capability flags fail-closed until verified.


RT-02 follow-up: added migration `0049_email_sync_pending_push.sql` and changed webhook/worker checkpointing so push events arriving while an account is already syncing are not cleared by that sync's completion. The watch worker now checks every five minutes for newly connected accounts and watches expiring within 24 hours. Still source-only and unverified.


Gmail follow-up hardening: watch failures now use stored retry backoff (5 minutes with exponential growth capped at 6 hours); successful watch registration persists refreshed OAuth credentials and clears retry metadata. The webhook skips notifications already covered by the persisted Gmail history cursor and acknowledges intentionally paused sync accounts. These are source changes only; their tests and runtime behavior remain unverified.


### Gmail RT-02 follow-up — 2026-10-16

- Added signed-JWT webhook tests using a synthetic test-only certificate/key: invalid audience, wrong service account, unverified identity, expired token, wrong issuer, future `iat`, malformed envelope/payload, unknown and ambiguous mailbox, paused mailbox, duplicate history cursor, and durable queueing.
- Added Gmail History API tests for paginated incremental changes and expired-cursor fallback to a fresh initial baseline.
- Gmail OAuth callback now attempts watch registration immediately when all three push settings are present, keeps `sync_webhook` capability disabled, and falls back to worker retry if watch registration fails.
- Watch worker now requires all three push configuration values, compares normalized mailbox addresses, merges watch/retry metadata without replacing unrelated connection configuration, and uses bounded exponential backoff capped at six hours.
- Added `.github/workflows/provider-realtime-email-sync.yml` for focused webhook/history/watch/checkpoint tests and web/worker typechecks. The workflow is push/PR triggered; it was not waited on or inspected in keeping with the no-polling instruction. Tests/typechecks have not been independently executed in this session.
- Google Cloud configuration, database migration application, actual Pub/Sub delivery, and independent-account delivery timing remain external acceptance items. No GCP/secret-management connector is available in this session, so cloud settings were documented but not applied.

Zoho research note: official Zoho Mail docs describe product-configured outgoing webhooks for incoming email events, but the public Zoho Mail REST API index does not expose a general mailbox event subscription endpoint. The separate Zoho Campaigns webhook API is not equivalent. Default to IMAP IDLE where credentials/protocol access permit, with API polling fallback.


### PR tracking correction — 2026-10-16

PR #18 and PR #19 are closed/merged. The initial realtime inbox refresh and Gmail push foundation are present on `main`. The follow-up hardening is tracked in [PR #21](https://github.com/Rilan-Dev/ai-comms-agent/pull/21), an open draft targeting `main`. Do not describe PR #19 as still draft. Focused workflow results remain uninspected; no claim of passing tests, live Pub/Sub, applied production migration, or end-to-end latency is made.


### IMAP IDLE source progress — 2026-10-16

- Added RFC 2177 IDLE support to `ImapSmtpAdapter`: detect the server's advertised `IDLE` capability, select `INBOX`, wait for `EXISTS`/`EXPUNGE`/`FETCH`/`VANISHED`, send `DONE` before returning, and reissue at a 25-minute maximum wait.
- Added `apps/worker/src/email/imap-idle-worker.ts`, started from the worker entrypoint. It maintains up to 20 connected-account watchers, reconnects with bounded backoff, backs off six hours for servers that do not advertise IDLE, and persists account-scoped change signals via `email_sync_states.pending_push_at` so the existing reconciliation worker performs the actual fetch/persist/checkpoint.
- Added focused parser tests and included them in the focused GitHub workflow. Periodic mailbox polling remains the fallback.
- **Not verified:** IMAP IDLE socket integration, live provider behavior, tests/typechecks, database migration presence in deployed DB, reconnect behavior against real servers, and per-provider latency. Source has been committed but the focused workflow is not being polled.

Zoho source research: official Zoho Mail docs describe product-configured outgoing webhooks for incoming emails, signed with `X-Hook-Signature` HMAC-SHA256 and an `X-Hook-Secret` revealed on the first request. This is not a general REST API subscription endpoint; do not accept an unauthenticated first request as trusted. IMAP IDLE is the fallback for Zoho accounts where IMAP access is enabled.


### Zoho Mail outgoing webhook implementation — 2026-10-16

- Official Zoho Mail documentation confirms product-configured outgoing webhooks for Mail events, with `X-Hook-Signature` HMAC-SHA256 and `X-Hook-Secret` supplied on the first request. This is a UI-configured mechanism, not a general public Mail REST API subscription endpoint.
- Added admin endpoint `POST /api/email-accounts/[accountId]/zoho-webhook` to rotate a random account-scoped URL token, store only its SHA-256 hash in `connection_config`, clear any old HMAC secret from encrypted credentials, and return the URL once.
- Added `POST /api/webhooks/zoho/[token]`: resolve exactly one Zoho account using the token hash; verify HMAC in constant time; bootstrap the first secret only through the unguessable URL; store that secret in encrypted account credentials; ignore webhook payload as authoritative mail content; and persist a `pending_push_at` reconciliation signal.
- Added account UI to generate/copy the one-time URL, with instructions to configure Zoho Mail Settings → Integrations → Developer Space → Outgoing Webhooks and select Limited Data List. The endpoint URL is a bearer secret; regenerate it if exposed.
- Added focused tests for HMAC bootstrap, invalid signature, later requests without `X-Hook-Secret`, paused account, unknown token, and malformed payload; included them in the focused workflow.
- **Not verified:** tests/typechecks, live Zoho webhook handshake, signature behavior against a real Zoho account, actual provider delivery, or deployed latency. Polling remains the fallback.


### Outlook / Microsoft 365 source progress — 2026-10-16

- Added a Microsoft Graph adapter registered as `microsoft_graph`, with inbox folder listing, full/incremental inbox delta synchronization, `@odata.nextLink` pagination, persisted `@odata.deltaLink`, deleted-message handling, token refresh, and fail-closed Graph URL validation. Unsupported send/draft/write operations remain explicitly disabled in its capability set.
- Added Microsoft OAuth PKCE start/callback using server-side `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, and optional `MICROSOFT_OAUTH_TENANT_ID`; tokens and client secret are stored in encrypted account credentials.
- Added Graph subscription create/renew worker with per-account encrypted `clientState`, 48-hour subscriptions, 24-hour renewal threshold, retry backoff, and an HTTPS notification endpoint.
- Added Graph webhook validation-token response and notification handling that verifies subscription ID plus `clientState` before queueing durable reconciliation. Added adapter and webhook tests and wired them into the focused workflow.
- Added Outlook connection/sync controls to the mail accounts UI and extended the worker's provider query/registry to include Microsoft Graph.
- **Not verified:** web/worker typechecks, tests, live Entra OAuth, Graph subscription validation, actual notification delivery, full mailbox delta behavior against a real tenant, or latency. The `sync_webhook` capability remains false until live acceptance.
### Main branch status correction — 2026-10-16

GitHub reports PR #21 merged into `main` at `99c2de656bfa6108e4b8df0369c6eef74f48751a`. Main now contains Gmail watch-on-connect/config hardening, signed webhook and history tests, focused test/typecheck workflow, the Pub/Sub setup helper, and the first IMAP IDLE watcher. The merge status does not mean tests or typechecks passed: the focused workflow result has not been inspected, and live GCP/IMAP delivery, migration application, and latency acceptance remain unverified. Continue development without polling CI, but do not label these runtime paths production-verified.


### 2026-10-16 — Email RAG architecture review
- DEV-01 reviewed current email indexing/RAG before touching product code and added `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md` (commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`).
- Recommendation: hybrid PostgreSQL + Qdrant; PostgreSQL is authoritative for exact structured/time queries, Qdrant is a derived semantic candidate index, and final results are revalidated against current account bindings and PostgreSQL.
- Current source gap: PostgreSQL chunks are persisted, but the concrete supported Clara vector adapter is unbound and the vector-sync loop is not started from worker startup. Existing local retrieval is SQL/FTS/ILIKE, not proven Qdrant search.
- ISS-026 remains FIX-01-owned and open; no email vector retrieval should be exposed until active agent-account authorization is established. Tests/typechecks/build/live vector/latency checks were not run.
- **Next action:** review/correct the proposal and establish the adapter/security contract before material implementation. OPS-01 owns live infrastructure and ingestion/performance acceptance.


### 2026-10-16 — Clara email-vector API investigation
- Follow-up source review confirmed Clara main has internal KB-scoped Qdrant upsert/delete functions and a KB-scoped search endpoint, but no supported server-to-server email-vector API. See the updated email RAG plan at commit `0994cdd0a9388ee10b57ebc759d05a2eb4117f20`.
- Do not call Clara internals cross-repo or use the KB search endpoint for email retrieval. The supported API must provide deterministic vector lifecycle operations and mandatory org + allowed-account filtering.
- ISS-026 remains open/FIX-01-owned. Adapter/outbox startup and retrieval remain blocked until API and security contracts exist. No tests or live Qdrant checks were run.



### 2026-10-16 — Clara email-vector API draft implementation
- User explicitly authorized cross-repository changes in Clara-AI-Platform. DEV-01 opened draft PR #298: https://github.com/Rilan-Dev/Clara-AI-Platform/pull/298.
- The API draft now has a documented server-to-server contract, deterministic vector IDs, separate org/model collections, upsert/stale cleanup, metadata-only update, message/account/org deletion, and semantic search requiring an organization and explicit allowed-account set.
- This is not yet production-ready or executable-verified. No typecheck/tests/lint/build, live Qdrant/embedding, isolation runtime, ingestion, or latency evidence is claimed.
- ISS-026 remains open/FIX-01-owned; keep ai-comms-agent's vector outbox unbound and user-facing retrieval disabled until it closes. OPS-01 owns live infra/ingestion/performance acceptance.



### 2026-10-16 — Unbound Clara vector adapter added
- Added `apps/worker/src/knowledge/clara-email-vector-adapter.ts` plus request-contract tests. The adapter targets Clara draft PR #298 and passes deterministic source IDs and content/metadata/chunk hashes; it is not imported by worker startup and does not start the outbox loop.
- The Clara API contract was updated to allow nullable received timestamps and a hash-aware metadata-only upsert path. Source is authored only; no executable checks or live vector calls are claimed.
- ISS-026 remains FIX-01-owned/open. Do not wire adapter or expose user-facing retrieval before that closes. OPS-01 retains production credential/Qdrant/ingestion/latency work.

### 2026-10-16 — email vector source review corrections

- Focused review found stale payload metadata could survive source changes because absent sender/folder values were omitted from adapter upserts. Adapter now sends explicit null/empty values when source metadata includes those fields; Clara route/store types accept explicit clears.
- Clara request-body size enforcement now uses UTF-8 byte length.
- Added opt-in actual-Qdrant filter/deletion integration coverage in src/modules/email-vectors/core/qdrant-filter.integration.test.ts; requires QDRANT_INTEGRATION_URL and optionally QDRANT_INTEGRATION_API_KEY.
- Source-authored only. No test/typecheck/live Qdrant result is claimed.
- ISS-026 remains FIX-01-owned/open. Adapter remains unbound; vector-sync loop remains stopped; no user-facing email retrieval is exposed.

### 2026-10-16 — shared email hybrid retrieval core authored (not transport-wired)

- Added shared host retrieval core in `packages/db/src/email/hybrid-retrieval.ts` with fresh DB-resolved agent/account bindings, `primary`/`read_only` role checks, bounded PostgreSQL lexical retrieval, Clara vector candidate fusion, final authoritative SQL revalidation, and message citation tokens.
- Added `packages/db/src/email/clara-vector-search.ts` to call the authenticated Clara search API, with timeout/HTTPS/credential checks and defensive org/account filtering. Exported both through `packages/db/src/index.ts`.
- Semantic candidates now carry the indexed content hash. The shared service discards semantic-only candidates if the current PostgreSQL source hash is missing or differs; returned snippets/metadata always come from SQL.
- Added worker test source for fresh binding resolution, out-of-scope candidate filtering, final SQL revalidation, degraded lexical fallback, and Clara adapter scope/credential handling.
- Chat route, realtime voice runtime and worker startup were deliberately not wired; ISS-026 remains open and FIX-01-owned. The outbox loop remains stopped.
- Source edits only. No tests/typecheck/lint/build/live service or Qdrant integration execution was performed.
