# Business-owner assistant workspace

Status: **proposed design, awaiting owner approval; no product implementation authorized by this document alone**. Owner selected the business-workspace approach and requested clickable mockups on25 October2026. Development is the integration branch; main remains untouched. This is a scoped repair/redesign, not closure or advancement of the overall project phase.

## Intent and evidence

Let an owner with no platform or technical knowledge understand what their assistant can do, connect the accounts it needs, use it and review outcomes with little typing or reading. Existing access controls and business operations must remain intact. Reduce unnecessary decisions, not information necessary for informed consent.

The [screen audit](../../reviews/2026-10-25-business-owner-agent-ux-audit.md) records all seven inspected tabs, specific contradictions, model-catalog mismatch and the failed mixed email/WhatsApp case. Its evidence distinguishes facts, hypotheses and historical acceptance. The present change cannot be called merely cosmetic: the reported workflow and natural approval wording need functional regressions.

The [standalone interactive mockup](../mockups/2026-10-25-business-owner-workspace.html) illustrates the selected approach; its local preview server is temporary. It uses fictional messages and simulated states, calls no production API and is not product implementation. Walkthroughs checked summary-only versus WhatsApp handoff, exact demo recipient/content review, sending-mode before/after and Discard, and320/390 mobile widths. The desktop/mobile visual check informed a shorter Overview with sending mode visible beside the primary action. Advanced controls are illustrated as groups; preservation of their complete real behavior is an implementation acceptance requirement, not a claim about this prototype.

## Approaches

1. **Owner-selected:** four everyday tabs, guided setup and task shortcuts, with technical configuration in Advanced. More restructuring; removes technical decisions from daily work while preserving controls.
2. Guided setup with today's seven tabs. Lower initial effort, but daily complexity remains.

Chat-only configuration is deferred by explicit owner instruction. The mockup is a throwaway interactive concept with clearly labelled example data; its simulated outcomes are not production evidence.

## Scope and non-goals

In scope: agent-detail navigation and forms, setup guidance, effective-state summaries, task handoff into existing Chat/review, business activity presentation, explicit human-review semantics and the mixed unread-summary/WhatsApp approval flow. Address the linked connection handoff only where needed; do not redesign every platform page in this release.

Preserve global Chat, email, WhatsApp and scheduling routes and existing operations. Do not introduce new providers, replace Clara, auto-switch models, weaken permissions, automate external Meta setup, add general-purpose AI configuration tools, execute RAG configuration, ingest secrets into a knowledge base, or create a workflow builder. Existing authentication and provider-owned verification remain necessary.

## Business workspace

Four everyday tabs: **Overview**, **Connected accounts**, **What it can do**, **Activity**. A separate labelled **Advanced settings** entry retains AI settings, versions/deployment, diagnostics and technical audit. These are presentation groupings, not new authorization roles. An administrator may also be the business owner; no existing right disappears because Advanced is separated.

Navigation must preserve deep links: existing `?tab=policy` maps to What it can do; `channels` maps to Connected accounts; `ai-settings`, `versions` and `test` open their matching Advanced section. New links persist selected view/section and support Back/Forward. Use semantic tabs and keyboard behavior, or ordinary route navigation with equivalent accessible focus. Mobile shows the four primary choices without requiring an undisclosed horizontal swipe; Advanced remains discoverable. Do not rebuild the global sidebar as part of this scope.

### Overview

Show name, short purpose, actual active/paused state, connected account summary, current sending mode and a primary **Ask your assistant** link to existing Chat with this agent selected. Do not rename the agent or invent a purpose automatically; allow optional direct editing through the current identity endpoint. Slug stays in Advanced.

Useful shortcuts: Summarize unread mail; Prepare a WhatsApp review; Draft an email; Review pending messages when any exist. Use explicit verified counts/status, not synthetic sample activity. Hide setup coaching once complete; when incomplete show only the next prerequisite and a clear action, retaining access to the full checklist. Configuration compatibility warnings remain visible but concise, with an authorized admin repair link.

