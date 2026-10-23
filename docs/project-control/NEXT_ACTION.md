## DEV-01 — current Development and frontend acceptance checkpoint — 2026-10-23

Owner now directs all work/pushes to **Development**. Latest recovery and completed/in-progress/pending checklist: [current handoff](sessions/DEV01-DEVELOPMENT-FRONTEND-ACCEPTANCE-20261023.md). C3 source exists but remains unregistered; C4 source details, R1a preview and reviewed Chat email/WhatsApp tools exist, with live acceptance pending. Current Development native checks: **54 passed, 0 failed/skipped**. Live `/login` returns **Cloudflare HTTP 522 Host Error**; no login, draft, email, approval or WhatsApp test was executed. **Exact next:** OPS-01 restores origin availability; DEV-01 resumes the documented F01–F21 frontend matrix, including permission-negative and human-approval cases, using owner-authorized WhatsApp recipient. No deployment, permission mutation or feature activation performed. Phase 4 remains implementation_in_progress; older entries retained as history.

---

## DEV-01 — DEV01-CATCHUP-SOURCE-DETAILS-20261023 — private readable source emails

- **Owner goal / safe current slice:** Ordinary person, employee, SME and multinational AI mail catch-up. Existing approved P0–P7 roadmap remains authoritative. C4 first five-day selection formerly showed opaque source UUIDs; now source-only header details are prepared on `Development`: original canonical subject, sender, explicit UTC received time and unavailable fallbacks, only after existing private C1/C2 per-user/agent/mailbox/revision scope checks. Original links, 200-page cursor, feature flag, review-only consent and Overview-first remain unchanged.
- **Commits/source:** `7d1230b9` RED test, `abe796cd` presenter, `37e7ac1` private metadata selection, `bebd8775` UI, `61d0a74` test correction, plan `fa5e72b2`, session `docs/project-control/sessions/DEV01-CATCHUP-SOURCE-DETAILS-20261023.md`. Fresh GitHub 17/17 source invariants; isolated mirror Node 3/3 and strict TS. Committed native test, web/db TS, real Postgres/browser/CI/deployment **not run**. This is not completed source-grounded AI high/medium/low ranking.
- **Exact next DEV-01:** Run `node --experimental-strip-types --test apps/web/tests/catch-up-source-details.test.mjs apps/web/tests/catch-up-source-coverage.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts tests/overview-first-entry.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`. Authenticated authorized disposable 0/200/320 source pages, two users/two orgs, revoked/stale grants, source deletion, missing metadata, keyboard/mobile, feature-off 404. Then resume C3 negative provider/grant/lease tests while generator remains OFF; R1a clock timezone/DST acceptance remains independent.
- **Owner/privacy gates unchanged:** A selected 5-day window ≠ five days without platform usage; background sync is independent. Private per-user presence/retention/opt-out; persistent R1b proposal confirmation; unattended 09:00/24-hour routine work and WhatsApp standing digest consent/template/recipient require architecture/security approval. No duplicate scheduler, employee attendance tracking, automatic mail sends, worker enable or migration. FIX-01 owns independent bugs, OPS-01 deployment/runtime; do not poll CI/Vercel.

---

## DEV-01 — DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023 — provider UI source checkpoint
- **Authorized/current:** User requests task-first AI Provider Setup redesign on `Development` with no confusing duplicate provider dropdown. Read-only inspected open Voice Chat page: ElevenLabs/Sarvam tiles plus redundant select, fragmented TTS/STT configuration and ambiguous key-enabled statuses.
- **Delivered:** Four task areas (Chat & writing, Voice pipeline, Live voice, Knowledge search); compatible, keyboard-accessible explicit vendor cards; no preselected vendor and no second vendor dropdown; guided credential, vendor model and review/save steps; Voice Chat separately states TTS+STT requirements and preserves opt-in ElevenLabs Realtime key reuse; configured status checks enabled key+saved model for ALL needed purposes, never promises runtime connectivity; org lookup failures have retry. Implementation/test detail `sessions/DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023.md`. No schema changes, credential changes or provider sends.
- **Evidence:** 19/19 isolated GitHub-source regression callbacks and 6/6 pure status helper cases; full Node/Vitest, web typecheck/build, browser keyboard/mobile with new app and live vendor access NOT RUN. This is source implementation, NOT live acceptance. Phase 4 `implementation_in_progress`, C3 off, R1b/WhatsApp consents gated.
- **Exact next DEV-01:** In sanitized dependency-equipped current `Development` checkout run `node --experimental-strip-types --test apps/web/tests/ai-provider-guided-setup.test.mjs apps/web/tests/ai-provider-setup-safety.test.mjs apps/web/tests/ai-provider-organization-safety.test.mjs apps/web/tests/elevenlabs-voice-catalog-recovery.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts` and `pnpm --filter @ai-comms-agent/web typecheck`. Then keyboard/mobile browser all four categories, no-default, failure+retry, multi-model voice and credential-switch reset, with correct authorized provider credential/capability account. Correct DEV-01-owned UI errors from actual test output. FIX-01 independent runtime defects, OPS-01 CI/deploy/env/vendor verification (no polling).

---

## DEV-01 — DEV01-CHAT-COMPOSE-IDENTITY-20261023 — permission visibility and profile-aware email review
- **Implemented on Development, 2026-10-23:** Existing host-authorized chat compose now shows **actual** authenticated user email.write, agent draft permission and send-request permission with separate mandatory human approval. Several From mailboxes prompt explicit selection rather than auto-choosing one. Missing To asks for the exact email, raw draft and saved-draft approval tool paths reject empty/invalid To, authenticated profile name/email may provide an editable Best regards signature without guessed details. Chat/voice model planning receives bounded verified profile metadata plus clarification guidance; execution policies unchanged.
- **Source/test:** `sessions/DEV01-CHAT-COMPOSE-IDENTITY-20261023.md`; implementation `657ffd55,9665d502,b39d48dd,9b7ff6bb,1dcea507,1ad23924,0315869f,e09b7d13`, source tests `7806eac1,d86e6739`, Vitest `f8e26785`. Re-fetched GitHub source **54/54 contract + 22/22 invariant PASS**. Actual Node/Vitest/typecheck/browser/DB/provider execution NOT RUN. No factual claim that any particular user has an email.write grant.
- **Exact next action:** Run `node --test apps/web/tests/chat-compose-identity.test.mjs apps/web/tests/chat-mail-compose.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-compose-identity-runtime.test.ts tests/email-permission-presets.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/email-agent-runtime typecheck`. Then authorized authenticated two-mailbox browser validation of explicit From/To, saved name/no-name, distinct true actor/agent grants, tool denial, and approval-not-send. OPS-01 owns deploy/real provider; FIX-01 independent source defects. C3 registration, R1b activation and WhatsApp consent remain gated.

---

## DEV-01 — DEV01-CATCHUP-COVERAGE-CLARITY-20261023 — page-by-page personal mail source visibility
- **Current slice:** Source-only C4 catch-up progress improvements on Development. Test-first six-case `apps/web/tests/catch-up-source-coverage.test.mjs` `5fb5c549`; pure helper `apps/web/src/lib/briefings/source-coverage-display.ts` `b6aecacf`; user-readable C4 UI source coverage `cfed27d7`; Superpowers plan `docs/superpowers/plans/2026-10-23-catch-up-source-coverage-clarity.md` `5bb6b08b`; full session `sessions/DEV01-CATCHUP-COVERAGE-CLARITY-20261023.md`.
- **Person-facing behavior:** Clearly distinguish selected count, paginated source links (e.g. 200/320), incomplete cursors and missing source links; never call loaded links an AI-generated/reviewed summary, last-five-days selection proof of absence, or another person's mailbox. Overview-first and private five-day entry unchanged.
- **Evidence:** Fresh GitHub source checks **14/14 PASS**; isolated pure helper Node 22 behavior **5/5 PASS** and strict TypeScript mirror PASS. **NOT RUN**: actual committed Node source test, web Vitest/typecheck, disposable DB/revocation/browsers, live deployment/CI. C3 worker, R1b standing routine consent, WhatsApp delivery still OFF/GATED; Phase 4 `implementation_in_progress`.
- **Next exact:** `node --experimental-strip-types --test apps/web/tests/catch-up-source-coverage.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs apps/web/tests/routine-timing-preview.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts tests/overview-first-entry.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`. Then authenticated two-tenant/agent-switch/revoked-grant 0/200/320 pagination, browser keyboard/responsive validation and C3 negative provider/lease/scope tests without activation. DEV-01 UX only, FIX-01 bug remediation, OPS-01 deploy/provider. Do not wait for CI/Vercel.

---

## DEV-01 — DEV01-ROUTINE-TIMING-PREVIEW-20261023 — safe R1a human timing preview
- **User direction:** Make personal, employee, SME and multinational mail handling understandable via Overview-first catch-up, agent-assisted routines and eventual human-consented WhatsApp summaries. Recovered current source and checked-in Superpowers plans; Phase 4 remains `implementation_in_progress`.
- **Committed source:** Test-first `apps/web/tests/routine-timing-preview.test.mjs` (five source cases) `20c41cfb`, private GET-only `/routines/preview` page using existing shared clock engine `7a7f0565`, Overview link `75cb3ac3`, test contract revisions `86f49eb0,41693926`. Expanded phases/personas/consent plan `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md` `4d18e192` and session `docs/project-control/sessions/DEV01-ROUTINE-TIMING-PREVIEW-20261023.md`. R1a preview never persists a job or delivers mail/WhatsApp. **Follow-on R1a enhancement:** `edde5453` extends the five-case regression to fixed 1/6/12/24-hour choices, `2a193964` implements the bounded user selection (min 60 minutes) in the same inert page. Latest focused GitHub assertions **19/19 PASS** on committed source (private auth, canonical clock, UTC/local preview, no writes, no external send); native tests and web build remain NOT RUN.
- **Evidence:** Current GitHub source inspection 25/25 corrected targeted invariants across page, Overview, canonical clock/helper and regression source. **NOT RUN**: actual committed Node tests, seven existing clock runtime tests, web TypeScript, browser/DB/provider/deployment, CI/Vercel. No production support claimed.
- **Exact next:** `node --experimental-strip-types --test apps/web/tests/routine-timing-preview.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs`; `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; authenticated browser timezone/DST, expired one-shot, no-save/no-provider check and 320/390/768px keyboard UX. Then independently C3 disposable grant/lease/provider negative verification and C4a browser grants/source coverage. **Do not** activate C3 worker, persist R1b, auto-send WhatsApp, or imply reviewed standing consent. FIX-01 handles source bugs, OPS-01 infra/CI/Meta/deployment. Existing admin write/Chat fixes handled by their owners; do not overlap.
- **Plan:** `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md`; parent 5-day and Overview-first plans remain authoritative.

---

## DEV-01 — DEV01-ADMIN-EMAIL-WRITE-DEFAULT-20261023 — 2026-10-23
- **Owner report:** Signed-in platform administrator's Chat compose refuses drafts with `missing_email_write` although all 16 agent email tools are selected. Root cause was the missing built-in owner/admin grant in immutable `SYSTEM_ROLE_PERMISSIONS`; email.write already existed as a typed contract. Current architecture has four internal membership roles rather than a separate platform_admin enum.
- **Committed on Development:** `61eb507d` grants `email.write` to active owner/admin only (member/viewer still denied); `a5123f59,7f8b4457` regression tests; `145d2629` user-facing role guidance. Existing per-agent tool permission, connected primary mailbox/provider capabilities and separate human approval remain mandatory. No direct send or database migration.
- **Evidence:** 16/16 source invariants; actual executed web Vitest/shared+web typechecks, authenticated production role/browser, draft and approval acceptance pending. No live account elevated or session role asserted.
- **Exact next:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/email-write-permission-contract.test.ts tests/rbac-persistence-consistency.test.ts`, `node --test apps/web/tests/chat-mail-compose.test.mjs`, `pnpm --filter @ai-comms-agent/shared typecheck`, `pnpm --filter @ai-comms-agent/web typecheck`. OPS-01 deploy approved SHA and verify actual active owner/admin membership, two independently gated mail provider capabilities and draft save/request approval without auto-send; negative member/viewer/suspended/cross-org. DEV-01 separately continues current five-day catch-up/C3/C4/R1a/R1b work, no worker/routine activation.
- **Session:** `sessions/DEV01-ADMIN-EMAIL-WRITE-DEFAULT-20261023.md`.

---

## DEV-01 — DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023 — Overview-to-C4 guided five-day preview

- **Owner instruction:** Make AI Comms Agent usable for ordinary people, employees, SMEs and multinational teams: explain missed permitted mail, prioritize source-backed action, eventually offer AI-planned 09:00 or every-24h routines and optional consented WhatsApp summary. Explicitly continue DEV-01, not FIX-01/OPS-01. Phase 4 stays `implementation_in_progress`.
- **Completed source slice on Development:** Test-first four-case Node regression `apps/web/tests/catch-up-five-day-entry.test.mjs`, pure 1/5/7/30 UTC lookback helper `apps/web/src/lib/briefings/catch-up-window.ts`, private `/catch-up?days=5` sanitized server entry, client five-day selection/actual UTC manifest window and explicit **not detected absence** disclaimer, feature-gated **Review last 5 days** Overview action with unchanged direct seven-day default. Commits `b45ed5e7,7785e189,ed11d533,3622c0e4,a727a086`; phased plan `a63b2745`, session `sessions/DEV01-HUMAN-FIRST-FIVE-DAY-CATCHUP-20261023.md`. No background generation/WhatsApp/permission activation.
- **Verification:** Isolated Node 22 helper behavioral tests **4/4 PASS** + strict isolated helper tsc exit 0; current GitHub source contract 13/14 with one false-positive in inspector matching legacy test text instead of actual route, actual Overview markup correct. **NOT RUN:** committed repo tests, full web TS, Vitest, Postgres/browser, real C3 generation/worker, deployment. Concurrent FIX-01 changes continue independently.
- **Exact next:** `node --experimental-strip-types --test apps/web/tests/catch-up-five-day-entry.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/overview-first-entry.test.ts tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts tests/chat-conversation-sidebar-layout.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`. Browser: BRIEFINGS_ENABLED=false no Overview link/route 404; flag-on private 5-day date period, invalid days fallback seven, grant-denied negative, source pagination/review button, mobile and keyboard. Capture SHA and actual outcomes; no CI polling.
- **Continuations/gates:** Existing C1/C2 scoped manifests, C3 source-grounded generator unregistered/off pending grant/lease/provider negatives, C4 true Welcome-back metrics require personal reviewed/visit/coverage facts, and R1a/R1b pure proposals still need focused tests. R1b persistence/recurring digest standing consent, scheduler activation and R3/R4 external WhatsApp delivery require separate explicit reviewed authority and OPS-01 provider evidence. Keep Schedules and Automations as distinct existing engines under a future single Routines UX. FIX-01 owns substantial bugs, OPS-01 owns infra/CI/deploy and Meta.
- **Plan:** `docs/superpowers/plans/2026-10-23-dev01-human-first-five-day-mail-catchup-continuation.md`, earlier Overview-first plan/spec still authoritative.

---

## DEV-01 — DEV01-CHAT-PERSISTENT-CONTROLS-SIDEBAR-20261023 — latest Chat layout continuation, 2026-10-23
- **Owner authorized:** Make Sarvam AI controls always visible while chat messages grow, show New chat/recent chats in a vertical sidebar instead of a top horizontal list. Implemented on Development with independent message/sidebar/optional-panel scroll and mobile Chats drawer. Phase 4 still `implementation_in_progress`; conversation ownership model unchanged.
- **Commits:** `273799e7` structural UX, `6b5839f7` keyboard dialog handling, `454d2d7b` 6 regression tests. **19/19 current source invariants PASS**, native app/browser acceptance NOT RUN. Session `sessions/DEV01-CHAT-PERSISTENT-CONTROLS-SIDEBAR-20261023.md`.
- **Exact next:** `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-conversation-sidebar-layout.test.ts tests/chat-conversation-history.test.ts tests/chat-agent-context-race.test.ts tests/chat-first-workspace.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`. Browser check at 320/390/768/1024/1440px and long messages/session list: header controls + composer stay, recent chats scroll separately, mobile Chats keyboard/close/focus, no broken agent/deep-link/draft/voice return. Record SHA and real execution evidence.
- **Handoff:** OPS-01 owns deployment, mobile/browser environment and production validation. FIX-01 owns any unrelated substantial implementation defect. Continue independent DEV-01 C3/C4 and R1a/R1b checks without unapproved routine activation or CI waiting.

---

## DEV-01 — DEV01-MULTI-CHAT-SESSIONS-20261023 — independent chat sessions, 2026-10-23
- **Owner feature:** Fresh chat + resumable prior Q&A source committed on Development. Plan `docs/plans/CHAT_CONVERSATION_SESSIONS_20261023.md`; seven regression cases in `apps/web/tests/chat-conversation-history.test.ts`. Source checks 18/18; native tests/typechecks/PostgreSQL/browser unverified. Phase 4 stays in progress.
- **Exact next:** `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-conversation-history.test.ts tests/chat-agent-context-race.test.ts tests/chat-authorization.test.ts tests/streaming-conversations.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`. Then authenticated two-chat creation/selection/old Q&A/last-N memory/voice return, cross-organization/agent negative and draft-discard confirmation in disposable DB/browser; collect exact SHA.
- **Blocker/decision:** Existing histories are organization+agent scoped, not per-user private. Privacy/owner migration + legacy migration policy require product approval before enabling personal-only history. Continue authorized C3/R1b independently; no automatic gated routine activation. FIX-01 owns bugs; OPS-01 CI/infra/deployment.

---

## DEV-01 — DEV01-OVERVIEW-FIRST-EMAIL-COMMAND-CENTER-20261023 — current Development UI continuation

- **Authority:** Owner expressly asked to show the existing Overview screen first, while planning safe five-day personal catch-up and scheduled WhatsApp/email digest workflows for ordinary users, employees, SMEs and international organizations. The prior Chat-first landing preference is superseded **only** for navigation; `/chat` remains an independent AI workspace. Phase 4 remains `implementation_in_progress`.
- **Source delivered:** `/` redirects to `/overview`, Overview is first sidebar item, Chat is at `/chat`, and the Overview provides mobile-friendly Inbox/Clara/Schedules/Automations actions and a server-gated private catch-up preview link. Overview labels existing organization-wide metrics honestly rather than inventing per-user reviewed/absence counts. Code commits `aed56cd3,65ada232,2ed12305,33f15503`; tests `3fa0fbbd,fe498178,8ada8025`. New [Superpowers continuation plan](../superpowers/plans/2026-10-23-overview-first-mail-command-center.md) and [session](sessions/DEV01-OVERVIEW-FIRST-EMAIL-COMMAND-CENTER-20261023.md).
- **Verification:** 10/10 read-only GitHub source invariants PASS; actual repo Vitest/web tsc, browser/mobile, real DB, feature flag and production route **NOT RUN**. Source implementation does not mean production site has changed.
- **Exact next DEV-01 step:** On sanitized, dependency-equipped latest `Development` SHA run `pnpm --filter @ai-comms-agent/web exec vitest run tests/overview-first-entry.test.ts tests/workspace-shell.test.ts tests/lovable-ui-migration.test.ts` and `pnpm --filter @ai-comms-agent/web typecheck`; confirm authenticated root→Overview, direct Chat, nav mobile, and `BRIEFINGS_ENABLED=false` hides Catch-up link. Record actual SHA and results; route substantial implementation errors to FIX-01.
- **Independent next product step:** Continue existing C3 source-grant/lease/Clara partial/failure acceptance tests, then C4 authenticated five-day high/medium/low review/coverage UX. The C3 worker remains unregistered/off. Run outstanding R1a/R1b proposal tests without granting scheduling/delivery; **R1b Task 2 persistence, recipient standing consent, routine activation and WhatsApp dispatch require separate authorization/runtime gates**.
- **Others:** FIX-01 owns scheduler/tenant and new source defects; OPS-01 owns actual build/deploy, migration/host, credentials/Meta provider and incident response. Do not poll or wait for CI/Vercel when independent DEV work exists.

---

## FIX-01 — FIX01-SARVAM-AGENT-VOICE-OVERRIDE-20261022 — 2026-10-22
- **Defect:** Per-agent AI Settings saved Sarvam realtime provider in `agent_ai_settings`; voice session startup incorrectly read retired `agents.voice_provider` and selected OpenAI, then its SDP endpoint failed `realtime_not_configured`. This is a source selection bug, not proof of missing Sarvam credentials.
- **Committed `Development`:** `ae1f92e0` provider precedence, `505e9e8d` agent-scoped session lookup/model/voice binding, `13b44a8a` seven regression cases. 16/16 static source invariants PASS; native runner/typecheck and live provider acceptance NOT RUN.
- **Exact next FIX-01 verification:** `pnpm --filter @ai-comms-agent/web exec vitest run tests/voice-agent-provider-selection.test.ts tests/voice-realtime-transport.test.ts` followed by `pnpm --filter @ai-comms-agent/web typecheck` on fresh `Development`; address only concrete source failures.
- **OPS-01 handoff:** Verify approved deployed revision, same-tenant saved Sarvam override and credential/relay readiness (no secrets in output), actual `realtimeProvider=sarvam` with `/api/voice/sarvam/session` when native relay is ready, or explicit Sarvam pipeline when relay unavailable; only consider native realtime ready after provider WebSocket and host session become active. GitHub #26 stays open pending broader real-transport acceptance. Revoke exposed browser session. No deployment or provider action by FIX-01.
- **Limits:** Do not fallback to OpenAI to mask Sarvam missing relay; Phase 4 remains in progress; DEV-01 feature scope separate.

---

## DEV-01 — email.write typed permission host follow-up, 2026-10-22
- **Host evidence at prior Development `b24d6f90`:** Two permission web Vitest suites 14/14 PASS, DB TypeScript check completed without errors; web TypeScript FAIL TS2345 at `apps/web/src/app/api/chat/mail-compose/route.ts:53–54` because `email.write` was absent from shared `PermissionName`.
- **Committed correction:** `d7392f8f` declares `email.write` in the shared permission catalogue (no system role automatically gains it); `e6e93ea1` guards catalogue/write tool alignment and lack of implicit grants. Phase 4 remains `implementation_in_progress`. Source-only correction, no production permissions/grants changed, post-fix host checks pending.
- **Exact next:** On a fresh matching `Development` checkout run `pnpm --filter @ai-comms-agent/web exec vitest run tests/email-write-permission-contract.test.ts tests/email-permission-presets.test.ts tests/agent-mail-channel-policy-regression.test.ts`, then `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`. Record current SHA and actual results; correct real follow-on compiler/test failures via FIX-01 if independent. Later DEV-01 product design must explicitly authorize actual user `email.write` RBAC before draft/approval features can function; do not implicitly elevate existing roles or bypass the backend tool gate. OPS-01 owns deployment/CI.

---

## DEV-01 — DEV01-AGENT-PERMISSION-PRESETS-20261022 — 2026-10-22 (current permission UX slice)
- **Scope:** Owner-authorized quick AI-CLI-style mail tool bundles with individual checkbox override and chat permission editing/confirmation on `Development`. Previous source already implemented the 4 preset buttons and chat permissions; this session completed the missing stale-write safety, precise confirmation, safe Off and reload handling without broadening read/write authority. Phase 4 remains `implementation_in_progress`.
- **Source/test record:** `sessions/DEV01-AGENT-PERMISSION-PRESETS-20261022.md`. 22/22 fresh source assertions, no native tests/typechecks, DB/browser/deploy acceptance yet. No CI/Vercel polling.
- **Exact next:** On a dependency-equipped exact-`Development` checkout run `pnpm --filter @ai-comms-agent/web exec vitest run tests/email-permission-presets.test.ts tests/agent-mail-channel-policy-regression.test.ts` and `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`. Then authenticated two-admin/tab test: concurrent policy save must reject stale original snapshot with HTTP 409, preserve other admin's updated restrictions, allow explicit reload/review/reconfirmation. Verify chat and full settings preset choice + fine tuning; no send without approval.
- **Other independent DEV-01 next:** Resume previously authorized C3 source/review/lease verification and R1b existing focused time/proposal tests; do NOT auto-register worker, activate routine scheduling, send WhatsApp/email, or start R1b persistence without distinct authorization. FIX-01 owns unrelated bugs, OPS-01 owns CI/deploy and provider environment.

---

## DEV01-EMAIL-CHAT-COMPOSE-20261022 — latest DEV-01 Development product checkpoint (2026-10-22)
**Authorization:** Owner explicitly requested DEV-01 / Forge to make email drafting, review and send approval usable from chat and voice, plus modern one-click mail tool presets and in-chat confirmed admin policy edits. This work targets `Development`, not production `main`, and does not override earlier C3/routines disabled-by-default requirements.

**Current source state:** Chat now has an authenticated, same-organization, connected-primary-agent-mailbox compose GET/POST using the existing audited `email.draft.create` and `email.send.request` tools. A test-email prompt opens editable review only; saving a draft and requesting approval are two distinct explicit actions. The approval request is idempotent per draft and does NOT send. Administrator policy presets (read, draft, send-approval request, off), per-tool fine tuning, and confirmed in-chat policy saving are implemented. Voice/realtime continues through the host-authorized voice-turn tool pipeline; tool definitions now respect the signed-in actor's permissions; inactive voice has a route to agent-specific chat for visual review. No agent, mailbox, actor or provider permission is granted implicitly.

**Verification:** Four isolated Node helper cases PASS, two stand-alone strict TypeScript helper checks PASS, latest GitHub source checks 20/20 PASS. **NOT RUN on a dependency-equipped current Development checkout:** committed native Node/Vitest suites, web/email-runtime/clara/db typechecks, full worker/web regression, disposable PostgreSQL, authenticated browser, Sarvam function-calling provider, draft/action persistence, approval/worker delivery, CI/Vercel, or production deployed SHA. These are implementation commits, NOT customer-visible/live acceptance; earlier FIX-01 Sarvam source fix might still be absent from deployed site.

**Next DEV-01 action:** Run `node --experimental-strip-types --test apps/web/tests/email-permission-presets.test.mjs apps/web/tests/test-mail-compose-intent.test.mjs apps/web/tests/chat-mail-compose.test.mjs`, worker `node --import tsx --test tests/email-agent-loop.test.ts`, web `pnpm --filter @ai-comms-agent/web exec vitest run tests/sarvam-chat-tools-regression.test.ts tests/agent-mail-channel-policy-regression.test.ts`, and shared/clara/email-runtime/web TypeScript checks on one sanitized current Development SHA. Fix DEV-01-owned test/type or UX issues; exercise mocked A/B tenant and read-only actor negatives plus two-step draft approval UI. Continue authorized C3/R1b inert product work only within existing scope; do NOT enable C3 worker or external routine dispatch without separate authorizations/gates.

**OPS-01 handoff:** `HOF-DEV01-OPS01-EMAIL-APPROVAL-20261022`: independently verify live deployed SHA/provider support, persisted Sarvam agent policy/bindings and actor email.write; in an owner-approved test drive the actual draft → pending_approval → human approval → one worker/provider send and inspect sanitized evidence. OPS-01 owns deployment, provider credentials and infrastructure; no CI/Vercel polling or automatic external send by DEV-01. Full log root `worklog.md` and DEV-01 role worklog.

---

## DEV-01 — 2026-10-21, R1b inert routine proposals source slice (latest)

**Phase:** Phase 4 `implementation_in_progress`. Owner requested to continue next DEV-01 tasks and identify required owner actions. New R1b **Task 1 only** (pure strict proposal normalization, stable material config hash, human review preview and tests) committed directly to `main`. [Session/evidence](sessions/DEV01-R1B-INERT-PROPOSALS-20261021.md), following the [focused Superpowers plan](../superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md). Source commits `99e6435d`, `e00f6cb6`, `8a9b6286`, `78e32f45`, `15a50a44`, `d0088c77`, `205023f4`. This is **not a live or persisted routine**; no scheduler, WhatsApp send, database migration, app API, tool registration or feature activation.

**Evidence boundary:** In local isolated Node v22 harness the eight proposal checks went from RED (0/8) to GREEN (8/8) after implementation; a local TypeScript check using contract shims exited 0. The local suite used a simplified clock fixture for preview wiring, **not** the repo's genuine R1a DST module or real workspace dependencies. GitHub `node --import tsx` tests, three real package typechecks, current-tip C3/DB/full suites and browser **NOT RUN**. Earlier C3 29/29 and disposable DB 6/6 pass receipts refer to older SHA only. Keep the C3 worker and new routine execution OFF.

**Exact next DEV-01 action:** On a sanitized, dependency-equipped fresh `main` checkout, run `cd apps/worker && node --import tsx --test tests/routine-time.test.ts tests/routine-proposal.test.ts`, then root `pnpm --filter @ai-comms-agent/shared typecheck`, `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck` and `pnpm --filter @ai-comms-agent/worker typecheck`. Record tested SHA, raw output and failures; correct DEV-01-owned implementation errors only. Continue authorized C3 grounding/source-grant/lease failure verification independently; C4 authenticated five-day UX after C3. **R1b Task 2 persistence/confirmation and R3/R4 activated scheduling/external delivery require separate scope/authorization review and isolated DB/provider gates**; historical `0051/0052` routine DDL numbers are occupied.

**Owner actions, only when available:** provide focused command output from sanitized checkout; review/approve R1b proposed source/confirmation/standing-consent boundaries before storage/activation; later designate test-only WhatsApp Business sender, verified recipient, approved Meta template and suitable credential-free evidence through OPS-01 (do not paste tokens, passwords or customer email). FIX-01 handles scheduler and tenant failures; OPS-01 handles environment/CI/migrations/provider/build-hook incident. No CI/Vercel waiting for independent development.

---

## DEV-01 R1b Superpowers proposal handoff — 2026-10-20 (newest)

**Scope:** Owner-requested human-first Email Command Center continuation. Current Phase 4 remains `implementation_in_progress`; C3 worker and all new routine delivery remain OFF. R1a routine time-preview source is committed but its new Node/TypeScript checks have not been run. C1/C2 implemented; current-tip C3 and C4 acceptance pending. Last observed migration filename `0052_briefing_selection_coverage.sql` — older routine plan `0051/0052` example filenames must not be reused.

**Work in this continuation:** [Proposed focused R1b Superpowers implementation plan](../superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md) and [DEV-01 recovery/product session](sessions/DEV01-EMAIL-COMMAND-CENTER-R1B-PLAN-20261020.md). Defines safe assistant-generated preview, source/grant-checked immutable proposal, exact user confirmation, reviewable statuses, paused/inactive persistence and deferred schedule/WhatsApp dispatch. The design/DB authorization boundary is **proposed for review**, not automatically approved or feature activated.

**Exact next DEV-01 actions:** (1) In a sanitized dependency-equipped current-main checkout run `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`; then from root `pnpm --filter @ai-comms-agent/shared typecheck` and `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck`; record actual output and SHA. The GitHub connector-only session could not execute these. (2) Review R1b plan against parent spec, then implement test-first Task 1 pure proposal normalization/preview only when approved; R1b DB/confirmation requires explicit authorization and fresh migration-tip check, and worker remains off. (3) Independently continue approved C3 grounding/lease/retry and current-tip affected tests; disabled-by-default poller registration only after its safety tests, then C4 authenticated five-day/mobile/source-grounded priority journey.

**Role routing:** FIX-01 retains scheduler correctness, cross-tenant event/routine proof, independent source defects and earlier broad suite failures. OPS-01 retains sanitized test host, migrations/CI/Vercel, WhatsApp templates/providers, security build-hook incident response and production deployment. Do not poll CI or wait for either agent to finish independent work. No recipient send/authorization, schema migration or live feature was performed here.

---

## DEV-01 current next action — 2026-10-20, human-first email command center and R1a preview

**Phase:** Phase 4 `implementation_in_progress`. Owner invoked DEV-01 to continue on direct `main`, preserve independent FIX-01/OPS-01 work, and prioritize accurate five-day email catch-up with accessible action/importance cards and human-confirmed daily/hourly/weekly/one-off routines, optional narrowly consented WhatsApp briefings.

