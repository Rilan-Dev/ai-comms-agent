# Returning-owner catch-up continuation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give returning business users a concise, accurate personal email briefing and guided routines without losing existing controls or changing the theme.

**Architecture:** Extend canonical mail synchronization, existing personal briefing manifests/review records and the existing scheduler/event evaluator. Provider read state, personal review and routine delivery coverage remain separate. Build on the approved original workspace configuration workflow; do not create a second scheduler, mail store or autonomous configuration executor.

**Tech stack:** Existing TypeScript/Next.js, PostgreSQL/RLS, Clara runtime, mail adapters and worker.

**Spec:** `docs/superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md`; continuation evidence and corrections in `docs/reviews/2026-10-26-overview-catchup-and-routines-continuation.md`.

## Global constraints

- Development only; preserve current theme, business logic, all existing authorization and approval controls.
- Finish original workspace Tasks 5–11; this plan does not reset their ledger or supersede their release gates.
- No new raw-email store, attendance tracking or organization-wide content entitlement.
- Existing provider permissions and capabilities apply to every read-state mutation.
- No provider read mutation on login, summary generation, summary delivery or personal acknowledgement.
- New automatic low-priority read rule is off until explicit scoped user consent; changes to accounts/rules invalidate its applicability. Critical, actionable, uncertain or incomplete items are never eligible merely because a model calls them low priority.
- External digest delegation requires the existing planned exact standing grant, current authority and Meta delivery eligibility; general send approval remains unchanged.
- No RAG or registered configuration-write tool in this plan.

## Review focus

- A message read in the provider between selection and generation must not return as unread work.
- A new reply or late sync after an acknowledged briefing must remain eligible.
- A model or provider failure must leave a truthful source list and resumable work, not an empty successful brief.
- Two devices, worker retries and permission revocation must not lose work or repeat mutations.
- A local-time routine, provider window and user send grant are independent boundaries.

### Phase A: Provider read-state and personal eligibility

**Files:** `apps/worker/src/email/{gmail-adapter,imap-smtp-adapter,mailbox-sync-worker}.ts`, `packages/db/src/briefings/{coverage,canonical-sources,repository}.ts`; adjacent adapter and real PostgreSQL briefing tests.

- [ ] Add failing adapter tests for existing-message Seen/unread changes, Gmail paginated label changes, expired history, reconnect and UIDVALIDITY reset. Add real database tests for personal unread eligibility, read-after-selection, cross-user scope, late mail and new replies.
- [ ] Run tests to prove the missing IMAP existing-UID reconciliation and any unread selection gaps.
- [ ] Implement bounded flag-only reconciliation using existing provider contracts, durable resumable cursor/checkpoint semantics and explicit stale coverage. Do not replace ingestion with full mailbox MIME rescans.
- [ ] Recheck provider state freshness and canonical source revision before publishing personal unread output. Persist no claim of full coverage during partial reconciliation.
- [ ] Run focused adapter/database checks and type checks; commit the independently passing change.

### Phase B: Complete existing grounded briefing execution

**Files:** `apps/worker/src/briefings/{briefing-worker,clara-generator}.ts`, existing worker registration, `packages/db/src/briefings/`, existing organization briefing APIs and Chat adapters.

- [ ] Write failing tests for trusted-principal construction, actual canonical-source loading, bounded batches, revoked grants, source content changes, provider outage, partial generation, lease loss and restart.
- [ ] Connect the existing worker through the existing registration/queue boundary. Keep rollout gated until the complete path passes; reuse Clara and immutable manifests.
- [ ] Add a default assigned-agent resolution with an explicit choice when none/multiple are eligible; never silently select an unauthorized mailbox or different model.
- [ ] Verify source links, evidence-backed priorities, correction and review resumption across devices. Commit passing focused tests and source checks.

### Phase C: Original-theme default Overview and interactive Chat

**Files:** existing Overview page/components, existing catch-up page/cards and Chat briefing cards; web rendering/interaction tests.

