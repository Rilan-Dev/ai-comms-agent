## DEV-01 — C3 focused host checks PASS, disposable DB pending — 2026-10-20

User-host at fast-forwarded `daa89ffd`: **29/29** C3 Node regression tests pass (0 failed/skipped/cancelled; ~774ms); four successful `tsc --noEmit` executions for db, clara-core, email-agent-runtime and worker; pnpm native binary notice only. New source commit `4cda8ee5` adds five **unexecuted** disposable PostgreSQL integration subtests for multi-mailbox manifest/batch, cross-user/tenant denial, grant revocation, content revision and stale lease. **DB tests, full suites, builds, production and C4 browser acceptance remain NOT RUN.** Source record: [C3 host verified and DB gate](sessions/DEV01-C3-HOST-VERIFIED-DB-GATE-20261020.md). No worker registration/activation.

---

## DEV-01 — 2026-10-20, C3 host tests and multi-mailbox correction

**PASSED per owner host console:** 27/27 existing focused worker C3 tests, no failures or skips (run SHA not shown). **PASSED as code inspection only:** corrected canonical loader uses full manifest mailbox set and requires claim subset; new two regression cases committed at `f036d6bf`. **NOT RUN after fix:** 29 expected focused tests, TypeScript, disposable PostgreSQL integration, full suite and C4 browser. Do not transfer the earlier pass to the new commit. [Session](sessions/DEV01-C3-MULTI-MAILBOX-BATCH-SCOPE-20261020.md). No product activation.

---

## DEV-01 C3 integration source-only checkpoint — 2026-10-20

C3 work on main `1bae80c8`, `8f382ead`, `464ab70d`: 11/11 read-only GitHub source contract assertions PASS for grants, lease, sources, Clara isolation, retry, partial coverage and unregistered status. **NOT RUN:** new 11 C3 wiring tests, prior six worker tests, TypeScript, full package tests, SQL fixtures, builds or authenticated browser. Shell GitHub DNS/checkout/pnpm missing. This is not production acceptance or a substitute for running the tests. Source record: [DEV01-C3-CANONICAL-CLARA-20261020](sessions/DEV01-C3-CANONICAL-CLARA-20261020.md).

---

## DEV-01 current handoff — 2026-10-19, final repository synchronization

See [current handoff](sessions/DEV01-CURRENT-HANDOFF-20261019.md) for completed, in-progress, pending and next work. C1/C2 focused implementation is complete; C3 worker/grounding integration is next, then C4 authenticated UX acceptance. Phase 4 remains implementation_in_progress. Latest upstream operator/vector fixes preserved; affected checks pass 35/35 and 11/11. Earlier full-suite counts are a pre-final-merge baseline. Security follow-up remains open. Existing entries retained as history.

---

## DEV-01 — C2 integrated and verified — 2026-10-19

C2 immutable selection, scoped review, snooze and fenced batch recovery are implemented. Concurrent upstream catch-up UI/generation and OPS work preserved; canonical services reconciled, migration0052. Final34SQL/25domain/37web/3integrity checks pass; typechecks, web build and migration structure pass. Full worker/web suites still fail; see [C2 session](sessions/DEV01-CATCHUP-C2-20261019.md). Upstream obfuscated build hooks were removed; [security follow-up](sessions/FIX01-OPS01-BUILD-HOOK-INCIDENT-20261019.md) remains open because credential exposure is uncertain. **Exact next action:** complete C3 worker/grounding/recovery integration using existing generation helpers, then authenticated C4 UI acceptance. Feature remains off by default; no deployment or routine activation. Older checkpoints below are historical.

## DEV-01 — 2026-10-19 operator fresh-migration safety (source-level only)

- Started GitHub `main` `72732585895e44e8cac32b5fbc8146253dec4a5f`. Existing migration and release wrappers found; enhanced `--allow-fresh` to reject occupied or indeterminate databases via read-only PostgreSQL relation inspection. New core and wrapper regression tests authored; runbook updated. All changes committed on `main`, no branch/PR.
- **Executed:** 18/18 read-only source-contract assertions on actual post-commit GitHub file content passed, including preflight-only scope, safe catalog SQL, unrelated extension exclusion, backup/DB/ledger checks preserved and test coverage.
- **NOT EXECUTED:** New Node test suite, live PostgreSQL integration (including false-fresh occupied target), updated web/worker/Clara full suites, container build, migration `plan` with actual DB, backup/restore validation, apply/verify, provider tests, deployment. Source inspection is not migration acceptance.
- Operator's earlier test attempt reported offline Vitest RPC DNS (issue #38) and worker SIGKILL; no production database was changed in this assistant session. Operator must rerun full suite and validate backed-up exact target before migration.
- Session `docs/project-control/sessions/DEV01-MIGRATION-FRESH-TARGET-SAFETY-20261019.md`, runbook `docs/runbooks/OPERATOR-MIGRATION-20261019.md`, exact operator commands in `NEXT_ACTION.md`.

---

## 2026-10-19 — DEV-01 operator log verification (preflight successful, migration NOT RUN)

- Operator-host log: 29/29 operator unit tests, migration structure check, cached Docker web image build, 6 project TypeScript checks, 26/26 Clara Core unit tests PASS. **Offline web Vitest DNS rejection** and worker parallel **SIGKILL** abort release before DB identification/backup/migration. Do not call this a TypeScript build failure or database migration failure.
- DEV-01 repaired two independently confirmed source contract bugs on main: adapter control-character RegExp was double-escaped and falsely rejected normal IDs (source SHA `6e7dd84e5b3a3ddc745610662d6deffdeab62c6d`); knowledge SQL test expected `$4` where current runtime binds keyword query `$3` (test SHA `8a50d61e00163367beac977166535557c0f69d2f`). Added control regressions (test SHA `9e9904ae6ef55f0e016a85966d35eb2810bbb73d`).
- Executed current GitHub source checks including actual JS RegExp evaluation: 6/6 PASS. **Not run after fixes:** actual Node/tsx worker test suite, full web Vitest, production build against updated SHA, live migrations, provider/browser acceptance. Environment cannot resolve private github.com through shell or access operator Docker host.
- OPS-01 issue #38 for unexpected `eth-mainnet.public.blastapi.io` DNS while tests are intentionally isolated; no network/credential bypass. Session `docs/project-control/sessions/DEV01-OPERATOR-TEST-TRIAGE-20261019.md`; exact diagnostics in `NEXT_ACTION.md`.


---

## 2026-10-19 — Operator single-command release wrapper — SOURCE ONLY

- New direct-main `scripts/operator-one-shot.sh` (web build, full package tests/typechecks, migration read-only plan, external backup confirmation, guarded apply/ledger verify, opt-in Vercel or approved production Docker startup), regression suite `scripts/tests/operator-one-shot-script.test.mjs`, runbook `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`.
- **ACTUALLY CHECKED:** 20/20 current authenticated GitHub source-contract safety assertions PASS. New committed Node suite checks Bash `-n`, non-interactive refusal, preflight ordering, database/backup prompts, Vercel and Docker dev identity guards.
- **NOT EXECUTED:** New Node suite itself, exact Bash syntax in real shell, Docker web/worker builds, full pnpm, real DB plan/apply/verify, independent backup creation/restore test, Vercel CLI deploy, environment/prod health, authenticated provider or E2E. No production acceptance or target state asserted. OPS-01 operator executes; Vercel build-rate-limit remains external.
- **Source:** `scripts/operator-one-shot.sh`; **operator runbook:** `docs/runbooks/ONE-SHOT-OPERATOR-RELEASE-20261019.md`.

---

## 2026-10-19 — Manual migration plan source preflight corrected, operator DB still UNVERIFIED

- **User-reported BEFORE fix:** 14/14 migration tests PASS and Docker Compose web image built; `operator-migrate.sh plan` FAILED in `verify-migration-chain.sh` duplicate object grep. This occurred BEFORE any database connection from the wrapper; do not mark a migration as attempted.
- **Patch source on main:** replaced erroneous duplicate `CREATE TABLE IF NOT EXISTS`/enum grep with Node checker for repeated unconditional DDL. Existing historical IF NOT EXISTS and guarded `DO` are permitted; SHA ledger drift/unknown/relation safety checks remain in `operator-migration-check.mjs`.
- **ACTUALLY EXECUTED in assistant's isolated runtime:** Node v22.16 `--check` of new helper (exact committed blob SHA `e1518eff9be87adb9dc7dba633ce02c50958d149`), 3 direct parser fixtures PASS, equivalent source structural shell fixture (idempotent duplicates PASS; unsafe duplicate rejected). **70** repository migration files source-inspected via authenticated GitHub batches; bare DDL candidates had no duplicate names. Assistant's local shell copy not byte-identical to actual committed shell: this is limited fixture evidence, not full checkout integration test.
- **NOT EXECUTED:** New complete Node test suite, full `verify-migration-chain.sh` over all 70 SQL files, `operator-migrate.sh plan` against operator's live DB, ledger checks/checksums, apply/verify, production app/deploy. Never count user pre-fix tests as post-fix acceptance. Await operator's redacted read-only plan output.
- **Next:** See `NEXT_ACTION.md` and `docs/project-control/sessions/OPERATOR-MIGRATION-DUPLICATE-STATIC-CHECK-FIX-20261019.md`.

---

## 2026-10-19 — operator migration scripts: source prepared / execution pending

- Source added on direct main: `scripts/operator-migrate.sh` (read-only plan/verify, backup+database-target gated apply), `packages/db/operator-migration-check.mjs`, `packages/db/operator-migration-core.mjs`, tests and operator runbook. No new SQL migration is necessary solely for ElevenLabs TTS/STT 409; no silent encrypted API key copy.
- **Actually checked:** 17/17 fresh GitHub source-contract checks for target validation, ledger version/checksum drift, no reset/deploy, Docker internal network, read-only SQL mount, backup and fresh-DB gates, fail-closed runner warnings. These are static assertions, not executable tests.
- **NOT RUN:** new `node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs` suites, actual `bash -n`/Node --check in checkout, Compose image build, PostgreSQL connection or ledger query, backup validation, SQL migration, web/worker/DB/Clara tests, deployment or authenticated ElevenLabs provider checks.
- **Operator handoff:** `docs/runbooks/OPERATOR-MIGRATION-20261019.md`, `docs/project-control/sessions/OPERATOR-MIGRATION-SCRIPT-20261019.md`. OPS-01 owns deployment/migration execution. Do not assert live acceptance.

---

## 2026-10-19 — DEV-01 ElevenLabs TTS/STT 409 recovery (source implemented; deployment pending)

- **Source committed on main, no branch/PR:** Explicit model-picker recovery for `provider_configuration_required` when eligible ElevenLabs Realtime secret exists (TTS/STT separately scoped), missing-purpose key remediation, distinct encrypted key failure. Existing explicit confirmed server key-reuse endpoint retained (organization.update, source decryptability, no overwrite of disabled/already saved target).
- **ACTUALLY EXECUTED:** 8/8 isolated Node behavioral checks on helper whose bytes match GitHub SHA `3108547c5ebe73975fee37198e71a69afc1b21c5`; isolated TypeScript helper tsc PASS; 15/15 live GitHub source assertions PASS (auth-before-catalog, no silent credential copy, picker abort guard/reuse button, both purpose callbacks, explicit server permission/audit).
- **NOT EXECUTED:** whole new Node regression file/complete repository tests, full web/worker/DB/Clara pnpm typecheck/build, migrations, real ElevenLabs API with live credentials, authenticated browser/tenant negatives, deployment. A 409 is still the correct return until an authorized admin saves or explicitly reuses an eligible TTS/STT credential. OPS-01 host/Vercel build-rate-limit remains; user-exposed session cookie should be revoked, never used.
- **Session:** `docs/project-control/sessions/DEV01-ELEVENLABS-TTS-STT-CATALOG-RECOVERY-20261019.md`.

---

## DEV-01 — 2026-10-19 ElevenLabs Voice Chat purpose preflight (source PASS; deployment pending)

- On direct main: `voice-credential-preflight.ts`, AI Provider Setup save preflight and read-only Realtime metadata retention, provider-config PUT explicit keep-key existence check. Previous Realtime→TTS/STT reuse endpoint unchanged; no hidden key or cross-tenant fallback.
- ACTUAL executable isolated Node v22.16 tests 8/8 PASS (pure TTS/STT credential readiness cases); isolated TS noEmit PASS for exact file with Git SHA `5ff3d09e82186e0161807ade6d995bf54b9a1bd1`. Current authenticated GitHub source predicates 10/10 PASS. New `elevenlabs-voice-save-validation.test.mjs` complete test suite authored but not dynamically run against the full repo.
- NOT RUN: full pnpm/Vitest, Next/worker/Clara/DB builds or migrations, live provider, browser, real organization secrets or deployment. Existing earlier `provider_configuration_required` response was at *local saved-purpose credential gate*, not proof of ElevenLabs provider model outage.
- Recording `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-PRESAVE-GUARD-20261019.md`; next commands `NEXT_ACTION.md`. No new branch/PR. OPS-01 owns deployment/build-rate-limit; FIX-01 unrelated transport/runtime/security.


---

## 2026-10-19 — DEV-01 ElevenLabs TTS live / Scribe STT documented source (limited check)

- **Committed directly to main (no branch/PR):** truthfully separate live TTS `/v1/models` from Scribe batch `scribe_v2` documented STT; return documented STT only after org authorization and saved enabled purpose-key gate, keep disabled/missing key 409, independent Realtime Scribe v2 WebSocket label, opt-in existing credential reuse. Updated selector UI and Node/Vitest tests.
- **ACTUALLY CHECKED:** 15/15 deterministic current GitHub source assertions PASS (source/capability, credential gate ordering, no-store, selector validation, existing reuse, updated test code).
- **NOT RUN:** Modified Node/Vitest dynamic suite, pnpm TypeScript/Next/worker/DB/Clara tests, PostgreSQL/migration, real TTS/STT provider account, browser and deployed production check. Previous C1/Postgres source verification was on a different revision, not automatically applicable here. Vercel build-rate-limit remains an OPS-01 rollout concern.
- **User secret:** Pasted session token is potentially exposed; do not reproduce or reuse; user must invalidate session. Details/commands: `docs/project-control/sessions/DEV01-ELEVENLABS-STT-CATALOG-20261019.md`.


---

## 2026-10-18 — DEV01-CATCHUP-ROUTINES final integrated-source verification

- **Upstream source:** `959ff5a6c055baf9a1f14af5d29c5f51643b77c0`, integrated without changing concurrent product source. This session changes documentation only.
- **PASS:** all six workspace typechecks; production web build; web Vitest 31/31, worker focused 23/23, SSE/verified-answer Node 13/13.
- **FAIL:** Clara package tests 24/25. Combined focused result **91 passed, 1 failed**; no full-suite claim.
- **Defect:** `tool-result-final.test.mjs:32` expects duplicate rejection; exact fixture fails closed differently, but completed ID reuse and declared/result-name mismatch are accepted by the helper in direct unit probes. FIX-01 handoff `HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018`; no live bypass demonstrated.
- **NOT RUN:** DB/RLS/crash tests, authenticated browser, live provider/WhatsApp, full suite/lint, worker build, CI/deployment. New catch-up/routine tests are planned only.
- **Documentation:** two independent reviews completed with no remaining blocking design contradictions; links/fences/scope/secret-pattern/whitespace checks passed. No push/deploy.
- [Exact session/evidence](sessions/DEV01-CATCHUP-ROUTINES-20261018.md). The earlier 41/41 result below belongs to ba9e948b and must not be transferred to later source.

---

## 2026-10-18 — DEV-01 current-main baseline and catch-up/routines proposals

```yaml
session: DEV01-CATCHUP-ROUTINES-20261018
baseline: ba9e948b4b58a4f270d5382f919957843e6eecb5
scope: existing source verification plus documentation-only proposed design/plans
frozen_dependency_install: passed
workspace_typecheck: passed_all_six_script_bearing_packages
web_production_build: passed
focused_tests:
  sse_node: 5_passed
  web_vitest: 25_passed
  worker_scheduler_automation: 11_passed
  total: 41_passed
full_suite: not_run
lint: not_run
worker_build: not_run
database_migrations_rls_crash_tests: not_run
authenticated_browser_and_live_providers: not_run
ci_deployment: not_run
new_feature_tests: planned_not_implemented
phase_acceptance: unchanged_pending
```

Exact commands, local log paths, source-audit findings and limitations: [session](sessions/DEV01-CATCHUP-ROUTINES-20261018.md). Many selected tests assert source contracts; a pass does not establish scheduling recovery, event tenant safety or WhatsApp delivery. Earlier inability to run these selected checks is superseded for this checkout/baseline only. No new product source, dependencies or migrations changed. Plan review corrected independent routine coverage, all-source reads, grant/template scope, quiet hours, multiple obligations and browser harness requirements.

## DEV-01 — 2026-10-19 explicit UTC date-range mail reports

- Direct-`main` source and tests for `YYYY-MM-DD to YYYY-MM-DD`, conservative fail-closed filters, 366-day max, tenant and agent read permissions, 500-message counted coverage, exclusive final UTC date and accurate local-sync caveat. Separate product slice from FIX-01's 24-hour incident repair; no branch/PR/deployment.
- **EXECUTED:** Byte-matched current GitHub blobs `explicit-date-range.ts` `979dd2cca7e26bcc255e7c66a5566ada3b529d72`, `rolling-summary.ts` `d5e23f8649e5a1820bfd3db85ace0393108b576c` and Node tests `46f0cf9fdbb3492619a529b78160fdfea9c5647a`/`bd9cffc8264c11be06d495dc3dba024b21935494`: **16/16 Node PASS** (new 8 + old 8); both module global `tsc --noEmit` PASS; **19/19 source contracts** PASS. Date-range changes preserved existing 24-hour report byte output in tests.
- **NOT executed:** Full Vitest/Next app/worker/Clara/db pnpm typecheck/build, actual SQL against PostgreSQL, provider sync, browser, multi-tenant runtime denial, microsecond last-day DB row, migration/deployment. No production acceptance. Previous credentials exposed by user remain owner-revoke/rotate action; none used.
- Session `docs/project-control/sessions/DEV01-EXPLICIT-DATE-MAIL-20261019.md`; exact commands in `NEXT_ACTION.md`.

---

## FIX-01 — 2026-10-19 rolling 24-hour mail summary correction

- **Source:** `apps/web/src/lib/mail/rolling-summary.ts`, `apps/web/src/app/api/chat/stream/route.ts`, Node regression `apps/web/tests/rolling-mail-summary.test.mjs`, Vitest contract `apps/web/tests/chat-rolling-mail-summary.test.ts`. Direct main, no branch/PR, no deployment.
- **Executed:** Node v22.16.0 **8/8 PASS** for exact committed helper/test SHA `edc3c5c2091d260ec2f25a80b2a9fa8a098809a2` / `bd9cffc8264c11be06d495dc3dba024b21935494` (first run 7/8 revealed email domain truncation; repaired, rerun green). Global `tsc --noEmit` on exact helper PASS. **15/15** authenticated GitHub route/helper invariants PASS. Tests include 37 unread message coverage, >500 truthful partial result, sender/topic filters, no-data caveat.
- **NOT run:** new Vitest, whole repo TypeScript/pnpm/Next build, actual PostgreSQL SQL, live inbox/authorization E2E, server or production deployment. No trustworthy live mailbox counts can be stated.
- **Session:** `docs/project-control/sessions/FIX01-ROLLING-MAIL-20261019.md`; exact next commands `NEXT_ACTION.md`.


---

## 2026-10-19 — DEV-01 ElevenLabs missing TTS/STT capability credentials (source-only verified)