**C3 updated evidence:** Owner-host earlier 29/29 focused Node + four TypeScript checks passed at `daa89ffd`. A later operator receipt in root `worklog.md` records **6/6 disposable localhost PostgreSQL C3 tests PASS** after fast-forward to `2789527a` (C3 bootstrap container fix included). This confirms that particular isolated host test only; no current-tip full-suite/provider/browser/production gate accepted. C3 worker still disabled/unregistered; C4 authenticated UX pending. Historical “C3 DB not run” lines below describe earlier checkpoints, not the newest host receipt.

**R1a code authored on main, OFF:** Seven deterministic tests `apps/worker/tests/routine-time.test.ts`, typed `packages/shared/src/routines/types.ts`, pure `packages/email-agent-runtime/src/routines/time.ts` and exports. Code commits `2b2342f3`/`7b4a0d96`/`9eb4edc0`/`68f7a6af`/`7dd59584`/`7daccec7`. Ten current-source checks PASS; **tests/typechecks NOT RUN on these new commits**. This is preview-only, not scheduled execution or permission to send.

**Exact next action:**
1. From a dependency-equipped `main` checkout run `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`, then `pnpm --filter @ai-comms-agent/shared typecheck` and `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck` from repository root. Fix DEV-01-owned implementation issues from real output, do not claim source assertions are unit test proof.
2. Continue the existing C3 worker grounding, source-grant/lease, provider error/retry verification and broader affected worker/web/db/Clara suites. Only after verified authorized behavior add **disabled-by-default** worker registration, and then authenticated C4 five-day/mobile/keyboard/source-link journeys.
3. Independently plan R1b immutable proposals, revisions, permissions and migration tip; do not create/activate a second scheduler, reuse historical DDL numbers, or enable WhatsApp standing consent/delivery before reviewed authorization, FIX-01 runtime isolation proof and OPS-01 provider verification. The legacy R1/R2/R3/R4/R5 plans remain in scope, the new UX extensions remain proposed refinements.

**Recovery:** [R1a current session](sessions/DEV01-EMAIL-COMMAND-CENTER-R1A-20261020.md); [Superpowers UX/phase supplement](../superpowers/plans/2026-10-20-ai-email-command-center-ux-rollout.md). FIX-01 owns significant runtime bugs/scheduler and tenant defects; OPS-01 owns CI/Vercel/migration/deployment, provider/WhatsApp evidence and build-hook security response. Do not wait or poll their work when independent development exists.

---

## DEV-01 latest next action — 2026-10-20, C3 DB acceptance gate

Focused C3 tests **29/29 PASS** and db/Clara/email-runtime/worker TypeScript checks **PASS** on owner host after fast-forward `daa89ffd`. GitHub source commit `4cda8ee5` adds a five-subtest disposable Postgres canonical source harness; it is **NOT RUN**. Do not activate or register worker yet. [Verification session](sessions/DEV01-C3-HOST-VERIFIED-DB-GATE-20261020.md).

**Next:** on a fast-forwarded checkout with *the existing verified* loopback-only `ai-comms-c1-testdb` tmpfs Docker fixture, run `BRIEFING_TEST_DATABASE_OPT_IN=disposable-local-c1 BRIEFING_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/ai_comms_c1_test node --test packages/db/tests/briefing-c3-canonical.integration.test.mjs`. The harness refuses any non-disposable configuration. DEV-01 to fix real integration errors and verify complete suites; only then add disabled-by-default registration, then C4 authenticated browser tests. OPS-01 owns production migration and deployment. Historical next actions retained below.

---

## DEV-01 — C3 multi-mailbox claim scope fix, 2026-10-20 (latest)

Owner-host focused verification: 27/27 Node tests passed (console output provided, no commit SHA in output); this predates the latest corrective commit. GitHub source fix `f036d6bf434ee710aaa7e53d2444c18fa74bcb62` resolves an untested multi-mailbox failure: canonical batch loader now resolves full immutable manifest mailbox grants/scope before checking that batch sources are a permitted subset. Two regression cases added; **post-fix 29 focused tests, TypeScript, and disposable-DB integration NOT RUN**. Phase 4 remains `implementation_in_progress`; worker remains disabled/unregistered. Session [DEV01-C3-MULTI-MAILBOX-BATCH-SCOPE-20261020](sessions/DEV01-C3-MULTI-MAILBOX-BATCH-SCOPE-20261020.md).

**Exact next authorized DEV-01 task:** fast-forward main, rerun all three briefing Node test files (expected 29 tests), run `pnpm --filter @ai-comms-agent/{db,clara-core,email-agent-runtime,worker} typecheck` as four separate invocations, then disposable PostgreSQL full-manifest/single-mailbox batch, revocation, deletion and lease tests. Fix any failures before feature registration. OPS-01 owns database/deployment; C4 browser acceptance comes after C3 verification. Historical instructions follow.

---

## DEV-01 C3 canonical source + Clara — 2026-10-20 (latest)

Commits `1bae80c8`, `8f382ead`, `464ab70d` on main: grant/lease/revision-checked C3 source loader, ambient-RAG-free existing Clara generation, partial source/grounding protection and durable lease retry. **11/11 static source assertions PASS; new Node tests/typechecks NOT RUN.** Worker remains unregistered/disabled; Phase 4 `implementation_in_progress`, no deployment or migration. Full checkpoint: [DEV01-C3-CANONICAL-CLARA-20261020](sessions/DEV01-C3-CANONICAL-CLARA-20261020.md).

**Exact next executable DEV-01 task:** from a clean current-main checkout run `cd apps/worker && node --import tsx --test tests/briefing-worker.test.ts tests/briefing-c3-wiring.test.ts tests/briefing-generation.test.ts`; worker/db/Clara typechecks; exercise scoped PostgreSQL fixture revocation/stale source/restart. Fix actual failures, then add **disabled-by-default** registered poller only after its authorization/retry gates are tested. Next C4 authenticated journey acceptance. OPS-01 owns real database/deploy and FIX-01 separate runtime/security incidents. All older checkpoints below are history.

---

## DEV-01 C3 worker core checkpoint — 2026-10-20

Source commit `7da1d2b5e153e9ee361a832d3535e103cb40f753`: unregistered worker orchestration and six regression test cases added. Tests/typechecks not run; no runtime feature activation, production SQL or deployment. **Exact next authorized task:** implement grant/revision-checked canonical source loader with existing Clara adapter (no competing provider), expand provider timeout/429/prompt injection/grounding/lease recovery tests, execute focused worker tests and typechecks, then register behind disabled-by-default server flag only after verification. See `sessions/DEV01-C3-WORKER-CORE-20261020.md`. Phase 4 remains implementation_in_progress. Historical entries below retained.

---

## DEV-01 current handoff — 2026-10-19, final repository synchronization

See [current handoff](sessions/DEV01-CURRENT-HANDOFF-20261019.md) for completed, in-progress, pending and next work. C1/C2 focused implementation is complete; C3 worker/grounding integration is next, then C4 authenticated UX acceptance. Phase 4 remains implementation_in_progress. Latest upstream operator/vector fixes preserved; affected checks pass 35/35 and 11/11. Earlier full-suite counts are a pre-final-merge baseline. Security follow-up remains open. Existing entries retained as history.

---

## DEV-01 — C2 integrated and verified — 2026-10-19

C2 immutable selection, scoped review, snooze and fenced batch recovery are implemented. Concurrent upstream catch-up UI/generation and OPS work preserved; canonical services reconciled, migration0052. Final34SQL/25domain/37web/3integrity checks pass; typechecks, web build and migration structure pass. Full worker/web suites still fail; see [C2 session](sessions/DEV01-CATCHUP-C2-20261019.md). Upstream obfuscated build hooks were removed; [security follow-up](sessions/FIX01-OPS01-BUILD-HOOK-INCIDENT-20261019.md) remains open because credential exposure is uncertain. **Exact next action:** complete C3 worker/grounding/recovery integration using existing generation helpers, then authenticated C4 UI acceptance. Feature remains off by default; no deployment or routine activation. Older checkpoints below are historical.

## DEV-01 — Migration-only operator continuation, fresh-target hardening — 2026-10-19

- **Original owner request:** Create migration scripts and commit to GitHub; user will deploy and run migrations. Existing `main` already has `scripts/operator-migrate.sh` (`plan|apply|verify`) and interactive `scripts/operator-one-shot.sh`, tests and runbooks. No duplicate migration script or new schema DDL was added; current source SQL ends at `0051_microsoft_oauth_platform_configs.sql`.
- **Source safety improvement directly on existing main:** The `--allow-fresh` path previously trusted an absent/empty migration ledger. New `assertFreshDatabaseEmpty` and PostgreSQL catalog query now reject any existing non-extension user table/view/sequence/foreign table before permitting a fresh bootstrap. This prevents applying the migration chain over an existing data-bearing database with missing history or partial DDL. Preserves all original database-name, SHA ledger, independent backup, and post-verify gates. Files: `packages/db/operator-migration-{core,check}.mjs`, two `scripts/tests/operator-migrat*.test.mjs`, migration operator runbook.
- **Actually checked:** 18/18 deterministic assertions on latest GitHub source blobs for relation inspection, preflight-only gate, checksum and target validation, retained backup/apply semantics, and regression tests. **NOT RUN:** New Node migration suites, PostgreSQL connection/actual migration, Docker build on updated SHA, complete web/worker/Clara tests or browser. Operator previously reported 29/29 operator tests, web build, six TypeScript checks, 26 Clara tests, but web Vitest offline Ethereum DNS and worker SIGKILL blocked full acceptance; OPS-01 issue #38.
- **Exact operator next action (no write until verified):** Pull **main**, run `node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs scripts/tests/operator-one-shot-script.test.mjs`, `bash scripts/verify-migration-chain.sh`, complete isolated web/worker verification after OPS #38; build web image using the approved Compose/env; then `bash scripts/operator-migrate.sh plan`. Confirm printed `DATABASE:`, SQL PENDING versions and actual ledger. On a data-bearing target require a restorable independently verified backup, then ONLY operator may execute `bash scripts/operator-migrate.sh apply --expect-db CONFIRMED_DATABASE_NAME --backup-confirmed` and subsequent `verify`. Do not use `--allow-fresh` to override missing/unknown history on existing DB.
- **Role boundaries:** DEV-01 authoring completed. OPS-01 owns source test execution on equipped host, production backup/migrations, CI, deployment and provider credentials. FIX-01 runtime/HTML-security defects unchanged. No production action, PR, branch or phase acceptance. Session `docs/project-control/sessions/DEV01-MIGRATION-FRESH-TARGET-SAFETY-20261019.md`.

---

## DEV-01 — Operator migration release preflight: worker source fixes, OPS web test blocker (2026-10-19)

