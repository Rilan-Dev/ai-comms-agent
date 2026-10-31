# Business-owner assistant workspace

**26 October owner-feedback precedence:** [Original-screen priority and versioning addendum](2026-10-26-original-screen-priority-and-versioning-addendum.md) supersedes conflicting details here. Apply the comments to original source: operational dashboard first, identity editing on demand, original AI Settings layout retained, consistent capability/mode controls, and owner-selected Save draft → Review → Apply/deploy configuration history. The earlier mockup is illustrative and is not evidence of working source behavior or approval of a replacement AI form.

Status: **proposed design, awaiting owner approval; no product implementation authorized by this document alone**. Owner clarified on25 October2026: preserve the current look/theme and every business function; improve usability in place, including interactive Chat. This supersedes the earlier four-tab visual redesign. Development is the integration branch; main remains untouched. This is a scoped in-place usability improvement, not closure or advancement of the overall project phase.

## Intent and evidence

Let an owner with no platform or technical knowledge understand what their assistant can do, connect the accounts it needs, use it and review outcomes with little typing or reading. Existing access controls and business operations must remain intact. Reduce unnecessary decisions, not information necessary for informed consent.

The [screen audit](../../reviews/2026-10-25-business-owner-agent-ux-audit.md) records all seven inspected tabs, specific contradictions, model-catalog mismatch and the failed mixed email/WhatsApp case. Its evidence distinguishes facts, hypotheses and historical acceptance. The present change cannot be called merely cosmetic: the reported workflow and natural approval wording need functional regressions.

The [standalone interactive mockup](../mockups/2026-10-25-business-owner-workspace.html) now illustrates the in-place, current-theme approach. It uses the existing globals.css root theme values and fonts, all seven tabs and a current-style Chat example; fictional messages and simulated states call no production API. Walkthroughs checked a summary review, editing with approval blocked until saved, same-summary partial continuation, all seven mobile section options and320/390 document fit. Captured browser errors: none. Advanced field groups remain in their original tabs. Full production function preservation still requires the inventory and implementation regressions below.

## Binding owner constraints and chosen approach

**Preserve the current visual identity and every business function.** Reuse the existing DM Sans/Space Grotesk typography, theme variables, neutral backgrounds, black primary buttons, radius, borders, sidebar, page frame and established components. No replacement theme, marketing-style dashboard, new brand treatment or global navigation redesign. The previous green-accent four-tab concept is superseded, not approved for implementation.

Keep the original seven agent tabs and routes: Overview, Versions, Policy, Channels, AI Settings, Test and Activity. Improve each in place. Technical options can use clearer grouping/disclosure inside their existing tab, but cannot be deleted, moved out of reach or replaced by a simplified control that cannot express existing settings. This approach follows the owner's explicit correction; another new visual architecture would not meet it.

Simplify interaction rather than functionality: show a short purpose, existing saved state, a choice or validated picker where available, and the consequence before applying a change. Keep precise detail on demand. Reuse known values only when already saved or uniquely determined, and visibly show them. Never infer new permissions, a recipient, provider choice or sending mode to reduce clicks.

## Scope and non-goals

In scope: in-place agent forms/navigation assistance, concise explanations, guided choices, business-readable outcomes, existing Chat's interactive task/review cards, explicit human-review wording and the mixed unread-summary/WhatsApp approval flow. Address the linked connection handoff only where needed; do not redesign every platform page in this release.

Preserve global Chat, email, WhatsApp, scheduling and administrative routes and all operations, provider choices, restrictions and custom configuration. No database reset, feature deletion, new provider, model replacement, theme change, Clara replacement, account-grant expansion, automated external Meta setup or new workflow builder. Future RAG/configuration execution is not built or activated now.

## In-place screen improvements

### Overview

Retain the current header, agent name/slug/version/status, Pause control, seven-tab strip, identity editor, configuration information and channel links. Add a compact task entry row using existing button/card styling: Open Chat; Summarize unread emails; Prepare WhatsApp review; Draft an email. Existing saved identity can be edited through the same validated endpoint; purpose remains optional and multiline. Technical slug editing remains accessible with a short explanation.

