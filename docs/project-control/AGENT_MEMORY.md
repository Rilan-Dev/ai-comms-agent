# APCP Shared Agent Memory

This is the shared, durable memory layer for all APCP agents. It is a memory/lessons record, not an authorization source.

## Authority order

1. Current explicit owner requirement
2. Repository-local governing instructions
3. GitHub committed source/state
4. Active authorization and project-control state
5. This shared memory
6. Per-agent memory
7. Chat/session memory

Memory never overrides current requirements, authorization, or repository truth.

## Purpose

Record reusable lessons so a newly invoked agent can avoid repeating known mistakes without needing a previous chat.

Record:
- recurring bugs and root causes;
- failed approaches and why they failed;
- successful remedies;
- regression-prevention rules;
- environment/deployment lessons;
- cross-agent lessons that materially affect future work.

Never record secrets, tokens, passwords, private keys, or sensitive personal data.

## Read-first rule

Every invoked agent reads this file before starting work, then reads its own role-local MEMORY.md and WORKLOG.md. The agent also reads AGENT_EVENTS.md, AGENT_SESSIONS.md, AGENT_HANDOFF.md, and AGENT_BACKLOG.md when relevant.

## Entry format

Append lessons under the owning agent section:

- **Date/session:** <date / session id>
- **Agent:** <agent id>
- **Issue/symptom:** <what happened>
- **Root cause:** <confirmed cause>
- **Failed approach:** <what did not work and why>
- **Remedy:** <what worked>
- **Prevention:** <how future agents should avoid recurrence>
- **Related record:** <issue/event/commit/path>

## Agent memory sections

### DEV-01 / Forge
<!-- Append durable development lessons here. -->

### FIX-01 / Sentinel
<!-- Append durable error/root-cause lessons here. -->

### OPS-01 / Shipwright
<!-- Append durable CI/CD/deployment/infrastructure lessons here. -->

### WORK-01 / Rover
<!-- Append durable daily-worker/maintenance lessons here. -->

## Memory conflict rule

If shared memory conflicts with current repository state or current requirements, ignore the stale memory, record the conflict in AGENT_EVENTS.md or ISSUES.md when material, and follow current repository truth.


### FIX-01 / Sentinel — 2026-10-09
- **Issue/symptom:** Live agent creation failed with SQLSTATE 23502 on `audit_events.resource_type` after the latest migration chain passed.
- **Root cause:** `CREATE TABLE IF NOT EXISTS` does not reconcile old table shape. The live database kept retired `resource_type` and `outcome` NOT NULL columns while current code writes `target_type` and `decision`.
- **Failed approach:** Adding only missing current columns (`agent_id`, `decision`) was insufficient because legacy constraints still rejected new writes.
- **Remedy:** Use a forward-only conditional migration to relax NOT NULL on retired compatibility columns, guarded by `information_schema.columns`; retain historical data and don't manually alter production schema.
- **Prevention:** For every live schema-drift incident, compare the full set of required/legacy columns and constraints against current INSERT statements, not just missing-column errors.
- **Related record:** ISS-008; migration `0024_audit_legacy_column_compatibility.sql`; commits `14bea1c3`, `4ef3921d`.


### FIX-01 / Sentinel — 2026-10-09
- **Issue/symptom:** `POST /api/email-accounts` returned `403 not_member` for the organization ID selected by the UI.
- **Root cause:** The email-account server page used the seeded development organization rather than the active organization resolved for the authenticated user.
- **Failed approach:** Treating every `not_member` response as a membership-provisioning defect or weakening the authorization check would hide a client tenant-context bug and risk cross-tenant access.
- **Remedy:** Use `getAuthenticatedAppContext()` with request headers in the server page and pass that membership's organization ID into both the query and client; keep API membership/role authorization intact.
- **Prevention:** Every tenant-scoped server page must derive its organization from the authenticated request context, not dev seed globals or arbitrary client values. Add regression tests for this boundary.
- **Related record:** ISS-009; commits `4536332f`, `7a3cfba2`.


