# FIX-01 Role-Local Memory

This is durable memory for FIX-01. It supplements, but never overrides, shared APCP memory or repository authority.

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

<!-- Append durable FIX-01 lessons below. -->

### FIX-01 / Sentinel — 2026-10-09 — Authentication loop re-triage
- **Issue/symptom:** Successful password login at the live HTTP deployment is followed by `/login?reason=not_provisioned`.
- **Root cause:** The current source path no longer matches the original cookie/navigation failure. `reason=not_provisioned` is produced only by the protected root layout after a cookie-bearing request reaches `getAuthenticatedAppContext()` and that context is null. Exact live branch remains unconfirmed because the private runtime is not reachable from this execution environment.
- **Failed approach:** Full browser navigation, explicit cookie propagation in the root layout, and HTTP-aware `Secure` handling are already present on `main` and did not eliminate the live symptom.
- **Remedy:** Route runtime/build/database diagnosis to OPS-01; do not weaken provisioning/auth checks.
- **Prevention:** Treat `login?next=/` and `login?reason=not_provisioned` as different failure branches; inspect cookie presence and application identity/session/membership state before changing login UI again.
- **Related record:** ISS-007 / EVT-FIX01-AUTH-20261009 / HOF-FIX01-OPS-AUTH-20261009

### FIX-01-AUTH-FIX-20261009
The authentication loop was traced to session issuance preceding active organization-membership authorization. Fixed `loginWithPassword` to check `getMembershipsForUser(user.id)` and throw `AccountNotProvisionedError` when no active membership exists; the login route returns 403 and does not mint a session. Added auth-boundary regression protection. Commit `197e6535eab0cafde3e84db8f0605b7a174b3b03`. Do not weaken fail-closed authorization or auto-provision memberships.


### FIX-01 / Sentinel — 2026-10-09 — Worker credential snapshot typing
- **Symptom:** Worker Docker build failed with TS2322 at mailbox-sync-worker.ts:156 and TS2345 at line 201.
- **Root cause:** Gmail returned a generic record where orchestration expected EmailCredentials; the database accepts Record<string, unknown>, which EmailCredentials does not implicitly satisfy.
- **Failed approach:** An adapter intersection does not fix incompatible method signatures; direct interface-to-record assignment is invalid.
- **Remedy:** Gmail snapshot returns EmailCredentials; worker spreads the snapshot into a plain record at persistence; added a focused contract test.
- **Prevention:** Keep provider snapshots on shared domain types and convert only at the storage boundary.
- **Evidence/status:** Commits caad1d75, 04a2345b, a98c0e7f; source committed, tests/typecheck/build unexecuted.
- **Next:** Run focused test and worker build; route Docker/environment failures to OPS-01.


### FIX-01 / Sentinel — 2026-10-09 — Zoho OAuth test parser failure
- **Symptom:** Web TypeScript reports TS1127/TS1434 at `apps/web/tests/zoho-oauth-settings.test.ts:84`; shared/db/clara-core and worker typechecks passed in user's output.
- **Root cause:** Literal `\n` text was committed between assertions instead of actual source newlines.
- **Failed approach:** Avoid modifying OAuth runtime implementation; parser failure is in the test file.
- **Remedy:** Replaced the exact malformed sequence with real line breaks. Commit `39857c40820940b500dcf452331dfe82ae35b861`.
- **Prevention:** Check escaping after generated/API writes so newline escapes do not become literal source characters.
- **Status:** Source correction committed; post-fix typecheck and test still pending.
- **Next action:** Re-run `pnpm run typecheck` and the focused Zoho OAuth test; route unrelated infrastructure/deployment failures to OPS-01.


### FIX-01 / Sentinel — 2026-10-09 — OAuth focused assertions
- User-reported typecheck now passes all workspaces; focused test output initially showed 8 pass / 2 fail.
- Raw IP validation intentionally precedes HTTPS validation; assert the raw-IP/DNS error for any raw IP, including HTTP. Do not encode incidental validation ordering as a protocol requirement.
- A source test forbidding environment-variable use should assert absence of `process.env.NEXT_PUBLIC_APP_URL`, not absence of every textual mention, since comments may explain the policy.
- Test-only correction commit: `c58d6d442767f471c694ef978fdb06eca6d29850`. Rerun remains pending.


