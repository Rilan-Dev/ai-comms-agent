# Personal Mail Catch-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each user a resumable, evidence-backed briefing of permitted mail they have not reviewed.
**Architecture:** Extend canonical summary/provenance storage, add personal coverage/grants, and reuse the shared email runtime and Clara provider boundary. A durable generation queue produces bounded batches; the Chat-first UI exposes source-linked items and explicit review actions.
**Tech Stack:** Existing TypeScript, Node 24, pnpm 12.8.1, PostgreSQL, Next.js, existing worker, Clara, Vitest/Node tests; no new product dependency assumed.
**Spec:** [Personal catch-up and routines design](../specs/2026-10-18-personal-catch-up-and-routines-design.md).
**Status:** Proposed; planning authorized, implementation follows design/plan review. Tasks C1–C5 implement spec phases C1–C3. DEV-01 owns these tasks. FIX-01/OPS-01 prerequisites are dependencies, not reassigned implementation tasks.

## Global Constraints

- PostgreSQL email records remain canonical; do not create a second store of raw emails.
- Progress belongs to organization + user + agent/mailbox scope.
- Login, opening Chat, provider read flags and receiving a WhatsApp message never acknowledge a briefing or mark provider emails read.
- Candidate pages: 200 messages; model batches: at most 50 messages or 12,000 estimated input tokens; at most 2 concurrent generation batches per organization.
- Initial range: default 7 days; presets 1/7/30 days; custom initial range maximum 90 days with explicit continuation.
- Coarse foreground activity is throttled to once per 60 seconds; derived briefing-text retention defaults to 30 days, independently of review progress.
- Live grants are checked at selection, generation, display and acknowledgement; no personal-summary access via old organization-wide RLS policies.
- Source content is untrusted and cannot provide actor identity, grants or executable instructions.
- Use the existing isolated checkout; no new branches/PRs or worktrees for this task. Preserve current main and concurrent agent work. Confirm proposed migration names remain unused before implementation.

## Review Focus

1. Late/concurrent mail commits: source-revision anti-join and immutable manifests must prevent timestamp-watermark gaps (C2).
2. Old org-wide summary policies: multiple permissive RLS policies must not OR together to expose new personal summaries (C1).
3. Two-device review and a partially failed batch: acknowledgements may cover only complete manifest items (C2/C4).
4. Deleted/revoked source after model generation: cached text must stop being readable immediately (C1/C3).
5. Model output invents a source/deadline or prompt-injected action: validate provenance and retain uncertainty without executing anything (C3).

## File and interface map

Create `packages/shared/src/briefings/types.ts`; export from the existing shared index. Create `packages/db/src/briefings/{access,repository}.ts` and export public repository contracts from `packages/db/src/index.ts`. Create `packages/email-agent-runtime/src/briefings/{selection,generation,tools}.ts`. Worker orchestration goes in `apps/worker/src/briefings/briefing-worker.ts` and is registered in `apps/worker/src/index.ts` behind the server-side feature flag. Keep UI orchestration in `apps/web/src/app/catch-up/` and route handlers under `apps/web/src/app/api/organizations/[orgId]/briefings/`.

Define these shared interfaces in C1 and consume them unchanged in the routines plan:

```ts
type TrustedBriefingPrincipal = { organizationId: string; userId: string; agentId: string };
type BriefingPeriod = { start: string; end: string };
type BriefingRequest = { mailboxIds: string[]; language: string; requestKey: string } & (
  | { mode: 'catch_up'; period: BriefingPeriod | null }
  | { mode: 'scheduled'; period: BriefingPeriod; routine: {
      id: string; revision: number; occurrenceId: string; coverageKey: string;
      window: 'since_previous_occurrence' | 'previous_24_hours' | 'previous_local_day';
    } }
);
type EffectiveBriefingScope = TrustedBriefingPrincipal & { mailboxIds: string[]; scopeVersion: string };
type BriefingSource = { messageId: string; mailboxId: string; threadId: string; contentRevision: string };
type BriefingManifest = {
  id: string; scope: EffectiveBriefingScope; mode: BriefingRequest['mode'];
  period: BriefingRequest['period']; sourceCount: number; status: 'pending' | 'partial' | 'ready' | 'failed' | 'invalidated';
};
type BriefingItem = {
  id: string; sourceIds: string[]; priority: 'high' | 'medium' | 'low';
  title: string; summary: string; reason: string; deadline: string | null;
  confidence: 'supported' | 'uncertain'; suggestedAction: 'reply' | 'review' | 'follow_up' | 'none';
  evidence: { sourceId: string; contentRevision: string; start: number; end: number;
    quote: string; supports: 'deadline' | 'amount' | 'priority_reason' | 'summary' }[];
  representation: 'complete' | 'partial'; snoozedUntil: string | null;
};
```

