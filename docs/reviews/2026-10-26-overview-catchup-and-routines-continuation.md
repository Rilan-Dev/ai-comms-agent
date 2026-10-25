# Returning-owner Overview: continuation audit

Date: 2026-10-26. Branch: Development. This extends the approved original workspace implementation; it does not replace its in-progress configuration commands or authorize a new configuration-writing AI tool.

## Observed live behavior

Authenticated Overview was reloaded and inspected through the browser. It presents the large marketing headline before business work, three explanatory cards, then organization-wide metrics. The page explicitly says private catch-up is not enabled and AI digest routines are not activated. These are real implementation gaps, not merely labels to remove. The observed unread count was 103 and approvals 2; neither count proves the personal catch-up backlog.

## Existing work to retain

- `docs/superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md` already defines personal absence, immutable manifests, source-linked priorities, separate review/coverage, one routines experience and bounded standing consent. Its original main-branch instructions are superseded by the owner's Development-only instruction.
- `packages/db/src/briefings/` already supplies authorized manifests, source revisions, personal review and resumable coverage. Reuse these records; do not duplicate raw emails or create another summary inbox.
- `apps/worker/src/briefings/briefing-worker.ts` explicitly remains unregistered. Canonical-source loading, trusted principal construction, generation and rollout acceptance must be connected and proved before enabling it.
- `apps/web/src/lib/briefings/config.ts` gates exposure on `BRIEFINGS_ENABLED`. Changing the flag alone would not complete the feature.
- Existing routine timing/consent previews and the scheduler/event evaluator remain the implementation foundation. Preview metadata is not an executable routine or a send grant.
- Existing Gmail sync requests labelAdded/labelRemoved history and persists fetched `is_read`. The adapter can mark read/unread. Actual synchronization lag and expired-history recovery still need acceptance tests.
- Existing IMAP sync reads FLAGS when fetching a message, but incremental discovery selects UIDs above the checkpoint. That path alone does not reconcile Seen changes to already-imported messages. Consequently, claiming that every email read in a provider inbox is excluded would currently be unsupported. Add bounded flag reconciliation before catch-up rollout; do not repeatedly download all MIME bodies.
- `packages/db/src/briefings/coverage.ts` personal selection currently excludes acknowledged source revisions; provider unread-only eligibility needs explicit tests and implementation inspection. Personal review and provider read remain different state transitions.

## Required corrections to the experience

1. Put the personal brief and pending decisions first. Keep fonts, surfaces, spacing system and sidebar. Replace the hero's prominence with a compact greeting and fresh/syncing status. Move create-agent and operational audit details behind appropriate secondary links.
2. Use text plus icons: 🔴 Needs action, 🟡 Worth reviewing, ⚪ For reference. Never rely on color or emoji alone. Show one short reason, sender, date and next action; expand evidence and full text on demand. Unknown classification remains visible rather than becoming low priority.
3. Explain the actual covered scope and date range in one line. No default “all organization mail.” A returning user's backlog is eligible unread, unreviewed source revisions in their allowed scope; old unresolved work gets a separate clearly labelled section.
4. Opening Overview, reading a summary or receiving WhatsApp must not mark mail read. Give individual important items “Mark read” and a separate review action. Low-priority automatic read is a new opt-in provider mutation, not an implicit consequence of priority classification.
5. Use one guided routine flow: choose work, accounts, timing, destination; then review. Keep time and event triggers distinct internally. “Every 24 hours” is elapsed time; “daily at 9 AM” is calendar time in a confirmed timezone. Show both the next run and the covered mail window.

## Live routine preview inspection

The existing link opens `/routines/preview`, not an executable routine. Browser inspection confirms the timing selector is accompanied by daily-time, interval, weekday and exact-instant inputs together, plus a technical IANA timezone text box. That makes the user reason about fields unrelated to the selected rule. Replace this presentation with only the relevant timing inputs and a searchable city/timezone choice with a readable current-zone summary; retain the exact IANA value internally. Prefer a confirmed saved timezone over a silent UTC guess.

The page repeats planning-only caveats in its heading, form, occurrence region and proposed digest section. Keep one clear preview status and a concrete next action. The occurrence region's sentence “Sending email still requires human approval” also conflicts with agents that allow automatic sending; derive sending-mode explanation from actual current policy rather than a global assertion. No preview action or live setting was submitted during this inspection.

## Delivery order and status

Continue original workspace Tasks 5–11. In parallel with documentation, prepare the dependent catch-up extension plan. Implement catch-up source/read-state correctness before the new default dashboard; implement executable in-app routines before external unattended delivery. New mark-read consent and standing send consent remain independent controls. Future RAG configuration assistance remains deferred.

No live provider read state, routine activation, access grant, external send or production deployment was changed by this audit.
