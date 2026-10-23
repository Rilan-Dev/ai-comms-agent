# AI communications repair and simplification — approved design

Date: 23 October 2026. Status: owner-approved; implementation and release verification are in progress. The evidence below records the initial assessment, not the current release status.

## Intended outcome

A person can ask about their actual inbox, create and edit a draft, review the correct sender/recipient/content, request permission to send, and see the actual result. Unsupported or unauthorized operations clearly explain the next useful step. Technical account IDs, repeated boilerplate and contradictory readiness indicators disappear from ordinary use. Human approval, tenant isolation and provider restrictions remain enforced.

The acceptance target is all 26 scenarios from the private frontend test report (outputs/frontend-ai-test-report.md in the task artifacts), plus security and state-transition regressions needed by the repairs. A blocked delivery prerequisite remains a release blocker; it is never relabelled a passing delivery test.

## Evidence and confidence

Source assessment pinned to main commit `090cb66b07ba2834dc68ad7221faecde8aba07e1`. Current production revision is unknown. The live health response says healthy and PostgreSQL configured, but contains neither revision nor evidence of database/worker readiness.

| Finding | What is established | What remains to prove |
|---|---|---|
| Mailbox address used as UUID | Current source already resolves an address through the organization and agent binding before UUID queries; commit 090cb66 documents the earlier database error. | Whether that revision is running on every web/worker instance, and whether remaining authorization failures have another cause. |
| False/unverifiable action confirmations | Exact current classifier returns false for Create, Update and Prepare email requests. The chat route may use model text when no verified email mutation summary exists. WhatsApp has no equivalent host-owned mutation feedback in that route. | Correlate each live false confirmation to its request/turn and database records; classify no call, failed call, stale result or persistence/reconciliation failure. |
| Email approval failure | Both providers failed in live Compose and AI; Activity showed Email_write_tool_failed. Both paths call createEmailAction. | Actual SQLSTATE, deployed migration ledger, table columns/types/indexes, connection/schema selection, and read-after-write behavior. Do not assert a missing migration without inspection. |
| Detail-sensitive summaries | The exact detailed summary prompt returns null from the current rolling-summary parser; metadata words such as sender/subject can reject a reporting-format request. | Repair request interpretation without stripping real sender, mailbox, unread or date constraints. |
| Duplicate mail records | Live summary repeated a test message; formatter currently prints every returned row. | Determine repeated ingestion versus legitimate separate provider records/folders. Do not deduplicate by subject/body alone. |
| WhatsApp delivery | Real pending proposal persisted; approval was blocked by no recent inbound conversation. No approved template option existed. | Approved template or real inbound-window prerequisite, test-recipient eligibility, then provider status and receipt. |
| UI/reliability | Contradictory WhatsApp readiness, raw ID requests, repetitive follow-ups, one recoverable host 502 and React #418 console entries were observed. | Root cause of host error and hydration mismatch; no causal link to approval failure is established. |

Sixteen selected existing dependency-free tests were executed against retrieved source files: 8 rolling-summary tests and 8 action-feedback behavior tests passed. These are narrow checks, not a full checkout/build/integration result. Additional diagnostic calls reproduced the three classifier omissions and detailed-summary parser miss. The latest commit message reports 45 web and 9 worker baseline failures; those historical totals have not been independently reproduced here and must be replaced with a fresh baseline.

## Recommended approach and alternatives

**Recommendation: repair the existing shared services, then simplify presentation.** Preserve Next.js/React, PostgreSQL, the current provider adapters, worker execution and Clara host boundary. Add failing behavioral/integration tests before each repair. Use one authoritative operation result across AI and manual UI.

A deployment-only refresh is a useful first diagnostic and may resolve already-fixed authorization/rendering issues, but cannot establish correctness of the remaining approval and confirmation flows. A broad rewrite or replacement of the agent platform would add migration and regression risk without evidence that it is necessary. These are assessed alternatives, not owner-selected decisions.

## Behavior and interfaces

### Truthful action results

Use a server-owned discriminated result describing the current operation: channel, operation, turn/call/correlation IDs, resource ID when persisted, state, and a safe error code when failed. States distinguish draft_saved, pending_approval, rejected, expired, queued, provider_accepted, delivered, failed and outcome_unknown. Channels only emit states they actually support; provider_accepted is not delivered.

Existing database statuses may retain their internal names and map to the presentation result. Do not migrate every ledger to new enums for cosmetic consistency. For an email completed result, derive provider acceptance from the executor's persisted result; verify recipient receipt separately. Never manufacture delivered status where the provider cannot supply it.

