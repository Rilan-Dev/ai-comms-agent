# Practical email assistant for people and teams — phased build plan

**Owner:** DEV-01 / Forge · **Branch:** `Development` · **Date:** 2026-10-23
**Authority:** User-requested planning and independently authorized source-only improvements. This document is a continuation of the [personal catch-up/routines specification](../specs/2026-10-18-personal-catch-up-and-routines-design.md), [human-first five-day plan](2026-10-23-dev01-human-first-five-day-mail-catchup-continuation.md) and [Overview-first plan](2026-10-23-overview-first-mail-command-center.md); it is not permission to activate a worker, collect user activity, apply a migration or send WhatsApp messages.

## Human problems the product must solve

| Persona | Real daily pain | Default first-screen answer | Critical boundary |
| --- | --- | --- | --- |
| Personal mailbox owner | Important bills or appointments buried under promotions | “Three items may need your attention”; evidence links and deadlines | No fabricated deadline and no hidden sent reply |
| Employee | Many projects, overlapping threads and pending decisions | “Needs your reply / waiting on someone / FYI” in authorized mailboxes | No colleague's mailbox via organization membership |
| Small business | Customer leads, requests, invoices, complaint escalations | Action-first digest with customer context and suggested draft | No automatic promise, payment, external reply or VIP assumption |
| Multi-region business | Several accounts, languages and time zones | Separate per-user inbox scope, language, clock and owner visibility | No cross-tenant or per-employee inactivity surveillance |

The home screen should answer four questions in **under a minute of reading**: What arrived? What matters? What do I need to do? What has my assistant actually done? Show original evidence for each important claim. If something is not synced, unverified, denied or merely proposed, say so plainly.

## Ground-truth model — never merge these concepts

1. **Provider synchronization** already runs independently of login; original messages and revisions stay in canonical PostgreSQL. No second raw-mail store.
2. **Foreground visit** is a per-user session signal, not permission to access mail, mark mail read, measure productivity or reset review progress.
3. **Selected period** (e.g. last five days) is user-chosen until trustworthy per-person last-visit/review signals and privacy policy have been accepted.
4. **Source coverage** records exact authorized account IDs, inclusive/exclusive UTC window, source revision, pages/omissions, mailbox sync freshness and revoke/late-arrival flags.
5. **AI judgment** is distinct from evidence: High (“Needs attention”), medium (“Worth reviewing”), low (“For reference”); reason, source, confidence, deadline (only if evidenced) and proposed next step.
6. **Human review** explicitly acknowledges an identified immutable summary obligation; opening the app or receiving a digest never changes source `is_read`.
7. **Automation configuration** is preview → proposed → human confirmed → active/paused → run/failed; execution and external delivery are separate ledgers.
8. **External WhatsApp delivery** needs scoped, revocable standing consent, verified recipient, Meta policy/template, last-mile delivery receipt and independent provider/error handling. A model prompt is not consent.

## Superpowers-style RED → GREEN → verify slices

### P0 — Overview and simple guided entry — source present, browser acceptance pending
- **Existing:** Authenticated `/` to `/overview`; direct `/chat`, `/mail/inbox`, gated `/catch-up?days=5`; organization metrics labelled as such.
- **Acceptance:** Authenticated mobile/desktop navigation, keyboard, screen reader, `BRIEFINGS_ENABLED=false` hides link and direct gate returns 404, no false “zero activity” when permissions deny.

### P1 — Trusted personal five-day source selection — C1/C2 and C4a source present
- **Existing:** User+agent permitted mailbox list, 1/5/7/30-day bounded period, immutable source manifest, source links, pagination, revision-aware explicit review.
- **RED:** Two orgs / two people, revoked access mid-page, 200+ messages, stale revisions, missing source, duplicate thread, 5-day window after sync lag.
- **GREEN:** Show “Selection prepared; AI summary pending”, exact period and source count, partial/failed/invalidation states; never infer absence from a chosen period.
- **Exit:** Disposable database/authorized browser evidence and no unauthorized source leak.

### P2 — Reliable source-backed action priorities — C3 worker coded but gated/off
- **Next when allowed to verify:** Verify C3 normal and negative cases (canonical source loader, tenant grants, fenced lease/restart, source quote ranges, injection attempts, provider 429, unsupported date, late mail, long threads).
- **UI design:** First three evidenced actions, then High/Medium/Low grouped and searchable; distinguish “must respond”, “decision”, “deadline”, “waiting for reply” and “for reference”. A generated recommendation is never marked completed just because the model said so.
- **Exit:** Validated source excerpts and revision, explicit missing-coverage indicator, bounded retries. **No worker registration/enable until its own approval and runtime evidence.**

