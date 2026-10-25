# Original workspace implementation —26 October2026

Owner approved the original-screen design and instructed proceeding. Plan: [original workspace implementation](../../superpowers/plans/2026-10-26-original-workspace-implementation.md). Base source `2da726dba3a1e4b908cc9fb6a6722136a47e1a7e`; plan recorded as `acfa9ebf`. Native task execution continues in the established isolated Development clone. Main untouched. No product deployment or live configuration change in this checkpoint.

## Initial control/API preservation inventory

| Existing control | Stored field / handler | Current effect and authority | Implementation preservation |
|---|---|---|---|
| Name, multiline Purpose, Slug | AgentDetailClient identity submit → agent PATCH → repository update | Current authorized identity mutation, independent of version JSON | All values/validation remain; editor on demand; new candidate path before reviewed apply. |
| Version JSON/create/history | versions POST and agent_versions | Immutable supplied config, not full settings capture | Legacy history preserved; full baseline/candidates explicitly distinguished. |
| Deploy/Pause | deploy/agent handlers | Owner-authorized deployment pointer/lifecycle | Same authority and explicit effects; complete atomic revision apply, no business action replay. |
| Email presets + individual tools | selectedTools, emailPermissionPresetSelection → policy PATCH | One allowlist, admin consent, expectedPolicy conflict check | One derived selection/custom state; all16 email tools plus2 WhatsApp/4 scheduling tools retained. |
| Autonomous sending | security_policy.autonomous_send | Independent approval mode; current explicit human-review flag restricts it | One authoritative editor; mode never grants tool access; saved value preserved until reviewed change. |
| Allowed/blocked senders and JSON | policy arrays/securityPolicy/rateLimits | Comma-separated list and object validation/persistence; inspected runtime enforcement not proven | Preserve100-entry accepted contract and unknown values; no invented restriction claim/grammar. |
| Email assignment/role | channels PATCH → agent_email_accounts | Upsert exact mailbox+role; primary/read_only/send_only gates independently checked | Multiple primary assignments remain; full reviewed delta and effective access, no duplicate/bulk-atomic fiction. |
| Remove email/WhatsApp | unbind functions → channels PATCH | Immediate mutation today | Staged removal only with real backend support; explicit immediate revoke remains current and recorded. |
| WhatsApp assignment | agent_whatsapp_accounts | One org-scoped bound account; readiness/provider checks separate | Current binding, window/template and recipient restrictions preserved; no silent substitution. |
|16 AI overrides | original AgentAISettingsPanel → ai-settings PUT | Independent current mutation; null inherits; catalogs and custom fields | Original layout/LiveModelSelect retained; all16 fields preserved in revisions and partial-save behavior. |
| Configuration test | simulate POST | Saved prerequisite check, not real provider send | Accurate scoped results; never manufacture delivery/readiness. |
| Activity/technical audit | audit GET | Organization/agent scoped events, bounded page | Retain original detail; derive business outcomes only from authoritative action evidence. |
| Chat/voice/inline draft approvals | Chat stream, shared executor/receipts and provider workers | Authorized tools, current scope, frozen approvals, dispatch reconciliation | Existing paths preserved; interactive UI uses same host authority and operations. |
| Routine planning preview | separate GET-only routine preview/helper | Planning only, not executable task/standing consent | Preserve independent upstream feature gates and local-day/elapsed-interval distinctions. |

Other original routes remain in the26 October audit's project-wide inventory and require their own control inspection before edits; this table is not a claim of complete live inspection across the platform.

## Baseline evidence and new root-cause finding

- Existing preset Node suite:3/3 pass, no skipped/failed cases.
- Existing human directive/draft scope/actual email+WhatsApp handler suites:30/30 pass across3 files; bounded local Vitest execution. These existing cases omit the reported mixed noun-form task.
- Actual exported functions on the exact owner prompt return **draftOnly=true, humanReview=false**. This explains the visible lack of WhatsApp calls: the route filters WhatsApp out under the incorrectly inferred draft-only scope. The separate noun-form review parser also misses the request.
- Task1 adds failing exact-prompt and close-boundary regressions before correction. Do not add a mutation replay workaround for a tool the guard wrongly hid, and do not weaken genuine draft-only executor denials.
- Last verified serving source from the previous repair is4898fa33 on25 October; current serving revision has not been reverified in this new implementation. Previous1,809-test release proof is historical, not this new branch's final acceptance.

No existing theme token, AI layout, account, policy, role, provider or credential changed at this baseline checkpoint.