`TrustedBriefingPrincipal` is constructed only from authenticated server identity and a verified selected agent, never from model/client user IDs. Scheduled `routine` context is constructed from persisted routine/occurrence data by the host; the public personal-briefing endpoint cannot accept it. Effective scope is resolved again at each sensitive operation, not accepted because a previous request returned it. `contentRevision` excludes unread/folder-only changes and includes content/new-thread-message changes.

Add `getBriefing(principal, id): Promise<{manifest: BriefingManifest; items: BriefingItem[]}>` and a scoped paginated list contract. Both revalidate all contributing source IDs/revisions/access before returning derived fields; invalidation suppresses affected items and mixed summaries, including sensitive titles/counts. Tools, UI and caches must consume these read services rather than query saved text directly.

### C1: Personal storage and access boundary

**Files:** Create `supabase/migrations/0050_personal_mail_briefings.sql`, shared types, db access/repository modules; modify shared/db exports; create `apps/web/tests/briefing-access.test.ts`, `packages/db/tests/briefing-storage.integration.test.mjs` and its test-only fixture helper `packages/db/tests/helpers/briefing-db-fixture.mjs`.

**Consumes:** Existing membership, `email.read`, agent/account bindings and canonical `summaries` / `summary_sources`.
**Produces:** `resolveBriefingScope(principal, mailboxIds): Promise<EffectiveBriefingScope>`; `recordForegroundActivity(principal, nowIso): Promise<void>`; private summary columns, `briefing_mailbox_grants`, `user_mail_activity`, `mail_review_items`, durable generation jobs/batches and scoped keys.