### DEV-01 / Forge — 2026-10-09
- Issue/symptom: Gmail OAuth start required static GMAIL_OAUTH_CLIENT_ID and SESSION_SIGNING_KEY environment configuration; user needs multiple configurable Gmail OAuth clients.
- Root cause: OAuth start/callback were environment-bound and always used the development identity context.
- Remedy: Persist organization-scoped OAuth client records, encrypt client secrets with the existing server-side credentials master key, expose admin-only Settings CRUD, let mailbox connection select a client, and store the selected client credentials inside the encrypted account credential envelope so worker refresh uses the same client.
- Prevention: Provider-specific client registrations are runtime configuration data, not code constants or deployment env vars. Keep only the root encryption key as infrastructure secret; never store the root key in the database it protects or expose provider secrets to the browser.
- Related record: ISS-010; migration 0026_gmail_oauth_configuration.sql.


### DEV-01 / Forge — 2026-10-09 migration sequencing
- Check existing migration filenames before adding a migration and avoid colliding with the current/latest sequence even though older historical migration groups contain duplicate prefixes. The recent sequence is guarded by a regression test.
- Gmail OAuth configuration migration is `0026_gmail_oauth_configuration.sql`; WhatsApp outbound claim lifecycle is `0025_whatsapp_outbound_claim_lifecycle.sql`.


### DEV-01 / Forge — Dynamic OAuth callback origins (2026-10-09)
- Do not derive provider callback URLs from a fixed `NEXT_PUBLIC_APP_URL`; derive from the incoming public request origin and carry the exact callback URI in signed OAuth state so code exchange uses the same value.
- Public OAuth callbacks require HTTPS and provider-side exact redirect URI registration. Google web clients reject raw IP hosts; an HTTP private IP cannot be made valid by code changes alone.
- OAuth client IDs/secrets belong in organization-scoped Settings and encrypted persistence; worker refresh must use the per-account client used at consent, not global env defaults.
- Zoho now follows the same multi-client UI pattern as Gmail; migration 0027 must be applied before settings work.


### DEV-01 / Forge — 2026-10-09 draft discoverability
- **Issue/symptom:** Persisted Drafts loaded all rows but had no search control, making saved/provider-synced drafts difficult to find as mailbox volume grows.
- **Root cause:** The UI rendered the fetched array directly without query state or searchable-field normalization.
- **Remedy:** Add client-side search across subject, body, recipient addresses, and mailbox address while retaining the organization-scoped persisted API as the source of records; display a distinct no-match state.
- **Prevention:** For bounded list screens, make common search fields discoverable and distinguish an empty dataset from a query with no matches. Keep tenant scoping in the server/API boundary.
- **Related record:** `apps/web/src/app/mail/drafts/drafts-client.tsx`; commit `8ccf1cb24039cb3bc745a51576a73ee68007e946`.

### FIX-01 / Sentinel — 2026-10-09 — Gmail worker credential snapshot contract
- **Issue/symptom:** Docker worker build fails at mailbox-sync-worker.ts:156 and :201. Gmail snapshot returns Record<string, unknown> while the worker contract requires EmailCredentials; persistence also rejects EmailCredentials as Record<string, unknown>.
- **Root cause:** Provider snapshot types differ across layers: Gmail exposes a generic record, Zoho exposes EmailCredentials, and the DB repository accepts a generic payload.
- **Failed approach:** Typing the adapter union as an intersection cannot reconcile incompatible method return types. EmailCredentials also lacks a string index signature for direct Record assignment.
- **Remedy:** Gmail snapshot now returns EmailCredentials; spread the typed snapshot into a plain record at the persistence boundary. Add a focused snapshot contract test.
- **Prevention:** Keep adapter snapshots on shared domain types and convert to storage-specific generic payloads only at the repository boundary.
- **Related record:** EVT-FIX01-WORKER-CREDENTIALS-20261009; ISS-013; commits caad1d75, 04a2345b, a98c0e7f. Tests/typecheck not yet executed.


### FIX-01 / Sentinel — 2026-10-09 — Malformed Zoho OAuth test newline escapes
- **Symptom:** User ran `pnpm run typecheck`; shared/db/clara-core typechecks passed and worker typecheck passed, but web TypeScript failed at `apps/web/tests/zoho-oauth-settings.test.ts:84` with TS1127 invalid character and TS1434 unexpected keyword/identifier.
- **Root cause:** Three assertions in the test contained the two-character literal sequence `\n` after semicolons instead of actual source line breaks. TypeScript therefore parsed backslashes as invalid source characters.
- **Failed approach:** Treating this as an OAuth implementation/type defect would expand scope incorrectly; the reported parser positions point to malformed test source. No broad rewrite is needed.
- **Remedy:** Replaced only the malformed literal newline sequences between the three `expect(helper).toContain(...)` assertions with real line breaks. Commit `39857c40820940b500dcf452331dfe82ae35b861`.
- **Prevention:** When inserting source through JSON/API or generated patches, inspect escaping at the actual file layer; ensure `\n` is decoded to a source newline rather than committed literally.
- **Verification:** User-provided output proves worker and shared package typechecks passed before this correction; web typecheck failed at the malformed test. The web typecheck has not yet been rerun after the fix.