- The reported production 409 `provider_configuration_required` was traced to per-purpose encrypted provider config rows. Existing Realtime key is **not** a valid TTS/STT config unless owner explicitly opts in to secure same-org reuse. This 409 is before the vendor call and does not prove real ElevenLabs availability or deployment SHA.
- **Source on main:** auth-guarded, audit-recorded `POST /api/settings/ai-provider-configs/reuse-voice-key` using atomic encrypted DB copy only for missing enabled TTS/STT; no overwrite of saved secrets/models or disabled capabilities. Realtime metadata loaded only to show explicit Voice Chat reuse action. Missing/disabled/decrypt failure messages differentiated and no cross-purpose automatic fallback. Saved encrypted key detection fixed. New Vitest suite added.
- **ACTUAL evidence:** 29/29 current authenticated GitHub source contract checks PASS, exact source SHAs recorded in session. **NOT ACTUALLY RUN:** new Vitest, full pnpm web/worker/DB/Clara typechecks/tests/builds, SQL against live Postgres, migration, vendor TTS/STT API, browser session, secure cross-tenant negative, deployment. Shell lacked full checkout/pnpm and failed GitHub DNS. GitHub HEAD Vercel `failure` target still build-rate-limit; this is not a compiler diagnosis.
- **Session/next:** `docs/project-control/sessions/DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019.md`, `NEXT_ACTION.md`. No branch/PR, no production deployment.


---

## 2026-10-18 — DEV-01 direct final read-tool SSE (source done, full acceptance pending)

- **Implementation on main:** `claraRuntime.streamAuthorizedReadOnlyToolAnswer` takes completed host tool history and outputs real provider tokens with no executable tools. Chat/Voice call it after 1–4 all-success registered and audited read-only calls; writes, denials, pending approval and legacy voice JSON unchanged. Removed the extra canonical exact-copy model request from Chat/Voice paths. Host parser native OpenAI/Gemini tool-decision validation remains unchanged.
- **Actually executed:** Node v22 `--experimental-strip-types --test packages/clara-core/tests/tool-result-final.test.mjs` **7/7 PASS**, exact source blobs builder `f2c78e9a46b8449ff7b0b03b60c0da970c5b78f4` and test `d3a8ef1ce39de6682b7b7e771a3efadc0cf7ea2c`; global standalone strict TypeScript `--noUncheckedIndexedAccess` PASS with a minimal type-only stub. Initial 5/6 exposed a reused ID bug, now corrected and 7/7 passed. GitHub-source guard audit 18/18 PASS before final 4-tool cap/unsupported-fallback hardening (those fixes themselves committed).
- **Not executed:** New web Vitest regression and worker email loop cases; complete pnpm dependencies/web/worker/Clara/DB typecheck/Next build; live Postgres email reads, provider Chat/Voice/token timing, browser cross-org/agent and approval flows, migrations, Vercel/prod deploy. No full checkout, pnpm, authenticated originating browser. Tests here do not prove production readiness.
- **Evidence and commands:** `docs/project-control/sessions/DEV01-NATIVE-POSTTOOL-FINAL-STREAM-20261018.md` and `NEXT_ACTION.md`.

---

## DEV-01 — OpenAI/Gemini streamed tool-call assembly: 2026-10-18

- **Comitted source on main:** `packages/clara-core/src/tool-call-stream.ts` and `gemini-tool-stream.ts`, native SSE selection in Clara `chatWithTools`, provider mock integration cases in worker tests, and `@ai-comms-agent/clara-core` Node test script.
- **Actual executable evidence:** Exact Git SHA-matched parser + tests: OpenAI 10/10, Gemini 9/9, combined Node 19/19 PASS. Hashes: OpenAI source `57c2544a4ecb02642277dced07bdb3cbaab82e42`, tests `b41e8084acb83732579232806c1a5dd3025d9915`; Gemini source `a5a0ac5391302c48e14d174902c7b2451e698442`, tests `ca0fdf59e92427863788af3771aebf69d85da710`. Strict isolated `tsc --noEmit --strict --noUncheckedIndexedAccess` PASS using type-only stub.
- **NOT EXECUTED:** New worker adapter tests, full pnpm Clara/web/worker/DB typechecks/build, real API, Gmail/WhatsApp/Voice agent authorized end-to-end and cross-org approval, database, browser, CI and prod. Isolated parser tests do NOT establish source build or production acceptance. `stream:true` function decisions remain fully buffered before authorized execution; verified post-tool UI delivery still uses optional extra model pass, not direct streaming final tool model output.
- **Session:** `docs/project-control/sessions/DEV01-NATIVE-TOOL-SSE-20261018.md`; exact commands in `NEXT_ACTION.md`.

---

## DEV-01 — Abort + approval streaming gates: follow-up 2026-10-18

- **Current main source:** Optional abort `AbortSignal` passed to OpenAI/Sarvam and Gemini `fetch` from `streamCanonicalToolAnswer` through Chat/Voice requests; read-only stream eligibility rejected if tool output signals pending approval; new worker and Vitest regression cases committed.
- **ACTUALLY EXECUTED:** Exact Git blob-matched helper `ab488dfa888066bf86399cae7227ba3c996d24df` and test `33fae517247b47c5776796d4db83cfb5bb87965f` with Node v22.16: 8/8 PASS; `tsc --noEmit` exact helper PASS. Fresh-source 12/12 assertions on HTTP abort wires, approval gates and test content PASS.
- **NOT EXECUTED:** full pnpm web/worker/DB Vitest/typecheck/build, new source-contract Vitest cases, approval-shaped worker Node test, database migrations, live provider cancellation/first-token latency, browser/mailbox/tenant-negative E2E or deployment. No production acceptance.
- **Session/commands:** `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`, `NEXT_ACTION.md`.

--- 

- **Follow-up interruption cleanup:** `packages/clara-core/src/runtime.ts` now cancels the upstream OpenAI/Sarvam-compatible and Gemini reader in both model SSE generator finalizers when the host consumer returns early, instead of merely releasing its lock. Added source assertion in `apps/web/tests/verified-tool-streaming-contract.test.ts`. This was committed to `main` but is **not** yet provider/browser E2E tested.

## 2026-10-18 — DEV-01 verified post-tool provider streaming (partial tests only)

- **Main-only source:** `claraRuntime.streamCanonicalToolAnswer` (no-tools model token delivery), new pure `emitVerifiedToolAnswer` literal prefix/abort/fallback, Chat host read-only metadata and guarded tool answers, Voice completed/approval-free email read-only gating with same mechanism, worker read-only summary metadata. This is a *second read-only model pass* after the original tool loop, not native streaming function-call execution.
- **ACTUALLY EXECUTED:** Node v22.16.0 pure module regression **8/8 PASS** with exact source Git blobs `ab488dfa888066bf86399cae7227ba3c996d24df` and `33fae517247b47c5776796d4db83cfb5bb87965f`, isolated global tsc helper PASS, 16/16 current GitHub contract assertions PASS. No false completion on aborted requests, only canonical text displayed after provider hallucinations.
- **NOT RUN:** Authored `apps/web/tests/verified-tool-streaming-contract.test.ts`, updated worker `email-agent-loop.test.ts`, complete web/worker/DB TypeScript, pnpm Vitest/Next build, PostgreSQL migration/tenant integration, provider stream HTTP, browser Chat/Voice mailbox/WhatsApp, TTS timing, CI/deployed version. Environment lacks pnpm/full private checkout and authorized browser session. **No production acceptance.**
- Session: `docs/project-control/sessions/DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018.md`, commands `NEXT_ACTION.md`.

---

## 2026-10-18 — DEV-01 Mail Threads / progressive Chat+Voice text (LIMITED)

- **Source directly on main:** org-scoped Mail Threads SQL/index export/authorized API/server page/filter UI, Chat focus; SSE decoder and Chat delta/status/complete parser; token streaming for non-tool Chat and voice, native Gemini SSE, OpenAI/Sarvam EOF correction. Tool-backed answers remain final-after-tool by design; no unsafe speculative or fake streaming.
- **ACTUALLY EXECUTED:** Node v22.16.0 test on **exact file content matching GitHub blobs** `apps/web/src/lib/streaming/sse.ts` `a53568b7c1923b13ec3c2fe41d153da483ec28c8` and `apps/web/tests/sse-streaming.test.mjs` `31d793842f93bf0c1dbc21989f89b432a266eecd`: **5/5 PASS** including split UTF8, CRLF, final EOF and oversized event. Global standalone `tsc --noEmit` on SSE module **PASS**. Separately **23/23** static current GitHub contract assertions for new SQL filters/auth, UI, Chat/voice security and streaming presence **PASS**. Static assertions are not browser/API integration tests.
- **NOT RUN:** New Vitest suites `mail-threads-workspace.test.ts`, `streaming-conversations.test.ts`, full web/DB/worker typecheck+Next build, mail SQL on Postgres, migrations, live model tool SSE, real Gemini/OpenAI/Sarvam/ElevenLabs request, voice TTS, cross-org, browser/responsive E2E or deployment. No production acceptance; old CI/Vercel issues remain OPS-01.
- **Session/exact next commands:** `docs/project-control/sessions/DEV01-MAIL-THREADS-STREAMING-20261018.md`; `NEXT_ACTION.md`.


---

## 2026-10-18 — DEV-01 chat-first shell, embedded voice and rich mail preview — LIMITED VERIFICATION

- **Authored source on main:** Chat home/Overview alternate, sidebar order and Mail accordion, Chat lazy voice panel, existing voice component embedded props/teardown, thread SQL HTML alias, opaque sandbox/CSP mail preview and tests. No branch, PR, deployed release or phase transition.
- **Actually verified (not dynamic tests):** 14/14 source assertions against fresh GitHub file blobs for new routes, expanded Mail, header single offset, embedded voice open/close and cleanup, HTML reader alias and CSP, test existence. Not a browser/API or build PASS.
- **Not run:** Newly authored `apps/web/tests/workspace-shell.test.ts`; existing `apps/web/tests/mail-html-preview.test.ts`; full pnpm Vitest/worker, full web/worker typecheck/build, migrations, browser, connected mail HTML, provider microphone/WebSocket, tenant-negative tests, deployed SHA. No full dependency-equipped checkout or authenticated browser context in this environment.
- **Security:** FIX-01 issue #36 tracks HTML allowlist sanitization before provider data is stored; opaque iframe is a second-line protection, not an assertion that persisted HTML is safe. Previous 23/23 tests belong to an unrelated AI model slice and do not count for this UI.
- **CI:** User-linked run 39079140157 failed against earlier SHA `2cf9a522`; logs BlobNotFound, OPS-01. Do not transfer failure or acceptance to this slice. Plan `docs/plans/CHAT-FIRST-VOICE-MAIL-UX-20261018.md`; session `docs/project-control/sessions/DEV01-CHAT-FIRST-VOICE-MAIL-20261018.md`.


---

## DEV-01 — 2026-10-18 Chat-first and secure Mail preview source checkpoint

- **Executed:** 13/13 authenticated GitHub source-structure assertions PASS: root Chat route + Overview retained; Chat first, Mail submenu default open; single sidebar offset; existing embedded/lazy VoiceWorkspace and no parent escape toggle; opaque/no-same-origin email iframe and restrictive CSP; new Vitest source present. Exact files checked and hashes recorded in `docs/project-control/sessions/DEV01-CHAT-FIRST-WORKSPACE-20261018.md`.
- **Committed, NOT executed:** `apps/web/tests/chat-first-workspace.test.ts`, `apps/web/tests/mail-html-preview.test.ts`. No full Next/web/worker typecheck/build, real-browser/mobile/a11y, authenticated mail, voice transport/provider, CI or deployed validation in this turn.
- **Known serious security blocker:** email `html_body_sanitized` ingestion may store raw HTML; FIX-01 #36 owns sanitizer and historical rows. Opaque iframe+CSP does not replace server sanitizer. FIX-01 #26 voice end-state correctness. OPS-01 old CI failure on unrelated historical SHA `2cf9a522`, not current main.
- **Plan/session:** `docs/plans/CHAT_FIRST_WORKSPACE_REDESIGN_20261018.md` and `docs/project-control/sessions/DEV01-CHAT-FIRST-WORKSPACE-20261018.md`. Exact next commands in `NEXT_ACTION.md`.

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

## DEV-01 — 2026-10-18 annotated realtime model dropdown repair (source PASS, deployment pending)

- **GitHub commits on main, no branch/PR:** documented provider models `a1c25962`; authorized `source:documented` GET `50df9c1d`; UI `623932a1`/`281103ed`/`146495f1`; persisted model/relay wiring `22fca2b0`/`5475132c`/`4f6fdda0`; server PUT legacy rejection `6b12e0e2`; tests `11534f7d`/`bffa45e1`/`a087deec`.
- **ACTUALLY PASSED:** Node v22.16.0 standalone catalog 9/9 (6 prior vendor-mocked + 3 new documented), combined all four available portable suites **23/23 PASS** (exit 0); standalone global TypeScript 5.8.3 catalog `tsc --noEmit` PASS. Exact Git blob bytes match executed catalog + Node test: `70bdd8ca7483fb8f1e4d866cffff350242969aae`, `000a8062eead4646203ca46f8c18d7114c605189`. Current GitHub route/UI/voice integration source checks 13/13 PASS.
- **NOT RUN:** Full pnpm Vitest including new integration static tests, web/worker typecheck/build, migration execution, browser save/reload, provider API authenticated calls, Sarvam and ElevenLabs live WebSocket, cross-org negative runtime, deployed screenshot acceptance, Clara/Qdrant and E2E. Browser connector could not access originating tab; no private checkout or pnpm. Current Vercel status still `failure` with URL indicating build-rate-limit; not proof of compiler defect. CI manual-only, not triggered.
- **Note:** ElevenLabs current realtime transport = Scribe STT + host authorized agent + TTS. `elevenlabs-conversational` is a legacy catalog marker, not supported as realtime Scribe STT; native ElevenAgents agent IDs/signed URL transport are NOT implemented.
- **Evidence and exact commands:** `docs/project-control/sessions/DEV01-REALTIME-VOICE-MODEL-CATALOG-20261018.md`; `NEXT_ACTION.md`.

---

## DEV-01 — 2026-10-18 Clara email vector worker adapter test-runner correction

- **Source correction on main:** `apps/worker/tests/clara-email-vector-adapter.test.ts` Node-native test is now inside the worker test glob; old undiscovered `src/knowledge/clara-email-vector-adapter.test.ts` Vitest test removed. `apps/worker/src/knowledge/clara-email-vector-adapter.ts` now validates organization/account/message/source IDs and SHA-256 hashes before sending the server credential. Commits `1513f237`, `6cdde3fe`, `8bc21242`, `dccd8a7f`, `247e5a6c`. No branch or PR.
- **Actually run:** Node v22.16 `--experimental-strip-types --test` on four previously recorded portable files: 20/20 PASS (6 live-model mocks, 4 persisted runtime state, 5 provider setup status, 5 Clara vector read). Actual GitHub source/runner contract assertions 12/12 PASS. New adapter source SHA `b07e2b45f438b5f8cb0475837ced81b86a71a2ab`, Node worker test SHA `97e2e6abd070e45955e4c6a176bebf2772ff7a76`.
- **Not run:** Newly committed worker Node adapter test itself, all worker package tests, full pnpm web/worker typechecks, Next/worker builds, migrations, Clara/Qdrant API with credentials, browser/tenant, any prod/deployment acceptance. Shell has no private checkout/working git DNS/pnpm; CLI cannot run monorepo. Worker tests remain unverified until OPS-enabled CI/local checkout actually executes them.
- **Session / exact commands:** `docs/project-control/sessions/DEV01-WORKER-VECTOR-TEST-COVERAGE-20261018.md`; `NEXT_ACTION.md`.

---

## 2026-10-18 — DEV-01 Clara email-vector boundary / exact-source limited verification

- **Committed directly to main:** Search adapter security input/account scoping and `redirect: "error"` + safe URL requirements; mirrored redirect/URL safety in worker upsert/delete adapter; portable Node and worker Vitest regression source.
- **PASS — actually executed:** New Clara search portable `node --experimental-strip-types --test` 5/5, search exact Git blob `12ac7aad720f2d71b0a184eb4ac53d9cd7ea06df`, test blob `6a5142048d5cf76d8916daf49539733c9942cad7`, both match local git hash-object. Previous portable catalog 6/6, runtime form hydration 4/4, provider status 5/5 rerun together with new tests: 20/20 PASS. Exact search adapter `tsc --noEmit` PASS using local type-only declarations for Node and the import contract. Authenticated GitHub source-level inspection verified worker redirect/URL checks.
- **NOT EXECUTED:** New worker Vitest assertions, full monorepo web/worker typecheck or build, dependency installation, actual Qdrant/provider API, server credentials, cross-org production calls, browser, deployment/migration. Do not infer CI/production readiness from isolated tests.
- **Known dependency:** Clara PR #298 merged to Vite-Converted, but target deployment/version and Qdrant not verified. ISS-026 live endpoint acceptance and secure mail-account grants remain a gate; outbox not activated. OPS-01 owns Vercel/build/deploy toolchain.
- **Session:** `docs/project-control/sessions/DEV01-CLARA-VECTOR-BOUNDARY-20261018.md`.

---

## 2026-10-18 — DEV-01 organization-scoped provider UI correction (partial verification only)

- Source commits to `main`: `0fe7ce37` (provider setup), `f5407bf1` (chat provider), `a28bf2d5` (live-model select), plus portable tests `c7ac01fb`/`74a2fcca`/`e0931386` and Vitest `a94705cf`. No branch/PR.
- **EXECUTED:** Node v22.16.0 15/15 across previously committed vendor catalog, form hydration, provider status tests; `tsc --noEmit` exact three previously committed pure modules passed. Authenticated GitHub source checks for changed org-scoped provider forms and aborted response guard 12/12 passed (not dynamic UI tests).
- **NOT EXECUTED:** Newly added `ai-provider-organization-safety.test.mjs`, updated Vitest, full `pnpm` install, web/worker typecheck, Next build, browser/React, real provider API and model persistence, cross-tenant runtime negative tests, migrations, deployment. Browser connector could not read user tab in this chat due originating-context requirement. No production acceptance.
- Exact source blobs after correction: provider setup `a17a41f780fcb5b4ff4c3b22740fd73668dfe41c`, provider settings `7794ab839340bd46f85b444b69d53d0a2de8cfdb`, live model selector `ea4e5a7762b607d33fdb002c150622e00e2c9128`, new Node test `114464176f3f31491accae05d0468ae142bb1034`, Vitest `89f001c68eb458d0d86dbff34aeff5794825ecfa`.
- OPS-01/full checkout required for integration; full session `docs/project-control/sessions/DEV01-ORG-CREDENTIAL-ISOLATION-20261018.md`.


---

## 2026-10-18 — DEV-01 provider setup hardening (LIMITED EXECUTED CHECKS)

- All source commits on `main`, no branch/PR. Files: `ai-provider-setup-shared.tsx`, `provider-config-status.ts`, `provider-config-status.test.mjs`, `ai-provider-setup-safety.test.mjs`, `live-model-catalog.test.ts`.
- **PASS (executed locally):** 6/6 live-model catalog vendor mocked Node tests; 4/4 runtime hydration Node tests; 5/5 provider-status Node tests; isolated `tsc --noEmit` of the three exact pure modules. SHA identity confirmed for new status helper `7bbbf6c89e1686844675961a45219f6783d61044` and its Node test `5248d331af8122f1ab31112e1f0e603d2d779ad3`.
- **PASS (authenticated GitHub source checks, not browser):** 5/5 assertions on provider switching secret clearance, both selection controls, rejection of failed delete/reload, catalog refresh. Source after all changes blob `bd866815ac0f9a6b4b45dcce68acb152b37eaf9a`.
- **NOT RUN:** Newly added Node TSX-source-safety test against full repo, expanded Vitest tests, whole workspace/web/worker typecheck or Next build, browser/provider/tenant/approval end-to-end flows, deployment/migrations. No full production acceptance.
- **Block:** No dependency-equipped private checkout, pnpm registry/DNS or authorized provider credentials in this execution runtime. OPS-01 owns environment and latest Vercel build-rate-limit; details and exact next commands in `NEXT_ACTION.md`.
- **Session:** `docs/project-control/sessions/DEV01-PROVIDER-SETUP-HARDENING-20261018.md`.

---

## 2026-10-18 — DEV-01 direct-main runtime form correction / model catalogue limited tests

