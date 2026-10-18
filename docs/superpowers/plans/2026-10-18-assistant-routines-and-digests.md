# Assistant Routines and Scheduled Digests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person create, understand, pause and change recurring email briefings through Chat or a simple Routines screen, with optional narrowly authorized WhatsApp delivery.
**Architecture:** A typed host service and common routine identity wrap existing scheduled jobs, automation rules and run ledgers. Fixed occurrences call the personal briefing service. A separate scoped grant authorizes only validated digest delivery through the existing WhatsApp transport.
**Tech Stack:** Existing TypeScript, PostgreSQL, Next.js, worker, shared email runtime, Clara adapter, Vitest/Node tests. No second scheduler or new general workflow engine.
**Spec:** [Personal catch-up and routines design](../specs/2026-10-18-personal-catch-up-and-routines-design.md).
**Prerequisite contracts:** [Catch-up plan C1–C3](2026-10-18-personal-mail-catch-up.md). Definitions below consume its trusted principal, effective scope and immutable briefing manifest.
**Status:** Proposed; planning authorized, implementation follows design/plan review. Tasks R1–R6 deliver spec phases R1–R4; task IDs are implementation units, not phase acceptance. DEV-01 owns feature work. FIX-01 and OPS-01 own their named dependencies.

## Global Constraints

- Reuse `scheduled_jobs`, `scheduled_job_runs`, `automation_rules` and `automation_runs`; a facade is not another execution engine.
- A schedule and an event automation are distinct triggers within one Routines experience.
- Daily 09:00 uses an explicit IANA zone; every 24 hours uses an elapsed interval anchored in UTC. Minimum time cadence: 60 minutes.
- DST gap: skip and record. Repeated local hour: first instant only. Show next three occurrences with offsets before confirmation.
- Immutable occurrence ID, routine revision, reporting window and source manifest survive retries. Never derive the window from retry time.
- Misfire grace defaults to 60 minutes, maximum 10,080; coalesce within grace and record missed occurrences outside it. Preserve uncovered mail without a burst of old notifications.
- Reuse FIX-01's corrected leases: 120 seconds, heartbeat 30 seconds; three total attempts with delays of 30 and 120 seconds within remaining grace. No retries for revoked authority.
- Once-approved digest grant binds exact mailbox/recipient/timing/content scope. Changed scope invalidates consent. Proposed lifetime 90 days; show expiry and require explicit renewal.
- General `whatsapp.send` stays proposal-only. Template approval, phone verification and application authorization are different requirements.
- At most 1,000 Unicode code points of external digest content, further constrained by organization policy and actual rendered provider/template limits. No full email bodies, attachments, credentials or OTP.
- All runtime authorization is server-derived; never persist a browser session token. Untrusted mail/model text cannot choose identity, recipient, permissions or arbitrary executable actions.
- Work in the existing checkout, direct main per owner instruction; do not create another worktree/branch/PR. Reserve migration numbers only after checking current main.

## Review Focus

1. Schedule created through UI or tools has a real first fire, and pause/edit cannot be undone by a stale worker (R1/R2).
2. Crash after claim or provider submission cannot strand a routine or cause a blind duplicate send (R3/R4).
3. An ordinary pending WhatsApp action cannot acquire standing authority by adding a routine ID (R4).
4. Grant revocation, source deletion, organization membership and account binding are rechecked immediately before dispatch (R3/R4).
5. Event organization comes from trusted ingestion and scopes both rule lookup and execution, including deduplication (R5).

## File and interface map

Create `packages/shared/src/routines/types.ts`, `packages/db/src/routines/repository.ts`, and `packages/email-agent-runtime/src/routines/{time,service,tools,digest,grants}.ts`; export through each package's existing public index. Keep shared calendar calculations out of the web-to-worker dependency direction. Adapt existing worker scheduler and event entry points only through their reviewed contracts; do not copy either loop.

Define and validate these types at the boundary; unknown fields fail closed:

```ts
type RoutineTrigger =
  | { kind: 'interval'; everyMinutes: number; anchorAt: string }
  | { kind: 'calendar'; cadence: 'daily' | 'weekly'; localTime: string;
      weekday: number | null; timeZone: string }
  | { kind: 'once'; fireAt: string; timeZone: string }
  | { kind: 'event'; eventType: string; conditions: Record<string, string>; debounceMinutes: 15 };
type DigestWindow = 'since_previous_occurrence' | 'previous_24_hours' | 'previous_local_day';
type RoutineDraft = {
  name: string; mailboxIds: string[]; trigger: RoutineTrigger;
  task: { kind: 'email_digest'; language: string; window: DigestWindow };
  destination: { kind: 'in_app' } | { kind: 'whatsapp_digest'; accountId: string; recipientId: string;
    deliveryPolicy: 'text_in_window_template_outside' | 'template_only';
    template: { providerId: string; name: string; language: string; contentHash: string;
      parameterSchemaHash: string } | null };
  limits: { maxCodePoints: number; emptyBehavior: 'skip' | 'check_in'; catchUpMinutes: number };
  quietHours: { start: string; end: string; timeZone: string } | null;
};
type RoutineProposal = {
  id: string; normalized: RoutineDraft; configHash: string; expectedRevision: number | null;
  nextOccurrences: string[]; warnings: string[]; expiresAt: string;
};
type RoutineOccurrence = {
  id: string; routineId: string; revision: number; intendedAt: string;
  period: { start: string; end: string }; briefingId: string | null;
};
```

`RoutineDefinition` adds server-derived organization/owner/agent, ID, revision, status (`draft|active|paused|cancelled|needs_attention`), policy version and the linked schedule/rule ID to the normalized draft. `RoutineRunView` returns generation and delivery status separately, intended/eligible/started/finished instants, attempt, source coverage, safe failure reason and next action. `DigestGrant` stores the complete canonical scope/hash, granting principal, verification/policy references, validity interval and revocation; mutable name/display metadata cannot be used as authority. Resolve template content/schema hashes from trusted provider metadata. Content/language/schema changes under the same template name invalidate the old grant. A null template explicitly means block outside the service window; the review card must explain that unattended delivery is then not guaranteed.

Primary service signatures:

```ts
proposeRoutine(principal, draft, existingId?): Promise<RoutineProposal>
confirmRoutine(principal, proposalId, configHash, expectedRevision): Promise<RoutineDefinition>
listRoutines(principal, cursor): Promise<{ items: RoutineDefinition[]; nextCursor: string | null }>
getRoutine(principal, id): Promise<RoutineDefinition>
listRoutineRuns(principal, id, cursor): Promise<{ items: RoutineRunView[]; nextCursor: string | null }>
setRoutineState(principal, id, expectedRevision, state): Promise<RoutineDefinition>
prepareRoutineDigest(occurrence, deps): Promise<BriefingManifest>
authorizeDigestDispatch(actionId, now): Promise<AuthorizedDigestDispatch>
```

Use `TrustedBriefingPrincipal` for interactive calls. Background calls resolve a fresh effective principal from persisted owner + agent + organization and current grants. No caller may supply an `AuthorizedDigestDispatch`; construct it inside the dispatcher from stored grant, occurrence and validated output. `confirmRoutine` consumes a short-lived server-side proposal exactly once and never treats model prose as confirmation.

## R1 — Typed routine persistence and preview service

**Files:** Create `supabase/migrations/0051_routine_definitions.sql`, shared routine types, DB routine repository, runtime `time.ts` and `service.ts`. Modify package exports, `packages/shared/src/identity/types.ts`, current role-permission mapping and server-side feature configuration. Tests: `apps/worker/tests/routine-time.test.ts`, `apps/web/tests/routine-service.test.ts`, `packages/db/tests/routine-storage.integration.mjs`.

**Dependencies:** Catch-up C1 interfaces. Coordinate migration order with C1/other active work. FIX-01 scheduler reliability handoff must be resolved before any new schedule can become active; preview and draft storage can be developed independently.