### FIX-01 / Sentinel — 2026-10-09 — Migration and worker contract test drift
- **Symptom:** Migration static tests failed on audit policies/DO delimiters; worker tests failed on retry metadata and Qdrant exclusion.
- **Root cause:** Test expectations were coupled to named dollar tags/over-escaped regexes; the Phase 4 base migration did not carry the expected audit policy names/read policy; retry metadata was preserved through object spread, and a comment mentioning Qdrant tripped a blanket negative assertion.
- **Failed approaches:** Avoid rewriting valid SQL delimiter style, adding redundant fields to runtime objects, or deleting useful comments to satisfy brittle regexes.
- **Remedy:** Forward-only migration 0032 adds tenant-scoped audit insert/read policies and restrictive update/delete denial. Static assertions now allow valid DO delimiters, inspect the new migration, verify envelope spread, and forbid actual vector-client imports/calls.
- **Evidence:** Commits 7557a6cd, ee85b554, ceca e73e, c4d4abd0, 96996d82 (worker source/test and migration test source commits); tests NOT RUN.
- **Prevention:** Assert runtime contracts rather than exact implementation spelling. Inspect source after API writes; no source-only PASS claims.
- **Next:** Pull latest main, compare lockfile to origin/main, run focused tests and sequential web/worker typechecks.


### FIX-01 / Sentinel — 2026-10-10 — Membership role rank exhaustiveness
- **Symptom:** Docker web build failed during Next.js TypeScript validation because `Record<MembershipRole, number>` lacked `viewer`.
- **Root cause:** The role union includes viewer, but the authorization hierarchy map listed only member/admin/owner.
- **Failed approaches:** Do not cast around the missing role, loosen the Record type, or delete viewer from the domain union.
- **Remedy:** Set ranks to viewer=0, member=1, admin=2, owner=3 and test minimum-role semantics.
- **Evidence:** `44a08522f23e807755114ebe46b8b1e04e6056da`, `3853ecf046c175e15a4f824e9679f50fb7132cf9`. Post-fix tests/typecheck/build not run.
- **Prevention:** Update exhaustive records and RBAC tests whenever a shared union type includes a new variant.
- **Next action:** Run focused RBAC Vitest, web typecheck, then manual-up; OPS-01 owns independent infrastructure/deployment/environment issues.


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


### FIX-01 / Sentinel — 2026-10-16 — Decrypted email credentials typed at runtime boundary
- `loadCredentials()` returns a generic record; do not assert it directly as `EmailCredentials` because `credential_type` is required.
- Validate the discriminant at each provider-worker boundary, reject unsupported/missing values, and pass a spread object with the narrowed discriminant. Avoid `as unknown as` casts.
- Build evidence from user: worker TypeScript build failed at Gmail watch renewal and IMAP IDLE startup. Fix commits are on `main`; rerun worker typecheck/build to verify.


### FIX-01 / Sentinel — 2026-10-16 — Provider enum/schema mismatch
- When worker SQL rejects a provider label with PostgreSQL 22P02, compare the exact enum bound to the persisted column against every migration and the current application provider union.
- A similarly named enum such as email_account_provider does not update email_provider; change the exact type referenced by the failing column.
- Prefer a forward-only migration and a source regression assertion. Do not remove supported provider values from polling queries to silence the error.
- Distinguish deterministic source/schema errors from separate subscription prerequisites and deployment/runtime evidence. Migration execution and live sync remain OPS-01 verification.


