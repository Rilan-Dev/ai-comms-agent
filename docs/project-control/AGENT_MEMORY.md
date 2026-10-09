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
