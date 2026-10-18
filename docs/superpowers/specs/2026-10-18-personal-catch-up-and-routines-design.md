# Personal email catch-up and assistant-managed routines

**Status:** Proposed design; owner requested this plan and selected scoped, one-time approval for recurring WhatsApp summaries. Product implementation and rollout are separate gates.
**Owner:** DEV-01 / Forge. **Session:** DEV01-CATCHUP-ROUTINES-20261018.
**Baseline:** Initial audit of GitHub main `ba9e948b4b58a4f270d5382f919957843e6eecb5`; concurrent source through `959ff5a6` subsequently integrated and verified separately in the session, 18 October 2026. Phase 4 remains `implementation_in_progress`.

## 1. Goal, people and scope

Help a person understand the mail that matters, decide what to do next, and delegate predictable recurring work without repeatedly opening the platform. Preserve Chat as the main workspace and reuse the existing email, Clara, scheduling, automation and WhatsApp foundations.

| Person / situation | Useful outcome | Avoid |
|---|---|---|
| Everyday user returning after five days | A short, sourced briefing: deadlines, bills, requests and informational mail | A wall of messages or everything marked reviewed on login |
| Employee managing projects | Requests needing a reply, deadlines, unresolved decisions and follow-up reminders | Assuming permission to read colleagues' mail |
| Small business owner | Customer enquiries, overdue replies, order/invoice exceptions and daily phone briefing | Unapproved replies, payments or disclosure of whole mailboxes |
| International business user | Several permitted accounts, local-time routines, preferred language and original-message access | Silently changing schedules when travelling or confusing 24 hours with a calendar day |

MVP delivers personal catch-up plus hourly/daily/weekly/one-off email briefings, with optional WhatsApp delivery to a verified, authorized recipient. Later slices add event-triggered routines and follow-up assistance. Autonomous payments, arbitrary scripts, unrestricted forwarding, employee surveillance and a new voice transport are outside this feature.

## 2. Corrected requirements

**R1 — Sync independently of visits.** Connected mailboxes continue existing background sync while the user is away. Do not wait for five days of inactivity before ingesting mail. Do not create a second store of raw emails; PostgreSQL email records remain canonical.

**R2 — Separate presence, review and delivery.** Record coarse, authenticated foreground activity to explain “last visited”; track briefing coverage and acknowledged items separately. Login, opening Chat, provider read flags, receiving a WhatsApp message and acknowledging a briefing are different events. None implicitly marks provider emails read.

**R3 — Personal progress.** Progress belongs to organization + user + agent/mailbox scope. A colleague opening the platform does not reset another person's backlog. Admin status alone does not grant mailbox content or personal activity access. The feature exposes no inactivity leaderboard.

**R4 — Explainable priority.** Internal levels are high/medium/low. UI groups are “Needs attention”, “Worth reviewing” and “For reference”. Separate priority from suggested action and confidence. Show a short reason, source, deadline when evidenced, and an “Adjust priority” control. Sender rules and user corrections outrank model guesses; uncertainty stays visible.

**R5 — One Routines experience.** A routine combines a trigger, mailbox scope, typed task, destination, limits and authorization. Time-based and event-based triggers share management and execution contracts; they remain distinct trigger types. Extend the existing scheduler/event evaluator rather than adding a competing scheduler.

**R6 — Delegation with an exact boundary.** Owner selected: approve once for selected mailboxes, verified recipients, timing and summary limits; require approval again when these change. This is a narrow standing grant for this digest workflow, not approval for general email/WhatsApp sending. Existing per-message approval remains effective until the new grant schema, UI and dispatch checks are implemented and verified.

**R7 — Real outcomes.** “Created”, “active”, “generated”, “queued”, “provider accepted”, “delivered” and “failed” are separate. The agent may claim success only from the corresponding persisted operation result. Approved Meta templates and application consent solve different requirements; both may be needed.

## 3. Existing implementation and impact