Target at most about120 words of primary Overview copy outside optional help and activity data; a usability target, not a reason to omit an important warning. No technical text entry is required for an already configured assistant's daily tasks.

### Connected accounts

List current assignments before the Add account action. Each card shows display name/address, provider-friendly label, connected/problem state and effective allowed use. Effective access is calculated from current user grants, saved agent tools, binding role, connected status and provider capabilities; binding alone never says permission granted.

Add account first offers existing connected workspace accounts, then links to the existing supported provider connection flow. Preselect only when there is exactly one eligible option and still show it visibly. Never infer a different mailbox when the user's chosen one is unavailable. Explain external account-owner/administrator steps at the point needed; do not promise one-click Meta setup or implement credential delegation.

Retain multiple email assignments and exactly one WhatsApp assignment. Label roles by their consequence while retaining original values. Do not invent a single Primary selection when the backend currently allows two primary bindings. No new default-sender persistence is introduced; ambiguous outgoing mailbox selection still asks or uses an existing explicit selection.

Remove is labelled **Remove from this assistant**. Show affected access and stage the removal until the section's explicit Save/Review action. Do not delete provider accounts or messages. Preserve unsaved edits when inspecting details; guard navigation away with meaningful Save/Discard/Stay behavior.

### What it can do

Expose Email, WhatsApp and Scheduled tasks as ordinary capability groups. Email covers read/search, drafts/reply/forward and requests for sending. WhatsApp covers reading and preparation of messages. Scheduling covers its existing read/create/update/archive controls. Detailed registered tools remain available in Advanced.

A capability group with only some tools enabled displays **Custom** rather than falsely on/off. Opening it reveals the selected subset. Simple enable/disable choices map explicitly to known registered tools and preserve untouched tools, unknown custom policy keys, sender rules and rate limits. Never turn a partial/custom policy into a broad preset silently.

One sending-mode choice: **Review before sending** or **Send automatically**. Initialize from saved policy; existing autonomous_send=true stays true until an authorized user deliberately changes it. State that explicit current requests for human approval remain pending in either mode. Remove contradictory never-auto-send copy from presets/readiness/tool descriptions when the actual policy permits it.

Changes do not autosave. Show a section-local dirty bar with Discard and **Review changes**. Review identifies exact permissions added/removed, sending-mode change, relevant affected accounts and any higher-risk effect. Apply through the existing authorized policy endpoint, with current server checks and meaningful confirmation. User-role grants are neither offered nor granted by these capability controls.

### Activity

Present host-confirmed actions in business language, grouped by operation/turn where reliable correlation exists. Filters: All, Needs review, Completed, Failed; technical audit and configuration-only filtering remain reachable. Distinguish draft saved, pending review, queued, provider accepted, delivered, read, rejected, failed and uncertain. An allowed tool call is not a successful business outcome.

Link each item to the actual review/message/draft/schedule. If only an audit event exists, label it as activity with limited outcome information; never reconstruct delivery from the model's answer. Use stable operation identifiers internally and show readable task labels. Retain original detailed records, pagination/access boundaries and timestamps.

### Advanced settings

- Identity: name, purpose, slug; existing identity validation.
- AI: all16 existing fields, grouped into Chat, Voice replies, Live voice, Knowledge indexing and Response behavior. Each override explicitly chooses Use workspace default or Customize; show the effective value and provenance. Preserve null versus explicit values, unsupported saved values and unchanged custom fields. Catalog failures/loading must not clear values. Explain compatibility issues with a repair action; investigate aliases/capabilities before any supported replacement is proposed. Never automatically rewrite embedding dimensions or voice choices.
- Versions: immutable history, selected versus active configuration, technical JSON, Create version, explicit deployment confirmation and Pause. Editing a form must not suggest that a version was activated. Clarify which current settings already apply immediately through existing APIs.
- Diagnostics: separate saved configuration, current connection/sync, provider compatibility and real task evidence. Existing configuration-only checks remain clearly scoped. No automatic communication test or provider mutation. A real send test follows the existing explicit review process.
- Detailed permissions, sender lists, security policy and rate-limit JSON remain validated and recoverable.

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

