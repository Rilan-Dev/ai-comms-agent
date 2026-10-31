# Original-screen UX corrections and control audit

26 October2026. This records the owner's eight browser comments as requirements for the **original application**, not just the prototype. Preserve the current theme, existing business functions and all seven agent tabs. The previous prototype is not evidence that its controls work in production. No product source, settings or deployment was changed by this audit.

## Apply the eight comments

| Comment | Required original-screen change | Preservation / verification |
|---|---|---|
|1. Rarely edited Agent details wastes space | Show a compact identity summary; open Name, multiline Purpose and Slug only through Edit details. Keep existing validation and Save. No expanded identity form on ordinary visits. | Opening/closing edit never mutates data; preserve cancel, unsaved edits and all three fields. |
|2. Frequent information is buried | Make agent Overview an operational dashboard within the current look: needs-attention/reviews first, then current work/outcomes and frequent actions; configuration below/on demand. Show setup coaching only for missing prerequisites. | Use real authorized agent-scoped data; loading/unknown is not0 or Ready. Do not invent unread, urgent or reply-needed counts. |
|3. Every change has history, versions and rollout/restore | Extend configuration history beyond existing version JSON. Show active versus draft, before/after, author/time, validation and restore-to-new-revision. Future AI must use the same governed operations. | This is backend work, not a UI-only promise. Owner selected Save draft → Review changes → Apply/deploy, with immediate recorded access revocation. No generic AI setup executor is built now. |
|4. Multiple inputs need proper help | Explain each field's purpose, whether required, how many entries are supported and what an empty value means. Use add/remove chips or rows for existing list values, retaining custom-value access. Advanced JSON stays available with validated help. | Preserve existing accepted values. Do not invent new sender/rate-limit semantics or silently broaden validation. Verify enforcement before advertising a protection. |
|5. Sending controls appear duplicated | Separate capability (may create an outgoing request) from mode (must that request wait for human review?). One authoritative sending-mode editor; tool controls must not appear to toggle the same setting. | Preserve tool allowlist and autonomous policy as separate backend checks; explicit human-review requests restrict either mode. |
|6. Presets may conflict with checkboxes | Presets are convenience edits to the same allowedTools set. Derive their display from that set; individual edits recompute preset/Custom. No separately saved high-level enable flag. | Bidirectional mapping, custom subsets, unknown tools, off behavior and dirty-state tests. No silent permission additions. |
|7. Account UI must reflect real behavior | Each existing assignment has its role and effective use; role changes identify the exact mailbox. Explain assignment versus provider connection. Add/update/remove needs an accurate review and save model. | Current API mutates assignments; keep tenant, connected-status, role, multiple-mailbox and single-WhatsApp checks. Stage changes only if the backend actually supports reviewed application. |
|8. Original AI Settings looks better | **Retain the original AgentAISettingsPanel layout and component structure.** Remove the mockup's generic replacement form from the implementation proposal. Add help/feedback within that layout only where useful. | All16 settings, LiveModelSelect, provider choices, inheritance/null semantics, loading/error behavior and existing custom-value paths survive. No automatic model replacement. |

## Original source findings

### Capability, mode and presets are different concepts

`apps/web/src/lib/agents/email-permission-presets.ts` already maps read/draft/approval/off to the same registered email-tool set, preserving unrelated tools. `AgentDetailClient` uses the same selectedTools state for presets and individual checkboxes. That is a sound basis; adding another independent Email/WhatsApp/Scheduled enabled boolean would introduce conflicts and is not proposed.

The current preset/tool copy is misleading under autonomous mode: Request sending says never auto-send, and permission confirmation says sending still requires human approval. The actual autonomous policy can approve eligible requests automatically. Fix labels and effective-state explanations; do not remove send-request permission as if it duplicates mode.