Order the actual operational dashboard as specified in the26 October addendum: needs-attention/reviews and current work first. Identity inputs are closed until **Edit details** is chosen; retaining the editor does not mean displaying it permanently. Frequent shortcuts remain accessible without dominating more useful work/outcome information. Missing-prerequisite coaching is conditional.

Make the setup checklist useful to the user's state: saved accounts, current capability coverage and the next missing prerequisite, not an implication that configuration alone proves delivery. A concise sending-mode line must show the actual saved policy near the task entry. Display compatibility/connection issues with a specific action, without silently changing values. Do not replace the page with a new dashboard or remove its current sections.

### Versions

Keep immutable History, current/selected version, technical JSON, Create version, Deploy and lifecycle confirmations. Add short explanations of the effects: creating a version does not activate it; Deploy uses the selected version; ordinary live policy/channel/AI saves retain their existing application timing. Preserve each handler and history record. Avoid generic Confirm when an explicit Deploy selected version or Pause assistant label explains the action.

### Policy

Retain existing email presets, all22 current registered tool controls, sender allow/block lists, custom security policy JSON, rate limits, autonomous policy and Save/consent paths. Add a business-readable grouped summary and ordinary WhatsApp/scheduling guidance inside this tab; detailed controls stay here under their existing Advanced disclosures. Groups with partial selections display Custom; do not collapse a partial policy into a broader preset.

Use concise sending descriptions consistent with the actual saved autonomous mode. Current autonomous_send=true stays true until an authorized user intentionally changes it. Explicit current requests for human review remain pending under either policy. A business selector is only another view of that same policy, never a second conflicting setting.

Before saving, show exact additions/removals, mode changes and affected account scope, then use existing administrator authorization and server validation. Preserve untouched tools and unknown/custom keys. A capability selection cannot grant the signed-in user a new workspace permission. Section-local dirty/Discard/Review behavior must preserve saved values and unrelated edits.

### Channels

Retain existing email and WhatsApp assignments, all three email role values, multiple primary assignments, exactly one WhatsApp binding, add/remove and Save channels. Explain current effective use in one short line; account binding alone never means access granted. Display current cards before additional selection controls, using the existing card/list style.

Prefer existing connected-account choices before opening provider setup. Preselect a uniquely eligible account only while showing it visibly; retain explicit choice when ambiguous. Do not create a new default-sender policy or switch away from an unavailable selected mailbox. Keep every supported provider flow and its real external-owner/credential steps.

Label removal by its effect, stage/preview it before save, and explain it removes the assistant's assignment rather than deleting mail. Retain unsaved changes during inspection; navigation away offers Save/Discard/Stay. No hidden autosave or invented cross-form transaction.

### AI Settings

Retain all16 controls and their existing validation, providers, defaults/overrides, model catalogs and save path. Group them within this same tab into Chat, Voice replies, Live voice, Knowledge indexing and Response behavior. Each input has a short purpose, an explicit saved/default/custom state and optional detail. Use supported provider/model/voice choices when available, with the existing explicit-value path retained where a catalog is unavailable.

Owner correction: retain the **original production AgentAISettingsPanel layout**, including its existing groups/components, rather than implementing the prototype's generic replacement form. Help and draft/active/save feedback are added within that original layout. No regrouping or redesign beyond that layout is implied by the preceding description.

Do not auto-replace unsupported saved model values, clear fields during catalog loading/failure, rewrite embeddings/dimensions, alter prompts or change voice behavior. Diagnose aliases and capabilities before proposing a supported model change. Preserve the distinction between inherit/null, blank editing and explicit values; unrelated saves must not reset overrides.

### Test

Keep the existing configuration test. State concisely that it checks saved configuration and is not a live send, inbox synchronization or voice test. Separate saved-state checks, connection/sync, model compatibility and actual task outcomes. Add a shortcut to try an explicitly chosen task in existing Chat. Any real communication test still requires its current authorization and applicable approval; no automatic send is introduced.

### Activity

Keep all existing audit data and filters/routes. Add readable outcome labels, grouping where supported by host correlation, Needs review/Completed/Failed filters and links to the actual draft, approval, message or scheduled task. Preserve raw technical details under expandable inspection in this tab. Allowed tool calls are not delivery receipts. Queued, provider accepted, delivered, read, rejected, failed and uncertain stay distinct; missing outcome evidence is labelled honestly.

