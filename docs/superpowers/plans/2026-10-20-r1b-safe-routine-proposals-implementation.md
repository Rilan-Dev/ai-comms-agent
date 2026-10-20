# R1b — Safe Routine Proposals and Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Proposed implementation refinement for DEV-01 review, **not activation authorization**. The 2026-10-18 catch-up/routines design and R1–R5 plan remain authoritative; this document narrows R1b into reviewable, verifiable increments and does not replace them.

**Goal:** A person asks the agent to create a routine; the agent produces an understandable, source-scoped preview that cannot execute or send anything until authorized, revision-bound confirmation and later separately verified execution/delivery gates.

**Architecture:** Extend the existing shared routine trigger/time-preview contract with strict normalized input and host-authorized proposal persistence. A single routines facade validates current org/user/agent/mailbox grants and immutable configuration fingerprints, then writes a revisioned routine definition transactionally. Legacy scheduled jobs and automation rules remain untouched. No second scheduler, model-authored side effects, or standing WhatsApp send permission.

**Tech Stack:** Existing TypeScript, Node test runner, PostgreSQL 15+, existing DB transaction and RLS patterns, email-agent-runtime, shared type exports, Next.js authenticated host actions, existing Clara tool integration. No new general-purpose workflow engine.

**Spec:** [Personal catch-up and assistant-managed routines](../specs/2026-10-18-personal-catch-up-and-routines-design.md). Parent plan: [Assistant routines and scheduled digests](2026-10-18-assistant-routines-and-digests.md). Human-facing product direction: [Email Command Center](2026-10-20-ai-email-command-center-ux-rollout.md).

## Global constraints

- Current GitHub main audited at `36384bb0cb37202ff708cf9bfc48359ecc7c6075` (2026-10-20); latest migration filename is `0052_briefing_selection_coverage.sql`. **Never** use the older plan's placeholder `0051` or `0052` numbers. Before creating any SQL, refetch `main` and reserve the actual next forward-only slot; OPS-01 owns running migrations on any real target.
- DEV-01 owns feature contracts and user-facing product work. FIX-01 owns scheduler crash/recovery, tenant isolation and unrelated broad-suite bugs. OPS-01 owns Docker/CI/Vercel/provider credentials, database operations, security incident response and deployment.
- Phase 4 stays `implementation_in_progress`. C3 remains disabled/unregistered; C4 browser acceptance is pending. R1b must remain `routine_management=off` until scoped review/verification.
- An organization's admin membership does not confer mailbox read authority. All routine proposal sources use *effective current* active membership, per-user briefing mailbox grants, agent bindings and `email.read`, not an arbitrary client-supplied `organizationId`.
- No raw email duplication. PostgreSQL is the authoritative source, Clara generation stays behind the C3 canonical-source adapter, and any provider/model text is untrusted.
- Preview/proposal/confirmation/generation/queued/provider-accepted/delivered are distinct statuses. The model cannot mark a proposal confirmed or cause a WhatsApp send. Existing `whatsapp.send` remains per-message approval-only.
- Calendar 09:00 means an IANA-zone wall clock; elapsed 24h is UTC-anchored. User sees next three occurrence timestamps and offsets. One-off date/time must specify an unambiguous offset.
- No new feature flags, grants, DB mutations, public API or external send before this proposal is reviewed and the applicable parent-plan authorization is reconciled. Tests are TDD: assert actual behavior RED, implement GREEN, then run broader affected checks.

## Review focus: user-visible failure modes

1. "Every morning at 9" without a timezone must ask for the missing zone or explicitly preview a previously user-confirmed saved zone; it must not assume the server's zone (Task 1).
2. Same-person double confirmation and two-device races create **one** routine or a safe conflict; never two scheduled sends (Task 3).
3. A user loses mailbox grant, employee membership or agent binding between preview and confirm; confirmation fails with no source names or derived summary leaked (Task 2/3).
4. User edits recipient, mailbox, time, summary window or template after approving; old consent is invalid and no future external send is permitted (Task 3; R4 integration later).
5. If a user is away five days but some mail is still syncing, the app says which mailboxes/period are covered and never claims all mail was checked (separate C3/C4 acceptance task, not R1b itself).

## File and boundary map