| Existing boundary | Reuse / extension |
|---|---|
| `packages/db/src/email/repository.ts` | Canonical message/thread lookup, pagination and tenant joins; add briefing candidate queries with fresh user/agent/account grants |
| `summaries`, `summary_sources` | Existing derived-output/provenance storage; extend with personal scope, processing status, source revision and coverage, instead of duplicating raw mail |
| `packages/email-agent-runtime/src/` | Shared host tool registry, policy, executor and bounded loop; add summary and routine adapters to the same authorization/audit contract |
| `packages/clara-core/src/runtime.ts` | Existing provider/model resolution and generation; consume behind an injectable briefing adapter; never edit immutable vendor source |
| `packages/db/src/automation/repository.ts` | Existing schedules, rules and run records; extend through typed domain services |
| `apps/worker/src/scheduling/{cron,scheduler-worker}.ts` | Existing firing loop, to be used after FIX-01 correctness/recovery work |
| `apps/worker/src/automation/automation-engine.ts` | Existing event evaluator; new activation blocked until trusted event tenant scoping and trigger compatibility are fixed |
| `apps/worker/src/agent/product-action-executor.ts` | Existing actions; scheduled WhatsApp currently creates pending proposals, not unattended delivery |
| WhatsApp approval API and worker | Preserve general-send approval; add a dedicated, narrowly validated digest-grant path, with send-time Meta and permission rechecks |
| Chat-first shell, `/schedules`, `/automations` | Add Catch up and Routines entry points without undoing recent Chat/Voice/Threads work; retain old routes through compatibility views |

This extends EMAIL-OPS-01 Workstream F / E8 and the existing tool contract. It does not accept Phase 4, close ISS-026, fix HTML sanitizer issue #36 or take over voice issue #26 / OPS-01 deployment work.

Three approaches were considered: a second email-summary inbox (duplicates source and complicates deletion), generating everything only when a user returns (slow and expensive), and incremental derived briefings over canonical mail (recommended). Use background classification/cache plus bounded on-demand aggregation; never precompute every possible user/agent summary on each incoming email.

## 4. Catch-up experience

1. Chat offers “Catch up on my email” and, when known, “You last visited 5 days ago”. It shows the selected agent, mailboxes and sync freshness.
2. First use offers last 1, 7 or 30 days; default 7 days. Custom initial ranges are limited to 90 days per request, with an explicit older-mail continuation. Returning users default to unreviewed eligible mail, not an arbitrary last-20-message prompt.
3. The briefing groups related messages into threads and shows important changes, replies needed, evidenced deadlines and informational groups. Every factual item links to permitted source messages. Counts and considered/missing coverage are visible.
4. Actions: open source, ask a follow-up, draft reply, adjust priority, snooze item, mark selected items reviewed. “Mark this briefing reviewed” requires an explicit action and affects only its complete manifest; partial/failed batches cannot clear unseen items.
5. Leaving midway preserves progress across devices. A new message during review appears in the next batch. New replies to a previously reviewed thread are new work; a harmless metadata-only sync update is not.

Show “Access required — ask your administrator”, “Mailbox needs reconnecting”, “Still syncing: 320 of 800 messages”, “Briefing partially prepared” and “No new mail in this scope” as different states. An AI outage leaves a usable source list and retry; it never produces an empty successful briefing.

Additional planned assistance: “Waiting for a reply”, snoozed follow-ups, VIP sender rules, a daily “three things to do” card, preferred summary language, and simple personal/team-business presets. These remain suggestions; neither inferred identity nor a persona changes permissions. Defer proactive urgent alerts until ordinary digests and rate controls are reliable.

## 5. Catch-up data and generation contract

