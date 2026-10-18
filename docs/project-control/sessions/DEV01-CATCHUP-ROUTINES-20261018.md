# DEV01-CATCHUP-ROUTINES-20261018 — DEV-01 / Forge

**Status:** COMPLETE for recovery, baseline verification and proposed design/planning; implementation and runtime acceptance remain pending review.
**Initial audited baseline:** GitHub main `ba9e948b4b58a4f270d5382f919957843e6eecb5`. **Integrated upstream source:** `959ff5a6c055baf9a1f14af5d29c5f51643b77c0`, 18 October 2026; new source verified separately below.
**Phase:** 4, `implementation_in_progress`; no acceptance or phase transition.

## Request and authorization

Owner explicitly invoked DEV-01, requested recovery without previous-chat explanations, and requested phased plans/checklists for personal email catch-up after absence, AI-managed schedules/automations, WhatsApp summaries and practical UI/UX. Owner selected: approve the routine once for selected mailboxes, verified recipients, timing and summary limits; require approval again if these change.

That answer selects the proposed consent design. It does not authorize sending messages, creating live routines, changing current approval enforcement or applying migrations. This session produces reviewable architecture/implementation proposals under adaptive New Plan; general outbound WhatsApp remains per-message approval. Substantial defects are routed to FIX-01 and infrastructure/CI/deployment to OPS-01. No external messages or provider actions were performed.

## Recovery and current architecture

- Safely fetched and fast-forwarded the clean existing checkout from `03c9b6168f2ac5d03f467b7029e42cc3c74845b1` to current main `ba9e948b4b58a4f270d5382f919957843e6eecb5`. Renamed its local `work` label to `main`; no additional branch/worktree/PR. Owner's direct-main instruction remains in force.
- Recovered AGENTS/navigation/adaptive rules, architecture, phase/NEXT_ACTION, authorization, active session ledger, backlog/handoffs/events, shared memory, canonical `agents/DEV-01/{MEMORY,WORKLOG}.md`, issues/risks and current source. Inspected pinned Clara reference/contracts through the read-only architecture audit; reuse Clara through the host adapter, no vendor edits.
- Existing stack: Next.js Chat-first UI, shared `packages/email-agent-runtime` host tools/policy/audit, Clara model/provider core, PostgreSQL canonical mail, Redis/RabbitMQ transient/async services, worker ingestion/scheduling/automation, WhatsApp approval/outcome transport. Qdrant is an index, never an access authority.
- Existing EMAIL-OPS-01 Workstream F/E8 already plans sourced summaries and scheduled intelligence. These proposals extend it, reuse `summaries`/`summary_sources`, schedules/rules and their run ledgers, and do not add a second raw-mail store or scheduler.
- Latest DEV-01 source checkpoint was `DEV01-MAIL-THREADS-STREAMING-20261018`: real Threads and actual non-tool model-token streaming. At initial recovery, native streaming function-call/tool answers remained pending. During this session, concurrent upstream commits implemented native tool-decision and read-only final-answer streaming; those changes and their records were preserved, with current executable verification below. This session did not implement or claim ownership of them.
- Historical sessions including older draft-search/Lovable work remain marked ACTIVE. They were recovered as coordination records, not proof of live ownership, and were not closed. Read-only helpers `dev01_recovery` and `routine_reuse` reviewed recovery/design; they did not assume FIX-01/OPS-01 roles or mutate product source.

## Deliverables

- [Design](../../superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md): corrected requirements, personas, coverage/privacy, unified Routines UX, time/failure semantics, scoped consent, staged gates and real-world acceptance matrix.
- [Catch-up implementation checklist](../../superpowers/plans/2026-10-18-personal-mail-catch-up.md): C1 storage/access, C2 selection/review, C3 generation, C4a test harness, C4 UX/API, C5 shared tools/pilot.
- [Routines implementation checklist](../../superpowers/plans/2026-10-18-assistant-routines-and-digests.md): R1 contracts/lifecycle, R2 tools/UX, R3 in-app digests, R4 consent/WhatsApp, R5 events, R6 acceptance/OPS handoff.