## Interactive Chat within the current look

Keep the current Chat page, black user bubbles, assistant presentation, agent picker, composer, voice entry, conversation history and existing inline draft controls. Add task chips, validated account/scope choices and inline result/review cards using the same component styles. Existing free-text and voice input continue to work. The goal is fewer prompts to type and fewer settings to remember, not a new chat theme or a separate execution path.

Show already-known agent, bound account and explicit recipient as editable context; ask only for missing or genuinely ambiguous information. Offer Summarize unread emails, Prepare WhatsApp review and Draft an email as direct task entry. A proposed selection never expands the current user's authority.

Present safe actual stage progress, the returned summary, its displayed scope and the exact outbound review. Approval, rejection, editing/reapproval, cancellation and partial-task continuation remain explicit. Do not make the user retype account IDs, recreate the summary or copy it manually between pages. Keep detailed source/coverage facts expandable and available. Configuration-help shortcuts can explain or open existing settings; they cannot perform the deferred AI/RAG configuration feature.

## Mixed email-summary to WhatsApp review

Required natural prompt: `Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails`.

1. Treat **create/prepare an approval request** as an explicit request to remain pending, even with autonomous policy true. Host-derived restrictive context enforces this; model-supplied instructions cannot disable it. Cover equivalent noun and verb forms, negations, quoted/fenced text and payload injection in regressions.
2. Resolve connected readable mailboxes under existing tenant/user/agent constraints. If none is explicitly selected, propose **all assigned readable mailboxes**, visibly labelled; this is a design default chosen by the author, not a new saved sender setting. Latest3 means3 total in that displayed scope, not3 per account. Preserve existing mailbox-scoped canonical identity, deterministic received-time ordering/ties, local sync limits and unread semantics. Do not mark read. Request clarification when an explicit scope is unsupported instead of ignoring it.
3. Read only the required bounded content. Summarize actual returned emails; include actual matched/included counts and sync coverage in expandable details. If zero matches, report it and offer a scope change; create no empty WhatsApp proposal. If fewer than3 exist, state the available count without fabrication.
4. Resolve Meta Test Phone through the existing bound account. Check current permission, connection and real Meta window/template prerequisites. Do not convert free text to an arbitrary template or send private email content to an inferred contact.
5. Create exactly one persisted pending review with the actual generated summary, explicit recipient and sender. Show the exact immutable content intended for approval, with editing routed through the existing replacement/reapproval rules. No dispatch before a separate authorized approval.
6. Report actual progress and next action. On partial failure retain only verified safe results and provide a channel-correct continuation. Example, only if supported by returned facts: **Your summary is ready. The WhatsApp review was not created. Continue to review.** Do not substitute a generic instruction to check unrelated email Drafts.

The guided shortcut uses the same task contract and existing authorization/execution path as typed Chat; it must not be a second permissive implementation. Show scope/account/recipient as compact editable selections. Require only missing or ambiguous information. Typed and voice entry retain their existing host safeguards.

### Orchestration and retries

The host must distinguish required read and approval-preparation stages from completion. Reuse existing registered tools and operation receipts; this design does not authorize arbitrary tool replay. If a model stops after authorized reads, one bounded continuation may ask it to complete only the missing stage using the existing verified results and task constraints. Check existing action/receipt identity before any mutation. If still incomplete, show the partial result and an explicit continuation action. An already created, queued, sent or uncertain operation must never be blindly replayed. Maintain call budgets, cancellation, idempotency and current authorization rechecks.

No raw provider thoughts, unrestricted mail bodies, secrets or hidden reasoning are logged for diagnostics. Record safe stage/outcome/category identifiers and action references. The original model's reason for stopping remains unproven; do not pretend a source review recovered it.

### Exact continuation after partial failure

Author's decision after the builder check: **Continue reuses the same selected emails and exact generated summary; it never silently reruns latest-unread selection.** Keep a minimal host-written checkpoint in the existing assistant conversation message's `content_json` (the column already exists; add a narrowly typed repository adapter). It contains organization/agent/requesting-user scope, original host turn/operation identity, the selected account and source message IDs, displayed query/coverage/as-of information, exact generated outbound text and explicit recipient/bound sender, created/expires timestamps and any resulting action reference. Do not duplicate raw email bodies, model reasoning, credentials or arbitrary tool arguments. The summary is also the visible partial answer, with ordinary conversation retention; the metadata does not create a separate mail archive.

