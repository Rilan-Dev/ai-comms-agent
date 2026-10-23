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

### FIX-01 lesson — WhatsApp display labels (2026-10-17)
- Treat a user's editable account label as app-owned metadata. Provider verified names are only a fallback; both synchronous API verification and asynchronous worker verification must preserve a non-empty custom label.
- When a webhook reports `failed` but the UI says `sent`, keep the status incident open until OPS-01 correlates provider webhook HTTP outcome/accepted count with the exact organization/account-scoped row and UI/API response. Do not infer a race or deploy claim without evidence.
- Source/test commits for label correction: `fd1fda7429363091098825dbf37bba0f30be3d0f`, `7d785b36f2bae90d9d137805e1390fe9ab467550`, `f9bc5ec1cc793fb69c3b2a5a7d26e8d1cf00d5fb`. Tests and deployment have not been verified.

### 2026-10-17 — FIX-01 — Chat provider override fallback
- A saved per-agent provider override must still be resolved when `organization_ai_runtime_settings` has no row. Organization defaults are inherited values, not a prerequisite for reading `agent_ai_settings` and saved provider credentials.
- The source correction at `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0` supplies safe defaults and continues provider resolution. A missing-org-row branch was a concrete source defect, but the live database condition remains unconfirmed; OPS-01 must verify actual row/config state and the serving revision.
- Never add an OpenAI key to mask a provider-selection error when the agent explicitly selects Sarvam/Gemini. Queue/build/container health is not evidence of a successful model request. Test/deployment remain unverified.


### FIX-01 / Sentinel — 2026-10-18 — Nullable membership at chat tool-context boundary
- **Issue/symptom:** Next.js production build compiled JavaScript successfully but failed type validation at `apps/web/src/app/api/chat/stream/route.ts:384`: `subject.membership` may be null while building the trusted `ToolContext`.
- **Root cause:** The shared `AuthSubject` contract allows a nullable membership. The `authorize()` implementation guarantees active membership on success, but TypeScript cannot infer that stronger invariant through the shared return type.
- **Failed approaches:** Do not default a missing role to `member`/another role, cast away nullability, or weaken `authorize()`. Those approaches can conceal an authorization invariant and weaken fail-closed behavior. Do not route this source type error to OPS-01.
- **Remedy:** Add an explicit 403 fail-closed membership guard immediately after `authorize()`, narrowing `subject.membership` before trusted tool context is constructed. Add a regression assertion that the guard precedes `ToolContext` construction.
- **Prevention:** When a shared auth type is broader than a helper's runtime invariant, narrow at the call site explicitly; don't use a role fallback or unsafe assertion. Keep tenant and role checks intact.
- **Evidence/status:** Source commits `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9` and `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`. User log confirms worker Docker build succeeded and web build failed only during type checking; the corrected web build and test have not been rerun.
- **Related record:** ISS-030; `FIX01-CHAT-MEMBERSHIP-NULL-20261018`.

### DEV-01 / Forge — 2026-10-18 — live provider catalogues
- **Issue/symptom:** Static model lists and manual text inputs became stale and could mismatch providers/capabilities; original `/api/settings/ai-models` swallowed authorization failure and used server-global keys.
- **Root cause:** Model selection surfaces were disconnected from Clara-style vendor catalogue and the saved organization/purpose encrypted credential boundary.
- **Failed approach to avoid:** Calling an env-global provider list or silently returning curated static IDs when the vendor is unreachable; passing TTS ID into STT purpose; showing new V2 models that the current chat runtime cannot invoke.
- **Remedy:** Require org read authorization before tenant credential lookup; use fixed official vendor endpoints and capability classifications; preserve explicit unavailable and stale-selection states and separate TTS/STT.
- **Prevention:** Add mocked vendor catalog/pagination/error and auth-order tests; run them plus real credential/browser checks before acceptance. Missing vendor catalog API must be disclosed, not fabricated. Session `DEV01-LIVE-MODEL-CATALOG-20261018`. Evidence remains source-only.
### FIX-01 / Sentinel — 2026-10-18 — WhatsApp synced template row nullability