### FIX-01 / Sentinel — 2026-10-17 — WhatsApp error 131047
- Meta error 131047 with the explicit 24-hour-window explanation means free-form text was rejected as an out-of-window re-engagement message. Use an eligible approved template or wait for a customer reply; never bypass Meta policy.
- Queue acknowledgement is not delivery confirmation. Treat queued/provider-accepted/sent/delivered/read/failed as distinct states.
- If the UI contradicts a supplied failed webhook event, trace the exact provider message ID through webhook response, tenant/account-scoped persistence, and UI refresh before changing code. Route live deployment/database/webhook-delivery issues to OPS-01.

### FIX-01 / Sentinel — 2026-10-17 — Chat provider override fallback
- The per-agent AI configuration feature must not require an `organization_ai_runtime_settings` row before reading `agent_ai_settings` and `ai_provider_configs`. A missing org-default row previously caused `organizationAIConfig` to return null and silently use the environment default (OpenAI), bypassing a saved Sarvam/Gemini override.
- Preserve the distinction between source cause and runtime confirmation: verify the live org row and serving revision before claiming this explains a particular deployment.
- Do not add a default OpenAI key to mask incorrect provider selection. Regression source test: `apps/web/tests/clara-agent-provider-resolution.test.ts`; source fix `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`. Tests/deployment remain unverified.