The checkpoint is usable for15 minutes, enforced by the server. A continuation submits only its opaque message/checkpoint reference, never a client-supplied trusted body or scope. Re-read current user/tenant/agent permissions, all referenced source-account/message access, binding, provider prerequisites and snapshot expiry. If data/access is unavailable or the checkpoint expired, block continuation and offer an explicitly labelled **Refresh summary** action; that action performs a new read and shows a new preview with a new as-of time. Account/recipient/body edits similarly create a new reviewed proposal. Never silently change the original content after refresh, later mail arrival or unread-state changes.

Create/claim the resulting pending action with existing host-controlled idempotency and transactional snapshot consumption/reference binding; double-clicks or later turns return the same action or its actual terminal/uncertain status. They do not recreate a rejected/queued/sent/uncertain send. Cancellation creates no action; retrying provider dispatch is a different existing recovery process. Revocation and expiry tests cover a browser refresh and later conversation turn. This adds scoped persistence work now; its cost is preferable to losing progress or sending a different summary under a misleading Continue label. It is not a generic workflow checkpoint or AI configuration execution service.

## Shared form and future-assistant foundation

Prepare a small reusable **description contract** for controls already being redesigned: stable field/section/operation key, plain label, one-line purpose, optional example/help key, visibility/capability requirements, sensitivity classification, current/default provenance, dependencies, validation reference, affected resource and consequential-change category. Reuse existing schemas and endpoint validation; do not create competing definitions of permissions or provider capabilities.

Implement only metadata needed by the current manual UI, help content and consistent change previews. No configuration-write tools, RAG endpoint, retrieval ingestion job, vector index, generalized execution engine or conversational setup behavior is registered in this release.

Document the future boundary now: RAG can retrieve approved help for explanation; retrieved text never authorizes actions. Future configuration tools must call the same typed host operations, resolve only the current user's authorized scope, validate current resource revisions, generate a before/after preview, obtain applicable consent, apply narrow validated changes, recheck authority and audit the outcome. Secrets are entered through secure forms; never indexed in help/RAG, exposed in chat context or embedded in previews. Retrieved documents, email and tool output are untrusted input. This is an interface direction, not implemented functionality.

## Persistence, safety and migration

Keep existing APIs authoritative. Presentation changes may add backward-compatible metadata or stale-state protection where the current endpoint lacks it. Use current updated-at/revision data if available; if configuration changed since load, return a conflict and reload/review, rather than overwriting another admin's changes. No cross-form atomic save claim: each section names what was saved, and partial saves remain explicit. Preserve current backend validation, JSON shape, unknown keys and unrelated settings.

Development was fast-forwarded during discovery through concurrent3f1f5a39. Preserve the new preview-only routine timing/digest controls and their distinctions between elapsed intervals and local calendar days. Those GET-only planning preferences are not executable scheduled tasks, standing WhatsApp consent or source-mailbox grants. Do not merge them into the active Scheduled tasks capability or convert their query parameters to operation authority. Reuse relevant descriptive conventions where appropriate without expanding their feature gate. This design does not claim those separate changes' unexecuted runtime acceptance.

No destructive migration or data rewrite is expected. If implementation discovers a schema requirement, document it for review before adding it. Tenant boundaries, roles, current tool allowlists/bindings, provider capabilities, approval snapshots/expiry/revocation, sender restrictions, limits, Meta rules and uncertain outcomes remain release gates.

The26 October full configuration-history requirement adds a real backend revision/apply/restore workstream. Existing JSON versions do not already provide it. Its additive schema/baseline migration, caller integration, atomic application, inheritance and immediate-revocation rules are governed by the addendum and require dedicated verification and guarded migration; do not ship labels promising full rollback over the old mutable endpoints.

## Existing-function preservation map

