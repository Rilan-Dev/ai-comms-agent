# Gated catch-up and reply release candidate

This continues the owner's approved returning-owner plan on Development. It does not close the whole plan or declare live email, WhatsApp or catch-up acceptance.

## Changes

- Existing immutable briefing jobs now drive a bounded, gated background worker. Persisted owner/organization/agent identities are reauthorized at claim, canonical loading and publication. Expired leases resume; deferred scopes cannot indefinitely occupy the first queue positions.
- Original Overview mounts concise priority cards before setup and organization metrics when the existing rollout flag is enabled. Personal grants and readable agent bindings determine choices; a unique eligible agent starts automatically. Multiple agents require a choice. An authorized administrator can explicitly assign their current bound inboxes through the existing audited grant API; ordinary readers receive no grant-management shortcut.
- Individual review, original-source links, retries, asynchronous scope cancellation and incomplete/unavailable states use the existing briefing service. Foreground presence has a separate same-origin API, server timestamps and visible-page throttling. Passive summary polling never writes presence or personal review. An obsolete grant to a deleted mailbox cannot block current foreground tracking.
- First automatic selection includes older scoped unread mail instead of silently discarding a ten-day absence at the earlier seven-day preview boundary. Explicit manual lookback controls remain available.
- Fixed email tool workflow instructions now reach the actual provider as trusted application rules. Profile, email and retrieved context remain untrusted. Draft/send tools, actor permissions and saved approval rules still authorize every operation. This corrects the prior classification of reply guidance as non-instructional data; it does not bypass provider content filters.
- Native tool completions have an absolute 60-second deadline over headers and streaming body. Caller cancellation reaches fetch and is checked before host tool invocation; late decisions are discarded without replay.
- Three stale script-test references were aligned with the upstream agent-core rename. Applied migrations remain byte-identical to the live baseline; new changes use 0058/0059/0060.

## Evidence

Observed failing tests preceded the metadata, old-grant, ten-day selection, dispatcher, card, foreground, reply-wire and deadline changes. Current checks passed: six package type checks, changed source lint, migration declarations/structure, 115 PostgreSQL application tests, 164 Vitest files / 1148 tests, 388 worker tests, and 415 standalone tests. The historical negative Git fixture is unavailable in the source-only container; all three corresponding integrity tests passed separately in the real checkout. Real disposable PostgreSQL briefing selection tests25 and metadata reconciliation tests9 passed separately.

Direct Chrome tested the actual Overview controller against explicitly fictional local HTTP fixtures: automatic preparation without a prompt, individual review followed by refresh, canonical source navigation, explicit multiple-agent selection and the original-theme mobile layout. A separate clickable card preview exercised returning, caught-up, syncing, unavailable and no-agent states. These are UI checks, not live provider acceptance. Preview assets and logs remain outside Git.

## Whole-change review and activation gate

A fresh read-only reviewer found one activation defect: a historical metadata sweep lasting over five minutes can never satisfy the universal five-minute mailbox freshness gate, because its timestamp correctly records the earliest observation. Normal sync delays make this reproducible on larger imports. Replacing that timestamp with completion time would falsely report old observations as fresh.

Deployment with BRIEFINGS_ENABLED off is permitted by that review; general activation is blocked. Metadata reconciliation itself now also respects that flag, preserving the existing Inbox's local read-state controls while the provider write workflow is unfinished. Do not enable the feature merely because unit tests pass or the sample inbox is small. The correction plan is docs/superpowers/plans/2026-10-27-source-verification-activation-fix.md.

Remaining work: per-source freshness and bounded display coverage, canonical duplicate-folder handling, explicit provider mark-read/optional scoped low-priority rule, original routine execution/coverage and scoped WhatsApp delivery, plus live reply/provider/browser acceptance. Saved Sarvam settings remain unchanged; the owner's temporary Gemini testing consent does not authorize leaving a different provider saved.