Mutation claims come from current host results and persisted records, never prior assistant text. A lexical intent classifier improves clarification and presentation but is not an authorization mechanism. No-tool, failed-tool and partially completed turns cannot claim success. Show partial completion explicitly: Draft saved; approval request failed. Offer the saved draft rather than repeating the operation.

### Review and execution

Maintain actor permission AND saved agent permission AND mailbox binding AND provider capability checks. Recheck grants at execution. Approval binds to immutable sender/recipients/subject/body and attachment identities if applicable. Edits invalidate review. Repeated clicks/retries reconcile to the existing operation without duplicate delivery. Unknown provider outcomes require reconciliation, not blind retry. Keep existing policy and approval thresholds; this project does not introduce autonomous sending.

### Inbox evidence

Counts, dates, unread status and pagination come from authorized database queries, not model estimates or old conversation summaries. Exact filters must survive both the simple and tool-driven paths. A request for output columns such as sender/subject is not a sender/subject filter. Explain unsupported filtering and offer clarification rather than returning broad mail as if filtered.

Normalize provider message identity at ingestion and enforce account-scoped idempotency after examining duplicate classes. Preserve legitimate distinct messages across accounts. Return matched, included, hasMore/cursor, applied scope and sync freshness with every report. AI summarizes supported excerpts; missing bodies remain explicit.

### Simplification

- Keep Overview, Chat, Mail, Agents and WhatsApp. Keep advanced administration accessible to authorized administrators; do not delete unrelated features or historical data.
- Chat shows a draft review card and one meaningful next action. No redundant multi-option panel after each response, internal tool names or raw account/message IDs.
- Readiness is computed once from persisted account connection, binding, capabilities and current grants. Loading, unavailable and disconnected are distinct states.
- Keep one draft-review implementation used by Chat and Compose; retain separate manual Compose entry for people who prefer it.
- Keep local-first drafts. Provider synchronization becomes a secondary action with a clear status; synchronization never implies delivery.
- Move granular per-tool switches and sender rules behind Advanced; retain presets and a plain-language permission summary. Do not change saved grants as a side effect of UI cleanup.
- Preserve receipt/error history in an activity detail view. Error text includes a safe reference and actionable reason, without credential, SQL or message-body disclosure.
- Fix table rendering and next-action gating by deploying existing fixes if sufficient; only write additional code after reproducing remaining defects on that revision.
- Pending routine/catch-up/voice work remains under its existing feature gates; it is not removed or activated as part of this repair.

## Work order and release criteria

1. Establish reproducible source/deployment/schema baseline and collect safe diagnostics.
2. Repair approval creation, queue visibility and worker execution; prove against a disposable real database and provider test transports.
3. Repair current-operation confirmations, scope resolution and draft-body extraction.
4. Repair inbox filtering, duplicate identity and coverage.
5. Repair WhatsApp selection/readiness and verify prerequisites; preserve policy failures as expected outcomes.
6. Simplify the reviewed flows and fix error/loading/hydration behavior.
7. Run the full regression suite and all 26 browser cases on the same candidate, then controlled live delivery acceptance.

For a release: all required automated tests, typechecks and build succeed; no test deletions/skips conceal failures; no duplicate send on replay; permissions and tenant tests pass; both email providers produce one authorized test message and verified receipt; WhatsApp has a verified allowed delivery and the expected blocked-window case; no recurring host/hydration failures in the acceptance runs. Record actual test totals, commit/image/migration revisions and provider/receipt references.

## Operational dependencies and scope limits

Implementation requires a real checkout and reviewed dependency installation using the repository's pinned pnpm 12.8.1. The local environment currently has Node 22.23.3 and pnpm 11.25.0; do not regenerate the lockfile with the latter. Obtain host deployment/log access and a disposable database through supported configuration; do not search arbitrary files for secrets. Existing website credentials authorize normal UI testing, not unrestricted infrastructure access.

Use existing live mailboxes and the owner-approved test recipient only for final harmless delivery checks. Use disposable identities/tenants for restricted-role and isolation tests. Never change the real owner's role to create a negative test.

WhatsApp requires either a genuinely received inbound message or an available approved template. Code must not fabricate either prerequisite. Approval expiry/replay, attachments, forwarding, revocation and provider failures belong in the regression matrix even where they were blocked during the first browser run.

## Decisions left to implementation

Choose the smallest shared extraction consistent with existing code; do not introduce a second runtime/framework. Select the next free migration number only if verified schema drift requires a forward migration. Preserve immutable Clara vendor files. Diagnose unrelated full-suite failures individually and expand the plan only with explicit evidence. No estimated pass count is a completion claim.