- [ ] Build a fictional-data clickable original-theme mockup showing returning, all-caught-up, syncing, unavailable and no-agent states. Show the concise priority groups before secondary setup/metrics.
- [ ] Add failing UI tests for scope/freshness visibility, accessible priority labels, expand-to-read, source navigation, individual review, new-reply reopening and persistent progress. Verify no implicit provider read or send call.
- [ ] Implement the same cards against the proven personal briefing service. Keep organization metrics secondary and labelled. Show incomplete coverage once with a useful action rather than repeated technical notices.
- [ ] Retain a useful inbox/action dashboard when briefings are disabled or unavailable; no simulated summary/counts.
- [ ] Check desktop, narrow/mobile and keyboard flows in the actual browser; commit with screenshots and test evidence.

### Phase D: Explicit mark-read and optional low-priority handling

**Files:** existing mail mutation API/worker action boundary and adapter methods, briefing action service/cards; new forward-only migration only if no existing operation record can model the rule safely.

- [ ] Test individual selected-message mark-read, denied provider capability, partial provider success, remote-state race, undo, duplicate retry and revoked membership. Review acknowledgement must remain separate.
- [ ] Implement user-triggered mark-read using existing authorized provider operations and record actual result. Update canonical state from confirmed outcome/reconciliation; do not optimistically claim provider success.
- [ ] Add separately reviewed, off-by-default scoped auto-read rule and preview of eligible items. Test that low confidence, deadline/request, partial evidence, VIP/priority correction, changed rule and stale classification exclude mail.
- [ ] Make rule pause immediate and expose recoverable unread reversal without promising recall of a concurrent provider operation. Prove batch limits/idempotency and audit; commit.

### Phase E: Executable in-app routines over existing scheduling

**Files:** existing routine preview domain, `packages/db/src/automation/repository.ts`, `apps/worker/src/scheduling/`, `apps/worker/src/automation/`, shared agent scheduled-tool adapters and routine UI.

- [ ] Audit and close existing scheduler recovery/tenant trigger prerequisites with real tests before activation.
- [ ] Write failing tests for elapsed 24h versus calendar daily 09:00, weekly/date schedules, confirmed timezone/DST, missed runs, edit/pause/cancel, concurrent worker claims and duplicate occurrence.
- [ ] Promote typed preview proposals through reviewed persistence into existing scheduler/event contracts. Same command service serves UI and AI; no claim of creation from preview alone.
- [ ] Produce fixed-window in-app digests with independent occurrence coverage. Personal review must neither consume nor reset scheduled coverage. Test no new mail behavior and failure recovery; commit.

### Phase F: Scoped WhatsApp digest delivery and live acceptance

**Files:** planned routine grant domain/storage, existing WhatsApp action/dispatch/receipt boundary, routine consent UI and tests.

- [ ] Implement and test exact scoped standing consent, current principal/source checks, revocation, changed destination/sender/scope/time/template, expiry and content limits. Keep automatic read consent separate.
- [ ] Test Meta free-form window, approved template fallback only when explicitly selected, provider rejection, accepted/delivered/unknown, webhook replay and reconciliation without blind resend.
- [ ] Run bounded terminal tests, real PostgreSQL scripts and full affected type/build checks. Then use labelled owner-approved fixture messages for live UI acceptance: return after simulated five/ten-day absence, read-in-provider exclusion, one important item marked read, safe low-priority rule, repeat visit, new reply and routine run.
- [ ] Verify a real WhatsApp result against provider receipts; obtain fresh inbound/template eligibility if needed. Report provider acceptance and delivery independently. Do not rewrite historical timestamps or bulk-clear the owner's real inbox to simulate absence.
- [ ] Release with documented gates, recovery/disable controls, original-theme screenshots, test evidence and an honest outstanding list. Do not declare all scenarios passed until live evidence exists.

## Current status

Audit and phased continuation plan prepared. No new catch-up/routine feature enabled. Existing original workspace Task 5 remains in progress; its database apply/revocation core has focused passing tests but its APIs/runtime integration and complete verification are unfinished.
