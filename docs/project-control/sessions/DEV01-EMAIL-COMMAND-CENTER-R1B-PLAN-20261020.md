# DEV-01 / Forge — Email Command Center R1b Continuation — 2026-10-20

## Owner request and classification

Owner instructed DEV-01 to resume the current `main` repo without prior chat, recover project control and DEV-01 local memory, and improve ordinary-person, employee, SME and multinational email handling. Specifically: catch up after five days away, high/medium/low importance, assistant-managed daily/hourly/weekly/one-off schedules/automations, and optional approved WhatsApp summaries without requiring repeated app visits. Owner asked for Superpowers phased planning and continued independent feature work. This is an **architectural refinement of existing C1–C4 and R1–R5 design**, not permission for unbounded autonomous actions.

## Repository recovery

- Remote `main` read at `36384bb0cb37202ff708cf9bfc48359ecc7c6075` before this planning commit. Explicit direct-main policy; no branch or PR.
- Read current `AGENTS.md`, `CHAT_CONTINUITY.md`, `NEXT_ACTION.md`, `PROJECT_STATE.md`, `CURRENT_PHASE.md`, `ZAI_HANDOFF.md`, `VERIFICATION_STATE.md`, decisions/issues/risks, navigation, shared agent memory/events/sessions/handoffs/backlog, DEV-01 memory/worklog, and the 2026-10-18 catch-up/routines Superpowers spec/two task plans plus 2026-10-20 UX supplement/R1a session. Historical `ZAI_HANDOFF.md` says no Z.AI handoff; owner explicitly invoked DEV-01 on already-running approved Phase 4 independent source work, as the active APCP/NEXT_ACTION records explain.
- Inspected current `packages/shared/src/routines/types.ts`, `packages/email-agent-runtime/src/routines/time.ts`, current schedule/automation repository and worker, plus briefing generation. Routine time preview and shared types already exist; `createRoutineProposal` does not yet exist. Current migrations end at `0052_briefing_selection_coverage.sql` (verified by GitHub directory listing), so historical R1 plan DDL example numbers `0051`/`0052` are occupied.
- Phase 4 `implementation_in_progress`; C1/C2 already implemented. C3 canonical-source worker remains disabled/unregistered. C4 authenticated user-journey acceptance pending. R1a pure preview source/tests committed, but no new-tip Node/TypeScript test execution. Operator's earlier C3 29/29 focused and 6/6 isolated PostgreSQL receipts are tied to older source and do not establish current-tip acceptance.

## Product recommendations and safe boundaries

1. **Catch-up is a review ledger, not inactivity surveillance.** Continue provider sync while absent. Track coarse authenticated last visit solely to explain the context; a visit, a delivered digest and actual item review are distinct. Avoid employee attendance leaderboards, admin-wide mailbox read rights or a second raw mail copy.
2. **Rank actions with evidence:** High / Medium / Low and friendly grouped labels; each item needs a supported source, reason, uncertainty when applicable, deadline only if evidenced and direct original-mail access. The AI must not invent missing emails or claim complete scope while mail sync is partial.
3. **One Routines entry, distinct trigger semantics:** wall-clock local 09:00, UTC elapsed 24h, weekly calendar, exact one-off, event condition. Existing scheduler and automation rules are reuse targets, not permissions to create new ones silently.
4. **Proposal is not authority:** normalize, show user a human-readable preview, persist immutable revision/config hash, confirm through verified host/user action after fresh C1 grants and current membership checks. Do not execute while feature is OFF.
5. **WhatsApp is external export:** exact verified personal recipient/sender/template, content/size/window/quiet-hour bounds, consent expiry/revocation, send-time authorization checks, precise provider statuses and idempotent recovery. R4 needs separate review and OPS provider proof.
6. **Further enhancements remain proposals:** multilingual digest, priority correction, waiting-for replies, VIP sorting, action cards, mobile accessible workflow, and explainable sync-coverage indicators. No auto-payments, hidden forwarding, unknown-recipient sends or broad employee-monitoring.

## Work authored in this session

- Applied installed `superpowers:using-superpowers`, `brainstorming`, `writing-plans`, `test-driven-development` and `verification-before-completion` as process constraints. Existing design and owner requirements provide intent; R1b contract/persistence refinement is presented as **proposed**, subject to normal review before new production code. No creative change was silently taken as approval.
- Committed [focused phased R1b plan](../../superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md) at `7a6bc740de05fb1f0b4939068d9ee047330945e0`. Includes TDD RED/GREEN checks, exact code/test files and signatures, immutable proposal hash, scope/revision validation, isolation tests, disabled-by-default delivery and conflict/race tests, and future C3/C4/R2–R5 coordination.
- Did not add a competing scheduler, duplicate raw email store, migration SQL, provider key, customer data, automation activation, WhatsApp sends, model tool authority or UI feature in this session.
- Environment finding: attached GitHub connector allows authoritative source reads/writes, but no local repo checkout. Local `git ls-remote` over GitHub failed to resolve `github.com`, and `pnpm` was unavailable; therefore the recorded Task 0 Node/pnpm test commands **could not run** here. No CI/Vercel jobs were watched.

## Verification, blockers and role routing

- Verified: GitHub `main` read, source signatures, existing R1a contracts, previous plan, latest migration filename set, and GitHub acceptance of new plan commit.
- **NOT RUN:** `node --import tsx --test tests/routine-time.test.ts`, shared/email-agent-runtime typechecks, broader worker/web/db/Clara suites, R1b service/storage tests, C3 current-tip integration, browser UX, WhatsApp/provider/live DB/deployment. No features accepted as complete.
- **DEV-01:** Own pure typed proposal/preview service work after design review, compatible APIs/UX, C3 grounding/retry acceptance then C4.
- **FIX-01:** Existing scheduler claim/recovery and tenant isolation bugs, other broad worker/web failures, tool/runtime security fixes. Recent automation source fixes do not themselves establish tenant A/B runtime proof.
- **OPS-01:** Provide equipped sanitized host/isolated DB; migrations/CI/Vercel/production, WhatsApp provider/template/recipient proof and build-hook incident environment/credential assessment. Credential exposure has not been ruled out.
- Cross-agent lessons: A test receipt proves only its recorded SHA; a saved routine is not a running routine; profile/office inactivity must never grant mailbox access; current migration tip must be checked immediately before DDL; dashboard/status copy must reflect the durable event, not a model claim.

## Exact next authorized action

1. Run R1a `cd apps/worker && node --import tsx --test tests/routine-time.test.ts` and root `pnpm --filter @ai-comms-agent/shared typecheck`, `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck` on the latest sanitized dependency-equipped checkout; record actual checked SHA, output and failures. Do not pretend GitHub source inspection replaces this.
2. Independently review the new R1b proposal against the 2026-10-18 spec/parent routine plan and approve/amend proposed persistence/confirmation interfaces before feature code. Once approved, implement test-first Task 1 pure normalizer and preview, then Task 2 safe persistence after fresh migration-number audit, while feature remains off. No R1b background executor or standing WhatsApp send approval from this plan.
3. Continue C3 source/failure/lease and full-suite acceptance independent of FIX-01/OPS-01 review delays. Register the poller only behind the separately authorized disabled-by-default path after its real contract tests. Then C4 authenticated five-day source/importance/mobile journey.