- [ ] Write failing tests: organization B and user B cannot read A's personal summary; send-only/revoked binding is denied; admin without mailbox grant is denied; legacy org-wide policies cannot expose personal rows. Fixture creates two organizations/users/agents and distinct explicit grants; it connects only to `BRIEFING_TEST_DATABASE_URL` and refuses non-test targets.
- [ ] Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-access.test.ts`; run `node --test packages/db/tests/briefing-storage.integration.test.mjs` on OPS-01's disposable database. Expected before implementation: missing contracts/schema fail, not a silently skipped green run.
- [ ] Implement forward-only schema with compound tenant ownership, owner user, status/coverage/version fields, indexes for scoped source selection and review lookup, and transactional generation-job uniqueness. Replace or constrain the old permissive summary policies so personal rows cannot be accessed through another policy. Seed creator-only grants only with proven existing ownership; all other grants require an audited administrator assignment.
- [ ] Implement scope resolution as intersection of active member + `email.read` + current explicit briefing mailbox grant + selected agent primary/read-only binding + live nondeleted account. Store only the latest server activity timestamp; test foreground writes at t=0, t=30 and t=61 seconds yield two updates, and membership deletion removes it. Add feature configuration and grant API under `/api/organizations/[orgId]/briefing-access`. Define `assignBriefingMailboxGrant(actor, targetUserId, mailboxId, reason)` with new owner/admin-only `briefing.access.manage`, active same-org actor/target/account checks and old/new scope audit. Reject cross-org targets and member self-grants. Administration does not itself expose mail; external export requires the separate routine policy and consent. Modify shared permission types/mapping in this slice.
- [ ] Rerun both suites; verify fresh migration and upgrade fixtures with checksum checks under OPS-01. Expected: pass with test counts recorded, including direct SQL/RLS negatives; require non-superuser role and separately test application pooled-role predicates.
- [ ] Commit only this slice and its evidence: `feat(briefings): add private coverage and mailbox grant boundary`.

### C2: Stable selection, coverage and resumable work

**Files:** Create `packages/email-agent-runtime/src/briefings/selection.ts`; extend db repository; create `apps/worker/tests/briefing-selection.test.ts` and extend `briefing-storage.integration.test.mjs`.

**Consumes:** C1 types and `resolveBriefingScope`.
**Produces:** `prepareBriefing(principal: TrustedBriefingPrincipal, request: BriefingRequest): Promise<BriefingManifest>`; `listBriefingSources(principal, manifestId, cursor, limit): Promise<{items: BriefingSource[]; nextCursor: string|null}>`; `acknowledgeBriefingItems(principal, manifestId, itemIds, expectedScopeVersion): Promise<{reviewed: number}>`.

- [ ] Add failing selection tests with explicit cases: first-use 7-day default; five-day absence; 5,000 candidates consumed in pages of 200; two messages sharing a timestamp; an older-received message committed after snapshot selection; new reply in a reviewed thread; metadata-only change; all are checked against persisted source IDs/revisions, not a timestamp-only cursor.
- [ ] Run `pnpm --filter @ai-comms-agent/worker exec tsx --test tests/briefing-selection.test.ts` and the DB integration suite. Expected: selection/acknowledgement behavior fails until implemented.
- [ ] Implement immutable source manifests with scoped keyset pagination and a personal-mode indexed anti-join against fully reviewed source revisions. Capture eligibility from a consistent DB snapshot; persist actual source IDs and hashes before generation. Scheduled mode uses the trusted routine coverage key, never the personal review ledger: fixed period plus uncovered older eligible revisions for `since_previous_occurrence`, explicit overlapping periods for the other modes. Complete generation advances routine generation coverage; failed/partial output does not. Delivery attempts use a separate ledger; blocked/unknown output is held for recovery, not automatically resent. C2 defines/tests this adapter contract; routines R3 supplies the persisted ledger integration.
- [ ] Test personal review cannot suppress a routine, delivery cannot acknowledge personal mail, and two routines cannot advance each other's coverage. Include two missed daily fires, old mail committed after a snapshot, empty run, partial generation and unknown delivery. Same mailbox-scope key preserves coverage across edits; scope change uses an explicit new starting range. Leave late arrivals eligible for a future manifest; initial history boundary never claims older mail was reviewed.
- [ ] Implement idempotent request keys scoped to user/org/scope, resumable generation-batch claims (120-second lease, 30-second heartbeat) and acknowledgement restricted to completed represented items. New grants/scope versions create a new scope, not inherit another scope's completed cursor. Review never writes `email_messages.is_read` or provider state.
- [ ] Persist stable extracted-item identity using source revision plus evidence/action anchors, not model array position. Mark a source fully reviewed only after all represented items are acknowledged and representation is complete. Test one email with two obligations, overlapping manifests, partial oversized content and two-device acknowledgement. Snooze accepts an explicit UTC instant after local-zone confirmation, remains unreviewed and reappears when due; it never alters routine coverage.
- [ ] Add and run two-device concurrency tests: repeated acknowledgement is idempotent; partial batch cannot acknowledge omitted items; a stale scope version returns conflict; a process restart resumes uncompleted sources and does not lose late commits. Expected: all above cases pass on actual PostgreSQL.
- [ ] Commit: `feat(briefings): preserve source coverage and review progress`.

### C3: Grounded generation, classification and recovery

**Files:** Create `packages/email-agent-runtime/src/briefings/generation.ts`, worker `briefing-worker.ts`; modify worker `src/index.ts`; create `apps/worker/tests/briefing-generation.test.ts` and `briefing-worker-recovery.test.ts`.

**Consumes:** C2 manifest/source APIs and existing Clara organization/agent provider resolution.
**Produces:** `generateBriefingBatch(principal, manifestId, batchId, deps): Promise<{items: BriefingItem[]; status: 'ready'|'partial'|'failed'}>` and `processBriefingJobs(limit: number, now: Date): Promise<{completed:number; retried:number; failed:number}>`. `deps` provides the current-grant resolver, source reader, typed Clara generation adapter and clock; test doubles live only in tests.

- [ ] Write failing tests for source-grounded high/medium/low grouping; duplicate threads; unknown source IDs; unsupported dates/amounts; superseded deadline in a later reply; conflicting/quoted/locale-ambiguous dates; user priority override; multilingual mail; prompt injection; source deletion/grant revocation during generation; provider 429/timeout and an oversized message.
- [ ] Run `pnpm --filter @ai-comms-agent/worker exec tsx --test tests/briefing-generation.test.ts tests/briefing-worker-recovery.test.ts`; expected: failures for absent validation/batching/recovery.
- [ ] Implement the injectable Clara adapter without copying vendor internals. Budget to the first reached limit of 50 messages/12,000 estimated input tokens; organization concurrency 2. Preserve source identity and provenance through per-thread/batch aggregation. Validate IDs/schema and exact evidence spans against canonical normalized text/revision. Reject unsupported factual dates/amounts; uncertainty must not display them as established deadlines. Human quality evaluation checks semantic support, which span matching alone cannot prove. Use a deterministic source-list fallback when generation fails.
- [ ] Persist model/prompt/language/scope/content versions and deduplicate retries. Apply user correction rules ahead of AI suggestions. Add user-scoped priority-override/snooze storage within the review repository. Recheck source access on output read; do not use cached text as an authorization shortcut.
- [ ] Run tests with fake provider responses and real repository-backed lease tests. Verify one failed batch does not clear remaining work, revoked sources disappear and retry does not add duplicate items. Record latency/tokens for a seeded workload without claiming live-model quality from mocks.
- [ ] Exercise `getBriefing` and list/tool/cache reads after deletion, changed source content and revoked access, including a summary sentence combining two sources. Assert no stale text/subjects/counts escape before asynchronous invalidation runs; permitted unaffected items may remain. Test snooze expiry without new email and derived-text expiry without lost review progress.
- [ ] Commit: `feat(briefings): generate sourced priority summaries with recovery`.

### C4a: Minimal UI/browser test harness prerequisite

**Files:** Modify `apps/web/package.json`, `apps/web/vitest.config.ts`, `pnpm-lock.yaml`; create `apps/web/playwright.config.ts`, `apps/web/tests/helpers/ui-setup.ts`, `apps/web/tests/e2e/fixtures/auth.ts` and a fixture smoke test.

- [ ] After design review, add dev-only `@testing-library/react`, `@testing-library/dom`, `jsdom` compatible with current React 19/Vitest 2 and `@playwright/test` (align browser version with the installed 1.58.2 tooling where supported). Pin resolved versions in the lockfile and record them. No runtime dependency or production test-auth route.
- [ ] Extend Vitest include to `.test.tsx`; keep existing Node tests in Node and opt component tests into jsdom using per-file environment directives. Setup performs cleanup after each test. Configure Playwright `testDir: './tests/e2e'`, Chromium and a required explicit test base URL. Run `pnpm --filter @ai-comms-agent/web exec playwright install chromium` or use an explicitly configured compatible installed binary.
- [ ] Build synthetic organization A/B users/mailboxes in OPS-01's disposable database. Authenticate through the real login/session path using test secrets from environment; separate browser contexts for two users/devices. Fixture must reject production URLs and absent target identity rather than silently using a live account. Preserve current auth/CSRF policy.
- [ ] Execute one component focus/label test and one authenticated tenant-isolation browser fixture smoke test before C4. Record commands/versions and commit `test(briefings): prepare isolated UI acceptance harness`. If staging auth is unavailable, record the blocker and continue independent component work without claiming browser acceptance.

### C4: Catch-up API, Chat entry and accessible review UI

**Files:** Create `apps/web/src/app/api/organizations/[orgId]/briefings/route.ts`, `[briefingId]/route.ts`, `[briefingId]/review/route.ts`, `activity/route.ts`, `[briefingId]/items/[itemId]/route.ts`; create `apps/web/src/app/catch-up/{page.tsx,catch-up-client.tsx}` and `apps/web/src/components/briefing-card.tsx`; modify `apps/web/src/app/chat/chat-client.tsx`; create `apps/web/tests/briefing-routes.test.ts`, `briefing-ui.test.tsx` and `apps/web/tests/e2e/catch-up.spec.ts`.

**Consumes:** C1–C3 contracts. **Produces:** authorized list/create/detail/review, foreground activity, priority/snooze endpoints and a resumable UI. Server identity determines owner; client parameters select only within current scope.

- [ ] Write failing route tests: deny forged user/organization, other person's briefing, revoked source, invalid item/revision and provider-read side effects. Add UI tests for first visit, five-day return, empty, stale sync, partial, offline, denied, retry and explicit review.
- [ ] Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-routes.test.ts tests/briefing-ui.test.tsx`; expected: missing route/UI assertions fail using the C4a harness. Test missing mailbox grant shows actionable access request, not an empty inbox.
- [ ] Implement source-linked cards, rationale/deadline/uncertainty, progress, narrow mailbox/date selection, priority override, snooze and “Mark selected reviewed”. Preserve Chat draft/agent state and return focus. Polling/status responses never report foreground activity. Keep raw provider/storage diagnostics out of product copy.
- [ ] Verify authenticated browser fixtures at 320/390/768/1440px, 200% zoom, keyboard focus, screen-reader announcements, two-device progress and reconnect. Run `pnpm --filter @ai-comms-agent/web exec playwright test tests/e2e/catch-up.spec.ts` after adding explicit test config/support in this task; it uses only staging fixtures and cannot fall back to production credentials.
- [ ] Rerun relevant Chat shell tests, workspace typechecks and web build; record exact test counts and browser evidence. Expected: no source disclosure, preserved draft, accurate progress and no provider-read mutation.
- [ ] Commit: `feat(briefings): add personal catch-up workspace and review controls`.