Product corrections: continuously sync mail regardless of visits; distinguish presence, personal review, routine generation and delivery; use source-linked priority/action/uncertainty; show access/sync/partial failures accurately; distinguish daily local time from elapsed intervals. Deliver useful in-app catch-up before unattended external delivery.

Review corrections incorporated: separate scheduled coverage from personal review; late/missed mail plus fixed windows; explicit template content/schema in consent; quiet-hour eligibility distinct from misfire delay; honest provider-submission/revocation boundary; source revalidation on every derived read; explicit grant-admin/export permissions; structured evidence and zero tolerance for tested fabricated facts; multiple obligations/snooze semantics; concrete isolated UI/browser test-harness task. Proposed limits and pilot targets are not measured performance or accepted policy.

## Evidence executed on the recovered baseline

Toolchain: Node 24.19.0, pinned pnpm 12.8.1 at `/workspace/.onboarding/tools/node_modules/.bin/pnpm`, TypeScript 5.9.3. Prior cloud setup tooling is reusable; no product dependencies/configuration were changed in this session.

| Command (repository root unless specified) | Result |
|---|---|
| `pnpm install --frozen-lockfile --store-dir /workspace/.onboarding/pnpm-store` | PASS, seven projects, lockfile unchanged |
| `pnpm -r typecheck` | PASS, six packages with typecheck scripts |
| `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @ai-comms-agent/web build` | PASS, production build |
| `node --experimental-strip-types --test apps/web/tests/sse-streaming.test.mjs` | PASS, 5/5 |
| `pnpm --filter @ai-comms-agent/web exec vitest run tests/mail-threads-workspace.test.ts tests/streaming-conversations.test.ts tests/workspace-shell.test.ts tests/mail-html-preview.test.ts` | PASS, 25/25 in four files |
| From `apps/worker`: `pnpm exec tsx --test tests/cron.test.ts tests/scheduler-worker.test.ts tests/scheduling-idempotency.test.ts tests/automation-engine.test.ts` | PASS, 11/11 |

Total focused checks: **41 passed**, not a full regression suite. Many existing UI/scheduler tests are source-contract checks; they do not prove browser usability, SQL concurrency, tenant isolation or external delivery. These results supersede earlier environment inability to execute these particular checks on this baseline; they do not erase historical failures or establish current full-suite acceptance.

Local logs: `/workspace/.onboarding/ai-comms-agent/logs/{install-current-main,dev01-typecheck-current,dev01-build-current,dev01-sse-current,dev01-focused-current,dev01-routines-current}.log`. Logs are local evidence, not committed credentials or portable hosted artifacts. New feature tests in the plans are **not implemented or executed**.

Not run: full test/lint suite, worker build, migrations/real PostgreSQL/RLS/crash tests, authenticated current-main browser sessions, real email/model/WhatsApp calls, CI/deployment or production validation. No test service credentials were configured in this checkout; previously pasted credentials were not copied into source or this record. OPS-01 owns secure isolated configuration.

## Concurrent main integration and final verification

A single pre-final integration check found main had advanced to `959ff5a6c055baf9a1f14af5d29c5f51643b77c0`. Preserved those concurrent native tool SSE/final-response source changes and all upstream records by rebasing this session's documentation-only commit. Eight append/prepend documentation conflicts were resolved by retaining both agents' entries. No product source was edited or reverted. The old statement that native final streaming remains unimplemented is superseded by this checkpoint; its browser/provider acceptance and newly found validation defect remain pending.

Verification ran on integrated source `959ff5a6` plus documentation commit `2a1c6b13` (later documentation amendments do not change the source tree):

| Check | Result |
|---|---|
| `pnpm -r typecheck` | PASS, all six script-bearing packages |
| `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @ai-comms-agent/web build` | PASS |
| `pnpm --filter @ai-comms-agent/clara-core test` | **FAIL: 24 passed, 1 failed** |
| Prior four web Vitest files plus `tests/verified-tool-streaming-contract.test.ts` | PASS, 31/31 |
| Prior four worker files plus `tests/clara-tool-calling.test.ts tests/email-agent-loop.test.ts` | PASS, 23/23 |
| `node --experimental-strip-types --test apps/web/tests/sse-streaming.test.mjs apps/web/tests/verified-tool-answer.test.mjs` | PASS, 13/13 |