### FIX-01 / Sentinel — 2026-10-09 — OAuth focused-test assertion mismatch
- **Evidence:** User's latest `pnpm run typecheck` passed across all workspaces. Focused Zoho OAuth test then reported 8 passing and 2 failing assertions.
- **Root cause:** The implementation intentionally rejects raw IP hosts before protocol validation, so an HTTP raw-IP URL raises the DNS/raw-IP error, not HTTPS. A static source assertion also incorrectly rejected the explanatory comment mentioning `NEXT_PUBLIC_APP_URL` rather than only rejecting runtime `process.env.NEXT_PUBLIC_APP_URL` usage.
- **Remedy:** Adjusted the two test expectations only; no OAuth runtime implementation changed. Commit `c58d6d442767f471c694ef978fdb06eca6d29850`.
- **Prevention:** Tests should assert observable security behavior and actual forbidden runtime references, not incidental error ordering or harmless comments.
- **Status:** Test source corrected; focused rerun pending.


### FIX-01 / Sentinel — 2026-10-09 — Live schema drift and Redis lease diagnostics
- **Evidence:** Live app queries failed because the database lacked `ai_provider_configs.model` and `email_sync_states.last_attempt_at`; worker lease logs collapsed Redis server errors to a generic string.
- **Remedy:** Use a forward-only idempotent migration for schema drift; retain a bounded Redis RESP error reply for diagnosis and cover WRONGPASS behavior.
- **Prevention:** A running container/healthy worker is not proof that its database schema or Redis authentication is correct. Never disable distributed locking to make a worker proceed after lease acquisition errors.
- **Status:** Source committed; live migration and Redis diagnosis pending OPS-01. No tests/runtime PASS claimed.


### FIX-01 / Sentinel — 2026-10-09 — Live schema drift and Redis lease diagnostics
- **Evidence:** Live app queries failed because the database lacked `ai_provider_configs.model` and `email_sync_states.last_attempt_at`; worker lease logs collapsed Redis server errors to a generic string.
- **Remedy:** Use a forward-only idempotent migration for schema drift; retain a bounded Redis RESP error reply for diagnosis and cover WRONGPASS behavior.
- **Prevention:** A running container/healthy worker is not proof that its database schema or Redis authentication is correct. Never disable distributed locking to make a worker proceed after lease acquisition errors.
- **Status:** Source committed; live migration and Redis diagnosis pending OPS-01. No tests/runtime PASS claimed.

### DEV-01 / Forge — 2026-10-09 — Lovable UI screen adaptation
- **Issue/symptom:** The visual reference contains preview-only demo data/actions and uses TanStack Start/Vite, while the production app is Next.js and backed by real PostgreSQL/API behavior.
- **Root cause:** UI components cannot be transplanted wholesale without changing framework assumptions or replacing real application behavior with demo interactions.
- **Failed approach:** Blind route/component copying from `source/lovable-ui` would mismatch router, runtime and dependencies.
- **Remedy:** Port the visual system (semantic colors, typography, compact geometry, inline SVG iconography and layout composition) into the existing route while leaving API calls, state transitions and validation intact; add source-level contract assertions for important actions.
- **Prevention:** For every migrated screen, enumerate its current API actions, validation, loading/empty/error states and navigation before restyling; assert those contracts after the visual edit. Record that static test source is not test execution.
- **Related record:** `DEV01-LOVABLE-UI-MIGRATION-20261009`; commits `9de78b0f`, `c9641d9d`, `0aef87b0`.