### C5: Shared AI tools and pilot readiness

**Files:** Create `packages/email-agent-runtime/src/briefings/tools.ts`; modify that package's `src/index.ts` and actual Chat/Voice tool registry composition points; create `apps/worker/tests/briefing-tools.test.ts`, `apps/web/tests/briefing-chat-contract.test.ts`; add `docs/verification/catch-up/README.md` with the spec scenario evidence index.

**Consumes:** C1–C4. **Produces:** registered `summary.generate` and `summary.get` tools using the same domain services; `summary.generate` returns durable `{briefingId,status,coverage}` and never claims asynchronous generation already finished.

- [ ] Write failing behavioral tool tests: model-forged tenant/owner, unbound mailbox, prompt-injected action, user revocation mid-turn, generation pending/partial/failed and re-opening a source from an unauthorized agent. Assert identical behavior for UI/API and host tool calls.
- [ ] Run `pnpm --filter @ai-comms-agent/worker exec tsx --test tests/briefing-tools.test.ts`; expected: fail for unregistered/missing service contracts before implementation.
- [ ] Register only implemented handlers with existing policy/permission/audit execution. Use trusted host user context. Enable through `catch_up_briefings` only for pilot organizations after ISS-026 negative checks. No new vector exposure or voice transport.
- [ ] Run CU01–CU08, UX01–UX02 from the spec and a 100-case synthetic quality corpus; live AI scoring is a separate approved provider run. Verify 30-day text expiry preserves review progress and denied-source output remains inaccessible. Record real quality, cost and latency; do not replace failed factual tests with source-string checks.
- [ ] Commit: `feat(briefings): expose authorized summary tools and pilot evidence`.

## Execution and completion

Sequence C1 → C2 → C3 → C4a/C4 → C5. C4a and UI state design/tests can proceed independently while generation work progresses, but handlers must consume the defined interfaces. Apply the owning slice's regression tests first, then workspace typechecks/build and affected suites once; rerun only for changes or unresolved failures.

Before each migration or authenticated/provider run, OPS-01 supplies isolated fixtures and verifies target identity. FIX-01 issues do not stop pure contract/UI work; they block affected activation. Complete the slice only with its tested behavior, evidence, worklog/session update, reviewed commit and exact next action. Do not claim runtime success from source assertions alone.