- PRs #34/#35: already merged. Latest owner instruction: **work directly on main; no new branches**.
- New source: pure `normalizeRuntimeSettings` maps all eight camelCase GET fields into snake_case POST/PUT form state; new-org server default realtime voice model is blank (no hard-coded selection). This prevents a reproducible source path that could overwrite saved KB, provider and policy settings with local form defaults.
- **ACTUALLY PASSED:** Node v22.16 mocked live catalogue 6/6, new runtime settings hydration 4/4, global TS 5.8.3 standalone compilation of exact two pure modules with zero errors. Verified all four committed Git blob hashes match executed local bytes: catalog `47c427b77c2dffe4555451ede58fec28b4dfe941`, catalog Node test `35e1521a0619430a784a351d42e400b08c13cf5d`, runtime mapper `35894c44325698c64d20d3939c85aa3a2f808390`, runtime test `c60e0201f9e88e10e5a8b290b4d9489dbda01e81`. Vitest assertions also added as source, NOT executed.
- **NOT EXECUTED:** pnpm Vitest, whole web typecheck or Next build, provider-authenticated HTTP, browser form save/reload, cross-org runtime isolation, Vercel/self-hosted deployment. Sandbox has no private GitHub checkout or npm/pnpm registry DNS. GitHub Actions CI currently manual-only; OPS-01 owns workflow/host and merged-PR Vercel `build-rate-limit` indicator.
- Full session `docs/project-control/sessions/DEV01-MAIN-RUNTIME-MODEL-20261018.md`. Do not mark product/release accepted from mocked tests.


---

## 2026-10-18 — Live model catalogue partial verification (DEV-01)

- **Merged feature:** PR #34 merged into main at `5413468fc1ff0ae0088796b25d01b680126e521c`. Original "not merged" statements below are superseded; full feature acceptance still pending.
- **Exact-source integrity:** Git blob `47c427b77c2dffe4555451ede58fec28b4dfe941` matches local module used for checks.
- **PASSED (limited scope):** Standalone module `tsc --noEmit` with TS 5.8.3, six mocked vendor/Node tests (6/6), and thirteen GitHub source/API/UI contract assertions (13/13).
- **Reproducibility:** `apps/web/tests/live-model-catalog-standalone.test.mjs` (locally executed and committed byte-identically, blob `35e1521a0619430a784a351d42e400b08c13cf5d`). `node --experimental-strip-types --test apps/web/tests/live-model-catalog-standalone.test.mjs`.
- **NOT RUN:** Repository Vitest suite, complete Next/web typecheck/build, UI/browser, actual provider credentials/HTTP, cross-tenant runtime, and production deployment. These are mandatory for completion.
- **Blockers:** Local private-repo/network/npm/pnpm unavailable; OPS-01 build/deployment has Vercel rate-limit status on merged revision. See session `DEV01-LIVE-MODEL-VERIFY-20261018` and new NEXT_ACTION. No phase or production acceptance.


---

## 2026-10-18 — DEV-01 live provider model catalogues (NOT VERIFIED)

- Branch: `feature/dev01-live-provider-model-catalog-20261018` from `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`; session `DEV01-LIVE-MODEL-CATALOG-20261018`.
- Evidence available: GitHub accepted source updates and mocked provider test source; reviewed Clara-AI-Platform `ai-governance/core/live-catalog.ts` reference.
- **NOT EXECUTED:** `apps/web/tests/live-model-catalog.test.ts`, `apps/web/tests/ai-runtime-settings.test.ts`, pnpm/web typecheck, Next build, live vendor model listing, browser form selection/persistence, cross-org negative check, deployment or production provider invocation.
- Provider coverage is source-proposed only. Unsupported catalogue purposes intentionally fail visibly; no static selection presented as live.
- Owner: DEV-01 for focused code verification and correctness; OPS-01 for dependency-equipped/live/deployment verification; architect for PR approval. No phase/release acceptance.

---

### Provider real-time email sync — 2026-10-16

- Branch: `feature/provider-realtime-email-sync`.
- Added visibility-aware inbox API refresh every 5 seconds; it pauses while the tab is hidden and refreshes on visibility return. Search/account/unread/action filters are included in requests.
- Added `docs/plans/PROVIDER-REALTIME-EMAIL-SYNC-PLAN.md` describing provider-specific push/IDLE mechanisms, recovery polling, security, tests, operational setup and acceptance criteria.
- Not run after these changes: web/worker tests, typechecks, build, browser verification, provider-to-DB ingestion, or production latency measurement.
- Provider event paths are not implemented by this UI change. Gmail Pub/Sub/watch renewal, IMAP IDLE listener, and validated Zoho webhook support remain planned; current automatic worker polling remains fallback.

### Gmail empty-inbox source fix — 2026-10-14

- Branch: `feature/imap-smtp-mail-actions`; PR #18 is merged into `main` (2026-10-15).
- Source fix: strip Google's `response-` prefix from Gmail batch response Content-ID values before mapping to the requested message ID.
- Source fix: acknowledge only IDs whose PostgreSQL persistence succeeded; retain failed IDs in the durable pending checkpoint and fail the sync attempt so it retries.
- Source fix: automatic incremental polling threshold changed from 15 minutes to 2 minutes. Gmail push/watch capability is now false until the Pub/Sub receiver is implemented.
- Regression tests added: `apps/worker/tests/gmail-batch-response.test.ts` and `apps/worker/tests/mailbox-sync-checkpoint.test.ts`.
- **NOT RUN after these edits:** new regression tests, full worker test suite, worker typecheck, build, live Gmail synchronization, database row-count verification, or deployment. Prior user output (114/114 and typecheck) predates these edits and does not verify them.
- OPS-01 must verify worker environment, intended shared database, RabbitMQ/Redis connectivity, and live import after deployment. Do not mark runtime success based on HTTP 200 or a connected OAuth badge.


### Email index lifecycle branch — 2026-10-14

- Source branch: `feature/email-index-lifecycle-v1` (not merged).
- Added stable account/provider/message source identity, content and metadata hashes, deterministic chunk vector IDs, changed-message requeueing, metadata-only document/chunk metadata refresh, draft/empty-message stale document removal, and durable vector sync outbox operations.
- Account deletion queues a durable account-vector purge and deletes account-scoped PostgreSQL email knowledge docs; message deletion queues account/message-scoped vector cleanup. Added an injected adapter processor with retry semantics and stale-job handling.
- Added tests for allowlist revocation and capability combinations, identity/content/metadata hashes, vector point ID uniqueness, outbox migration shape, stale upsert/delete behavior and retry handling.
- **NOT RUN:** provider-contract tests, worker loop tests, executor tests, new worker tests, Clara/worker typechecks, DB migrations, or live vector/mailbox integration. No PASS claimed because the current execution environment has no local checkout.
- **Not yet complete:** supported server-to-server Clara RAG email-index API and worker startup wiring. Clara Platform has internal KB-aware vector functions, but its current retrieval path is KB-scoped; FIX-01 must close ISS-026 and establish agent/account filters before email vectors are exposed to shared retrieval. No undocumented endpoint or parallel Qdrant implementation was invented. Do not merge as fully working until this security/adapter boundary is resolved and checks are run.
- FIX-01 owns ISS-026. OPS-01 owns live infrastructure and ingestion verification.
# VERIFICATION_STATE.md

Machine-readable verification record. The goal is to distinguish "developer says complete" from "implementation verified / tests verified / architecture reviewed / integration verified / deployment verified". This file is the canonical source of *what was actually verified*.

---

```yaml
# Verification state — updated during ChatGPT takeover on 2026-10-04
schema_version: 1
project: ai-comms-agent
phase: 3
phase_name: "Identity, Organization, Users, Roles & RBAC"
phase_2_implementation_commit: "13835dd8be5d608ccad3f4839e52c2a486f8bb41"
phase_2_control_state_correction_commit: "(populated after this commit — see git log)"

# ============================================================
# DEVELOPER VERIFICATION (performed by Z.AI)
# ============================================================
# These are checks Z.AI ran locally. They are NOT architect acceptance.

developer_verification:
  clara_audit:
    status: complete
    performed_by: "Z.AI"
    date: "2026-10-03"
    method: "full clone of Rilan-Dev/ai-reusable-libraries; target-side verifier; full read of clara-runtime.ts; tool/MCP search; import tracing"
    result:
      verifier_pass: 106
      verifier_fail: 2
      verifier_fail_nature: "manifest SHA recording errors (typos), not file content mutations"
      clara_runtime_export: "export const claraRuntime = { ... } as const (const object, not class)"
      tools_finding: "narrow host-binding runtime tool interface (rag_search only); no generic standalone tool/MCP framework"
      hidden_coupling: "none found in audited extracted source"

  typecheck:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "5/5 packages passed (clara-core structural, db, shared, web, worker)"

  web_build:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "success — routes: /, /mail/inbox, /api/health; First Load JS 103 kB"

  worker_build:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "success — dist/index.js produced"

  browser_verification:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "home 200 OK; mail/inbox 200 OK; health 200 healthy; no blank screen; no console errors; navigation renders"

  worker_smoke_test:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "boots, all checks ok, graceful shutdown"

  secret_scan:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "clean — no ghp_*, vcp_*, JWT prefixes; no private keys; no .env files (only .env.example with placeholder values); service-role key server-only"

  continuity_self_test:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: "all 7 recovery answers determinable from the repository alone"

  ci_workflow:
    status: implemented_not_yet_triggered
    performed_by: "Z.AI"
    date: "2026-10-03"
    result: ".github/workflows/ci.yml created; valid YAML; all steps pass locally; not yet triggered on GitHub Actions (will trigger on next push to main)"

  vercel_remote_deployment:
    status: pass
    performed_by: "Z.AI"
    date: "2026-10-03"
    deployed_commit: "c2868671c97af727b624b12a218d288fee936020"
    deployment_uid: "dpl_4i1g2mxMSEU4xAGA4odFAz4wPNen"
    deployment_state: "READY"
    production_url: "https://ai-comms-agent.vercel.app"
    vercel_project_settings:
      framework: "nextjs"
      root_directory: "apps/web"
      node_version: "24.x"
    routes_verified:
      home: "GET / → HTTP 200 (renders sidebar + top bar + overview dashboard; 18556 bytes)"
      mail_inbox: "GET /mail/inbox → HTTP 200 (renders mock email table + threads; 12830 bytes)"
      health: "GET /api/health → HTTP 200 ({ status: healthy, all checks ok })"
    notes: |
      Root cause of prior failure: Vercel project had framework=None and
      rootDirectory=None, causing Vercel to treat the repo root as a generic
      static deployment and look for nonexistent public/ output directory.
      Fixed via Vercel project settings (rootDirectory=apps/web, framework=nextjs).
      Health check also fixed to be production-safe (removed development-time
      file-existence checks that don't work in Vercel's serverless runtime).
      Developer verification is NOT architect acceptance.

imap_literal_reader:
  status: source_changed_not_tested
  commit: "f7df46f3d0d90bf1c0aae3407b448bd83aeca855"
  result: "IMAP socket reader now buffers raw bytes and consumes literal payloads by declared octet length with a 50 MiB per-literal cap; LIST and command loops use literal-aware response reads"
  pending: "Regression test source added in commits d4a5c6589f2e28a00277a725cf6c628ea8b56eb5 and b20c6423c6ded123a49ff6301a40de6385832a26; tests remain unexecuted; worker/web typechecks and real-server validation pending"

# ============================================================
# ARCHITECT ACCEPTANCE (performed by ChatGPT)
# ============================================================
# These are NOT developer checks. Only ChatGPT can accept a phase.

architect_acceptance:
  phase_2:
    status: pending
    note: |
      ChatGPT reviewed the Phase 2 implementation (commit 13835dd) and
      identified stale/contradictory project-control records. A control-state
      correction was authorized and implemented (this commit). ChatGPT will
      perform the final Phase 2 acceptance decision after reviewing the
      corrected control-state. Developer verification is NOT architect
      acceptance.

implementation_status:
  status: foundation_complete
  note: |
    Phase 2 application foundation implemented: pnpm monorepo with apps/web
    (Next.js 15), apps/worker (Node.js), packages/{clara-core,shared,db},
    vendor/clara git submodule, infra/docker-compose.yml. No production
    features (auth, email sync, etc.) — those are Phase 3+.

tests_status:
  status: not_applicable_for_phase_2
  note: |
    Phase 2 has no unit tests (foundation-only). Typecheck and build
    verification performed instead. Unit tests begin in Phase 3.

review_status:
  status: pending_chatgpt_acceptance
  note: |
    Phase 2 application foundation is complete and committed (13835dd).
    Developer verification is complete. ChatGPT reviewed and required
    control-state corrections (implemented in this commit). ChatGPT final
    Phase 2 acceptance is PENDING. Developer verification is NOT architect
    acceptance.

database_status:
  status: not_applicable_for_phase_2
  note: |
    No database implementation during Phase 2. PostgreSQL/Supabase remains
    approved infrastructure (ADR-009, ADR-002). Supabase project will be
    provisioned in Phase 4 (per RSK-001). Local Docker Postgres configured
    in infra/docker-compose.yml for development.

deployment_status:
  status: infrastructure_linked_only
  note: |
    GitHub repo: Rilan-Dev/ai-comms-agent (private).
    Vercel project: ai-comms-agent (linked to main branch, no deployment triggered).
    No application has been deployed. No build has been triggered on Vercel.
    Local Docker infrastructure configured but not required for Phase 2 verification.
  github_repo: "Rilan-Dev/ai-comms-agent"
  github_repo_visibility: private
  vercel_project_id: prj_VdO5pwIma53uGKqtt5EzRiry7JtG
  vercel_team_id: team_UQKWM8HLJvyr4sBGNHIidVwH
  vercel_production_branch: main
  supabase_project: "(not provisioned — Phase 4)"
  clara_submodule: "vendor/clara/ pinned to commit b47e587"

security_status:
  status: verified_clean
  note: |
    Pre-commit secret scan: clean (no ghp_*, vcp_*, JWT prefixes; no private keys;
    no service-account files). No .env files committed (only .env.example with
    placeholder names). Service-role key is server-only (packages/db/src/client.ts);
    not imported by any browser code. Provider API keys not present (Phases 6-13).

open_issues:
  count: 5
  items:
    - "ISS-001: Awaiting ChatGPT Phase 2 review of application foundation"
    - "ISS-002: Clara library deep audit COMPLETE in Phase 2 (verifier 106/108 pass; 2 manifest SHA typos)"
    - "ISS-003: .github/ directory exists but is intentionally empty (CI design is Phase 3+)"
    - "ISS-004: Worker host not yet selected (blocks Phase 9 — ADR-007)"
    - "ISS-005: Clara has no generic standalone tool/MCP framework (narrow rag_search only) — refined in Phase 2 audit"
  see: docs/project-control/ISSUES.md

open_risks:
  count: 6
  items:
    - "RSK-001: Supabase project not provisioned; PostgreSQL/Supabase remains approved infrastructure (ADR-009)"
    - "RSK-002: Clara library deep audit COMPLETE in Phase 2 — no hidden coupling found"
    - "RSK-003: Email provider capability matrix needs validation against real APIs (Phases 5-8)"
    - "RSK-004: WhatsApp Business API requires Meta approval (lead-time risk for Phase 13)"
    - "RSK-005: Worker host not yet selected (see ISS-004)"
    - "RSK-006: Long delivery timeline (19 phases) — accepted as governance choice"
  see: docs/project-control/RISKS.md

next_phase: 3
next_phase_name: "Authentication / Organization / Users / RBAC"
next_phase_authorized: false

# Evidence
evidence:
  phase2_clara_audit:
    performed: true
    date: "2026-10-03"
    method:
      - "Full clone of Rilan-Dev/ai-reusable-libraries (42 commits, 108 extracted files)"
      - "Read clara-core/AGENTS.md, README.md, REFERENCE-MAP.md, IMPLEMENTATION-PLAYBOOK.md, WORKLOG.md"
      - "Inspected extraction-manifest.json (108 entries, schema_version 1, immutable: true)"
      - "Ran target-side verifier (original verify-extraction.mjs requires Clara-AI-Platform source repo)"
      - "Read clara-core/source/src/modules/ai-platform-core/clara-runtime.ts in full"
      - "Searched for all tool/MCP references in clara-core/source/src/"
      - "Traced imports of clara-runtime.ts"
    verifier_result:
      total_files: 108
      pass: 106
      fail: 2
      failures:
        - file: "clara-core/source/src/modules/rag/knowledge-topics.ts"
          issue: "manifest source_blob_sha is 41 chars (malformed); actual git blob SHA is 40-char prefix"
        - file: "clara-core/source/src/modules/language-core/config-types.ts"
          issue: "manifest source_blob_sha differs from actual at 1 hex position (39 vs 40 chars)"
      conclusion: "Both failures are manifest recording errors (typos), NOT file content mutations. Extraction is effectively immutable."
    clara_runtime_export:
      actual: "export const claraRuntime = { ... } as const;"
      type: "const object literal (NOT a class)"
      methods: ["resolveProvider", "resolveVoice", "retrieve", "createChatTurn", "startRealtimeSession", "tools"]
      tools_supported: ["rag_search"]
    tools_mcp_finding:
      precise_finding: "Clara has a narrow host-binding runtime tool interface (claraRuntime.tools supporting rag_search only); no generic standalone application tool/MCP framework"
      enablemcp_flag: "exists in rag/config.ts line 12 (default false); no backing implementation"
      host_ownership: "ai-comms-agent owns its application ToolRegistry for email, WhatsApp, scheduling, approvals, etc."
    integration_approach: "git submodule at vendor/clara/ (pinned to b47e587); packages/clara-core/ as adapter boundary"
    reuse_map_corrections:
      - "§2.3 Agent runtime: corrected ClaraRuntime class → claraRuntime const object"
      - "§2.4 Tools: refined from 'no standalone tool runtime' to 'narrow rag_search tool interface; no generic framework'"
      - "§2.5 MCP: clarified enableMcp flag exists but no implementation"
    hidden_coupling:
      found: false
      note: "clara-runtime.ts uses @/modules/* import aliases resolved via tsconfig paths; doable-source engine-resolver.ts (which has SQL coupling) is NOT in extracted clara-core/source/ and NOT used by our integration"

  phase2_typecheck:
    result: "5/5 packages passed"
    packages:
      clara-core: "structural check (vendored source verified by Clara verifier, not host tsconfig)"
      db: "pass"
      shared: "pass"
      web: "pass"
      worker: "pass"

  phase2_build:
    web: "success — routes: /, /mail/inbox, /api/health"
    worker: "success — dist/index.js produced"

  phase2_browser_verification:
    performed: true
    home_page: "200 OK — renders sidebar + top bar + overview dashboard"
    mail_inbox: "200 OK — renders mock email table + threads"
    health_check: "200 OK — { status: healthy, all checks ok }"
    no_blank_screen: true
    no_console_errors: true
    navigation_renders: true

  phase2_worker_smoke_test:
    performed: true
    boots: true
    all_checks_ok: true
    graceful_shutdown: true
    log_output: "structured JSON with timestamp, level, service, message"

  phase2_security_scan:
    secret_scan: "clean — no ghp_*, vcp_*, JWT prefixes; no private keys"
    env_files: "only .env.example committed (placeholder values, no real secrets)"
    service_role_key: "server-only (packages/db/src/client.ts); not imported by browser code"
    provider_api_keys: "not present (Phases 6-13)"

  phase2_local_infrastructure:
    docker_compose: "infra/docker-compose.yml configured for Postgres 16, Redis 7, RabbitMQ 3.13, Qdrant v1.12.4"
    note: "Local development only — not production infrastructure"
    started: false
    reason: "Not required for Phase 2 verification (no DB/queue connections needed for foundation slice)"

  documentation_files_committed:
    # Phase 1 (unchanged in Phase 2, still present)
    - README.md
    - AGENTS.md
    - worklog.md
    - LICENSE
    - .gitignore
    - docs/project-control/PROJECT_STATE.md
    - docs/project-control/RULES.md
    - docs/project-control/CURRENT_PHASE.md
    - docs/project-control/NEXT_ACTION.md
    - docs/project-control/ZAI_HANDOFF.md
    - docs/project-control/VERIFICATION_STATE.md
    - docs/project-control/DECISIONS.md
    - docs/project-control/ISSUES.md
    - docs/project-control/RISKS.md
    - docs/project-control/CHAT_CONTINUITY.md
    - docs/architecture/ARCHITECTURE.md
    - docs/architecture/DATA-MODEL.md
    - docs/architecture/DOMAIN_MODEL.md
    - docs/architecture/AI-ARCHITECTURE.md
    - docs/architecture/REALTIME-VOICE-ARCHITECTURE.md
    - docs/architecture/CLARA_VOICE_INTEGRATION.md
    - docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md
    - docs/architecture/EMAIL_AGENT_ARCHITECTURE.md
    - docs/architecture/WHATSAPP-ARCHITECTURE.md
    - docs/architecture/MESSAGING_CHANNEL_ARCHITECTURE.md
    - docs/architecture/EVENTS-AND-QUEUES.md
    - docs/architecture/SECURITY.md
    - docs/architecture/SECURITY_MODEL.md
    - docs/architecture/OBSERVABILITY.md
    - docs/architecture/UI-UX.md
    - docs/architecture/DEPLOYMENT.md
    - docs/architecture/CLARA-INTEGRATION.md
    - docs/architecture/CLARA_REUSE_MAP.md
    - docs/specs/PRODUCT.md
    - docs/specs/PROVIDER-CONTRACTS.md
    - docs/specs/TOOL-CONTRACTS.md
    - docs/specs/AUTHORIZATION.md
    - docs/specs/EVENT-CONTRACTS.md
    - docs/specs/API-CONTRACTS.md
    - docs/plans/ROADMAP.md
    # Phase 2 new (application foundation)
    - package.json
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - .gitmodules
    - .npmrc
    - .env.example
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.mjs
    - apps/web/postcss.config.mjs
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/src/app/globals.css
    - apps/web/src/app/api/health/route.ts
    - apps/web/src/app/mail/inbox/page.tsx
    - apps/web/src/components/sidebar.tsx
    - apps/web/src/components/top-bar.tsx
    - apps/web/src/lib/mock-data.ts
    - apps/worker/package.json
    - apps/worker/tsconfig.json
    - apps/worker/src/index.ts
    - packages/clara-core/package.json
    - packages/clara-core/tsconfig.json
    - packages/clara-core/src/index.ts
    - packages/clara-core/src/runtime.ts
    - packages/clara-core/src/types.ts
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/src/index.ts
    - packages/shared/src/agent/types.ts
    - packages/shared/src/agent/intents.ts
    - packages/shared/src/email/provider.ts
    - packages/shared/src/messaging/channel.ts
    - packages/db/package.json
    - packages/db/tsconfig.json
    - packages/db/src/index.ts
    - packages/db/src/client.ts
    - infra/docker-compose.yml
    # vendor/clara/ is a git submodule (not committed directly)

  continuity_test_performed: true
  continuity_test_result: "Self-administered continuity check passed: a fresh reader following AGENTS.md §3 reading order can recover full project state from the repository alone."

  phase1_approved_baseline: "c8b2f2c02c2231ea4e5fdb5b9fa48124b383bdc6"
  phase1_state_recording_commit: "f32616a487ba09bfaa782c39226b19f38d7b18e3"
  phase2_commit_sha: "(populated after this commit — see git log)"
  push_verified: true
```