### DEV-01 / Forge — 2026-10-09
- **Date/session:** DEV01-LOVABLE-UI-CONTINUATION-20261009
- **Issue/symptom:** Owner requested a complete accounting of which Lovable UI screens have and have not been migrated.
- **Root cause:** Earlier migration notes summarized a route tranche but did not provide a single exhaustive route-level matrix; global CSS adoption could be mistaken for complete migration.
- **Failed approach:** Treating shared theme tokens or general styling as proof that every screen is migrated.
- **Remedy:** Maintain `docs/project-control/LOVABLE_UI_MIGRATION.md` as the explicit route checklist and distinguish adapted source from verified behavior.
- **Prevention:** Update the matrix and NEXT_ACTION after every tranche; preserve live functionality and validation, add contract assertions, and honestly record tests/browser verification as not run.
- **Related record:** Commits `70738aa2`, `3cf94c7f`, `c2dd6e6e`, `740b70d2`, `2f1eecd5`; `docs/project-control/NEXT_ACTION.md`.


- **Follow-up:** Chat UI adaptation should preserve streamed responses, conversation/agent switching, optimistic user messages, visible system errors, keyboard send behavior, and the voice workspace link. Visual edits must not replace the existing server API with the Lovable preview's mock content. Related commits: `dee40027`, `10b87d65`.

- Follow-up: Voice UI changes must preserve Clara-owned session/turn endpoints, microphone permission/denial behavior, session lifecycle, provider/transport status, server-only credentials, and existing approval/auth boundaries. Verify endpoint paths against source before writing static contract assertions. Related: 84652b74, f7ed2b42.

- **Clara indexing boundary lesson (2026-10-09):** The reference `knowledge-bases/worker/ingest-worker.ts` imports Clara-specific `@/lib/db`, provider resolution, document loaders, and direct Qdrant helpers; it is not a drop-in host API for this PostgreSQL application. Do not copy or mutate immutable Clara source, and do not claim semantic/vector indexing from a PostgreSQL-only adapter. A host adapter may write idempotent organization-scoped records to the existing `knowledge_documents` / `knowledge_chunks` contract; shared (`agent_id IS NULL`) knowledge must be visible to organization agents, while agent-specific knowledge must be restricted to that agent. For a request with no agent, return shared knowledge only. RabbitMQ retry assertions must protect retry bounds, idempotency/correlation metadata, DLQ routing, and only ack the original after retry/DLQ publish confirmation. 

### DEV-01 / Forge — Activity and Audit UI migration (2026-10-09)
- Keep Activity sourced from the real organization-authorized audit API; filters may operate on the loaded event window but must not fabricate activity. Preserve honest loading/empty/error states and accessible labels.
- Audit filters must actually affect server queries, not just export URLs or local labels. Use abort/cancellation so older in-flight responses cannot overwrite newer filter results. Preserve the existing `audit.read` authorization boundary and API export routes.
- Record source adaptation separately from verification; static contract assertions are not evidence that tests/typecheck/build/browser/API checks passed.
- Related commits: Activity `a0830b13`, Audit `7c118bbd`, static contracts `23d9c3fc` / `7419f572`.


### DEV-01 / Forge — Operations status semantics (2026-10-09)
- Never render dependency configuration as live health. If the API reports “healthy” only because a URL exists and says runtime connectivity is worker-owned, show a neutral “Configured” status. Only display “Healthy” for an actual verified check.
- Preserve API authorization and the distinction between configuration checks and runtime evidence; UI labels must not overstate health.
- Related commits: Operations `fc22cc3f`; static contract assertions `ddb7a233` / `ca229779`.


### DEV-01 / Forge — Settings UI adaptation
- When restyling settings, preserve API contracts and all security cues: API keys/client secrets stay password inputs, saved secrets remain hidden, and OAuth callback-origin warnings/data-center choices must remain visible. Do not claim successful provider connectivity from a saved configuration alone.
- Prefer the shared compact geometry and semantic border/background tokens across provider subcomponents; keep existing edit/delete confirmations and role/membership safeguards.
- Related commits: `25d17e19`, `ecd6f403`, `68cb6fba`, `e324defd`, contract assertions `399b60a6`.


### DEV-01 / Forge — Avoid duplicate agent creation flows (2026-10-09)
- Before adapting secondary routes, verify every visible CTA has a real action. If an orphan create route duplicates an existing canonical flow but does not persist data, redirect to the canonical form rather than maintaining two divergent implementations.
- Keep organization context, slug validation, persistence and initial version/policy creation in the existing Agents workspace.
- Related commits: `1cec6ca9` redirect, `cb914148` static contract.


