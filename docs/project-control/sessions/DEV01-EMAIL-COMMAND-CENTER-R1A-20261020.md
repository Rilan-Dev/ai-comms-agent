# DEV-01 / Forge — Human-first Email Command Center / R1a — 2026-10-20

## Invocation and recovery

Owner invoked DEV-01 on `Rilan-Dev/ai-comms-agent` `main`, explicitly asked to recover full architecture/project-control/role-local state, improve five-day email catch-up and assistant-operated schedules/automations/WhatsApp digests, use the Superpowers plan style, and continue independently of FIX-01/OPS-01/CI/Vercel waits.

Read `AGENTS.md`, `CHAT_CONTINUITY.md`, `CURRENT_PHASE.md`, latest `NEXT_ACTION.md`, project status/verification/handoff/lessons, DEV-01 memory/worklog, existing catch-up/routine Superpowers specs and plans, prior C3 source/host test session, and relevant shared/runtime/worker scheduling source. The repo explicitly contains a Superpowers-style plan but the ChatGPT plugin skill catalog does not expose `superpowers:executing-plans` or `superpowers:subagent-driven-development`; followed the repository's task decomposition and test-first authoring instead, without claiming that skill was invoked.

## Current state and ownership

- Active Phase 4 `implementation_in_progress`. C1/C2 private mailbox grants, source selection, revisioned review/snooze and bounded work are already source-implemented.
- C3 immutable canonical source loader/Clara generation exists but its worker is disabled/unregistered; C4 authenticated browser acceptance awaits the verified worker.
- Operator host recorded 29/29 focused C3 Node tests and four package typechecks at `daa89ffd`. A separate operator C3 tmpfs PostgreSQL fixture receipt reported 6/6 integration results at the earlier host checkout `2789527a`; this session **did not execute or independently verify** those host runs on the current tip.
- Existing FIX-01 tenant/trigger corrections are source-committed but A/B runtime proof is pending. FIX-01 owns substantial bugs, remaining worker/web failure inventory and scheduler/security correctness. OPS-01 owns CI, migration execution, deployment, provider/WhatsApp runtime and build-hook credential exposure response.
- The reviewed routine plan already authorizes *pure R1 time and contract work* independently of the blocked scheduler/persistence activation. It does not authorize unsupervised WhatsApp sends.

## Development completed in this slice

1. Added seven R1 time-preview regression cases first: Kolkata daily 09:00, New York daily versus elapsed 24h through DST, missing 02:30 spring-forward skip, repeated 01:30 fall-back first-only, Monday weekly/year boundary, offset-required one-off, and negative inputs. Commit `2b2342f34f3e9e3e98955c6b5523bc538a227bf0`.
2. Added shared typed `RoutineTrigger`, `RoutineScheduleTrigger`, `DigestWindow` and `RoutineOccurrencePreview` contract (ISO Monday=1 convention). Commit `7b4a0d9696bea3c6169ec8fa271f1eca72b7e856`.
3. Added pure `nextRoutineOccurrences` under `packages/email-agent-runtime/src/routines/time.ts`; explicit-offset instant validation; canonical IANA zone; bounded occurrence search; DST fall-back first occurrence, spring gap skip, real UTC interval anchor, preview metadata/offset; rejects event-as-calendar and subhourly intervals. Commit `9eb4edc05c529a024ad4544eb19b5509bc1dcf81`.
4. Exported the shared types and runtime preview without registering any job, worker, feature or external action. Commits `68f7a6af6f17d1c34087a661cda79cb7f9d84ad7`, `7dd595849eaf4fcd20e76411973c38e1c773d9dc`, `7daccec712ef950f2e9487d7cb0f6e4125b0e58e`.
5. Added the product/UX Superpowers supplement `docs/superpowers/plans/2026-10-20-ai-email-command-center-ux-rollout.md`: ordinary-person, employee, SME and multinational journeys; truthful catch-up coverage, source-grounded importance, confirmation UX, scheduled/interval/event distinctions, concise consented WhatsApp delivery, phased milestones, optional proposed enhancements. Commit `e3a3a12b11c71ee821f1f26f327e0ef443328be1`.

## Verification and limits

- **Actually executed:** current GitHub blob inspection checked 10/10 source invariants (seven test declarations, offset validation, DST behavior source, forward-only scheduling, >=60-minute guard, event separation, exports and plan presence).
- **NOT RUN:** newly authored `node --import tsx --test tests/routine-time.test.ts`, TypeScript typechecks, UI/browser, actual DST runtime test suite, C3 new-tip suites/DB, provider/WhatsApp delivery, CI/Vercel/deployment/migrations.
- No branch/PR, routine persistence, schedule registration, background poller, external message, privileged mailbox access, production database or phase acceptance in this slice.

## Lessons

- A platform visit heartbeat is not the same as *last confirmed mail review*; mail sync is independent of visits.
- A calendar-local 09:00 preview differs from a UTC-anchored 24-hour interval during DST; nonexistent local instants must not silently shift and repeated wall times must not double-fire.
- Preview is not execution authority. Scoped WhatsApp briefing is an external export and requires standing exact-scope grant, template/provider checks and explicit user confirmation.
- Do not renumber/create database migration DDL based on historical Superpowers placeholder numbers; inspect current forward-only migration tip.
- Historical passing test counts refer to their actual host SHA and do not verify new commits.

## Blockers and role routing

- DEV-01 C3: after existing 6/6 DB fixture receipt, current-tip broader tests, failure/grounding security assertions and disabled-by-default worker registration remain pending; C4 authenticated UX after worker acceptance.
- FIX-01: unrelated broad worker/web failures, scheduler reliability, inbound/runtime defects and authorization-negative A/B checks. Source-level repairs do not prove cross-tenant production safety.
- OPS-01: authorized test host/DB isolation, actual migrations, CI and Vercel, WhatsApp template/provider verification, build-hook incident recovery/credential rotation assessment.
- R1b persistence, routine management tool/permissions and external delivery are **not** enabled; subsequent authorization, grant/lease/concurrency, DB and privacy gates remain.

## Exact next DEV-01 action

1. In a dependency-equipped checkout fast-forwarded to current `main`, execute `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`; return to repo root and execute `pnpm --filter @ai-comms-agent/shared typecheck` and `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck`. Fix this slice's own compile/behavior failures and record command output with checked SHA; do not infer PASS from source assertions.
2. Independently finish C3 authorized grounding/retry/source-access regression coverage and the current-tip focused/broader suite. Preserve feature OFF until a verified disabled-by-default worker registration contract is safe. Then execute C4 authenticated 5-day journey. Do not wait or poll CI/Vercel.
3. Prepare R1b typed proposal/confirmation/service and migration-number audit only under the existing reviewed design and fresh authorization; do not create a new scheduler or prematurely enable delivery. Follow the Superpowers supplement for post-MVP refinements subject to review.