- Extend `summaries` with owner user, explicit agent/account scope, status, mode, fixed period, scope/content/model versions, selected source manifest and coverage metadata. Derived content is private by default. Preserve legacy org-wide records through explicit compatibility rules; do not make a personal summary readable under the old organization-wide policy.
- Add `user_mail_activity` (only the latest coarse foreground server timestamp, no activity history) and `mail_review_items` (per-user source/relevant-content revision and represented-item state). Activity is throttled to once per 60 seconds while visible and authenticated; passive polling does not count. Remove activity on membership/user deletion. No device fingerprint or attendance scoring.
- Current source primarily scopes mailbox access through organization permissions and agent bindings; it does not establish individual mailbox entitlements for every employee. Add explicit `briefing_mailbox_grants` for this feature and intersect them with active membership, `email.read` and readable agent bindings. Do not backfill access for every organization member. A migration may seed the account creator only where existing `created_by` and active membership prove that relationship; other assignments require an authorized organization administrator and an audit. This feature-specific grant does not silently rewrite older email routes or resolve ISS-026.
- Proposed grant administration permission: `briefing.access.manage`, restricted to active organization owners/admins. `assignBriefingMailboxGrant` checks actor permission plus target active membership and account in the same organization; members cannot grant themselves access. Audit actor, target user/account, old/new scope, reason and timestamp. Policy administration can assign access without displaying mailbox content. External export remains separately controlled by `routine.delivery_policy.manage` (owners/admins), plus the user's explicit digest grant; mailbox access alone does not allow export.
- Extend `summary_sources` with mailbox, source content revision and item metadata. Reuse canonical message body; cache only derived text/evidence needed for the briefing. Tie all links and storage to compound organization/user/agent scope and validate access on every read.
- Capture an immutable set of eligible persisted source IDs at selection time. Personal catch-up selects unreviewed source revisions using an indexed anti-join; scheduled selection uses the distinct routine coverage contract in section 7. Do not use a single received-at/ingestion-time cutoff that can lose late or concurrently committed mail. A late arrival remains eligible for the next manifest and is labelled with its original mail date and late sync context.
- Every list/detail/tool/cache read revalidates all sources contributing to the returned derived text. If any source is deleted, content-changed or no longer permitted, suppress the affected item and any mixed aggregation before responding; return only non-sensitive invalidation status and regenerate from remaining permitted sources. Counts, titles and excerpts cannot leak denied sources. Historical review status is not a permission grant. No notification cache may bypass revocation. Repeat checks immediately before dispatch; already-submitted external content cannot be recalled.
- Paginate candidate reads at 200 messages. Process at most 50 messages or 12,000 estimated input tokens per model batch, whichever is reached first, with at most 2 concurrent batches per organization. A batch limit is a continuation boundary, not permission to omit remaining messages. Oversized messages are explicitly partial with a source link.
- Cache by organization, effective scope/grant version, source content hashes, requested language, model and prompt/schema versions. Never share personal output across tenants/users with different effective grants.
- Validate model output against a structured schema: source IDs must be in the manifest; each factual deadline/amount and priority reason carries source revision plus an exact supporting span. Validate span bounds/text deterministically; this alone does not prove interpretation. Unsupported dates/amounts or conflicting/locale-ambiguous evidence are withheld as facts and shown as uncertainty with source access. Content is untrusted data, never instructions to add recipients/tools. Human evaluation checks interpretation and whether later replies supersede quoted claims.
- Persist generation work with reclaimable leases and idempotency; restart resumes unfinished batches. Acknowledge only persisted, fully represented items. Retention for derived briefing text defaults to 30 days; review checkpoints persist so expiry does not resurrect reviewed mail. OPS-01 reviews retention/job execution; current source message retention remains unchanged.
- Review tracks stable represented item IDs as well as source revision. A source revision becomes fully reviewed only when all extracted items are acknowledged and representation is complete. Reviewing one of two obligations cannot clear the other; partial oversized content cannot be cleared by a blanket briefing acknowledgement. Reconcile overlapping manifests to stable persisted item IDs rather than model array positions. Snooze stores a confirmed UTC `snoozedUntil`, displays the chosen zone, does not acknowledge the item and reappears when due without new mail; it affects personal presentation only, not routine delivery.

## 6. Routines and natural-language management

Example: “Every day at 9 AM summarize important emails and send them to my WhatsApp.”

The assistant resolves permitted mailboxes, asks only for genuinely missing time zone or recipient, and prepares a review card: task, mailbox scope, local schedule/timezone, next three occurrences, reporting window, sender account, recipient, content limits, empty-result behavior and approval boundary. Nothing is activated from model text alone. The user confirms a server-stored, revisioned proposal. The UI and AI call the same domain service.

Commands: create/propose, list, show details/history, edit, pause, resume, cancel, preview. Ambiguous “cancel that one” must select a unique routine; it cannot cancel all. Preview generates a sample without delivery. Pause/cancel invalidates future execution and cancels claimed work before the serialized provider-submission boundary. If submission has already begun, show “Already submitting; future sends stopped”; do not promise recall. Pause suspends use of the grant; resume can reuse an unexpired, unrevoked grant for the unchanged confirmed configuration after fresh checks. Cancel revokes the grant. Changed scope/recipient/timing/limits, expired grants or changed applicable policy require reconfirmation.

