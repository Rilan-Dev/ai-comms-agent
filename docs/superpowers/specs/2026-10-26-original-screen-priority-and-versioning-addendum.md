# Original-screen priorities and versioned configuration

Owner-approved design addendum,26 October2026. This supersedes conflicting parts of the25 October workspace proposal. The owner explicitly requires the original theme and every business function, wants the feedback applied to original code, prefers the existing AI Settings layout, and selected **Save draft → Review changes → Apply/deploy**. Owner approved the written design and instructed proceeding on26 October2026; implementation plan: docs/superpowers/plans/2026-10-26-original-workspace-implementation.md.

Read with [the eight-comment source audit](../../reviews/2026-10-26-original-screen-feedback-and-control-audit.md) and [the original revised design](2026-10-25-business-owner-workspace-design.md). This addendum defines actual source requirements; prototype clicks and fictional statuses are not functional acceptance.

## 1. Dashboard hierarchy and rare configuration

Retain the current theme tokens, fonts, components, sidebar and all seven tabs. Change information priority and interaction, not visual identity or business capability.

Agent Overview order:

1. **Needs your attention:** authorized pending reviews, failed/uncertain work and blocking connection problems. Each item links to its real resolution. If none, show a short clear state rather than an empty setup form.
2. **Current work and outcomes:** real agent-scoped unread/local-sync coverage and recent activity, with the active version and pending configuration changes visible. Use only facts the current user may read; distinguish organization totals from agent totals.
3. **Frequent actions:** Chat, unread summary, draft and WhatsApp review shortcuts. Keep Open Chat accessible near the header; avoid a large What would you like to do banner displacing operational work.
4. **Compact configuration/account state:** actual sending behavior and connected/blocked scope, with links to the existing Policy/Channels/Versions tabs.
5. **Rare editing:** a compact identity summary and **Edit details** action. Name, multiline Purpose and Slug open only on explicit editing. Preserve Save/Cancel, validators and unsaved-change protection. No permanently expanded Agent details form.

Show setup coaching only when a real prerequisite is missing; do not make already-configured users read it on every visit. Do not infer urgent/reply-needed mail from unread counts, invent performance metrics, automatically mark messages read or claim the model works merely because a configuration row exists.

Apply this importance/frequency principle to all original areas in the audit's project-wide map. It is not a uniform dashboard rewrite: Inbox stays for triage, Approvals for review, Operations for diagnostics and Settings for configuration. Each retains its own functions and information needs.

## 2. One authoritative model for capability controls

Presets and granular checkboxes edit the same allowedTools set. They are two views, not two saved policies. Derive a matching preset or Custom from the actual selection; individual changes update that display. Selecting a preset computes a precise delta, preserves unrelated/custom keys and shows it before saving a draft. No independent Email enabled, WhatsApp enabled or Scheduled tasks enabled flag is introduced unless an existing backend field actually owns that meaning.

Sending mode is a different axis: the existing autonomous_send value controls the approval behavior of eligible outgoing requests. It does not grant a tool, account access or the current user's permissions. There is one editable sending-mode control. Any equivalent JSON key is shown consistently and cannot compete with it. Display the effective result, including No sending allowed when the relevant tool or account access is missing, even if the saved mode is Automatic.

Use precise labels, for example **Prepare outgoing requests**, **Prepare reply requests** and **Prepare forward requests**; the visible sending mode explains whether they await review. Preserve the registered operation names and the existing approval pipeline. Always require pending human review for an explicit current approval request, including the owner's exact wording. Existing negative/quoted-instruction and authorization checks still apply.

Required behavior matrix:

| Send capability | Saved mode | Explicit current review instruction | Result if all other prerequisites pass |
|---|---|---|---|
|Off|Either|Either|No outgoing request permitted|
|On|Review|No|Pending human approval|
|On|Automatic|No|Existing authorized automatic approval/dispatch behavior|
|On|Either|Yes|Pending human approval, no queue before separate approval|

Revoked user/agent access, unavailable binding/capability, Meta rules and uncertain outcomes can still deny/block every row. Test the intersections rather than testing each switch in isolation. Preserve custom subsets and future/unknown tools according to existing preset rules, including explicit No mail tools behavior.

## 3. Contextual help and multiple-value inputs

Each edited field states its purpose, current/default meaning, expected input and effect of blank/changed values in one concise line or contextual help. Do not use placeholders as the only labels. Errors identify the affected entry and repair action.

Sender lists use accessible chips/rows: Add entry, remove a specific entry, paste multiple comma-separated values and review the final list. Preserve existing non-empty values and the current100-entry contract until intended grammar/enforcement is established. Explain empty-list behavior only after verifying it. Do not advertise domains/wildcards or delivery restriction enforcement based solely on a persisted field name.