---

## Verification lifecycle (forward-looking)

From Phase 3 onward, this file is updated on every commit with the actual results of: typecheck, lint, unit tests, integration tests, build, runtime checks, security checks, deployment verification, and (where applicable) browser verification. The schema above is the stable shape; new fields may be added but existing fields will not be removed without a schema version bump.

takeover:
  primary_implementer: "ChatGPT"
  previous_implementer: "Z.AI"
  takeover_date: "2026-10-04"
  current_commit: "c7c646f19551136d8d8decc827651891ea188780"
  latest_change:
    migration_owner_invariant: "Deferred constraint triggers validate affected organizations for membership and direct organization changes."
    migration_tests: "Static migration checks now cover owner invariants, RLS recursion helpers, and PostgreSQL dollar-quote syntax."
    ci: "CI provisions PostgreSQL 17 and executes the Phase 3 migration verification scripts."
  execution_status:
    phase_3: "awaiting_ci_runtime_verification — PostgreSQL 17 migration checks added"
    phase_4_authorized: true


### Latest ChatGPT verification update — 2026-10-04
- latest code: c1f2a078c80f7a52774061cd75b4d5bc907a90f1.
- Corrected invalid single-dollar PostgreSQL function delimiters and added a static regression guard.
- Runtime migration execution is still pending; GitHub workflow results are not yet exposed by the current commit-run endpoint.
- Latest Vercel attempts are rate-limited/canceled; the previously READY deployment at commit 4289e53 is not evidence for the latest code.
- **Acceptance: PENDING. Phase 4: NOT AUTHORIZED.**


### Control synchronization — 2026-10-04
- Current main commit: f785e3ab8783fd9718fc383744a0d1c855db16b2.
- CI now contains a disposable PostgreSQL 17 runtime migration gate plus an expected-failure ownerless-organization check.
- The verification gate has not yet produced connector-visible GitHub Actions results. This is an evidence limitation, not a pass.
- Vercel remains rate-limited/canceled for the latest rapid commits; no latest READY claim.
- **Phase 3 acceptance: PENDING. Phase 4: NOT AUTHORIZED.**


### 2026-10-04 CI runtime-verification hardening
- CI now provisions disposable PostgreSQL 17 and executes the Phase 3 migration runtime verification script.
- CI also executes an expected-failure check proving direct ownerless organization creation is rejected at commit.
- Migration static and runtime verification remain the acceptance gate; Phase 4 is still not authorized until CI provides green evidence.


### Runtime verification gate — 2026-10-04
- Latest code/control state: f1ef7920a1288ee905d12f4eea43e2a4fb6c91e1.
- CI now provisions disposable PostgreSQL 17, applies the Phase 3 migration, then exercises owner transfer and ownerless-organization rejection.
- **Acceptance remains PENDING until CI produces green runtime evidence.**
- **Phase 4 remains NOT AUTHORIZED.**


### Runtime verification gate — 2026-10-04
- CI now provisions disposable PostgreSQL 17 and executes the Phase 3 migration verification script.
- Verification covers successful organization+owner creation, transaction-safe ownership transfer, exactly-one-owner result, SECURITY DEFINER helper presence, and expected rejection of direct ownerless organization creation.
- Current code verification commit: ede90e43f1d106206657f85b0f09efe7b5521785.
- **Phase 3 acceptance remains PENDING until CI provides a green runtime result. Phase 4 remains NOT AUTHORIZED.**


takeover_execution_policy:
  development: "continue without waiting for GitHub Actions or Vercel validation jobs"
  validation: "deferred until feature development is substantially complete"
  phase_4_authorized: true
  authorized_by: "explicit project-controller instruction 2026-10-04"
  latest_product_work: "Phase 4 domain schema + modern communications workspace UI"


### Development-first continuation update — 2026-10-04
Development-first mode is active by explicit project-owner instruction. Database and UI implementation is proceeding without waiting for CI/Vercel jobs. Runtime verification remains pending and no unverified deployment or migration result is represented as passed. Latest implementation includes Phase 4 migrations through 0011 and continued UI/provider work.


### CI runtime verification hardening — 2026-10-04
- CI now provisions disposable PostgreSQL 17, applies `supabase/migrations/0001_identity_rbac.sql`, then executes owner-transfer/RLS-helper runtime checks.
- CI also verifies that a direct ownerless organization INSERT is rejected at transaction commit.
- Latest code/control commit: 70679cdef67056338338629371d3b723c785a73b.
- Phase 3 acceptance remains pending until the resulting GitHub Actions run is green.
\n\n### Development-first execution — 2026-10-04\n- CI automatic triggers: temporarily disabled by explicit project-owner instruction; workflow remains manual-only.\n- Phase 4 schema migration \`0002_database_foundation.sql\`: implemented.\n- Phase 4 static migration coverage: expanded.\n- Runtime verification: intentionally deferred until the implementation set is complete.\n- Phase 4 acceptance: NOT COMPLETE.\n

### Phase 4 implementation state
- Current implementation: database foundation + security hardening + encryption primitives.
- Automatic CI: disabled temporarily by explicit project-owner instruction.
- Runtime verification: deferred until implementation is complete.
- Formal Phase 4 acceptance: pending.


### Runtime gate update — 2026-10-04
- Latest main baseline: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- CI now applies `supabase/migrations/0001_identity_rbac.sql` to PostgreSQL 17 before executing owner-invariant/runtime checks.
- GitHub Actions returned **zero workflow runs** for the dedicated verification PR, so no runtime PASS is claimed.
- Static migration inspection is clean for function quoting, deferred triggers, affected-org DELETE handling, direct organization INSERT protection, and SECURITY DEFINER RLS helpers.
- **Acceptance remains PENDING; Phase 4 remains NOT AUTHORIZED.**


Latest synchronization: Docker/manual verification tooling is committed at 271bd648875ce086a52aaedd7953e63bbc89421e. Runtime acceptance remains pending because this environment cannot execute Docker and GitHub Actions has not yet supplied a fresh run result.


### 2026-10-05 PostgreSQL/self-hosted continuation
- Database runtime boundary: PostgreSQL via node-postgres; no Supabase runtime client.
- Docker reference database service: `postgres-db`.
- Application foundation migration: `0002_application_foundation.sql`.
- Runtime/static verification scripts updated to apply all migrations and validate foundation tables, owner invariant, and RLS helper presence.
- Email provider runtime capability gate and worker tests added.
- Automated runtime evidence is still pending; the available Vercel status is rate-limited/failing and is not used as evidence for the Docker deployment path.
\n 

### 2026-10-05 infrastructure/deployment correction
- Local Docker PostgreSQL/Redis/RabbitMQ/Qdrant services are profile-gated under `local-infra`; they are not started by default.
- `.env` was removed from the repository. `.env.example` now contains external PostgreSQL/Redis/RabbitMQ/Qdrant connection contracts.
- Vercel environment inventory currently reports zero configured variables. External credentials therefore remain a deployment prerequisite; no placeholder secrets were added.
- CI now provisions a disposable PostgreSQL service, applies migrations, then executes Phase 3 runtime verification.
- Latest code commit: fca6f3ffa603006876c64f607043fb27137ae35d.
- Phase 3 acceptance: PENDING runtime evidence. Phase 4: NOT AUTHORIZED.

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


### 2026-10-05 — Docker bootstrap/migration-chain correction
- Local operator reported `bash scripts/verify-docker.sh` failed because the PostgreSQL verification container exited with code 3.
- Root cause 1: `infra/postgres-init/00-supabase-roles.sql` had invalid `DO $ ... END $;` quoting. Corrected to `DO $$ ... END $$;`.
- Root cause 2: `0002_application_foundation.sql` contained the same invalid dollar-quote form in its exception blocks. Corrected.
- Root cause 3: Phase 4 security migration referenced public membership helpers that were not defined by Phase 3. Added controlled public SECURITY INVOKER wrappers over the private SECURITY DEFINER helpers.
- Added static regression coverage for bootstrap quoting and helper namespace bridging.
- Latest code commit: `c9cdf7ecfc9b21f757c71646dda94e8bd91230d3`.
- **Runtime verification remains PENDING until the local disposable PostgreSQL run completes successfully.**


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


### 2026-10-05 runtime verification finding
The user's local `bash scripts/verify-docker.sh` run successfully booted PostgreSQL and applied migrations 0001 through 0006. Migration 0007 then failed because `agent_ai_settings` referenced `ai_provider_configs` before its table was created. This was corrected in commit `3d9dca8fe0769d2273e2fad19051b09591b83f08`. Re-run the disposable verification before Phase 3 acceptance. No false PASS is claimed.


### 2026-10-05 — Docker verification runner correction
- Local verification reached the migration chain successfully, then the final runtime verification command failed before executing SQL because `verify-docker.sh` invoked `psql` without `$DATABASE_URL`; the migrate container therefore attempted its local Unix socket instead of the `postgres` service.
- Corrected in commit `b08d7e3aa244095d214fd9cd33268c4edd8930fc`: both runtime verification commands now explicitly pass `$DATABASE_URL`.
- This was a verification harness defect, not a migration pass. The required next step is to rerun `bash scripts/verify-docker.sh` after pulling main.
- **Phase 3/4 acceptance remains pending runtime evidence. No false PASS is claimed.**


### Verification hardening — 2026-10-06
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes transaction-level owner/RLS runtime verification, and asserts ownerless-organization rejection.
- SECURITY DEFINER helpers intentionally use `SET search_path = ''` with fully-qualified `public.*` table references; static tests now enforce this safer pinned path.
- Latest implementation commit: 5bcc9758f374de1d7187d2f9cd814d2589ecf081.
- Phase 3 acceptance remains pending until CI runtime evidence is green.


### Latest ChatGPT verification update — 2026-10-06
- Latest code: 557951a49fd93d07877ef4361f616d331be4d226.
- PostgreSQL 17 CI service added; Phase 3 migration is now explicitly applied before runtime verification.
- Runtime checks cover valid ownership transfer, exactly-one-active-owner state, RLS helper existence, and rejection of ownerless organization commit.
- Static tests verify private SECURITY DEFINER helper search_path hardening.
- GitHub workflow results are not yet exposed by the current workflow-run endpoint; Vercel is currently blocked by build-rate-limit. No false green/READY claim is made.
- Acceptance: PENDING. Phase 4: NOT AUTHORIZED.


### Runtime verification CI status — 2026-10-06
- PostgreSQL runtime verification scripts are now present under `scripts/verify-phase3-migration.sql` and the CI job provisions PostgreSQL 17.
- The GitHub workflow endpoint currently returns no workflow run for the latest migration-verification commit, so runtime execution evidence is still unavailable.
- GitHub combined status currently reports only the Vercel context, which is failing due the existing build-rate-limit; this is not treated as application-test evidence.
- **Phase 3 acceptance remains PENDING. Phase 4 remains NOT AUTHORIZED.**


### 2026-10-06 — ChatGPT continuation
Development-first update 2026-10-06: email credential repository schema mismatch corrected; `/mail/accounts` demo replaced by persisted PostgreSQL-backed UI; authorized disconnect endpoint added. No runtime pass is claimed. CI/Vercel remain verification gates only.


### 2026-10-06 takeover continuation
- Database migrations were hardened to remove remaining Supabase-only identity calls and public arbitrary-user membership helper exposure.
- Phase 5 implementation has begun with a worker-side email provider registry and mock-provider contract tests.
- Latest commit: 3a8af9f3f8eecc96badd8f24dbce087d510f483e.
- Runtime acceptance remains pending; no Vercel READY claim is made.


### 2026-10-06 — Current verification truth
- Latest implementation commit: e7fd12725a8057f5a69938a5e30d29013b67d4e4.
- Migration bootstrap quoting was corrected after direct source audit.
- Agent Slice 1 has received additional persisted edit/channel UX implementation.
- GitHub workflow-run connector still reports no push-triggered runs; therefore no CI green result is claimed.
- Vercel combined status reports build-rate-limit failure; the latest implementation is not claimed deployed/READY.
- Phase 4 and Slice 1 acceptance remain pending runtime/browser evidence.


### 2026-10-06 — ChatGPT continuation
- Latest implementation corrections: cross-tenant provider binding guard fixed in migration 0010; Gmail OAuth callback now validates state-cookie equality; Gmail accounts remain pending until encrypted credentials are stored successfully.
- Slice 1 Agents remains pending formal acceptance. Development-first implementation continues; no Vercel READY or CI PASS is claimed.
- Next product work remains Email Accounts provider connection hardening (Gmail, then IMAP/SMTP and Zoho), followed by Mail.


## 2026-10-06 — Gmail contract verification state
- Latest source correction: `418439093ae87ceb76a32709b371b7e772d8fd04`.
- Static repository inspection confirms all concrete `EmailProvider` implementations expose the current required method surface.
- Post-fix local Docker build is still pending; therefore this correction is not marked as a build/runtime PASS.


### 2026-10-06 — Latest provider implementation checkpoint
- Latest governance/code state: `cbfec672c26795d4fc8bea2a90ba9ec402181d4c`.
- IMAP/SMTP: duplicate helper removed; contract/security tests added; private/local target protection added.
- Zoho: OAuth PKCE start/callback, regional Accounts endpoints, encrypted credential persistence, and initial REST adapter foundation implemented.
- Registry now resolves Gmail, IMAP/SMTP, and Zoho adapters.
- No CI PASS is claimed and Vercel remains build-rate-limit blocked. Real provider connectivity is unverified because no provider credentials are available.
- **Acceptance: PENDING. Development continues under the project-owner development-first instruction.**


### Phase 4 authorization — 2026-10-06
- ChatGPT has authorized Phase 4 implementation and remains primary implementer/verifier.
- GitHub Actions and Vercel completion are not prerequisites for continued implementation.
- Runtime PostgreSQL migration and RLS verification remain required evidence before Phase 4 acceptance.
- Current implementation migrations: 0002_application_domain.sql, 0003_phase4_schema_alignment.sql, 0004_phase4_schema_cleanup.sql.


### Development-first checkpoint — 2026-10-06
- Latest implementation commit: b96c44a9a233fe0ee1b0c00fd6176e3eea8835db.
- Slice 1 Agents remains the active product slice.
- Implemented: persisted version-config editing, server-side version-config validation, full policy controls, agent status filtering, and create error recovery.
- Automated/browser verification is intentionally deferred per project-owner instruction; no pass is claimed for the latest changes.
- Phase 4/product implementation continues without waiting for GitHub Actions or Vercel.

### 2026-10-06 — Slice 1 implementation checkpoint
- Latest implementation commit: bc31ded2df82e7a42b985343951381751504402b.
- Added authorized agent audit-history read path and Activity UI.
- Added organization-scoped WhatsApp account discovery for agent channel binding.
- Added strict agent policy validation plus unit coverage.
- These changes are source implementation only; no CI/Vercel PASS is claimed.
- Slice 1 acceptance remains pending runtime/browser verification and final review.


### 2026-10-06 — Email Accounts continuation
- Latest implementation checkpoint: 30cf7d51c32a05b7f49551817368a0248349f95c7.
- Source changes include IMAP/SMTP reconnect lifecycle, persisted connection error mapping, provider-aware reconnect UI, and Zoho regional OAuth refresh regression coverage.
- GitHub Actions/Vercel are not being used as development blockers per explicit project-owner instruction.
- Runtime/browser/provider acceptance remains pending; no CI PASS, Vercel READY, or live-provider connection is claimed.


### 2026-10-06 — Email Accounts source verification boundary
Latest source implementation commits through `4cea5073d1b42a3546f5023d17ff9f5efd6a701a`. Static inspection covers the new email schema reconciliation, Zoho runtime operations, provider reconnect persistence, and folder/label repository. No CI PASS, Vercel READY, or live provider connection is claimed. Acceptance remains pending runtime/browser evidence.


### 2026-10-06 — Capability truthfulness correction
- Aligned persisted IMAP/SMTP and Zoho capability metadata with the operations actually implemented by their adapters; unsupported draft/send/forward/attachment operations are no longer advertised as available.
- Gmail remains the fully advertised provider surface where its adapter implements the corresponding contract.
- Latest code commit: be4925cbd3e73ebeec28a951a5d062d70fba19ae.
- Runtime/browser verification remains deferred and no live provider connection is claimed.


### 2026-10-06 — Email Accounts lifecycle hardening
- Implemented idempotent IMAP/SMTP account persistence and truthful pending OAuth lifecycle states.
- No runtime provider connectivity is claimed; real user-owned credentials are required.
- Acceptance evidence remains separate from development and is not claimed from CI/Vercel.


### 2026-10-06 — Slice 2 provider lifecycle continuation
ChatGPT completed another Email Accounts hardening pass: folder/label discovery is now an atomic replacement snapshot, successful worker discovery persists runtime capabilities and connected status, discovery failures become explicit account errors, and IMAP/SMTP/Zoho capability metadata is truthful to the implemented adapter surface. Continue the Mail vertical slice after Email Accounts implementation is complete; runtime acceptance remains a separate gate.