- **Symptom:** User's Docker deployment build reports Next.js compilation success, then TS18048 at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119`: `synced.rows[0]` may be undefined when reading `.components`.
- **Root cause:** The existing `if (!synced.rows.length)` guard does not narrow TypeScript's indexed array access under strict checking. The later direct access `synced.rows[0].components` remains unsafe to the type checker.
- **Failed approach:** Treating a nonzero `rows.length` check as proof that `rows[0]` is narrowed. Do not use a non-null assertion or relax compiler settings.
- **Remedy:** Bind `synced.rows[0]` to `syncedTemplate`, return the existing fail-closed 409 `template_not_synced` response if absent, then access `syncedTemplate.components`. Added a regression source assertion for the explicit row guard and safe access.
- **Prevention:** Narrow array elements directly after database writes/RETURNING operations; keep an explicit absent-row response even when a length check is present.
- **Evidence:** Source commit `90fac5e0774b695446e1e0c3ab51072639ba5f06`; regression test commit `41734923651b1173a703d747f0ac0aa93317a5b9`. User log shows worker image built/exported and web compile succeeded before type validation failed. No post-fix test or build has been run/observed.
- **Next action:** Pull latest `main` and rerun `bash scripts/update-and-up.sh` (or the documented Docker Compose build). If the build passes, run the focused `whatsapp-send-approval.test.ts` suite. Record actual results; do not infer success from source commits.


### FIX01-VOICE-GENERATION-ID-20261018 — 2026-10-18
- **Symptom:** Web build failed webpack parse with duplicate `generationId` in `apps/web/src/app/ai-voice/voice-workspace.tsx`; worker image built/exported.
- **Root cause:** Two `const generationId` declarations in one Sarvam/ElevenLabs speech fallback block.
- **Fix/test:** Reuse the existing identifier; regression assertion checks a single declaration in the provider branch. Commits `f6efffdb42dbd75df38841fab43b985eb565ee3f` and `05519965adae7ebab837a03e4d7a0d2306e3f0c1`.
- **Verification:** Post-fix build/test pending; no green claim.
- **Next:** Pull main, rebuild, run focused voice transport test, update records with actual output.