- [ ] Write failing pure time tests with fixed clocks: Kolkata daily 09:00, hourly/24-hour anchors, week/year boundaries, invalid dates/zones, offset-less one-offs and DST. Example: New York daily 09:00 spans `2026-03-07T14:00Z` to `2026-03-08T13:00Z`; a 24-hour interval anchored at the former fires at `2026-03-08T14:00Z`. On 1 November, 01:30 selects `05:30Z`, never a second `06:30Z` occurrence. On 8 March, 02:30 is skipped with a reason. Verify a proposed first fire is strictly in the future.
- [ ] Run `pnpm --filter @ai-comms-agent/worker exec tsx --test tests/routine-time.test.ts`; confirm failure is the missing behavior before implementation.
- [ ] Implement normalized typed triggers and bounded next-three preview. Prefer daily/weekly expansion over exposing arbitrary cron in MVP; preserve old cron records without silently changing their day-of-week semantics. Intervals need explicit persisted anchor metadata and scheduler integration, not a misleading calendar-cron approximation.
- [ ] Add `routine_definitions` with same-org foreign keys, creator ownership, revision and exactly one linked trigger backend. Add explicit interval metadata to the existing scheduled-job model as needed. Draft creation and activation/progression must be transactional. Legacy schedules/rules receive no standing grant or automatic activation.
- [ ] Add `routine.read/write/digest_delivery` policy alongside current permissions: own-scope members, source-scoped read-only viewers, and owner/admin-only `routine.delivery_policy.manage` for organization external-export policy. Policy writes validate same-org target user/sender/recipient/content constraints and audit old/new values; they do not substitute for the user's consent or grant personal mailbox content. Configure `routine_management` off by default, checked on the server at API/tool/worker boundaries.
- [ ] Implement proposal validation and expiring normalized proposals; hash all material settings. Validate effective briefing scope, name/content bounds, recipient reference, quotas and sender ownership. Confirmation rechecks current authority, expected revision and unchanged hash atomically; duplicate confirmation returns the same result or safe conflict, never a second routine.
- [ ] Implement optimistic pause/resume/cancel; cancel archives history rather than deleting evidence. Pause invalidates active execution authority. Resuming external delivery requires renewed confirmation if its grant was revoked. In-flight completion cannot overwrite a new state/revision.
- [ ] Execute service and isolated PostgreSQL integration tests: duplicate confirmation, simultaneous edits, incorrect user/org/agent, linked row from another tenant, paused running job, initial recurring fire and immutable ownership. Integration helper requires a disposable `ROUTINE_TEST_DATABASE_URL` and refuses a non-test target. Run non-superuser RLS checks as well as service queries.
- [ ] Re-run focused tests and `pnpm -r typecheck`; commit `feat(routines): add typed routine proposals and lifecycle` only after evidence is recorded. Keep activation disabled if FIX-01 gate is unresolved.

## R2 — One accessible management UI and shared conversational tools

**Files:** Create `apps/web/src/app/routines/{page,routines-client}.tsx`, components `routine-review-card.tsx` and `routine-run-history.tsx`; create `apps/web/src/app/api/organizations/[orgId]/routines/route.ts` plus `[routineId]/route.ts`, `proposals/route.ts`, `confirm/route.ts`, `[routineId]/history/route.ts`. Create runtime `routines/tools.ts`; modify shared runtime registry composition, `apps/web/src/components/sidebar.tsx`, existing schedules/automations pages for compatible entry points. Tests: `apps/web/tests/routine-routes.test.ts`, `apps/web/tests/routines-ui.test.tsx`, `apps/worker/tests/routine-tools.test.ts`, `apps/web/tests/e2e/routines.spec.ts`. Reuse the Catch-up C4a test harness; do not create a second browser/auth fixture stack.