### 2026-10-06 — ChatGPT continuation verification record
Latest implementation commit is 1972d62cffca5b1b5a5eaeb4ddcb4e7c9f53b446. Zoho adapter security/runtime contract coverage was extended for documented draft creation. No live provider credentials were used; runtime provider connectivity is not claimed.
Acceptance remains a separate runtime/browser gate.


### 2026-10-06 — Provider reconnect hardening
- Latest implementation commit: `e405cbcf8d03f3e0dab9b5319689b3046e6cd1f6` (control-doc synchronization commit).
- Gmail and Zoho OAuth reconnect now bind to a signed optional target account and validate organization/provider before persistence.
- Regression coverage added for Gmail reconnect binding; no external network call is used by the test.
- No provider credential success is claimed; runtime validation remains deferred by explicit project-owner instruction.
\n\n### 2026-10-06 — Email Accounts lifecycle implementation
- Provider verification now guarantees cleanup around capability discovery and mailbox structure discovery.
- Mailbox structure API is organization-scoped and returns only persisted folders, labels, capabilities, and agent assignment metadata.
- Static tests cover provider registry capability surfaces, provider cleanup, discovery status transitions, and credential non-exposure.
- Runtime/browser/provider verification remains deferred under the explicit development-first instruction; no CI PASS or Vercel READY claim is made.
- Latest implementation commit before control synchronization: `105d41481d9523bda66b0f6ae147e73fff1c3c46`.
\n\n### 2026-10-06 — Email Accounts truthfulness hardening
- Mailbox structure API/UI no longer synthesizes discovery timestamps.
- Source tests remain the available implementation evidence; runtime/browser/provider validation is intentionally deferred and no PASS is claimed.
- Latest implementation commit before this control update: `ee2bba7c696e2ed9672c7ff7281e0a1658951798`.


### 2026-10-06 — Email Accounts lifecycle hardening
Latest development checkpoint: Email Accounts lifecycle hardening. Added atomic mailbox structure replacement, provider capability contract coverage for all registered adapters, and reconnectability for disconnected accounts. These are source changes only; no CI PASS, Vercel READY, or live-provider connection is claimed.


Latest Email Accounts source changes: OAuth callback failures are routed back to the account UI without token payloads; UI consumes and clears provider error state. Deterministic static coverage was added. No runtime/browser/provider PASS is claimed.


Latest source correction: `apps/web/src/app/api/email-accounts/route.ts` was repaired after direct audit found literal `\\n` source corruption. Static Email Accounts tests now guard API authorization, credential non-exposure, OAuth error routing, disconnected recovery, and source integrity. Runtime/browser/provider verification remains pending.


### 2026-10-06 runtime verification preparation
- CI now provisions disposable PostgreSQL 17.
- Runtime script verifies the Phase 3 migration, deferred ownership transfer, and RLS helper functions.
- Expected-failure script verifies direct ownerless organization creation is rejected at commit.
- Latest code baseline: ede90e43f1d106206657f85b0f09efe7b5521785.
- Acceptance remains pending until CI produces green runtime evidence.
\n\n### 2026-10-06 — Development-first verification state\n- Latest implementation commit: 9b9aeee0ac9605cdcde476e93a464f78d6be3f92.\n- Added deterministic Mail draft/forward contract tests.\n- No new runtime acceptance claim; CI/Vercel remain verification gates and do not block implementation under the explicit development-first instruction.\n\n\n### 2026-10-06 — Mail provider draft synchronization continuation\n2026-10-06 — Development-first Mail continuation: provider draft synchronization source implementation is now present. Runtime/provider verification remains pending and is not represented as passed. No live credentials were used.\n

### 2026-10-06 — Development-first implementation checkpoint
- Mail implementation now includes provider draft synchronization request/polling, worker-only approved outbound execution, and attachment metadata/download boundaries.
- WhatsApp account configuration API/UI now stores Meta credentials encrypted server-side and keeps account status `pending` until provider verification is implemented.
- Latest implementation commit: `8675e9bc39799796714b1418470733246f58e4ca8`.
- Runtime/browser validation intentionally deferred under the active development-first instruction; no PASS is claimed.


### 2026-10-06 — WhatsApp implementation checkpoint
- WhatsApp account credentials are encrypted server-side and account status remains truthful until worker verification succeeds.
- Webhook signatures use HMAC SHA-256 and inbound provider IDs are persisted idempotently.
- Outbound messages are queued in PostgreSQL and provider execution is worker-only.
- Legacy WhatsApp schema compatibility is handled by forward-only migration 0016.
- Latest implementation commit: `552f13e097c4ff33b7c81a5db7a216328caea078`.
- Runtime/browser validation is intentionally deferred under the development-first instruction.


### 2026-10-06 — Latest development-first implementation: Clara chat workspace at `/chat`, persisted conversation/message loading, SSE streaming, organization authorization, agent-isolated conversation switching, and workspace navigation/dashboard entry points. Runtime/CI/Vercel verification remains non-blocking; no live AI/provider success is claimed.
\n\n### 2026-10-06 — Development-first Settings continuation
- Latest source commit: 2e4a29b1f7c58523aff2a65331941e3e2562a252.
- Voice transcript bridge, shared transport contract, organization settings read, member read, and member role/status management are implemented.
- Runtime/browser verification is intentionally deferred under the active project-owner development-first instruction.
- No provider credentials or live external connectivity are claimed.

### 2026-10-07 — Deterministic E2E fixture foundation
- Added `apps/web/src/e2e/fixtures/cross-surface-scenarios.ts` with stable IDs and five cross-surface scenario definitions.
- This is implementation scaffolding only; no runtime test result is claimed.
- Runtime/deployment validation remains deferred under the active development-first instruction.


### 2026-10-08 — Deterministic cross-surface runner implementation
- Added PostgreSQL-backed cross-surface adapter steps and an executable scenario runner.
- Covered email approval idempotency, WhatsApp outbound idempotency, scheduled claims, cross-organization visibility checks, and correlation-scoped audit continuity.
- Added deterministic source-level runner tests; runtime execution remains deferred under the development-first instruction.
- Latest implementation commit: `ae79d161f8fb313a38d4e869c40ad499407b5695`.
- No provider delivery, CI PASS, or Vercel READY claim is made.


### 2026-10-08 — Sensitive-action provider outcome routing implementation
- Added worker-owned `provider-events` bridge into automation evaluation.
- Email approved-action success/failure paths now emit provider events with action/account/correlation identifiers.
- WhatsApp outbound success/failure paths now emit provider events with message/account/correlation identifiers.
- Added deterministic source-level provider-event routing coverage.
- Runtime/provider delivery validation remains deferred by the development-first instruction.
- Latest implementation commit: `fba28b721d8ca1f6e36aa4106f134d2dd3075af9`.


### 2026-10-08 — Provider retry/failure hardening
- Added bounded retry telemetry to the shared provider retry helper.
- Email and WhatsApp worker outcomes now retain deterministic retry attempt counts and retryability classification.
- Added deterministic provider-event mapping tests for identity/correlation/retry/error propagation.
- Runtime provider delivery and CI/Vercel status remain intentionally unclaimed; development continues independently.

### 2026-10-08 — Abandoned execution fail-closed hardening
- Email worker stale execution recovery is fail-closed and auditable; automatic replay is intentionally avoided because provider outcome may be unknown after a crash.
- WhatsApp inbound stale execution recovery is fail-closed and auditable for the same duplicate-side-effect reason.
- Added deterministic contract coverage for both recovery boundaries.
- Runtime verification remains deferred under the development-first instruction.

### Authentication boundary correction — 2026-10-08
- Latest code: c7c646f19551136d8d8decc827651891ea188780.
- Added production Supabase Auth adapter and login/logout session endpoints.
- Added protected-page middleware and server-side application identity validation.
- Removed development identity headers from agent UI clients.
- Added auth-boundary static tests and documented Supabase Auth environment variables.
- Runtime auth verification is pending because no ai-comms-agent Supabase project is currently provisioned/configured. Existing Supabase projects were not reused.
- Vercel latest deployments remain rate-limited/canceled; no latest READY claim.
- **Phase 3 acceptance: PENDING. Phase 4: NOT AUTHORIZED.**


### 2026-10-08 — Authentication implementation evidence state
- Source implementation: completed for the current development slice.
- Added migration 0022, auth repository, local session adapter, login/logout/me/change-password/bootstrap routes, Settings password UI, and authentication tests.
- Runtime verification: intentionally deferred under the user's development-first instruction.
- No Supabase Auth project, publishable key, or hosted identity dependency is required.
- No CI/Vercel PASS is claimed.


### 2026-10-08 — Cross-surface hardening continuation
Latest implementation commit: 64485e8c9478c6881f488f00ae624a3657e17a07. Added deterministic cross-surface conflict/duplicate assertions and corrected provider retry classifier imports. No CI PASS or Vercel READY claim is made.


### Latest development-first hardening — 2026-10-08
- Latest implementation commit: `0c0a23b9bbda2574960e0c4355d631318e3cd37e`.
- Provider event canonical identity fields cannot be overridden by provider metadata.
- Voice turn increments require active sessions at both API and SQL boundaries.
- Runtime/CI/Vercel verification is intentionally deferred per project-owner instruction; no success is claimed.


### Latest security edge hardening — 2026-10-08
- Email approval list/detail access now requires `organization.update`; approval content is no longer exposed to `organization.read` viewers.
- Latest implementation checkpoint: `3488b3b585c8779f706dea646d78b2f4ff880657c`.
- Runtime/CI/Vercel verification remains intentionally deferred; no PASS is claimed.


### 2026-10-08 — Communication-loop edge hardening
- Deterministic cross-surface PostgreSQL scenario coverage now treats duplicate concurrent email approval delivery as a race and requires exactly one successful approval transition.
- WhatsApp outbound failures now persist the provider error in the authoritative message row instead of discarding the error argument.
- Runtime/CI/Vercel validation remains deferred under the active development-first instruction; no success is claimed.
- **Next:** continue remaining Mail/WhatsApp/Chat/Voice edge cases and audit/idempotency assertions before final runtime/deployment preparation.


### 2026-10-08 — Scheduled execution audit correlation
- Scheduled run completion/failure now persists organization-scoped audit events using the durable run UUID as target and correlation identifier.
- Configuration-required and exception paths are both covered; no external provider success is fabricated.
- Added deterministic worker source coverage.
- Continue remaining communication-loop edge hardening without waiting for CI/Vercel.


### 2026-10-08 — Browser authentication entry-point correction
- `/login` is a public browser entry point and preserves a safe `next` path after successful authentication.
- `/setup` is a public first-run UI for the existing one-time bootstrap endpoint.
- `/api/auth/bootstrap` is explicitly public to the middleware but remains protected by the server-only `AUTH_BOOTSTRAP_TOKEN` and one-time credential check.
- No auth bypass or client-side secret was added.
- Runtime verification/deployment evidence for the latest commit remains pending; do not claim READY.

## Live manual deployment evidence — 2026-10-09

- **User-provided evidence:** `scripts/migrate.sh` completed successfully through `0023_audit_schema_reconciliation.sql`; `scripts/manual-up.sh` rebuilt both web and worker images, reran the migration chain, and started both containers.
- **Observed runtime state:** worker reports its configured PostgreSQL/Redis/RabbitMQ/Qdrant dependencies and ready state; Next.js web reports ready. This is startup evidence only.
- **Remaining failure:** authenticated agent creation fails with PostgreSQL SQLSTATE `23502`, because the live legacy `audit_events.resource_type` column is still NOT NULL and current writes use `target_type`. The legacy `outcome` column is also reconciled by the same correction.
- **Source remedy:** migration `0024_audit_legacy_column_compatibility.sql` is committed, with static regression assertions in `apps/web/tests/migration-verification.test.ts`.
- **Status:** migration 0024 has not yet been applied to the live runtime; authenticated agent creation and overview are not accepted as passing. No end-to-end runtime PASS is claimed.
- **Next:** pull latest `main`, run `bash scripts/manual-up.sh`, then retry authenticated agent creation with the browser's existing valid session. Do not paste session cookies or credentials into chat.


## 2026-10-09 — Email account tenant-context correction

- **User-provided evidence:** `POST /api/email-accounts` returned HTTP 403 with `reason=not_member` for the organization ID supplied by the mail account page.
- **Source finding:** The page selected the development organization via `getDevOrgId()`, while the authorization boundary resolves membership for the authenticated user.
- **Correction:** `/mail/accounts` now derives its organization using `getAuthenticatedAppContext()`, consistent with `/mail/inbox`. Static regression coverage was added.
- **Commits:** `4536332fdee1de3b2a0c060d581b3939c769f08a`, `7a3cfba20cabc6fad88b313c258320c5961c06af`.
- **Verification status:** Tests have not been run and the live request has not been retried. No runtime PASS is claimed. Migration 0024 remains a separate pending deployment prerequisite.


### 2026-10-09 — Voice tenant and lifecycle hardening
- Updated `apps/web/src/app/ai-voice/page.tsx` to derive organization context from the authenticated application session, matching the inbox and email accounts surfaces; removed dev-org selection and dev seeding from this page.
- Added `apps/web/tests/voice-workspace-organization-context.test.ts` to guard tenant scoping.
- Updated `apps/web/src/app/api/voice/turn/route.ts` to reject every non-active session and to return a conflict rather than exposing a generated response if the session becomes inactive before the turn counter update succeeds.
- Added `apps/web/tests/voice-turn-lifecycle-guard.test.ts`.
- Latest implementation commits: `3ada3490ec91398e0f239c086bcbe9289063de96`, `8dda47141678033b90d2530183527b44807221f6`, `75bf41fd8eade96ed7fdc3fc6d2e580074b94a91`, `f1bcabd9eed9c8f073d8de4a287dbfd25bde6d22`.
- Tests/build/runtime/deployment were not run; verification remains pending by the active development-first instruction. No pass is claimed.


### 2026-10-09 — Cross-surface lifecycle hardening
- Voice workspace tenant-context and voice turn/start lifecycle regression tests added.
- Email action claim and completion updates are organization-scoped; worker callers now pass the organization ID and the email action contract test guards the SQL boundary.
- Tests/build/runtime/deployment were not run under the active development-first instruction. Verification remains pending.


## 2026-10-09 — Configurable multi-client Gmail OAuth

- Added migration 0026_gmail_oauth_configuration.sql, organization-scoped settings CRUD with encrypted client secrets, Settings UI, OAuth-client selector on the mailbox screen, stored-client OAuth start/callback, and account-specific worker token refresh configuration.
- Gmail OAuth state signing now uses the existing server-only CREDENTIALS_MASTER_KEY; Gmail no longer requires SESSION_SIGNING_KEY or GMAIL_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI environment variables.
- Static regression tests committed at apps/web/tests/gmail-oauth-settings.test.ts.
- Tests/build/runtime were not run. Migrations 0024/0025/0026 and the Google consent/callback/token refresh path still require live verification; no PASS is claimed.


### 2026-10-09 — WhatsApp outbound concurrency safety
- Added forward-only migration `0025_whatsapp_outbound_claim_lifecycle.sql` to support an `executing` state.
- Replaced select-only queue reads with an atomic `FOR UPDATE SKIP LOCKED` claim, preventing concurrent worker processes from sending the same queued row.
- Sent/failed persistence transitions now require an active execution claim. Stale executing rows fail closed with provider-outcome-unknown/manual-review metadata rather than being requeued.
- Late Meta success after claim loss now emits an explicit persistence-conflict event and audit record with provider message ID.
- Added worker regression coverage. Tests/build/runtime/deployment remain unrun and pending.


### 2026-10-09 — Migration sequence collision correction
- Found both WhatsApp and Gmail OAuth migrations numbered `0025`.
- Gmail OAuth migration is now `0026_gmail_oauth_configuration.sql`; WhatsApp keeps `0025_whatsapp_outbound_claim_lifecycle.sql`.
- Regression test points at the corrected filename. No migration/test/build/runtime execution was performed; no PASS claimed.


### 2026-10-09 — Dynamic OAuth and Zoho provider configuration
- Source changes committed: request-derived Gmail/Zoho callback URLs; signed state carries the exact redirect URI used at token exchange; organization-scoped Zoho OAuth configuration API/UI; per-account Zoho client credentials for refresh; migration 0027.
- Regression coverage added/updated in `apps/web/tests/gmail-oauth-settings.test.ts`, `apps/web/tests/zoho-oauth-settings.test.ts`, and `apps/worker/tests/zoho-adapter-security.test.ts`.
- Tests, typecheck, build, migrations, Google/Zoho provider-console registration, and live OAuth have not been executed here. Status remains unverified; no PASS claimed.

- Follow-up: updated Gmail and Zoho worker refresh tests to use the selected account's encrypted OAuth client fields, and typed these fields in `EmailCredentials`. Tests were not executed after the update.


## 2026-10-09 — OAuth callback public-origin correction

- Source status: shared Gmail/Zoho callback origin helper now uses a validated single `X-Forwarded-Host` + `X-Forwarded-Proto` pair when supplied by the trusted reverse proxy; malformed/partial forwarding chains fail closed.
- Gmail and Zoho success redirects use the resolved public origin. Settings pages display an explicit warning when the callback origin differs from the browser's current origin.
- Regression tests cover internal `https://localhost:3000` plus public proxy headers, malformed forwarding headers, and Settings mismatch guidance.
- **Not verified:** unit tests have not been executed; no typecheck/build, live reverse-proxy header check, migration deployment, or Google/Zoho OAuth flow has been run in this session. No PASS is claimed.
- Required runtime action: configure proxy header overwrite/validation, deploy current main, access Settings through the intended public HTTPS domain, confirm exact displayed callback, then restart OAuth.

## 2026-10-09 — AI configuration source evidence (not runtime acceptance)

- Added organization-scoped AI runtime settings, provider settings APIs/UI, model catalog fetching, and Clara runtime database resolution.
- Added migration `0028_organization_ai_runtime_settings.sql` and static regression assertions in `apps/web/tests/ai-runtime-settings.test.ts`.
- Chat, voice, and worker knowledge-base selection now prefers the organization-scoped KB ID and retains `CLARA_KB_ID` as a compatibility fallback.
- Tests, typecheck, builds, migration execution, live provider requests, chat streaming, voice transport, browser verification, and deployment were not executed. Runtime acceptance remains pending; no PASS is claimed.

## 2026-10-09 — Gmail mailbox synchronization source evidence (runtime acceptance pending)

- Added and wired `apps/worker/src/email/mailbox-sync-worker.ts` into the worker lifecycle. It polls organization-scoped Gmail accounts, claims work through `email_sync_states`, persists provider messages/threads, updates cursor/last-sync state, and records retries/errors.
- Updated Gmail initial sync to paginate and retain a pre-import history baseline; expired history IDs fall back to an idempotent full import.
- Refreshed access tokens are persisted through the existing encrypted credential repository. Reconnect preserves an existing refresh token when Google omits a new one.
- Added a protected manual sync endpoint and mailbox UI action; mailbox status refreshes automatically.
- Added static/source regression tests and Gmail adapter pagination/token snapshot tests.
- **Not executed:** unit tests, typecheck, build, migration application, deployment, Google API calls, worker runtime, live mailbox sync, inbox/draft persistence verification. No PASS is claimed.
- **Runtime prerequisites:** migration chain through `0028`; deployed web and long-lived worker; shared PostgreSQL and `CREDENTIALS_MASTER_KEY`; working Google OAuth refresh token and Gmail API access.

### Gmail draft and mailbox UI follow-up — source-only

- HTML-only Gmail messages now produce a readable text body while unsanitized HTML is not persisted into the trusted HTML column.
- Provider draft resource IDs are mapped and imported drafts are marked as synced. Draft-resource lookup is cached per adapter session; message-detail calls use bounded batches and the worker polls every 10 seconds.
- `/mail/drafts` and `/mail/compose` now use the authenticated active organization rather than the development organization.
- Source assertions cover these changes. Unit tests, typecheck, builds, deployment, and live mailbox/draft verification remain unexecuted.


### 2026-10-09 — Zoho/IMAP source-review corrections (not test verification)