- **Evidence supplied:** Operator used `ACA_RELEASE_TARGET=migration bash scripts/operator-one-shot.sh` on `main` `6fdeb5a3`. **29/29** operator tests PASS; migration declaration+chain PASS; Docker web build PASS; 6 workspace TypeScript checks PASS; Clara Core **26/26** tests PASS. Then web Vitest failed DNS lookup `EAI_AGAIN eth-mainnet.public.blastapi.io` in deliberately offline Docker, and the parallel worker suite was SIGKILLed with 9 displayed failed test names but without error stacks. **No DB plan, backup confirmation, migration or deploy occurred.**
- **DEV-01 source fix direct main (no branch/PR):** Corrected erroneous double-escaped control-character regex in `apps/worker/src/knowledge/clara-email-vector-adapter.ts` that rejected ordinary org/account/message identifiers. Added real NUL/newline/DEL negative regression cases. Updated stale Clara knowledge SQL test expectation for text search parameter `$3` rather than `$4` (no production SQL change). Commits `013a230c`, `05ace89c`, `cd0590f3`, `77aadf38`. Current GitHub source regex/SQL regression checks **6/6 PASS**; full worker run still unverified.
- **OPS-01 handoff [#38](https://github.com/Rilan-Dev/ai-comms-agent/issues/38):** Investigate external Ethereum RPC DNS during disconnected web Vitest and parallel test shutdown. Preserve `docker run --network none` and never inject production DB/AI credentials to pass tests.
- **Next exact host check (nonproduction, diagnostics only):** `git pull --ff-only origin main && docker build --target web --tag "aca-operator-verify:$(git rev-parse --short HEAD)" .`; then run isolated worker test command `cd /workspace/apps/worker && node --import tsx --test tests/clara-email-knowledge-contract.test.ts tests/clara-email-vector-adapter.test.ts` and separately `cd /workspace/apps/web && pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --reporter=verbose` inside new image with `--network none`, as documented in the [session](../sessions/DEV01-OPERATOR-TEST-TRIAGE-20261019.md). Only after actual full suite PASS proceed with approved operator script (exact DB, backup, `APPLY`).
- **Status:** Phase 4 not accepted. Owner/OPS performs migration; FIX-01 retains voice transport and HTML ingest defects. No new PR, branch or production action.


---

## 2026-10-19 — One-shot release menu accepts 1/2/3 as well as target names

- **Owner observed:** On a clean checked-out `main`, `operator-one-shot.sh` displayed `1) vercel; 2) docker; 3) migration`, but entering `2` failed `Choose vercel, docker, or migration`. Validation stopped before tests, migration, backup confirmation or deployment, so that attempt performed **no production change**.
- **Source fix on existing main (no branch/PR):** `scripts/operator-one-shot.sh` now maps `1|vercel`, `2|docker`, and `3|migration` to the existing canonical target names before the existing Vercel/Docker/migration safety checks. `scripts/tests/operator-one-shot-script.test.mjs` adds a Bash-driven regression for all six valid choices and invalid `4`; runbook documents both forms. Existing approved production Compose requirement, backup gate, explicit database `APPLY` confirmation and separate OPS-01 production execution remain unchanged.
- **Verified in this chat:** 11/11 current GitHub source-contract safety checks PASS (menu mapping, invalid-case rejection, Compose and backup protections, regression test presence, docs). The actual Node test/Bash execution, production Compose validation, build, SQL migration and deployment were **not run** here. OPS-01/owner executes on the host.
- **Immediate operator action:** `git pull --ff-only origin main && ACA_HEALTH_URL=https://aca.starcitytechnical.com/api/health bash scripts/operator-one-shot.sh`. Enter `2` or `docker` **only if a separately reviewed production Compose file exists**; it will prompt for that path. Enter `3` or `migration` to verify/apply SQL without deploying the app. Run `node --test scripts/tests/operator-one-shot-script.test.mjs` before a live release if desired; stop on failures, do not bypass backups or substitute bundled dev Compose. Follow `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`.

---

## 2026-10-19 — Owner single-command operator workflow committed (operator action needed)

- **Owner request:** "Provide me single shot command to done eveything" after requesting migration scripts committed for personal deployment. **Committed directly to main**, no branch/PR: `scripts/operator-one-shot.sh`, offline fail-closed Bash/Node tests `scripts/tests/operator-one-shot-script.test.mjs`, and `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`. OPS-01/owner still owns live execution; no production change by assistant.
- **Single command from clean checkout on main:** `git pull --ff-only origin main && bash scripts/operator-one-shot.sh`. Interactive target choice: `vercel`, `docker` (requires separate approved prod Compose; bundled compose is dev-only), or `migration` (no app deployment). Requires verified .env/DB, Node, Docker, production Vercel CLI linked if used. Fast-forward-only pull, operator Node tests + SQL chain, Docker web build, package typechecks/all tests, exact DB read-only plan, **external restorable backup + typed database confirmation**, forward-only apply, checksum verify, then selected deployment. Fails closed and never silently resets DB or bypasses Vercel rate limits.
- **Verification:** 20/20 current GitHub file/source safety assertions PASS (ordering, gating, no dev Compose, no reset, target checks); new exact Node Bash syntax/regression tests committed but **not run** here without full repo checkout/host. No Docker build, pnpm test, live DB migration, Vercel build or browser/provider E2E performed by assistant.
- **IMPORTANT:** Script itself does **not make a backup**: operator must complete and restore-test one beforehand and provide its reference. Previously leaked login cookie must be revoked. Provider's ElevenLabs `tts`/`stt` `provider_configuration_required` requires separate authorized configuration after deployment; schema migration alone cannot fix. Vercel `build-rate-limit` may still reject deployment. STOP on any failed stage. Phase 4 and production acceptance unchanged.
- **Runbook:** `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`. **Next:** OPS-01/human operator runs single command on reviewed target, captures test/build/plan/apply/verify/deploy evidence redacted of secrets, verifies deployed commit and connected providers/permissions/voice; DEV-01 handles only proven source regressions; FIX-01 runtime/security cases unchanged.

---

## 2026-10-19 — OPERATOR MIGRATION `plan` FALSE-POSITIVE FIX — USER ACTION REQUIRED (READ ONLY)

- **Owner evidence:** earlier operator Node suites 14/14 PASS and `docker compose ... build web` PASS on main `ae01b335`, but `bash scripts/operator-migrate.sh plan` aborted during static `verify-migration-chain.sh` with `duplicate canonical table object(s): aca` + normal table names. This is a static parsing error, **not** a database migration failure; SQL was not run by this error path.
- **Fixed on main, no branch/PR:** historical `CREATE TABLE IF NOT EXISTS` and `DO $$ ... EXCEPTION WHEN duplicate_object` enum reassertions are deliberately idempotent; prior grep collapsed qualified `aca.foo` to `aca` and rejected repeated safe declarations. New `scripts/check-migration-declarations.mjs` checks repeated **unguarded** table/enum declarations, respects comments/dollar bodies/schema names; `verify-migration-chain.sh` retains other checks. Added five regression tests to the same operator test suite; runbook and session updated. Existing SQL files/ledger untouched.
- **Evidence:** Exact GitHub-matching new static-checker blob `e1518eff9be87adb9dc7dba633ce02c50958d149` passed Node syntax and three isolated local fixtures; a representative whole-chain fixture passed idempotent DDL and failed duplicated bare `aca.unsafe_table`. Checked declarations across 70 GitHub migration files; no repeated unguarded names observed. **Not run here:** complete checkout tests/chain, live PostgreSQL plan or apply, migration verification/deploy. Owner earlier 14/14 and Docker build precede patch.
- **EXACT NEXT ACTION OPERATOR:** `git pull --ff-only origin main`; `node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs`; `bash scripts/verify-migration-chain.sh`; `bash scripts/operator-migrate.sh plan`. **STOP** on any failure. Read actual `DATABASE:`, `LEDGER:`, `PENDING:`; never infer DB name from `aca.` schema; if existing DB has no ledger do not use `--allow-fresh`. Only after verified target, restorable backup, checked pending SQL and matching current image, operator may separately apply with `--expect-db CONFIRMED_DATABASE_NAME --backup-confirmed`, then verify. Actual live DB/migrations/deploy remain OPS-01/operator; not attempted here.
- **Session:** `docs/project-control/sessions/OPERATOR-MIGRATION-DUPLICATE-STATIC-CHECK-FIX-20261019.md`; **runbook:** `docs/runbooks/OPERATOR-MIGRATION-20261019.md`.

---

## Owner-requested manual database migration scripts — 2026-10-19

- **Owner request:** Create and commit migration scripts into GitHub; owner/operator will deploy and migrate. Direct commits on `main`, **no branches/PRs**. Phase 4 remains implementation_in_progress.
- **Committed source:** `scripts/operator-migrate.sh` with `plan`, `apply` and `verify`; `packages/db/operator-migration-check.mjs` PostgreSQL target/ledger preflight; `packages/db/operator-migration-core.mjs` SHA256/checksum/unknown-version safeguards; offline Node/Bash regression tests and `docs/runbooks/OPERATOR-MIGRATION-20261019.md`. The manual wrapper reuses the existing `packages/db/migrate.js` for forward-only SQL, runs inside a one-off Compose web container and mounts `supabase` read-only; it does not reset DBs, deploy apps or copy provider keys.
- **Explicit deployment gates:** `apply` requires `--expect-db` and `--backup-confirmed`, and refuses a fresh database without an extra `--allow-fresh`. Verifier stops on SHA drift, unknown applied versions, wrong target, missing migration files or missing ledger. Operator wrapper treats migration warnings/skipped statements as non-acceptance even if original runner prints success. Root Compose file is marked local-development-only; operator selects reviewed production configuration/environment. **No migration or deployment executed in this chat.**
- **Evidence:** 17/17 deterministic assertions against the exact files committed to GitHub PASSED (source inspection). New Node/Bash regression suites **authored but not dynamically run**; no Docker, PostgreSQL, backup, full pnpm/typecheck/build/browser or live provider test. **Do not mark DB ready from a source commit.**
- **Exact operator action:**
  ```bash
  git checkout main && git pull --ff-only origin main
  docker compose --project-directory "$PWD" --env-file .env -f "${ACA_COMPOSE_FILE:-docker-compose.yml}" build web
  node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs
  bash scripts/operator-migrate.sh plan
  # Independently create and verify backup; use the exact DB name printed by plan:
  bash scripts/operator-migrate.sh apply --expect-db YOUR_CONFIRMED_DATABASE_NAME --backup-confirmed
  bash scripts/operator-migrate.sh verify --expect-db YOUR_CONFIRMED_DATABASE_NAME
  ```
  Deployment comes **after** verification. OPS-01 remains owner of host/migrations/CI/CD/deployment, FIX-01 runtime/security defects. Existing `0044_ai_provider_setup.sql` supports TTS/STT schema; **missing ElevenLabs purpose-specific API keys are not fixed by schema migrations**. After web deploy, an authorized admin explicitly configures TTS and STT or uses existing audited same-org Realtime key reuse in UI. Revoke previously exposed session cookie.
- **Session:** `docs/project-control/sessions/OPERATOR-MIGRATION-SCRIPT-20261019.md`. **Runbook:** `docs/runbooks/OPERATOR-MIGRATION-20261019.md`.

---

## DEV-01 — Fix missing ElevenLabs TTS/STT model catalog credentials — 2026-10-19

- **Reported:** Authenticated ElevenLabs TTS and STT live-model GET returned `409 provider_configuration_required`. This is an expected purpose-specific missing-key gate, not proof the ElevenLabs vendor catalogue is down. Realtime config does not implicitly activate TTS/STT. **Never use the session cookie pasted in the report; it must be revoked/replaced by the owner.**
- **Fix committed directly on main, no branches/PR:** Both TTS/STT selectors now understand the structured 409 and offer an explicit, user-confirmed **Use saved Realtime key for TTS/STT** action when the server reports an eligible enabled same-org ElevenLabs Realtime key. Otherwise guide admin to configure/enable both purpose keys; undecryptable key gets separate admin warning. Existing `organization.update` gate, encrypted same-org copy, audit and no-overwrite constraints preserved; GET never silently reuses secrets. Source: `apps/web/src/lib/ai/model-catalog-recovery.ts`, `apps/web/src/components/live-model-select.tsx`, `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`.
- **Evidence:** Exact committed helper Git blob `3108547c5ebe73975fee37198e71a69afc1b21c5`; isolated Node behavior **8/8 PASS**, isolated `tsc --noEmit` PASS, **15/15** current GitHub source invariants PASS. New full source+behavior Node suite authored but **not run** in complete checkout. Full pnpm tests/typechecks/build, migrations, live ElevenLabs API, browser and production/deploy remain **UNVERIFIED**.
- **Exact DEV-01 next:** From dependency-equipped current main run `node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-catalog-recovery.test.mjs`, `node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-save-validation.test.mjs`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts`, web/worker/db/Clara typechecks/builds, `bash scripts/verify-migration-chain.sh`. Fix proven source failures directly on main. OPS-01 verifies current deployed SHA and operator-driven key reuse after revoking exposed session, live model listings/audio, Vercel build-rate-limit and deployment. FIX-01 unchanged on voice/HTML/WhatsApp runtime incidents.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-TTS-STT-CATALOG-RECOVERY-20261019.md`. Phase 4 still implementation in progress, no production acceptance.

---

## DEV-01 — ElevenLabs Voice Chat TTS/STT pre-save guard — 2026-10-19

- **Owner request:** Continue the ElevenLabs purpose-credential/missing live-model catalog issue on existing `main`; Phase 4 remains implementation_in_progress. Previous opt-in same-org encrypted Realtime→TTS/STT reuse flow is **already present**; preserved.
- **New source:** Voice Chat Save preflights both TTS and STT saved key presence before first PUT when no new key entered, preventing the predictable missing-STT partial commit. Whitespace-only key is treated as absent. Provider PUT now rejects `keepExistingKey: true` unless a real saved key exists for that exact authorized org/provider/purpose; does not create an enabled keyless config. Voice Chat refresh preserves Realtime *metadata* (Save/Remove still mutate TTS/STT only), keeping explicit credential-reuse discovery visible.
- **Evidence:** Exact helper SHA `5ff3d09e82186e0161807ade6d995bf54b9a1bd1`, 8/8 **executed** isolated Node behavioral tests PASS, same isolated TypeScript noEmit PASS, and 10/10 **static** fresh GitHub source assertions PASS. New 10-test source+runtime regression suite committed but **not executed in whole repository**. Full pnpm web/worker/db/Clara checks, migration chain, browser/vendor/production calls and deployment **not verified**. No branches/PRs/deployment.
- **Exact next action:** In dependency-equipped current-main checkout run `node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-save-validation.test.mjs`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts`, full web/worker/db/Clara tests+typechecks/build, `bash scripts/verify-migration-chain.sh`. Fix proven DEV-01 UI failures on main. OPS-01 deploys approved SHA and uses a fresh authenticated org session to confirm separate ElevenLabs TTS+STT keys, explicit reuse if wanted, live catalog requests/model selection/save/reload, then microphone/STT/TTS. FIX-01 retains voice/HTML/WhatsApp source defects. The previous user-exposed session cookie must be revoked, never reused in tests or tickets.
- **Known limitation:** preflight avoids predictable missing-secret half-save, not two-request SQL atomicity; network failure between PUTs can still commit one purpose. Follow up with purpose-atomic save endpoint only if warranted by tests.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019.md`. Current C1 catch-up continuation and other agents' records below remain valid; don't overwrite concurrent project scope.


---

## DEV-01 — C1 implementation checkpoint — 2026-10-19

Private catch-up storage/access implemented; flag remains off. PostgreSQL 17/17 and focused web 8/8 pass; package typechecks pass and web build passed before the final evidence-read correction. Full worker/web suites still fail outside changed C1 areas; FIX-01 and OPS-01 handoffs are recorded. No deployment/push/provider use. See [C1 session](sessions/DEV01-CATCHUP-C1-20261018.md). **Exact next action:** C2 failing selection/coverage tests, then immutable manifests and explicit review progress. Existing phase remains implementation_in_progress; earlier active/planning entries are historical.

---

## DEV-01 — C1 private catch-up foundation underway — 2026-10-18

Owner continued the reviewed plan; C1 storage/access implementation is now authorized and active. Current upstream ad8fc701 was integrated with concurrent source/records preserved. Existing Clara baseline now passes 26/26. OPS-01 prepared an isolated local PostgreSQL test target; DEV-01 is implementing private grants/scope/activity/storage/API with the feature off by default. No external rollout or messaging. Follow [session DEV01-CATCHUP-C1-20261018](sessions/DEV01-CATCHUP-C1-20261018.md) for exact implementation/test/review results. Next: complete C1 behavioral and SQL/RLS verification, independent review, then record the next slice. Earlier planning-only and failed-test entries below are historical, not current authority or evidence.

---

## DEV-01 — Catch-up / Routines: exact continuation — 2026-10-18

**Latest owner priority:** Plan useful personal email catch-up and assistant-managed schedules/automations with optional scoped WhatsApp digests. Plans are now concrete; no feature implementation/activation or phase transition occurred in this slice.

1. Read [session DEV01-CATCHUP-ROUTINES-20261018](sessions/DEV01-CATCHUP-ROUTINES-20261018.md), [design](../superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md), [Catch-up plan](../superpowers/plans/2026-10-18-personal-mail-catch-up.md) and [Routines plan](../superpowers/plans/2026-10-18-assistant-routines-and-digests.md). Review personal access grants, separate routine coverage, template-bound consent, all-source revalidation and submission/revocation semantics. Owner already selected once-per-exact-scope consent; do not ask that preference again.
2. After owner/architect approval of the proposed design/implementation scope, begin **Catch-up C1**: failing cross-user/org/agent/account tests, private summary/grant schema, trusted scope resolver and off-by-default configuration. Recheck current main and available migration numbers first. Use existing checkout/main; no new branch/worktree/PR. Pure contracts/time calculations and the C4a test harness can proceed while separate dependencies are resolved.
3. FIX-01 receives `HOF-DEV01-FIX01-SCHEDULER-RELIABILITY-20261018` and `HOF-DEV01-FIX01-AUTOMATION-TENANCY-20261018`; new routine execution/event activation stays blocked on affected correctness/tenant proof. OPS-01 receives `HOF-DEV01-OPS01-DIGEST-VALIDATION-20261018` for isolated DB/browser/provider prerequisites, not an instruction to deploy now. Preserve ISS-026/#36/#26/ISS-037 ownership.
4. Preserve concurrent **native streaming tool-call/final answers** source integrated from main `959ff5a6`; it is no longer wholly unimplemented. Final local typechecks/web build pass; focused runs total **91 passed, 1 failed**. FIX-01 receives `HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018` for duplicate completed IDs and result-name mismatch in the final-prompt builder. Do not weaken the failing test. SQL/browser/provider/full-suite checks remain unexecuted. Earlier 41/41 belongs only to ba9e948b. Do not repeat obsolete toolchain recovery or claim delivery/tenant acceptance.

Record each future slice's actual tests, blockers, commit and exact next action. Do not repeatedly wait on CI/Vercel/review when unrelated authorized product work exists. Current general WhatsApp per-message approval remains unchanged until a separately reviewed narrow digest-grant implementation passes its gates.

## DEV-01 — Explicit UTC calendar-date mail reports — 2026-10-19

- **Authorization:** User asked to continue beyond FIX-01's completed source correction for rolling 24-hour unread mail. DEV-01 independently implemented **explicit two-ISO-date** Chat mail reporting, direct `main`, no branch/PR, Phase 4 still implementation_in_progress. Did not touch FIX-01 incidents or OPS-01 deployment.
- **Product source:** `apps/web/src/lib/mail/explicit-date-range.ts` safely parses UTC `YYYY-MM-DD to YYYY-MM-DD` / `between ... and ...` intervals (1–366 days) with unread, explicit sender **email**, subject/topic; unsupported/ambiguous date/filter inputs fail **422**, not silently broad. `/api/chat/stream` reuses the 24h route's actor email.read, enabled agent email search/list, organization+account binding, draft/sent exclusion, unread, filtered COUNT and 500-message safety limit. Exclusive next-midnight boundary correctly includes every timestamp on final date, while existing rolling 24h SQL logic stays unchanged. Formatting identifies locally-synced bounded data and source; **not** live-sync or semantic AI.
- **Actually executed evidence:** Exact Git SHA-matched Node parser/report fixtures: **16/16 PASS** (new 8 + old FIX-01 rolling 8); isolated TS `tsc --noEmit` both modules **PASS**; current GitHub source/assertion review **19/19 PASS**. Vitest `chat-explicit-date-range.test.ts` added and old `chat-rolling-mail-summary.test.ts` aligned; neither Vitest nor whole app/backend build, live PostgreSQL, browser or provider sync executed. No deployment.
- **Exact DEV-01 next action:** `node --experimental-strip-types --test apps/web/tests/explicit-date-range-mail.test.mjs apps/web/tests/rolling-mail-summary.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-explicit-date-range.test.ts tests/chat-rolling-mail-summary.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`; worker/Clara/DB tests/typechecks and `bash scripts/verify-migration-chain.sh` (full command list in session). Database seed: 37+ rows, read-only grants, 2 tenants, boundary `23:59:59.999500Z`, 500 cap and invalid sender/filters. Then decide on genuine evidence-based semantic grouping with message citations and bounded coverage. OPS-01 owns real sync/CI/Vercel/deploy. FIX-01 owns existing 24h bug and HTML security #36.
- **Security:** Previously exposed server password and browser session must be **rotated/revoked by owner/OPS**; neither was used. No token/password transmitted to repo or logs. Session: `docs/project-control/sessions/DEV01-EXPLICIT-DATE-MAIL-20261019.md`.

---

## FIX-01 — All unread mail last 24h: incorrect agent summary — 2026-10-19

- **User evidence:** Chat agent invented/selected older unrelated email details and subsequently claimed there were no unread messages during the actual rolling window. Source root cause: general `loadEmailContext` supplies at most **20** draft-prioritized records from **7 days** without `is_read=false`; old assistant history can contaminate search terms. User explicitly requires all matching 24h mail, even >30, and only relevant records for specified sender/topic filters.
- **FIX-01 source committed directly on main:** Added conservative, typo-aware rolling summary intent + deterministic per-message report at `apps/web/src/lib/mail/rolling-summary.ts`, count and bounded scope at `/api/chat/stream`. Requires actor `email.read` **and enabled registered agent email list/search tool**, matches organization, agent, readable mailbox bindings, exact last 24h UTC, excludes sent/draft, filters unread if asked, applies supported sender/topic filters. Lists all matching rows up to 500 with matched/included counts; >500 loudly marked partial; local-sync freshness explicitly qualified. Scoped path runs before old history/LLM; old email context is now permission-gated. No production provider data/credentials accessed.
- **ACTUAL executable evidence:** isolated exact-source Node regression **8/8 PASS** (first 7/8 caught sender address truncation; fixed and reran); standalone TypeScript **PASS**; **15/15** current-GitHub-source structural checks PASS. New Vitest route/auth/SQL suite authored, not run. Full pnpm web/DB/worker/Clara typecheck/build, migrations, real browser and provider DB **NOT run**. Session `docs/project-control/sessions/FIX01-ROLLING-MAIL-20261019.md`.
- **EXACT NEXT ACTION FIX-01:** On current main in dependency-equipped checkout: `node --experimental-strip-types --test apps/web/tests/rolling-mail-summary.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-rolling-mail-summary.test.ts tests/chat-memory-regression.test.ts tests/chat-host-tool-loop.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`. Test PostgreSQL seeded 37+ messages with times, read flags, agent send_only, unsupported permissions, across two organizations; verify output count/coverage and actual UI. Fix failed FIX-01 source tests only.
- **OPS-01:** run permitted CI, DB/runtime deployment, synced-provider verification, secure Vercel/host diagnostics. **Security:** user's pasted material exposed server login and session secrets; tell user to rotate/revoke; never copy into repo/logs or use for remote access.
- **Still pending:** full semantic per-email AI summaries, arbitrary-time/complex subject filters, all-page results >500, actual connected mailbox sync. Do not claim production acceptance.


---

## DEV-01 — ElevenLabs Voice Chat TTS/STT catalog key mismatch — 2026-10-19

- **User evidence:** Authenticated production `GET /api/settings/ai-models?provider=elevenlabs&purpose=tts` and `purpose=stt` returned `provider_configuration_required`. This failure is from the organization's **per-purpose credential guard** *before* any ElevenLabs API request. **Do not repeat the user's pasted session token or use it for tests**; advise user to revoke the exposed session. Production DB not queried, so whether a Realtime key is actually saved is unverified.
- **DEV-01 source committed directly to main (no branch/PR):** Added an explicitly user-confirmed **Use saved Realtime key for missing TTS/STT** action on AI Provider Setup → Voice Chat → ElevenLabs. The POST API requires `organization.update` then validates source `elevenlabs:realtime` is enabled and decryptable within that same org. One atomic DB `INSERT ... SELECT ... ON CONFLICT` duplicates only the encrypted envelope for missing **enabled** TTS/STT slots; it cannot overwrite existing keys/models or re-enable disabled rows. Results return only capability flags/purpose names, never secrets; audit recorded. UI displays per-purpose readiness and refetches catalogs. `/api/settings/ai-models` now differentiates missing, disabled, saved-but-undecryptable, and eligible Realtime reuse with actionable messages; no automatic credential fallback. Fixed `getDecryptedProviderConfig` row mapping to flag encrypted bytes truthfully.
- **Executed evidence:** 29/29 **GitHub exact-source contract assertions** PASS for authorization, same-org/source, opt-in, no secret output, SQL no overwrite/disabled target, diagnostic codes, UI refresh, and regression-suite presence. New `apps/web/tests/elevenlabs-voice-credential-reuse.test.ts` authored, **not run**. Entire web/worker/Clara/db pnpm tests/typechecks/build, database migration, real provider/browser tests **not run** due no private repo checkout/pnpm/browser auth in this environment. Current Vercel combined status still `failure` with `build-rate-limit` link; OPS-01 owns remediation/deployment.
- **NEXT DEV-01 acceptance action:** On current `main` with dependencies: `pnpm install --frozen-lockfile`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts`; `node --test apps/web/tests/ai-provider-setup-safety.test.mjs`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`; `pnpm --filter @ai-comms-agent/worker test`; `pnpm --filter @ai-comms-agent/worker typecheck`; `pnpm --filter @ai-comms-agent/worker build`; `pnpm --filter @ai-comms-agent/clara-core test`; `pnpm --filter @ai-comms-agent/clara-core typecheck`; `pnpm --filter @ai-comms-agent/db typecheck`; `bash scripts/verify-migration-chain.sh`. Fix DEV-01 code failures directly on main.
- **OPS-01 after permitted deployment:** Verify code SHA, live authenticated org A/B provider settings, explicit reuse + separate TTS/STT model choice and save/reload, fresh TTS/STT 200 catalogue responses or truthful live vendor errors, invalid/disabled source, non-overwrite of existing keys, cross-tenant 403, no credentials in responses; then real voice/session/browser and CI/build/migration checks. FIX-01 owns unrelated transport bugs and HTML sanitizer #36.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019.md`.


---

## DEV-01 — Native final provider SSE after authorized read tools — 2026-10-18

- **Current source directly on `main` (no branch/PR):** Added bounded host-tool result prompt `packages/clara-core/src/tool-result-final.ts`; `claraRuntime.streamAuthorizedReadOnlyToolAnswer` now streams a *new actual final model answer directly from the completed authorized read results*, not a second request to echo a previously completed answer. Chat and Voice callback into this stream only after a complete, registered, audited, success-only **first batch of 1–4 read-only** email/WhatsApp tools with no pending approvals or denied calls. Legacy voice JSON and non-read / approval / denied / complex multi-round paths remain on existing conservative flow. Existing exact-copy method remains unused by both app endpoints pending cleanup.
- **Security correction:** Native final model call has **no tool/function definitions or mutation access**; tool data remain explicitly untrusted. A source-level test run detected reused completed tool-call IDs; corrected with lifetime `seen` set. Another safety guard stops broad `/unsupported/i` fallback after tool execution: fallback only if tool-model selection is unsupported *before* any tool executes. Direct final model text still requires real provider/hallucination/approval wording acceptance; no production claims.
- **Actually executed:** SHA-exact committed Node `packages/clara-core/tests/tool-result-final.test.mjs` **7/7 PASS** after correcting initial failed edge case; isolated `tsc --noEmit --strict --noUncheckedIndexedAccess` on the SHA-exact builder **PASS** (minimal type-only stub). Authenticated GitHub source-contract audit of native delivery and authorization guards **18/18 PASS** before final cap and fallback hardening. Newly updated web Vitest/worker tests **NOT executed**; full pnpm/worker/web/Clara/DB typechecks/builds, provider/browser and production **NOT run**: no full private checkout or pnpm and shell cannot resolve GitHub. Manual-only CI/OPS-01 boundary unchanged.
- **EXACT NEXT ACTION DEV-01:** On a full latest-`main` checkout, `pnpm install --no-frozen-lockfile`, `pnpm --filter @ai-comms-agent/clara-core test`, `pnpm --filter @ai-comms-agent/clara-core typecheck`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/mail-threads-workspace.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/db typecheck`, `bash scripts/verify-migration-chain.sh`. Fix evidenced source failures on `main`. Then authenticated org/agent-bound email/WhatsApp read results, approval/denials, model hallucinations, 2+ read hops, mid-turn abort, actual provider first-token latency and Voice TTS QA. FIX-01 retains #26/#36 and WhatsApp runtime; OPS-01 retains CI/CD/migrations/host secrets/deployment.
- **DEV-01 session:** `docs/project-control/sessions/DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018.md`. Phase 4 remains `implementation_in_progress`.

---

## DEV-01 — Native OpenAI/Gemini streamed tool-call decisions — 2026-10-18

- **Source committed directly to `main`, no branch/PR.** OpenAI Chat Completions `stream:true` and Gemini `streamGenerateContent?alt=sse` now assemble full validated tool-call decisions before the unchanged host tool executor can authorize/invoke anything. Malformed/truncated/oversized/incomplete calls fail closed. Compatible JSON vendor gateways retain the old path. Sarvam native tools remain disabled pending vendor contract.
- **Actually executed:** On byte-for-byte Git SHA-matched committed pure parser sources/tests: OpenAI Node **10/10 PASS**, Gemini Node **9/9 PASS**, combined **19/19 PASS**. Isolated **strict TypeScript + noUncheckedIndexedAccess PASS** using a minimal type-only stub. New mocked worker provider-adapter tests authored but **not executed**; all full pnpm/workspace/browser/provider/production checks pending.
- **Next DEV-01 action:** On latest main with dependencies run `pnpm --filter @ai-comms-agent/clara-core test`, `pnpm --filter @ai-comms-agent/clara-core typecheck`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, focused web Vitest `tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/mail-threads-workspace.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/db typecheck`, `bash scripts/verify-migration-chain.sh`. Fix evidenced DEV-01 source failures directly on main. After acceptance, stream provider's final answer after authorized tool results directly instead of the optional extra exact-copy model pass, and test disconnect/approval/tenant behavior with real provider/browser.
- **Blocking dependencies:** No complete private repo checkout, `pnpm` or authenticated browser session in this environment; GitHub DNS from shell unavailable. No live mailbox/API calls, no deployment. FIX-01 retains HTML ingest security #36, runtime voice bugs; OPS-01 CI/CD, migrations, hosting/credentials and deployment. Phase 4 remains in progress.
- **Session and precise evidence:** `docs/project-control/sessions/DEV01-NATIVE-TOOL-SSE-20261018.md`.

---

## DEV-01 — Follow-up: abort and approval-safe post-tool streaming — 2026-10-18

- **Source committed on main, no branch/PR:** `claraRuntime.streamCanonicalToolAnswer` now accepts request abort and routes it through native OpenAI/Sarvam/Gemini `fetch`; Chat and Voice pass their actual client `request.signal`. The Chat host loop and shared email agent loop now refuse `readOnly` eligibility for `status:pending_approval` or `approval_required:true` even from a host-registered read tool. Added focused worker approval-shape regression plus web Vitest source-contract cases.
- **Executed:** Reproduced source/test exact committed Git hashes for pure verification helper, `node --experimental-strip-types --test` **8/8 PASS**, standalone TypeScript **PASS**, 12/12 authenticated GitHub abort/approval source assertions **PASS**. **Not executed:** newly added web Vitest and worker tests, whole web/DB/worker typecheck/build, live provider/browser/migrations/deploy. No production acceptance.
- **Exact next DEV-01 action:** On dependency-equipped current `main`: `pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/mail-threads-workspace.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`; `pnpm --filter @ai-comms-agent/worker test`; `pnpm --filter @ai-comms-agent/worker typecheck`; `pnpm --filter @ai-comms-agent/db typecheck`; `bash scripts/verify-migration-chain.sh`. Fix DEV-01 source failures directly on main; independently implement native provider SSE tool-call assembly behind same auth/approval boundaries after executable test proof. Then verify actual browser/provider Chat+Voice cancellation and approval. FIX-01 issue #36 and realtime transport defects remain with FIX-01, and CI/deploy/provider credentials remain OPS-01.
- **Session:** `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`.

--- 

- **Follow-up interruption cleanup:** `packages/clara-core/src/runtime.ts` now cancels the upstream OpenAI/Sarvam-compatible and Gemini reader in both model SSE generator finalizers when the host consumer returns early, instead of merely releasing its lock. Added source assertion in `apps/web/tests/verified-tool-streaming-contract.test.ts`. This was committed to `main` but is **not** yet provider/browser E2E tested.

## DEV-01 — Verified final model-token streaming after host-authorized read-only tools — 2026-10-18

- **Work completed on current main only; no branches/PRs.** Added genuine provider-generated token delivery after the established bounded Chat/Voice email/WhatsApp tool loops, **only** for safe, successful, read-only, approval-free operations. Host registry permissions (`email.read`/`whatsapp.read`), tool sensitivity, org/agent binding and successful invocation are checked before streaming; no action is executed by the extra model call. Provider chunks are released only if they extend the *canonical, completed tool answer* exactly, with truthful one-chunk fallback on drift/error and abort suppression. Write, denial, pending-approval and untrusted operations stay canonical/non-streamed. Existing legacy Voice JSON kept.
- **Important limitation:** This is an optional *extra read-only provider streaming pass* to reproduce the final answer after tools have already completed; NOT provider-native streaming function-call planning, NOT lower-latency tool execution, and not sentence-level spoken TTS. It may fall back and adds provider cost. Next DEV-01 task: native OpenAI/Gemini function-call SSE adapters with complete validated tool arguments, host approval execution and direct native final-answer streaming, then retire extra copy pass when tested.
- **Executed evidence:** Exact source/test committed Git blobs `ab488dfa888066bf86399cae7227ba3c996d24df` / `33fae517247b47c5776796d4db83cfb5bb87965f`, Node v22.16 `node --experimental-strip-types --test` **8/8 PASS**; standalone `tsc --noEmit` on pure safety helper **PASS**; authenticated current-GitHub source-contract checks **16/16 PASS**. Authored Vitest contracts and added worker assert, **not executed**. No full pnpm/Next/worker/DB build, live mailbox/provider browser/voice or deployed acceptance.
- **EXACT NEXT_ACTION for DEV-01:** On dependency-equipped current main run `node --experimental-strip-types --test apps/web/tests/verified-tool-answer.test.mjs`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/workspace-shell.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/db typecheck`, `bash scripts/verify-migration-chain.sh`. Fix evidenced DEV-01 regressions on main; browser validate account/mailbox denied/approval, streamed first token, provider drift, abort, Gemini/OpenAI, cross-org/agent and TTS. OPS-01 owns current-head CI/deploy/credentials; FIX-01 retains voice transport #26 and mail HTML ingest #36.
- **Complete session:** `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`. Phase 4 implementation ongoing, no production acceptance.

---

## DEV-01 — Real Mail Threads + Chat/Voice model-token streaming — 2026-10-18

- **Owner authorized continued DEV-01 product work, direct `main` only; no branch/PR.** Implemented real tenant-scoped Mail Threads repository/API/UI (search, per-mailbox, unread, safe pagination/abort, opening a thread), plus responsive Chat focus return after embedded voice.
- **Streaming changes:** shared incremental browser SSE parser; Chat updates text for each model delta and sends status/done/errors; Chat now starts regular conversational model streaming without the blocking tool-loop preflight. Voice `/api/voice/turn` now opt-in streams actual Clara model tokens for non-tool conversations under existing session authorization, while preserving legacy JSON clients and the host-authorized email tool path. Gemini uses native `:streamGenerateContent?alt=sse`, OpenAI/Sarvam SSE reader handles EOF-split final events. Voice text renders partial deltas and retains partial transcript on failure. No fakely animated completed response.
- **IMPORTANT NOT COMPLETE:** Tool-backed mail/WhatsApp final responses are still buffered until approved tool loop completes (but user sees early progress). Realtime TTS begins after final answer. Implement safe provider-native streaming function/tool completion as next DEV-01 AI task; do not bypass approval or show speculative tool claims. FIX-01 retains HTML sanitizer GitHub #36 and realtime transport defects. OPS-01 owns CI/deployment/migrations/secrets.
- **Executed:** Exact GitHub SHA-matched standalone `sse.ts` and `sse-streaming.test.mjs` Node test **5/5 PASS**; same SSE module standalone `tsc --noEmit` **PASS**; 23/23 fresh GitHub source-contract invariants **PASS**. New Mail Threads and streaming Vitest suites **not run**. Full pnpm web/worker/DB typechecks/build, migrations, browser, provider calls and deployed version **not verified**.
- **EXACT NEXT ACTION:** In dependency-equipped checkout of *current main*: `node --experimental-strip-types --test apps/web/tests/sse-streaming.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/mail-threads-workspace.test.ts tests/streaming-conversations.test.ts tests/workspace-shell.test.ts tests/mail-html-preview.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`; `pnpm --filter @ai-comms-agent/db typecheck`; `pnpm --filter @ai-comms-agent/worker test`; `pnpm --filter @ai-comms-agent/worker typecheck`; `bash scripts/verify-migration-chain.sh`. Fix DEV-01 regressions directly on main. Then authenticated 320/390/768/1440px browser + real mail/voice/WebSocket SSE latency and cross-org denial. OPS-01 separately verifies/deploys and resolves host limits. 
- **Session:** `docs/project-control/sessions/DEV01-MAIL-THREADS-STREAMING-20261018.md`; Phase 4 still `implementation_in_progress`.


---

## DEV-01 — Chat-first workspace and embedded voice UX — 2026-10-18

- **Owner authorization:** Explicit DEV-01/Forge UX redesign; direct edits on `main`, no branches/PRs. Phase 4 remains `implementation_in_progress`.
- **Source completed:** `/` now opens authenticated Chat; former Overview moved to `/overview`; Chat first in sidebar; Mail expanded by default with Inbox/Drafts/Threads/Accounts; standalone AI & Voice menu removed while `/ai-voice` deep link remains. TopBar no longer adds second desktop sidebar offset (independent concurrent source fix already on main). Chat lazy-loads existing Clara VoiceWorkspace inside chat via Live voice actions, preserves unsent draft/selected agent, and handles session exit/transport cleanup. Mail thread query aliases `html_body_sanitized AS html_body`, exposing HTML to an opaque CSP-restricted reader with Text fallback and expand control. User-owned `Rilan-Dev/mailflow` consulted for preview architecture; no wholesale sanitization copied.
- **SECURITY ROUTING:** FIX-01 GitHub [#36](https://github.com/Rilan-Dev/ai-comms-agent/issues/36) for unsanitized `message.html_body` stored in `html_body_sanitized`; also handle legacy DB rows. CSP iframe is defense-in-depth, **not** proof of sanitized storage. FIX-01 retains other realtime provider bugs. OPS-01 owns CI/deployment/migrations/credentials.
- **Evidence:** 14/14 live GitHub source-contract invariants checked; authored new `apps/web/tests/workspace-shell.test.ts`. **NOT RUN:** actual Vitest/React, full TypeScript/Next/worker build, migration, browser, real voice/mail provider, deployment. User-linked CI run 39079140157 failed on earlier SHA `2cf9a522` and not current main; logs unavailable. No waiting/polling.
- **Exact next action DEV-01:** In dependency-equipped `main` checkout, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/workspace-shell.test.ts tests/mail-html-preview.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `bash scripts/verify-migration-chain.sh`. Fix actual UI failures directly on main. Browser-test 320/390/768/1440px, chat and legacy routes, mail expansion, no header gap, unsent draft, voice reconnect/teardown, rendered HTML/Text with tracking-blocked CSP, cross-tenant denials. Independent next DEV-01 slice: make `/mail/threads` an actual tenant-scoped list; currently placeholder. Do not claim phase/production acceptance.
- **Full plan:** `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`; **session:** `docs/project-control/sessions/DEV01-CHAT-FIRST-VOICE-MAIL-20261018.md`.


---

## DEV-01 — Chat-first navigation, embedded voice and Mail reader UX — 2026-10-18

- **Owner-authorized next development slice committed to main:** Chat is the root landing workspace; Overview preserved at `/overview`; Chat first sidebar menu; Mail expanded by default to Inbox/Drafts/Threads/Accounts; single 248px layout offset fixes navbar gap. Voice workspace lazy-mounted inside Chat via action button with Chat header's voice-to-text toggle guarded to prevent bypass of session teardown. Mail thread now has formatted HTML iframe with strict opaque sandbox/CSP, privacy notice and expanded viewing control, plus persisted HTML field mapping. No branches/PRs created.
- **Source checks:** 13/13 actual GitHub source contract checks PASS for home/nav/voice/HTML isolation/test existence. New `apps/web/tests/chat-first-workspace.test.ts` and `apps/web/tests/mail-html-preview.test.ts` written but **not run**; full pnpm web/worker typecheck/build, browser, auth, provider, CI or deployment **not verified**.
- **Design/real-world failure matrix:** `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md`; session docs/project-control/sessions/DEV01-CHAT-FIRST-WORKSPACE-20261018.md.
- **EXACT DEV-01 NEXT ACTION (on equipped current main):** `pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-first-workspace.test.ts tests/mail-html-preview.test.ts tests/live-model-catalog.test.ts tests/voice-provider-relay.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; `pnpm --filter @ai-comms-agent/web build`. Then test 320px/mobile/desktop nav focus, Chat text stream retention, voice start/mic denied/end/back with real transport, thread HTML vs plain text and malformed/tracking HTML. Fix only DEV-01-owned UI issues and continue polish.
- **ROLE ROUTE:** FIX-01 issue [#36](https://github.com/Rilan-Dev/ai-comms-agent/issues/36) must sanitize untrusted provider HTML before storage (including old rows); FIX-01 #26 must verify voice session teardown errors. Neither fixed by UI alone. OPS-01 owns full CI, database migrations, deploying matching source SHA and live provider validation. User-linked [Actions run 39079140157](https://github.com/Rilan-Dev/ai-comms-agent/actions/runs/39079140157) is a failure on **older** head `2cf9a522`, not evidence against this new UI commit. No production acceptance.
- **Phase:** Phase 4 still `implementation_in_progress`. Do not wait/poll CI; continue independent DEV-01 UI work.

---

## OPS-01 — Verify containerized migration correction (ISS-037) — 2026-10-18

- **Implementation:** Committed `scripts/manual-up.sh` change to run migrations via one-off Compose `web` container with `$PROJECT_ROOT/supabase` mounted read-only at `/workspace/supabase`. Application DB URLs remain on Docker internal DNS. Existing startup-on-migration-failure behavior is unchanged.
- **Commits:** source `65a215151ecd14900fac3c9ba9a421fb7a777a77`; regression test `6cd93638bffa0e2f6a9e8d6ce2f3f2664b13341b`.
- **Focused evidence:** Bash syntax check passed; isolated Node test 4/4 passed using fetched script/test and a fixture matching current Compose `.env` declarations. Actual checkout test and runtime deployment remain pending.
- **Required next action:** Before applying migrations, confirm intended DB target: user's configured URL ends in `/postgres`, while local Compose declares `POSTGRES_DB=aca`. Do not change this by assumption.
- **Then:** Pull latest `main`; run `node --test scripts/tests/manual-up-compose-env.test.mjs` in the actual checkout; run `bash scripts/update-and-up.sh`; capture sanitized migration output and `docker compose ps`/health separately.
- **Do not:** Route application DB connections through `host.docker.internal:5433`; claim migration or deployment PASS from source tests alone.
- **Related:** ISS-037; BKL-OPS01-MIGRATION-IN-CONTAINER-20261018; `HOF-FIX01-OPS01-MIGRATION-NETWORK-20261018`.


---

## DEV-01 — Verification rerun on current main; full CI still blocked — 2026-10-18

- **Owner's request:** Proceed with selected pending focused model catalogue tests, TypeScript/web verification, authenticated provider save/reload validation. Work remains on existing `main` with no new branch/PR.
- **HEAD inspected:** `03f5d30344a0992f876416b59f0d8e72ab102706`. Screenshot-specific Sarvam/ElevenLabs realtime changes were **already committed to main**, contrary to older draft PR status text; **no production deployment confirmation**.
- **Executed in this turn:** Node v22.16.0 `node --experimental-strip-types --test` over exact-source local copies of `apps/web/tests/live-model-catalog-standalone.test.mjs` (9), runtime normalization (4), provider status (5) and Clara vector read (5) → **23/23 PASS**, 0 failed. Global TypeScript 5.8.3 `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022 --skipLibCheck` on exact standalone catalog, provider-status and runtime-settings modules **PASS (exit 0)**. Git object hashes confirm currently committed exact catalogue source `70bdd8ca7483fb8f1e4d866cffff350242969aae` and source-matched test `000a8062eead4646203ca46f8c18d7114c605189`. These are isolated module tests, NOT complete app verification.
- **Full verification BLOCKED:** Container has Node 22/tsc but **no pnpm, no complete private repo checkout**; direct git remote resolution fails (`Could not resolve host: github.com`). Only partial previously cached test modules available. Browser connector cannot access the user session (`requires the originating browser context`); public HTTP fetch disabled; no per-organization stored vendor credentials available for authorized live integration. Full web/worker Vitest, TypeScript, Next build, Docker, migrations, real Sarvam/ElevenLabs/Gmail/Clara/Qdrant, browser cross-org negative tests and production acceptance **NOT RUN**.
- **CI:** `.github/workflows/ci.yml` is intentionally `workflow_dispatch` only. No new manual run on this head. The newest listed `main` Actions records are Oct 9 and earlier, their SHAs **not** this head; old failed Oct 7 job log artifact is no longer available. No workflow-dispatch action exposed by connected GitHub tool. Current GitHub Vercel combined status (previous check) had `failure` linking to `build-rate-limit`; OPS-01 owns this deployment blocker.
- **NEXT ACTION (manual operator with GitHub Actions permission):** Run [CI on main](https://github.com/Rilan-Dev/ai-comms-agent/actions/workflows/ci.yml) via `Run workflow` (reason `DEV-01 verify Sarvam/ElevenLabs model catalog and full web/worker`), then review test/typecheck/build/migration checks from **this** head. Or use an authorized dependency-equipped checkout: `pnpm install --no-frozen-lockfile && pnpm run verify && pnpm --filter @ai-comms-agent/worker test && bash scripts/verify-migration-chain.sh`. Follow with authenticated nonproduction org A/org B model select/save/reload, role denial, provider model HTTP + voice WebSocket, STT and TTS, ensuring secrets remain server-side. Fix any evidenced failures directly on main before OPS-01 deploys, then verify the browser screenshots against the actual deployed SHA.
- **SECURITY/ROLLOUT GATES:** Do not expose credentials, bypass tenant checks or policy approvals, turn on RAG vectors, change CI to auto-run, deploy, or mark accepted without actual provider/host verification. FIX-01 retains voice/WhatsApp source incidents; OPS-01 retains CI host/secrets/deployment. Feature is committed on main but **live acceptance remains pending**.

---

## DEV-01 — Annotated Sarvam + ElevenLabs realtime model dropdown correction — 2026-10-18

- **User screenshots:** `/settings/ai-provider-setup` realtime tab showed `catalog_unsupported` for Sarvam saved `saaras:v3-realtime` and ElevenLabs saved legacy `elevenlabs-conversational` even though enabled keys were present.
- **Source fix directly on main, no branches/PRs:** The realtime route now shows a `source: documented` streaming-STT catalogue **only after** authenticating organization, permission and saved enabled per-purpose key. Sarvam documented realtime WebSocket models: `saaras:v3-realtime` and `saaras:v4`; ElevenLabs current Scribe relay model: `scribe_v2_realtime`. Other purposes remain vendor-live or explicit unsupported. UI distinguishes documented from live and explains streaming STT+host agent/TTS vs ElevenLabs Conversational AI agents (separate integration). Provider-config PUT refuses incompatible legacy realtime markers. Saved per-provider model now reaches voice-session resolution and Sarvam authenticated relay bootstrap, with allowlisted transport IDs. **No automatic migration of existing saved values.**
- **Executed actual isolated evidence:** Updated source and Node test byte-for-byte equal to GitHub blobs `70bdd8ca7483fb8f1e4d866cffff350242969aae` / `000a8062eead4646203ca46f8c18d7114c605189`; targeted Node 9/9; combined standalone Node **23/23 PASS** (catalog 9, runtime-form 4, provider-status 5, vector read 5); standalone TypeScript of exact catalog module PASS; 13/13 GitHub source/endpoint/relay/test contracts PASS. New Vitest/voice-relay source added, **not executed**. Session `docs/project-control/sessions/DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018.md`.
- **Next verification gate:** From equipped **current main**, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/voice-provider-relay.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, worker tests/typecheck/build, `bash scripts/verify-migration-chain.sh`. Confirm committed supported options in browser: Sarvam saved v3 remains selected; choose v4/save/reload + actual relay; ElevenLabs legacy label prompts manual switch to `scribe_v2_realtime` then save/reload; wrong-org/disabled-key rejection, microphone/STT/TTS/host-tools integration. Only OPS-01 performs allowed deployment and live provider credentials checks; CI remains manually triggered and GitHub connector cannot dispatch it; Vercel build-rate-limit unresolved. Separate ElevenAgents native conversational integration would require an agent selector + signed URL transport, not a fake realtime model ID.
- **Still pending:** Whole web/worker builds and migration execution, live Sarvam/ElevenLabs WebSocket, Clara/Qdrant sync and ISS-026 runtime isolation, full E2E, production acceptance. Maintain FIX-01 ownership of unrelated voice/WhatsApp bugs.

---

## DEV-01 — Restore worker Clara-vector adapter tests to standard runner — 2026-10-18

- **Direct-main work completed; no branch/PR.** Found worker vector adapter test lived at `apps/worker/src/knowledge/clara-email-vector-adapter.test.ts`, imported undeclared Vitest, and was outside worker's `node --import tsx --test tests/*.test.ts` glob. Replaced with Node-native adapter suite at `apps/worker/tests/clara-email-vector-adapter.test.ts` (old excluded file deleted). Hardened `clara-email-vector-adapter.ts` to reject untrusted blank/malformed org/account/message/source identity and invalid content/metadata SHA-256 on upsert, plus delete/purge scope checks before service-token request. Session: `docs/project-control/sessions/DEV01-WORKER-VECTOR-TEST-COVERAGE-20261018.md`.
- **Executed evidence:** Prior exact-source standalone Node tests (live catalog 6 + runtime form 4 + provider config readiness 5 + Clara vector read 5) **20/20 PASS**, node 22.16; authenticated GitHub source/test-runner checks for new files **12/12 PASS**. New worker Node test is now discoverable but has **not been dynamically executed** in a dependency-equipped checkout. No web/worker full pnpm/typecheck/build/browser/live provider/Clara Qdrant/deployment PASS.
- **Exact next action:** On current `main` run `node --experimental-strip-types --test apps/worker/tests/clara-email-vector-adapter.test.ts`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/worker build`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, and `bash scripts/verify-migration-chain.sh`. Record actual output and fix failures directly on main. For full CI use GitHub Actions CI **manual Run workflow** operator action; do not auto-enable triggers. OPS-01 owns host/credentials/Vercel and runtime integration. Defer binding email vector index/search to Chat/Voice until live Clara endpoint and ISS-026 agent/account isolation are verified. FIX-01 owns unrelated voice/WhatsApp defects.
- **Production/phase status:** No deployment, migration execution, E2E acceptance or phase completion.

---

## DEV-01 — Clara email vector boundary hardening / direct main — 2026-10-18

- **Done on main (no branches):** `packages/db/src/email/clara-vector-search.ts` rejects empty/duplicate/whitespace/oversized organization-account scope, invalid query/limit, malformed credential-bearing endpoint URLs and unexpected redirects before privileged Clara requests. Worker `clara-email-vector-adapter.ts` likewise rejects redirects/unsafe endpoint URLs on vector upsert/delete/purge. Added exact-source portable search test and worker Vitest regression source; no production integration was activated. Clara upstream PR #298 is **merged into Vite-Converted** but deployment and safety integration still unverified.
- **Actual evidence:** Exact committed search TS and standalone test Git blobs were executed locally: 5/5 new Node security/provider tests PASS. Combined with previous exact-source standalone provider-catalog/runtime-form/status tests: **20/20 PASS**. Isolated search module `tsc` with declaration-only stubs PASS. This is not a full workspace/binary/browser or provider runtime PASS.
- **EXACT NEXT_ACTION:** On dependency-equipped latest `main`, run `node --experimental-strip-types --test packages/db/tests/clara-vector-search-standalone.test.mjs`, `pnpm --filter @ai-comms-agent/worker exec vitest run src/knowledge/clara-email-vector-adapter.test.ts`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/web typecheck`, and `pnpm --filter @ai-comms-agent/web build`. OPS-01 verifies deployed Clara email-vector API/Qdrant and ISS-026 cross-agent denial before DEV-01 may bind vector sync outbox or enable Chat/Voice retrieval. Keep existing WhatsApp/voice defects with FIX-01. No deployment or phase acceptance until evidence.
- **Session:** `docs/project-control/sessions/DEV01-CLARA-VECTOR-BOUNDARY-20261018.md`. User instruction remains direct main/no branch.

---

## DEV-01 — Main-only organization provider credential isolation (2026-10-18)

- **Owner direction:** Continue directly on `main` without creating branches or PRs.
- **New source correction:** Both AI provider forms now clear secrets/state when org changes, never display previous-org configs while loading, cancel and ignore old GETs, gate save/remove on current-org readiness, and expose retry on failure. `LiveModelSelect` now discards a late fulfilled response if its AbortSignal is aborted and clears stalled loading state when the org is missing. New Node source-contract and Vitest regression tests committed on `main`. Full session `docs/project-control/sessions/DEV01-ORG-CREDENTIAL-ISOLATION-20261018.md`.
- **ACTUALLY EXECUTED:** Three previously committed standalone Node test files PASS **15/15** (vendor mocks 6, org runtime hydration 4, provider readiness 5); standalone TypeScript check on three pure TS modules PASS; authenticated source-contract checks against new GitHub files PASS **12/12**. **NOT executed:** new source-contract Node test / Vitest, React browser, full web/worker typecheck+build, live keys, Docker/migrations or E2E/deploy.
- **EXACT NEXT_ACTION (on current main):** On a dependency-equipped host run `node --experimental-strip-types --test apps/web/tests/ai-provider-organization-safety.test.mjs apps/web/tests/ai-provider-setup-safety.test.mjs apps/web/tests/provider-config-status.test.mjs`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/worker typecheck`, both builds and normal migrations. Browser-test org A -> org B while an A credentials edit and delayed model fetch are in flight; check no A value is shown/saved under B, verify 403/tenant isolation with authorized accounts; real vendor model select/save/reload. OPS-01 handles environment, live provider credentials and Vercel build-rate-limit. FIX-01 retains source issues #26/WhatsApp/voice. Continue DEV-01 email tools/RAG only behind enforced agent-mailbox isolation and verified Clara vector API.
- **Production status:** Implementation ongoing; do not mark application accepted from isolated tests.


---

## DEV-01 — Direct-main provider-switch model isolation — 2026-10-18

- **Completed on main:** In addition to clearing unsaved vendor API keys, switching provider now clears both transient chat/TTS model and STT model before the new provider's saved configuration restores. This prevents briefly submitting a different vendor's unsaved model IDs during an immediate switch/save. Source `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`; regression source `apps/web/tests/ai-provider-setup-safety.test.mjs`. Commits `4b82db49` and `032d7560`. No branch or PR.
- **Evidence boundary:** GitHub committed file mutations succeeded; focused new source guard added. Full pnpm/Vitest/typecheck/Next build and browser race simulation **not executed** this turn. Existing prior isolated 15/15 test evidence predates these two edits and is not a new whole-application PASS.
- **EXACT NEXT_ACTION:** In fully equipped checkout on current main, run `node --experimental-strip-types --test apps/web/tests/ai-provider-setup-safety.test.mjs apps/web/tests/provider-config-status.test.mjs`, `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, and `pnpm --filter @ai-comms-agent/web build`. Then verify actual browser credential/model provider-switch and save/reload; OPS-01 handles deployment and Vercel build-rate-limit.
- **Browser read-only observation:** Connected production Chat page rendered navigation and previous agent conversation in the authenticated tab, but read-only tab access does not prove live provider calls, save/reload, or current deployed main commit. Do not claim browser feature acceptance.

---

## DEV-01 — Direct-main AI provider setup hardening checkpoint — 2026-10-18

- **Direction:** Owner explicitly requires direct writes to `main` only, no branches or PRs. Work is ongoing; do not claim complete.
- **Source completed:** Provider switching clears the unsaved API key (both card/dropdown controls); DELETE checks HTTP failures before success; config reload failures cannot appear as successful save; deleted provider keys trigger live-catalog refresh; voice-chat status correctly requires both TTS and STT configuration before showing active. New pure helper and focused standalone/Vitest regression source committed on main. Session: `docs/project-control/sessions/DEV01-PROVIDER-SETUP-HARDENING-20261018.md`.
- **EXECUTED:** Provider-catalog mocked Node tests 6/6 PASS; runtime normalization Node tests 4/4 PASS; provider-status Node tests 5/5 PASS; isolated TypeScript of all three pure modules PASS; GitHub source contract checks for provider switch/delete/reload 5/5 PASS. This is NOT end-to-end verification.
- **EXACT NEXT_ACTION:** In an equipped checkout of **current main**, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, and `node --experimental-strip-types --test apps/web/tests/ai-provider-setup-safety.test.mjs apps/web/tests/provider-config-status.test.mjs`. Verify browser switching key isolation, failed DELETE, partial TTS/STT status and saved model selection. OPS-01 separately checks migrations, worker builds, live provider APIs/cross-org denial/deployment and Vercel limit; FIX-01 retains substantial unrelated bugs. Then continue approved email capability/RAG source work behind mailbox isolation/Clara API gates.
- **NOT VERIFIED:** Whole app build, Vitest suite, browser, real vendor/provider credentials, voice/WhatsApp/Gmail delivery, migrations or production.

---

## DEV-01 — DIRECT MAIN requirement, live model verification + runtime hydration repair — 2026-10-18

- **User instruction:** Continue work directly on `main`; **do not create new branches**. This supersedes historical draft-PR language below. PR #34 AND PR #35 already merged; no new PR/branch created in the latest invocation.
- **New source work on main:** Added `src/lib/ai/runtime-settings-state.ts` mapping all eight persisted camelCase AI runtime fields to snake_case form/PUT fields. Fixes a confirmed risk of silently overwriting saved knowledge-base ID, default model provider, voice ID, numeric limits and system prompt during model selection. New organization realtime default no longer injects a hard-coded provider model ID. Added standalone Node and Vitest regression tests.
- **EXECUTED evidence:** Exact committed catalog/module hashes validated; 6/6 live-catalog mocked Node tests PASS, 4/4 runtime hydration Node tests PASS, standalone `tsc --noEmit` both pure modules PASS. Tests are mocked and module-only — NOT monorepo, browser, live provider, or deployment acceptance. Session `docs/project-control/sessions/DEV01-MAIN-RUNTIME-MODEL-20261018.md`.
- **EXACT NEXT_ACTION:** In a dependency-equipped checkout of current **main** run `pnpm --filter @ai-comms-agent/web test -- tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, and `node --experimental-strip-types --test apps/web/tests/runtime-settings-state.test.mjs`; capture full output and resolve feature-specific failures on main. OPS-01 verifies tenant-specific live provider credentials/HTTP, model dropdown select/save/reload, cross-organization rejection, and Vercel build-rate-limit/host environment. Architect acceptance only after full evidence. Do not create a branch absent new owner direction.
- **Ownership:** DEV-01 source/model UX; FIX-01 unrelated bugs; OPS-01 infrastructure/build/deployment/live integration. No claim of production-ready.


---

## DEV-01 — live model catalog verification continuation (2026-10-18)

- **Current repo truth:** PR #34 was merged on October 18 (IST) at `5413468fc1ff0ae0088796b25d01b680126e521c`. Previous draft/unmerged wording below is HISTORICAL, no longer current.
- **Verification completed:** Exact catalog TypeScript Git blob `47c427b77c2dffe4555451ede58fec28b4dfe941` passed standalone `tsc --noEmit` with NodeNext; six dependency-free Node mocked-provider behavior tests passed (6/6). Added executable test `apps/web/tests/live-model-catalog-standalone.test.mjs` on `feature/dev01-live-model-offline-verification-20261018` (draft PR #35: https://github.com/Rilan-Dev/ai-comms-agent/pull/35). GitHub source security/UI audit: 13/13 assertions passed. Source/model only; no overall application PASS.
- **Blocked outside DEV-01:** pnpm/complete private checkout unavailable locally due DNS; Vercel status on merge commit `5413468` shows failure URL carrying `build-rate-limit` (OPS-01). No live org credentials or browser session. FIX-01 retains unrelated source defects.
- **EXACT NEXT_ACTION:** From a dependency-equipped checkout, run `pnpm --filter @ai-comms-agent/web test -- tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, and Next build. Run live organization-scoped, authorized vendor catalog fetches plus dropdown and save/reload/cross-org negative browser checks for available OpenAI/Gemini/Sarvam/ElevenLabs purposes. OPS-01 resolves toolchain, live configuration, Vercel build-rate-limit and deployment; architect reviews test-only PR. No production-ready or accepted status pending those gates.
- **Session:** `docs/project-control/sessions/DEV01-LIVE-MODEL-VERIFY-20261018.md`.


---

## DEV-01 / Forge — live provider-model dropdown source checkpoint — 2026-10-18

- **Authorization:** Owner explicitly asked to copy Clara AI Platform's live model-catalogue selection pattern into ai-comms-agent (no manual model entry, only relevant live provider models). Phase 4 development-first authorization remains active; no acceptance/deployment authorized.
- **Branch/session:** `feature/dev01-live-provider-model-catalog-20261018`; `DEV01-LIVE-MODEL-CATALOG-20261018`. Draft PR #34: https://github.com/Rilan-Dev/ai-comms-agent/pull/34. Source implementation and tests authored, not executed, not merged.
- **Done in source:** Tenant-read-authorized `GET /api/settings/ai-models` using encrypted per-organization/per-purpose credentials; real OpenAI/Gemini/Sarvam/ElevenLabs APIs with capability filtering; reusable dropdowns in organization Settings, provider setup, realtime model and six agent override fields; distinct TTS/STT; retired static catalog. No hard-coded fallback and no global vendor key.
- **Limitations:** No confirmed live catalogue for Sarvam TTS/STT/realtime, TEI embeddings, ElevenLabs realtime; fail visibly rather than invent IDs. Sarvam chat options restricted to v1-runtime-compatible IDs intersected with live v2 listing. No live provider/browser/build/test result yet.
- **EXACT NEXT_ACTION (DEV-01):** Run focused web tests `pnpm --filter @ai-comms-agent/web test -- tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts` plus `pnpm --filter @ai-comms-agent/web typecheck` in a dependency-equipped checkout of the feature branch. Resolve feature-specific defects, validate tenant-scoped live credential and UI select/save/reload for OpenAI, Gemini, Sarvam and ElevenLabs where supported; obtain architect review of draft PR before merge. Do not wait for CI polling when independent source review/test work is available.
- **Role routing:** FIX-01 retains ISS-026/ISS-030 and substantial unrelated defects. OPS-01 owns host pnpm/Docker, deployment, live provider config and production verification. Do not claim production ready from source.

---

## FIX-01 voice + email action runtime checkpoint — 2026-10-16
## FIX-01 — Chat membership nullability build correction — 2026-10-18

- User Docker log: worker image built; Next.js web compilation succeeded but type validation failed at `apps/web/src/app/api/chat/stream/route.ts:384` because `subject.membership` may be null.
- Root cause: shared `AuthSubject` permits nullable membership even though successful `authorize()` calls guarantee an active membership. Caller did not narrow the shared type.
- Correction on main: explicit fail-closed 403 membership guard after `authorize()`, plus regression assertion requiring the guard before trusted `ToolContext` construction. Commits: `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`, `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`.
- Verification remains pending: source changes are committed; no post-fix build/test result yet.
- **Next:** Pull latest main and rerun `docker compose -f infra/docker-compose.yml up -d --build`. If successful, run the focused chat host-tool-loop test and update this state from actual output. Host shell `pnpm: command not found` is a separate OPS-01 toolchain issue; do not change app source to work around it.

## DEV-01 — Chat tool loop and WhatsApp approval checkpoint — 2026-10-17

- Interactive `/api/chat/stream` now constructs a `ToolContext` from the server-authenticated organization membership, user, role and permissions; it combines only the per-agent allowlisted email/WhatsApp runtime tools, uses the bounded host-authorized invocation path (4 rounds / 8 calls / 10,000-character tool result cap), and preserves host-supplied mailbox context as explicitly untrusted data. Model arguments cannot set tenant, actor or permissions.
- Added source regression tests for the chat host tool loop, proposal-only send behavior, approval UI, Meta template handling, RBAC, and scheduled-action bypass closure.
- WhatsApp outbound API requests now create durable `whatsapp_send_actions` proposals instead of queueing sends immediately. Added an organization-scoped approval queue endpoint and authenticated approve/reject endpoint. Approval rechecks the connected account and recent **inbound** customer message; free-form text is queued only inside Meta's 24-hour customer-service window. A free-form text action outside that window transitions to `requires_template`; an approved text-body template is rechecked with Meta at approval and worker send time.
- Added migrations `0035_whatsapp_send_approvals.sql`, `0036_whatsapp_templates.sql`, `0037_whatsapp_send_action_outcomes.sql`, `0038_whatsapp_feature_permissions.sql`, `0039_email_read_tool_permission.sql`, and `0040_whatsapp_agent_binding_recheck.sql`; added Meta template submission/status sync, supported text-body template delivery, approval queue/decision API, approval UI, worker-time 24-hour and live template-status checks, WhatsApp-specific read/send RBAC for owner/admin/member roles, the email.read feature permission required by host email tools, and send-time agent/account binding rechecks for chat and scheduled product actions. `whatsapp.send` is now registered only as a proposal tool: it creates a pending approval and never directly queues/sends.
- Known integration risk: the web route imports the existing worker runtimes directly; validate the Next.js monorepo build/import boundary during normal verification and extract a dedicated shared runtime package if the build configuration rejects this dependency direction.
- Verification boundary: source changes only. Tests, typecheck, build, migration execution, browser approval UI, Meta API, and deployed behavior have **not** been run or verified. Do not claim a send succeeded from an approval or queue response; only provider-confirmed message state establishes delivery progress.
- Next: run focused web/worker tests and typechecks when available; review the Next.js import boundary for worker runtime imports; apply migrations through the normal deployment process; verify template submission/status refresh and a complete human-approved text/template send against Meta. Keep `whatsapp.send` proposal-only and do not claim delivery before provider confirmation. Do not wait for CI/Vercel polling to continue independent implementation.

---

## FIX-01 realtime voice implementation checkpoint — 2026-10-16

- Reference reviewed: `Rilan-Dev/Clara-AI-Platform` branch `feature/ai-core-from-doable-source`, including realtime hooks, provider relays and session negotiation.
- Native voice source now covers OpenAI WebRTC, Gemini Live WebSocket with a constrained ephemeral token, and provider-specific Sarvam/ElevenLabs realtime STT/TTS WebSocket client adapters.
- Added isolated relay service source under `infra/voice-relay/`, reusing Clara's `sarvam-relay`, `sarvam-tts-relay`, `elevenlabs-relay`, `sarvam-wire` and `ws-lifecycle` implementations. It has origin allowlisting, HMAC relay bootstrap, session ownership rechecks, and metering routes. Deployment/configuration is an OPS-01 handoff; no relay container has been built/deployed/live-tested. If `VOICE_RELAY_PUBLIC_URL` is not set, Sarvam/ElevenLabs intentionally use the provider-backed utterance pipeline fallback rather than claim a native socket is connected.
- Shared email runtime: extracted `@ai-comms-agent/email-agent-runtime` so web voice and worker use the same tool registry/executor, fresh policy allowlist checks, account/role/capability checks and durable audit. Voice turns call `runEmailAgentTurn` with trusted authenticated `ToolContext`, channel `voice`, bounded tool rounds/calls and the organization's KB.
- Email operations currently registered: local draft create/update, reply/forward draft creation, plus send/reply/forward request tools that create `pending_approval` records. The provider action worker is the only path that sends after explicit approval; it now updates an existing provider draft with the latest approved contents before sending. Voice UI surfaces pending approval IDs and explicitly says they have not been sent.
- Provider-backed mailbox mutations (mark read, archive, move, trash/bulk), attachment operations and other unimplemented catalogue tools remain unregistered/fail-closed; do not claim they are complete.
- Verification state: GitHub source edits only. Tests, typecheck, build, browser microphone/transport, provider credentials, relay deployment, approval execution and deployment have NOT been run or verified. Do not wait/poll GitHub Actions or Vercel; continue source work and report evidence accurately.
- Remaining: OPS-01 must deploy the relay and configure `AUTH_SECRET`, `AI_COMMS_WEB_URL`, `VOICE_RELAY_ALLOWED_ORIGINS`, and web `VOICE_RELAY_PUBLIC_URL`; then FIX-01 should complete provider lifecycle/error/reconnect tests and provider-backed mailbox mutation handlers. PR #27 was merged at its earlier partial commit. PR #28 is the draft continuation for this source tranche; issue #26 remains open until scope and evidence are complete.

---



## FIX-01 voice transport correction checkpoint — 2026-10-16

- Draft PR #27: https://github.com/Rilan-Dev/ai-comms-agent/pull/27
- Completed source correction tranche: HTTP transcript endpoint is no longer called a realtime session endpoint; session stays starting until transport activation; transcript bridge is explicitly tagged and can run only through host-authorized routes; UI no longer requests microphone permission or reports microphone readiness when no audio adapter exists.
- Not complete: provider-specific realtime browser transport/session negotiation, final spoken transcript bridge into host authorized email tools, open/error/reconnect/interruption/teardown tests. Issue #26 remains open.
- Verification: source-only GitHub edits; tests, typecheck, build, browser and provider connection not run. Continue with Clara's supported realtime client/session negotiation; do not invent a socket endpoint or mark this deliverable complete.

---

## FIX-01 — voice session readiness safety tranche (2026-10-16)

- PR: https://github.com/Rilan-Dev/ai-comms-agent/pull/27 (draft, not merged).
- Corrected contract: `/api/voice/turn` is explicitly `turnEndpoint` + `transportMode: transcript_bridge`, never a realtime `sessionEndpoint`.
- Session config no longer changes lifecycle state to active or stamps `connected_at` merely because settings resolved. The manual transcript bridge can still run while a session is starting only when persisted metadata explicitly identifies that bridge; organization/user/agent authorization and ended-session checks remain in place.
- Removed the misleading microphone permission prompt/readiness claim. UI states that microphone audio/realtime is not connected and keeps the manual text bridge labeled as such.
- Added/updated static lifecycle assertions, including the older voice-turn guard test.
- **Not the full fix:** no provider realtime adapter/session negotiation has been wired yet; spoken email enquiries, actual socket/WebRTC readiness, reconnect/interruption and audio teardown remain incomplete. Issue #26 stays open. Do not claim realtime working.
- **Verification:** GitHub source writes only. Tests, typecheck, build, browser, provider connection and deployment were not run. Continue by integrating Clara's existing provider-specific realtime client/session negotiation without recreating provider protocols; bridge final transcripts through the host-authorized turn/tool pipeline, then add lifecycle tests. Do not wait for CI/Vercel polling.

---

## DEV-01 realtime voice recovery — 2026-10-16

- User request: Fix Clara realtime voice so the browser connects and the user can ask Clara about email naturally.
- Source finding on main: apps/web/src/app/ai-voice/voice-workspace.tsx requests microphone permission and calls the HTTP transcript bridge; it never instantiates a realtime adapter or opens a WebSocket. The UI says the browser transport adapter is still being negotiated while the session can appear active.
- Contract defect: packages/clara-core/src/runtime.ts resolveVoice() returns sessionEndpoint: "/api/voice/turn"; this is the host HTTP transcript endpoint, not a provider realtime socket/session URL. packages/shared/src/voice/transport.ts defines an adapter contract, but the workspace does not use an implementation.
- Role routing: substantial source bug assigned to FIX-01/Sentinel in issue #26. DEV-01 does not implement a competing provider transport. OPS-01 owns deployment/infrastructure only if a correctly implemented adapter fails in deployed runtime.
- Security: Keep provider credentials server-side. Use Clara's pinned realtime client, provider-specific negotiation/relay, state machine, reconnect and interruption logic. Voice email operations must reuse chat's organization/agent/account authorization and approval/audit path; do not bypass ISS-026.
- Verification: GitHub source inspection only. No tests, typecheck, build, browser, WebSocket/provider or deployment checks were run. No live connection claimed.
- Exact next action: FIX-01 addresses issue #26: wire the supported Clara realtime client through real provider session negotiation; only label connected after transport readiness; bridge voice turns to the host-authorized agent pipeline; add regression tests for connection/error/reconnect/interruption/teardown. OPS-01 is engaged only for a distinct deployment/infrastructure failure after source correctness is established.

---

## FIX-01 immediate corrective action — Microsoft Graph provider enum (2026-10-16)

- **Symptom:** Worker mailbox poll, leased direct-sync fallback, and retry deliveries repeatedly fail with PostgreSQL 22P02: invalid input value for enum email_provider: "microsoft_graph".
- **Root cause:** 0002_application_domain.sql creates email_provider without microsoft_graph. 0003_email_domain.sql adds that value to a separate enum, email_account_provider; it does not change the enum used by email_accounts.provider.
- **Source remedy:** Added forward-only migration 0034_email_provider_microsoft_graph.sql using ALTER TYPE email_provider ADD VALUE IF NOT EXISTS 'microsoft_graph'. Added static regression protection in apps/web/tests/migration-verification.test.ts.
- **Verification:** GitHub source writes succeeded. Static tests, typechecks, migration execution, and live mailbox sync have NOT been run/verified here. No PASS claimed.
- **Next action:** OPS-01 applies pending migrations through the normal migration process, rebuilds/restarts the worker from the matching source revision, and confirms the 22P02 errors stop. Then verify provider sync state and persisted messages; queue acceptance or worker health alone is insufficient.
- **Role boundary:** FIX-01 source correction is complete at source level. Migration execution, Docker/restart, and live runtime verification belong to OPS-01. Do not repeatedly retry the same invalid enum query as a remedy.

---


## FIX-01 immediate corrective action — 2026-10-16

- **Symptom:** Clean Docker worker build failed TypeScript compilation with TS2352 in Gmail watch renewal and IMAP IDLE startup.
- **Root cause:** Generic decrypted credential records were cast directly to `EmailCredentials`, whose required `credential_type` discriminant was not guaranteed.
- **Source remedy committed:** Validate supported discriminant values (`oauth_token`, `password`, `app_password`), pass a narrowed spread object, and remove unsafe casts. See ISS-027 and FIX01-WORKER-CREDENTIAL-TYPE-20261016.
- **Next action:** From the deployment checkout, run `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/worker test`, then rebuild with `docker compose -f infra/docker-compose.yml build --no-cache worker`. Re-run `docker compose --env-file .env.docker -f infra/docker-compose.yml up -d` only after the worker image build succeeds.
- **Verification state:** Source change committed; no typecheck/test/rebuild pass claimed. Keep ISS-027 open until evidence is recorded.
- **Routing:** If the source build succeeds but compose, network, registry, host, or deployment operations fail, route that distinct failure to OPS-01. Do not wait for DEV-01.

## Provider-neutral real-time email sync — 2026-10-16

- Owner request: new messages should appear automatically in the application inbox across supported providers without a manual Sync action.
- Read the project-control entry points and email architecture/provider contract before changing code. Added implementation plan: `docs/plans/PROVIDER-REALTIME-EMAIL-SYNC-PLAN.md`.
- **Implemented on this branch:** inbox client now refreshes the first page every 5 seconds while visible and refreshes immediately when the tab becomes visible; preserves search/account/unread/action filters and avoids overlapping poll requests. This only reflects messages after they are persisted in PostgreSQL.
- **Not yet implemented:** Gmail Pub/Sub receiver + authenticated OIDC validation + watch registration/renewal + History API reconciliation; persistent IMAP IDLE listener; verified Zoho webhook path; browser push transport. Current 2-minute worker fallback is not equivalent to instant push.
- **Next development order:** (1) run web/worker tests and typechecks for the inbox polling + prior Gmail parser/checkpoint fixes; (2) implement Gmail Pub/Sub securely and add history reconciliation/watch renewal; (3) implement a long-lived, leased, reconnecting IMAP IDLE listener; (4) validate Zoho push capabilities and retain polling fallback; (5) measure delivered-email-to-inbox latency on deployed services.
- OPS-01 must configure Google Cloud Pub/Sub, webhook authentication/audience, production worker, RabbitMQ/Redis, and shared production DB. No app password pasted into chat should be reused; revoke it and rotate credentials.
- Manual sync remains an optional recovery action. Normal sync must begin on account connect and run continuously while the worker is healthy.
- Current branch: `feature/provider-realtime-email-sync`, based on `feature/imap-smtp-mail-actions`. Latest new UI changes and plan have not been locally tested or deployed.

---

## Latest root-cause fix — Gmail OAuth connected but inbox remains empty (2026-10-14)

- **Root cause found in source:** Gmail's batch API prefixes each response `Content-ID` with `response-`. `GmailAdapter.parseBatchResponse()` did not remove that prefix, so valid batch responses were stored in the map under the wrong message IDs. The mailbox worker then looked up the original IDs, treated every message as missing, acknowledged those IDs, and logged `imported_or_updated: 0`. This matches the observed empty inbox and repeated initial-import progress. Google documents the response prefix in the [Gmail batch request guide](https://developers.google.com/workspace/gmail/api/guides/batch).
- Fixed response ID normalization and added a regression test using Google's documented response format.
- Fixed a second data-loss path: DB persistence errors were logged and swallowed, then the worker acknowledged all fetched IDs and advanced the sync cursor. Failed writes now remain in the durable pending-ID checkpoint and cause the sync attempt to fail/retry; only successfully persisted messages are acknowledged.
- Automatic fallback polling is now every 2 minutes instead of every 15 minutes. Gmail push/watch is explicitly reported unsupported until a Pub/Sub receiver is implemented/configured. This is automatic near-real-time polling, not push-event real time.
- Added focused tests for Gmail batch response mapping and persistence checkpoint selection. **These new tests and typechecks have NOT been run by ChatGPT** because this environment has no local repository checkout. User's previously reported 114/114 worker tests and typecheck were for the pre-fix branch state.
- **Next action:** in `/docker/ai-comms-agent`, pull the latest `feature/imap-smtp-mail-actions`, run `pnpm --filter @ai-comms-agent/worker test` and `pnpm --filter @ai-comms-agent/worker typecheck`, then deploy/restart the worker from the same commit as the web app. Verify the Gmail account's persisted message count increases and `/mail/inbox` shows actual DB-backed messages. No live production ingestion is claimed until this is observed.
- **Environment boundary:** the previous diagnosis also recorded a RabbitMQ placeholder vhost (`YOUR_EXISTING_VHOST`) and Redis `WRONGPASS`. Recheck sanitized worker logs and ensure web + worker use the same intended production database; never paste credential values. If the batch fix is deployed and messages still remain absent, use the logged provider error and counts to distinguish credentials/transport, persistence, and inbox-query issues.
- **Role boundary:** DEV-01 fixed source behavior; OPS-01 still owns production worker environment/deployment verification. Do not wait for CI/Vercel polling before continuing independent work.

---

## DEV-01 — Email index lifecycle implementation (2026-10-14)

- Working branch: `feature/email-index-lifecycle-v1`; not merged.
- Added stable source identity/content/metadata hashes and deterministic account-scoped vector point IDs; message content/metadata changes now requeue PostgreSQL-derived indexing through `indexed_at`.
- Added durable `email_knowledge_sync_jobs` outbox for message upserts, message deletes and account purges; account deletion queues cleanup and removes its PostgreSQL email knowledge docs. Added retryable vector-adapter processor and tests.
- Added execution-time policy/capability regression tests for allowlist revocation, all-required capabilities and any-capability alternatives.
- **Next:** obtain/bind the supported Clara RAG vector adapter; then run `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/clara-core typecheck`, `pnpm --filter @ai-comms-agent/worker typecheck`, and `pnpm --filter @ai-comms-agent/web exec vitest run tests/agent-tool-registry.test.ts tests/email-read-tools.test.ts`, followed by `pnpm --filter @ai-comms-agent/web typecheck`. Fix concrete failures and record actual output.
- **Critical boundary:** Clara Platform has internal KB-aware vector functions, but ai-comms-agent has no supported server-to-server email-index API. The current retrieval scope is KB-level; do not add email vectors to a shared KB until FIX-01 closes ISS-026 and establishes agent/account filters. Outbox processor is adapter-injected and not wired into worker startup; live vector upsert/deletion is not complete.
- No local checkout is available in this environment; `git ls-remote https://github.com/Rilan-Dev/ai-comms-agent.git refs/heads/main` failed with exit 128: `Could not resolve host: github.com`. Tests/typechecks have not run. Do not wait/poll CI/Vercel while independent source work exists.
- FIX-01 owns ISS-026; OPS-01 owns live infrastructure and ingestion verification. Keep the live model tool catalogue hidden until transport/security checks complete.

---

## Active DEV-01 continuation — email tool verification and vector-index lifecycle (2026-10-14)

- PR #15 is already closed and merged into main (GitHub merge commit: d444cf1b35939008058532b0754b46daef7cc312). Main contains the email agent loop, shared executor, provider tool-call adapter, Gmail deletion reconciliation, and self-review source.
- A follow-up plan is committed at docs/plans/EMAIL-INDEX-IDENTITY-AND-ACCOUNT-LIFECYCLE.md. It covers per-account/provider message identity, separate content and metadata hashes, re-indexing changed messages, account-removal vector cleanup, stale-job protection, and reconciliation.
- Exact next development action: in a real local checkout, run the provider-contract tests, worker-loop tests, executor tests, then Clara and worker TypeScript checks; fix concrete failures and record exact output. After that, implement hash/version-based reindex scheduling and account-scoped vector deletion following the plan.
- Local verification could not be run in this execution environment: no ai-comms-agent checkout is mounted, and git ls-remote failed because outbound DNS to github.com is unavailable. No test/typecheck/build/live-index PASS is claimed.
- Do not expose the email tool catalogue to the live model until transport integration and security checks are complete. FIX-01 owns ISS-026; OPS-01 owns live infrastructure and ingestion verification. Continue independent source work without polling CI/Vercel.

---

> **Latest DEV-01 action — 2026-10-13:** The Clara provider tool-call adapter and bounded worker loop are now source-implemented on `feature/email-ops-e1-e3` (`packages/clara-core/src/runtime.ts`, `apps/worker/src/agent/email-agent-loop.ts`). They are not yet wired into a transport. Exact next DEV-01 action: run the newly added mocked OpenAI/Gemini provider-contract tests and worker loop tests, then Clara/worker typechecks in a local checkout if available. Do not expose catalogue-only tools. FIX-01 owns ISS-026; OPS-01 owns live broker/Redis and ingestion proof. No tests/typecheck/build/live provider/deployment verification has been run for this update.

> **DEV-01 session update (2026-10-13):** The user authorized continuation after EMAIL-OPS-01 planning. Work is active on branch `feature/email-ops-e1-e3`: Gmail history pagination/add-update-delete classification and account-scoped deletion reconciliation were implemented with focused regression source tests; the shared email tool contract catalogue and capability/allowlist filter were added. This catalogue is contract metadata only and must not be exposed to the model until executable handlers, execution-time authorization, policy and audit are wired. The shared registry, read-only handlers, invocation pipeline, and agent-scoped runtime factory now exist. Exact DEV-01 next action: connect `invokeEmailReadTool()` to the actual model tool-call loop and chat/realtime voice/WhatsApp/scheduled transports. Keep descriptors unavailable to the model until the shared runtime path is wired and verified. OPS-01 retains the separate live RabbitMQ/Redis and persisted-ingestion action; FIX-01 retains substantial bug/regression remediation.

# NEXT_ACTION.md

## Current next action — Restore live OAuth mailbox ingestion (2026-10-10)

The user has now run `bash scripts/diagnose-email-accounts.sh`. The evidence identifies a live worker configuration blocker: the RabbitMQ URL used by the running worker contains the literal virtual host `YOUR_EXISTING_VHOST`, and Redis rejects the worker's authentication with `WRONGPASS`. The Gmail account remains pending/idle, with no sync attempt/success timestamps and zero stored messages even after the API returned HTTP 202. Public/local `/api/health` HTTP 200 only proves the app process is alive/configuration values are present; it does not prove broker or Redis connectivity.

**Exact next action (OPS-01 / server operator):** On the host, inspect the local `.env.docker` without sharing its contents. Correct `RABBITMQ_URL` to the actual broker endpoint, valid username/password, and real virtual host (URL-encode reserved characters). Correct `REDIS_URL` to the actual Redis ACL/authentication, database and TLS mode. Recreate/restart the worker so it receives the corrected environment. Do not guess credentials, copy placeholder values, or bypass Redis lease coordination.

**Recovery verification:** confirm sanitized worker logs no longer show RabbitMQ `ConnectionClose` or Redis `WRONGPASS`; requeue the Gmail sync; then confirm the account's status/last-attempt/last-success fields advance and the persisted `email_messages` row count increases. HTTP 202, healthy status, and a passing contract test are not live-ingestion success. If broker/Redis are corrected but the account still does not fetch, return to FIX-01 with the new sanitized provider/token-refresh error.

The separate IMAP/SMTP probe returned authentication failure after a mailbox username/address mismatch; it does not establish whether the OAuth credentials are valid. Do not paste cookies, environment URLs, passwords, OAuth codes/tokens, or mailbox contents. Preserve local lockfile changes. Do not wait for CI/Vercel; no live email PASS is claimed.


The single exact next authorized action. Update this file on every commit.

---

## Current next action

### OPS-01 audit migration schema fix — 2026-10-10

GitHub source correction committed on main: migration 0032 now resolves audit_events through the connection's active search_path, compatible with the application's aca,public schema layout. Static regression assertion updated. Commits: 387c7e50f258c13e0e4aa03ae5b319896b27eabc and 4e455f4d55051ffa16bb7a52f85baf1c3218e3f5.

Verification: source writes only. SQL migration, focused tests, typechecks, build, container startup, and runtime checks NOT RUN. The reported DB failed before recording 0032. If another DB already recorded the previous checksum, inspect its ledger before rollout; do not delete ledger rows blindly.

Exact next action: pull latest main without discarding local work; inspect git status --short; confirm the migration connection uses search_path=aca,public; rerun bash scripts/manual-up.sh. Record actual output and fix the next concrete issue without waiting for CI/Vercel.


### FIX-01 worker/web contract correction — 2026-10-10

Source corrections committed on `fix/migration-verification-phase4-contract` after reviewing the user-reported worker-suite and email-action contract failures:
- Converted the three worker contract tests that imported Vitest to Node's built-in `node:test` / `node:assert` runner, matching `apps/worker/package.json`.
- Replaced ESM-incompatible `__dirname` usage in worker test fixtures with `fileURLToPath(import.meta.url)`.
- Applied the existing bounded transient-error retry helper to provider capability discovery.
- Corrected RFC 2047 encoded-word matching in IMAP header decoding.
- Preserved informational `messageId` metadata for email provider events while canonical organization/action/account/correlation fields remain authoritative.
- Corrected test contracts/mocks for Clara indexing comments, IMAP literal line boundaries, Zoho OAuth form-body parsing/account discovery, and email-action approval/recovery module boundaries.

**Verification status:** GitHub accepted source commits. Focused tests, the full worker suite, typechecks, build, browser/runtime checks, and deployment have NOT been executed or verified in this continuation. Do not describe the branch as deployment-successful yet. The lockfile and local backup files remain out of scope and must be preserved.

**Deployment blocker:** A preview deployment request for commit `a4877ee23152b4895bf5eae48243ddb0202c8155` was rejected by Vercel with HTTP 402 (`api-deployments-free-per-day`, over 100 deployment API calls in the daily allowance; retry after 24 hours). No deployment was created. Do not claim deployment success or repeatedly retry/bypass the quota. Existing recent branch deployments were `CANCELED` and do not validate the latest source.

**Exact next action:** fetch/pull this branch into the local checkout without discarding local changes or the four lockfile backups. Run the focused web email-action contract and migration-verification tests, then `pnpm --filter @ai-comms-agent/worker test`; follow with web and worker typechecks. Fix any remaining concrete failures and update this file/worklog with actual output. Continue without waiting for GitHub Actions or Vercel; only report deployment success after a deployment result is observed.

## Immediate FIX-01 migration/worker test follow-up — 2026-10-09

The user reported migration-verification failures around audit-event policy assertions and DO-block delimiters, plus worker test failures around retry metadata and the Qdrant exclusion assertion. Source corrections are committed: forward-only migration 0032 (`7557a6cd`), migration test updates (`ee85b554`, `c4d4abd0`), and worker contract-test updates (`cecae73e`, `96996d82`). Source changes only; focused tests, typechecks, and migration execution have NOT run.

**Exact next action:** pull latest `main`; inspect `git status --short`; compare `pnpm-lock.yaml` to `origin/main` because current main contains one lockfile document while the reported local file contains two. Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts` and `pnpm --filter @ai-comms-agent/worker exec node --import tsx --test tests/email-sync-rabbitmq.test.ts`. Then run web and worker typechecks sequentially. Do not wait for CI/Vercel. Route Docker, CI/CD, deployment, or environment defects to OPS-01. Record actual outputs; do not claim PASS before execution.

### Immediate FIX-01 web typecheck follow-up — 2026-10-09

User-reported web typecheck errors showed the Lovable UI imports lucide-react without a declared web dependency, two focus traps had strict indexed-access errors, and lovable-ui-migration.test.ts referenced an undefined newAgentPage. Source fixes are committed: web dependency 8f09785a, pnpm lockfile records with published SHA-512 integrity 7b1136e6, Agent Detail focus typing 3e35c1f5, sidebar focus typing a9dcb8e5, and static test source binding 52a4e348. These are source changes only; post-fix installation/tests/typechecks have NOT run.

**Exact next action:** pull latest main; run pnpm install --frozen-lockfile; then run pnpm --filter @ai-comms-agent/web exec vitest run tests/lovable-ui-migration.test.ts and pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts, followed by pnpm --filter @ai-comms-agent/worker exec node --import tsx --test tests/email-sync-rabbitmq.test.ts. Run pnpm --filter @ai-comms-agent/web typecheck and pnpm --filter @ai-comms-agent/worker typecheck sequentially. If they pass, run pnpm run typecheck if resources allow. Record actual output; no PASS claim before execution. Do not wait for CI/Vercel.

### Immediate FIX-01 lockfile follow-up — 2026-10-09

The user's latest local run confirmed a second pnpm lockfile defect after the missing package/snapshot records were restored: `amqplib@2.2.0` lacked a tarball integrity hash, so pnpm 12.8.1 correctly rejected installation with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`. FIX-01 added the published SHA-512 SRI to `pnpm-lock.yaml` (commit `644d578170801785c1252a569fa976b0b33476eb`) and tightened the existing regression test (commit `d115e1b0293b48571cd0902849cb5f0030963bc7`) and corrected over-escaped regex literals after source review (commit `162183e8d7c67b8346c15989ef850327e487cfc4`). Source only; install/test/typecheck not rerun. FIX-01 also corrected over-escaped regex literals in the regression test (`162183e8`) and updated ISS-017/VERIFICATION_STATE. Control-record commits: ISSUES `534e6abd`, verification `582f1077`.

**Exact next action:** pull latest `main`; run `pnpm install --frozen-lockfile`. If successful, run `pnpm run typecheck` and `pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts`. Record actual output. Never disable integrity policy or fabricate hashes. Do not wait for CI/Vercel. Separate Docker/environment defects route to OPS-01.

### Immediate inbox runtime follow-up — 2026-10-09 (OPS-01)

Latest live logs show `email_messages.from_name` missing and Redis authentication rejected with WRONGPASS. FIX-01 committed `0030_email_messages_runtime_reconciliation.sql` and static migration coverage. The `queued` response is acknowledgement only, not import success. OPS-01's next runtime action is to apply migrations `0029` and `0030` to the exact web/worker database, roll out matching containers, correct Redis URL credentials against Redis ACL configuration, then verify persisted email rows and inbox results. No runtime success is claimed. Keep the independent DEV-01 UI migration moving without waiting for CI/Vercel.


### DEV-01 Lovable UI migration — authoritative continuation update (2026-10-09)

The owner explicitly requires the production application to adopt the Lovable-generated Agentic AI Studio visual design across all screens, without losing current application functionality or frontend validation. The route-by-route coverage matrix is maintained in `docs/project-control/LOVABLE_UI_MIGRATION.md`; use it as the migration checklist and update statuses as each screen is actually adapted.

**Already adapted (source commits recorded in worklog):** shared semantic theme and shell; Overview; Inbox; Agents list/create; Mail Accounts; Drafts; Threads/thread view; Compose; Approvals. Static contract tests cover key preserved behavior. These are source-level adaptation claims only; no tests/typecheck/build/browser verification is claimed.

**Already adapted in this continuation (source only):** WhatsApp, Automations, Schedules, Chat and AI & Voice (`3cf94c7f`, `c2dd6e6e`, `740b70d2`, `dee40027`, `84652b74`); static contract assertions added in `2f1eecd5`, `10b87d65`, `ddb35096`, with endpoint assertion correction `f7ed2b42`. Tests and build were not run. **Now adapted at source level:** Knowledge, Activity, Audit, Operations, general Settings and provider-setting subsections (AI provider/runtime, Gmail OAuth, Zoho OAuth), Login/Setup, and Agent detail/version/history. `/agents/new` redirects to the canonical `/agents#new-agent` form. A global CSS token does not count as route migration. Full responsive/accessibility/icon consistency review remains outstanding. Latest source-only follow-up: agent deploy/pause confirmation now manages keyboard focus, Escape, focus restoration and narrow-screen scrolling; mobile navigation traps/restores focus while open; Chat exposes a labelled conversation log and announced busy status; Agent channel selectors have explicit accessible names. Commits: `d73099d6`, `3d8ac3a3`, `837b4b19`; static assertions `0a603b76`, `f8c3aefd`. Chat agent switching was also hidden on narrow screens; it is now visible at all viewport widths with a constrained width and accessible name (`bc8e698f`; assertion `ad7dc7f8`). The Chat live region now announces thinking, completed responses, and failures without duplicating the visible thinking indicator (`d9662da6`; assertions `529ed8b2`). These are source-only changes and are not tested.

**Exact next action:** perform a source-level cross-route responsive/accessibility and remaining-secondary-controls review using `docs/project-control/LOVABLE_UI_MIGRATION.md`. Correct concrete accessibility/responsive defects and add focused contract assertions. Browser, tests, typecheck, build and live API verification remain NOT RUN. Do not wait for CI/Vercel. For each screen preserve existing Next.js routes and server/API contracts, real data, organization authorization, validation, explicit send/approval safeguards, and loading/empty/error states. Reuse Lucide icons and semantic theme tokens; do not import the Vite/TanStack runtime or replace real data with source mock data. Add/update focused static contract assertions and the migration matrix. Continue without waiting for CI/Vercel; record verification as NOT RUN unless actually executed. Route substantial bugs to FIX-01 and deployment/infrastructure work to OPS-01.


### Immediate user-reported Zoho OAuth defect

The user reports that Zoho consent returns to the application but no mailbox appears, with `Zoho did not return the required token metadata.` Source correction committed in `apps/web/src/app/api/oauth/zoho/callback/route.ts` (`2cb976b`): token responses no longer require `api_domain`, regional Mail API hosts are selected from the signed/validated data-center setting, and token-exchange failures return actionable non-secret guidance. Static regression assertions committed (`53d96a0`). **Not tested and not live-verified.** Next, continue the queued UI migration and connected-mailbox integration work; when the user deploys/retries, capture the safe provider error outcome if the failure persists without sharing OAuth codes, state, verifier, or tokens.


```yaml
actor: DEV-01 / Forge
role: Product development under the existing project-owner development-first authorization

action: |
  RabbitMQ email.sync transport and Clara email indexing adapter have source implementations. RabbitMQ source declares durable main/retry/DLQ queues, publishes persistent messages with confirms, uses manual ack/prefetch, bounded retry and confirmed DLQ/retry republish, and reconnects after startup/connection loss. Clara host indexing uses the existing worker adapter to write tenant-scoped email documents/chunks to PostgreSQL; current retrieval is lexical and no direct Qdrant/semantic indexing is claimed.

  Knowledge, Activity, Audit, and Operations have source adaptations recorded in docs/project-control/LOVABLE_UI_MIGRATION.md. Knowledge uses tenant-authorized counts/recent records; Activity/Audit use the existing organization-authorized audit API with filters and exports; Operations displays dependency URLs as Configured rather than falsely Healthy. Settings has now gained compact anchor navigation and grouped Organization, Mail OAuth, AI providers, Clara runtime, Members/Roles, and workspace-link sections (b0c6d04d); source-contract assertions were added (88fd8eea). Migration inventory updated (175cb9ea). Source only; tests/typecheck/build/browser/runtime checks have not run.

  RabbitMQ and Clara email-indexing source work is in place, with additional source hardening: consumer channel initialization race fixed (d2e6fe39), incremental polling eligibility corrected to avoid repeated 10-second enqueue (e760bb92), email body chunking added (766c487d), lexical retrieval improved (93a9804d, 0eedd60f), chunk refresh uniqueness issue addressed (2b95ca81), and contract tests added (854285f5, 28080eb7, 4bad6d3e). The Clara adapter uses PostgreSQL knowledge records and lexical retrieval only; embedding/Qdrant integration remains unimplemented. None of these tests/typechecks were executed.

  Settings now has section navigation and accessible OAuth failure alerts; login/setup duplicate icon imports were removed and auth contract test source was added. Settings and Login/Setup still require full visual/responsive/accessibility review, which is not claimed complete. Exact next implementation: perform the cross-route responsive/icon/accessibility review and focused static contract coverage now that Knowledge, Activity, Audit, Operations, Settings, Login/Setup, and Agent detail/version/history have source adaptations. Review the main route surfaces and fix concrete regressions without replacing API-backed behavior. Prioritize unresolved icon/import errors, accessible navigation/forms/status, responsive overflow, truthful loading/error/empty states, and explicit approval/deployment safeguards. Preserve existing endpoints and authorization; continue without waiting for CI/Vercel. Continue without waiting for CI/Vercel. Keep RabbitMQ broker acceptance, Redis lease, IMAP/Zoho tests/typechecks, fragmented literal regression, real IMAP compatibility, provider→PostgreSQL→tenant-scoped Clara Chat, and live Clara indexing acceptance explicitly unverified until executed.



  Additional source hardening in this continuation: fixed an early-delivery race by assigning RabbitMQ consumer channels before registering the consumer; corrected producer eligibility so a non-null incremental cursor does not enqueue the same mailbox every 10 seconds; added a static regression assertion for that polling condition. Clara email indexing now splits email bodies into bounded overlapping chunks, refreshes chunk rows safely when boundaries shift, and the host runtime can retrieve by sanitized lexical OR terms with organization and agent-scope filters. Added chunking and Clara contract regression source. Commits: RabbitMQ channel race d2e6fe39, queue polling eligibility e760bb92, queue regression 4bad6d3e, Clara chunking 766c487d and test 28080eb7, lexical retrieval 93a9804d and empty-query guard 0eedd60f, chunk refresh 2b95ca81, Clara contract test 854285f5. None of these tests or typechecks have been executed; source-only status remains.


  Cross-route review follow-up: Automations and Schedules had server pages using ensureDevSeed/getDevOrgId rather than the authenticated organization context. Both now resolve getAuthenticatedAppContext from request headers and redirect unauthenticated users to login; accessible labels were added to automation/schedule controls and unused React hook imports were removed. Added regression assertions in apps/web/tests/agent-detail-page-contract.test.ts. Commits: 5a5275b3, 088c36d8, b46ac6ab, ba4ebdcd, b3a81781, 69d241c4. Source only; no test/typecheck/build or multi-tenant runtime validation.


  Additional cross-route security finding: Mail Approvals also used ensureDevSeed/getDevOrgId. The server page now resolves the authenticated organization and redirects unauthenticated requests to login (19b8c0fd); regression coverage was added to the existing mail organization-context test (da2502bd). BKL-012 and AGENT_EVENTS now record the source fix. Tests/typecheck/build/live multi-tenant validation remain NOT RUN.
constraints:
  database: "PostgreSQL 15+; no Supabase runtime dependency"
  secrets: "Never commit .env/.env.docker; use committed example templates only"
  source_of_truth: "GitHub main"
  clara: "Reuse Clara Core; do not modify Clara source"
  deployment: "Self-hosted Docker is the current deployment path"
  validation: "Runtime acceptance remains a later milestone; do not wait for CI/Vercel"
```

---


### Immediate runtime incident follow-up — 2026-10-09 (OPS-01)
The user supplied live logs showing missing `ai_provider_configs.model` and `email_sync_states.last_attempt_at`, and Redis lease command rejection. FIX-01 committed migration `0029_runtime_schema_reconciliation.sql` plus specific Redis error diagnostics. OPS-01 must pull latest `main`, apply migrations through `0029` to the exact PostgreSQL database used by the web and worker containers, roll out matching images, and inspect the Redis error reply. Correct Redis URL/AUTH/ACL/TLS from evidence; do not bypass the lease or allow uncoordinated worker polling. Runtime migration, Redis, and mailbox sync are not verified. This runtime follow-up is independent of the DEV-01 UI implementation queue; neither workstream should wait for CI/Vercel.



### DEV-01 RabbitMQ delivery coverage + Clara email-indexing adapter (2026-10-09)

- Added static source-contract assertions for bounded retries, preserved idempotency/correlation metadata, DLQ behavior, and retention of the original message when retry/DLQ publish confirmation fails (`59caaa69`).
- Audited the Clara Core knowledge reference. Its reusable ingestion worker is coupled to Clara's Next.js DB/provider/Qdrant modules and is not an importable host package API in this repository; immutable `ai-reusable-libraries/clara-core/source/**` remains reference-only. Added a thin host adapter that idempotently persists synced email into the existing `knowledge_documents` / `knowledge_chunks` PostgreSQL contract without direct Qdrant writes (`a4d77299`, `216161ff`).
- Corrected local host-runtime retrieval scope so org-shared documents are available to the org, agent-specific documents are visible only to that agent, and a no-agent request cannot see another agent's documents (`06970e93`). Added static source-contract assertions (`4fb56753`).
- Tests, typecheck, build, PostgreSQL, RabbitMQ, and live Clara retrieval/indexing are NOT RUN.
- Project-control record updates after the adapter: migration inventory `8eba7594`, DEV-01 worklog `9719d26d`, root worklog `7b34cba2`, session log `e214b40c`, and agent memory `dc048716`. The adapter writes searchable PostgreSQL knowledge chunks; semantic embedding/vector indexing is still not implemented because the current local Clara package exposes no reusable host indexing API and its embedding methods explicitly reject requests. Do not describe this as semantic/vector RAG or claim runtime success.

**Exact next action:** continue the Lovable UI migration from the existing route inventory, starting with Knowledge. Replace its hard-coded zero counts with organization-scoped persisted state only when the existing server/data contract is identified; preserve honest empty/loading/error states. Then Activity → Audit → Operations → Settings/provider settings → Login/Setup → agent detail/version/history → responsive/accessibility review. Continue without waiting for CI/Vercel. Keep RabbitMQ broker acceptance and semantic/vector indexing pending; route substantial defects to FIX-01 and infrastructure to OPS-01.

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 → FINAL APPROVAL. Phase 2 → APPROVED. |
| 2026-10-03 | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). |
| 2026-10-03 | ChatGPT review: CORRECTION REQUIRED (Findings A-D). |
| 2026-10-03 | Z.AI correction pass 1 (commit bf8dea7). 62 tests. |
| 2026-10-03 | ChatGPT review: FINAL CORRECTION required (4 items). |
| 2026-10-03 | Z.AI final correction (commit d4aa08b). 69 tests. |
| 2026-10-03 | ChatGPT review: owner trigger not transaction-safe; DELETE not covered; createOrganization public. |
| 2026-10-03 | Z.AI transaction-safe owner invariant (commit 4289e53). 91 tests. Vercel READY. Next: ChatGPT final acceptance. Z.AI must STOP. |


### ChatGPT takeover update — 2026-10-04
Before Phase 3 acceptance, perform runtime verification of the corrected migration. The latest code commit is 9fd34d1d69417302f2c8e31d0a453a0836533e27. Verify PostgreSQL migration syntax and owner/RLS behavior in CI or an equivalent PostgreSQL runtime. Do not authorize Phase 4 until evidence is green.


actor: "ChatGPT"
action: "Continue sequential product implementation without waiting for CI/Vercel validation"
then: "Complete provider adapters, sync/queue workers, Clara intelligence/RAG, agent tools/authorization, WhatsApp, scheduling, chat, realtime voice, observability/security, E2E, deployment, and final validation"
validation_policy: "Deferred until development completion by explicit project-controller instruction on 2026-10-04"
phase_4: "active"


### Development-first continuation update — 2026-10-04
Continue development-first execution. Next implementation focus: complete provider adapters and email account connection/runtime flows, then sync queues/workers, intelligence/RAG, agent runtime/tool registry, approvals, WhatsApp, scheduling, Clara chat/realtime voice, observability/security, E2E and deployment. CI/Vercel validation is a final milestone gate rather than a development blocker.
\n\n### Active development override — 2026-10-04\nContinue Phase 4 implementation directly under ChatGPT ownership. Do not pause development for GitHub Actions. CI verification is intentionally deferred until the code-change set is complete.\n

### Current Phase 4 action
Continue implementing the database foundation and security hardening. CI is intentionally disabled for automatic triggers. Do not stop implementation for CI; re-enable it only after the code-change set is complete.


## 2026-10-04 — ChatGPT runtime verification gate

- Main baseline: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes a successful-owner/transfer runtime script, and executes a negative ownerless-organization check.
- A dedicated PR was opened solely to trigger the verification workflow, but GitHub exposed zero workflow runs. The PR was closed without merge because it could not provide runtime evidence.
- Static inspection found the migration's PostgreSQL function quoting valid and the owner/RLS mechanisms structurally correct.
- **Phase 3 acceptance remains pending runtime evidence. Phase 4 remains unauthorized.**


### Docker verification tooling — 2026-10-05
Manual verification is now reproducible without relying on GitHub Actions: 
- `infra/docker-compose.verify.yml` provides disposable PostgreSQL 17.
- `scripts/migrate.sh` applies migrations and records SHA-256 checksums; modified applied migrations fail closed.
- `scripts/migration-changes.sh` checks applied migration files for drift.
- `scripts/verify-docker.sh` runs migration, drift, owner-invariant runtime checks, and expected ownerless-org rejection.
- `scripts/verify.sh` adds typecheck, tests, and both builds.
- CI delegates to the same `scripts/verify.sh` path, so local and CI verification share one implementation.


### 2026-10-05 continuation state
The next implementation target is Phase 5 Email Provider Abstraction completion: persist account connection state through the PostgreSQL repository, then implement Gmail/IMAP-SMTP/Zoho adapters sequentially. Runtime verification of the full migration set remains a required evidence gate, but it must not block source implementation under the current project-owner instruction.
\n 

### 2026-10-05 continuation
1. Wait for/inspect GitHub Actions runtime verification of the latest migration against PostgreSQL 17.
2. Confirm ownerless organization rejection, ownership transfer, final-owner deletion, and RLS helper creation in runtime evidence.
3. Configure Vercel external environment variables only from the user's real provider credentials; current Vercel project has zero environment variables, so do not deploy a false-configured runtime.
4. After Phase 3 acceptance, authorize Phase 4 database foundation work. Until then, Phase 4 remains NOT AUTHORIZED.

## 2026-10-05 — Infrastructure boundary and verification correction

- **Deployment infrastructure policy:** PostgreSQL, Redis, RabbitMQ, and Qdrant are external runtime dependencies; Docker Compose services are opt-in under the `local-infra` profile and are never started by the normal source verification path.
- **Verification policy:** `pnpm run verify` / `scripts/verify.sh` performs source/type/test/build checks only. `scripts/verify-docker.sh` is explicit opt-in disposable PostgreSQL verification.
- **Latest infrastructure correction:** `infra/docker-compose.verify.yml` now uses the actual `postgres` service hostname.
- **CI:** GitHub Actions uses its own disposable PostgreSQL service for runtime migration checks; this is CI infrastructure, not deployment provisioning.
- **Latest known Vercel status:** the Vercel status for the latest code is `failure` due to build-rate-limit; no READY claim is made.
- **Phase 4:** remains the active development phase under the project-owner development-first instruction. Runtime validation remains a release/acceptance gate, not a source-development blocker.


### 2026-10-05 ChatGPT takeover verification checkpoint
- Latest migration correction commit: `477cf8793111555cd33d00230c936a7617bd23d3`.
- Local Docker verification previously exposed invalid PostgreSQL function terminators; all remaining single-dollar terminators are now corrected.
- GitHub Actions rerun still terminates immediately with a generic failure and exposes no usable job log through the connected API. This is not treated as a passing runtime result.
- **Required acceptance evidence:** run `git pull --ff-only origin main` followed by `bash scripts/verify-docker.sh` locally. Expected final line: `Disposable PostgreSQL verification: PASS`.
- Phase 3 acceptance remains pending until that runtime check passes. Phase 4 remains NOT AUTHORIZED.


### 2026-10-05 — Immediate runtime gate
Pull latest `main` and rerun `bash scripts/verify-docker.sh`. The previous exit-code-3 bootstrap failure has been corrected. If it fails again, preserve the PostgreSQL logs before any further schema changes.


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


### 2026-10-05 — Active implementation checkpoint
- Database foundation is being hardened against actual PostgreSQL execution, with migration chain kept forward-only.
- Latest implementation: 0014 email connection metadata migration, PostgreSQL email repository/schema alignment, Gmail provider registration, and migration-test cleanup.
- Continue with Phase 5 email provider abstraction/runtime contracts next; do not claim Phase 4 acceptance until disposable PostgreSQL verification is green.


### 2026-10-05 — Authoritative product completion execution

ChatGPT is the sole active implementer. The user has explicitly requested complete menu-by-menu implementation with no placeholder controls.

Authoritative implementation sequence:
1. Shared Product UX/Runtime Foundation.
2. Agents — complete vertical slice.
3. Email Accounts.
4. Mail.
5. WhatsApp.
6. Agent Intelligence / Knowledge.
7. Automations & Schedules.
8. Chat.
9. Realtime Voice.
10. Settings / Organization / Members.
11. Activity / Audit / Operations.
12. Full E2E and production verification.

Current slice: **0 — Shared Product UX/Runtime Foundation**.

Rules for every slice: real persistence, server authorization, validation, loading/empty/error/retry states, user notifications, working buttons/actions, audit for sensitive mutations, tests, browser verification, accessibility, and no fabricated live data.

Detailed plan: docs/superpowers/plans/2026-10-05-product-completion-menu-plan.md

Do not advance to the next menu until the current menu's acceptance gate is green.


### ChatGPT takeover update — 2026-10-06
Continue Slice 1 Agents: resolve CI/runtime failures, then browser-verify create/edit/version/deploy/policy/channel flows. Only after Slice 1 acceptance move to Email Accounts.


### Verification hardening — 2026-10-06
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes transaction-level owner/RLS runtime verification, and asserts ownerless-organization rejection.
- SECURITY DEFINER helpers intentionally use `SET search_path = ''` with fully-qualified `public.*` table references; static tests now enforce this safer pinned path.
- Latest implementation commit: 5bcc9758f374de1d7187d2f9cd814d2589ecf081.
- Phase 3 acceptance remains pending until CI runtime evidence is green.


### 2026-10-06 — ChatGPT continuation
Continue product implementation without waiting on CI: harden Email Accounts provider connection flows next (Gmail OAuth state/PKCE, then IMAP/SMTP and Zoho), while preserving truthful configuration-required states. Keep runtime verification as the acceptance gate.


### 2026-10-06 active development continuation
Formal phase remains 4 until runtime acceptance. In parallel under the development-first directive, Phase 5 email provider abstraction work is being implemented. Next concrete provider-foundation work is capability/runtime contract completion, followed by Phase 4 runtime acceptance when CI infrastructure becomes observable.


## 2026-10-06 — Agents web build repair follow-up
- Agents web build source repair is committed on main.
- Pull main and rerun `bash scripts/manual-up.sh` to verify the corrected production build locally.
- Continue the next product-completion vertical slice after the Agents slice; CI/Vercel validation remains a later gate and does not block development.


### 2026-10-06 — ChatGPT continuation
- Latest implementation corrections: cross-tenant provider binding guard fixed in migration 0010; Gmail OAuth callback now validates state-cookie equality; Gmail accounts remain pending until encrypted credentials are stored successfully.
- Slice 1 Agents remains pending formal acceptance. Development-first implementation continues; no Vercel READY or CI PASS is claimed.
- Next product work remains Email Accounts provider connection hardening (Gmail, then IMAP/SMTP and Zoho), followed by Mail.


## 2026-10-06 — Gmail provider build blocker
- Fixed the worker TypeScript contract failure in Gmail adapter commit `418439093ae87ceb76a32709b371b7e772d8fd04`.
- Next: pull `main` and rerun `bash scripts/manual-up.sh`; if the worker passes, continue the next Email Accounts provider-foundation slice without waiting on CI/Vercel.


### 2026-10-06 — Gmail provider hardening
- Registered the real Gmail adapter in the canonical worker provider registry.
- Hardened Gmail OAuth credentials with proactive refresh before expiry and a single 401 retry refresh path, with concurrency de-duplication.
- Added adapter tests for expiry refresh and unauthorized-response recovery.
- **Next implementation focus:** generic IMAP/SMTP secure connection flow, validation, encrypted credential persistence, connection testing, and adapter registration; then Zoho OAuth foundation.


### 2026-10-06 — ChatGPT provider implementation checkpoint
- Gmail provider registration and OAuth token lifecycle hardening are implemented.
- Replaced the provider-neutral IMAP/SMTP mock registration with a real TLS-backed `ImapSmtpAdapter`.
- Added explicit IMAP/SMTP connection credentials (username, host/ports, TLS) and fail-closed plaintext transport rejection.
- Implemented authenticated IMAP folder discovery and secure SMTP authentication; credential secrets are retained only in adapter memory during an active connection and are cleared on disconnect.
- Remaining provider work: move persisted draft/message operations into the sync/runtime workers, add dedicated adapter tests and connection-test API/UI, then implement Zoho OAuth.
- Do not claim runtime provider connectivity without real provider credentials.


### 2026-10-06 — ChatGPT email provider continuation
- Fixed a duplicate SMTP helper that would have blocked the IMAP/SMTP worker build.
- Added dedicated IMAP/SMTP adapter tests and fail-closed protection against localhost/private-network targets to reduce SSRF risk from user-supplied mail hosts.
- Added Zoho OAuth PKCE start/callback with data-center-aware Accounts endpoints, encrypted credential persistence, state-cookie validation, and server-side authorization.
- Added the initial Zoho REST adapter foundation (OAuth refresh, account discovery, folders, labels, message listing) and registered it in the worker provider registry.
- **Next:** finish generic IMAP/SMTP persisted connection flow and adapter operations, then complete Zoho message/draft/send/search operations and webhook integration. Do not claim provider runtime connectivity without real credentials.


### 2026-10-06 — Agents implementation continuation
- Added persisted agent version JSON editing before immutable version creation.
- Added agent email/WhatsApp unbinding controls with audit events.
- Hardened repository channel binding against cross-organization email/WhatsApp account IDs.
- Slice 1 implementation is materially complete; formal acceptance remains pending tests/runtime/browser evidence.
- Per the project-owner development-first instruction, continue immediately with Slice 2 Email Accounts rather than waiting for CI/Vercel.

### Current development action — Slice 2 Email Accounts
Implement the real provider connection surface: secure IMAP/SMTP form and persistence, connection-test lifecycle, reconnect/disconnect/error recovery, capability/status display, and then finish Zoho runtime operations. Gmail OAuth remains configuration-required when server credentials are absent. No provider credentials are to be fabricated.

### 2026-10-06 — Active implementation checkpoint
ChatGPT is continuing Slice 2 directly. The IMAP/SMTP connect action was corrected so it no longer fails the action discriminator before reaching connection logic. A server-side TLS/authentication connection-test path is now being added before credentials are persisted, with SSRF-safe public-host resolution and no credential return to the browser. Next: add reconnect/retry/error-state controls and finish Zoho runtime operations. CI/Vercel remain non-blocking under the explicit development-first instruction.


## Current authorized action — Phase 4 (2026-10-06)

ChatGPT is the primary implementer. Continue Phase 4 Database Foundation and Migrations directly. GitHub Actions/Vercel completion is not required to continue implementation. Runtime PostgreSQL migration/RLS verification remains an acceptance requirement. Do not begin Phase 5 until Phase 4 is accepted.


### 2026-10-06 — Provider security continuation
ChatGPT continued Email Accounts provider hardening without waiting for CI/Vercel. Zoho OAuth callback and worker adapter now allow only HTTPS Zoho Mail regional API origins, preventing an untrusted `api_domain` from becoming a server-side request target. Added deterministic adapter security tests. Next provider work: complete connection-test/reconnect lifecycle and then proceed to Mail vertical slice after Email Accounts acceptance evidence is available.


### 2026-10-06 — active implementation checkpoint
- Agent version editor now persists the edited JSON configuration instead of silently creating an empty configuration.
- Version configuration has a server-side validation boundary and regression tests.
- Agent safety policy UI now exposes security-policy and rate-limit controls.
- Agent list now supports status filtering and robust create-network error handling.
- Continue development without waiting for CI or Vercel. Acceptance remains a separate gate.

### 2026-10-06 — Slice 1 agent completion continuation
- Added authorized per-agent audit history API and Activity UI.
- Added live organization WhatsApp account discovery/selection for agent channel binding; binding remains exactly-one-per-agent and cross-tenant guarded.
- Added strict server-side agent policy validation and regression tests.
- Latest implementation commit: bc31ded2df82e7a42b985343951381751504402b.
- Continue Slice 1 Agents with remaining UX/error-state/browser-verification work; do not advance to Email Accounts yet. CI/Vercel remain deferred validation gates under the explicit development-first instruction.


### 2026-10-06 — Agents implementation slice complete / acceptance pending
ChatGPT has completed the remaining source implementation for Slice 1 Agents: persisted list/search/status filtering, create/edit, immutable version configuration with explicit version selection, deploy/retire authorization, policy validation, organization-scoped email/WhatsApp bindings and unbinding, configuration simulation, audit history, notifications, and functional responsive channel navigation. Automated/runtime and browser verification remain acceptance evidence and are intentionally not blocking development.

### Current next implementation action — Slice 2 Email Accounts
Continue Product Completion Slice 2 — Email Accounts. Complete the persisted provider connection vertical slice in this order: connection status model/UI, Gmail OAuth state/PKCE and callback persistence, IMAP/SMTP secure connection form + worker connection verification, Zoho OAuth foundation and regional endpoint handling, connect/disconnect/reconnect lifecycle, connection-test results, truthful pending/error/retry states, folder/label discovery, agent assignment, authorization/audit, responsive UI, and tests. Do not fabricate provider connectivity without real user-owned credentials.


ChatGPT continued Slice 1 without waiting for CI/Vercel: repaired literal source-newline artifacts in the agent detail/repository files, made version selection explicit for deployment, improved configuration-test coverage to include WhatsApp binding validity, initialized the editor from the selected persisted version, and made overview channel actions functional. Slice 1 remains pending formal runtime/browser acceptance. Next implementation focus remains completing remaining Agent slice gaps before moving to Email Accounts.


### 2026-10-06 — Email Accounts implementation continuation
- Added server-side IMAP/SMTP reconnect/retry using the encrypted persisted credential record; credentials are decrypted only on the server and never returned to the browser.
- Email account UI now exposes reconnect/test actions by provider, capability badges, and persisted connection error messages.
- Hardened Zoho regional OAuth refresh routing so EU/IN/AU/CA/JP/SA accounts refresh against the matching regional Accounts endpoint instead of assuming the India/default endpoint.
- Added deterministic regression coverage for Zoho regional refresh routing.
- Provider credentials remain configuration-dependent; no live provider connection is claimed.

### Current next implementation action — Email Accounts
Continue Email Accounts with provider lifecycle completion: OAuth reconnect/error handling for Gmail/Zoho, IMAP/SMTP reconnect UI refinement, capability/status refresh, folder/label discovery persistence, agent assignment UX, and provider contract/runtime tests. Then proceed to Mail.


### 2026-10-06 — Current implementation checkpoint
Continue Product Completion Slice 2 — Email Accounts. Finish provider lifecycle hardening and persistence: validate Gmail/Zoho OAuth reconnect idempotency, complete worker-backed folder/label discovery persistence, finalize provider contract tests and truthful error/retry states, then proceed to the Mail vertical slice. Do not fabricate provider connectivity without real user-owned credentials.


### 2026-10-06 — Capability truthfulness correction
- Aligned persisted IMAP/SMTP and Zoho capability metadata with the operations actually implemented by their adapters; unsupported draft/send/forward/attachment operations are no longer advertised as available.
- Gmail remains the fully advertised provider surface where its adapter implements the corresponding contract.
- Latest code commit: be4925cbd3e73ebeec28a951a5d062d70fba19ae.
- Runtime/browser verification remains deferred and no live provider connection is claimed.


### 2026-10-06 — Slice 2 Email Accounts lifecycle hardening
- IMAP/SMTP connection persistence is now idempotent by organization/provider/address; reconnect updates the existing record instead of creating duplicates.
- Credential-save failure transitions the account to `error` rather than leaving a misleading pending record.
- Gmail and Zoho OAuth callbacks now remain `pending` until worker verification/discovery rather than falsely claiming runtime connectivity.
- Email Accounts UI now distinguishes connected vs total records and reports OAuth/IMAP states truthfully.
- Next implementation: wire worker-backed folder/label discovery persistence into the account lifecycle, then finish provider contract/runtime tests and Mail vertical slice.


### 2026-10-06 — Active provider implementation checkpoint
ChatGPT continues Slice 2 Email Accounts under the development-first directive. Provider registry/runtime alignment is being hardened, folder/label discovery persistence is in place, Gmail/IMAP-SMTP/Zoho adapters are registered, and truthful credential-required states remain mandatory. Next concrete implementation: complete provider runtime contract tests and persisted discovery/status lifecycle, then finish Email Accounts UI acceptance work before moving to Mail. CI/Vercel results remain deferred validation gates and are not a development blocker.


### 2026-10-06 — Slice 2 provider lifecycle continuation
ChatGPT completed another Email Accounts hardening pass: folder/label discovery is now an atomic replacement snapshot, successful worker discovery persists runtime capabilities and connected status, discovery failures become explicit account errors, and IMAP/SMTP/Zoho capability metadata is truthful to the implemented adapter surface. Continue the Mail vertical slice after Email Accounts implementation is complete; runtime acceptance remains a separate gate.

### 2026-10-06 — Email repository correctness hardening
- Corrected the PostgreSQL email account repository status mapping to match the canonical enum (pending, connected, error, disconnected, revoked); legacy active/expired assumptions were removed.
- Normal account reads/listing/config/capability/status updates now exclude soft-deleted records.
- Restoring a mailbox clears stale connection errors and records connected_at when appropriate.
- Added regression coverage in apps/web/tests/email-account-repository-contract.test.ts.
- Continue Email Accounts provider contract/runtime hardening; then proceed to Mail. No CI/Vercel wait and no fabricated provider credentials.


### 2026-10-06 — ChatGPT active implementation checkpoint
Email Accounts provider lifecycle continuation: complete truthful provider contract/runtime coverage, persisted folder/label discovery lifecycle, OAuth reconnect/error handling, agent assignment UX, then start Mail vertical slice. Do not fabricate provider connectivity.


### 2026-10-06 — OAuth reconnect hardening
- Gmail and Zoho reconnect flows now carry an optional signed target `accountId` through OAuth state.
- OAuth callbacks validate the target account belongs to the same organization and provider before updating persisted credentials, preventing reconnect from silently creating/updating the wrong mailbox.
- Mail Accounts UI now passes the selected account identity for Gmail/Zoho reconnect.
- Added regression coverage for Gmail reconnect-state binding without network access.
- Latest implementation commit: `242396815fadb6495e7f9c766ef6b17d6c52a53b`.
- Next implementation: complete persisted folder/label discovery and provider lifecycle runtime, then begin Mail vertical slice. Validation remains a later acceptance gate under the active development-first instruction.


### 2026-10-06 — Mail vertical slice active
The Email Accounts implementation has advanced through provider lifecycle, credential persistence, reconnect/disconnect, capability truthfulness, folder/label discovery, and OAuth foundations. Under the development-first instruction, continue into the Mail slice now: persisted inbox/thread reads, organization-scoped search/filtering, message detail, then read/unread/archive/move/labels, drafts, reply/forward, attachments, and approval-safe send flows. Do not show fabricated messages. Runtime CI/Vercel remain acceptance evidence and are not a development blocker.

Current implementation commits: 792213ab7219623df2452e5d32e9de2c87120d02.


### 2026-10-06 — Email Accounts lifecycle implementation continuation

ChatGPT implemented the next provider lifecycle slice on `main`:
- Added a single-connection provider verification helper with guaranteed cleanup.
- Refactored mailbox folder/label discovery to use the verified live provider connection and persist replacement snapshots plus connected/error state.
- Added organization-scoped mailbox structure API returning persisted folders, labels, and assigned agents without credential fields.
- Added mailbox UI inspection for folders/labels and current agent assignments.
- Added provider capability contract tests and lifecycle/static coverage.
- No live Gmail/Zoho/IMAP credentials were used; no provider connection success is claimed.
- Latest implementation commit: `105d41481d9523bda66b0f6ae147e73fff1c3c46`.
- Slice 2 remains under development; validation is deferred and Phase/menu acceptance is not claimed.
\n\n### 2026-10-06 — Email Accounts truthfulness hardening
- Removed synthetic discovery timestamps from the mailbox structure API/UI; the interface now reports only that a persisted snapshot exists.
- Provider verification remains single-connection with guaranteed cleanup.
- Latest implementation commit: `ee2bba7c696e2ed9672c7ff7281e0a1658951798`.
- Continue Email Accounts implementation/contract hardening under development-first mode; do not wait for CI/Vercel.


### 2026-10-06 — ChatGPT continuation
Continue Slice 2 — Email Accounts. The provider registry/capability contract and mailbox discovery lifecycle are now hardened. The next implementation focus is the remaining account connection UX/runtime path: provider-specific connection/reconnect error states, persisted discovery refresh behavior, account/agent assignment visibility, and deterministic API/UI coverage. Do not wait for CI/Vercel; runtime/browser evidence remains acceptance-only.


OAuth failure paths now return users to `/mail/accounts` with a bounded, non-secret provider error message, and the account UI consumes/clears that state. Continue with deterministic account API authorization/error coverage and remaining Email Accounts UX before moving to Mail.


A source-integrity defect in the email account API was corrected (literal `\\n` text had entered the TypeScript source). Deterministic coverage now guards against it. Continue remaining Email Accounts API/UI work; then move to Mail only after the slice implementation is complete.


### 2026-10-06 — Mail schema/runtime continuation

ChatGPT corrected the persisted Mail repository to match the canonical 0003 email-domain schema (from_email/from_name, to_recipients, is_sent, sanitized body, attachment existence) and added regression tests for organization scoping and parameterized search. No provider mutation is claimed yet.

**Next implementation:** complete the Mail vertical slice with persisted message mutation APIs (read/unread, draft create/update/delete, provider-aware send/reply/forward behind deterministic authorization/approval), thread actions, audit events, and polished loading/error/empty states. Do not fabricate provider connectivity or bypass approval for sensitive outbound actions.
### 2026-10-06 — Mail vertical continuation

ChatGPT continues development-first Mail implementation without waiting for CI/Vercel. Completed the next persisted mail slice: organization-scoped read/unread mutation with audit, a persisted local draft repository/API, autosaving compose UI, and an inbox Compose entry point. No provider send is simulated. Next implementation target is real thread/message mutations and provider-backed draft/send orchestration, with approval boundaries preserved.


### 2026-10-06 — Mail mutation continuation
- Added organization-scoped persisted archive/move operations backed by mailbox folders, with fail-closed partial-update handling.
- Added authorized folder mutation API and responsive inbox Archive/Move controls; folder lists are filtered by the same mailbox account.
- Added deterministic contract tests for organization scoping and authorization.
- Added lightweight thread-header action polish without fabricating provider state.
- **Next implementation:** finish provider-aware draft/reply/forward/send orchestration with approval-safe outbound actions, then complete message/thread action UX and attachment handling before Mail slice acceptance.

### 2026-10-06 — Mail slice implementation continuation
ChatGPT is continuing the Mail vertical slice under the development-first override. Corrected a parameterization defect in organization-scoped inbox sender search and repaired escaped-newline source corruption in the inbox client. Next implementation: complete thread actions (read state, reply-draft persistence, archive/move UX) and then provider-backed send/approval wiring without fabricating live credentials. CI/Vercel remain acceptance gates, not development blockers.


Email Accounts lifecycle is now materially complete enough to enter Mail implementation. Continue Mail with approval-safe provider actions: persisted draft/reply/forward/send action requests, deterministic approval/rejection transitions, worker-only credential access and provider execution, then finish thread/message UX and attachment handling. Do not fabricate provider connectivity. CI/Vercel remain non-blocking under the development-first override.


### 2026-10-06 — Mail thread/action continuation
ChatGPT completed the next Mail implementation slice: authorized persisted thread API/page, read-state interaction in thread view, approval-safe reply request flow, pending approval API, and a responsive approval queue with approve/reject actions. Sensitive approval still does not execute provider calls in the browser. Next: draft deletion/update hardening, provider-backed draft result synchronization, forward UX, and secure attachment retrieval/handling. Continue without waiting for CI/Vercel.


### 2026-10-06 — Mail draft/action continuation
ChatGPT continued the Mail vertical slice without waiting for CI/Vercel. Persisted draft lifecycle is now organization-scoped end-to-end: list, retrieve into compose, autosave/update, authorized delete, audit, and responsive Drafts UI. Thread Forward now creates an explicit approval-gated sensitive action. Added deterministic contract coverage for draft lifecycle and forward authorization. No provider connectivity or send success is fabricated.

**Next implementation:** complete provider-backed draft result synchronization and secure attachment retrieval/handling, then finish Mail message/thread action UX before Mail slice acceptance. Keep all outbound provider execution worker-only and approval-gated.

### 2026-10-06 — Email Accounts continuation

Implemented the bounded provider retry layer and wired it into verified provider connect/discovery. Credential/authentication failures fail immediately; transient 408/429/5xx/network/TLS failures retry with capped exponential backoff. Added lifecycle tests for retry limits and guaranteed disconnect cleanup. Mailbox discovery remains persisted and truthful: accounts stay pending until a worker performs live verification/discovery.

Next implementation focus: finish deterministic Email Accounts lifecycle/source coverage, then begin the Mail vertical slice (provider-backed mailbox structure/sync boundary) without waiting for CI/Vercel.

\n\n### 2026-10-06 — Mail provider draft synchronization continuation\nContinue Product Completion Slice 2 — Mail. Complete provider-backed draft synchronization and secure attachment retrieval/handling, then finish message/thread action UX. Provider execution remains worker-only and credential-free in browser/API paths. Do not fabricate live provider connectivity. CI/Vercel are acceptance gates, not development blockers under the explicit development-first override.\n

### 2026-10-06 — Mail provider draft/attachment implementation checkpoint
- Implemented worker-owned provider draft synchronization with encrypted credential access, capability gating, audit events, and persisted provider draft sync status.
- Updated approved-send execution to reuse an already synchronized provider draft and persist the resulting provider message ID, preventing duplicate provider draft creation.
- Added worker-only attachment retrieval with organization/message ownership checks, provider capability gating, credential isolation, configurable size limits, and SHA-256 integrity metadata.
- Added worker security regression coverage for these boundaries.
- **Next concrete implementation:** expose the draft synchronization lifecycle through the existing Mail UI/API and implement attachment metadata/download UX backed by a safe object-storage boundary. Keep provider execution worker-only and do not fabricate live connectivity.


### 2026-10-06 — Local runtime startup correction
- Local typecheck passed for shared, DB, worker, and web; Clara Core structural-check messages remain intentionally skipped.
- Local Docker image builds completed for both web and worker.
- Runtime startup exposed two real defects: a duplicate Mail dynamic route used `[id]` alongside `[threadId]`, and the DB package exported a missing `email/connection-test` module.
- Corrected both directly on `main`: restored the TLS/SSRF-safe IMAP/SMTP connection-test module and removed the duplicate `[id]` Mail thread route.
- No provider connectivity is claimed and no credentials were used.
- **Next:** pull `main`, rerun `bash scripts/manual-up.sh`, then inspect container logs. If runtime is clean, continue exposing provider-backed draft synchronization and secure attachment metadata/download UX through Mail UI/API.


### 2026-10-06 — Development-first continuation: Mail to WhatsApp

Completed the concrete Mail follow-up: provider draft synchronization request/status UI, worker polling/execution, approval-safe send/reply/forward provider execution, organization-scoped attachment metadata, and secure attachment download boundary with scan/integrity/path checks.

Development now continues into the WhatsApp vertical slice without waiting for CI/Vercel. Next implementation focus: harden the WhatsApp account schema boundary, implement Meta webhook verification/idempotent inbound persistence, worker-backed outbound text execution, exactly-one WhatsApp account per agent binding, conversation UI, and truthful configuration-required/error/retry states. No provider success is fabricated without real credentials.


### 2026-10-06 — WhatsApp runtime continuation

WhatsApp foundation is now implemented: organization-scoped account persistence/configuration, encrypted Meta credentials, worker-side account verification, signed/idempotent webhook ingestion, inbound message persistence, worker-owned outbound Meta execution, queued outbound API, and conversation UI. A forward-only `0016_whatsapp_schema_reconciliation.sql` migration reconciles the legacy 0002 WhatsApp schema with the richer 0004 runtime contract.

Next implementation: harden webhook status updates/media handling, enforce exactly-one WhatsApp account binding per agent in runtime APIs/UI, add agent-command routing from inbound WhatsApp messages, then continue Automations/Schedules. Do not wait for CI/Vercel and do not fabricate provider connectivity.


### 2026-10-06 — Worker typecheck correction checkpoint
- Local worker typecheck exposed five source-level contract issues in the Mail/WhatsApp worker boundary: unsafe credential casts, impossible reply/forward narrowing caused by a duplicate discriminator branch, unchecked attachment content, an incorrect provider draft worker import path, and untyped Meta Graph response payloads.
- Corrected these directly on `main` without changing provider behavior or fabricating credentials.
- Correction commits: `2197d89`, `9c99421`, `c19783c`, `649a59b`.
- **Next:** pull `main` and rerun `npm run typecheck`. If worker typecheck is clean, continue the active WhatsApp vertical slice: webhook status/media handling, exactly-one account binding per agent, inbound agent-command routing, and truthful configuration-required/error/retry states. Do not wait for CI/Vercel.


### 2026-10-06 — WhatsApp send response typing correction
- The next local typecheck exposed one remaining untyped Meta Graph JSON response in the WhatsApp outbound-send path; the account-verification response was already typed.
- Corrected the outbound response to use the same `WhatsAppGraphPayload` boundary.
- Commit: `ee9d302`.
- **Next:** pull `main` and rerun `npm run typecheck`; continue the active WhatsApp implementation after the worker typecheck is clean. Do not wait for CI/Vercel.


### 2026-10-06 — WhatsApp hardening + Scheduling/Automation implementation continuation
- Hardened WhatsApp provider status handling (sent/delivered/read/failed), monotonic status transitions, provider error persistence, sanitized media metadata, and inbound routing to explicitly bound agents.
- Added migration 0017 for WhatsApp routing/status lifecycle and shared-number-safe provider message identity.
- Replaced static Automations and Schedules pages with persisted PostgreSQL-backed workspaces and organization-authorized CRUD APIs.
- Added migration 0018 with schedule timezone, catch-up window, last-error fields, and durable runtime indexes.
- Next concrete implementation: build the worker-side durable scheduler tick and automation trigger evaluator, then connect scheduled/automation executions to the shared agent execution boundary. Do not wait for CI/Vercel.


### 2026-10-06 — WhatsApp web typecheck correction

The latest local web typecheck exposed three source-level typing defects in the WhatsApp slice: a provider-error payload expression inferred too broadly in the webhook route, unchecked first-account access in the client, and a computed form-field key inferred as string/boolean. Corrected all three directly on `main` without changing provider behavior or fabricating connectivity.

- Webhook provider errors are normalized to bounded strings before persistence.
- Account selection now guards the first account explicitly.
- Credential form fields use a typed `as const` field definition, eliminating unsafe computed-key inference.
- Correction commits: `f16b0d0`, `07ad3c0`.
- **Next:** pull `main` and rerun `npm run typecheck`; if the web package is clean, continue the active durable scheduler tick and automation trigger evaluator. Do not wait for CI/Vercel.


### 2026-10-06 — Durable scheduler/automation execution boundary
Implemented the next active Phase 4 runtime slice: durable scheduled-job claiming with PostgreSQL row locking, scheduled run lifecycle persistence, timezone-aware five-field cron calculation, worker scheduler polling, an event-driven automation trigger evaluator, and a single worker-owned agent execution dispatch boundary. Unsupported execution is reported as configuration-required rather than fabricated. Added worker unit coverage for cron and automation matching.

**Next concrete implementation:** wire real agent execution into the shared Clara-backed runtime boundary, then connect scheduler/automation dispatch to approved email/WhatsApp actions and add event emission from the existing provider workers. Continue without waiting for CI/Vercel.


### 2026-10-06 — Clara-backed execution continuation
Clara-backed agent execution is now wired through the worker-owned dispatcher. The next implementation is to connect concrete execution results to product actions: scheduled summaries/outbound WhatsApp, approval-safe email actions, and automation event emission from existing Mail/WhatsApp workers. CI/Vercel remain non-blocking under the development-first instruction.


### 2026-10-06 — Worker typecheck correction: scheduler + Clara imports

The latest local typecheck exposed source-level cron narrowing errors in `apps/worker/src/scheduling/cron.ts` and worker compilation was also traversing the Clara package source with unresolved `@/modules/*` aliases. Corrected the cron candidate/parser narrowing and changed Clara host-package re-exports to resolve the immutable vendored Clara source through stable relative paths. No Clara vendor source was modified and no provider connectivity is claimed.

Correction commits: `63e5240`, `fbd6c8a`, `3b47247`.

**Next:** pull `main` and rerun `npm run typecheck`; continue implementation regardless of CI/Vercel. If typecheck is clean, wire scheduler/automation execution results to concrete approved Email/WhatsApp actions and event emission from existing workers.


### 2026-10-06 — Follow-up typecheck correction

The next local typecheck showed two remaining classes of diagnostics: strict indexed-access narrowing in the cron matcher and unresolved Clara git-submodule imports during host worker compilation. Cron field/range indexing is now explicitly narrowed. The Clara adapter remains a structural boundary when the optional `vendor/clara` git submodule is not initialized; unresolved submodule re-exports are explicitly suppressed at that boundary rather than replacing or modifying Clara source. Runtime Clara integration still requires the pinned submodule checkout when that feature is exercised.

Correction commits: `dd9786c`, `7a7e872`, `979c341`.

**Next:** pull `main` and rerun `npm run typecheck`. Continue the scheduler/automation execution implementation; do not wait for CI/Vercel.


### 2026-10-06 — Typecheck boundary correction (continued)

The local checkout still has no resolved `vendor/clara` source, so `@ts-expect-error` was inappropriate because the structural-only Clara package check reports the directive itself as unused while also reporting the unresolved import. The host adapter boundary now uses `@ts-ignore` specifically for this optional-submodule condition. Cron field ranges are explicitly typed as fixed tuples so strict indexed access cannot produce undefined range bounds.

Correction commits: `161b8e0`, `7af6e77`, `338a735`.

**Next:** pull `main` and rerun `npm run typecheck`; continue implementation regardless of CI/Vercel state.


### 2026-10-06 — Concrete scheduled/automation product actions

ChatGPT continued development-first execution past the verification gate. Clara execution now flows into a worker-owned product action boundary: scheduled/automation payloads can queue outbound WhatsApp text through the existing worker queue or create approval-gated email actions without fabricating a user actor or sending from the browser. Agent-to-WhatsApp account resolution is organization-scoped and reuses the existing exactly-one binding model. The next implementation is inbound WhatsApp agent-command execution and event emission from Mail/WhatsApp workers, followed by the Clara chat/realtime voice product surface. Do not wait for CI/Vercel.


### 2026-10-06 — WhatsApp inbound agent execution
Implemented the next concrete WhatsApp runtime slice without waiting for CI/Vercel: durable routed-to-processing-to-completed/failed inbound claiming with PostgreSQL row locking, worker-side Clara agent execution for inbound text commands, automatic reply queuing to the originating WhatsApp contact, and whatsapp.received automation event emission. Added whatsapp as an explicit agent execution source. No live provider success is claimed.

**Next concrete implementation:** advance the Clara chat/realtime voice product surface and shared conversation persistence, then connect voice/chat actions to the same approval-safe Email/WhatsApp execution boundary. Continue development without waiting for CI/Vercel.


### 2026-10-06 — Chat/realtime continuation is active. The Clara chat surface is now implemented at `/chat` with persisted conversations, SSE streaming, agent-scoped conversation switching, and navigation/dashboard entry points. The next concrete implementation is the realtime voice session boundary: expose a host-authorized server transport around Clara `startRealtimeSession(ctx)`, persist voice session metadata/telemetry, and connect the UI to interruption-safe streaming without duplicating Clara provider logic. Continue without waiting for CI/Vercel.


### 2026-10-06 — Realtime voice implementation continuation
actor: "ChatGPT"
action: "Continue the Clara realtime voice vertical slice. Implement the provider transport handshake adapter behind the resolved Clara session endpoint, then wire browser microphone/transcript state to persisted voice session and telemetry boundaries."
constraints: "Reuse Clara realtime architecture; do not modify Clara source; no provider API keys in browser; no fabricated live connectivity; CI/Vercel remain non-blocking under the development-first override."


### 2026-10-06 — Worker typecheck correction: product actions + cron + DB export

After pulling main at `e415700`, the worker typecheck exposed three source-level regressions introduced by the concrete product-action boundary: the WhatsApp agent-account repository helper was not re-exported from `@ai-comms-agent/db`, product-action results were inferred as generic records instead of the shared `ProductActionResult` contract, and strict indexed access still widened cron field ranges to `number | undefined`. Corrected these directly on `main` without changing provider behavior or Clara source.

Correction commits: `ea1ffbd`, `2a9b030`, `45b4974`.

The remaining Clara package diagnostics are the intentional optional vendored-submodule structural boundary; the web package SIGKILL is resource/process termination rather than a reported source diagnostic. Continue development-first implementation without waiting for CI/Vercel.

**Next concrete implementation:** continue the Clara realtime voice surface already started at `/api/voice/session`: harden host-owned voice session lifecycle/telemetry and connect the voice UI to the host-authorized Clara transport boundary. Do not duplicate Clara provider logic or fabricate live provider connectivity.


### 2026-10-06 — Realtime voice transport continuation
- Added host-authorized voice session PATCH actions for activation, turn counting, and telemetry.
- Voice UI now requests microphone access, exposes microphone/transport state, records browser telemetry, and closes the session on microphone failure.
- No provider connection is claimed; Clara remains the owner of realtime transport/reconnect/cancellation.
- **Next:** implement the thin browser/Clara transport adapter contract and interruption-safe transcript event bridge.


### 2026-10-06 — Clara realtime voice boundary continuation
- Added the authorized `/api/voice/turn` transcript bridge through the immutable Clara runtime.
- Added interruption-safe browser turn sequencing, microphone lifecycle handling, and persisted browser turn-latency telemetry.
- Added a shared `VoiceTransportAdapter` contract and sequence-safety helper; this defines the host/browser boundary without reimplementing Clara provider transport.
- No provider credentials or live connectivity are fabricated.
- **Next:** Settings / Organization / Members vertical slice.


### 2026-10-06 — Settings slice continuation
- Organization settings and member management are now persisted and authorization-aware.
- Owner changes use the invariant-safe transfer path; direct owner demotion is blocked.
- **Next:** Activity / Audit / Operations surfaces.


### 2026-10-06 — Activity / Audit continuation
- Added organization-wide audit querying with authorization-aware API access.
- Replaced synthetic Audit and Activity UI with persisted PostgreSQL-backed event surfaces, filtering/loading/error/empty states.
- **Next:** final cross-surface product hardening and E2E/deployment preparation; validation remains deferred under the active development-first instruction.


### 2026-10-06 — Activity/Audit/Operations implementation continuation
- Added server-side audit filtering for event type, decision, actor, search and time bounds.
- Added authorized JSON/CSV audit export.
- Added organization-scoped Operations API with PostgreSQL runtime check, configured infrastructure signals, persisted email/sync/voice/schedule/authorization metrics, and an Operations workspace.
- Added Operations navigation and removed the fake static “Core online” indicator.
- **Next implementation:** cross-surface E2E hardening: email → AI → approval → send, WhatsApp routing, scheduling, chat/voice, organization isolation, and sensitive-action audit/idempotency coverage. Validation remains deferred under the development-first instruction.


### 2026-10-07 — Worker typecheck regression correction

- Pulling `main` at `cff1eab` exposed two worker source regressions: `ProductActionResult` was defined but not re-exported from `@ai-comms-agent/shared`, and strict indexed tuple access in the cron matcher still produced `number | undefined` under the worker compiler settings.
- Corrected only those host boundaries; Clara source and provider behavior are unchanged.
- The remaining Clara unresolved-module diagnostics are the intentional optional vendored-submodule structural check. The web typecheck SIGKILL is still a process/resource termination with no reported source diagnostic.
- **Next:** continue final cross-surface hardening, with realtime voice host transport/session lifecycle as the active implementation surface; do not wait for CI/Vercel.


### 2026-10-07 — Voice/session authorization hardening

- Corrected the remaining worker cron strict-indexing regression by binding minute/hour/day/month/weekday to named values before field matching.
- Hardened voice session PATCH/DELETE lifecycle operations so an authenticated organization member can mutate only their own persisted voice session.
- Hardened the voice turn endpoint so the requested turn must belong to the authenticated user and the exact requested agent; ended sessions are rejected before Clara execution.
- Clara realtime/provider logic remains untouched; the host continues to own authorization and persistence while Clara owns realtime generation/transport policy.
- **Next:** continue cross-surface hardening and deterministic E2E coverage around email/WhatsApp/scheduling/chat/voice, then prepare final runtime/deployment verification without waiting on CI/Vercel.


## 2026-10-07 — Worker strict-indexing correction follow-up

- Local typecheck still reported `TS2322` in `apps/worker/src/scheduling/cron.ts` because cron range destructuring under strict indexed access inferred `a`/`b` as possibly undefined.
- Corrected range parsing to validate the two-part shape before numeric conversion.
- Commit: `51cdfb824fd0a3e34426db03c67c76db31557155`.
- Clara optional vendored-source diagnostics remain an intentional structural-check boundary when `vendor/clara` is not initialized.
- Continue final cross-surface authorization/idempotency/error hardening and deterministic E2E coverage; do not wait for CI/Vercel.


### 2026-10-07 — Cross-surface idempotency continuation
- WhatsApp outbound now accepts a stable `Idempotency-Key` header and preserves that key through client retries.
- Continue with deterministic cross-surface E2E fixtures and sensitive-action idempotency/audit coverage, then deployment/runtime preparation.
- CI/Vercel remain deferred validation gates under the active development-first instruction.


### 2026-10-07 — Audit trace continuation
- Sensitive cross-surface execution now persists `correlation_id` through the audit repository, including agent execution → email approval and WhatsApp outbound paths.
- Continue deterministic E2E fixture coverage for email → approval → send, WhatsApp routing, scheduling, chat/voice, cross-organization isolation, and duplicate-action behavior.
- Do not wait for CI/Vercel; verification remains deferred until the development set is complete.


### 2026-10-07 — Cross-surface hardening continuation

ChatGPT continued the final product-completion implementation without waiting for CI/Vercel. Email sensitive-action creation now supports organization-scoped idempotency keys through the Idempotency-Key header/body fallback, backed by a PostgreSQL partial unique index and conflict-safe repository insert. Added deterministic cross-surface contract coverage for email approval, WhatsApp outbound idempotency, scheduling/automation authorization, voice-session binding, and audit correlation persistence.

**Next concrete implementation:** complete remaining cross-surface action correlation/idempotency propagation into worker execution and deterministic E2E fixtures for duplicate email approval, duplicate WhatsApp outbound, scheduled execution, organization isolation, and sensitive-action audit trails. Then prepare final runtime/deployment verification. Do not wait for CI/Vercel.

### 2026-10-07 — Execution correlation propagation
- Persisted correlation IDs for email approval actions and WhatsApp messages via migration 0019.
- Agent product actions now pass the originating execution correlation into email approvals and WhatsApp outbound queue records.
- Email action worker and WhatsApp outbound worker now preserve correlation IDs in completion/failure audit events.
- WhatsApp inbound messages receive a UUID correlation ID and reuse it as the agent execution ID, avoiding invalid non-UUID audit correlation values.
- Audit read models now expose correlationId consistently.
- **Next:** continue deterministic cross-surface E2E fixture implementation and sensitive-action duplicate/idempotency coverage, then prepare final runtime/deployment verification. CI/Vercel remain non-blocking.


### 2026-10-07 — ChatGPT development continuation

Development-first execution continues without waiting for GitHub Actions or Vercel. The current product-completion target remains cross-surface hardening rather than a new menu: email approval/send idempotency and correlation, WhatsApp outbound/inbound correlation, durable scheduling/automation execution, Clara chat/voice authorization, organization isolation, and audit trace continuity. Runtime/deployment evidence is intentionally deferred to the final verification milestone.

**Next implementation:** finish deterministic cross-surface scenario fixtures and close remaining duplicate-action/idempotency edge cases, then continue final product completion work across any remaining Mail/WhatsApp/Chat/Voice gaps before the final runtime/deployment milestone.


### 2026-10-07 — Idempotency conflict hardening
- Email action creation now treats an existing organization-scoped Idempotency-Key as the same request only when mailbox, action type, draft, and content hash match.
- A conflicting payload using the same key is rejected instead of silently returning the original action.
- Added deterministic contract coverage for the conflict behavior.
- **Next:** continue remaining cross-surface duplicate-action/E2E fixture hardening, then final product-completion implementation before runtime/deployment verification. Do not wait for CI/Vercel.


### 2026-10-07 — Scheduled execution duplicate protection
- Added forward-only migration `0021_scheduled_run_idempotency.sql` with a unique `(scheduled_job_id, fire_at)` index.
- Scheduler claims now persist `fire_at` and use `ON CONFLICT DO NOTHING` so the same scheduled fire cannot create duplicate runs under concurrent worker claims.
- Added deterministic scheduling idempotency contract coverage.
- **Next:** continue remaining deterministic cross-surface fixtures and duplicate-action coverage for email approval, WhatsApp outbound, scheduled/automation execution, organization isolation, and audit traces. CI/Vercel remain non-blocking.

### 2026-10-07 — Deterministic E2E fixture foundation
- Added stable UUID fixtures and scenario definitions for email approval/send, WhatsApp outbound duplicate handling, scheduled execution duplicate protection, organization isolation, and audit trace continuity.
- These fixtures are deterministic inputs for the final cross-surface E2E runner; they do not claim runtime verification.
- **Next:** connect the fixture scenarios to the application's integration/E2E harness and close any remaining duplicate-action, isolation, and audit edge cases before final runtime/deployment verification.


### 2026-10-07 — Deterministic E2E harness connected
- Added `apps/web/src/e2e/cross-surface-harness.ts`, an injected-operation harness that executes the stable scenario definitions without fabricating provider/runtime success.
- Added `apps/web/tests/cross-surface-harness.test.ts` to lock scenario IDs and stable idempotency keys and prove the harness propagates them through ordered steps.
- **Next implementation:** connect the harness to real application integration adapters for email approval/send, WhatsApp outbound, scheduler claims, organization isolation, and audit correlation. Continue remaining product hardening without waiting for CI/Vercel.


### 2026-10-08 — Cross-surface continuation
- WhatsApp outbound now preserves a generated correlation ID into the durable outbound queue record and the enqueue audit event.
- Idempotent WhatsApp retries now return the existing message ID for the same valid payload instead of returning an ambiguous null result.
- Added contract assertions for correlation propagation and retry identity.
- **Next:** continue connecting the deterministic E2E scenarios to real application adapters, with focus on email approval/send, scheduler claim execution, organization isolation, and audit trace continuity. Do not wait for CI/Vercel.
\n\n### 2026-10-08 — Automation idempotency hardening\nImplemented durable automation event deduplication. `automation_runs` now accepts an optional `trigger_event_key` with a partial unique index per automation rule; the worker derives deterministic keys from eventId/messageId/actionId/correlationId and skips duplicate deliveries. This prevents webhook/provider retry storms from executing the same automation twice. Continue next with remaining cross-surface communication-loop hardening.\n

### 2026-10-08 — Chat authorization hardening
The persistent Chat stream now resolves a supplied conversation through an organization + agent scoped database lookup before reading history or invoking Clara. A conversation ID from another agent in the same organization is rejected instead of being trusted from the browser. Continue with remaining cross-surface authorization and retry/error hardening. 


### 2026-10-08 — Deterministic cross-surface scenario runner
ChatGPT connected the PostgreSQL cross-surface adapter to an executable scenario runner and added deterministic runner coverage. The runner now exercises approval idempotency, WhatsApp outbound idempotency, scheduled-job claiming, organization-isolation assertions, and correlation-scoped audit continuity without fabricating provider delivery.

**Next concrete implementation:** harden sensitive-action worker execution/error routing and make provider execution outcomes flow back into the same correlation/audit boundary. Continue without waiting for CI/Vercel.


### 2026-10-08 — Sensitive-action provider outcome routing
ChatGPT connected email and WhatsApp worker success/failure outcomes to the worker-owned automation event bridge. Provider outcomes now carry stable action/message identifiers and correlation IDs into automation evaluation while retaining existing audit writes. No provider credentials or external delivery are fabricated.

**Next concrete implementation:** complete failure/retry semantics for sensitive actions and deterministic audit/event assertions, then continue the remaining communication-loop hardening.


### 2026-10-08 — Provider retry/failure hardening completed
- Shared provider retry policy now exposes deterministic retry telemetry (attempt, nextAttempt, delayMs).
- Email action failures/completions persist retry attempt count; failures also preserve retryability classification in automation/audit metadata.
- WhatsApp outbound failures/completions preserve retry attempt count and retryability classification.
- Provider event mapping has deterministic tests covering organization, action/message identity, correlation, retry metadata and failure details.
- No provider delivery or CI/Vercel success is claimed.

**Next concrete implementation:** continue deterministic cross-surface audit/event assertions and remaining Mail/WhatsApp/Chat/Voice edge-case hardening, then prepare final runtime/deployment verification. Do not wait for CI/Vercel.

### 2026-10-08 — Abandoned execution fail-closed hardening
- Stale email actions no longer remain permanently executing after a worker crash; they transition to failed with provider outcome unknown and require manual verification.
- Stale WhatsApp inbound executions no longer remain permanently processing; they transition to failed with downstream outcome unknown and require manual verification.
- Both recovery paths emit organization/correlation-aware audit events.
- Added deterministic contract tests for both fail-closed recovery boundaries.
- No automatic replay is introduced where an external side effect may already have happened.

**Next concrete implementation:** continue deterministic audit/event assertions and remaining Mail/WhatsApp/Chat/Voice edge cases, then prepare final runtime/deployment verification. Do not wait for CI/Vercel.

### Authentication correction — 2026-10-08
The next acceptance prerequisite is runtime verification of the new production authentication boundary. Required evidence: unauthenticated page redirect to /login, invalid/expired session rejection, valid Supabase Auth session mapped to an active application membership, and protected API 401/403 behavior. Configure a real Supabase project only through the approved infrastructure workflow; do not invent credentials or use another application's Supabase project. Phase 4 remains unauthorized.


### 2026-10-08 — Authentication implementation continuation
- ChatGPT is implementing authentication as a PostgreSQL-native application capability because no additional Supabase project is available and the product must not depend on Supabase Auth.
- Implemented password credentials, salted scrypt verification, opaque SHA-256 session hashes, HttpOnly session cookies, session expiry/revocation, login failure tracking/lockout, same-origin checks, account-status checks, current-session resolution, password change, and one-time first-account bootstrap.
- Next implementation remains cross-surface product completion; authentication is now the shared security boundary for all protected menus and APIs.
- Do not wait for GitHub Actions or Vercel before continuing development.


### 2026-10-08 — Chat organization-boundary hardening
- Chat stream now resolves the requested agent through the organization-scoped PostgreSQL agent repository before opening/creating a conversation or invoking Clara.
- A forged or stale agent ID from another organization now fails closed with `404 not_found` before conversation access.
- Added deterministic route-order regression coverage.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge-case hardening and deterministic audit/event assertions, then prepare final runtime/deployment verification. CI/Vercel remain non-blocking.


### 2026-10-08 — Provider outcome isolation hardening
ChatGPT corrected a cross-surface failure mode in the worker provider-event bridge: downstream automation evaluation failures are now isolated from authoritative provider delivery outcomes. A successful email/WhatsApp provider side effect can no longer be rewritten as a failed provider action merely because automation evaluation failed afterward. Added deterministic coverage through an injectable evaluator. Continue with remaining communication-loop edge cases and audit/idempotency hardening without waiting for CI/Vercel.


### 2026-10-08 — Cross-surface hardening continuation
The latest concrete implementation checkpoint is cross-surface hardening: deterministic E2E adapters now assert conflicting email/WhatsApp idempotency payloads are rejected and scheduled duplicate claims do not create a second durable run. Provider worker imports were corrected to use the shared retry classifier. Continue with remaining communication-loop edge cases and deterministic audit assertions; do not wait for CI/Vercel.


### 2026-10-08 — Communication-loop edge hardening continuation
- Provider automation event mapping now treats organization/action/message/account/email-account/correlation identifiers as canonical and prevents provider metadata from overriding them.
- Voice turn accounting now requires an active session both at the API boundary and database update, failing closed with a conflict when a session ended between checks.
- **Next concrete implementation:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and deterministic audit/event assertions. Do not wait for CI/Vercel.


### 2026-10-08 — Sensitive approval visibility hardening
- Email approval payloads contain recipient/content snapshots; pending approval listing and individual action retrieval now require `organization.update` instead of `organization.read`, matching approve/reject authority.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and deterministic audit/event assertions. Do not wait for CI/Vercel.


### 2026-10-08 — Communication-loop edge hardening
- Deterministic cross-surface PostgreSQL scenario coverage now treats duplicate concurrent email approval delivery as a race and requires exactly one successful approval transition.
- WhatsApp outbound failures now persist the provider error in the authoritative message row instead of discarding the error argument.
- Runtime/CI/Vercel validation remains deferred under the active development-first instruction; no success is claimed.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and audit/idempotency assertions before final runtime/deployment preparation.


### 2026-10-08 — WhatsApp provider-status isolation hardening
- Provider status callbacks are now organization + WhatsApp-account scoped before mutating a message, preventing a provider message ID collision from crossing account/tenant boundaries.
- The webhook now passes the resolved account scope into the repository update.
- Added deterministic regression coverage for the repository predicate and webhook scope propagation.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and deterministic audit/event assertions; do not wait for CI/Vercel.


### 2026-10-08 — Scheduled execution audit correlation
- Scheduled run completion/failure now persists organization-scoped audit events using the durable run UUID as target and correlation identifier.
- Configuration-required and exception paths are both covered; no external provider success is fabricated.
- Added deterministic worker source coverage.
- Continue remaining communication-loop edge hardening without waiting for CI/Vercel.


### 2026-10-08 — Immediate browser access path
Deploy/rebuild the latest main commit and verify the browser flow: unauthenticated `/` redirects to `/login`; `/login` renders; first-run `/setup` can initialize the first owner when `AUTH_BOOTSTRAP_TOKEN` is configured; successful login returns to the requested path; protected API calls return JSON 401 without a session and authenticated calls resolve the organization context. Keep Phase 4 authorization separate from this verification.

### 2026-10-09 — DEV-01 Drafts discoverability
- Added search over persisted draft subject, body, recipients, and mailbox address, with a distinct no-match state (`8ccf1cb24039cb3bc745a51576a73ee68007e946`).
- Routed suspected Drafts tenant-context and Inbox search-placeholder defects to FIX-01 (`BKL-008`).
- **Next:** continue Zoho and IMAP/SMTP ingestion into PostgreSQL and connect persisted messages/drafts to authorized Clara email-read/draft tools. Tests and live provider/runtime verification remain pending; do not wait for CI/Vercel.


### 2026-10-09 — Draft search regression contract
Added static regression assertions for draft search fields and no-match UI in `apps/web/tests/mail-draft-action-contract.test.ts` (commit `b0fd74f45a06a1cb8e2f3c4c152d242314711d39`). Test execution remains pending; continue connected-mailbox ingestion and agent-tool wiring without waiting for CI/Vercel.


### 2026-10-09 — Chat email access audit
Chat previously did not read local mailbox data. Added a limited organization-scoped PostgreSQL email context for email-related chat prompts, and static contract assertions. This is a read-context bridge, not yet the complete host tool registry integration. Source commits include `5c84fd4bd105586ed26272168fdee68b999ae94c` and test commit `93d353864256a49368ecaf4354aec0bfffb05889`.

**Confirmed remaining gap:** Gmail is the only provider selected by `mailbox-sync-worker.ts`. Zoho and IMAP/SMTP adapters currently return empty sync results; IMAP message retrieval/search and draft operations remain placeholders. The immediate next implementation is real Zoho full/incremental sync and IMAP UID-based retrieval/parsing, then generalize the worker to provider-specific adapters and wire host-owned authorized email.read/draft tools into chat. Do not claim that live chat can access real mailbox data until a live synchronized mailbox and a chat turn are observed. FIX-01 continues to own BKL-008; no test/build/runtime verification has been run in this session.


### 2026-10-09 — Zoho mailbox sync source implementation
- Implemented paginated Zoho folder/message import with durable folder/offset cursor, followed by bounded newest-page refresh per folder after the initial import completes.
- Added Zoho credential snapshots so refreshed access tokens can be encrypted back to PostgreSQL by the common worker.
- Generalized mailbox worker dispatch and startup for Gmail/Zoho; worker polling includes Gmail and Zoho, but deliberately excludes IMAP/SMTP until its UID/FETCH parser is real rather than reporting false sync success.
- Added static contract assertions for multi-provider dispatch and Zoho pagination. These tests were not executed; no typecheck, build, live Zoho connection, database import, or chat acceptance was run.
- Commits: `403884433e7c2085b5a16e61b9a140e6f0670642`, `7c1afaf285cd7eef2346d99c322d4c1b9bb0e9ff`, `1906efe6253d6586fe07bdb6150722d9eeb0560f`, `41a15f05bfab6c540264c439eb1225126513d0a2`, `00665ee353efb8ff80d5a0af4ca0f7c225630f41`, `597c07ad49ccf8fd409302a46331d004fcef9e01`, `f2df3efc1c31a553b00fe39d114339affb85c6ab`, `c354bf7d3e07158d9417f5e02b00bdd574dba651`, `eb3c8d45ae2f947a252c06f6f00541a3b77208ac`, `77e03fa89ad63c2ddf45aa6034666d93f6ed8645`.
- Next: implement IMAP UID-based ingestion and message parsing; then run focused worker/web tests and typecheck when available, and perform live provider-to-PostgreSQL-to-Clara acceptance only with configured credentials/runtime.

- Follow-up corrections: incremental Zoho refresh now starts from the newest page of each folder instead of re-entering the initial-import cursor; Zoho tracks provider message-to-folder mapping and draft identity across the subsequent message-detail fetch. Static assertions were aligned in commit `42a692829dcec696d4ef327a03641344cede9c3f`; folder/draft preservation was added in `65331b15a83f10d5b4fcb899713e0710d72e7497`. These corrections remain untested at runtime.


### DEV01-IMAP-INFRA-20261009 / 2026-10-09
- **Task:** Continue the authorized email sync slice and audit Qdrant/Redis/RabbitMQ integration.
- **Actions:** Implemented IMAP UID SEARCH/FETCH scanning, bounded UID batches, RFC822 header/body extraction, folder-derived draft flags, UIDVALIDITY-aware cursor fields, per-folder high-water checkpoint state, list/get/search methods, and worker dispatch/polling for IMAP/SMTP. Added a deterministic parser regression test and updated capability expectations to avoid claiming IDLE, draft CRUD, or SMTP send support that remains unimplemented. Enabled the opt-in local-infra Compose profile services (PostgreSQL, Redis, RabbitMQ, Qdrant). Added infrastructure integration status map with current data flow and missing implementation points.
- **Commits:** `cd3d85f9a64a016639cabf7b7e74da9e6f27ca9c`, `19806091f6f96f378ea94190cfd8f74bfa1f78c1`, `33379545125a97f6ed7db881eb57e147b0c4e007`, `2fc1384530ee82bb766cb54cf89e2ff4e72154ea`, `131fdc712b2023e71e5ecd4a6c5d2624f7203686`, `26c90fe94093a953973492c5276b50a13c4d078f`, `b2d82ddfe6f656740bd2077dc1300cad895645f7`, `d72d444a1d71c9675fa52b4a9bcb3b957150cc56`, `c3b61ba1b688137cf917bdb224b51fef433430d5`, `63312b53db66a42d10cceb67b3b1f6a283511642`.
- **Evidence:** GitHub accepted source/control commits. Test source added/updated but not executed. No typecheck, build, live IMAP/Zoho session, PostgreSQL import, or Clara Chat turn was run.
- **Limitations:** IMAP parsing is basic line-oriented RFC822 handling; multipart parsing is partial, charset/attachment support is incomplete, and the low-level response reader has not been tested against real servers. Redis/RabbitMQ have no active app client paths found; Qdrant is configured/expected behind Clara RAG but no email indexing pipeline is implemented. Enabling Compose services does not enable those app integrations.
- **Next action:** Run focused adapter tests and typecheck; correct defects; validate provider-to-PostgreSQL-to-chat flow with configured accounts. Then implement Clara-supported email vector indexing, Redis client usage, and RabbitMQ durable sync queue/retry path. FIX-01 retains BKL-008; OPS-01 retains production infra/deployment.


### Infrastructure and runtime acceptance follow-up — 2026-10-09
The opt-in local infrastructure services are now active in `infra/docker-compose.yml` under profile `local-infra`; production continues to use external services under OPS-01. Integration audit is documented in `docs/architecture/INFRASTRUCTURE-INTEGRATION-STATUS.md`. The remaining Qdrant/Redis/RabbitMQ work is product integration, not container provisioning: implement email indexing using Clara Core RAG, a real Redis-backed use case, and durable RabbitMQ publishing/consumption with retry/DLQ. Do not report them integrated until code and evidence confirm it. IMAP RFC822 handling is basic and requires tests against real IMAP servers; IMAP draft creation/sending/attachments are not enabled. Run focused tests and typecheck next without waiting for CI/Vercel, then correct issues and continue the email→PostgreSQL→Clara flow.


### Follow-up — IMAP parser test and infrastructure activation (2026-10-09)
- Added a deterministic mocked Zoho sync test for initial folder import and repeat incremental refresh: commit `54f026281666b9d600909f947789204b94bd48b4`.
- Added IMAP parser contract coverage and corrected adapter capability assertions: `26c90fe94093a953973492c5276b50a13c4d078f`, `b2d82ddfe6f656740bd2077dc1300cad895645f7`; updated worker selection test after enabling IMAP polling: `d72d444a1d71c9675fa52b4a9bcb3b957150cc56`.
- Enabled the opt-in local Compose profile for PostgreSQL/Redis/RabbitMQ/Qdrant: `c3b61ba1b688137cf917bdb224b51fef433430d5`. Added `docs/architecture/INFRASTRUCTURE-INTEGRATION-STATUS.md` documenting actual data flow and integration gaps: `63312b53db66a42d10cceb67b3b1f6a283511642`.
- **Not verified:** No test suite, typecheck, build, live mailbox, deployed database, Clara turn, or infrastructure container was executed. GitHub accepted the commits only. Redis and RabbitMQ still lack real application client paths; Qdrant email indexing is not implemented. Do not claim those app integrations are enabled just because endpoints or local containers exist.


### Follow-up — focused-test source review (2026-10-09)
- Corrected Zoho adapter test mocks to match the actual account-discovery sequence (`GET /api/accounts` before account detail/folder/message calls); the prior mock would fail before exercising sync/draft behavior. Commit `f04eb93d27ee01934970e64679be381d6dec6500`.
- Fixed malformed IMAP LIST command line termination found during source review (`fe3e2d39157f74c66741772966125cfee81055a1`; intermediate correction commits `2146facf04762ffd07fbd1458ad5a9f4256cf56` and `2f5b63e1a65b6aded5b602c0f439c689cd49c45f`). Source now uses an escaped CRLF and closes the mailbox pattern correctly.
- Zoho's capability descriptor now advertises the bounded newest-page incremental refresh actually implemented (`5a59ec5745f8d3a3f735220f9496e14c79dece22`).
- **Verification status:** Source was inspected only. Focused tests and worker/web typechecks still have not executed; do not claim PASS. Real IMAP, PostgreSQL-to-Clara Chat, RAG email indexing, Redis client usage, and RabbitMQ durable queue lifecycle remain pending. FIX-01 owns BKL-008; OPS-01 owns production infrastructure/deployment.


### FIX-01 next action — Zoho OAuth test parser correction (2026-10-09)
- Latest user-provided typecheck: shared, DB, Clara Core, and worker passed; web failed because `apps/web/tests/zoho-oauth-settings.test.ts` contained literal `\n` sequences at line 84.
- Narrow fix committed: `39857c40820940b500dcf452331dfe82ae35b861`.
- **Next:** Run `pnpm run typecheck` and focused Zoho OAuth settings test. Record actual post-fix output. Do not wait for DEV-01; route unrelated infrastructure/CI/deploy failures to OPS-01.

### FIX-01 runtime-schema source follow-up — 2026-10-09
- Added static migration regression coverage for migration `0029_runtime_schema_reconciliation.sql` in `apps/web/tests/migration-verification.test.ts` (commit `282c4fea59b848e876bc65d79b250752b8339bda`).
- Source/test edits are committed, but tests and migration have not been executed. OPS-01 remains responsible for applying migrations through `0029`, rolling out matching web/worker images, and diagnosing the Redis response. Do not wait for CI/Vercel; do not claim runtime success.


### DEV-01 screen migration update — Activity and Audit (2026-10-09)

Activity and Audit have been adapted in source to the Lovable visual system. Activity preserves organization-scoped persisted events while adding client-side event/decision filters and refresh. Audit preserves the organization-authorized API and CSV/JSON export routes; filters now trigger fresh requests and stale requests are aborted. Focused static source-contract assertions were added. No tests, typecheck, build, browser, accessibility or live API verification was run. Continue next with Operations, then Settings/provider subsections, Login/Setup, agent detail/version/history, and cross-route responsive/accessibility review. Do not wait for CI/Vercel.


### DEV-01 screen migration update — Operations (2026-10-09)

Operations UI adapted at source level with infrastructure cards, runtime metrics, refresh, and honest loading/error/empty states. Crucially, Redis/RabbitMQ/Qdrant statuses whose API details only confirm URL configuration are displayed as “Configured” rather than “Healthy”; this does not establish live connectivity. Added static contract assertions. No tests/typecheck/build/browser/accessibility/live dependency verification run. Next: general Settings and provider-setting subsections, then Login/Setup, agent detail/version/history, and cross-route responsive/accessibility review. Do not wait for CI/Vercel.


### FIX-01 business-workflow code review — 2026-10-09
Source review found and corrected three additional defects: invalid dollar quoting in migration 0030; missing PostgreSQL parameter markers in inbox search predicates; and legacy `email_sync_states.cursor jsonb` incompatible with provider text pagination tokens. Migration 0031 adds `cursor_token text`; the worker now uses it. Regression assertions are committed. Source/test code is not yet executed.
**OPS-01 next:** pull latest `main`; apply migrations through `0031` to the exact shared PostgreSQL database; rebuild/restart web and worker; correct Redis `WRONGPASS` by comparing the configured URL credentials with Redis ACL/user settings (never paste secrets); trigger sync; confirm worker completion, nonzero persisted message rows where the provider returns mail, and inbox results. Never bypass the distributed lease. HTTP 202 is queued, not synced.


### DEV-01 screen migration update — Settings (2026-10-09)

General Settings, AI provider/runtime settings, Gmail OAuth clients, and Zoho OAuth clients now use compact Lovable card/input geometry and Lucide section icons. Existing API calls, membership/password operations, model catalog, encrypted secret handling, OAuth callback guidance, and Zoho data-center selection were preserved. Focused static contract assertions were added. Tests/typecheck/build/browser/accessibility/live OAuth/provider checks remain NOT RUN. Next: Login/Setup, agent detail/version/history, and cross-route responsive/accessibility review. Continue without CI/Vercel polling.


### DEV-01 canonical agent creation route correction — 2026-10-09

The standalone `/agents/new` form had no persistence handler and did not save its purpose field. It now redirects to `/agents#new-agent`, reusing the existing organization-scoped create flow rather than duplicating API/validation logic. A static source-contract assertion was added. Tests/typecheck/build/browser remain NOT RUN. **Next:** cross-route responsive/accessibility review and remaining secondary controls; continue without CI/Vercel.


### DEV-01 cross-route review update — 2026-10-09

The review is in progress, not complete. The Settings anchor navigation now uses `top-[64px]` with a lower stacking level so it does not cover the global sticky top bar. The mobile sidebar now closes on Escape and its trigger reports `aria-expanded` and `aria-controls`. Static source assertions were added. **Tests/typecheck/build/browser/screen-reader/device checks NOT RUN.** Next inspect remaining route controls and responsive overflow, then continue the focused UI contract coverage. Independent OPS-01 inbox runtime follow-up (migrations 0029/0030 and Redis WRONGPASS) remains separate and must not block DEV-01.


### DEV-01 shell review follow-up — 2026-10-09

A further source review found the Google Fonts CSS import after the Tailwind theme block. Moved it to the beginning of `apps/web/src/app/globals.css` and added a static ordering assertion. Commits: CSS `82eaa527`, test `d70d0064`, inventory `7678c345`. This is source-only; tests/typecheck/build/browser/font network behavior remain NOT RUN. Continue the responsive/accessibility review and secondary controls; do not wait for CI/Vercel.


### Cross-route review finding routed to FIX-01 — audit export organization fallback (2026-10-09)

Source inspection found `apps/web/src/app/api/audit/export/route.ts` falls back to `getDevOrgId()` when `organizationId` is omitted, while the Audit UI's export links omit that parameter. The export handler still calls `authorize`, but selecting the organization via a development fallback is inconsistent with the authenticated active-organization boundary used by `/api/audit`. This is a tenant-context/security correctness issue outside DEV-01's UI-only scope; route to FIX-01 for a minimal correction and regression coverage. Do not claim export tenant isolation is verified. DEV-01 continues the independent responsive/accessibility review; do not wait for CI/Vercel.

 
### FIX-01 lockfile follow-up — 2026-10-09
User's `pnpm run typecheck` was blocked before TypeScript by `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` for `amqplib@2.2.0`. Commit `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e` removes a stray concatenated YAML document and restores the worker package/snapshot entries. **Next:** pull latest `main`, run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`; record real output. Source correction is not a verification PASS. Do not wait for CI/Vercel.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


### FIX-01 — Retest migration assertions and reconcile local lockfile (2026-10-10)
The user-reported focused run had 83 passed / 3 failed. The two SQL failures were test false positives against valid PostgreSQL `$$` delimiters; assertions were corrected in commit `58730eb8b0fa46bfdd5fca581295209921582dbe`. The third failure is local lockfile drift: local `pnpm-lock.yaml` has two YAML document headers, while the PR branch lockfile has one. Preserve backups and inspect `git status --short`; then reconcile only the lockfile from `origin/fix/migration-verification-phase4-contract` if no intended local lockfile edits need to be kept. Re-run `pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts`. Then continue with worker RabbitMQ contract tests and web/worker typechecks sequentially. Do not wait for CI/Vercel; do not claim PASS without the output.


### FIX-01 — Latest user test run and targeted worker test fixes (2026-10-10)
The user reports email-action-contract.test.ts passes 8/8; migration verification reports 85/86 with the lockfile-header assertion failing; worker tests report 79/81 with two test assertion failures; both web and worker tsc --noEmit commands produced no errors. The GitHub branch pnpm-lock.yaml was inspected and contains exactly one lockfileVersion: and one importers: header. The user's runtime reports two lockfile headers from /docker/ai-comms-agent; diagnose the local/container working-tree discrepancy using git status --short, grep -nE '^(lockfileVersion|importers):' pnpm-lock.yaml, and realpath pnpm-lock.yaml before changing it. Do not replace the lockfile blindly or delete the local backup files.

Targeted source changes committed: IMAP multiple-literal test now asserts the exact CRLF boundary and second literal marker; scheduling idempotency test regexes no longer incorrectly require literal backslashes around SQL parentheses. Re-run the two failed worker tests and focused migration test. Continue fixing concrete failures without waiting for CI/Vercel; no build/deployment PASS is implied.


### Follow-up — 2026-10-10
The focused worker rerun isolated the remaining IMAP failure: regexes treated `{5}` as a regex quantifier instead of the literal IMAP byte-count marker. Fixed both assertions by escaping the braces in commit b87d5bc804331470a280bf54ee020b463a186d5f. Scheduling idempotency test now passes in the user's rerun. Pull and rerun the focused IMAP test. The local pnpm-lock.yaml is modified and has duplicate headers at lines 2/159 while GitHub's branch version has one lockfileVersion and one importers header. Preserve all backup files; inspect `git diff -- pnpm-lock.yaml` and restore only the tracked lockfile to branch HEAD after saving/confirming the backup artifacts if the diff consists solely of the known accidental duplicate document. Then rerun migration verification.


### Immediate follow-up — 2026-10-10 (audit migration SQL policy syntax)
The user's latest `manual-up.sh` run built both Docker images and skipped migrations 0000–0031, then failed on 0032 because the DELETE restrictive policy specified unsupported `WITH CHECK`. Corrected `audit_events_delete_deny` to `USING (false)` only; UPDATE deny retains `USING (false) WITH CHECK (false)`. Added a static regression assertion. Commits: migration `03f8e87c039c097784e0acb9e671ba853f5ca852`; test `b955d4bb2a076616de5d396f7b14f3ff23bdc772`. Pull latest `main` and rerun `bash scripts/manual-up.sh`; keep progressing from the next concrete result. Do not wait for CI/Vercel. Migration, tests, and runtime are still unverified.

### Immediate next action — inbox schema, draft role authorization, and stuck email queue (2026-10-10)
Latest user runtime evidence: migration 0032 now applies; the web inbox still fails because the deployed legacy attachment table has `email_message_id` while current repository SQL expects `message_id`. Draft GET returns `insufficient_role` for `Requires one of: member`; role guard was not hierarchical. Worker queue enqueue/consumer repeatedly fails with `Expected ConnectionOpenOk; got <ConnectionClose channel:0>`, so eligible accounts remain queued.
Source corrections committed to `main`: forward-only migration 0033 copies legacy attachment foreign keys; role guard now implements member < admin < owner; if RabbitMQ enqueue fails, worker attempts the existing direct-sync batch under its Redis distributed lease; RabbitMQ logs include sanitized endpoint/error details. Regression assertions were added.
Commits: migration `de8a79b2`; auth `0ab61969`; auth test `25d35236`; migration test `65ca6a0d`; queue fallback `a0124202`; diagnostics `d058b5e1` and `27d960eb`; fallback test `c45f6a9d`.
**User next action:** `git pull --ff-only origin main && git status --short && bash scripts/manual-up.sh`; then inspect `docker compose -f infra/docker-compose.yml logs --tail=200 worker web`. Do not wait for CI/Vercel. Tests, migration 0033 execution, provider synchronization, and live API behavior are still unverified. If fallback reports Redis lease unavailable, correct Redis credentials/ACL/TLS from the exact sanitized error; do not bypass the distributed lease. Check that the inbox renders, drafts GET returns 200 for a valid organization member/owner, and messages are persisted/fetched. The user pasted an access token in a curl command; advise revoking it and creating a fresh session, but never store the token.


## FIX-01 follow-up — 2026-10-10 test-command mismatch

The latest user-run command passed Clara AI Platform test paths to the `ai-comms-agent` monorepo root. Root `npm test` runs all workspace test scripts, so `apps/web` Vitest searched its own `tests/**/*.test.ts` and found no matching files; the worker process was killed with SIGKILL, without enough output to infer why. Do not rerun those Clara-specific paths in this repo.

**Current actionable next step for the active email runtime issue:** run `bash scripts/diagnose-email-accounts.sh` from repository root and share only the reviewed sanitized report. For isolated repo-local regression checks, run one at a time: `pnpm --filter @ai-comms-agent/web exec vitest run tests/migration-verification.test.ts`, then `pnpm --filter @ai-comms-agent/worker exec node --import tsx --test tests/email-sync-rabbitmq.test.ts`. These commands have not yet been run. No test or live-sync PASS claimed.


### Immediate next action — Gmail Pub/Sub receiver and watch lifecycle (2026-10-16)

Active branch: `feature/provider-realtime-email-sync`, stacked on `feature/imap-smtp-mail-actions`; PR #19 is closed/merged; follow-up hardening was merged by PR #21 into `main`. RT-02 source implementation has started: Gmail adapter watch/profile methods, a worker watch-renewal loop, authenticated Pub/Sub webhook with Google X.509 JWT signature/issuer/audience/service-account/time checks, mailbox-to-account resolution, durable immediate-sync scheduling via `email_sync_states.pending_push_at` plus `next_attempt_at`, and due-sync query support. A focused web test covers missing/malformed bearer tokens.

**Do next:** inspect the new webhook/worker code and add coverage for valid/invalid JWT claims, malformed Pub/Sub payloads, unknown/ambiguous mailbox, paused account, duplicate notifications, watch renewal, and history-cursor recovery. Add operational setup docs for `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_PUSH_AUDIENCE`, `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT`, Google topic publisher permission, and Pub/Sub authenticated push subscription. Then implement IMAP IDLE only after Gmail reconciliation is secure. Do not claim the Gmail path complete until worker/web tests and typechecks are run and OPS-01 validates a real external email end-to-end. No tests, typechecks, build, deployment, cloud configuration, or live mailbox delivery were run in this session.


RT-02 checkpoint hardening: migration `0049_email_sync_pending_push.sql` adds `email_sync_states.pending_push_at`. The webhook marks the durable signal, and a successful sync clears only signals that existed by its claim timestamp; a push arriving mid-sync remains due for another pass. Migration application and concurrency behavior are not verified yet.


### Gmail RT-02 follow-up — 2026-10-16

- Added signed-JWT webhook tests using a synthetic test-only certificate/key: invalid audience, wrong service account, unverified identity, expired token, wrong issuer, future `iat`, malformed envelope/payload, unknown and ambiguous mailbox, paused mailbox, duplicate history cursor, and durable queueing.
- Added Gmail History API tests for paginated incremental changes and expired-cursor fallback to a fresh initial baseline.
- Gmail OAuth callback now attempts watch registration immediately when all three push settings are present, keeps `sync_webhook` capability disabled, and falls back to worker retry if watch registration fails.
- Watch worker now requires all three push configuration values, compares normalized mailbox addresses, merges watch/retry metadata without replacing unrelated connection configuration, and uses bounded exponential backoff capped at six hours.
- Added `.github/workflows/provider-realtime-email-sync.yml` for focused webhook/history/watch/checkpoint tests and web/worker typechecks. The workflow is push/PR triggered; it was not waited on or inspected in keeping with the no-polling instruction. Tests/typechecks have not been independently executed in this session.
- Google Cloud configuration, database migration application, actual Pub/Sub delivery, and independent-account delivery timing remain external acceptance items. No GCP/secret-management connector is available in this session, so cloud settings were documented but not applied.

**Next:** run focused checks only if needed without polling unrelated jobs; inspect any failure when convenient. Confirm Google Cloud topic/subscription/OIDC values and apply migration 0049 to the same DB used by web and worker. After real Gmail push acceptance, proceed to IMAP IDLE; research found Zoho Mail docs describe configurable outgoing webhooks in the product UI but no public mailbox-event subscription API in the Mail REST API index, so don't treat Campaigns webhooks as Zoho Mail inbox events. Use IMAP IDLE where Zoho account access supports it; otherwise retain API reconciliation polling.


### PR tracking correction — 2026-10-16

PR #18 and PR #19 are closed/merged. The initial realtime inbox refresh and Gmail push foundation are present on `main`. The follow-up hardening is tracked in [PR #21](https://github.com/Rilan-Dev/ai-comms-agent/pull/21), an open draft targeting `main`. Do not describe PR #19 as still draft. Focused workflow results remain uninspected; no claim of passing tests, live Pub/Sub, applied production migration, or end-to-end latency is made.


Gmail Cloud setup helper added: `scripts/setup-gmail-pubsub.sh` validates required inputs, enables Gmail API/Pub/Sub APIs, creates the topic/subscription, grants Gmail publisher permission, and configures OIDC push identity. `.env.example` lists the three runtime variables as commented placeholders. **No GCP project/endpoint/service-account values were available and no cloud resource or deployment environment was changed.** Before claiming Gmail complete, an operator must run the script from an authenticated `gcloud` shell, configure the same three variables for web and worker, apply migration 0049 to the shared DB, and run an external-account delivery test.


### IMAP IDLE source progress — 2026-10-16

- Added RFC 2177 IDLE support to `ImapSmtpAdapter`: detect the server's advertised `IDLE` capability, select `INBOX`, wait for `EXISTS`/`EXPUNGE`/`FETCH`/`VANISHED`, send `DONE` before returning, and reissue at a 25-minute maximum wait.
- Added `apps/worker/src/email/imap-idle-worker.ts`, started from the worker entrypoint. It maintains up to 20 connected-account watchers, reconnects with bounded backoff, backs off six hours for servers that do not advertise IDLE, and persists account-scoped change signals via `email_sync_states.pending_push_at` so the existing reconciliation worker performs the actual fetch/persist/checkpoint.
- Added focused parser tests and included them in the focused GitHub workflow. Periodic mailbox polling remains the fallback.
- **Not verified:** IMAP IDLE socket integration, live provider behavior, tests/typechecks, database migration presence in deployed DB, reconnect behavior against real servers, and per-provider latency. Source has been committed but the focused workflow is not being polled.

Next: keep Gmail cloud setup and live push acceptance as an OPS prerequisite, then harden the IMAP watcher with integration tests; after that implement Zoho Mail's configurable outgoing webhook only with a secure account-scoped bootstrap/signature scheme, otherwise use this IMAP IDLE path or bounded Zoho API polling. Outlook Graph remains later in the order.


### Zoho Mail outgoing webhook implementation — 2026-10-16

- Official Zoho Mail documentation confirms product-configured outgoing webhooks for Mail events, with `X-Hook-Signature` HMAC-SHA256 and `X-Hook-Secret` supplied on the first request. This is a UI-configured mechanism, not a general public Mail REST API subscription endpoint.
- Added admin endpoint `POST /api/email-accounts/[accountId]/zoho-webhook` to rotate a random account-scoped URL token, store only its SHA-256 hash in `connection_config`, clear any old HMAC secret from encrypted credentials, and return the URL once.
- Added `POST /api/webhooks/zoho/[token]`: resolve exactly one Zoho account using the token hash; verify HMAC in constant time; bootstrap the first secret only through the unguessable URL; store that secret in encrypted account credentials; ignore webhook payload as authoritative mail content; and persist a `pending_push_at` reconciliation signal.
- Added account UI to generate/copy the one-time URL, with instructions to configure Zoho Mail Settings → Integrations → Developer Space → Outgoing Webhooks and select Limited Data List. The endpoint URL is a bearer secret; regenerate it if exposed.
- Added focused tests for HMAC bootstrap, invalid signature, later requests without `X-Hook-Secret`, paused account, unknown token, and malformed payload; included them in the focused workflow.
- **Not verified:** tests/typechecks, live Zoho webhook handshake, signature behavior against a real Zoho account, actual provider delivery, or deployed latency. Polling remains the fallback.

Next: continue with Outlook/Microsoft 365 Graph adapter work after the current provider-specific sync paths are hardened. For Gmail, Google Cloud configuration, migration application, and external-account timing remain OPS prerequisites; do not wait on unrelated CI, but do not claim live delivery verified.


### Outlook / Microsoft 365 source progress — 2026-10-16

- Added a Microsoft Graph adapter registered as `microsoft_graph`, with inbox folder listing, full/incremental inbox delta synchronization, `@odata.nextLink` pagination, persisted `@odata.deltaLink`, deleted-message handling, token refresh, and fail-closed Graph URL validation. Unsupported send/draft/write operations remain explicitly disabled in its capability set.
- Added Microsoft OAuth PKCE start/callback using server-side `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, and optional `MICROSOFT_OAUTH_TENANT_ID`; tokens and client secret are stored in encrypted account credentials.
- Added Graph subscription create/renew worker with per-account encrypted `clientState`, 48-hour subscriptions, 24-hour renewal threshold, retry backoff, and an HTTPS notification endpoint.
- Added Graph webhook validation-token response and notification handling that verifies subscription ID plus `clientState` before queueing durable reconciliation. Added adapter and webhook tests and wired them into the focused workflow.
- Added Outlook connection/sync controls to the mail accounts UI and extended the worker's provider query/registry to include Microsoft Graph.
- **Not verified:** web/worker typechecks, tests, live Entra OAuth, Graph subscription validation, actual notification delivery, full mailbox delta behavior against a real tenant, or latency. The `sync_webhook` capability remains false until live acceptance.

Next: register the Microsoft Entra app, configure the three Microsoft OAuth env values and public `APP_ORIGIN`/notification URL, then perform a real Outlook connection and delivery test. Keep Gmail Cloud Pub/Sub setup/migration and Zoho webhook UI bootstrap as separate operator acceptance tasks. Do not wait on unrelated CI; continue implementation but don't mark any provider realtime path production-verified.
### Main branch status correction — 2026-10-16

GitHub reports PR #21 merged into `main` at `99c2de656bfa6108e4b8df0369c6eef74f48751a`. Main now contains Gmail watch-on-connect/config hardening, signed webhook and history tests, focused test/typecheck workflow, the Pub/Sub setup helper, and the first IMAP IDLE watcher. The merge status does not mean tests or typechecks passed: the focused workflow result has not been inspected, and live GCP/IMAP delivery, migration application, and latency acceptance remain unverified. Continue development without polling CI, but do not label these runtime paths production-verified.


## DEV-01 — Hybrid email RAG architecture review (2026-10-16)

- **Review artifact:** `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`, commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`.
- **Recommendation:** Hybrid PostgreSQL + Qdrant, not either store alone. PostgreSQL remains authoritative for exact filters/counts/time/latest/permissions; Qdrant provides semantically relevant chunk candidates; use PostgreSQL FTS + Qdrant and final authoritative SQL revalidation.
- **Current source gap:** PostgreSQL email chunks exist; a durable vector-sync outbox and injected adapter processor exist in source, but no concrete supported Clara vector adapter is bound and the vector-sync loop is not started in `apps/worker/src/index.ts`. The local runtime retrieval path is SQL/tsvector/ILIKE, not verified Qdrant search.
- **Security boundary:** ISS-026 remains open and FIX-01-owned. Do not expose vector retrieval or the existing broad Chat email-context loader beyond the current authorization contract; DEV-01 must not take over the substantial tenant-security fix.
- **Next DEV-01 action:** Obtain architecture review/correction; confirm the supported Clara server-to-server vector/RAG adapter; coordinate with FIX-01 on the allowed-account contract; then bind adapter, start outbox loop, and implement shared retrieval for Chat + realtime voice. Do not claim 10x without measured baseline.
- **Verification:** Review and docs only. Tests/typechecks/build/live vector/provider/latency checks NOT RUN. OPS-01 owns runtime/infrastructure acceptance after source work.


### DEV-01 — Clara email-vector adapter contract investigation (2026-10-16)

- **Evidence:** `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`, updated at commit `0994cdd0a9388ee10b57ebc759d05a2eb4117f20`.
- **Confirmed blocker:** Clara main currently has internal KB-scoped Qdrant functions and a KB-scoped `/api/embed/search`, but no supported server-to-server email-vector API. Do not call internal functions cross-repo or treat the KB search route as an email endpoint.
- **Security blocker:** ISS-026 remains open and FIX-01-owned. No adapter binding or email-vector retrieval exposure until account-level authorization is established.
- **Next DEV-01 action:** Establish and implement an authenticated email-vector API in the Clara source-of-truth repository (explicit cross-repo work), then bind it to ai-comms-agent's existing durable outbox and shared retrieval after ISS-026 closes. The contract must cover deterministic upsert, metadata-only update, stale-chunk deletion, message/account purge, filtered search, and source references.
- **Verification:** Source inspection/docs only; no tests, typechecks, builds, live API calls, Qdrant operations, or latency benchmarks. OPS-01 owns runtime/ingestion/performance acceptance.



## Clara email-vector API — 2026-10-16 update

- **Source API draft:** Clara-AI-Platform PR #298, branch `feature/email-vector-api`: https://github.com/Rilan-Dev/Clara-AI-Platform/pull/298
- **Implemented in draft:** authenticated internal endpoint, dedicated org/model-scoped Qdrant email collections, deterministic point IDs, upsert/stale-chunk cleanup, metadata-only update, message/account/org deletion, and semantic search with mandatory organization + explicit allowed-account filters.
- **Contract:** Clara repo file `docs/plans/EMAIL-VECTOR-API-CONTRACT.md`; required server-only credential is `CLARA_EMAIL_VECTOR_API_KEY` (random, at least 32 characters).
- **Do not overstate status:** PR remains draft; no executable tests/typecheck/lint/build or live Qdrant/embedding/isolation evidence has been run. API is not yet wired to ai-comms-agent.
- **Security gate:** ISS-026 remains open and FIX-01-owned. Do not bind the vector outbox or expose Chat/realtime-voice email retrieval until FIX-01 closes ISS-026 and account authorization is freshly resolved at execution time.
- **Exact next DEV-01 action:** perform focused source corrections/tests for the Clara API PR, then update the ai-comms-agent adapter contract to target this API without enabling it. After ISS-026 closure, bind the existing durable outbox and shared PostgreSQL + Qdrant retrieval path. OPS-01 owns live infra, initial ingestion, isolation runtime evidence, and p50/p95/correctness/freshness acceptance. Do not wait on CI/deploy gates before independent source work.



## Email vector adapter draft — 2026-10-16 follow-up

- **New source:** `apps/worker/src/knowledge/clara-email-vector-adapter.ts` implements the existing injected adapter interface against Clara PR #298. Request-contract tests are in `clara-email-vector-adapter.test.ts`.
- **Important:** Adapter is authored but remains unbound. It is not imported by `apps/worker/src/index.ts`; the durable outbox loop is not started. Do not change this startup boundary while ISS-026 is open.
- **Contract update:** Clara API now allows nullable received timestamps and accepts content/metadata/per-chunk hashes to skip re-embedding when content and chunk identities are unchanged.
- **Next DEV-01 action:** Run focused worker adapter tests/typecheck and review the Clara endpoint contract against the adapter. Continue independent source corrections; do not wait for CI. After FIX-01 closes ISS-026 and Clara API executable checks are addressed, wire the adapter + outbox loop and implement one shared authorized PostgreSQL + Qdrant retrieval service for Chat and realtime voice.
- **OPS-01:** Configure the production endpoint and server-only credential, validate Qdrant/embedding behavior, perform initial ingestion and cross-account runtime checks, then measure p50/p95 latency, freshness and correctness.

### DEV-01 — focused source review follow-up (2026-10-16)

- Corrected a metadata lifecycle bug: the adapter now transmits explicit null/empty sender and folder-label values when source metadata contains those keys, so Qdrant can clear stale values instead of preserving them indefinitely. Clara's upsert/metadata-update contract accepts these explicit clears.
- Corrected Clara's request-body cap to measure UTF-8 bytes rather than JavaScript string characters.
- Added an opt-in Qdrant integration test at src/modules/email-vectors/core/qdrant-filter.integration.test.ts that checks actual Qdrant org + explicit-account filtering and scoped deletion. It runs only when QDRANT_INTEGRATION_URL is configured (optional QDRANT_INTEGRATION_API_KEY).
- Not executed: dependency-equipped tests/typecheck and live Qdrant were not available in this work session. These are authored checks, not passing evidence.
- Still blocked: do not bind the adapter/start the outbox loop or expose Chat/voice email retrieval until FIX-01 closes ISS-026 and execution-time account authorization is in place.
- Next: continue contract review and targeted source corrections; run worker/Clara tests and typechecks when the dependency-equipped environment is available. OPS-01 owns live Qdrant setup, ingestion, isolation evidence, and latency/correctness acceptance.
- Additional Clara review correction: deterministic point-ID and embedding-model hash inputs now use actual NUL separators rather than the two-character backslash-zero sequence, preventing ambiguous concatenation of identifier parts. This remains source-only and untested.

### DEV-01 — shared hybrid retrieval core authored (2026-10-16)

- Added `packages/db/src/email/hybrid-retrieval.ts`: one injectable retrieval service for future Chat and realtime voice use. It resolves fresh `agent_email_accounts` grants on each call, excludes `send_only`, intersects any requested account filter with current grants, performs bounded PostgreSQL lexical search, combines Clara semantic candidates, then rechecks organization, active account, agent binding, date/sender/subject constraints and message existence in authoritative SQL before returning message-backed citation tokens.
- Added `packages/db/src/email/clara-vector-search.ts`, exported the service from `packages/db/src/index.ts`, and added focused worker test files for binding isolation, final SQL revalidation, degraded lexical fallback, and Clara search scope/credential validation.
- Added indexed `contentHash` to Clara search hits and made the host adapter reject vector hits without a valid SHA-256 content hash. Final SQL compares semantic-only candidates against the current PostgreSQL knowledge document hash; stale semantic candidates are discarded. Lexical matches still use current authoritative message rows.
- **Not wired:** Chat route, voice runtime, worker startup, or vector outbox remain unchanged until FIX-01 closes ISS-026. Do not bypass this security gate.
- **Not executed:** tests/typechecks/lint/build/live Clara/Qdrant checks are not run; all checks remain source-authored only.
- **Next:** continue source review; when a dependency-equipped environment is available, run targeted tests and typechecks. After FIX-01 closes ISS-026, connect the same service through the trusted Chat and realtime voice tool path and activate the outbox adapter only after API verification. OPS-01 owns live Qdrant setup, ingestion, isolation evidence and latency/correctness acceptance.


## FIX-01 follow-up — WhatsApp provider status mismatch (2026-10-17)
- **Confirmed:** Meta error 131047 means the 24-hour customer-service window expired; free-form text must not be sent in that state. Use an eligible approved template or wait for a customer reply.
- **Pending:** UI showed `sent` despite a supplied failed webhook payload. OPS-01 should inspect the serving revision, webhook delivery/HTTP response, provider-message-ID match, persisted status/error and UI refresh using redacted evidence.
- **FIX-01 next:** Add a focused regression test and source correction only if that trace proves a code defect. Do not change Meta policy handling, weaken authorization, or treat queued=true as delivery.
- **Session record:** `docs/project-control/sessions/FIX01-WHATSAPP-131047-20261017.md`.

## FIX-01 / OPS-01 — WhatsApp label and status follow-up (2026-10-17)
- **Source fix committed:** WhatsApp account save now preserves the user's custom display label after Meta verification; Meta's `verified_name` is a fallback only. Test added at `apps/web/tests/whatsapp-account-display-name.test.ts`.
- **Commits:** `fd1fda7429363091098825dbf37bba0f30be3d0f` (source), `79f0e6a12511afaa07249005d24e6e50fc3c7d2b` (regression test).
- **OPS-01 next:** Confirm the actual post-fix production revision. Trace the specific Meta failed webhook: HTTP status/body + accepted count, organization/account-scoped message row (provider_message_id/status/provider_error/updated_at), then API response and UI. Last observed production revision before the source fix was `0e355bc75df6ab6c41ac619050be561faeb7c3e7` on deployment `dpl_5zjzPd6V3uBGuMK2LppXqsRTkirK`.
- **Evidence limitation:** Vercel runtime logs for the historic window are outside the available Hobby retention; grouped errors only show older Oct 10–11 account-save DB constraint errors. No direct live DB row was available. Exact cause of the `sent`/ `failed` discrepancy remains OPEN; do not speculate or patch status logic without runtime evidence.
- **Record:** `docs/project-control/sessions/FIX01-WHATSAPP-DISPLAY-STATUS-20261017.md`; handoff `HOF-FIX01-OPS-WHATSAPP-DISPLAY-STATUS-20261017`.

### Display-name correction scope update (2026-10-17)
- Both overwrite paths are corrected: immediate verification in `apps/web/src/app/api/whatsapp/accounts/route.ts` and background verification in `apps/worker/src/messaging/whatsapp-worker.ts`.
- Regression coverage now checks both call sites: `apps/web/tests/whatsapp-account-display-name.test.ts`.
- Latest source/test commits: `7d785b36f2bae90d9d137805e1390fe9ab467550`, `f9bc5ec1cc793fb69c3b2a5a7d26e8d1cf00d5fb`. Tests remain unexecuted and deployment remains unconfirmed.
- OPS-01 must continue the separate live status trace; do not close it based on source inspection.

### FIX-01 / OPS-01 — chat provider override follow-up (2026-10-17)
- **Source correction:** `packages/clara-core/src/runtime.ts` no longer skips per-agent settings when the organization-default row is absent. Commit `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`.
- **Regression test:** `apps/web/tests/clara-agent-provider-resolution.test.ts` (commits `d9e6c619320390c5290c04d29d30187a6838736f`, `c0e0a31e788ecd24e6af89f42e4f67f5100b7c73`); not executed.
- **OPS-01 next:** Confirm serving revision for the public domain and self-hosted web container. Inspect org runtime-default row presence, agent chat override, and Sarvam chat provider-config metadata in the correct org scope. Rebuild/restart through the normal manual procedure and test one chat turn. No credentials may be printed.
- **Status:** Source correction committed; runtime root branch remains conditional on live DB state. Test/build/deployment not verified. Handoff `HOF-FIX01-OPS-CHAT-PROVIDER-OVERRIDE-20261017` OPEN.


## DEV-01 — expose bound WhatsApp history to interactive chat (2026-10-17)

- **Source change:** `apps/web/src/app/api/chat/stream/route.ts` now loads up to 20 recent WhatsApp messages only when the current/recent chat context asks about WhatsApp, and only from a non-deleted, connected account explicitly bound to the active agent and organization.
- **Prompt safety:** message bodies are marked as untrusted data; the context explicitly says it is read-only and must not be represented as a successful send/reply.
- **Regression coverage authored:** `apps/web/tests/whatsapp-chat-context.test.ts` asserts the explicit binding, connected-account and organization filters, untrusted-content boundary, and prompt injection point.
- **Source commits:** `7b58e075368b6a125d6c30cdb14e9fd6731aaed8` (initial route integration), `3f6f568f0a774410926d20c3181b6495c860dc5a` (newline formatting correction), `878890da6e095c1485a3d977f96aecbb3edf026e` (static regression test).
- **Important limit:** this enables read/context access in interactive chat; it does NOT yet register `whatsapp.send`/`whatsapp.history` in the shared executable tool runtime. Interactive AI-initiated outbound messages still require a shared authorized tool/approval path. Existing inbound worker auto-response and outbound queue are separate.
- **Verification:** GitHub source readback only. Tests, typecheck, build, browser/chat behavior, database state, Meta webhook delivery, outbound send and deployment have NOT been run or verified. Do not claim end-to-end enablement until those are completed.
- **Next:** continue shared tool runtime integration using fresh persisted agent/account binding and connected-status checks; implement history + outbound tool behind current allowlist, permission, approval/template compliance and audit path. Do not wait for CI/Vercel; report runtime/deployment validation as pending to OPS-01.


- **Follow-up source corrections:** route template literal/interpolation corrections are in `200447d3c1e53c6778b0eee29bb7e35e90fd4354` and `eb5228770df377edd99ed9b902637fe7ad3331c0`; the final route blob read back as `5e70c07803fa2f2f2495dc454cf5b256034907cb`. These are source readback checks only, not executable verification.


## DEV-01 — WhatsApp history runtime (2026-10-17)

- Added `apps/worker/src/agent/whatsapp-tool-runtime.ts`: read-only `whatsapp.history`, strict organization and active-agent binding, connected/non-deleted account filtering, bounded result size, permission and execution-time allowlist checks, and audit writes.
- Added `apps/worker/tests/whatsapp-tool-runtime.test.ts` static regression assertions.
- Source commits: `637bb72ce0d5c988468f418ef6e36d24251e712b`, `de8fc4c8f1603e4e8f68b449a35c25ab841e35a0`, `ebd57c7cf947d7f9726bb98ac4c04b74151af42b`.
- This runtime is not yet invoked by interactive `/api/chat/stream`; the previous route-level read-only context is still the chat path. Do not expose this tool to chat until host-authenticated tool-loop wiring is complete.
- `whatsapp.send` is deliberately not registered: WhatsApp-specific approval persistence and Meta template-compliance enforcement are not yet connected.
- Source readback only; tests, typecheck, build, database, browser, Meta and deployment checks remain unrun.
- Next: wire the authenticated shared tool-call loop to chat; then implement an approval/template-compliant WhatsApp send path before registering outbound send.


## FIX-01 — WhatsApp template row nullability build correction — 2026-10-18

- User's `bash scripts/update-and-up.sh` output: worker image built/exported; Next.js web compilation succeeded, then type validation failed at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119` because `synced.rows[0]` may be undefined.
- Root cause: checking `synced.rows.length` does not narrow a subsequent indexed access under strict TypeScript.
- Correction: bind `synced.rows[0]` to `syncedTemplate`; if absent, return the existing fail-closed 409 `template_not_synced` response; read components from the narrowed local. Added regression source assertion.
- Commits: `90fac5e0774b695446e1e0c3ab51072639ba5f06`, `41734923651b1173a703d747f0ac0aa93317a5b9`.
- Verification: post-fix build and test pending; do not claim success from source changes alone.
- Next: pull latest main, run `bash scripts/update-and-up.sh`; if green, run focused `whatsapp-send-approval.test.ts`. Continue addressing any new source compiler error narrowly. OPS-01 owns only separate host-toolchain/deployment environment defects.


## FIX-01 — Voice workspace duplicate generation identifier — 2026-10-18

- **Observed failure:** Web webpack parser error: `Identifier 'generationId' has already been declared` in `apps/web/src/app/ai-voice/voice-workspace.tsx`; worker image was built/exported.
- **Cause:** Duplicate declaration inside the Sarvam/ElevenLabs provider TTS fallback branch.
- **Correction:** Reuse the already-computed generation identifier. Regression test asserts one declaration within that branch. Commits: `f6efffdb42dbd75df38841fab43b985eb565ee3f`, `05519965adae7ebab837a03e4d7a0d2306e3f0c1`.
- **Verification:** Post-fix build/test pending; no PASS claim.
- **Next action:** Pull latest main, run `bash scripts/update-and-up.sh`, then focused `voice-realtime-transport.test.ts`; address the next source error if any. Keep unrelated feature work untouched.



## FIX-01 — Voice audio resampling indexed sample nullability — 2026-10-18

- **Observed failure:** User's Docker build compiles Next.js successfully, then type validation fails at `voice-workspace.tsx:331` because `input[i]` is `number | undefined`.
- **Correction:** Same-rate conversion defaults a missing sample to zero; downsampling accumulation also guards indexed reads. Commits: source `baa9746142297322c5bf796e7c6fb94060bbc9cf`, regression `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Verification:** Post-fix Docker build and focused voice test pending; no PASS claim.
- **Next:** Pull latest main, rerun `bash scripts/update-and-up.sh`; if build succeeds, run focused `voice-realtime-transport.test.ts`. Keep fixing subsequent source compiler errors narrowly, without waiting on unrelated CI gates.

## Current next action — strict web typecheck corrections (2026-10-18)
- FIX-01 committed guards for all newly reported indexed PCM/WAV samples, explicit fail-closed voice-turn membership narrowing, a string-only conversation ID fallback, and safe WhatsApp template-selection destructuring.
- Regression source-contract assertions were extended in voice-realtime-transport.test.ts and whatsapp-send-approval.test.ts.
- Relevant issue: ISS-034. Source commits: 1fb04529, 9a9e09ee, 5946168a; tests: 57618396, fee2a239.
- **Verification boundary:** User output is pre-fix. Post-fix typecheck, focused tests, Docker build, and deployment are pending. Do not claim a green build from commits alone.
- **Next:** git pull --ff-only origin main, run pnpm typecheck, then bash scripts/update-and-up.sh; continue with any new source errors and record actual results.

## OPS-01 — Manual deploy Compose CLI compatibility — 2026-10-18

- **Current evidence:** User's manual deployment successfully builds worker and web images; Next.js production build completes. The script then fails before migrations because installed Compose rejects `config --environment`.
- **Source correction on main:** `scripts/manual-up.sh` now falls back to host `DATABASE_URL` or the concrete `DATABASE_URL` value in `.env` if the Compose CLI lacks that option; unresolved interpolation/missing URL remains a hard failure and the URL is never printed. Commits: source `a93176b3cbba730c30a016b4e47a9dd3dd46039c`, regression test `0386f03fa9534ff2d53db84b7ffbd2b5fe864154`.
- **Next:** Pull latest main, run `node --test scripts/tests/manual-up-compose-env.test.mjs`, then `bash scripts/update-and-up.sh`. Confirm migration and container startup from actual output. If Compose still fails, capture only the error text (no environment values/secrets).
- **Verification boundary:** Docker image builds are verified by the user's log; the compatibility test, migration chain, stack startup, and live runtime are not yet verified. Continue independent source work without waiting on unrelated CI/Vercel gates.

## OPS-01 — Manual Compose env-file startup correction — 2026-10-18

- Latest user log: image builds passed; migration runner completed with 6 applied and 62 skipped; Compose startup failed because `../.env` resolved to a missing parent-directory file.
- Corrected both `docker-compose.yml` service `env_file` paths to repository-root `.env` (commit `5072621a66eab0016bf8c29e76df8683070baa14`) and added regression source (commit `2649466dd53f5a545bfaa2dd52ecaa9df959ba00`).
- Exact next action: pull latest `main`; run `node --test scripts/tests/manual-up-compose-env.test.mjs`; then run `bash scripts/update-and-up.sh`. Capture Compose startup and `ps` results, and check service health before claiming deployment success. Do not share secrets or database URLs.
- Verification status: source committed; test and post-fix startup not yet verified.

## DEV-01 — ElevenLabs documented STT catalog correction — 2026-10-19

- **Focused correction on main** after user's TTS/STT `provider_configuration_required` evidence. This response means no enabled capability-specific key was accessible at the local auth/key gate; it does **not** prove vendor model availability. Existing explicit confirmation-only reuse from a saved ElevenLabs Realtime key remains the correct setup path where eligible.
- **Source updated:** `elevenlabs:tts` remains vendor-live `GET /v1/models`; `elevenlabs:stt` now offers **vendor-documented** batch `scribe_v2`, only after same org authorization and saved enabled STT key gate, labeled `source:documented`, `capability:batch_stt` (not fabricated live). Realtime WebSocket `scribe_v2_realtime` remains separate. UI and Node/Vitest model-catalog cases updated.
- **Evidence:** 15/15 fresh GitHub source-contract checks PASS; new tests **not executed** in full checkout; live ElevenLabs HTTP/auth, database, Next builds, browser and production not verified. User-pasted cookie must be revoked; never replayed/stored.
- **Exact next:** Execute `node --experimental-strip-types --test apps/web/tests/live-model-catalog-standalone.test.mjs`, web focused Vitest `tests/live-model-catalog.test.ts tests/elevenlabs-voice-credential-reuse.test.ts`, web typecheck/build, worker/Clara tests, DB typecheck and migration check in authenticated equipped main checkout; then validate Voice Chat TTS/STT key reuse/save/reload and vendor requests after OPS approved deployed revision. **Keep the C2 catch-up source-manifest/coverage selection plan at the top of this file as the primary DEV-01 project continuation**; this repair does not activate C1/C2.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-STT-CATALOG-20261019.md`. FIX-01 runtime/security, OPS-01 deployment/build-rate-limit boundaries unchanged.

- **DEV01 provider-setup remount follow-on (2026-10-23):** `5e651365` test and `ac1eaeaa,da4d8696` implementation prevent transient prior vendor model/secret editor state on org/category/provider navigation. Updated 20/20 isolated source test callbacks, 6/6 helper behavior; native suite and deployment still pending. Execute exact provider setup commands in the top DEV01-AI-PROVIDER-SETUP-REDESIGN-20261023 checkpoint without waiting for CI/Vercel.