| Existing capability | Retained location and improvement |
|---|---|
| Name, multiline purpose, slug | Overview; concise purpose labels, all editing/validation retained |
| Immutable versions, JSON, create/deploy | Versions; clearer active/selected/effect wording |
| Pause and lifecycle confirmations | Existing header/lifecycle controls, unchanged authorization |
| Presets,22 tools, partial/custom selection | Policy; guided summaries plus full existing granular controls |
| Autonomous sending | Policy; one saved setting with clear consequences and human-review override |
| Sender rules, custom policy, rate limits | Policy Advanced sections; all fields/keys preserved |
| Email/WhatsApp binding, roles, removal/save | Channels; known selections and reviewed effects |
| All16 AI overrides, catalogs and inheritance | AI Settings; grouped explanations and existing custom paths |
| Configuration test | Test; accurate scope and task handoff |
| Original events/audit metadata | Activity; readable outcomes plus full technical inspection |
| Chat/voice/history/inline drafts/reviews | Existing Chat, with optional interactive choices and cards |
| Mail/WhatsApp/schedules/routine previews | Existing pages, functions and distinct execution/consent gates |

Create a pre-change inventory of controls, API payloads, persisted fields, side effects and authorization checks. Each must map to an implemented, reachable post-change control and pass preservation checks. Inventory unknown/custom values as well as the current defaults. A visual simplification cannot mark a feature obsolete.

## Implementation sequence after approval

1. RED→GREEN regressions for exact mixed prompt, noun-form review intent, no-matches/partial outcomes and retry safety; correct the functional gaps first.
2. Preserve the current shell/theme/seven tabs; add in-place guidance, effective state and concise copy.
3. Connected-account guidance, capability/custom-state mapping, dirty-state and consequence previews.
4. Improve grouping inside existing AI/Policy/Versions/Test tabs and Activity outcomes; preserve every control and stored setting.
5. Minimal reusable control/help metadata and future-boundary documentation; no AI configuration/RAG behavior.
6. Real-browser keyboard/mobile/task journeys and existing security regression suite; full tests/types/lint/build and guarded Development deployment with unchanged infrastructure safeguards.

## Acceptance and review

Automated: exact owner mixed prompt under autonomous=true stays pending/noqueue; quoted/negated instructions; explicit mailbox/all-mailbox ordering and counts; no/fewer than3 matches; unread unchanged; denied/revoked access; closed window/templates; provider failure; duplicate/cancelled/uncertain retry; snapshot edit/reapproval; no false saved/sent claims. Test typed and guided entry against the same host behavior.

UI: unchanged production theme tokens, typography, sidebar and component styling are verified visually against the baseline; no feature or configuration control is removed. A first-time owner can identify purpose, actual sending mode, connections and next action without opening Advanced; daily task does not require tool IDs/slug/JSON. All seven existing tabs discoverable at320/390px, with an explicit mobile section picker or navigation affordance; no document overflow; keyboard/focus/dialog/error/save announcements work. All16 AI fields,22 current registered tools and unknown/custom settings round-trip without silent loss. Partial/custom capabilities remain identifiable. No model/account/grant changes on tab navigation, loading failure, help or readiness checks.

Live acceptance uses labelled harmless owner-recipient fixtures and explicit review only. Prior test evidence is a baseline, not proof of the new mixed-task flow. Confirm actual persisted pending body/recipient, no queued message before approval and real provider result after an authorized single approval. Never manufacture inbound data, receipts or unrestricted test users. Preserve existing independent email/threading and security coverage.

Author's proposed choices for owner review: current theme, current shell and all seven tabs retained; in-place guidance without new roles; all assigned readable mailboxes/3 total for unspecified latest3 unread; section-local explicit save; visible existing automatic mode retained; existing platform APIs and design system retained. Layout/copy may be refined in the mockup review. None of these proposals authorizes future AI configuration.

Builder check: one important ambiguity concerned continuing an incomplete task after refresh. Resolved above as an author-proposed exact15-minute checkpoint with current-access checks, explicit fresh-summary action and no silent reread. No other important questions were returned. Owner approval of this written design remains required before writing the implementation plan or changing product behavior.

Revised builder check after the owner’s theme/function-preservation clarification: nothing important left. Review the revised in-place concept; the previous visual redesign is superseded. No production theme, functionality or configuration was changed during this design revision.
