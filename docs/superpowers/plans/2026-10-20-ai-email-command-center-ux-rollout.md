# AI Comms Agent — Human-first Email Command Center (2026-10-20)

> **Superpowers extension / DEV-01 product plan**. Complements the reviewed [catch-up and routines design](../specs/2026-10-18-personal-catch-up-and-routines-design.md) and the task-level [catch-up](2026-10-18-personal-mail-catch-up.md) / [routines](2026-10-18-assistant-routines-and-digests.md) plans. This is not a competing design, scheduler, AI model stack, database, or authorization policy. Proposed product refinements below require review before expanding the approved implementation scope. Phase 4 remains implementation_in_progress.

## The actual problem to solve

People do not need another inbox full of notifications. They need an accurate, trustworthy answer to **What changed while I was away? What needs my action? What can safely wait?** A small business owner may return after five days; an employee may have 15 minutes at the start of a shift; an international executive may review several authorized mailboxes across time zones. Mail must keep syncing while they are absent. A visit-time service selects the authorized *persisted* mail since the person's last meaningful review, not from a guessed unread count or a short retrieval sample. PostgreSQL remains the single canonical mail store; personal briefing manifests/item-review records are separate derived data, not duplicate raw email storage.

### User experience principles

1. **Start with an answer:** a single landing surface, **Catch me up**, shows the exact coverage window, included mailbox count, sync freshness and generation state. First use defaults to the approved seven-day lookback; five days absent should include eligible unreviewed items even if late-synced. Do not silently declare "all emails" if coverage is partial.
2. **A three-tier action queue, not an AI certainty claim:** **High / Medium / Low**, each item with a plain-English *reason*, source link, latest relevant thread context, confidence/uncertainty marker, deadline only when grounded, and an optional suggested action. High = verified time-sensitive or material consequence requiring attention; Medium = actionable but less urgent; Low = FYI/newsletters. The user's own VIPs/preferences can influence priority, but never override evidence, identity/permissions, or an organization's sensitive-data policy. Fraud/phishing indicators are warnings, not verdicts.
3. **One email may contain multiple obligations:** represent stable action items, not only messages. A thread can have a due invoice question and a meeting invitation. Marking one action reviewed must not clear another. Preserve source revision and review history across rewritten summaries and new replies.
4. **Fast paths for different needs:** Personal: “Anything urgent?”; Employee: “Show client requests assigned to me”; Owner: “What needs approval across permitted mailboxes?”; Multi-timezone: “What should my Dubai and India teams handle today?”. Never turn membership or organizational administrator privileges into universal mailbox access.
5. **Accessible and low-friction:** concise daily view first, expandable details, source-open and reply-draft actions, keyboard and mobile parity, strong empty/partial/error states, multilingual summaries, dyslexia-friendly plain wording, and a visible “AI may be mistaken — open original” route.
6. **Human confirmation for consequential changes:** summarizing and proposing is not permission to send, delete, forward, change rules, assign external recipients, or enable a recurring routine.

## Journey A — Five-day absence

- Background provider sync continues whether or not the person opens AI Comms Agent. On login, update a server-side foreground-activity heartbeat; **do not replace last-reviewed coverage with a page visit timestamp**.
- Offer “Catch me up from my last review (5 days)” and a verifiable date/time range. Frozen selection spans all currently authorized, live mailbox bindings; late arrivals and revision updates become eligible according to C2's source-coverage ledger.
- A bounded C3 worker processes immutable source IDs and grounded citations, preserves partial and retry state, and never fabricates unread counts. UI progressively shows a neutral “preparing” state and coverage; no false final summary until the batch is actually completed.
- User sees **Needs action / Important updates / FYI** plus a compact timeline of newly arrived threads, snoozed work, and coverage gaps. Each item opens original email; users can dismiss, mark reviewed, snooze, request a draft, or report a mistaken priority. Actions are tracked at the supported source/item revision.
- App can propose “Would you like this every weekday at 9:00 AM?” but must not create a routine from model text without verified proposal/confirmation.

## Journey B — A recurring WhatsApp briefing

User: “Every morning at 9:00, summarize important new work mail and send me a short digest on my verified WhatsApp.”