- Zoho draft update now issues a provider PUT and maps supplied draft fields into the request payload.
- IMAP checkpoint state is restored during initial import as well as incremental sync and retained when a folder exceeds the bounded UID batch.
- SMTP AUTH PLAIN now encodes the required NUL-delimited username/password payload.
- Commits: `72f05f5f642beea07cc5543fbc744051a083f922`, `5d2c3f3bcbab6698a56449afda407921c05b7760`.
- **Not executed:** Focused Zoho/IMAP tests and worker/web typechecks. Local execution was attempted but blocked because pnpm is not installed and github.com could not be resolved from this environment. No PASS claimed.
- **Still pending:** Real IMAP server compatibility, live provider sync to PostgreSQL, organization-scoped Clara Chat retrieval, Clara Core RAG email indexing, Redis application client use, and RabbitMQ durable queue/consumer/retry integration.

- Additional source correction: IMAP thread IDs now prefer the root References ID and fall back to Message-ID/folder-UID, with parser assertion added (`e21fd2fad824a41180deb6cf89b4f7aafb051f7c`, `d5dbd54cb7cb7b224d39b9b4e836b62501c575d3`). This is test source only, not an executed test result.


### 2026-10-09 — Zoho/IMAP focused-test review (source-only)
- Fixed Zoho adapter test mocks to follow `/api/accounts` discovery before account detail and folder/message requests (`f04eb93d27ee01934970e64679be381d6dec6500`).
- Corrected IMAP LIST command quoting/escaped CRLF after source review found the command had been split by a raw newline; corrected Zoho incremental capability metadata (`fe3e2d39157f74c66741772966125cfee81055a1`, `5a59ec5745f8d3a3f735220f9496e14c79dece22`).
- **Not executed:** Zoho/IMAP tests, worker/web typechecks, real IMAP server, deployed PostgreSQL ingestion, Clara Chat turn. No PASS claimed.
- **Still pending:** Clara Core RAG email indexing, real Redis client use, RabbitMQ durable sync queue/consumer/retry/DLQ, and provider-to-chat runtime acceptance. FIX-01 owns BKL-008; OPS-01 owns production infrastructure/deployment.


### FIX-01 worker credential snapshot correction — 2026-10-09
- **Reported evidence:** User-provided Docker build failed with TS2322 at mailbox-sync-worker.ts:156 and TS2345 at line 201.
- **Source changes:** GmailAdapter.getCredentialSnapshot() now returns shared EmailCredentials; worker spreads the typed snapshot into the persistence record; focused contract test added.
- **Commits:** caad1d753b0199a895d63056704c4db9c423f382, 04a2345b6b901ebbc55d084dc5860f39ae9416d8, a98c0e7fa1ee8e22ff60726475e6fb91624626c8.
- **Verification status:** source_changed_not_tested. No pnpm, TypeScript, Docker, or test command ran in this session. The original failure is evidenced by the supplied log; passing build is not established.
- **Next:** Run focused Gmail adapter regression and worker build/typecheck. Route infrastructure/dependency/Docker-specific failures to OPS-01.


## 2026-10-09 — Redis mailbox lease (source only)

- Status: source_changed_not_tested
- Commits: `d7228495f5bd03483154ac194cba865fbf3b00e5`, `0e10e647b029ea065b467e120180248e1eb1b27d`, `bd6368d7f56f39660cf28b913026fcb8fd0a0004`.
- Implemented: RESP2 lease client for redis:// and rediss://, optional AUTH/database selection, token-owned SET NX PX acquisition, and compare-and-delete release. Mailbox batch coordination is guarded by this lease only when REDIS_URL is configured.
- Not verified: worker/web typechecks, tests, Redis connectivity/auth/TLS, contention, TTL expiry, or live sync.
- Remaining: add tests, Clara Core-supported email indexing, RabbitMQ durable queue/retry/DLQ, and provider → PostgreSQL → tenant-scoped chat acceptance.


### Redis lease tests — source only (2026-10-09)
- Added `apps/worker/tests/redis-lease.test.ts` in commit `fbd07ca9dee64a3fbe114bb16cf08fadcfa695f1`.
- Coverage authored: SET NX PX acquisition and contention, token-checked EVAL release, and AUTH/database selection.
- Status: unexecuted; worker/web typechecks and live Redis verification remain pending.


### FIX-01 Zoho OAuth test parser correction — 2026-10-09
- **Pre-fix evidence supplied by user:** `pnpm run typecheck` passed for packages/shared, packages/db, packages/clara-core, and apps/worker. apps/web failed in `tests/zoho-oauth-settings.test.ts:84` with TS1127 and TS1434.
- **Root cause:** Literal backslash-n sequences between assertions caused TypeScript parser errors.
- **Source fix:** Replaced the exact malformed sequence with real newlines; commit `39857c40820940b500dcf452331dfe82ae35b861`.
- **Status:** source_fix_committed_post_fix_not_tested. Do not infer web typecheck success from the source edit alone.
- **Next:** Re-run `pnpm run typecheck` and focused Zoho OAuth settings test. Route separate environment/CI/deployment issues to OPS-01.


### FIX-01 Zoho OAuth focused regression follow-up — 2026-10-09
- **Typecheck:** User-provided latest `pnpm run typecheck` passed all workspaces, including apps/web.
- **Focused test before latest assertion correction:** 8 passed, 2 failed in `tests/zoho-oauth-settings.test.ts`.
- **Failures:** raw-IP HTTP assertion expected HTTPS error although DNS-only/raw-IP rejection happens first; helper-source assertion rejected the explanatory comment's `NEXT_PUBLIC_APP_URL` mention.
- **Correction:** Test-only change in commit `c58d6d442767f471c694ef978fdb06eca6d29850` aligns both expectations; OAuth runtime implementation unchanged.
- **Current status:** `typecheck_passed_user_reported`; corrected focused test `pending_rerun`. No focused-test PASS is claimed.


## 2026-10-09 — Fragmented IMAP literal test source

- Added a deterministic PassThrough-socket regression that delivers the literal marker, literal body, and trailing tagged response in separate chunks.
- Status: source change committed; test not executed. Worker/web typechecks, full focused adapter tests, and real IMAP server validation remain pending. This entry is not a PASS claim.


## 2026-10-09 — Email sync queue contract source

- Added `apps/worker/src/queues/email-sync-message.ts` and `apps/worker/tests/email-sync-message.test.ts`.
- Intended coverage: documented envelope fields, account/history idempotency key, full-sync key, invalid UUID and blank history cursor rejection.
- Status: source committed; tests/typechecks not executed. This is not evidence of runtime RabbitMQ integration.

### 2026-10-09 — Live schema drift and Redis lease diagnostics
- User-supplied live logs show missing `ai_provider_configs.model` and `email_sync_states.last_attempt_at`; mailbox sync API returns HTTP 500 as a result.
- Forward migration `0029_runtime_schema_reconciliation.sql` committed as `a4fab9df07deafa5fd47879217616e3cb6d1c03f`.
- Redis lease rejection now retains up to 200 characters of the Redis server error reply; focused WRONGPASS regression source committed as `0fa3e751cae2e5105b212083e93a7cc87bf00468`.
- **Not verified:** migration application, Redis AUTH/ACL/TLS/connectivity, focused test execution, typecheck/build, and live mailbox sync. GitHub commits are not runtime evidence.


## 2026-10-09 — Zoho OAuth callback token metadata correction

- **User-reported symptom:** Zoho consent returned to the app, but no Zoho mailbox appeared; UI displayed `Zoho did not return the required token metadata.`
- **Source correction:** `apps/web/src/app/api/oauth/zoho/callback/route.ts` no longer treats `api_domain` as mandatory token metadata. It selects the Mail API origin from the server-validated signed data-center setting and gives actionable guidance for token exchange rejection without exposing token response details. Static regression assertions added to `apps/web/tests/zoho-oauth-settings.test.ts`.
- **Commits:** `2cb976bf6cc6d835ff75692998e04958d63e001d`, `53d96a0f3125830a9dc07ae3011a96d7b54c878b`.
- **Verification status:** source_changed_not_tested. No typecheck, test, migration, deployment, or live Zoho OAuth retry was run. No runtime PASS claimed.

## 2026-10-09 — DEV-01 Lovable UI migration status

- **Source changes committed:** Inbox, Agents, Mail Accounts, Drafts, Threads, Compose, and Approvals visual adaptation to the `source/lovable-ui` Agentic AI Studio design system.
- **Behavior preservation covered by source assertions:** Inbox search/filter/refresh/read-state/archive/move; agent creation and slug/purpose validation; mailbox connection forms and test/disconnect/remove; Drafts search/provider sync/edit/delete; Compose save and explicit approval request; Approvals approve/reject; truthful empty/error states.
- **Static contract test file:** `apps/web/tests/lovable-ui-migration.test.ts` updated, but **not executed**.
- **Typecheck/build/browser/runtime status:** not run in this session. No PASS is claimed.
- **Related commits:** `9de78b0f`, `c9641d9d`, `9da036ac`, `e84075eb`, `52be6d66`, `706b46eb`, `295b038f`, `224146d0`, `a47edb72`, `737ab08e`, `c25fdf7c`.
- **Next:** continue remaining route groups per `docs/project-control/NEXT_ACTION.md`; runtime/database/Redis work remains assigned to OPS-01 and the Mail Approvals tenant-context issue is routed to FIX-01 (BKL-012).


## 2026-10-09 — RabbitMQ email.sync source integration (not runtime verified)

- Source now includes `amqplib` dependency and lockfile entry, durable main/retry/DLQ topology, persistent publish with publisher confirms, consumer prefetch/manual acknowledgements, bounded retry/DLQ flow, confirmed republish-before-ack, worker producer polling and account-scoped consumer dispatch.
- Added static source assertions in `apps/worker/tests/email-sync-rabbitmq.test.ts`.
- Source commits: `f53f1124` dependency, `0741b7cf` lockfile, `7a350e49` transport, `7f9f0699` producer/consumer dispatch, `7f3fc212` worker startup, `02780cc8` tests.
- Status: source_changed_not_tested. No test/typecheck/build, lockfile install, live broker, delivery/retry/DLQ, reconnect, or deployment validation has run. No PASS claimed.
- Next: robust connection recovery and Clara-supported indexing adapter. Clara indexing remains not implemented; do not write directly to Qdrant or modify Clara source.

## 2026-10-09 — Live inbox schema drift and Redis authentication
- User-supplied logs show `email_messages.from_name` missing and Redis AUTH rejected with WRONGPASS. A queued API response is not sync completion.
- Added `0030_email_messages_runtime_reconciliation.sql` (commit `69c51678c8c12e0a0c070214dc09db77e0758dae`) and static regression coverage (commit `e7a1e7ee396d542ffdf3edada895938a087b6a27`); a follow-up also drops the legacy `from_address NOT NULL` constraint when present so worker inserts using `from_email` are not blocked (commit `87665353a615efa315f1610d104800153e114107`, assertion commit `9657810328903b397c7084852e0f31d05771ef12`).
- **NOT VERIFIED:** migrations 0029/0030 application, tests, typecheck/build, Redis credential correction, message persistence, inbox loading, and live sync.


## 2026-10-09 — Knowledge UI source adaptation (not executed)

- Added `apps/web/src/app/api/knowledge/route.ts`: authenticated organization context, `organization.read` authorization, organization-filtered counts for email documents/chunks and recent persisted email knowledge records. No credentials or email bodies are returned by this status endpoint.
- Updated `apps/web/src/app/knowledge/page.tsx` to replace hard-coded zero counts and inert controls with live API-backed metrics, recent document status, refresh, and loading/error/empty states. Mailbox actions link to the existing accounts page. UI explicitly says semantic embeddings/Qdrant and external-source onboarding are not enabled.
- Added static contract assertions in `apps/web/tests/lovable-ui-migration.test.ts` and updated `docs/project-control/LOVABLE_UI_MIGRATION.md` / `NEXT_ACTION.md`.
- Commits: API `9c6bc94e`, UI `95970d59`, test `c4cb353b`, migration matrix `ccbb50ed`, NEXT_ACTION `2018eca4` and `10551cbb`.
- **Not verified:** no tests, typecheck, build, browser run, API request, database query, or live organization retrieval was executed. This is source adaptation only; no PASS claimed.
- **Next:** Activity screen adaptation, then Audit, per project-control.


## 2026-10-09 — Activity UI source adaptation (not executed)

- Updated `apps/web/src/app/activity/page.tsx` to use the existing persisted `/api/audit` endpoint with functional search, event-type and decision filters, refresh, responsive event rows, Lucide status icons, and explicit loading/error/empty states.
- Added static route-contract assertions to `apps/web/tests/lovable-ui-migration.test.ts` and marked Activity adapted in `docs/project-control/LOVABLE_UI_MIGRATION.md`.
- Commits: Activity UI `b344b0ad`, static test `dfaf7d11`, migration inventory `1fe0050c`, NEXT_ACTION `03d9c499`.
- **Not verified:** no tests, typecheck, build, browser, or live API run. No PASS claimed.
- Next: adapt Audit, preserving its authenticated organization scope and export safeguards.


## 2026-10-09 — RabbitMQ and Clara email indexing continuation (source-only)

- RabbitMQ consumer now assigns active channels before registering the consume callback to avoid an early-delivery race; source regression assertion added.
- Corrected both mailbox polling predicates so an existing incremental cursor alone does not make an account continuously eligible. The last-success age and pending/error status now govern the next poll. Source regression assertion added.
- Clara email indexing now splits email content into bounded overlapping chunks, rebuilds stale chunk rows safely when chunk boundaries change, and preserves organization/agent scope metadata. Local Clara host retrieval now matches sanitized query terms using PostgreSQL lexical search and returns no sources for empty queries. Static contract tests added.
- Commits: d2e6fe39, e760bb92, 4bad6d3e, 766c487d, 28080eb7, 93a9804d, 0eedd60f, 2b95ca81, 854285f5.
- NOT RUN: worker tests, Clara tests, typechecks, builds, frozen-lockfile install, RabbitMQ/Redis connection tests, PostgreSQL integration, live IMAP/Zoho, and end-to-end email-to-Clara retrieval. These are source changes only; no runtime PASS is claimed. Semantic embeddings/vector indexing are not implemented by this host adapter; it uses existing PostgreSQL knowledge records and lexical retrieval, not direct Qdrant writes.


# FIX-01 live mailbox workflow follow-up — 2026-10-09
source_review:
  status: committed_not_executed
  findings_fixed:
    - "0030 migration dollar-quoted DO block corrected"
    - "Inbox search ILIKE predicates use bound PostgreSQL parameter placeholders"
    - "0031 introduces cursor_token text to reconcile legacy JSONB cursor and current provider tokens"
    - "Worker sync cursor reads/writes use cursor_token"
  regression_source:
    - "apps/web/tests/migration-verification.test.ts"
  runtime:
    migration_0029_0031_applied: unknown
    redis_auth: "FAIL — user supplied WRONGPASS logs"
    web_worker_rollout: unknown
    mailbox_import: "NOT VERIFIED"
    inbox_rows_visible: "NOT VERIFIED"
  policy: "Do not claim success from HTTP 202; do not bypass Redis lease locking."


## 2026-10-09 — Settings navigation source adaptation

- Settings route now has section navigation and stable anchor targets for organization, mail OAuth, AI provider, Clara runtime, members/roles and workspace links. Existing provider configuration and password/membership endpoints remain unchanged. Added static contract source at apps/web/tests/settings-page-contract.test.ts.
- Commits: b0c6d04d (Settings UI), 88fd8eea (contract test), 175cb9ea (migration inventory).
- Status: source_changed_not_tested. No tests, typecheck, build, browser, accessibility, or live API validation were executed.


## 2026-10-09 — Settings, Login/Setup, and Agent detail UI source adaptation (not executed)

- Compact Lovable geometry applied across general Settings and AI provider/runtime, Gmail OAuth and Zoho OAuth subcomponents. Existing secret-handling and provider API contracts preserved.
- Login/Setup now use consistent compact cards and Lucide iconography; authentication redirect guard, bootstrap secret, password minimum, and slug pattern remain in source.
- Agent detail tabs (overview, versions, policy, channels, test, activity) use compact card geometry and Lucide iconography; organization-scoped server load, versioning, policy validation, and explicit deploy/pause confirmation paths retained.
- Static assertions added in `apps/web/tests/lovable-ui-migration.test.ts`; migration matrix updated. Relevant source commits and hashes are listed in `docs/project-control/DEV-01/WORKLOG.md`.
- **Not verified:** tests/typecheck/build/browser/accessibility/live API not run. No PASS claimed.
- Next: cross-route responsive/accessibility review and remaining secondary controls.


## 2026-10-09 — Agent channels accessibility/data-source correction (not executed)

- Corrected Agent Detail channel loading to request WhatsApp accounts from `/api/whatsapp/accounts` separately from email accounts. Previously the component read `payload.whatsappAccounts` from the email-only endpoint response, leaving the WhatsApp selector empty. Both requests remain organization-scoped and use cancellable effect cleanup.
- Added a source-contract assertion and labeled the deploy/pause confirmation dialog for assistive technology.
- Commits: `1f0566b4`, `a67c1dee`, `3d8e2669`, `952d704e`.
- Tests/typecheck/build/browser/live API verification remain NOT RUN. No PASS claimed.


## 2026-10-09 — Cross-route compact geometry and accessibility assertions (not executed)

- Normalized card/control radii across migrated routes to compact geometry while retaining full-pill status labels.
- Agent detail channel loading now uses the separate WhatsApp accounts endpoint, selected tabs expose `aria-pressed`, and deploy/pause confirmation has an accessible title association.
- Added cross-route static assertions in `apps/web/tests/lovable-ui-migration.test.ts` (commit `b328373c`) and inventory note `e31327c8`.
- **Verification:** test suite, typecheck, build, browser/responsive and accessibility checks were not executed. No PASS claimed.
- **Next:** continue source-level review of remaining secondary controls, then complete manual responsive/accessibility verification when a browser/runtime is available. Do not wait for CI/Vercel.

 
## 2026-10-09 — pnpm lockfile parse/resolution failure
- **User evidence:** `pnpm run typecheck` stopped before typechecking with `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` for `amqplib@2.2.0`.
- **Source analysis:** `pnpm-lock.yaml` had two concatenated YAML documents. The workspace document had the `apps/worker` importer but lacked the matching package and snapshot records.
- **Correction:** Commit `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e` leaves one workspace lockfile document and restores those records.
- **Verification status:** Source structure inspected; frozen install and typecheck NOT RUN after correction. Do not infer PASS.

## 2026-10-09 — DEV-01 keyboard/status accessibility source follow-up

- Source commits: Agent Detail modal/channel labels `d73099d6`; Chat log/status/composer `3d8ac3a3`; mobile sidebar focus containment `837b4b19`; static contract assertions `0a603b76`, `f8c3aefd`.
- Intended source contracts: modal focus moves into the dialog, remains within the dialog on Tab/Shift+Tab, closes on Escape and restores focus; mobile navigation behaves similarly while open; chat exposes a labelled live log and polite status announcement; secondary channel selects have accessible names.
- **Verification status: NOT RUN.** The source-contract tests were not executed. Typecheck, build, browser, keyboard-only, screen-reader, responsive viewport and live API checks were not run. No PASS claimed.

- Follow-up narrow-screen source change: Chat agent switching is now available below the `sm` breakpoint (`bc8e698f`), with a source-contract assertion (`ad7dc7f8`). Responsive viewport/device validation NOT RUN.

- Chat announcement refinement: source commit `d9662da6`, contract assertion `529ed8b2`. A persistent polite status region covers thinking, completed responses, and response failures; visual thinking is hidden from assistive technology to avoid duplicate announcements. Screen-reader/browser tests NOT RUN.