UI: one Routines list with “On a schedule” and “When something happens” filters. Use hour/day/week/date controls and plain language; raw cron/JSON is advanced-only. Each card shows next run in the saved zone, last actual outcome, destination and Pause. Details expose run history and recovery without making the user read infrastructure logs.

Typed tasks in MVP: `email_digest` plus `in_app` or `whatsapp_digest` delivery. Event-triggered draft proposals and notifications follow later. Arbitrary code, SQL, URLs, dynamic model-chosen recipients and unrestricted action arrays are not accepted.

## 7. Time, execution and failure semantics

| Condition | Proposed contract |
|---|---|
| Daily 09:00 | Calendar time in a confirmed IANA zone; travel/browser zone changes do not move it |
| Every 24 hours | Elapsed interval anchored to a UTC instant; differs from daily local time across DST |
| Weekly / one-off | Explicit weekday+local time or exact local date+zone, converted once and previewed; reject ambiguous offset-less input |
| DST gap | Skip nonexistent local occurrence and record the reason; preview warns when affected |
| DST repeated hour | Run once at the first matching instant, show its offset in preview |
| Reporting window | Default since previous intended occurrence, half-open `[start,end)`; offer fixed previous 24 hours and previous local calendar day explicitly |
| Retry | Reuse occurrence ID, fixed window, manifest and routine revision; retry time never changes summarized scope |
| Missed fires | Coalesce within selected grace (default 60 minutes, maximum 10,080); no burst of old phone notifications. Outside grace record missed; keep uncovered mail eligible for the next permitted summary |
| Empty result | Skip external delivery by default; record “No matching new mail”. User can opt into a short check-in within the grant |
| Quiet hours | Optional and explicit; coalesce into the next permitted instant. Persist `eligibleAt`; deliberate quiet-hour deferral gets a deadline of `eligibleAt + grace`, not original fire + grace. Freeze the combined reporting range at eligibility, then recheck grant/provider window. Processing delays after eligibility consume this grace |
| Concurrency / crash | Durable occurrence key, 120-second renewable lease, heartbeat every 30 seconds, attempts and transactional outbox; conditional updates check the current revision/status |
| Transient failures | Three total attempts with 30-second then 120-second delays, within the remaining grace; expired/revoked permissions do not retry |
| Limits | Time-based MVP minimum cadence 60 minutes; event routines debounce for 15 minutes; preserve domain limit of 100 runs per organization/hour |

Add a common `routine_definitions` identity/revision/owner record linked to existing scheduled jobs or automation rules. Keep their existing run ledgers and worker entry points; expose a unified run view, not a second scheduler. Existing schedules/rules remain compatible and receive no new delivery consent automatically.

Generation and delivery each have separate durable status and coverage, isolated by routine plus effective mailbox-scope key, never by personal review. `since_previous_occurrence` includes the fixed intended window plus eligible older revisions not covered by a completed routine briefing, labelled as catch-up/late arrivals. Generation coverage advances only on complete persisted output; failed/partial work remains eligible. Delivery uses its own output/attempt ledger: generated but blocked/failed/unknown output remains visible for recovery, and is not silently regenerated or resent as new late mail. Provider-accepted or unknown submissions are never automatically repeated as catch-up.

Explicit `previous_24_hours`/`previous_local_day` windows can overlap; show that repeated source coverage is intentional for those modes. Two routines never advance each other's coverage; personal review never suppresses scheduled mail, and generated/delivered digests never acknowledge personal mail. Revision edits preserve coverage only when the effective mailbox-scope key is unchanged; scope changes establish a fresh explicit starting window without borrowing another scope's ledger. Cancel/edit must not be undone by a stale worker finishing an earlier revision.

## 8. Scoped WhatsApp digest authorization

The accepted product requirement is one approval per exact routine version. Persist a grant binding organization, granting user, agent, allowed mailbox IDs, permitted task/content class, sending WhatsApp account, verified recipient, trigger/timezone/reporting window, quiet hours/empty behavior, template identifiers, max content/frequency, policy version, expiry and revocation.