### FIX01-VOICE-RESAMPLING-INDEX-20261018 — 2026-10-18
- **Symptom:** Next.js compilation passed but web TypeScript checking failed because Float32Array indexed access is `number | undefined` in the 16 kHz audio conversion loop.
- **Fix/test:** Explicitly default a missing sample to zero in both same-rate conversion and averaging accumulation; added focused source-contract assertions. Commits `baa9746142297322c5bf796e7c6fb94060bbc9cf` and `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Verification:** Post-fix build/test pending. Do not equate source commits with a successful build.
- **Next:** Pull main, rebuild with the manual script, run focused voice transport test, and record actual evidence.

### FIX-01 lesson — strict indexed access and voice authorization context (2026-10-18)
- Guard every indexed typed-array read and split-array field that feeds a strict numeric/string API; use a conservative fallback when an absent audio sample should contribute silence.
- Narrow nullable authorization membership at the request boundary with an explicit fail-closed response. Validate the conversation ID as a string instead of trusting a wider DB row type.
- Source/test commits: 1fb04529, 9a9e09ee, 5946168a, 57618396, fee2a239. Post-fix verification remains pending.

### OPS-01 lesson — Compose config environment compatibility (2026-10-18)
- Docker Compose versions may not support `docker compose config --environment`; when this fails with an unknown flag, distinguish CLI compatibility from application build errors.
- Prefer the modern resolved environment where available; otherwise resolve only the required non-secret output value from the same host/.env interpolation sources. Fail closed for absent or unresolved `DATABASE_URL`, and never print the DSN.
- Successful Docker image builds do not prove migrations, container startup, or live service health. Session `OPS01-COMPOSE-ENV-FALLBACK-20261018`; verification pending.


### FIX-01 lesson — host-run migrations cannot use Compose-only service DNS (2026-10-18)
- A database hostname such as `postgres` resolves only for processes on the Compose network; a migration script launched by the host cannot use that alias. Trace the execution location, not only whether the database port is listening.
- Preserve the desired internal application path; do not recommend changing app URLs to a host-published port when the user requires same-network container communication.
- When moving a migration runner into an image, verify that the migration files are actually present. Here `packages/db/migrate.js` auto-detects `supabase/migrations`, but the current Dockerfile does not copy `supabase/`; a read-only mount or deliberate image inclusion is required.
- Deployment-script implementation and rollout belong to OPS-01. FIX-01 records evidence and routes the handoff; source diagnosis is not a deployed fix.
- Session `FIX01-MIGRATION-NETWORK-20261018`; issue ISS-037; OPS handoff `HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018`.


### OPS-01 lesson — run schema migrations in the Compose network (2026-10-18)
- The host cannot resolve Compose-only service names such as `postgres`. Execute the Node migration runner with `docker compose run` on the app's network instead of rewriting application URLs to the host-published port.
- The current Dockerfile does not copy `supabase/`; bind-mount `$PROJECT_ROOT/supabase` read-only at `/workspace/supabase`, the path auto-detected by `packages/db/migrate.js`.
- Preserve the current startup-on-migration-failure policy unless separately authorized to change it. Do not report deployment PASS from static tests.
- Regression protection checks the Compose invocation, read-only migration mount, absence of host-side DSN translation, no URL logging, and retained failure policy.
- Session `OPS01-MIGRATION-CONTAINER-20261018`; source `65a215151ecd14900fac3c9ba9a421fb7a777a77`; regression test `6cd93638bffa0e2f6a9e8d6ce2f3f2664b13341b`.
- Verification: `bash -n` passed and the focused Node test passed 4/4 in an isolated harness using fetched source/test and a matching Compose env-file fixture. Actual project-checkout execution, database target confirmation, migration, and live health remain pending.

### DEV-01 / Forge — 2026-10-18 — Chat/voice and HTML reader boundary lesson
- **Session:** DEV01-CHAT-FIRST-WORKSPACE-20261018
- **Issue:** A parent Chat voice-mode toggle can unmount a live microphone/WebSocket while host session persists; Navbar can be offset twice if both root shell and child header own sidebar spacing; an `html_body_sanitized` DB name can mislead the UI about whether ingestion actually sanitized email.
- **Remedy:** Launch voice by user action with existing Clara transport; make Chat header open-only and use VoiceWorkspace teardown to return; own desktop 248px inset in root layout only; render HTML in opaque CSP iframe as defense in depth.
- **Prevention:** Explicit end-session response/lifecycle verification (FIX-01 #26), robust sanitizer before storage/backfill (FIX-01 #36), and user-visible privacy defaults / browser acceptance. Source checks 13/13 do not imply runtime/security acceptance.
- **Next:** DEV-01 UI tests/polish, OPS-01 CI/deployment, FIX-01 significant runtime and sanitizer fixes. Plan `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md`.

### DEV-01 — 2026-10-18 — Consistent shell offsets and untrusted HTML previews
- **Issue:** Double desktop sidebar margin left a visible gap in navbar; default root landed on Overview instead of Chat; Mail child nav disappeared outside Mail routes; thread UI checked `html_body` despite DB returning `html_body_sanitized`.
- **Root cause:** Parent layout and child topbar both applied `md:ml-[248px]`; nav display was tied to route activity; SQL column naming differed from UI contract.
- **Remedy:** Parent owns layout offset once; Chat-first/Overview deep link; Mail defaults expanded with explicit button; keep backend tenant-scoped HTML alias in sync with UI. Embed provider voice by reusing existing authorized Clara transport instead of inventing a new one.
- **Security prevention:** A DB field named `html_body_sanitized` is not proof: worker code was observed inserting raw provider HTML without a proper sanitizer. Keep opaque sandbox CSP and prevent remote tracking by default, but route ingest sanitizer + old data backfill to FIX-01 issue #36; OPS-01 owns deployment.
- **Concurrency lesson:** Parallel direct-main agent edits can fix the same UI; always fetch exact latest file SHA, retain independent fixes and remove duplicate unused helpers instead of clobbering either implementation.
- **Evidence:** DEV-01 source-check suite 14/14 current GitHub invariants PASS; full browser/build/provider acceptance pending. Session `docs/project-control/sessions/DEV01-CHAT-FIRST-VOICE-MAIL-20261018.md`.

### 2026-10-18 — Browser text streaming vs model/provider/function-call streaming
- SSE reading must buffer arbitrary network chunks and decode split Unicode, distinguish `status`, `delta`, `done`, `error`, and refuse incomplete final EOF/oversize events; updating UI only at stream completion is not streaming. Gemini needs `:streamGenerateContent?alt=sse`, not blocking JSON `:generateContent`; OpenAI-compatible final chunk may end at EOF.
- A host-authorized tool loop may be deliberately **non-streaming** until vendor function-call streaming is implemented safely; emitting the final completed tool answer in pieces is fake and obscures approval state. Never stream speculative tool-operation claims before permission, account binding, input/schema checking and approval. Use early factual progress status, genuine model deltas only on paths that generate tokens.
- Repo evidence `DEV01-MAIL-THREADS-STREAMING-20261018`: 5 exact Node parser runtime tests and isolated TS pass; 23 source-contract checks pass, full integration not run. OPS deployment and FIX runtime/security roles unchanged.

### 2026-10-18 — Avoid fabricated streaming or invented tool outcomes
- Tool-call loops cannot become 'live streamed' by chopping a completed string into timeouts. Actual model SSE generation **after authorized tool results** can offer progressive delivery, but a second model may paraphrase or hallucinate sends/approvals. Guard *each chunk* as a literal prefix of the completed canonical answer, disable all tool declarations, bind org+agent credentials and give truthful fallback. This optional second pass costs tokens/time and must be replaced by provider-native tool-call streaming for full acceptance.
- Host-only eligibility (registered tool safe+read permission and result success; pending approval/write/denied fallback) is essential. Never trust the model's tool name alone. Test malicious suffix after exact text, malformed output, provider errors, abort and partial Unicode. Evidence: exact SHA-matched 8/8 Node tests, standalone tsc and 16/16 GitHub contract checks; no complete repo/browser/provider validation.
- Session `DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018`; FIX-01 existing voice/sanitizer role and OPS-01 deployment role preserved.

### DEV-01 — 2026-10-18 — Stop provider work on disconnect, not only UI rendering
- Problem: host-side SSE consumer can stop displaying tokens while the upstream OpenAI-compatible/Gemini HTTP request still awaits data. Fix: propagate the same `request.signal` through both server endpoint stream codepaths and Clara `chatStream` provider fetches; keep existing reader.cancel finalizer.
- Sensitive-result exception: read-only classification must check result **approval markers** (`status:pending_approval` and `approval_required:true`) even if the tool is registered safe/read and successful. Only actual host-authorized, non-approval, bounded canonical responses may use the second provider stream.
- Proof boundary: isolated exact Git-matched unit tests 8/8 and standalone tsc PASS; 12/12 current-source assertions PASS; no native function-call SSE decision stream, full pnpm/browser/live provider/deployed proof. Session `DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018`.

### 2026-10-18 — Provider function-call SSE is not authority to execute
- Tool streams require complete validated finish semantics before tool execution: OpenAI `tool_calls + [DONE]`, Gemini `STOP + EOF`. Do not execute partial function calls or reassemble malformed argument JSON opportunistically. Host still enforces actor/org/agent/mailbox permissions, allowlists, approvals and audit; service provider tokens alone confer none.
- Add minimal pure decoder `node --experimental-strip-types` suites to package test command so CI actually discovers new regression tests. Match exact test/source Git blobs when running isolated checks; do not claim workspace build/production proof from local parser tests.
- DEV-01 session `docs/project-control/sessions/DEV01-NATIVE-TOOL-SSE-20261018.md`: 19/19 isolated Node and strict TS PASS, broader suite/browser/provider/deploy pending.

### 2026-10-18 — Native final provider SSE after read tools
- Streaming tool-call **decisions** (OpenAI/Gemini) must still be fully assembled/validated before any host execution. After one successful audited host *read-only* batch, model final text can stream directly with **zero tool definitions**, using only the scoped authorized tool results as UNTRUSTED user data. Never send model-generated tool arguments to the final no-tools endpoint.
- Guard against approval/write/denied calls, 4-tool safe batch cap, orphan and **previously consumed duplicate tool-call IDs**, oversized context, post-tool unsupported-provider fallback, cancellations and tool-output prompt injection. Source unit test caught duplicate-ID reuse and was repaired (now 7/7 Node).
- This optimization trades multi-hop read discovery for first-batch final streaming; longer/denied/write flows continue old bounded tool loop. A streamed model can still hallucinate textual claims; real-provider/multi-agent acceptance is required. Source `DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018`.

### 2026-10-18 — Catch-up/routine planning lessons (DEV-01)
- Personal visit/review, routine generation and provider delivery need separate ledgers; late mail cannot be excluded by a timestamp-only cursor. Different users/routines must not advance each other's coverage.
- Derived summaries inherit every source's current access and content revision. Recheck all sources on reads and immediately before dispatch; a cache is not authority.
- A scoped standing digest grant remains a proposal until reviewed and implemented; general WhatsApp send stays per-message approval. Template eligibility is separate from user consent. Unknown provider submission cannot be blindly retried.
- Current main ba9e948b passes local typecheck/web build and 41 focused checks; many are source contracts, not proof of scheduler durability or tenant event safety. Newly found existing bugs are routed to FIX-01; infrastructure evidence to OPS-01. See DEV01-CATCHUP-ROUTINES-20261018.

#### 2026-10-18 — Integrated source verification addendum
- DEV01-CATCHUP-ROUTINES integrated concurrent main 959ff5a6 without changing product source. Typechecks/web build pass; latest focused tests are 91 passed/1 failed, superseding any current-green implication from initial ba9e948b's 41/41.
- Final tool-prompt helper allows completed ID reuse and declared/result-name mismatch in unit probes; FIX-01 handoff HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018. Do not weaken a failing test to hide validation gaps or claim an unobserved live bypass.

## 2026-10-19 — C1 private catch-up

Implemented C1; session `sessions/DEV01-CATCHUP-C1-20261018.md` records evidence and limits. Next: C2 stable manifests/coverage. Read authorization must revalidate evidence IDs/revisions as well as top-level sources; forward only allowed output fields. Prove audit atomicity with forced failure, not only successful audit rows. Multiple permissive RLS policies combine with OR: private content needs restrictive isolation plus trusted application predicates. Strict real PostgreSQL migration execution and structural checker results are separate evidence. Never equate focused green checks with full-suite acceptance.

### 2026-10-19 — Capability-scoped credentials and safely reusable encrypted secrets
- Provider-key availability must be checked against exact `(organization_id, provider, purpose)`, not a generic provider badge. If one capability is configured and another isn't, return an actionable purpose-specific error instead of a misleading empty live catalogue. Do not silently fall back across capabilities.
- Reuse an existing encrypted secret only by explicit organization-update permission and user confirmation. In DB copy only missing enabled target slots without overwriting keys/models or re-enabling a disabled purpose; audit the operation and never return/repeat plaintext. Verify decryptability before copying bytes. Distinguish a stored encrypted blob from a successfully decrypted credential on server.
- User-supplied session cookies must never be reused or recorded in issue docs; direct user to revoke exposed session. APP 409 occurs before vendor network, so don't call it an ElevenLabs outage. Actual provider and deployed status remain OPS verification gates.
- Evidence `DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019`: 29/29 current GitHub source contracts PASS, new Vitest and full monorepo/DB/browser/provider NOT RUN.

### FIX-01 / Sentinel — 2026-10-19 — Mail summary completeness and time-scoping lesson
- **Symptom:** Agent fabricated a summary of old messages and then claimed no unread messages for a specific rolling 24h period.
- **Root cause:** 20-item, seven-day, draft-first, unread-agnostic LLM context plus prior-assistant keyword contamination. This is not evidence of provider live mail; an assistant cannot infer full coverage from that sample.
- **Failed approach:** Early sender-filter regex truncated a dotted email domain; isolated Node regression caught 7/8, fixed to preserve domain and rerun 8/8 green.
- **Remedy:** When the user explicitly requests a rolling time-bounded "all" mail report, use a parameterized org/agent/read-role + email.read + allowlisted-tool checked SQL query with time and unread predicates. Include total, included, exact UTC bounds and a local-sync/partial caveat; do not claim more than what was fetched. Fail closed on unsupported specific filters.
- **Prevention:** Never let an LLM infer 24h/unread/all from arbitrary LIMIT 20; never include previous assistant content as search scope for new independent requests; test >30, >500, sender-specific and cross-tenant scenarios. Role session FIX01-ROLLING-MAIL-20261019.

### DEV-01 — 2026-10-19 — Complete UTC mail-date filtering without broadening

- **Source issue:** Prior report code only recognized a rolling 24-hour UTC interval; user date-range request could fall through unrelated assistant/tool context and produce an unverified "all" claim. Exact explicit date scopes need data-backed SQL, not model-inferred time and counts.
- **Pattern:** Parse 2 complete YYYY-MM-DD dates and supported filters *before* chat history; fail closed to 422 for malformed/reversed/unsupported scopes; reuse actor email.read, enabled per-agent read/search list capability, organization+agent+primary/read_only mailbox binding, parameterized COUNT and 500 cap. To include every PostgreSQL timestamp on the user-selected last calendar day, use **exclusive following midnight UTC** (`received_at < end`), not `23:59:59.999Z`. Keep 24h rolling endpoint semantics unchanged.
- **Evidence:** Git SHA-byte-matched isolated original+new Node tests 16/16 PASS, two-module tsc PASS, current GitHub source contracts 19/19. New full Vitest/DB runtime/browser/provider sync not run; only locally synced data is known and freshness cannot be inferred.
- **Ownership:** DEV-01 product date-range feature; FIX-01 original 24h incident and HTML sanitization bug; OPS-01 deployment, migration, secrets and provider synchronization. User should revoke exposed browser token and rotate exposed server password without copying secrets into repo/logs. Session `DEV01-EXPLICIT-DATE-MAIL-20261019`.

### DEV-01 lesson — 2026-10-19 — Capability credential save must preflight before partial writes
- **Root:** ElevenLabs Realtime, TTS and STT credentials live in separate `ai_provider_configs` purpose rows. Two independent client PUTs can persist the first when the second lacks a secret. A generic provider badge does not guarantee every capability has an enabled, decryptable key.
- **Guard:** Validate both voice purpose keys before first Save when no new secret is supplied; fail closed on `keepExistingKey:true` if the same authorized org/provider/purpose has no stored encrypted key; never infer an implicit credential from Realtime. Preserve read-only Realtime metadata in the voice setup UI after save/remove, and keep explicit encrypted reuse opt-in.
- **Limits:** This is a preflight preventing predictable missing-key partial saves, not a transaction. Two-request network error can still partly commit. A future transactional bulk endpoint would address that. No key should appear in logs, tests, response or docs; revoke accidentally shared session tokens.
- **Evidence:** 8/8 isolated behavior, global standalone tsc and 10/10 source assertions PASS; full vendor/database/browser/production acceptance not done. Session `DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019`.

## 2026-10-19 — DEV01-CATCHUP-C2-20261019

C2 complete locally, final merge/push receipt in session.34SQL,25domain,37web,3integrity checks pass; typechecks/build pass. Preserve source/review scoping and UUID cursor UI compatibility. Claim canonical sources, reauthorize scheduled mutations, retain precise server boundaries and compare manifest provenance counts. Prior C1 support sessions finished; independent C2 reviewer complete, FIX-01 compatibility/security support complete, OPS-01 restore/read-only incident assessment complete. No hidden active implementer task remains. Next C3 orchestration/grounding and C4 browser acceptance; security incident and broader suites retain role owners.

### DEV-01 / 2026-10-19 — Fresh-migration safety is a database-state assertion
- A missing/empty PostgreSQL migration ledger does **not** prove an empty database. The existing `migrate.js` auto-commits statements and writes each ledger row after a file; a prior failed run may have created data-bearing tables without history.
- The owner-run `operator-migrate.sh --allow-fresh` preflight now checks `pg_catalog.pg_class` for non-extension user relations across all schemas, excluding only internal objects and the migration ledger. Fail closed on any relations or ambiguous inspection; never bypass checksums, expected database identity, tested backup or the operator's explicit apply confirmation.
- The operator migration scripts were already present on main; avoid creating duplicate release/migrate scripts. Source evidence 18/18 contracts; no live database, full package tests, backup or deployment performed. OPS-01 owns running and accepting the host workflow; session `docs/project-control/sessions/DEV01-MIGRATION-FRESH-TARGET-SAFETY-20261019.md`.


## DEV-01 current handoff — 2026-10-19, final repository synchronization

See [current handoff](sessions/DEV01-CURRENT-HANDOFF-20261019.md) for completed, in-progress, pending and next work. C1/C2 focused implementation is complete; C3 worker/grounding integration is next, then C4 authenticated UX acceptance. Phase 4 remains implementation_in_progress. Latest upstream operator/vector fixes preserved; affected checks pass 35/35 and 11/11. Earlier full-suite counts are a pre-final-merge baseline. Security follow-up remains open. Existing entries retained as history.


## Shared safety lesson — 2026-10-20 C3 DEV-01
The generic Clara chat turn invokes ambient RAG/email search and must **not** be used for user-grant-scoped personal briefing generation. Use source-manifest-scoped, no-RAG model path, revalidate fresh C1 grant/revision and C2 fenced lease at load and commit, and retain incomplete items on every coverage mismatch. Zero-tool `completeWithTools` explicitly rejects empty tools; never add an unauthorized placeholder tool. Provider outages must not silently advance coverage. See `sessions/DEV01-C3-CANONICAL-CLARA-20261020.md`.


## 2026-10-20 — Cross-agent Email Command Center safety lessons (DEV-01 R1b)
- A five-day absence briefing is a per-user **review-coverage** problem, not organizational employee attendance monitoring. Preserve coarse last-visited versus last-reviewed separation, current mailbox-grant intersection, ongoing background sync, and truthful partial/source freshness labels. No admin-wide mailbox access or inactivity leaderboards.
- A routine preview, an AI-generated proposal, a confirmed inactive definition, a worker occurrence and external delivery are separate persisted facts with separate authorization. Neither model prose nor a successful preview grants scheduling, forwarding or WhatsApp-send authority.
- Do not reuse migration placeholders from historical Superpowers plans: as of DEV-01 review, `supabase/migrations/` already ends at `0052_briefing_selection_coverage.sql`. Recheck GitHub current tip before any migration; OPS-01 applies production SQL.
- Cross-role handoff: DEV-01 owns typed proposal/UX/C3/C4 feature scope; FIX-01 owns scheduler crash/lease/tenant source correction and negative A/B runtime assertions; OPS-01 owns provider/WhatsApp/CI/deployment and potentially contaminated build-host recovery. A test pass on older SHA is not evidence that a later git tip passes.
- Proposal contract and exact task plan: `docs/superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md`; DEV-01 session: `docs/project-control/sessions/DEV01-EMAIL-COMMAND-CENTER-R1B-PLAN-20261020.md`. No new feature enabled by that documentation.

### DEV-01 lesson — 2026-10-22 — Permission-mode confirmation is not permission elevation
- Provide short selectable **bundles** of registered agent tools with individual opt-in overrides; never let chat prose or selecting a preset grant anything until an authenticated organization administrator confirms and the existing policy API stores it. Read mailbox bindings, user RBAC, agent allowlist, provider capabilities and send approval all remain independent.
- Full-policy editors must send their **original five-field snapshot** for a tenant-scoped atomic compare-and-set. Otherwise stale chat/settings tabs can silently undo newer security/rate/sender restrictions. Show explicit per-tool enable/disable names and a 409 reload path; guard unsaved selection on reload. No Mail revokes known and legacy unknown `email.*` tools only.
- Session `sessions/DEV01-AGENT-PERMISSION-PRESETS-20261022.md`. Source invariants 22/22 only; native runner/db/browser pending. Keep C3/R1b authorization gates and OPS/FIX separation.

### DEV-01 2026-10-23 — preserve isolated AI session memory
- Reusing the latest per-agent conversation is not creating a new chat: separate sessions require distinct persisted IDs and explicit history selection. Resume by exact org+agent conversation identity; the model should see that chat's prior Q&A only. Loading earliest 100 instead of latest 100 loses conversational continuity in long histories; voice returns must keep the selected ID.
- Existing conversations remain org+agent shared; do not promise private user histories without reviewed ownership/legacy migration. `sessions/DEV01-MULTI-CHAT-SESSIONS-20261023.md`, source checks 18/18, real DB/browser still pending.

### DEV-01 — 2026-10-23 — bounded five-day catch-up is not employee inactivity tracking
- **Session:** DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023. **Role:** DEV-01/Forge.
- **Issue/user need:** Ordinary people and small-business teams want a five-day source-linked mail digest, while the existing C4 source UI defaults to seven days and cannot reliably infer actual days away.
- **Unsafe approaches avoided:** Deducing absence from organization-wide unread messages, marking read upon opening Overview, creating duplicate raw-email storage, registering C3 in a feature flag, or sending WhatsApp merely from an LLM request. None is authorized by a five-day preview ask.
- **Bounded remedy:** Feature-gated Overview links to `/catch-up?days=5`, server validates 1/5/7/30 and real C4 page uses own person+agent mail grant, manifest time window, source revisions, original mail links and explicit reviewed-item actions. Existing 7-day direct default preserved. Source commits `b45ed5e7,7785e189,ed11d533,3622c0e4,a727a086` and plan `a63b2745`.
- **Prevention:** Always distinguish selected lookback, measured login gap, reviewed source coverage and verified digest delivery. The last three require separate trusted evidence. Test flag-off, privacy, invalid query, late source and cross-user negatives before calling a summary complete. Project source review, isolated Node and production browser acceptance are separate results.
- **Next:** C3 lease/grant/provider acceptance, then C4 personalized return; R1b standing WhatsApp consent remains separately gated. Session record `docs/project-control/sessions/DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023.md`.

### DEV-01 / Forge — 2026-10-23 — R1a clocks are not scheduler authorization
- **Issue:** Cron-centric Schedules and event-centric Automations are hard for ordinary users; calendar 09:00 and every 24 elapsed hours diverge at DST transitions.
- **Remedy:** Private no-write Overview-linked preview using the existing typed R1a time engine, next UTC/local occurrences and an explicit “not saved/sent” result; P0–P7 roadmap layers personal catch-up, AI judgement, consent and delivery.
- **Prevention:** Never copy the clock algorithm to the browser, infer attendance from a five-day lookback, present a proposed routine as active or equate an approved Meta template with signed user consent. Record source-only checks separately from native/runtime acceptance. FIX-01 errors and OPS-01 deployment remain separate.
- **Reference:** `docs/project-control/sessions/DEV01-ROUTINE-TIMING-PREVIEW-20261023.md`; `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md`.

### DEV-01 lesson, 2026-10-23 — composition identity and permission truth
- A connected account is not permission to select it as From when the agent has multiple mailboxes. The UI must request an explicit sender, and missing To must prompt for a complete address. Display signed-in `email.write`, agent draft, agent send-request and provider capability separately, never conflate request approval with delivered mail.
- `AuthSubject.user.name/email` may be used only for an editable, bounded signature and private model context; absent fields cannot be fabricated. Human sign-off review, tenant-scoped grants and approved send path remain independent.
- DEV-01 session `sessions/DEV01-CHAT-COMPOSE-IDENTITY-20261023.md`; 54/54 source contracts + 22/22 invariants on Development, native/browser/DB pending. No live permissions changed or external email sent.

### DEV-01 — 2026-10-23 — provider UI capability clarity
- The original AI Provider Setup showed the same vendors as both selectable status cards and a second Provider dropdown. For people configuring AI without backend knowledge, present four purpose areas and compatible provider cards, with one selected editor only on explicit choice.
- “Key enabled” can falsely imply a ready chat/voice capability. Readiness for this UX requires an enabled saved credential and nonempty saved model for each required purpose (Voice Chat = TTS+STT); a configured record is still not a successful live API/realtime session. Vendor catalog/no-secret failures remain truthful. Never auto-reuse an ElevenLabs Realtime key without a separate confirmed action.
- Preserve org/tenant abort/fail-closed and plaintext key reset on capability/provider changes; when org context GET fails surface retry instead of spinning forever. Full source/evidence and next action `sessions/DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023.md`. Native runner/browser/deployment acceptance still pending; FIX/OPS scopes separate.

### DEV-01 2026-10-23 — canonical header UX before AI generation
- A five-day permitted source manifest can be correct yet unusable if original email links only display UUIDs. Display bounded original sender, subject and UTC received date from canonical PostgreSQL **after** per-user/agent/mailbox grant and revision checks; preserve cursor/feature flag and do not return bodies in the source-list API.
- Empty/invalid headers are **unavailable**, not unknown AI guesses. A loaded source list is not generated high/medium/low priority, reviewed work, provider unread state, five-day inactivity or a scheduled/WhatsApp digest. Source metadata can be untrusted text: escape in the UI, cap length and sanitize controls.
- Keep privacy and delivery gates: never collect employee attendance or infer absence from a chosen lookback; per-user visit telemetry needs consent/retention/opt-out, C3 activation needs grant/lease/provider acceptance, and routine consent/WhatsApp delivery are independently security gated. P1b evidence: `DEV01-CATCHUP-SOURCE-DETAILS-20261023`, 17/17 structural checks, 3/3 isolated helper cases, full runtime unverified.


## DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023

Owner-selected Development recovered at ab7292fbb00263bb817ab2874ab4f66e10946f0f. Fresh native tests 54/54 pass (source/behavior scope only). Live Chromium login returns HTTP 522 origin timeout, so authenticated AI mail/WhatsApp acceptance is blocked with no external messages created. Current state, completed/in-progress/pending work, F01–F21 matrix and exact next action: docs/project-control/sessions/DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023.md. OPS-01 owns origin recovery; DEV-01 resumes frontend acceptance; FIX-01 owns proven application defects. Existing records and roles preserved.
