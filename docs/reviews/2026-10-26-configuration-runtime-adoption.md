# Configuration runtime adoption — 26 October 2026

Task 5 continuation; implementation remains gated by `AGENT_CONFIGURATION_REVISIONS_ENABLED=true`. The default is off. Do not enable it until the original forms and every existing mutation endpoint use the reviewed workflow. This inventory is source evidence, not live delivery or browser acceptance.

| Entry point | Configuration boundary | Preserved behavior / current limit |
| --- | --- | --- |
| Chat tool loop and final response | One prepared Clara context and frozen active revision | Current tool authorization still applies; newly granted accounts/tools cannot broaden an existing turn. |
| Chat local mail reports and exact mail-to-WhatsApp review | Frozen readable account scope and current actor/revocation checks | Database-only reporting does not require a working AI provider. The exact recipient, selected messages and human-review continuation remain pinned. |
| Chat mail composer | Frozen primary mailbox choices, current actor checks | The explicit Request approval action always requires human review, including in automatic sending mode. |
| Voice JSON/SSE and shared email loop | Same prepared context for every tool round and final answer | Existing transport, grounding, evidence and fallback behavior retained. Local counted reports remain provider-independent. |
| Scheduled agent runs | Current active creator membership/permissions intersect agent tools, then one prepared context | Preserve the upstream six-round/twelve-call budget and factual blocked-send recap. Disabled/deleted creators do not inherit authority from tool selections. |
| Legacy product executor / customer reply | Prepared context plus frozen/current proposal checks | Remains approval-only. Its pre-existing system proposals have no requesting user; current final dispatch rejects those proposals. No owner identity is fabricated to bypass that restriction. |
| Email read/write, WhatsApp history/send, schedule tool authorizers | Frozen capability/account ceiling plus current actor and revocation generation | Existing provider capability, live binding, policy, approval and dispatch checks remain required. |

Preparation reads configuration/default dependencies before and after resolving AI settings, retries once on a race, then fails without replaying tools. Credentials stay inside Clara's server-only prepared context. An immediate removal increments the revocation generation; an older turn does not regain authority if access is subsequently restored.

## Deployment semantics retained

The existing `PostgresAgentRepository.deploy` retires deployments within the selected environment, but updates the agent's single current version/deployment pointer for both `preview` and `production`. The governed apply follows that existing behavior. Preview must not be presented as an isolated sandbox. No second environment model is introduced by this change.

## Remaining mutation callers

- Agent identity PATCH and owner-only pause DELETE.
- Policy PATCH, including Chat permission previews and its expected-policy comparison.
- Channels PATCH, including mailbox role changes and both unbind operations.
- AI settings PUT, retaining all sixteen original controls, null inheritance, custom values and original layout.
- Legacy version creation and owner deployment POST.

These remain active through the legacy interface while the new feature is off. They must not remain active-write bypasses when it is enabled. New first-party forms must use exact active/draft context, retain recoverable edits on conflicts, show draft versus active state, and distinguish ordinary staging from explicitly immediate access removal. The remaining original-screen, browser, release and returning-owner catch-up tasks are not accepted by this inventory.