The normalized proposal includes delivery mode, template ID/name/language, provider-resolved content hash and parameter-schema hash. A changed template under the same name requires reconfirmation. If no template is selected, state explicitly that delivery outside the service window will be blocked; do not choose a new template after confirmation.

- Initial external delivery is only to a verified recipient associated with the consenting user and allowed by organization policy. Verification is not proof of authorization to export corporate mail; check that separately. An organization-approved shared/business recipient can be a later explicit grant, not a model guess.
- Sender business account and destination phone are different concepts and clearly labelled. Neither is inferred from an email body.
- Proposed grant lifetime: 90 days, renewable through explicit confirmation; expiry is visible and stops delivery. Changes to any listed scope/timing/content/destination field invalidate the existing grant. Pause suspends future execution; cancel revokes the grant, subject to the already-submitting boundary above. Membership, binding or policy changes invalidate it at use.
- Before generation and again immediately before dispatch, recheck active user membership, current mailbox/agent read grants, external-digest permission, recipient policy, agent/channel status, exact revision/hash, rate limits and grant validity. Never retain the user's browser session token in a background job.
- Default external content: priority counts, short summaries, evidenced deadlines and authenticated source links; no full bodies, attachments, passwords/OTP or sensitive account identifiers. App content limit: 1,000 Unicode code points; the fully rendered message must also meet the selected provider/template constraints. Limits may be lowered by organization policy and are part of consent.
- Add a dedicated `routine_digest` authorization record on the existing WhatsApp send-action path. The general `whatsapp.send` tool remains proposal-only. A pending general send cannot gain authority by adding a routine ID. Generation output is validated and immutable before authorized dispatch.
- Outside Meta's inbound 24-hour window, require a currently approved compatible template and valid recipient/opt-in policy. Consent does not open that window. If the template is unavailable, store `blocked_template`, retain the in-app briefing and show a repair action; never fall back to an unauthorized free-form send.
- Outbox uniqueness is occurrence + routine revision + destination. Provider timeout after submission becomes `delivery_unknown`; reconcile using available provider identifiers/status, and do not blindly resend. Application idempotency does not justify an exactly-once external-delivery claim.
- Store provider accepted/delivered/read/failed outcomes as available; missing callbacks remain unknown. None is an acknowledgement that the user reviewed all email.

Proposed permissions: retain `email.read` plus actual mailbox grants for briefings; add `routine.read`, `routine.write`, `routine.digest_delivery`. Members manage their own routines only; admins manage organization policy without acquiring mailbox content. Viewer access is read-only and still source-scoped. Effective external delivery additionally requires existing WhatsApp permission and an explicit organization policy allowing that user's selected recipient/content scope. Forward-only schema/RLS and application permission changes land together before exposure.

## 9. Delivery phases and release gates

| Phase | DEV-01 deliverable | Required dependency / exit |
|---|---|---|
| C1 | Personal activity/review/coverage contracts and authorized candidate selection | Cross-user/agent/account negative tests; existing ISS-026 gating retained |
| C2 | Resumable sourced briefing generation and priority correction | Five-day/large-backlog/late-arrival/restart/partial-failure behavior proved |
| C3 | Catch up in Chat with accessible source cards and resume/review controls | Authenticated desktop/mobile/keyboard acceptance; no provider read-state mutation |
| R1 | Typed Routines facade over existing scheduler/rules, preview and controls | FIX-01 scheduler and tenant-isolation handoffs resolved before execution exposure |
| R2 | Conversational routine tools and fixed-window in-app digests | Same services as UI; no speculative creation; DST/retry/revocation tests |
| R3 | Explicit standing grants and template-compatible WhatsApp delivery | Grant/race/provider-window tests, OPS-01 sandbox, real approved test-recipient delivery |
| R4 | Event routines, follow-up/VIP controls and usability refinement | Tenant-safe canonical events, loop/rate control, pilot usability evidence |

Work can proceed on pure contracts, selection logic and UI states while FIX-01/OPS-01 resolve independent prerequisites. Do not enable unattended actions or vector retrieval as a workaround. Rollout flags: `catch_up_briefings`, `routine_management`, `routine_digest_delivery`, initially off; org can disable execution, revoke grants and retain run history without deleting source mail. Add these flags to the existing server-side product configuration boundary during implementation, not browser-only switches.