### DEV-01 / Forge — shell accessibility review (2026-10-09)
- Sticky section navigation beneath a 64px global top bar should use `top-[64px]` and a lower stacking level to avoid overlap.
- Mobile navigation triggers should expose expanded/control relationships; an open drawer should close on Escape as well as backdrop/close-button activation.
- Static source assertions are not executed test results. Report verification as NOT RUN unless actual runner/browser output is available.

### DEV-01 / Forge — keyboard and live-region follow-up (2026-10-09)
- Modal semantics alone do not provide dialog accessibility: manage initial focus, Tab/Shift+Tab containment, Escape, and focus restoration. Make modal overlays vertically scrollable so short viewports do not clip the actions.
- A mobile navigation drawer also needs focus containment and return-to-trigger behavior; `aria-expanded` / `aria-controls` are useful but not a replacement for keyboard management.
- For streamed Chat, use a labelled log with `aria-relevant="additions"` to avoid repeatedly announcing every streamed token, and a polite status for the busy state. Give every secondary select an explicit accessible name if no visible label is associated.
- Source-contract tests document intended behavior but are not executed accessibility evidence. Keep browser, screen-reader and narrow-device checks marked NOT RUN until performed.
- Related commits: agent dialog/channel selectors `d73099d6`; Chat status/composer `3d8ac3a3`; mobile drawer `837b4b19`; assertions `0a603b76`, `f8c3aefd`.

- **Mobile secondary-control lesson (2026-10-09):** Do not hide a core selector or workflow action at the mobile breakpoint without providing an equivalent control. Chat's agent selector is now always available with a constrained mobile width and an explicit accessible name. Source `bc8e698f`, static assertion `ad7dc7f8`; device validation remains NOT RUN.

### FIX-01 / Sentinel — 2026-10-09 — pnpm lockfile dependency graph
- **Issue/symptom:** Workspace install/typecheck and Docker image build stop with `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` for `amqplib@2.2.0`; `pnpm install --fix-lockfile` repeats the same failure.
- **Root cause:** The affected lockfile had concatenated YAML documents and the active workspace document lacked the package and snapshot records referenced by the worker importer.
- **Failed approach:** Retrying install/typecheck or asking pnpm to repair the already malformed file did not rebuild the missing dependency graph.
- **Remedy:** Current main has normalized lockfile commit `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`; static regression assertions added in `b9ba0c6738e32cf4ef8b670a4b65857a56eb50f2`.
- **Prevention:** Check the worker importer, package resolution, snapshot, and single-document structure together. A source assertion is not proof the package manager accepts the lockfile; run frozen install before typecheck and record actual output.
- **Verification:** Frozen install/test/typecheck/Docker build still NOT RUN after correction.
- **Related:** ISS-017; FIX01-PNPM-LOCKFILE-20261009; `apps/web/tests/migration-verification.test.ts`.