Combined final focused run: **91 passed, 1 failed**; not a full suite. Logs use `dev01-{typecheck,build,clara,web,worker,node}-integrated.log` in the same local log directory. Earlier 41/41 results remain evidence only for initial ba9e948b. Authenticated DB/browser/provider/deployment checks remain unexecuted.

Failure: `packages/clara-core/tests/tool-result-final.test.mjs:29`, assertion at line 32, expects `/Duplicate/` but gets the incomplete-batch error. Read-only triage reproduced 5/6 in that file. The exact fixture fails closed, but the helper deletes completed IDs from its only set, allowing a fully completed reused-ID pair; it also accepts a result name different from the declared tool name. Direct helper calls reproduced both acceptances without provider access. This is a unit-level final-prompt validation defect, not a demonstrated live authorization bypass. Route `HOF-DEV01-FIX01-TOOL-FINAL-REGRESSION-20261018`; do not weaken the assertion merely to turn the suite green.

Both plan reviewers reported no remaining blocking design contradictions after corrections. Documentation checks passed: relative links/code fences, documentation-only diff, added-content secret-pattern scan and `git diff --check`. The 81 implementation checklist items remain unchecked because they are future work. Only local commits were created; no push, PR, deployment or external message was performed.

## Findings, blockers and routing

Source findings are confirmed code paths, not reproduced live incidents:

1. **Scheduler correctness/recovery:** schedule API omits `nextFireAt`; DB create/update defaults recurring jobs to null and due query excludes null. Catch-up window is stored but unused; claims have no recoverable lease; caught SQL errors inside a transaction lack savepoint/conflict-safe handling; completion can overwrite a concurrent pause/edit. Evidence: `packages/db/src/automation/repository.ts`, `apps/web/src/app/api/organizations/[orgId]/schedules/route.ts`, `apps/worker/src/scheduling/{cron,scheduler-worker}.ts`. Route `HOF-DEV01-FIX01-SCHEDULER-RELIABILITY-20261018`.
2. **Automation tenant/trigger contract:** global active-rule lookup and matcher lack a mandatory trusted event-organization comparison; `trigger.event` written by UI and `trigger.type` matched by worker disagree. Evidence: `apps/worker/src/automation/automation-engine.ts`, DB automation repository and automations UI/API. Route `HOF-DEV01-FIX01-AUTOMATION-TENANCY-20261018`; block new event activation until regression proof.
3. **OPS prerequisite:** isolated database and queue namespaces, verified migration target, test identities/recipients, Meta-approved templates, provider callbacks and securely bound credentials. Route `HOF-DEV01-OPS01-DIGEST-VALIDATION-20261018`. Existing ISS-037 database/network/target issue remains; no CI/deploy work taken over.
4. Existing FIX-01 ISS-026 account isolation, GitHub #36 HTML sanitizer and #26 voice lifecycle remain open under their owners. New summary/source access must not bypass ISS-026 or enable vectors early.

These handoffs are recorded in the repository registers, not sent as external messages and not newly filed GitHub issues. Each receiving role recovers authority independently.

## Exact next action

Review the proposed design and both plans, particularly personal mailbox grants, routine coverage, consent/template scope and submission semantics. After owner/architect approval of the proposed design and implementation scope, start **Catch-up C1**: failing cross-user/org/agent/account access tests, private summary/grant schema and trusted scope resolver, off by default. Recheck main and migration numbers first. Pure time/contract and C4a test-harness work can proceed independently within the approved implementation scope; affected activation waits for FIX-01/OPS-01 evidence. Preserve concurrent native tool-streaming source; its FIX-01 regression and runtime acceptance remain pending; do not poll CI/Vercel while authorized independent product work exists.

Only documentation changes belong to this session. Repository status/commit details are reported by the session's final handoff; do not invent a future commit SHA inside its own content.