| File | Responsibility |
| --- | --- |
| `packages/shared/src/routines/types.ts` | Already has `RoutineTrigger`, `DigestWindow`, `RoutineOccurrencePreview`; extend only with strict input/proposal/lifecycle types |
| `packages/email-agent-runtime/src/routines/time.ts` | Already provides pure `nextRoutineOccurrences`; do not rewrite scheduler semantics |
| `packages/email-agent-runtime/src/routines/proposals.ts` (new) | Pure normalization, safe display view and canonical immutable config hash; no DB or sends |
| `packages/db/src/routines/repository.ts` (new) | Transactional proposal/routine revision, scoped get/confirm/pause, uniqueness and locked confirmation |
| `packages/email-agent-runtime/src/routines/service.ts` (new) | Trusted host principal and actual current C1/C2 grant intersection; no client-provided trust elevation |
| `apps/worker/tests/routine-proposal.test.ts` (new) | Pure proposal cases, explicitly including ambiguity and changes to every material dimension |
| `packages/db/tests/routine-storage.integration.mjs` (new) | Disposable PostgreSQL approval race, revoked grants, RLS, tenant/user mismatch |
| `apps/web/tests/routine-service.test.ts` (new) | Service authorization/conflict and preview claims; actual HTTP routes/UI remain separate R2 |
| `supabase/migrations/<NEXT>_routine_definitions.sql` (deferred) | Next unused migration after fresh `main` audit, separate from already applied `0050`–`0052` |
| `docs/project-control/*`, `worklog.md` | Record verified commit/runtime facts only; preserve prior entries |

## Task 0: R1a executable baseline and evidence

- [ ] Record `git rev-parse HEAD`, `git status --short` and exact package/Node versions from a dependency-equipped sanitized checkout, after fast-forwarding `main`.
- [ ] Run **`cd apps/worker && node --import tsx --test tests/routine-time.test.ts`**. Expected: all seven existing deterministic preview cases pass; otherwise route substantial underlying defects to FIX-01, and keep new routine work off.
- [ ] Run separately from root: **`pnpm --filter @ai-comms-agent/shared typecheck`** and **`pnpm --filter @ai-comms-agent/email-agent-runtime typecheck`**. Expected: both exit 0 with no diagnostics. Record failures verbatim rather than inferring pass from GitHub source assertions.
- [ ] Run the C3 briefing test cases and focused worker/db/Clara TypeScript commands as independently authorized by `NEXT_ACTION.md` when a compatible isolated test host is available. Older `29/29` and `6/6` receipts do not prove current-tip acceptance.
- [ ] Publish the checked SHA and test counts in DEV-01 session; no CI, Vercel, deploy or external WhatsApp actions required.

## Task 1: Pure bounded proposal and human preview (no persistence)

**Files:** extend `packages/shared/src/routines/types.ts` and exports; create `packages/email-agent-runtime/src/routines/proposals.ts`; test `apps/worker/tests/routine-proposal.test.ts`.

**Interfaces (subject to design review):**
- `RoutineDraft`: `name`, selected `mailboxIds`, `trigger`, `task: {kind:"email_digest",language,window}`, `destination`, `limits`, `quietHours`.
- `NormalizedRoutineProposal`: immutable normalized draft, `configHash` (SHA-256 over stable canonical representation), `expiresAt`, `warnings`, `nextOccurrences`; **no** authority, owner, service secret or external-send grant.
- `normalizeRoutineDraft(raw: unknown): RoutineDraft` rejects unknown fields and unsupported task/action types. `previewRoutineDraft(draft, after, zone)` calls the existing `nextRoutineOccurrences` where appropriate; event triggers show condition summary, not invented future dates.

**TDD steps:**
- [ ] RED: test daily 09:00, every 24h, weekly Monday, explicit one-off, missing/invalid timezone, subhourly interval, forbidden arbitrary command, unsupported destination, zero/duplicate mailboxes, oversized name/content, ambiguous task, and template/recipient field mismatch. Expected: behavior fails because proposal validation is not present.
- [ ] GREEN: implement pure normalization and bounded preview without DB/provider imports or side effects.
- [ ] RED: modify each material setting in a fixture and assert `configHash` changes; reordering a set of mailbox IDs and equivalent canonical JSON keys must not change it.
- [ ] GREEN: canonicalize only allowed schema fields and hash deterministically; never hash/send secrets or email bodies.
- [ ] Run focused Node tests, shared and email-runtime typechecks and broader affected tests. Only then commit exact code+test evidence; if unrun, keep task incomplete and do not claim a pass.

## Task 2: Transactional draft lifecycle, feature OFF

**Files:** next-unused migration after fresh audit; `packages/db/src/routines/repository.ts` and exports; `packages/db/tests/routine-storage.integration.mjs`.