- Agent identifies which authorized mailbox(es), user's saved IANA time zone, verified WhatsApp recipient, summary window, priority preferences and approved template are involved. If any truly essential field is missing, ask that one question.
- Prepare a **review card**: exact scope, content class/limits, sample redacted digest, next three fire instants **with UTC offsets**, consent expiry, template/business-account restrictions, and *pause/edit* controls. **Daily local 09:00** differs from **every 24 hours** across DST.
- User confirms the complete bounded proposal. Store a revision-bound standing grant for that exact recipient, sender account, mailboxes, task, timing, window, content class and template metadata. A changed scope invalidates the grant.
- At a fixed occurrence, obtain fresh authorization, generate from a frozen manifest and grounded sources, redact/redesign to at most the smaller of product/organization/provider limits, and deliver only through the **existing** approval-aware WhatsApp transport with an explicit, verified `routine_digest` authorization. Respect WhatsApp approved-template / conversation-window requirements; a personal phone number is not interchangeable with a verified WhatsApp Business sender.
- Distinguish **generated**, **delivery_pending**, **sent**, **delivery_unknown**, **failed**, **no_new_mail**, **paused**, **revoked**. Never claim delivery because an AI response says it sent. Unknown provider submission is reconciled, not blindly retried. Let the user view every attempt and pause immediately.
- The **default** is in-app only and not externally sent. Proposed template example: “Daily briefing: 2 urgent requests, 3 updates. Open AI Comms Agent to see sources.” No sensitive body, attachment, OTP, password, full address, or unverified AI assertion.

## Journey C — Time and event automations are one UX, two trigger types

“Routines” is one entry point with a typed task + trigger + destination + authorization + run history. **Calendar schedules** (daily 09:00, Monday 08:30), **elapsed intervals** (every 24 hours), **one-offs** (specific date/time and explicit offset), and **events** (new VIP message) have different clock semantics. Reuse the current durable scheduler and automation event infrastructure, not a duplicate engine. Event conditions are allowlisted and tenant-scoped. Do not enable self-triggering or unbounded recurrence. A “do my work” instruction becomes a typed, supportable, reviewable task or a draft proposal — never arbitrary model-generated code or open-ended autonomous external action.

## Proposed extras after the reviewed MVP (not automatically authorized)

- **Waiting-for tracker:** mark a sent thread “waiting for customer”, remind after X working days, and never imply a reply was sent or promised when not grounded.
- **Explainable attention rules:** per-user VIP and sender/domain priority suggestions with organization policy caps; explicit “why important?” evidence for every ranking.
- **Reply assistance:** concise draft with source-backed references, tone/language choice and a clear human Send approval. Warn before reply-all, external domains, disclosure of confidential material and misleading AI certainty.
- **Useful meeting and deadline extraction:** propose calendar/task actions when exact date and person are supported; ask for confirmation rather than making calendar changes from email content.
- **Shared-team escalation, only with delegation:** transfer a verified action item to a delegated team member without exposing another user's mailbox or attachments.
- **Inbox health and safety:** detect duplicate threads/receipts, newsletters, possible impersonation and suspicious payment-change requests, with non-definitive risk cues and easy source inspection.
- **Learning from corrections:** reversible per-user sorting/preferences, not training on confidential mail by default and not silently promoting a user's dismissals into organization-wide policy.
- **Cost and overload controls:** per-mailbox coverage limits, quota/cost estimates, transparent partial-results messages, safe retention and per-user adjustable quiet hours, localization, accessibility and mobile offline *status* (never pretend unsynced mail was checked).

## Dependency-aware execution plan