### FIX-01 / Sentinel — 2026-10-09 — pnpm tarball integrity follow-up
- **New symptom:** After the missing package/snapshot entries were repaired, pnpm 12.8.1 rejected `amqplib@2.2.0` with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`.
- **Root cause:** The lockfile entry had a tarball URL but no SRI hash; pnpm's supply-chain check could not verify the downloaded package.
- **Remedy:** Added the published SHA-512 integrity value to the existing amqplib lock entry (commit `644d5781`); did not change dependency range/version or disable security policy.
- **Regression:** Added an assertion that the `amqplib@2.2.0` package entry itself has a SHA-512 integrity resolution (commits `21837f32`, `d115e1b0`).
- **Failed approach:** Frozen install, typecheck, and Vitest all stopped at dependency install; no compiler or tests ran.
- **Prevention:** Every external tarball lock resolution must retain its published integrity metadata. Never synthesize hashes or bypass pnpm supply-chain verification.
- **Verification:** Source committed; frozen install/typecheck/Vitest/Docker build remain NOT RUN after this fix.

- **Regression-test lesson (2026-10-09):** When writing regex assertions in TypeScript source through APIs that also require string escaping, inspect the resulting committed source. A test that is committed is not automatically a valid test; check the actual regex literals and execute the focused test after frozen install succeeds. The lockfile test regexes were corrected in commit `162183e8`; execution remains pending.

### FIX-01 / Sentinel — 2026-10-09 — worker URL narrowing and migration filenames
- **Issue/symptom:** Frozen install passed, but typecheck reported string | undefined passed to amqp.connect inside the RabbitMQ reconnect closure; focused migration tests failed to collect because they referenced removed 0003 and 0004 filenames.
- **Root cause:** Optional environment config was captured by nested reconnect code without a definite-string type; test paths lagged canonical migration renumbering (0003 → 0013, 0004 → 0005).
- **Failed approach to avoid:** Do not recreate old migration filenames or duplicate SQL to satisfy stale tests. Do not treat worker SIGKILL as a compiler diagnostic.
- **Remedy:** Normalize consumer URL with ?.trim() ?? "" and preserve the no-config early return; update tests to current migration paths. Commits 09e4df46, a24edec3, ffc98b30.
- **Prevention:** Keep tests synchronized with the authoritative migration chain. Execute focused package checks sequentially when workspace concurrency produces SIGKILL.
- **Verification:** Source only; post-fix tests/typechecks NOT RUN.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


### FIX-01 / Sentinel — 2026-10-09 — Migration and worker contract test drift
- **Issue/symptom:** User reported migration static tests failing on audit-event policy assertions and DO-block delimiters; worker contract tests failed on retry-envelope metadata and a forbidden-vector-backend assertion.
- **Root cause:** The migration used valid standard PostgreSQL `DO $$ ... $$` delimiters while tests required a specific named tag and included over-escaped regexes. Audit read/insert policy names and explicit append-only documentation were absent from the Phase 4 base migration artifact. Worker retry logic preserves idempotency/correlation by spreading `...envelope`, while the test demanded redundant explicit field assignments; the indexer comment mentioned Qdrant, so a blanket word-ban falsely failed without detecting an actual client call.
- **Failed approach:** Do not change every valid SQL DO block just to satisfy a brittle delimiter-specific test; do not duplicate envelope fields solely for a source-regex assertion; do not forbid documentation from naming an intentionally unused backend.
- **Remedy:** Added forward-only migration `0032_audit_event_access_hardening.sql` with organization-scoped audit insert/read policies and restrictive UPDATE/DELETE denial; aligned static tests with valid PostgreSQL delimiters, the new forward migration, retry-envelope spread semantics, and actual vector-client imports/calls.
- **Prevention:** Test behavior/contracts, not incidental source spelling. For already-deployed schemas, add forward-only migrations rather than editing historical migrations. After source/API writes, inspect the committed literal regex and run focused tests.
- **Evidence:** Commits `7557a6cd`, `ee85b554`, `cecae73e`, `c4d4abd0`, `96996d82`; no local test execution available in this session.
- **Next action:** Pull latest main, compare local lockfile to origin/main (current main has exactly one lockfileVersion and one importers header), run focused migration and worker tests, then web/worker typechecks sequentially. No PASS claimed.


### FIX-01 / Sentinel — 2026-10-10 — Membership role rank must cover the complete union
- **Issue/symptom:** Docker web build compiled JavaScript but TypeScript failed because `Record<MembershipRole, number>` omitted `viewer`.
- **Root cause:** Shared `MembershipRole` includes `owner | admin | member | viewer`, while the minimum-role rank map only included member/admin/owner. The rank map is exhaustive by design, so TypeScript correctly rejected it.
- **Failed approaches to avoid:** Do not remove `Record<MembershipRole, number>`, cast away the missing key, or change the shared role union to silence the error. Those approaches weaken exhaustiveness or alter the domain model.
- **Remedy:** Add `viewer: 0` to the hierarchy, preserving `viewer < member < admin < owner`; add regression cases proving viewer fails a member minimum and admin/owner satisfy it.
- **Prevention:** When a union type expands, update every exhaustive record/switch and test the security semantics of the new member. Typecheck the web workspace after the source change.
- **Evidence:** Commits `44a08522f23e807755114ebe46b8b1e04e6056da` (source) and `3853ecf046c175e15a4f824e9679f50fb7132cf9` (regression test). Test/build/typecheck not run by this agent.
- **Next action:** Run the focused RBAC Vitest file and web typecheck locally; route Docker/runtime or CI/deployment-only issues to OPS-01.


### FIX01-RBAC-TEST-FIXTURE-FOLLOWUP-20261010
- **User-provided evidence:** Focused Vitest reported 15 passed / 1 failed. The new ADMIN/OWNER minimum-role test failed with `UnauthorizedError: Authentication required`; web typecheck reported TS2339 because `TestFixture` has no `adminA` property at `tests/rbac.test.ts:312`.
- **Root cause:** The regression test referenced a nonexistent fixture user (`fixture.adminA`). The undefined ID caused the auth adapter to resolve no user, so the test failed before reaching `requireRole`. This was a test-fixture defect, not evidence that the production rank comparison was wrong.
- **Failed approach:** Assuming a preconfigured admin fixture exists. Do not add a fake fixture property or weaken authentication to make the test pass.
- **Correction:** Commit `113b2b3ee094042e9380404f3073c39b17e07951` changes the test to promote the existing `fixture.memberA` to admin through the repository, then verifies that authenticated admin and owner subjects both satisfy `requireRole(subject, "member")`.
- **Verification:** User's pre-correction run proves 15/16 tests passed and typecheck failed on the invalid fixture reference. The corrected test source has been committed, but the focused test, typecheck, and Docker build have NOT been rerun after correction. No PASS claimed.
- **Environment preservation:** User reports local `pnpm-lock.yaml` is modified. Do not overwrite or restore it as part of this source fix; inspect its diff separately against `origin/main`.
- **Next action:** Rerun the focused RBAC test, then web typecheck, then `bash scripts/manual-up.sh`; record actual output. Do not wait for CI/Vercel. Route only independent Docker/registry/daemon/runtime environment defects to OPS-01.


### FIX01-EMAIL-ACCOUNT-RUNTIME-DIAGNOSTICS-20261010
- **User report:** Deployed app starts, but `POST https://aca.ostechnologies.in/api/email-accounts` returns HTTP 502 during IMAP/SMTP configuration; connected OAuth mailboxes do not appear to import messages.
- **User-provided startup evidence:** Focused RBAC suite passed 16/16, web typecheck passed, Docker web/worker images built, migrations reported complete, and both containers started. This proves build/startup only; it does not prove mailbox sync.
- **Source findings:** `apps/web/src/app/api/email-accounts/route.ts` returns HTTP 502 with `provider_connection_failed` when the IMAP/SMTP connection test throws; DNS, TCP timeout/refusal/reset receive targeted messages. A Cloudflare 502 HTML response vs application JSON must be distinguished by comparing public and local origin. `apps/web/src/app/api/email-accounts/[accountId]/sync/route.ts` currently supports manual sync only for Gmail and returns 409 for Zoho/IMAP-SMTP; the background worker's due-account query includes Gmail, Zoho and IMAP-SMTP. OAuth completion/HTTP 202 is not proof of message persistence.
- **Diagnostic script:** Added `scripts/diagnose-email-accounts.sh` (commit `a529ffe43915495d099c17b353fb517d53fac10b`). It compares public/local liveness and account API responses, optionally runs non-persistent IMAP/SMTP tests through both paths, optionally explicitly saves after a successful test, snapshots per-account sync status/message counts from PostgreSQL, and gathers sanitized web/worker logs. It does not print the cookie/password in the report.
- **Verification:** Script committed but has NOT been run against the user's server here. No root cause for the reported live 502 or OAuth import failure is claimed yet.
- **Next action:** User runs the script from repo root and shares only the reviewed report (never cookie/password/OAuth tokens). Diagnose from public-vs-local HTTP/body, DB sync state/message counts, and worker logs before making runtime-specific code changes. Preserve local lockfile changes and do not wait for CI/Vercel.