- [ ] Write failing API/tool tests for “daily at 9 AM”, “every 24 hours”, “weekly Monday”, one-off date, missing timezone, ambiguous “change my summary” with two matches, unauthorized mailbox, and stale proposal confirmation. Assert tool results contain persisted IDs/status/next times; a sentence from the model cannot set `active`.
- [ ] Run focused web Vitest and worker Node tests, then implement GET list/detail/history, POST proposal/confirm, and PATCH lifecycle operations through R1 services. No client-supplied owner, grant or run status. Mutation requests use the existing authenticated/CSRF boundary and revision checks.
- [ ] Register `routine.propose`, `routine.list`, `routine.get`, `routine.history`, `routine.pause`, `routine.resume`, `routine.cancel`, `routine.preview`. Editing goes through `routine.propose` with an existing ID. Confirmation is a verified user action on the review card or an explicit host-confirmed conversation response tied to the exact proposal; a model tool call alone cannot confirm. A preview never queues external delivery. Reuse the registry for Chat/Voice hosts; do not create a voice-only scheduler.
- [ ] Build plain-language cadence, zone, mailbox and destination controls. Review card shows selected accounts, sender versus recipient, first/next runs, window, grace/quiet hours, content limits, template requirement, expiry and what changes require reconfirmation. Do not render raw JSON as the primary form. The saved zone is explicit even if the browser reports another zone.
- [ ] Show created/draft/active/paused/needs-attention distinctly; history separates generated, pending approval, queued, provider accepted, delivered, failed and unknown. Preserve existing `/schedules` and `/automations` links and expose old records as legacy/needs-review where they lack the new contract. No silent conversion of old arbitrary actions into approved digests.
- [ ] Browser-test at 320/390/768/1440px and 200% zoom, keyboard-only create/edit/pause, labelled validation, focus return after review, screen-reader status announcements, empty/loading/offline/permission/error states and a slow model. Test real route/service integration with synthetic fixtures; source-string assertions alone do not establish UX.
- [ ] Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/routine-routes.test.ts tests/routines-ui.test.tsx`, worker tool tests, `pnpm --filter @ai-comms-agent/web exec playwright test tests/e2e/routines.spec.ts`, typecheck and web build. Commit `feat(routines): add reviewable UI and assistant controls` with screenshots/evidence excluding real mail.

## R3 — Durable fixed-window in-app digests

**Files:** Create runtime `routines/digest.ts`; extend DB routine repository and shared run types; adapt `apps/worker/src/scheduling/scheduler-worker.ts` and `apps/worker/src/agent/execution-dispatcher.ts` to route only typed `email_digest` through the shared service. Tests: `apps/worker/tests/routine-digest.test.ts`, `packages/db/tests/routine-recovery.integration.mjs`.

**Dependencies:** Catch-up C1–C3 generation contracts; FIX-01 scheduler reliability fixes and runtime concurrency tests. Do not redo those bugs under DEV-01 or activate on the current uncorrected claim path.

- [ ] Write failing tests with injected clock/Clara/transport: 100-mail five-day window, late-arriving source, empty scope, initial history import, provider failure mid-batch, three-attempt exhaustion, schedule changed while generation runs. Assert `prepareBriefing` receives the persisted principal, period and occurrence request key, not intent text plus arbitrary JSON.
- [ ] Specify first window during confirmation (default preceding intended interval); persist it. For `since_previous_occurrence`, advance nominal boundaries by intended time and also select previously eligible but uncovered revisions. A late-arrival/catch-up section states when sources predate the nominal window. Never use a strict timestamp high-water mark as proof all earlier mail was covered.
- [ ] Call Catch-up C2 selection and C3 generation with server-derived scheduled routine/occurrence/coverage context. Persist routine generation coverage per routine + effective mailbox-scope key and delivery coverage per immutable output + destination. Personal review never filters scheduled selection. Completed persisted output advances generation coverage; failed/partial output does not. Previously generated but undelivered output stays in its delivery recovery ledger, not a fresh automatic catch-up send. Provider-accepted/unknown submissions must not be duplicated. Explicit overlapping fixed windows may repeat sources; disclose that choice. Revision-only edits preserve same-scope coverage; mailbox-scope changes start at a newly confirmed boundary.
- [ ] Regeneration invalidates the old output version; retries reuse the frozen valid manifest. Any source/access revocation invalidates the affected derived item and mixed output before display or delivery, using Catch-up `getBriefing` read checks and fresh send-time checks. Generation failure cannot report “no mail”. Personal review markers are never updated here. Test two routines, reviewed personal items, missed fires, empty/partial runs and held unknown delivery independently.
- [ ] Reuse the corrected occurrence claim/lease protocol. Add transactional completion/outbox insertion with unique occurrence+revision+destination; bind all transitions to current revision/status. Handle lease expiry and retryable errors without clearing user pause. Record coalesced/missed occurrences, uncovered ranges and quota decisions. Quiet-hour deferral coalesces intended occurrences into a persisted `eligibleAt`; freeze their combined window when eligible, with deadline `eligibleAt + catchUpMinutes`. Subsequent processing delay consumes that grace. Test overnight deferral beyond 60 minutes, DST transition, grant expiry during deferral and no burst on wake-up; recheck all authority at eligibility.
- [ ] Execute real isolated-DB fault tests: kill after claim, after manifest persistence, after generation, after outbox insert and before completion; two competing workers; pause/cancel/edit between steps. Assertions: one durable occurrence, recoverable lease, bounded attempts, no dropped mail coverage and no state resurrection. External send remains disabled in this task.
- [ ] Run focused worker tests, isolated recovery integration tests and workspace typecheck. Commit `feat(routines): generate resumable scheduled email briefings`. Record incomplete infrastructure tests honestly and keep activation off until required proof exists.

## R4 — Scoped digest consent and template-compatible WhatsApp dispatch

**Files:** Create `supabase/migrations/0052_routine_digest_grants.sql`, runtime `routines/grants.ts`; extend DB routine repository and WhatsApp action schema/contracts. Modify `apps/worker/src/messaging/whatsapp-worker.ts`, existing send-action decision API only where needed for explicit typed authorization, review-card UI, and `docs/specs/AUTHORIZATION.md`. Tests: `apps/worker/tests/routine-digest-authorization.test.ts`, `apps/worker/tests/routine-whatsapp-delivery.test.ts`, `packages/db/tests/routine-delivery-races.integration.mjs`.

**Dependency:** Explicit architecture/authorization review of the proposed narrow grant and owner-selected consent model; R3, FIX-01 account-isolation closure and OPS-01 isolated Meta test setup. This planning document does not amend the current rule requiring approval for every general outbound WhatsApp message.

- [ ] Write failing grant tests first. Table-driven changes to mailbox, agent, sender, recipient, trigger/timezone, reporting window, quiet hours, empty behavior, template, content/frequency limit and policy version must make the old grant unusable. Also test expiry, revoked membership/binding, no organization export permission, unverified or reassigned recipient, altered persisted output and a forged routine ID on a general action.
- [ ] Implement an explicit recipient-verification flow through the existing approved messaging path; verification alone grants no corporate export permission. Store verified-user/recipient association and audit proof, with resend/attempt limits. Invalidate confirmation if the association changes. Only user-confirmed, organization-allowed recipients are eligible in MVP; other business recipients remain a separate future feature.
- [ ] Persist grant scope/hash, granting user, routine revision, permitted content class, exact destination, policy/template references, expiry and revocation. Update authorization documentation and schema/RLS together. `routine_digest_delivery` remains off until all gates pass. Current `whatsapp.send` and existing general scheduled proposals retain per-message approval.
- [ ] Build server-owned digest actions from a completed validated manifest, not model-authored arbitrary text. Enforce redaction/content policy and code-point/provider-rendered limits; reject rather than truncate into a misleading statement. A grant authorizes only this action class, with immutable output hash and source references. Recheck source access and all grant dimensions before generation and dispatch.
- [ ] Use a serialized authorization/dispatch claim shared with revoke/pause: if revoke wins, no submission; if dispatch wins and provider submission has begun, show “already submitting” and stop later sends. Do not promise recall of a message already handed to the provider. Keep database locks short; use revision/dispatch tokens and a defined submission boundary instead of holding a transaction across provider network I/O.
- [ ] Reuse WhatsApp account/binding and current Meta-template checks immediately before submission. Outside the service window use only approved supported template parameters. Unsupported/rejected template yields `blocked_template` with in-app copy and repair action, never free-form fallback. Evaluate final provider limits after template rendering.
- [ ] Persist submission attempt before network I/O. Timeout/connection loss after possible acceptance yields `delivery_unknown`; reconcile with provider IDs/status if available, otherwise require informed recovery and do not blindly retry. Deduplicate callbacks and enforce monotonic outcomes without treating accepted/read as email review. Record no exactly-once external guarantee.
- [ ] Run fake-provider policy/race tests, real isolated-DB concurrency tests, then OPS-assisted opt-in test-recipient delivery inside/outside the 24-hour window, valid/invalid template, callback duplication and account revocation. Keep production users/data out of tests. Record application state and provider evidence separately.
- [ ] Re-run WhatsApp existing approval regression suites, new focused suites, typecheck and web build; commit `feat(routines): authorize scoped WhatsApp digest delivery`. Enable only for an explicitly approved pilot after product and OPS evidence; DEV-01 does not deploy.

## R5 — Tenant-safe event routines and follow-up assistance

**Files:** Extend shared routine event types, runtime service/tools and Routines UI; adapt `apps/worker/src/automation/automation-engine.ts` and canonical trusted ingestion callers. Tests: `apps/worker/tests/routine-events.test.ts`, `packages/db/tests/routine-events.integration.mjs`.

**Dependencies:** FIX-01 automation tenancy/trigger-contract correction, event deduplication/recovery proof and completed R1–R4 behavior where used. Current `trigger.event` versus `trigger.type` drift must be repaired compatibly before new event activation.

- [ ] Define trusted envelope `{ organizationId, eventId, type, occurredAt, origin, payload }` at authenticated ingestion. Payload cannot overwrite envelope identity. Event lookup, dedup keys, run records and principal resolution all include organization. Reject missing event IDs for actions requiring deduplication.
- [ ] Write failing tests where tenant A's mail matches B's generic rule, a payload spoofs organization, two copies arrive, an old event replays and a routine observes its own output. Assert zero cross-tenant execution, payload disclosure or counts.
- [ ] Restrict MVP conditions to typed allowlisted sender/account/priority predicates; do not execute arbitrary JSON/expressions. Persist 15-minute debounce and 100-runs/org/hour enforcement across workers/restarts. Ignore self-originated routine events and cap causal depth at one for the first release; record suppression reasons.
- [ ] Add event UI using “When … then …”, with condition/destination preview and the same confirmation/grant rules. Start with in-app follow-up/VIP cues and draft proposals; urgent external alerts need separate explicit frequency/content consent. Snooze and priority correction remain personal and do not silently change organization policy.
- [ ] Execute cross-tenant real-DB and concurrent quota tests, tool/API parity tests and keyboard/mobile UI tests. Commit `feat(routines): add bounded tenant-scoped event triggers` only after FIX-01's dependency is verified.

## R6 — Acceptance, evidence and phased rollout handoff

**Files:** Create `docs/testing/catch-up-routines/README.md`, synthetic scenario fixtures and evidence index; update this plan's checkboxes only after executing each item. Update project control and role-local worklog for every slice.

- [ ] Map every CU/RT/WA/UX scenario in the design matrix to an executable test, browser task or documented provider check. Separate source-contract tests, behavioral unit tests, database fault tests, authenticated browser tests and real provider evidence.
- [ ] Test 100 synthetic email cases: deadlines with timezone ambiguity, quoted old instructions, newsletters, spoofed invoices, multilingual customer requests, duplicate threads, huge bodies, prompt injection, revoked accounts and source deletions. Human-review expected sources/actions; report priority usefulness and supported-claim rates against proposed targets, not only model self-ratings.
- [ ] Conduct the five-person pilot after approval, including everyday user, employee, small-business and multi-timezone workflows. At least four complete catch-up and routine setup without help. Record confusing language, clicks, time, recovery success, mobile/keyboard barriers and suggested changes. No real mail appears in shared evidence without explicit permission.
- [ ] Verify feature-disable and grant-revoke behavior, retention cleanup, orphaned job recovery, quotas, cost/latency per 100 messages and audit redaction. Email sync must continue when the briefing feature is disabled; source mail remains canonical.
- [ ] Hand OPS-01 concrete migration order, off-by-default flags, sandbox prerequisites, rollback-by-disable procedure and acceptance evidence. OPS owns CI/deployment/provider credentials. Retain ISS-026, #36, #26 and ISS-037 ownership; do not infer their closure from new tests.
- [ ] Record exact verified commit, commands/results, remaining blockers and next authorized action. Commit `docs(routines): record acceptance evidence and rollout handoff`. No phase acceptance or production-ready claim without the project's separate review/deployment gates.

## Suggested implementation sequence

After design review, begin Catch-up C1 and pure R1 time/contract work. Continue Catch-up selection/generation/UI while FIX-01 repairs scheduler and tenant defects and OPS-01 prepares isolated test infrastructure. Deliver useful in-app catch-up first; then routine management and in-app digests; then narrowly authorized WhatsApp; finally event routines and pilot refinements. Do not let a blocked external provider stop independent in-app product work.