| Slice | Product result | Current evidence and acceptance criteria | Owner |
| --- | --- | --- | --- |
| C1/C2 | Explicit private scope; stable source selection, review/snooze and resumption | Source delivered; preserved grant/RLS checks and fixed item/source coverage. Must not infer whole-product acceptance. | DEV-01 |
| C3 | Safe grounded catch-up generation | Canonical source/Clara path implemented; owner-host 29 focused tests and later 6/6 disposable DB Node results. Broader suites, permission/grounding acceptance and disabled-by-default registration still required. | DEV-01; FIX-01 separate defects |
| C4 | Mobile/keyboard personal catch-up card and original-source trace | API/UI source exists; authenticated 5-day journey, authorized/unauthorized, empty/partial/error, multilingual and two-device tests pending. | DEV-01 |
| R1a | Pure typed schedule semantics and next-three preview | Source commits recorded in project-control. DST fall-back first occurrence, gap skip, fixed UTC interval, time-zone and invalid input tests **authored but not executed** in connector-only run. No routine persisted or activated. | DEV-01 |
| R1b | Revisioned proposals/persistence with full scoped authorization | Implement current plan's grant and expected-revision contracts, isolated DB concurrency tests, feature flag off. Check migration tip (now beyond plan's placeholder 0051/0052) before any DDL. Scheduler reliability gate from FIX-01 applies before activation. | DEV-01 + FIX-01 |
| R2 | Propose/list/preview/pause/edit tools + UI | Unified host service; no model-forged confirmation; reasoned next-run card and run history; complete auth and browser tests. | DEV-01 |
| R3 | Durable scheduled in-app digest | Frozen intended occurrence, fixed coverage and replay-safe leases, fresh grant/revision checks; no coverage advancement on failure. | DEV-01 |
| R4 | Narrow WhatsApp digest delivery | Separate policy-bound consent and verified recipient/template, revocation/unknown-delivery recovery, no general send-authority bypass. | DEV-01; OPS-01 provider/runtime |
| R5 | Bounded event routines | Trusted org on envelope and SQL rules, bounded debounce/dedup/loop protection, cross-tenant DB proofs. | DEV-01; FIX-01 security proof |
| Acceptance | Human-first UX and pilot | 100 synthetic grounded-mail scenarios, five personae with >=4 independently succeeding, zero confirmed cross-tenant reads/sends, source fidelity, multilingual/mobile testing, cost/latency baselines. | DEV-01 + user; OPS-01 deployment |

### Explicit gates and current authorization

- The owner authorized continuing independent source development on `main`, no branch/PR. Dev task C3 remains the current critical path. The existing reviewed Superpowers routines plan explicitly allows **pure R1 time/contract work** independently; broader R1 DB/storage/service execution requires the review/persistence gates and does **not** follow from the time preview commits.
- New extras listed above are proposals. The existing spec's security, data-ownership, consent, retry, idempotency, privacy and provider boundaries remain binding.
- FIX-01 owns substantial runtime bugs and scheduler/event tenancy correctness. OPS-01 owns CI, disposable infrastructure, migration application, Vercel, provider verification and any build-hook exposure response. Their work does not block independent UI/tests/design.
- Continue within Phase 4. Do not treat a code commit, six focused DB results on an older SHA, or assistant source checks as runtime or deployment acceptance.

## Exact next DEV-01 actions (no CI polling)

1. Execute `cd apps/worker && node --import tsx --test tests/routine-time.test.ts`, then `pnpm --filter @ai-comms-agent/shared typecheck` and `pnpm --filter @ai-comms-agent/email-agent-runtime typecheck` from an equipped current-main checkout. Fix only owned implementation issues; route unrelated bug inventory to FIX-01.
2. Continue C3 worker regression/grounding/authorized-source verification and broad suites on a safe host; keep registration disabled until verified. The recorded disposable C3 6/6 receipt is not proof that later commits passed.
3. Run C4 authenticated user journey checks after C3 acceptance. Independently prepare R1b contracts and migration-version audit; **do not** activate routines or WhatsApp standing delivery without reviewed grants, durable runs and provider proofs.
4. Record tested SHA, evidence, blockers, lessons and exact next checkpoint in DEV-01 and shared project-control artifacts.

## Lessons

- “Last platform visit” is an activity hint; **last confirmed review** is the coverage boundary.
- “Important” without explainable source evidence is a guess, not an assistant decision.
- A short WhatsApp digest is an external data export, not a harmless notification.
- Time previews are not scheduled jobs. A saved schedule is not authorization to execute arbitrary work.
- User-facing confirmation, fresh mailbox grants, frozen occurrence identities and observable delivery statuses matter more than a glossy dashboard.