## Task1 — mixed request guard and review intent

Added regressions using the exact owner prompt, noun/verb approval wording, reverse/no-period forms, quoted/fenced/Subject payloads, negations, genuine email draft restrictions and the actual WhatsApp handler with the host-derived flag under autonomous=true. Observed12 new failures with41 passing controls; corrected both classifiers. A shared affirmative approval-request helper keeps routing and review intent consistent. A narrow direct-WhatsApp object check avoids treating source-email mentions as an email compose task. True draft-only restrictions and executor denials remain intact.

First post-fix pass exposed two request-send-approval wording gaps; added the send qualifier and verified **56/56 focused cases**: draft scope29, human-review22, actual handler5. Existing preset3 cases also remain a separate gate. Shared/db/email-runtime/Clara/worker/web typechecks pass. Changed source lint has0 errors; the existing config ignores the3 test files (reported warnings, not claimed lint coverage). No live request, queue, message or configuration mutation was performed. No theme/AI layout edits. Full branch tests, database/versioning work, browser acceptance and deployment remain outstanding.

## Task2 — Exact mixed review and frozen continuation

Implemented a narrow host route for the owner's exact latest-unread → WhatsApp human-review request. It selects3 total from the existing canonical evidence snapshot, verifies selected mailbox reads through the current registered audited reader, creates an exact15-minute creator/org/agent/conversation-scoped checkpoint in existing content_json, and invokes the registered WhatsApp send workflow once with the original identity and mandatory human review. Other existing request wording remains in the authorized planner rather than silently dropping filters. The displayed text is a bounded factual excerpt summary with local-sync coverage, not invented AI facts. No source is marked read.

The sender is pinned to the assigned phone UUID before saving; labels cannot redirect a continuation. Continuations recheck current source bindings, actor rights and registry/capability authorization, serialize through a database row lock, reconcile the original idempotency key and return terminal or uncertain outcomes without replay. New mail does not replace the frozen body. Missing/expired/revoked checkpoints require refresh. The current Chat endpoint accepts only the saved continuation reference; client body/recipient replacements are ignored. The interactive button is a later Task9 change.

A new route test exposed an inaccurate queued-state sentence: a human-reviewed continuation could be described as automatically approved. Queued feedback now reports the actual queue state without guessing the approval source. This does not change either approval mode.

Evidence: new route tests first failed3/3 against the old endpoint; the queued-approval attribution regression failed1/4, then passed. Registered-mail-read adapter expectation failed1/11 before integration and then passed. New pure task/service/route suites30/30 GREEN. Dedicated loopback aca_repair_test: checkpoint14/14 plus canonical-mail coverage12/12 GREEN, including concurrent continuation, expiration, actor/scope/source revocation, terminal/uncertain non-replay, latest3 across mailboxes, stable order and unchanged unread flags. Source/database/web types and focused checks are recorded in the workspace logs. These are candidate-source tests; this change is not yet deployed or live-accepted.

## Task3 — Coherent capability choices and sending mode

Added a presentation-only effective-policy derivation: presets reflect the actual allowlist (including Custom for individual/unknown email grants); automatic mode grants no missing capability; current actor/account checks remain separate; an explicit human-review request always restricts either sending mode. No extra enabled flags are persisted. All22 registered individual controls and the single autonomous_send editor remain. Preset/WhatsApp/Chat text no longer falsely promises mandatory human approval while automatic sending is enabled. Selected presets are visibly and accessibly marked in the original Agent Policy and Chat permission panels.

Replaced the long comma text fields with editable sender entries, add/remove/paste and a100-entry bound. Saving also includes a still-typed entry; existing individual strings containing literal commas round-trip unchanged. Sender/rate inspection across non-test packages and worker sources again found persistence/types/validation but no proven enforcement consumer. The advanced section therefore describes saved values without claiming they provide an enforced protection. No new sender grammar or enforcement behavior was invented.

Focused effective-policy/preset/sender-render/validation checks32/32 passed. Web types pass; changed-source lint has0errors and one existing Chat history focus-ref cleanup warning. No original AI Settings or theme files changed. No live policy values were changed or deployment performed.

Broader regression verification: all141 Vitest files and1004 tests pass after fixing the one automatic-approval attribution regression. A verified automatic tool receipt now carries approvalSource=agent_policy; a later queue observation without that evidence stays neutral. This preserves existing automatic-send feedback while preventing invented attribution for human-reviewed continuations. Shared/web/worker type checks pass. Candidate changes remain unreleased.