Structured editors may expose known validated rate/security fields only when their schema and runtime use are established. Keep the existing raw/custom JSON editor, preserve unknown keys exactly and validate without silently resetting them. The source audit found persistence but no enforcement consumer for several fields in the inspected runtime; behavioral verification and resolution of intended semantics are a release prerequisite for claims of protection.

## 4. Channels reflect actual operations

Keep connected-account selection, all email roles, multiple email assignments, exactly one WhatsApp binding and all provider/setup paths. Existing assignment rows show effective use and the exact account being edited. Change role updates that assignment; adding an already assigned mailbox does not create a duplicate row.

Explain primary/read_only/send_only through their actual intersection with user permissions, tools and provider capabilities. Primary never means bypass authorization. A send_only mailbox cannot supply the read stage of a summary; a read_only mailbox cannot prepare outgoing writes.

The original removal path applies immediately. Under the new configuration lifecycle, ordinary assignment additions/role edits are draft changes; any immediate **Revoke access now** is separately explicit, confirmed, applied and recorded. The interface must distinguish staged removal from immediate revocation. Do not implement a staged-looking UI over an immediate PATCH, or call multiple independent existing requests one atomic save.

Connection availability is independent of draft assignments. A revoked/deleted/unavailable provider account stays visible as a problem; applying/restoring a revision cannot resurrect credentials or substitute another account. Validate tenant, current account status, complete binding set and all relevant roles when applying.

## 5. Keep the original AI Settings UI

Use the original AgentAISettingsPanel and its section layout, LiveModelSelect and16 controls. Do not implement the generic replacement shown in the previous mockup. Add short purpose/help and accurate saved/draft/active status in the existing design. Preserve providers, catalogs, explicit custom values, inheritance/null, voice IDs/models, embeddings/dimensions, system prompt, temperature and limits. Catalog loading/failure cannot erase saved values. No automatic model replacement or embedding reindex is authorized by UX cleanup.

Draft saving records edits without changing the active runtime. Apply reviews changed values and dependencies, including effects on inherited organization defaults, voice behavior and knowledge indexes. Existing immediate-save APIs must be adapted consistently; a new Draft button cannot hide an unchanged direct-active mutation underneath.

## 6. Versioned configuration lifecycle

### Scope

Every successful saved configuration change is attributable and recoverable where its operation is reversible. First deliver a complete agent configuration flow, then extend the same contract to other configuration areas through the original-screen inventory. Do not claim platform-wide rollback before those paths are integrated and tested.

Agent revision content covers identity, policy/allowedTools/custom keys/sender lists/rate limits, email-role bindings, WhatsApp binding, all16 AI overrides and existing version config. Retain immutable legacy versions and deployment history. Record organization-default dependency identity/fingerprint and explain whether a draft inherits current defaults or pins an existing supported revision. Identical effective behavior cannot be promised from an old null override while its external defaults have changed.

Concrete inheritance decision: preserve today's meaning of null—**inherit the current workspace default**. Do not silently pin formerly inherited values. Review captures the effective defaults and dependency fingerprint; Apply rejects a changed dependency until reviewed again. Restoring agent settings retains current workspace inheritance and displays its effective values; restoring an old workspace default requires that resource's own authorized reviewed restore. A workspace change must appear in the relevant dependency/history view when that area is integrated. Agent-only rollback never claims a full historical platform environment was recreated.

Business actions have their own audit/approval/delivery history; they are not reversible configuration changes. Viewing a version, saving a draft, comparing or restoring settings never sends a message, changes inbox read state or runs missed schedules. Secrets are excluded from version payloads and previews; history records protected references and metadata, not reusable plaintext credentials.

### Draft → Review → Apply

1. Load the active configuration revision and its editable authorized state. Show Active versus Draft clearly.
2. Save a draft as a new immutable candidate revision. Active configuration remains unchanged. Preserve the creator, timestamp, base revision, scoped dependencies and exact changed fields. No-op saves do not create meaningless deployed versions; validation failures never apply partial settings.
3. Review shows exact additions/removals and consequences across every affected section, rather than a generic Confirm. Revalidate current authority, dependencies, model/provider constraints and whether active configuration changed since the draft began. Conflicts require a fresh review, not a silent overwrite.
4. Apply/deploy commits the complete reviewed agent change atomically under a current-base check, records deployment/actor and makes it active. A failed apply leaves the previous active revision intact. Runtime reads must obtain a consistent configuration revision; a turn cannot unknowingly mix old policy with new bindings/AI settings. Current authorization and immediate revocations are rechecked at operation execution and dispatch.
5. Feedback says what actually happened: Draft saved, Ready for review, Applied, Conflict or Failed. It never says active/deployed after only saving a candidate.

