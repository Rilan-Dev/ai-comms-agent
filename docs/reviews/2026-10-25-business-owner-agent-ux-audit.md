# Agent workspace: business-owner UX discovery

25 October 2026. Live agent: `240019d9-3fb5-426b-8600-5b858b5a2b51`. This is an observed-screen and source review, not a timed study with business owners. No policy, model, connection, credential or deployment was changed during discovery. The configuration check was run; no communication was sent or approval created.

**Updated owner constraint:** improve UX in place while preserving the current look/theme, all seven tabs and every business function. The earlier selected four-tab/separate-Advanced visual concept is superseded; the observed findings below remain valid. The owner requested clickable mockups. Product implementation waits for review of the resulting design. Future conversational configuration/RAG execution is explicitly excluded from this release.

## What was inspected

All seven live tabs: Overview, Versions, Policy, Channels, AI Settings, Test and Activity. Also expanded individual permissions and advanced sender/security/rate-limit fields. Observed loaded model-catalog results, read-only configuration test feedback and a390px mobile viewport; restored desktop sizing. Read the existing form handlers, policy presets, runtime loop, feedback guard, channel scoping and human-review parser.

Screenshots are in the task's `outputs/business-owner-ux/`: overview.png, policy.png, ai-settings.png and ai-settings-mobile.png. Approximate rendered agent-panel text: Overview142 words, Policy404 words, AI Settings427 words. AI Settings has16 input/select controls. Policy's27 DOM fields include collapsed advanced controls; that number is **not** a count of fields visible initially. Mobile tab strip measured777px content in334px available width: later tabs require discovery by horizontal scrolling. The measured page did not horizontally overflow.

## Screen-by-screen critique

| Screen | Observed | Likely first-time-owner difficulty | Required direction |
|---|---|---|---|
| Overview | Active, version1, slug, empty purpose, setup checklist, identity editor, Configuration and Channels cards | Cannot quickly answer what this assistant does, what needs attention, or where to begin work. An already-live agent still foregrounds setup. Slug/version/persisted identity are implementation concepts. | Daily outcome summary and one primary Ask assistant action; setup only when unfinished; name/purpose edit on demand; technical identity in Advanced. |
| Versions | Immutable configuration, selected/current states, optional technical JSON, Create version | Why create/deploy a version? Does Save affect the live assistant? No business benefit explains the workflow. | Keep the Versions tab and all its controls; describe changes in plain language and label active versus draft accurately. |
| Policy | Long prerequisite paragraphs, autonomous switch, email-only presets, technical tools accordion, sender lists and security/rate-limit JSON | Requires understanding user grants versus agent policy versus mailbox assignment. WhatsApp and scheduling are buried inside Advanced. The text repeatedly says human approval while autonomous mode is on. | Business capabilities by Email/WhatsApp/Scheduled tasks, concise effective-access summaries, one sending-mode control, expandable admin detail. Preserve granular controls. |
| Channels | Persisted mailbox dropdown, role Primary/Read only/Send only, multiple primary assignments, Remove, separate Save channels; one WhatsApp binding | Existing assignments and adding another are mixed. Primary does not explain effective access. Remove looks immediate; saved/unsaved state and effect are unclear. Credential connection lives elsewhere. | Existing account cards first; Add account flow; plain-language access and connection status; preview pending removals before saving, preserving actual API behavior. |
| AI Settings |16 controls, provider/model overrides, TTS/STT, embeddings/dimension, prompt/temperature/tokens, repeated null/inherit language | A business owner cannot judge these options. Different inheritance states and catalog provenance create reading work. Duplicate voice concepts are hard to distinguish. | Keep the AI Settings tab; compact effective configuration, optional detailed groups and explicit saved/default/custom state; preserve every override. |
| Test | Configuration-only check reports Pass for records, policy and bindings | Pass may be mistaken for a working provider, imported inbox, voice call or delivered message. It does not check the observed model-catalog mismatch. | Check setup explains its scope; separate saved configuration, connection/sync, provider compatibility and real-task outcomes. No automatic test send. |
| Activity | agent.tool call, email.search, allow, correlation-like technical concepts; description says configuration activity but list is dominated by tool calls | Cannot tell what happened, whether something was sent, what failed or what needs action. Long logs displace useful configuration events. | Outcome timeline with Needs review/Completed/Failed filters, links to actual actions; technical audit under details and preserved in full. |

## Priority findings

### P0: reported mixed email-to-WhatsApp request is incomplete

Exact owner prompt: `Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails`.

Read-only production inspection found user message `e33ca701-66ab-4a4b-8c5e-ed47cf29f2a0` in conversation `e86abdcb-df44-4276-9a33-449b358c2705`, at13:11:14.956UTC. Next assistant message at13:11:19.824UTC is the reported generic no-action response. The associated time window contains one correlation `76ca0dc1-5f48-47e5-9eac-e0f302350d7f` with allowed `email.accounts.list`, then two allowed `email.search` calls, and no WhatsApp tool call. These records do not establish how many emails matched or why the model chose to stop.

Source confirms the host loop can finish when the model returns no further tool calls; final receipt feedback correctly refuses to claim a mutation without a real action. However, it offers no useful continuation for this incomplete mixed task. Pure unread-summary fast paths intentionally exclude mixed actions. WhatsApp-only scoping correctly does not apply when the prompt explicitly mentions email/unread; simply widening that scope is not the fix. This request is a new uncovered acceptance case; previous exact-text WhatsApp delivery evidence does not prove this composition works.

Evidence: `work/mixed-request-diagnostic.log`; `apps/web/src/app/api/chat/stream/route.ts`; `apps/web/src/lib/chat/operation-feedback.ts`; `apps/web/src/lib/chat/whatsapp-planning-scope.ts`.

