## DEV-01 — Catch-up / Routines: exact continuation — 2026-10-18

**Latest owner priority:** Plan useful personal email catch-up and assistant-managed schedules/automations with optional scoped WhatsApp digests. Plans are now concrete; no feature implementation/activation or phase transition occurred in this slice.

1. Read [session DEV01-CATCHUP-ROUTINES-20261018](sessions/DEV01-CATCHUP-ROUTINES-20261018.md), [design](../superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md), [Catch-up plan](../superpowers/plans/2026-10-18-personal-mail-catch-up.md) and [Routines plan](../superpowers/plans/2026-10-18-assistant-routines-and-digests.md). Review personal access grants, separate routine coverage, template-bound consent, all-source revalidation and submission/revocation semantics. Owner already selected once-per-exact-scope consent; do not ask that preference again.
2. After owner/architect approval of the proposed design/implementation scope, begin **Catch-up C1**: failing cross-user/org/agent/account tests, private summary/grant schema, trusted scope resolver and off-by-default configuration. Recheck current main and available migration numbers first. Use existing checkout/main; no new branch/worktree/PR. Pure contracts/time calculations and the C4a test harness can proceed while separate dependencies are resolved.
3. FIX-01 receives `HOF-DEV01-FIX01-SCHEDULER-RELIABILITY-20261018` and `HOF-DEV01-FIX01-AUTOMATION-TENANCY-20261018`; new routine execution/event activation stays blocked on affected correctness/tenant proof. OPS-01 receives `HOF-DEV01-OPS01-DIGEST-VALIDATION-20261018` for isolated DB/browser/provider prerequisites, not an instruction to deploy now. Preserve ISS-026/#36/#26/ISS-037 ownership.
4. Preserve concurrent **native streaming tool-call/final answers** source integrated from main `959ff5a6`; it is no longer wholly unimplemented. Final local typechecks/web build pass; focused runs total **91 passed, 1 failed**. FIX-01 receives `HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018` for duplicate completed IDs and result-name mismatch in the final-prompt builder. Do not weaken the failing test. SQL/browser/provider/full-suite checks remain unexecuted. Earlier 41/41 belongs only to ba9e948b. Do not repeat obsolete toolchain recovery or claim delivery/tenant acceptance.

Record each future slice's actual tests, blockers, commit and exact next action. Do not repeatedly wait on CI/Vercel/review when unrelated authorized product work exists. Current general WhatsApp per-message approval remains unchanged until a separately reviewed narrow digest-grant implementation passes its gates.

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