### P3 — Real “Welcome back” and personal learning — future privacy/review gate
- **Future:** Separate per-user `last_foreground_visit`, `last_completed_review` and `last_digest_delivered`. Opt out of presence tracking. Compute a reliable review gap only when each underlying signal is available and disclosed.
- **Helpful additions:** VIP rules people choose, follow-up for unanswered customer requests, safe duplicate-thread clustering, personal priority correction and accessible regional-language summaries.
- **Exit:** No monitoring staff attendance; two users never share each other's private visit/review state. Corrections can be undone and do not override source truth.

### P4 — Understand routine timing BEFORE scheduling — R1a safe slice
- **Source implemented here:** `/routines/preview` linked from Overview. Private GET-only arithmetic via canonical `nextRoutineOccurrences`; options for daily local time, weekly weekday, every 1/6/12/24 elapsed hours (minimum 60 minutes), one-off exact instant and event/no fixed clock. Show next three UTC/local instants and DST explanation. **No DB write, job, trigger, WhatsApp or provider call.**
- **RED:** DST spring gap/fall duplicate, invalid IANA zone, past once instant, fixed 24h crossing DST, hourly minimum below 60 minutes, unrecognized kind and missing auth.
- **Exit:** Focused native source contracts, existing worker timing tests and authenticated browser/keyboard preview; permission and activation remain unchanged.

### P5 — One human-friendly Routines surface over TWO existing engines — consent architecture gated
- **Future:** Clara proposes an immutable typed routine with mailboxes, task/window/language, trigger and zone, destination, verified recipient, message length, budget, quiet hours and missed-run catch-up limit. The user can preview, edit, confirm, pause or revoke. Compare immutable config hash plus revision and actual live grants at confirmation.
- **Use current `scheduled_jobs` for clock/once and `automation_rules` for events**; no second scheduler. Daily 09:00 local is NOT every 24h; clock and event events must dedupe across restarts.
- **Exit:** Two-device conflict/revocation tests, no scheduled job from mere conversation, default paused, no material edits retaining stale consent. **R1b proposal persistence/confirmation is not yet authorized.**

### P6 — Trustworthy WhatsApp briefing delivery — future separate sender/OPS gate
- **Future consent:** Explicit selected source mailboxes and recipient, privacy-minimized high/medium/low summary, chosen language, destination verified, Meta template/window and quiet hours. Never export full bodies, attachments, OTPs or secrets.
- **Execution states:** scheduled → gathering → generated → approval/consent verified → queued → provider accepted → delivered/failed/expired, with immutable ledger and idempotency keys; recheck current grants immediately before queue and execution.
- **Exit:** Consent revoked, changed mailbox/phone, provider rejection, DNS/outage and DST/duplicate triggers produce **no unapproved external message**. Existing per-message human approval remains in force until approved standing digest consent exists. OPS-01 owns real provider/deployment evidence.

### P7 — Feedback and cost guardrails — later product review
- One-click “wrong priority”, “not relevant”, “remind tomorrow”; correction provenance; optional time-boxed inbox review; summary only when sources change; per-user language/volume, quiet hours, low-bandwidth and accessible mobile modes.
- Measure evidence-linked precision, missed important threads, false urgent items, grant-denied attempts, user confirmation latency and provider delivery failure, **not** employee attendance. Bound compute/storage/notification spending and retain auditable consent/history.

## What is *already complete*, and what must not be claimed

**Source-completed:** Existing mailbox sync, C1/C2 source permissions/manifest, Overview-first navigation, C4a lookback, backend R1a clock helpers, legacy Schedules/Automations engines, this read-only preview. Product correctness and deployment acceptance are **not** established by source assertions.

**Blocked/gated:** C3 worker registration, trustworthy absence detection, R1b stateful proposal confirmation, standing WhatsApp digests and unattended execution. No migrations, grants, scheduler activation or provider sends are authorized by this document. Verify old disabled flags remain disabled.

## Ownership, source-of-truth and next turn

- **DEV-01:** Human-facing UX, safe preview, existing C3/C4 source acceptance, typed proposal planning after explicit review.
- **FIX-01:** Independent source defects, permission regressions, scheduler/database correctness bugs; concurrent FIX files are off limits to DEV-01.
- **OPS-01:** Host runtime, database operations, credentials, GitHub Actions/Vercel, signed Meta API/worker activation and production delivery testing.
- **Next:** Run `node --experimental-strip-types --test apps/web/tests/routine-timing-preview.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs`; `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`; authenticated browser with timezone/DST and login-redirect negatives; preserve disabled worker and no-send state. Then return to C3 disposable grant/lease/provider-negative tests, not R1b persistence or WhatsApp enablement.

Every new slice follows **RED executable test → small code change → focused check → exact SHA evidence → role-correct handoff**. Do not wait for unrelated CI/CD, but do not imply a source-only check is a deployed acceptance.