### DEV-01 / Forge — 2026-10-12 — Email operations planning
- **Lesson:** A provider capability flag and a successful queue acknowledgement do not prove end-to-end behavior. Validate adapter methods, persisted cursor/message state, and the action policy path separately.
- **Architecture boundary:** Clara's existing tool interface is narrow; email actions belong in the host-owned application registry/services. Chat, realtime voice, WhatsApp and scheduled jobs must share execution-time authorization and audit rather than each implementing its own email logic.
- **Sync invariant:** persist/reconcile page effects before advancing a durable cursor; treat queue delivery as at-least-once; never represent failed/empty provider work as a successful import.
- **Role routing:** OPS-01 owns live broker/Redis/deployment and persisted-ingestion proof; FIX-01 owns substantial source bugs and regression protection. Planning does not transfer either role or authorize material architecture changes.


### 2026-10-16 — TypeScript credential boundary in provider workers
- **Symptom:** Clean Docker worker build fails TS2352 when `Record<string, unknown>` from decrypted credential storage is asserted directly as `EmailCredentials` in Gmail watch renewal and IMAP IDLE startup.
- **Root cause:** Repository boundary intentionally exposes untrusted decrypted JSON as a generic record; `EmailCredentials` requires a discriminant (`credential_type`) and the consumers skipped runtime validation.
- **Remedy:** Validate `credential_type` against the three supported values (`oauth_token`, `password`, `app_password`), then pass a spread object with the narrowed discriminant to the adapter. Removed unsafe type assertions.
- **Failed approach to avoid:** Do not silence TS2352 with `as unknown as EmailCredentials`; that hides malformed decrypted credential records.
- **Prevention:** Validate persisted/decrypted data at trust boundaries before passing it to typed provider adapters. Treat worker `tsc`/Docker build as the regression check.
- **Evidence:** User-provided build log identifies both source locations; corrective commits `185b729d`, `60fadabf`, `e3ba38c9`, `18948e08` on `main`. Typecheck/build not yet rerun in this environment.