## Existing-function location map

| Existing capability | New location |
|---|---|
| Identity/name/purpose | Overview edit; technical slug in Advanced identity |
| Version history/config JSON/create/deploy | Advanced → Versions; status surfaced on Overview |
| Pause/resume/deployment confirmation | Explicit assistant control and Advanced lifecycle; no hidden side effect |
| Email presets/individual tools | What it can do → Email; granular controls in Advanced |
| WhatsApp/scheduler tools | First-class groups in What it can do; individual controls retained |
| Autonomous policy | Sending mode with explicit review/apply |
| Sender rules/custom security/rate limits | Advanced restrictions, preserving exact stored values |
| Email/WhatsApp assignment and role/removal | Connected accounts and reviewed section save |
|16 AI overrides, inheritance/catalog status | Advanced → AI, grouped without dropping any field |
| Configuration test | Advanced → Diagnostics, scope visible before running |
| Audit/activity | Business Activity with technical detail access |
| Existing Chat/mail/WhatsApp/schedules/review routes | Preserved and linked with current agent/action context |

## Implementation sequence after approval

1. RED→GREEN regressions for exact mixed prompt, noun-form review intent, no-matches/partial outcomes and retry safety; correct the functional gaps first.
2. Agent workspace shell, routing/deep-link compatibility, effective state and concise copy.
3. Connected-account guidance, capability/custom-state mapping, dirty-state and consequence previews.
4. Advanced groups and business activity; preserve all existing settings and data.
5. Minimal reusable control/help metadata and future-boundary documentation; no AI configuration/RAG behavior.
6. Real-browser keyboard/mobile/task journeys and existing security regression suite; full tests/types/lint/build and guarded Development deployment with unchanged infrastructure safeguards.

## Acceptance and review

Automated: exact owner mixed prompt under autonomous=true stays pending/noqueue; quoted/negated instructions; explicit mailbox/all-mailbox ordering and counts; no/fewer than3 matches; unread unchanged; denied/revoked access; closed window/templates; provider failure; duplicate/cancelled/uncertain retry; snapshot edit/reapproval; no false saved/sent claims. Test typed and guided entry against the same host behavior.

UI: a first-time owner can identify purpose, actual sending mode, connections and next action without opening Advanced; daily task does not require tool IDs/slug/JSON. All four tabs discoverable at320/390px; no document overflow; keyboard/focus/dialog/error/save announcements work. All16 AI fields,22 current registered tools and unknown/custom settings round-trip without silent loss. Partial/custom capabilities remain identifiable. No model/account/grant changes on tab navigation, loading failure, help or readiness checks.

Live acceptance uses labelled harmless owner-recipient fixtures and explicit review only. Prior test evidence is a baseline, not proof of the new mixed-task flow. Confirm actual persisted pending body/recipient, no queued message before approval and real provider result after an authorized single approval. Never manufacture inbound data, receipts or unrestricted test users. Preserve existing independent email/threading and security coverage.

Author's proposed choices for owner review: four tabs; Advanced separation without new roles; all assigned readable mailboxes/3 total for unspecified latest3 unread; section-local explicit save; visible existing automatic mode retained; existing platform APIs and design system retained. Layout/copy may be refined in the mockup review. None of these proposals authorizes future AI configuration.

Builder check: one important ambiguity concerned continuing an incomplete task after refresh. Resolved above as an author-proposed exact15-minute checkpoint with current-access checks, explicit fresh-summary action and no silent reread. No other important questions were returned. Owner approval of this written design remains required before writing the implementation plan or changing product behavior.