## 10. Acceptance matrix

| ID | Scenario | Required observable result | Phase |
|---|---|---|---|
| CU01 | User absent five days; colleague opens app | Personal backlog unchanged; dated briefing covers permitted mail | C1–C3 |
| CU02 | Two devices, partial review, refresh | Same coverage; reviewed items stay done; unreviewed items remain | C1–C3 |
| CU03 | Mail arrives late or commits during generation | Appears exactly as eligible work in next manifest, no timestamp gap | C1–C2 |
| CU04 | 5,000 messages, long threads, multilingual content | Bounded paged batches; no hidden truncation; resume after failure | C2 |
| CU05 | Deleted source, revoked binding, other user's summary ID | No stale/private content returned; invalidated output is regenerated safely | C1–C3 |
| CU06 | Email instructs AI to send secrets/change routine | No new authority or action; safe source-only interpretation | C2/R2 |
| CU07 | Misclassified bill, uncertain deadline, sender impersonation | Reason/evidence, correction and uncertainty; no invented payment instruction | C2–C3 |
| CU08 | Initial history import or mailbox reconnect | Explicit history/freshness warning; not a claim of new or complete mail | C1–C3 |
| RT01 | Create “daily 9 AM”, “every 24 hours”, weekly and one-off | Correct distinct next-three previews and first fire | R1 |
| RT02 | DST gap/repeated hour, travel, midnight/year boundary | Saved-zone policy holds; no duplicate occurrence | R1 |
| RT03 | Duplicate event/fire, worker crash after claim | Lease recovery; one durable occurrence and bounded attempts | R1–R2 |
| RT04 | Pause/edit/revoke during generation or dispatch | If revoke wins submission boundary, no send; otherwise “already submitting”, no later send or reactivation | R1–R3 |
| RT05 | Event from organization A matches B's rule | No B run, payload, count or generated output | R1/R4 |
| RT06 | User previews or model claims it created a task | No activation/delivery without persisted confirmed operation | R1–R2 |
| WA01 | Same grant, verified recipient, valid permissions | Scheduled approved digest can deliver without opening app | R3 |
| WA02 | Recipient/scope/timing/limits/template changes | Previous grant unusable; clear reconfirmation required | R3 |
| WA03 | Template rejected/window closes after generation | Blocked with in-app copy; no unauthorized text fallback | R3 |
| WA04 | Provider accepts then connection drops; repeated callback | Unknown reconciled where possible; no blind duplicate or false delivered state | R3 |
| WA05 | Membership removed/phone changes/grant expires | Dispatch denied even when generation previously succeeded | R3 |
| UX01 | 320/390/768/1440px, keyboard, 200% zoom | Understandable controls, focus management, readable cards and recovery | C3/R4 |
| UX02 | Empty, loading, stale, offline, denied, partial, failed | Distinct truthful states with a useful next action | All |

Pilot acceptance: five representative users, at least four complete catch-up and routine setup without help; zero observed unauthorized disclosures or sends; all mandatory security/concurrency tests pass. Evaluate 100 seeded email scenarios with expected sources/actions: target at least 90% useful priority grouping; mandatory fixtures permit zero fabricated sources, unsupported factual dates/amounts or missed tested revocations. Report source-support rate separately and investigate every unsupported factual claim before pilot acceptance; an aggregate score cannot waive critical errors. These are proposed targets, not current measured results. Record generation/provider latency and cost per 100 messages before setting a production SLO.

## 11. Plans, ownership and verification boundary

Implementation plans: [Catch up](../plans/2026-10-18-personal-mail-catch-up.md) and [Routines](../plans/2026-10-18-assistant-routines-and-digests.md). Both are proposed, task-sized plans for review; neither activates a feature.

FIX-01 owns the newly recorded scheduler correctness/recovery and automation tenant/trigger-contract defects, plus existing ISS-026/#36/#26. OPS-01 owns isolated infrastructure, migration execution, credentials, provider/template setup and deployment. DEV-01 owns feature contracts, application services, UI, regression coverage and product evidence.

Current-baseline verification is recorded in the session, not inferred from source presence. No new feature tests can be reported as passed before implementation. Recheck current main and migration filenames before starting each slice; preserve concurrent agent work and historical ledgers.