Stage all ordinary configuration edits through this contract. Audit and migrate the existing identity, policy, channels, AI settings, create-version/deploy paths and any other caller; a legacy endpoint must not silently bypass history or draft/apply. Keep compatible supported workflows through adapters or explicit migration responses, with a caller inventory and regression tests. No hidden direct-active fallback.

Authorization is field/resource-specific and cannot be weakened by bundling: draft creation/editing requires the existing mutation authority for each changed section; applying requires the existing deployment authority plus the current authority for every included change. Recheck the creator's current scoped authority as well as the applying actor. A revoked creator's candidate cannot be applied silently; an authorized actor may explicitly adopt its visible nonsecret changes into a new candidate under their own identity and review. History/read endpoints disclose only fields their reader is currently allowed to inspect; versioning must not expand access to protected configuration.

### History and restore

History shows immutable revisions, author/time, human-readable diffs, draft/active/superseded state and actual deployment records. **Restore this version** prepares a new candidate from it; it does not overwrite history, silently apply changes or bypass present-day authorization. Review/apply uses all current validation and dependency checks. Deleted accounts, revoked rights and unavailable models can block a historical restore until explicitly resolved.

Existing legacy version JSON does not contain a full configuration snapshot. Keep it intact and readable. Seed a complete baseline from the actual current saved state without changing runtime behavior. Converting a legacy partial version to a new draft must identify fields it supplies and fields retained from the current baseline, then require review; never imply missing historical policy/AI/bindings were recovered. Database/schema migration and rollout need their own tests, backup/restore proof and guarded release.

### Immediate access removal

Owner accepted the exception: disabling/revoking access takes effect immediately and is recorded. Keep an explicit current denial outside any staged broadening; a historical restore cannot silently remove it. Exact changes that revoke versus broaden mixed settings are separated and reviewed. Changing an account or broader permissions is not automatically labelled a revocation to bypass review. Already dispatched/provider-uncertain actions retain their existing reconciliation rules.

### Future Helping Chat Agent

Prepare typed, tenant-scoped operations and descriptive control metadata so a future assistant can explain, draft, preview and request application through the **same** validation/history/consent pipeline. Do not register configuration-write tools or turn on RAG-driven setup now. Retrieved help is explanation, not authority. User-entered secrets stay in secure forms. Future AI cannot impersonate an administrator or bypass the selected draft/review/apply lifecycle.

## 7. Delivery and proof on original code

1. Establish per-screen function/control/API/field inventory and original-theme screenshots. Include all known and custom settings, side effects and non-admin paths.
2. Fix the mixed unread-summary→WhatsApp review and natural approval wording under RED→GREEN tests, using the existing tools and approval pipeline.
3. Prove preset↔checkbox mapping and the capability/mode/effective-access matrix. Correct conflicting copy; do not remove a genuinely separate control.
4. Implement operational Overview and on-demand identity, concise input help and accurate channels behavior. Preserve the original AI Settings layout.
5. Build and verify complete agent revision drafts, review, atomic apply, current-access exceptions and reviewed restore; integrate all configuration callers. Do not ship incomplete full-history promises.
6. Add the current-style Chat interactions and scoped partial-task continuation specified in the original design. No-copy/retype workflows must still show exact reviewed output and known scope.
7. Extend the operational-priority/help/control model to other original pages in measured increments. Record live review coverage separately from source inventory.
8. Run focused and full automated checks, database contention/apply/restore tests where needed, mobile/keyboard/browser journeys, data-preservation and theme comparisons, and controlled Development release. Main untouched. No repeated or unauthorized live sends.

Required versioning negatives: simultaneous editors, stale drafts, partial-apply error, missing source/dependency, deleted binding, revoked actor, unsupported inherited/model configuration, legacy incomplete snapshots, secrets redaction, immediate revoke versus staged broadening, repeated Apply and Restore, and no replay of business actions.

Required UX outcomes: daily entry shows actionable facts before settings; identity form is closed until edited; all seven tabs/functions remain reachable; lists support multiple entries with useful validation; presets and detailed tools show one consistent state; actual mode and current effective access are unambiguous; channel changes match real operations; original AI Settings presentation remains recognizable.

## Design check

Fresh builder check returned **nothing important left**. Remaining schema/caller inventories and field-enforcement proof are explicit planning/verification work, not assumptions that the old backend already implements these requirements. Owner subsequently approved this written addendum and instructed proceeding; execution follows the linked implementation plan.