| Current authority | Required visible outcome |
|---|---|
| Send-request tool disabled, any mode | No outgoing request permitted; mode alone grants nothing. |
| Tool enabled, review mode | Allowed request stays pending until separate authorized approval. |
| Tool enabled, automatic mode | Eligible request may be approved/dispatched automatically, subject to all current checks. |
| Explicit current request for human review, either mode | Request stays pending; include the owner's exact noun-form approval request in regression coverage. |
| User access, account binding, provider capability or Meta prerequisite invalid | Denied/blocked; no unauthorized queue or dispatch. |

Presets are not access roles, account assignments or delivery consent. The mode selector edits only the existing autonomous_send key; the existing editor already makes that control authoritative over the same key in custom JSON. Show a read-only explanation there rather than another editable switch. Preserve other custom JSON keys.

### Channels: current behavior is immediate and role-specific

`AgentDetailClient.unbindEmail` and `unbindWhatsApp` immediately PATCH the channels endpoint. They are not staged for Save channels. `saveChannels` sends selected account IDs and an email role; the repository upserts the exact `(agent, mailbox)` assignment. Do not show an unapplied removal badge or claim rollback without new persistence to support it.

Runtime `canUseEmailAccountBinding` permits email.read for primary/read_only and email.write for primary/send_only. Primary is not a grant to ignore user permissions or agent tools. Two primary assignments are valid; do not silently reduce them to one. A role change is an update of the selected existing assignment, not a second duplicate account. Multiple selections must map to a reviewed list of actual operations; the current endpoint is not a bulk atomic transaction merely because the UI displays multiple rows.

Email assignment checks connected status. WhatsApp binding repository verifies organization/account identity, while current readiness separately handles connection/provider conditions. Audit all paths before showing the same unconditional Connected/Ready promise. Keep unavailable assignments visible with a repair action instead of hiding them or substituting another account.

### Sender lists and custom policy need enforcement verification

The current form splits allowedSenders and blockedSenders by comma, trims values and submits arrays. Validation accepts up to100 non-empty strings; it does not define a strict address/domain/pattern grammar. Use chip/list editing with a short example and an accessible add/remove action, preserving current values and round-trip behavior. Do not label domains or wildcards as supported until their semantics are verified.

Search across inspected non-test app/package TypeScript found allowedSenders/blockedSenders and rateLimits in domain types, validation and repository persistence, but no runtime enforcement consumer. This is an **unverified implementation gap**, not a proven claim that every possible enforcement path was tested. Inspect worker/dispatch and integration paths and add behavioral tests. Until proven, do not tell a business owner these stored values actively protect delivery, and do not invent new enforcement meaning without reviewing the original intended rule.

### Existing Versions is not complete configuration rollback

`PostgresAgentRepository.createVersion` stores a supplied immutable config object. Deploy selects a version and writes deployment/current-version pointers. Identity update, policy update, channel binding and AI settings have separate mutation paths. Deploy does not restore all those values from a historical snapshot.

Consequently Versions currently cannot truthfully promise full rollback of policy, bindings and all16 AI settings. Audit events alone are not complete restorable snapshots. A cross-section release must define immutable configuration schema, dependencies, current-authority checks, concurrent-change conflicts and application/restore behavior. Changing organization defaults can alter inherited agent values; a revision must show/pin/revalidate those dependencies rather than promise identical behavior from a historical null alone.

Configuration history records each successful saved mutation with an attributable diff; validation failures and unsaved keystrokes do not become deployed configuration. Business actions retain their own immutable audit/approval/delivery history. Restoring settings never replays a sent message, undoes provider delivery, restores a revoked credential by copying a secret, or automatically runs missed schedules.

## Operational dashboard ordering

Use the following priority throughout the original project, in the existing visual system:

1. **Act now:** pending authorized reviews, failed/uncertain operations, broken required connections. Each has a concrete next action.
2. **Current work:** actual unread/local synchronization scope, recent task outcomes, next authorized scheduled run where available. Distinguish agent scope from workspace totals.
3. **Frequent action:** Chat and relevant task shortcuts, requiring only missing information.
4. **State summary:** current sending mode, account assignments, active configuration and unsaved draft state.
5. **Rare configuration:** identity editing, technical JSON and seldom changed settings opened on demand, without deleting or concealing the route to them.