### DEV-01 / Forge — 2026-10-16 — Hybrid email RAG review
- **Lesson:** PostgreSQL knowledge chunks do not prove vector embeddings or Qdrant retrieval are working. Inspect the whole lifecycle: source-message persistence → dirty/version signal → chunk persistence → embedding/vector upsert → vector search → tenant/account filter → authoritative message re-fetch → grounded response.
- **Architecture guidance:** PostgreSQL is authoritative for time ranges, counts, sender/recipient/subject/flags, permissions, message state and citations. Qdrant is a derived semantic candidate index. Hybrid search is the correct proposal for natural-language email questions, but exact temporal/count/latest queries must use SQL, not semantic top-k.
- **Security:** Every vector search must apply server-derived organization and allowed-account filters; final PostgreSQL revalidation is mandatory. Do not rely on org scope alone when mailbox bindings are the product authorization boundary. ISS-026 is FIX-01-owned and must not be bypassed by DEV-01.
- **Integration:** Do not invent a raw Qdrant client, parallel collection or undocumented Clara endpoint. Bind a supported Clara server-to-server adapter; durable vector outbox jobs must not be marked completed until upsert/delete is confirmed.
- **Performance:** Never promise 10x speed without a repeatable same-workload baseline measuring p50/p95, recall, freshness and answer/source correctness.
- **Verification:** Source inspection and docs only; no runtime/test PASS is implied.


### DEV-01 / Forge — 2026-10-16 — Clara vector adapter research
- The current Clara source does not expose a supported server-to-server email-vector API. Internal `upsertDocumentsKb` / `deleteDocumentChunks` functions are KB-scoped implementation details; `/api/embed/search` is KB-scoped retrieval with KB resolution/quota, not account-scoped email search.
- Do not import/call Clara internals cross-repo, reuse KB routes for mail, or mix email chunks into a shared KB. Define and implement an explicit authenticated API with deterministic point IDs, update/delete/purge lifecycle, allowed-account filters, and source references.
- ISS-026 remains FIX-01-owned/open. Do not bind/expose the vector retrieval path until the security contract is closed.
- Current session is source inspection/docs only; no tests/runtime/latency verification or 10x claim.


### 2026-10-16 — FIX-01 — Microsoft Graph enum mismatch
- **Lesson:** Provider support can exist in application code and a parallel enum while the enum actually attached to the persisted column remains stale. Trace the failing SQL column to its exact PostgreSQL type before changing worker logic.
- **Remedy pattern:** Add a forward-only migration for the exact type and a regression assertion that guards against altering a similarly named but unrelated enum.
- **Avoid:** Retrying deterministic SQLSTATE 22P02 through RabbitMQ/direct-sync fallback or removing the provider from the query; neither repairs schema compatibility.
- **Role boundary:** FIX-01 corrects source; OPS-01 applies migrations/restarts services and verifies live sync.


### FIX-01 / Sentinel — 2026-10-17 — WhatsApp 131047
- Meta error 131047 with an explicit expired-24-hour-window detail means free-form text was rejected by provider policy. Use an eligible approved template outside the window; do not bypass the rule or retry the same text.
- Queue acknowledgement is not delivery confirmation. Preserve distinct queued, provider-accepted/sent, delivered, read and failed states.
- When webhook evidence says failed but UI says sent, trace provider message ID through signed webhook acceptance, organization/account-scoped persistence and UI refresh before modifying code. Route live deployment/database/webhook-delivery diagnosis to OPS-01.
- Session: `docs/project-control/sessions/FIX01-WHATSAPP-131047-20261017.md`; source inspection only, no runtime PASS.