### FIX-01 / Sentinel — 2026-10-18 — Nullable membership at chat tool-context boundary
- `AuthSubject.membership` is nullable in the shared type even though `authorize()` only returns after `requireOrganizationMember()` has found an active membership. TypeScript still requires narrowing at the caller.
- Small safe fix: immediately after `authorize()`, explicitly return 403 if membership is absent; then construct `ToolContext.auth_subject.role` from the narrowed membership. Never default the role or cast away nullability.
- Add regression protection for guard-before-context ordering. Static test source is not test execution; keep build/test status pending until rerun evidence arrives.
- Commits: `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`, `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`.

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
- **Symptom:** Next.js compile succeeded; strict typecheck failed at voice workspace audio resampling because indexed Float32Array reads can be undefined.
- **Fix/test:** Guarded both direct sample conversion and averaging-loop sample reads with `?? 0`; added source-contract regression assertions. Commits `baa9746142297322c5bf796e7c6fb94060bbc9cf`, `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Verification:** Post-fix Docker build and focused test remain unverified.
- **Next:** Pull main and rerun manual build; continue source-error remediation without claiming unobserved success.

### FIX01-STRICT-INDEXED-ACCESS-VOICE-CONTEXT-20261018
- Strict indexed-access applies to Int16Array, Float32Array, and split() results; guard reads directly rather than disabling compiler checks.
- Voice-turn trust context must explicitly fail closed if membership is null and must provide a real string conversation ID; do not cast unknown session metadata.
- Source/test commits: 1fb04529, 9a9e09ee, 5946168a, 57618396, fee2a239. Verification pending; user logs are pre-fix.


### FIX01-MIGRATION-NETWORK-20261018 — 2026-10-18
- **Symptom:** Manual deployment build completed, then migration failed with `getaddrinfo ENOTFOUND postgres`; script continued startup.
- **Root cause:** `scripts/manual-up.sh` runs the migration Node process on the host, but its DB hostname `postgres` is only a Compose network alias.
- **Failed approaches:** Host-side runner with Compose DNS; using `host.docker.internal:5433` for app traffic, which conflicts with the requested internal network route.
- **Remedy/owner:** Routed deployment script and migration execution to OPS-01. Migration should run as a one-off Compose container; ensure `supabase/migrations` exists inside the runner (current Dockerfile does not copy it). Do not silently change the DB name.
- **Evidence:** User output + source inspection; no post-fix tests or deployment verification.
- **Prevention:** Verify the process network namespace and required migration files before changing URLs; separate source diagnosis from deployment PASS.

### 2026-10-19 — Rolling 24h unread mail reports must not use context samples
- User-visible bug: broad "summarize all unread emails last 24 hours" received unrelated old messages, then fabricated zero. `loadEmailContext` only loads 20 draft-first records from 7 days, no unread filter, and conflates previous AI text. Never claim `all` based on a sample or stale inferred date.
- Remedy: use explicit current-user intent, fixed UTC rolling boundaries, read-entitled agent-mailbox JOIN/EXISTS, server-side unread/non-draft/non-sent and optional sender/topic, SQL total COUNT with cap and truthful partial/included counts. Display subject + available stored preview for every record; qualify local sync freshness and don't imply provider live verification. Only account-bound enabled tool + actor email.read can use direct report; original legacy context also now email.read gated.
- Development failure: sender parsing regex stopped at a domain dot, first actual Node regression 7/8; fix email-domain punctuation and fail closed on unknown filters, rerun exact Node 8/8. No full pnpm/SQL/browser acceptance.
- Never use, store or quote user's leaked host password or browser session; advise credential rotation. Details `FIX01-ROLLING-MAIL-20261019`.

### FIX-01 / Sentinel — 2026-10-20 — Bound mailbox is not an agent tool grant
- A connected primary/read_only agent email binding and an active agent do **not** imply the persisted policy allows email.search or email.messages.list. Rolling and explicit-date Chat summaries intentionally require both actor email.read and the agent allowlist; clarify disabled tooling in UI and 403 without silently changing policy.
- PostgreSQL DELETE target alias must not be referenced inside a USING JOIN ON that does not include it. Convert to comma-separated USING relations and target correlations in WHERE, retaining organization+agent+account checks.
- User-provided session cookies are secrets; avoid replay, storage or commits; request revocation/rotation.
- Source evidence: 9cf971b4 / 61f819d0 / a4d7b72c / ca936db9; GitHub-source 16/16 checks pass, native Vitest/Postgres/deployed checks not run. Session FIX01-AGENT-MAIL-POLICY-UNBIND-20261020.

### FIX-01 / Sentinel — 2026-10-20 — Established TLS sockets need no handshake deadline
- Worker IMAP `connectTls` may return a successfully negotiated TLS socket while its handshake timer is still armed. Destroying a healthy socket after ten seconds presents to the polling IMAP reader as an apparently unrelated `TLS response timeout`. The web connection test can pass because it correctly cancels the secureConnect deadline.
- Cleanup handshake timers and listeners on EVERY settlement path; socket errors and closure during negotiation must reject immediately, while an established connection remains alive under its command-specific deadlines. Persistent response readers must track close separately from error. Keep `rejectUnauthorized:true` and public-host SSRF protection.
- Source fix `91bc19b1`, regression cases `018f4fcd`, GitHub structural checks 14/14; node tests/full typecheck/live import not executed. Do not infer provider throttling or request user secrets. Session FIX01-IMAP-TLS-DEADLINE-20261020.

### FIX01-IMAP-GMAIL-SELECT-IDLE-20261021 — selectable IMAP folders and legacy encrypted credential discriminants
- Gmail LIST can return `[Gmail]` with `\\Noselect`. Treat hierarchy containers as metadata, not selectable mailboxes; otherwise `SELECT "[Gmail]"` aborts sync before message staging. Validate IMAP LIST flags before attempting SELECT, preserving selectable INBOX/child mailbox names.
- `saveCredentials(credentialType,payload)` previously dropped `credentialType`; an old password account can sync via defaulted type but fail IDLE's strict typed check. Persist discriminant in encrypted saves and narrowly infer missing legacy password type ONLY when non-empty password exists; reject explicitly malformed types. Avoid forcing users to reveal/reenter app passwords.
- IMAP command stream is one stateful TLS socket: do not interleave concurrent SELECT/FETCH commands on that same connection. Do not alias adjacent SQL RETURNING columns by missing comma; persist `sync_mode` when committing a completed import.
- Fix source commits `1c1b5796,1184576e,d3fa0af4,53702ac8,d43f16b7`; regression `06f9b14f,a655ce4e,2e131fb8`. GitHub source invariants 13/13; runtime tests/deployment not run. Session FIX01-IMAP-GMAIL-SELECT-IDLE-20261021.

### FIX01-IMAP-ESM-TEST-PATH-20261022 — Node ESM unit tests cannot access CommonJS __dirname
- Worker `package.json` declares `"type":"module"`, and `node --import tsx --test` does not define `__dirname`. Four source-contract tests blocked before assertions ran; 19 other IMAP test cases passed. Avoid changing module type to hide tests.
- Prefer `readFileSync(new URL("../src/file.ts", import.meta.url), "utf8")` for ESM-relative source fixtures. Corrected direct-main `9fbc1d19`; 7/7 source checks passed, host rerun after fix not yet observed. OPS-01 owns runtime deployment; FIX-01 owns follow-on test/source failures.

### FIX01-IMAP-UID-STAGING-20261022 — IMAP UID discovery must not download MIME content
- IMAP `sync()` can be a **discovery** operation: `SELECT` + `UID SEARCH` yields stable `folder:UID` IDs without full `BODY.PEEK[]`. Downloading each full MIME body before returning IDs kept `email_sync_states.pending_message_ids` at [] and imported count at zero for minutes, then `getMessage` fetched the same data again. Stage IDs durably FIRST and fetch once in small persisted batches.
- Catching a transient `getMessage` error and returning `null` is NOT evidence an email vanished. Exclude those IDs from `unavailableMessageIds` acknowledgements and fail the attempt, preserving pending IDs and cursor for restart-safe retry.
- Count-only claim/staging/batch logs are needed to distinguish a healthy queued worker from an active stalled import; never log message text, credentials or session cookies. Source `Development` commits `2a8c5933,db3d629b,b0550e52,631d96a2,2c0e3f8a`, 17/17 GitHub source checks, Node/live acceptance unverified.

### FIX01-IMAP-MIME-RICH-BODY-20261022 — MIME transfer encoding, IMAP framing and safe rich rendering
- An email may supply text/plain and text/html MIME alternatives. The bespoke IMAP `parseRawMessage` decoded only outer transfer encoding, then copied inner text/plain with raw `=E2=80=87` QP sequences and discarded HTML. This makes a correct Gmail original appear broken in ACA.
- Reuse shared `parseRfc822`, but verify its own UTF-8 byte/charset transfer decoding and case-sensitive multipart boundaries; strip IMAP UID FETCH `BODY[] {N}` framing via the octet count BEFORE parsing RFC822. Preserve from_name, matching IDs and HTML separately.
- Existing thread reader already prefers stored HTML inside opaque sandbox CSP blocking script/external resources. Do not "fix" by embedding untrusted HTML in the parent React DOM, allowing remote tracker images or claiming raw HTML has been sanitized. Existing ingest sanitizer security gate (#36) remains separate/open.
- Previously persisted malformed messages require authorized, account-scoped provider re-fetch/re-persist after rollout; a page refresh alone cannot reconstruct discarded HTML. Development source commits `5add7d2a,83c77c6d,20d0b026,cbf403fa`, 16/16 targeted source checks; full/live tests pending.

### FIX01-IMAP-FOLDER-COPY-DUPES-20261022 — folder-local IMAP UID is not a logical Gmail email identity
- A single Gmail RFC822 message can appear in both INBOX and `[Gmail]/All Mail` with different IMAP UIDs. `provider_message_id = folder:UID` correctly avoids colliding provider operations but creates two physical rows. Any Inbox read that selects all account messages displays duplicates; thread reads/counts also inflate.
- Keep physical copies. Inbox projections require verified INBOX role/name. Thread projections use scoped `account_id + nonblank internet_message_id` to collapse only IMAP folder copies, prefer INBOX, and use physical UUID for missing IDs; never dedup solely by subject, sender or time, never across accounts/tenants.
- Source commits `cce92f98`, `0cc16a77`, regression `7d94e1d2`, 17/17 source invariants; actual Vitest/live PostgreSQL and browser not verified. OPS-01 owns deployment/runtime acceptance.

### FIX01-AGENT-SELF-SERVICE-POLICY-20261022 — agent policy must be selectable, explicit, and backed by runtime
- `agent_policies.allowed_tools` is a separate administrator grant from `agent_email_accounts` binding: connecting a mailbox does not imply chat search permission. Offering raw comma-separated tool names/JSON alone defeats end-user configuration and invites incorrect grants. Render only actually **registered** email tool names as readable opt-in toggles and preserve existing custom grants until explicitly removed.
- Only connected/nondeleted same-org mailboxes may be newly bound; enforce both selector and DB/API, with clear error. A configuration test must not report fully ready when mail search/list tools exist but no connected `primary/read_only` account exists. Never auto-grant on bind; real permission `email.read`, provider sync and approval remain independent gates.
- Server SSH connectivity to supplied nonstandard port refused; no live access/credential use. Rotate chat-exposed plaintext server password. Scope commits: `084f36ba,68b3ec81,e7735b4b,93fbc354,11c760c2,51134e6d,424d89c1,816d9558,787c8ca9,df860960`. 24/24 GitHub source invariants, no native tests/deploy/live account claims. Broad onboarding feature work belongs DEV-01.

### FIX01-SARVAM-AGENT-VOICE-OVERRIDE-20261022 — Provider selection contract
- Agent AI Settings persists `agent_ai_settings.realtime_voice_provider_override` and STT/voice overrides. Voice session startup must read that tenant+agent scoped source of truth, never silently use retired `agents.voice_provider` and OpenAI fallback when a modern Sarvam override is present. NULL modern override means inherit the org provider, not stale legacy. Cross-provider STT/model/voice leakage is unsafe.
- Native Sarvam relay requires its scoped provider key plus `VOICE_RELAY_PUBLIC_URL` and a sufficiently configured `AUTH_SECRET`. A Sarvam pipeline fallback differs from OpenAI SDP; never mask missing Sarvam infrastructure with OpenAI credentials.
- Commits `ae1f92e0,505e9e8d,13b44a8a`; 16/16 source invariants, actual Vitest/typecheck/live provider unverified. Sensitive pasted browser cookie must be revoked, not logged.

### FIX01-SARVAM-WS-CONVERSATION-VOICE-MAIL-20261023 — Live transport versus Voice Chat batches
- Clara's reference `useSarvamVoice` uses a long-lived same-origin Saaras STT relay websocket and Bulbul streaming TTS relay websocket; the separate Chat Voice pipeline uses one-shot REST transcription/synthesis. ACA had already imported relay code but silently used REST pipeline when VOICE_RELAY_PUBLIC_URL was absent. FIX-01 now rejects Sarvam as live if relay is missing; readiness requires real STT and TTS upstream statuses AND mic readiness, not microphone access/HTTP session alone.
- For a spoken "last 24 hours received emails" query, prefer an explicit, counted PostgreSQL source read with user `email.read`, agent tool allowlist, same-org linked readable mailbox, exact UTC boundaries and IMAP mirrored-copy dedup, then disclose partial/local coverage. Model claims without a successful authorized email read are not evidence. Source `e8e4b326,ee63da1a,5a321ed1,a270c83d,dfd73a9c,67eb5404,3a0eb1f2,6c186374,643c4a01`. Source checks 22/22; native web/worker/provider/OPS deployment not verified.


## DEV01-FIX01-SARVAM-LIVE-LIFECYCLE-20261023

DEV-01 coordinated authoritative Clara comparison and integration; FIX-01 implemented/reproduced lifecycle bugs; OPS-01 documented deployment gaps. Source b58b4811 and concurrent integration4fefc41d preserve existing work. Readiness, duplex/mute, VAD/partial interruption, aborted/late responses, stale session/socket/activation/audio completion and abandoned microphone resources covered. Final54/54voice +7/7core/integrity checks, all package typechecks and production build pass. No live deployment/acoustic/provider acceptance. Exact next: OPS verifies approved web+relay revision/config and real-device streams; DEV/FIX then validates scoped spoken mailbox scenarios. Session: docs/project-control/sessions/DEV01-FIX01-SARVAM-LIVE-LIFECYCLE-20261023.md. Lesson: callback registration precedes awaits, every continuation is identity-fenced, cancellation never implies undoing authorized writes.