This is a priority framework, not identical cards on every page. No generic marketing hero, permanent setup checklist for a fully configured assistant, repeated rare-edit form, fabricated urgency score or new theme.

## Project-wide application map

The agent's seven tabs were inspected live in the prior audit. The following is an **original-route/source inventory**, not a claim that every page has now had a complete live usability test:

| Original area | Primary job to foreground | Rare/details behavior |
|---|---|---|
| Overview / catch-up | Needs attention and current authorized work | Setup/configuration secondary; existing preview-only routines remain gated. |
| Chat / AI voice | Finish the user's task, clarify only missing choices, exact inline review | Keep source/coverage/technical detail expandable and current voice behavior intact. |
| Agents list / new / detail | Assistant purpose, status, next useful action | Identity editing on demand; preserve create, pause, seven tabs and all operations. |
| Mail Inbox / threads / thread | Triage/read/reply with current scoped filters | Preserve unread state, threading, synchronization and detailed message access. |
| Mail Drafts / Compose / Approvals | Edit, exact sender/recipient/body review, authorize or reject | Preserve attachments, frozen snapshots, expiry and uncertain-outcome safeguards. |
| Accounts / WhatsApp | Connection/action state and message/review outcomes | Provider credentials/setup only when needed; never simulate external success. |
| Scheduled AI Agent / legacy schedule routes | Existing jobs, next run, status and edit/pause/archive | Preserve trigger semantics, consent, idempotency and route redirects. |
| Routine preview | Preview choices and exact remaining consent gaps | Remains planning-only; no implicit schedule or standing delivery activation. |
| Knowledge | Current sources/index state and permitted management | Preserve existing RAG/provider choices; future configuration assistant is not enabled. |
| Activity / Audit / Operations | Actual outcomes, failures and trustworthy checks | Full technical history remains available; no read call is a delivery receipt. |
| Settings / AI Provider Setup / initial setup | Effective state and the specific required change | Keep the original successful layouts; secrets remain in secure forms and out of revision payloads. |

Each area requires a function inventory, control-to-handler/API mapping, evidence-backed critique and focused regression/browser checks before its source is changed. Do not apply a blanket card-removal transformation across the app.

## Delivery boundaries and original-code acceptance

- First: functional regressions for the reported mixed task and explicit approval wording; eliminate misleading duplicate-control descriptions and prove presets/tool state mapping.
- Then: agent dashboard priority and on-demand identity, original AI panel retained, accurate channels operations/help, improved existing Chat review/recovery.
- Configuration versioning is a backend workstream with a separate schema/activation review; do not label the current JSON-only history as complete rollback. Owner selected Save draft → Review changes → Apply/deploy. The linked26 October design addendum defines this lifecycle; its written approval remains pending.
- Apply the same frequency/importance principle to other original pages in measured increments, preserving every business control. No new design system or rewrite.
- Before completion: source-to-control inventory has no missing function; authorization and negative-path tests pass; real scopes/counts are verified; model defaults/custom JSON survive round-trip; fresh browser/mobile/keyboard checks pass; migration/backup/deployment gates apply to any backend versioning change.
- Future Helping Chat Agent receives the same typed preview/validate/apply/history operations, not separate privileged mutation paths. RAG may explain help; retrieved content never grants authority. Actual conversational platform configuration remains deferred as requested.

## Bounded verification

Ran the existing original-source test file with node --experimental-strip-types --test apps/web/tests/email-permission-presets.test.mjs: **3/3 passed**, no failures/skips. This covers preset membership, preservation/replacement and existing consent/administrator source contracts. It does not prove full runtime conflict behavior, sender/rate-limit enforcement, new configuration versioning or redesigned screens. No product code or settings changed. Revised design builder check returned nothing important left; remaining source/caller/enforcement inventories belong in implementation planning.