### P0: natural approval-request wording misses the human-review override

Executed the actual exported `requiresHumanApproval` helper locally with the exact owner prompt: **false**. Control `Keep it pending for human review. Do not send.` returns **true**. Current agent policy has autonomous sending enabled. Consequently this wording is not protected by the per-turn human-review flag; a future successful tool sequence must not accidentally dispatch it automatically. No send occurred in the inspected failed turn.

Required regression: exact owner wording plus synonyms such as prepare/create an approval request stays pending/noqueue with autonomous policy true. Quoted payload text and negated approval language must not acquire authority. Fix by explicit tested request semantics, not a longer prompt users must memorize.

### P0: contradictory sending promises

Current autonomous switch says ON and sends without human approval. The Request sending preset says never auto-send; the WhatsApp permission says Never send automatically; channel readiness says Ready to request human approval. These describe the same account inconsistently. The redesign must display the actual persisted mode while accurately explaining when an explicit current review instruction restricts it. Do not silently switch the policy off or broaden grants.

### P1: model compatibility needs a clear repair path

After loading, AI Settings warns that saved `sarvam-105b-conversations` is not in the current live catalog, which lists `sarvam-105b`. The selector displays inheritance while preserving the saved unsupported value. This is an observed configuration/catalog mismatch, **not proof of the reported mixed-task failure's provider cause**. Diagnose aliases/capabilities before proposing a supported replacement; never silently change models or voice behavior as UX cleanup.

### P1: business tasks have no short path

A user must translate a goal into mailbox assignment, registered tools, current connection and sending policy across tabs. Guided presets exist for email only. The daily experience should provide explicit actions such as Summarize unread mail, Prepare WhatsApp review and Review pending messages, while preserving the same authorization underneath.

### P1: saving and recovery are unclear

Identity, policy, bindings, AI settings and deployment have different save paths. Explain which section has unsaved changes, show the exact before/after for consequential changes, preserve unrelated custom fields, prevent stale overwrites, and provide a safe next action for partial failure. A universal Save must not imply atomicity the current APIs do not provide.

### P2: copy and navigation increase reading cost

Replace persisted, binding, policy and null with purpose-oriented language. Keep necessary terms in Advanced/help. Make mobile navigation visibly discoverable and keyboard-operable. Avoid long introductory paragraphs, repeated caveats and generic Confirm buttons. Do not hide sending mode, failures or authorization consequences merely to reduce word count.

## Constraints that must survive the redesign

- Tenant and current-user authorization, agent allowlists, connected binding/roles and provider capabilities remain separate enforced server checks.
- Preserve administrator consent, existing autonomous policy, explicit per-turn review restriction, frozen recipient/body approval snapshots, expiry, revocation checks, single dispatch and uncertain-outcome protection.
- Preserve Meta window/template/recipient restrictions and distinguish queued, provider accepted, delivered and read.
- Preserve exact draft body, reply/forward threading, provider synchronization, attachment validation and mailbox-scoped canonical reporting/coverage.
- Preserve all22 currently selected tools, granular/custom policy fields, sender restrictions, rate limits, all16 AI override controls, versions/deployment/pause and audit records. Business controls must derive from these, not replace them with permissive shortcuts.
- Existing deep links, including `?tab=policy`, must keep working or map to their equivalent view.

## Approaches considered

1. **Superseded visual concept:** four tabs with Advanced separated. The owner subsequently required preservation of the existing look and every feature; do not implement this navigation redesign.
2. Guided setup while keeping seven tabs. Smaller change and easier migration, but daily users still face technical navigation and repeated text.

3. **Current owner-directed approach:** improve the existing seven tabs and Chat in place, retaining the exact theme and every business control; add guided choices, purpose explanations and reviewed effects.

A chat-only configuration assistant is not an option for this release: the owner explicitly deferred that future feature.

## Proposed delivery order

1. Prove/fix mixed-task completion and explicit approval semantics with failing regressions; preserve the existing no-false-success guard.
2. Existing seven-tab navigation and current theme retained; short copy, effective-state summaries and explicit unsaved-change behavior added in place.
3. Account setup and business capability controls backed by existing APIs; preserve granular Advanced configuration.
4. Advanced model/version/diagnostic panels and business-readable activity.
5. Add descriptive metadata/help keys and preview/change-contract conventions as foundations only; no RAG execution or AI permission to configure the platform.
6. Repeat task-based owner journeys, security regressions, mobile/keyboard checks, build/full tests and guarded Development deployment.

## Proposed acceptance targets, not measured usability results

- A new owner can identify active assistant purpose, connected accounts, actual sending mode and next action without opening Advanced.
- Existing-user Overview contains at most about120 words of primary copy; optional help is separately expandable. Capability cards have one short purpose and current state. Do not optimize away safety-critical facts.
- Everyday setup requires a name, connection choice and capability decisions; no slug, tool IDs, JSON, embedding dimensions or voice IDs.
- The exact mixed request produces one pending WhatsApp review from the latest3 locally synchronized unread messages in its displayed mailbox scope, or a specific partial/blocked result. It never silently changes filters or marks mail read.
- Tests cover no matches, fewer than3, multiple mailboxes, revoked access, stale sync, closed window, unsupported template, provider failure, duplicate retry, request approval under autonomous mode and literal-payload injection.
- At320/390px, all everyday tabs remain discoverable, controls fit, no page overflow; keyboard focus, labels, errors and save status are verified in browser.
- Each old capability maps to a new location; unchanged settings round-trip without dropping unknown/custom fields or changing effective permissions.