## FIX01-PNPM-LOCKFILE-REGRESSION-20261009 — 2026-10-09
- **Reported failure:** Docker install and `pnpm run typecheck` stopped with `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` for `amqplib@2.2.0`. `pnpm install --fix-lockfile` reproduced the same failure.
- **Root cause:** The reported revision's lockfile contained concatenated YAML documents; the workspace worker importer referenced `amqplib@2.2.0` without matching package and snapshot entries.
- **Source state:** Lockfile repair already exists on main at `27f04065d08ec0ee7b6c7cd58ced0a60d510cd3e`. Added regression assertions to `apps/web/tests/migration-verification.test.ts` at `b9ba0c6738e32cf4ef8b670a4b65857a56eb50f2`.
- **Static evidence:** Current `pnpm-lock.yaml` has the workspace lockfile header, `apps/worker` importer, `amqplib@2.2.0` package entry, and snapshot entry.
- **Execution status:** NOT RUN after correction: `pnpm install --frozen-lockfile`, lockfile regression test, `pnpm run typecheck`, Docker build. No PASS claimed.
- **Next action:** Pull latest main, run frozen install then typecheck. Route separate Docker host/build environment failures to OPS-01.

## FIX01-PNPM-TARBALL-INTEGRITY-20261009 — 2026-10-09
- **User evidence:** Frozen install, typecheck, and focused Vitest command each failed before compilation/test execution with `ERR_PNPM_MISSING_TARBALL_INTEGRITY` for `amqplib@2.2.0`.
- **Root cause:** The package entry had a tarball URL but no SRI integrity hash; pnpm's supply-chain policy correctly rejected it.
- **Source correction:** Added published SHA-512 SRI to `pnpm-lock.yaml` (commit `644d578170801785c1252a569fa976b0b33476eb`).
- **Regression source:** Assertion now requires an integrity-form resolution specifically on the amqplib package entry (commits `21837f32157ff43a7a1243b3f3095bb1eb2f1df6`, `d115e1b0293b48571cd0902849cb5f0030963bc7`).
- **Execution status:** NOT RUN after correction: frozen install, focused Vitest, typecheck, Docker build. No PASS claimed.
- **Next action:** Pull latest main; frozen install first, then typecheck and focused Vitest if install succeeds.

## FIX01 lockfile regression assertion source review — 2026-10-09
- **Finding:** Source inspection found over-escaped regex literals in the focused lockfile regression test.
- **Correction:** Fixed regex escaping and scoped the integrity assertion to the exact `amqplib@2.2.0` entry in commit `162183e8d7c67b8346c15989ef850327e487cfc4`.
- **Status:** Source only. Vitest remains NOT RUN; frozen install, typecheck, and build remain pending.

## FIX01-WORKER-TYPECHECK-MIGRATION-PATHS-20261009 — 2026-10-09
- **User-observed:** pnpm install --frozen-lockfile PASS; supply-chain policy accepted 534 entries and one package was installed.
- **Pre-fix failures:** Workspace typecheck reported TS2345 for the optional RabbitMQ URL at email-sync-rabbitmq.ts:165; worker typecheck was also SIGKILLed. Focused migration Vitest failed collection with ENOENT for the old 0003_database_security_hardening.sql path.
- **Source corrections:** Consumer URL now has a definite string type while missing configuration still returns without connecting (09e4df46); worker source-contract assertion added (a24edec3); migration static test now references canonical 0013 and 0005 files (ffc98b30).
- **Post-fix status:** NOT RUN — focused migration Vitest, worker contract test, web typecheck, worker typecheck, full workspace typecheck, build. No post-fix PASS claimed.
- **Next action:** Execute focused tests, then package typechecks sequentially to avoid resource contention; record actual output.

### FIX01-SECURITY-ASSERTION-ALIGNMENT-20261009
- **Finding:** After correcting the stale migration paths, source comparison showed the security tests still expected the historical public is_active_organization_* wrappers. The current canonical 0013 migration intentionally drops those caller-selected-user-ID wrappers and exposes SECURITY INVOKER can_access_organization/can_manage_organization helpers backed by private membership checks and app.user_id.
- **Correction:** Rewrote the assertions to test the current least-privilege contract and grants rather than the superseded migration implementation.
- **Commit:** 618c4cd57f0e7e433c4da5f50840cd6c8f612b9b.
- **Verification:** Source only; focused migration Vitest NOT RUN.


## 2026-10-09 — Web typecheck follow-up (FIX-01)

- User-reported diagnostics: missing lucide-react module across UI source files; TS18048 in Agent Detail and sidebar focus traps; TS2304 for missing newAgentPage in lovable-ui-migration.test.ts.
- Source corrections committed: dependency/lockfile (8f09785a, 7b1136e6), focus typing (3e35c1f5, a9dcb8e5), static test binding (52a4e348).
- Status: source_corrected_execution_pending.
- NOT VERIFIED: frozen install after adding Lucide, focused tests, web typecheck, worker typecheck, full workspace typecheck and build. Do not infer PASS from source edits.


## FIX01-MIGRATION-WORKER-TEST-DRIFT-20261009 — 2026-10-09
- **Source changes:** Added forward-only audit-event access hardening migration 0032 and corrected migration/worker static contract tests. Commits: 7557a6cd, ee85b554, cecae73e, c4d4abd0, 96996d82.
- **Source evidence:** Current main migration 0002 uses standard valid `DO $$` blocks; migration 0032 uses a named `$phase4$` delimiter. Retry logic retains idempotency/correlation by spreading the envelope. Email indexer source names Qdrant only in documentation and does not import/call a vector client.
- **NOT VERIFIED:** No focused Vitest, worker node:test, web/worker typecheck, SQL migration execution, database runtime check, or deployment verification has run after these changes.
- **Lockfile:** Current main has one lockfile document and one importer section. The two-document symptom in the user's local output is not present in the fetched main file; reconcile local working tree with origin/main before editing.
- **Next action:** Pull latest main; inspect `git status --short` and compare `pnpm-lock.yaml` with `origin/main`; run focused migration and worker tests, then sequential web and worker typechecks. No PASS claim until actual outputs are recorded.


## 2026-10-10 — Phase 4 migration test alignment

- Updated `apps/web/tests/migration-verification.test.ts` to check `summary_sources` creation in migration 0003 and its tenant RLS policy in migration 0004, rather than incorrectly requiring both in migration 0002.
- Commit: `c51d5a79dfd999dd4382cc60005798531e5517be` on `fix/migration-verification-phase4-contract`.
- **NOT VERIFIED:** Focused Vitest, worker contract tests, web/worker typechecks, migration execution, and database runtime checks have not run after the change.
- **Lockfile discrepancy:** Current fetched main lockfile has one document; local shell output showed two. Reconcile against current remote; do not claim a GitHub lockfile defect from local output alone.


## 2026-10-10 — Dollar-quote assertion correction
- User-run focused test result before this correction: 83 passed, 3 failed.
- Corrected test expectations for valid PostgreSQL `$$` delimiters and narrowed single-dollar regexes in commit `58730eb8b0fa46bfdd5fca581295209921582dbe`.
- **Pending:** Re-run the focused Vitest test after reconciling the local duplicate-document lockfile against the PR branch. No PASS claimed.
- GitHub branch lockfile is single-document; local working copy remains modified and must be reconciled carefully.

## Continuation record — 2026-10-10 (FIX-01)

- Branch: `fix/migration-verification-phase4-contract`.
- Source changes committed: Node test-runner compatibility for three worker contract tests; ESM-safe fixture paths in six worker tests; provider capability-discovery retry; RFC 2047 IMAP encoded-header matching; provider-event informational message metadata; and corrections to Clara, IMAP, Zoho, and email-action static contracts/mocks.
- GitHub accepted source and control commits. This confirms commit creation only.
- **NOT RUN / NOT VERIFIED:** focused web tests, full worker test suite, web/worker typechecks, build, provider/database runtime integration, and deployment.
- No deployment PASS is claimed. Preserve the lockfile and local backup artifacts. Next verification is specified in `docs/project-control/NEXT_ACTION.md`.

## Deployment attempt — 2026-10-10

- Requested a preview deployment for branch `fix/migration-verification-phase4-contract`, commit `a4877ee23152b4895bf5eae48243ddb0202c8155`.
- Vercel rejected the API request with HTTP 402: `api-deployments-free-per-day` (daily deployment API quota exceeded; retry after 24 hours).
- No new deployment was created. Recent branch deployments visible in Vercel were canceled and were for earlier commits.
- **Deployment status: NOT DEPLOYED / NOT VERIFIED.** Do not label this change production-ready or claim a successful deployment. Resolve the Vercel quota with the account owner or retry after the provider's stated cooldown, after local tests/typechecks are run.


## User-run verification update — 2026-10-10

- tests/email-action-contract.test.ts: PASS, 8/8.
- tests/migration-verification.test.ts: 85/86; remaining failure says two lockfileVersion: declarations in the runtime file under /docker/ai-comms-agent. The current GitHub branch pnpm-lock.yaml was fetched and contains exactly one lockfileVersion: and one importers: declaration, so this is presently a local/container file discrepancy, not a reason to overwrite the canonical lockfile.
- Worker suite: 79/81; failures were the IMAP multiple-literal test assertion and scheduling migration regex assertion. Both assertions have been corrected in commits a666d98b8b9f1e437355c392d01c42a9dc54bfe9 and bb987c60129ebd1d4f3d5bd8f132068859ffb6c2.
- Web and worker typechecks produced no errors in the user's pasted output. Re-run focused tests to verify the new commits. Full build, live integration, and deployment remain unverified; Vercel previously returned HTTP 402 daily deployment quota exceeded.


## Follow-up verification — 2026-10-10
The user's focused rerun shows scheduling idempotency test passes; IMAP multiple-literal assertion still failed because regex braces were unescaped. Corrected in commit b87d5bc804331470a280bf54ee020b463a186d5f; this commit is not yet user-rerun verified. The user also confirmed the duplicate lockfile headers are in their modified local tracked pnpm-lock.yaml (headers at lines 2/159); GitHub branch copy has one top-level header pair. Four local backup artifacts remain untracked and must be preserved. Recommended recovery is to inspect the diff and restore the tracked lockfile from HEAD only after confirming the backup files exist and the diff is the accidental duplicate document. No deployment verification.

## 2026-10-10 — Inbox schema / role guard / RabbitMQ fallback source updates
- User runtime evidence: inbox query failed on `ea.message_id`; draft list returned 403 `insufficient_role`; RabbitMQ connect/queue producer failed repeatedly.
- Source-only corrections on main: migration 0033 reconciles legacy `email_message_id` into `message_id`; role guards implement member < admin < owner; enqueue failure invokes the existing Redis-leased direct-sync batch; RabbitMQ startup logs sanitized endpoint and error metadata.
- Regression source added for migration compatibility, role hierarchy, and leased fallback.
- **Not verified:** Vitest, typecheck, Docker build, migration 0033 execution, broker/Redis connectivity, actual provider sync, or live API behavior. No PASS claimed.
- User must pull latest main and run `bash scripts/manual-up.sh`, then inspect sanitized web/worker logs and persisted email rows.


## FIX-01 membership role rank correction — 2026-10-10

- **Source commits:** `44a08522f23e807755114ebe46b8b1e04e6056da` (authorization rank map); `3853ecf046c175e15a4f824e9679f50fb7132cf9` (RBAC regression tests).
- **Reported pre-fix evidence:** Next.js 15.5.27 production build compiled successfully, then failed during TypeScript validation at `apps/web/src/lib/identity/authorization.ts:109`: `viewer` missing from `Record<MembershipRole, number>`.
- **Source inspection:** Shared union is `owner | admin | member | viewer`; role permissions and transfer-ownership tests confirm viewer is a first-class role.
- **Correction:** Rank map now explicitly defines `viewer: 0`; regression tests cover viewer denial for minimum member and admin/owner acceptance for minimum member.
- **Post-fix verification:** Focused Vitest NOT RUN; web typecheck NOT RUN; Docker build/manual-up NOT RUN; deployment/runtime NOT RUN. No PASS claimed.
- **Required next evidence:** Actual output from focused RBAC test, web typecheck, and manual-up build. Do not wait for GitHub Actions or Vercel; report any independent environment/infra failure to OPS-01.


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


## 2026-10-10 — User-run test command path mismatch

User ran `npm test -- src/modules/integrations/oauth-app-validation.test.ts src/modules/integrations/oauth-setup-guides.test.ts` in `Rilan-Dev/ai-comms-agent`, not the separate Clara AI Platform checkout. Root test script invokes `pnpm -r test`; the web Vitest config only discovers `tests/**/*.test.ts`, so it correctly reported no test files for those Clara-specific paths. The worker process was terminated by `SIGKILL`; supplied output does not identify an assertion failure or the kill cause. This is a command/workspace mismatch plus an unexplained process termination, not evidence that the Clara OAuth tests failed. Corrected workspace-scoped commands are recorded in `AGENT_EVENTS.md`. The email-account runtime diagnostic script remains unrun; no IMAP/SMTP or OAuth sync root cause is established.

### Live OAuth mailbox sync — 2026-10-10
- **Runtime result:** NOT PASS. The account remains pending/idle with zero stored messages after a queued sync.
- **Blocking evidence:** RabbitMQ configured with literal placeholder vhost `YOUR_EXISTING_VHOST`; Redis returns `WRONGPASS`; worker logs show repeated connection failures and safe batch skips.
- **Next verification:** Correct deployed `RABBITMQ_URL` and `REDIS_URL`, restart worker, requeue sync, then verify account timestamps/status and persisted message rows. Do not infer success from health 200 or HTTP 202.
- **Unrelated local check:** migration static test had 86 passed and 1 failed because local lockfile had two `lockfileVersion:` headers; worker RabbitMQ contract test passed 10/10. These do not establish live mailbox success.


## 2026-10-13 — EMAIL-OPS-01 source-only status

- **Branch/PR:** `feature/email-ops-e1-e3`, PR #15 (open draft).
- **Source written:** Gmail history pagination/deletion reconciliation; shared tool contracts/registry/read handlers/executor/runtime; OpenAI-compatible and Gemini tool-call adapters; bounded worker email tool loop; provider/loop test source; DEV-01 self-review.
- **Tests/typecheck/lint/build:** NOT RUN in this session.
- **Live provider/database/mailbox sync/browser/deployment:** NOT RUN.
- **Transport integration:** NOT COMPLETE. The worker loop is not called by chat, realtime voice, WhatsApp, or scheduled transports.
- **Security dependency:** ISS-026 remains FIX-01-owned; no transport exposure is authorized until the cross-agent mailbox-context issue is remediated.
- **Infrastructure:** OPS-01's RabbitMQ/Redis live ingestion blocker remains unverified.
- **Acceptance:** No PASS, merge, or deployment claim.

### 2026-10-14 — Email tool merge and index lifecycle plan

- GitHub reports PR #15 merged; merge commit d444cf1b35939008058532b0754b46daef7cc312. Source inspection confirms main contains apps/worker/src/agent/email-agent-loop.ts, apps/worker/src/agent/tool-executor.ts, and the Clara provider tool-call implementation.
- Added docs/plans/EMAIL-INDEX-IDENTITY-AND-ACCOUNT-LIFECYCLE.md based on main-source inspection. The current indexer uses an account-scoped document path and body SHA-256, but its background worker only selects indexed_at IS NULL; existing message updates need a reliable dirty/version signal. Account-wide Qdrant/vector deletion and stale-job prevention require explicit lifecycle work.
- Verification status: NOT RUN for provider-contract tests, worker-loop tests, executor tests, Clara/worker TypeScript checks, full build, DB integration, vector integration, and live mailbox sync. A local checkout was not available and outbound DNS to github.com failed. Do not claim runtime correctness or vector cleanup is verified.
- Ownership: FIX-01 owns ISS-026. OPS-01 owns live infrastructure and ingestion verification.


## 2026-10-16 — Gmail realtime source implementation (not verified)

- Source changes on `feature/provider-realtime-email-sync`: Gmail watch adapter methods; 12-hour worker watch renewal (renew before 24-hour expiry); authenticated Pub/Sub webhook; mailbox account resolution; due-sync trigger; rejection tests for missing/malformed bearer tokens.
- **Tests/typecheck/lint/build:** NOT RUN after these changes.
- **Google Cloud setup / live push:** NOT RUN. Required environment: `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_PUSH_AUDIENCE`, `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT`, Gmail API enabled, Pub/Sub topic publisher permission for Gmail, and a push subscription configured with OIDC authentication and the matching audience/service account.
- **End-to-end mailbox behavior:** NOT VERIFIED. Do not claim instant mail delivery, successful renewal, or production readiness. Next: run focused web/worker tests and typechecks, add valid/invalid JWT and notification-path coverage, then OPS-01 performs an independent-account send and measures provider-to-DB-to-inbox latency. Continue with IMAP IDLE after Gmail reconciliation hardening.

- Additional source added after initial note: migration `0049_email_sync_pending_push.sql`; worker preserves a newer `pending_push_at` that arrives during an active sync and schedules a follow-up pass. The watch loop checks every five minutes. Migration application and concurrency tests are NOT RUN.


Gmail follow-up hardening: watch failures now use stored retry backoff (5 minutes with exponential growth capped at 6 hours); successful watch registration persists refreshed OAuth credentials and clears retry metadata. The webhook skips notifications already covered by the persisted Gmail history cursor and acknowledges intentionally paused sync accounts. These are source changes only; their tests and runtime behavior remain unverified.


### Gmail RT-02 follow-up — 2026-10-16

- Added signed-JWT webhook tests using a synthetic test-only certificate/key: invalid audience, wrong service account, unverified identity, expired token, wrong issuer, future `iat`, malformed envelope/payload, unknown and ambiguous mailbox, paused mailbox, duplicate history cursor, and durable queueing.
- Added Gmail History API tests for paginated incremental changes and expired-cursor fallback to a fresh initial baseline.
- Gmail OAuth callback now attempts watch registration immediately when all three push settings are present, keeps `sync_webhook` capability disabled, and falls back to worker retry if watch registration fails.
- Watch worker now requires all three push configuration values, compares normalized mailbox addresses, merges watch/retry metadata without replacing unrelated connection configuration, and uses bounded exponential backoff capped at six hours.
- Added `.github/workflows/provider-realtime-email-sync.yml` for focused webhook/history/watch/checkpoint tests and web/worker typechecks. The workflow is push/PR triggered; it was not waited on or inspected in keeping with the no-polling instruction. Tests/typechecks have not been independently executed in this session.
- Google Cloud configuration, database migration application, actual Pub/Sub delivery, and independent-account delivery timing remain external acceptance items. No GCP/secret-management connector is available in this session, so cloud settings were documented but not applied.

**Not verified:** focused workflow result, TypeScript compilation, database migration application, cloud setup, Pub/Sub delivery, watch renewal against Google, and end-to-end latency.


### PR tracking correction — 2026-10-16

PR #18 and PR #19 are closed/merged. The initial realtime inbox refresh and Gmail push foundation are present on `main`. The follow-up hardening is tracked in [PR #21](https://github.com/Rilan-Dev/ai-comms-agent/pull/21), an open draft targeting `main`. Do not describe PR #19 as still draft. Focused workflow results remain uninspected; no claim of passing tests, live Pub/Sub, applied production migration, or end-to-end latency is made.


### IMAP IDLE source progress — 2026-10-16

- Added RFC 2177 IDLE support to `ImapSmtpAdapter`: detect the server's advertised `IDLE` capability, select `INBOX`, wait for `EXISTS`/`EXPUNGE`/`FETCH`/`VANISHED`, send `DONE` before returning, and reissue at a 25-minute maximum wait.
- Added `apps/worker/src/email/imap-idle-worker.ts`, started from the worker entrypoint. It maintains up to 20 connected-account watchers, reconnects with bounded backoff, backs off six hours for servers that do not advertise IDLE, and persists account-scoped change signals via `email_sync_states.pending_push_at` so the existing reconciliation worker performs the actual fetch/persist/checkpoint.
- Added focused parser tests and included them in the focused GitHub workflow. Periodic mailbox polling remains the fallback.
- **Not verified:** IMAP IDLE socket integration, live provider behavior, tests/typechecks, database migration presence in deployed DB, reconnect behavior against real servers, and per-provider latency. Source has been committed but the focused workflow is not being polled.



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

### FIX-01 worker credential type correction — 2026-10-16