- [ ] Design schema with stable immutable proposal snapshot, owner user/agent/org, effective mailbox scope/grant revision, `config_hash`, `revision`, `expires_at`, status, timestamps and same-org foreign keys. No consumer execution/WhatsApp grant is created by proposal.
- [ ] RED: isolated PostgreSQL cases for two users, cross-tenant UUIDs, stale grants, deleted mailbox, expired proposal, repeated creation idempotency key, concurrent editor revisions, administrator without personal mailbox grants, and schema/RLS non-owner reads. Expected: fail closed.
- [ ] GREEN: DB transactional read/write methods taking trusted principal, immutable validated proposal fields and expected revision. All reads recheck current sources; never disclose denied mailbox/recipient data from old snapshots.
- [ ] Verify using **explicit disposable test URL only** (never `DATABASE_URL` fallback). Check conflicts/locks on two simultaneous connections. Leave the feature flag off.
- [ ] Re-run DB, runtime, shared tests/typechecks; commit only with accurately recorded evidence. No production migration apply.

## Task 3: Confirm/pause/cancel with host authority, still disabled

**Files:** `packages/email-agent-runtime/src/routines/service.ts`, DB methods, `apps/web/tests/routine-service.test.ts`; no direct scheduler change.

- [ ] RED: original actor confirms unchanged nonexpired proposal; stale hash/revision, different actor, removed agent binding, missing `email.read`, grant revocation, reused idempotency key and two-device race are rejected or idempotent. User cannot set `active` or select someone else's mailbox via JSON.
- [ ] GREEN: server-owned confirmation transaction compares stored proposal hash and current scope, records immutable revision and confirmed **inactive** definition. Do not write an executable `scheduled_jobs` or `automation_rules` row until FIX-01 runtime recovery proof and full source authorization review are accepted.
- [ ] RED: pause/cancel are revision-checked; canceled/revoked definition cannot be resurrected by an in-flight run or a stale client. An external destination always requires later R4 exact-scope standing-consent verification.
- [ ] GREEN: implement only inactive lifecycle/audit and explicit error categories for the UX. Return a persisted ID/status, never a model-invented success.
- [ ] Run focused service, disposable PostgreSQL races and affected typechecks; add server feature flag guard at every entry and confirm *no scheduler/WhatsApp dispatch* occurred.

## Task 4: Human-first UX and further phases (separate reviewed R2–R5 delivery)

- [ ] R2: one accessible Routines review card and API/tool facade; explicit human-confirm button, names/accounts/window/next three instants/zone/cost/quiet hours/status. Existing `/schedules` and `/automations` remain visible for legacy records. Browser-test small screens, keyboard/focus, slow loading and access revocation.
- [ ] R3: worker consumes *verified activated routine revisions* using only the existing scheduler/event runtime; frozen intended occurrence, source/coverage/grant rechecks and retry-safe generation. No external send.
- [ ] R4: narrowly consented WhatsApp digest with verified recipient, organization policy, approved template, pre-dispatch source/auth check, outbox idempotency and unknown-delivery reconciliation. General sends retain their approvals.
- [ ] R5: trusted org/tenant-scoped event-triggered routines with deduplication/loop prevention, audit, bounded frequency and source access checks.
- [ ] C3/C4 parallel track: finish actual worker test/full-suite acceptance, enable worker only behind disabled-by-default gates, then five-day absence and accessible importance/source-link/partial-coverage browser journeys.
- [ ] Proposed product enhancements for later review: personal VIP rules, multilingual digest, reply-waiting tracker, reversible human priority correction and plain-language action cards. No employee activity leaderboard, auto-reply or organization-wide access inference.

## Stop conditions and exit evidence

Stop and route to FIX-01 for incorrect scheduler recurrence/recovery, authorization bypass or major unrelated regression; OPS-01 for test-host, migration application, Meta template/provider, CI/Vercel or contaminated build environment. Escalate material consent/authorization policy changes for architect review.

Task 1 exit: real RED→GREEN Node test output + package typechecks against exact `main` SHA. Task 2/3 exit: real disposable PostgreSQL tenant/revision/race negatives, no active worker, no new external dispatch, and documented review approval. No current GitHub source-only reading establishes either exit.

**Next step for current connector-only session:** Retain this proposed plan, record recovery/ownership in DEV-01 session and `NEXT_ACTION.md`; run Task 0 and seek review of R1b persistence/activation boundary before any new production feature code.