- **Reported failure:** Docker worker image build stopped at `tsc` with TS2352 in `apps/worker/src/email/gmail-watch-worker.ts` and `apps/worker/src/email/imap-idle-worker.ts` because generic decrypted credential records were directly asserted as `EmailCredentials`.
- **Source correction:** Both consumers now validate `credential_type` against `oauth_token`, `password`, and `app_password`; they pass a spread object with the narrowed discriminant and no longer use the unsafe direct cast.
- **Regression protection:** Worker TypeScript compilation is the immediate regression check; targeted tests are queued in BKL-FIX01-WORKER-CREDENTIAL-TYPE-20261016. No new dedicated unit test was added because the defect is a compile-time boundary mismatch and the fix adds runtime discriminant rejection.
- **Not verified:** Worker typecheck, worker test suite, Docker worker rebuild, and full compose startup have not been run by FIX-01 in this environment. Do not mark this correction PASS until the typecheck/build evidence is available.
- **Source commits:** `185b729d`, `60fadabf`, `e3ba38c9`, `18948e08`; follow-up project-control records are committed on `main`.


### 2026-10-16 — Email RAG architecture review
- **Source review:** Inspected the PostgreSQL email chunk indexer, vector outbox/adapter contract, worker startup, local Clara retrieval, email read tools, Chat context loader, and Clara Core guidance.
- **Finding:** Current source does not establish working Qdrant email retrieval. PostgreSQL chunks are written; the vector-sync loop is not started and no supported concrete Clara email vector adapter is bound. Local retrieval remains SQL/tsvector/ILIKE. Chat email context is a fixed up-to-20 organization-scoped sample and lacks active agent-account binding (ISS-026, FIX-01-owned).
- **Artifact:** `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md`, commit `4f95fcd122c146b41de099bc98aaeeb614a53d87`.
- **Verification:** Documentation/source inspection only. No tests, typecheck, build, DB migration, Qdrant request, provider sync, latency benchmark, or runtime isolation test executed. No PASS and no 10x performance claim.
- **Next:** Architecture approval/correction and supported adapter/security contract before material code changes; FIX-01 owns ISS-026, OPS-01 owns live infrastructure/ingestion and latency evidence.


### 2026-10-16 — Clara email-vector API investigation
- **Finding:** Inspected Clara source `vector-store-kb.ts` and `/api/embed/search`. These are internal/KB-scoped paths, not a supported account-scoped email-vector API. No cross-repo API call was made.
- **Artifact:** Updated `docs/plans/EMAIL-RAG-HYBRID-RETRIEVAL-PLAN.md` at commit `0994cdd0a9388ee10b57ebc759d05a2eb4117f20`.
- **Status:** Adapter remains unbound; outbox loop remains unstarted; ISS-026 remains FIX-01-owned/open. No retrieval exposure.
- **Verification:** Source inspection/docs only. Tests/typechecks/build/API/Qdrant/ingestion/latency not run.
- **Next:** Establish authenticated Clara email-vector API; bind after ISS-026 closure. OPS-01 performs live runtime acceptance.



### 2026-10-16 — Clara email-vector API draft
- **Artifact:** Clara-AI-Platform draft PR #298, branch `feature/email-vector-api`.
- **Source status:** API route, dedicated vector store, contract documentation, and basic route-boundary tests authored. No source claim implies tests have passed.
- **Not run:** unit tests, typecheck, lint, build, live Qdrant or embedding calls, cross-account isolation runtime checks, ingestion, or latency benchmark.
- **Security:** ISS-026 remains open/FIX-01-owned. API is not wired into the ai-comms-agent outbox or user-facing retrieval.
- **Next:** Run focused executable checks and Qdrant integration coverage; only bind the adapter after ISS-026 closes. OPS-01 owns live environment and acceptance evidence.



### 2026-10-16 — Unbound Clara email-vector adapter
- **Artifacts:** `apps/worker/src/knowledge/clara-email-vector-adapter.ts` and `clara-email-vector-adapter.test.ts`; Clara draft PR #298 updated with nullable timestamps and content/metadata/chunk hashes.
- **Source-only status:** Adapter maps upsert, delete-message, and purge-account operations; requires server-only credential, HTTPS in production, bounded request timeout, and throws on HTTP failure for outbox retry.
- **Not run:** worker tests/typecheck, Clara tests/typecheck/lint/build, Qdrant/embedding calls, account-isolation runtime tests, ingestion or latency benchmarks. Do not mark passed.
- **Security boundary:** Adapter remains unbound and worker sync loop is not started. ISS-026 remains FIX-01-owned/open.

### 2026-10-16 — email vector metadata correction and Qdrant integration test authored

- Source corrections: adapter now clears stale sender/folder metadata with explicit null/empty values; Clara API accepts explicit metadata clears; request body cap uses UTF-8 byte length.
- Test authored: opt-in Qdrant integration test exercises org/account allowlist filtering and account-scoped deletion against a configured Qdrant service.
- Not run: Clara tests/typecheck/lint/build, worker tests/typecheck, or Qdrant integration test. Dependency-equipped local execution and a configured Qdrant integration endpoint were not available during this work.
- Security: ISS-026 remains open/FIX-01-owned. No adapter binding, outbox startup, or Chat/realtime-voice retrieval exposure.

### 2026-10-16 — shared hybrid retrieval source added; not executed

- Authored shared PostgreSQL + Clara semantic retrieval core with per-call account grant resolution, lexical/vector candidate fusion, SQL source revalidation, citations, stale semantic hash rejection, and explicit degraded fallback status.
- Authored worker tests at `apps/worker/tests/email-hybrid-retrieval.test.ts` and `apps/worker/tests/clara-vector-search.test.ts`; neither test file has been run.
- Clara search response now includes `contentHash`; host adapter rejects missing/invalid hashes. The SQL freshness comparison is source-authored only and still needs execution against the real schema and fixtures.
- No typecheck, test, lint, build, live Clara API, Qdrant, ingestion, isolation or latency test was run. No PASS claimed.
- ISS-026 remains open/FIX-01-owned. No Chat/voice wiring or worker outbox startup was enabled.


## FIX01-MICROSOFT-GRAPH-ENUM-20261016 — verification status

- **Source evidence:** User-provided worker logs repeatedly show PostgreSQL SQLSTATE 22P02 for microsoft_graph in email_provider. Source review found email_provider lacks that label while a separate email_account_provider enum includes it.
- **Source changes:** Migration 0034_email_provider_microsoft_graph.sql adds microsoft_graph to the correct enum; apps/web/tests/migration-verification.test.ts asserts that the correct type is altered.
- **Source write evidence:** Migration commit 83d512d5815bf7626a6b0d824a5ce92fedfa2189; regression test commit 988d78effcfa65fc9521eeb17a3c371d89173d69.
- **Not verified:** Static test execution, typecheck, migration execution against PostgreSQL, worker build/restart, cessation of SQLSTATE 22P02, Microsoft Graph subscription configuration, mailbox sync, and persisted-message counts.
- **Status:** SOURCE_CORRECTED / RUNTIME_VERIFICATION_PENDING. No PASS claimed.
- **Owner / next action:** OPS-01 applies migrations through the normal process, rebuilds/restarts the worker from matching source, inspects sanitized logs, and verifies sync timestamps and persisted messages. Keep the subscription-prerequisite warning separate from the enum defect.

## FIX-01 — Chat provider override incident (2026-10-17)
- **Source state:** Correction committed to `main` at `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`; per-agent provider lookup now continues if org runtime-defaults row is absent.
- **Regression:** Static test authored at `apps/web/tests/clara-agent-provider-resolution.test.ts`, commits `d9e6c619320390c5290c04d29d30187a6838736f` and `c0e0a31e788ecd24e6af89f42e4f67f5100b7c73`.
- **Not verified:** Test execution, typecheck, web build, live database row state, provider HTTP call, deployed revision, and successful chat response.
- **Owner/next:** OPS-01 confirms deployment and tenant-scoped configuration metadata, rebuilds/restarts using the existing manual procedure, and tests one Sarvam chat request. Do not claim PASS until the model call succeeds and logs show the intended provider without exposing secrets.
- **Session/handoff:** `docs/project-control/sessions/FIX01-CHAT-PROVIDER-OVERRIDE-20261017.md`; `HOF-FIX01-OPS-CHAT-PROVIDER-OVERRIDE-20261017` OPEN.


## DEV01-CHAT-WHATSAPP-TOOLS-20261017 — verification status

- **Source changes:** Interactive chat now calls the bounded host-authorized tool loop with authenticated server context. WhatsApp history is read-only; whatsapp.send is registered only as a proposal tool that inserts a pending approval action and does not queue directly.
- **Approval and template source:** Migrations 0035_whatsapp_send_approvals.sql, 0036_whatsapp_templates.sql, 0037_whatsapp_send_action_outcomes.sql, 0038_whatsapp_feature_permissions.sql, 0039_email_read_tool_permission.sql, and 0040_whatsapp_agent_binding_recheck.sql; organization-scoped approval queue/decision APIs; Meta template submit/status refresh API; approval UI; worker-time 24-hour inbound-window, connected-account, active approval-action, live template-status, and agent/account-binding checks; supported text-body template delivery. Manual, agent-tool, and scheduled/product outbound paths all create approval actions. Media/dynamic-header/button templates fail closed.
- **Regression source:** apps/web/tests/chat-host-tool-loop.test.ts, apps/web/tests/whatsapp-send-approval.test.ts, and updated apps/worker/tests/whatsapp-tool-runtime.test.ts, apps/worker/tests/whatsapp-send-tool.test.ts, apps/web/tests/cross-surface-product-contract.test.ts, and apps/web/tests/rbac.test.ts.
- **Not verified:** Tests, typecheck, lint, web/worker build, migration execution, Next.js worker-runtime import boundary, approval UI in browser, Meta template submission/status API, approval races, actual provider sends, and deployment.
- **Status:** SOURCE_IMPLEMENTED / VERIFICATION_PENDING. No PASS claimed; queue acceptance or approval is not proof of provider delivery.
- **Next:** Run focused tests/typechecks when available, apply migrations through the normal process, then exercise free-form send inside the customer-service window and an approved text-body template outside it against Meta. Keep whatsapp.send proposal-only and verify the worker's provider-confirmed status before claiming delivery.

### 2026-10-17 — Local Docker worker build failure triage

- **Reported by local checkout:** worker TypeScript build failed in whatsapp-tool-runtime.ts (optional template row narrowing, generic Tool variance, and authorization callback parameter typo) and whatsapp-worker.ts (template payload object narrowing). The web build was canceled by Docker Compose after the worker target failed.
- **Source corrections committed to main:** guarded the selected template row, cast concrete tools at the non-generic registry boundary, renamed the authorization callback parameter to the actual input value, and explicitly narrowed the worker template payload to Record<string, unknown>.
- **Verification:** fixes are source-readback verified only. Docker build has not been rerun after these corrections; do not claim the worker/web builds pass. Pull latest main and rerun the worker build first, then rebuild web/compose.

### 2026-10-17 — Follow-up worker build failure triage

- **Reported by local checkout after pulling `d74a083c`:** worker TypeScript build still failed in `product-action-executor.ts` because the WhatsApp approval result used unsupported `message` instead of the shared `ProductActionResult.reason` field; `whatsapp-worker.ts` had a second template-payload narrowing site not covered by the earlier correction.
- **Source corrections committed to main:** `acc0745e399e907eb479d95b4d80f53543ac462e` uses the shared `reason` field; `de44d06ce1496c8f1a5e985cea03b24b149e0d1b` explicitly narrows the second media/template payload to `Record<string, unknown>`.
- **Verification:** source changes committed; worker build has not been rerun here. Pull latest `main` and rerun `pnpm --filter @ai-comms-agent/worker build`. If further errors appear, continue fixing the compiler output; do not infer a passing build from source readback.


### 2026-10-18 — FIX-01 chat membership nullability build failure

- **User-provided evidence:** `docker compose -f infra/docker-compose.yml up -d --build` built the worker image successfully. The web image's Next.js 15.5.27 compilation succeeded, then type validation failed at `apps/web/src/app/api/chat/stream/route.ts:384`: `subject.membership` is possibly null. Separately, native shell `pnpm --filter ...` returned `pnpm: command not found`; this does not explain the Docker build failure because the Docker build uses Corepack/pnpm.
- **Root cause:** `authorize()` rejects missing/inactive memberships at runtime, but the shared `AuthSubject` type permits nullable membership; chat route accessed `subject.membership.role` without narrowing.
- **Correction:** Commit `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9` adds an explicit 403 fail-closed guard after authorization. Commit `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9` adds a regression source assertion requiring the guard before trusted `ToolContext` construction.
- **Verification status:** Source readback confirms the commits; post-fix web build, focused test execution, migrations, browser, and deployed runtime are NOT VERIFIED. Do not mark the build green based on the patch alone.
- **Next action:** Pull latest `main`, rerun `docker compose -f infra/docker-compose.yml up -d --build`, then run the focused web regression test when pnpm is available. Route only the missing native-host pnpm/toolchain to OPS-01.


### 2026-10-18 — FIX-01 WhatsApp template row nullability build failure

- **User-provided evidence:** `bash scripts/update-and-up.sh` fetched latest main (already up to date), built the worker image, and completed Next.js compilation. Web type validation failed at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119` because `synced.rows[0]` may be undefined.
- **Root cause/correction:** The existing array length check did not narrow indexed access. Commits `90fac5e0774b695446e1e0c3ab51072639ba5f06` and `41734923651b1173a703d747f0ac0aa93317a5b9` bind/guard the returned template row and add a regression source assertion.
- **Verification status:** Post-fix build and focused test NOT RUN / NOT VERIFIED. User log establishes only pre-fix failure and worker build success.
- **Next action:** Pull latest main and rerun `bash scripts/update-and-up.sh`; if build passes, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/whatsapp-send-approval.test.ts` in an environment with pnpm. Do not mark green without actual output.


### 2026-10-18 — FIX-01 duplicate voice generation identifier

- **User evidence:** `bash scripts/update-and-up.sh` fast-forwarded main to `5413468f`; worker build succeeded/exported, but web compilation failed in `apps/web/src/app/ai-voice/voice-workspace.tsx` with duplicate `generationId` declaration at the Sarvam/ElevenLabs fallback speech path.
- **Root cause/fix:** The same provider branch declared `generationId` twice in the same block. Commit `f6efffdb42dbd75df38841fab43b985eb565ee3f` reuses the original identifier; `05519965adae7ebab837a03e4d7a0d2306e3f0c1` adds a regression assertion.
- **Verification status:** Post-fix Docker build and focused test NOT RUN / NOT VERIFIED. Do not infer a successful build from the source commit.
- **Next:** Pull latest main and rerun `bash scripts/update-and-up.sh`; then run `pnpm --filter @ai-comms-agent/web exec vitest run tests/voice-realtime-transport.test.ts` if build passes and pnpm is available.



### 2026-10-18 — FIX-01 voice resampling indexed sample correction

- **User evidence:** Docker web build completed Next.js compilation and failed TypeScript validation at `apps/web/src/app/ai-voice/voice-workspace.tsx:331`, where `input[i]` was typed as `number | undefined`.
- **Source fix:** Commit `baa9746142297322c5bf796e7c6fb94060bbc9cf` guards same-rate indexed sample reads with `?? 0` and guards downsampling accumulation reads. Regression source assertion committed at `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- **Status:** SOURCE_CORRECTED / POST-FIX VERIFICATION_PENDING. This user's log is pre-fix; Docker build and focused test have not been observed after the patch.
- **Next:** Pull latest main, rerun `bash scripts/update-and-up.sh`, then run focused `voice-realtime-transport.test.ts` if build succeeds. No PASS claim until output confirms it.

## FIX-01 strict indexed-access and voice-context correction — 2026-10-18
- User-provided pre-fix evidence: web typecheck failed at PCM WAV sample access, provider audio channel sample access, voice energy sample access, nullable voice membership, voice conversation ID typing, and WhatsApp template selection destructuring.
- Source/test commits on main: 1fb045298ed77cd218a36d7babdc911e17b2211d, 9a9e09ee4f6a8c3e2ece81d0b717e9ef22403281, 5946168a22cd316e03c7e859c17d5a53724d48f3, 57618396c400863cf9de31a3dde6de1869447a6b, fee2a2394dfe1e687a470c0caa24a26a9039a20b.
- Current status: SOURCE_CORRECTED / POST-FIX_VERIFICATION_PENDING. The prior user output does not verify these corrections. No typecheck, test, build, or deployment PASS is claimed.
- Next: run current-main pnpm typecheck, focused voice and WhatsApp tests, then Docker build; document only observed outcomes.

## 2026-10-18 — Manual deploy Compose compatibility (OPS-01)

- **User-observed PASS:** Docker worker image built/exported; web Next.js production build completed and web image exported.
- **User-observed BLOCKER:** Manual deployment stopped before migration execution at `docker compose config --environment` with `unknown flag: --environment`.
- **Source correction:** `scripts/manual-up.sh` has a fallback to host `DATABASE_URL` or the `.env` key when this Compose option is unsupported; unresolved interpolation and missing URL fail closed. Source commit `a93176b3cbba730c30a016b4e47a9dd3dd46039c`; regression contract test `0386f03fa9534ff2d53db84b7ffbd2b5fe864154`.
- **NOT RUN / NOT VERIFIED:** The new Node test, migration runner, `docker compose up -d`, container health, and live behavior after this change.
- **Next:** Pull current main, execute `node --test scripts/tests/manual-up-compose-env.test.mjs`, rerun `bash scripts/update-and-up.sh`, and update this state from the observed output. Do not treat image build success as deployment success.


## 2026-10-18 — ISS-037 migration hostname boundary (FIX-01 diagnosis / OPS-01 action)
- **Observed:** User's manual deployment build completed; migration process reported `FATAL code: ENOTFOUND`, `FATAL message: getaddrinfo ENOTFOUND postgres`. Script continued startup. Container inspection showed Postgres, web and worker on `ai-comms-agent_default`, with `postgres` as a network alias; host endpoint `127.0.0.1:5433` was accepting connections.
- **Source diagnosis:** `scripts/manual-up.sh` executes `node packages/db/migrate.js` on the host, while `DATABASE_URL` uses Compose-only `postgres:5432`. `Dockerfile` does not copy `supabase/`, so moving execution into the container requires a read-only migration-directory mount or a reviewed image change.
- **Prior changes ruled out:** `a93176b3` / `0386f03f` address Compose CLI `config --environment` support; `2cf9a522` changes only the published host port. Neither fixes host DNS for `postgres`.
- **Status:** ROOT CAUSE CONFIRMED FROM SOURCE + USER LOG; REMEDIATION NOT APPLIED; TESTS / MIGRATION / HEALTH NOT VERIFIED. OPS-01 owns the fix.
- **Additional unresolved configuration question:** User's URL targeted database `postgres`; local Compose defaults `POSTGRES_DB=aca`. Confirm intended target before running migrations; do not change it by assumption.
- **Next:** OPS-01 updates the deployment script and regression test, runs focused test, then the user/operator records actual migration completion and container health. Keep application traffic on the Docker network.


## 2026-10-18 — OPS-01 migration runner moved onto Compose network
- **Source:** `scripts/manual-up.sh` now invokes the migration runner in a one-off `web` container using Compose network DNS and a read-only mount from `$PROJECT_ROOT/supabase` to `/workspace/supabase`. Host-side DSN resolution and host alias translation were removed.
- **Regression:** `scripts/tests/manual-up-compose-env.test.mjs` now asserts containerized execution, migration mount, no host-side DB URL resolution, and retained startup policy.
- **Evidence:** `bash -n scripts/manual-up.sh` passed; focused Node test passed 4/4 in an isolated harness using source/test fetched from GitHub and a fixture matching the current Compose `.env` declarations. Initial test assertion failed on a line-continuation regex and was corrected; final isolated run passed.
- **Not verified:** Test not run from a complete repository checkout; no Docker image build, real Compose invocation, migration execution, or service health check was performed. No deployment PASS is claimed.
- **Safety dependency:** Confirm whether `DATABASE_URL` should target `/postgres` or `/aca` before applying migrations; do not infer/change the database.
- **Next:** Operator confirms database target, pulls latest main, runs focused test in checkout, then runs deployment and records migration completion separately from container health.
