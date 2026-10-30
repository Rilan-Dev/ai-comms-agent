# Stateful chat recovery implementation plan

> Use superpowers:executing-plans for native execution of the owner-provided design.

**Goal:** Replace prompt-prefill WhatsApp recovery with an actual, durable, interactive conversation workflow.

**Spec:** Owner's October 29 five-screen design and typed-component blueprint in this task. Preserve the existing theme and authorization controls. No raw generated HTML, new UI vendor, or provider switch.

**Architecture:** Extend the existing `conversation_messages.content_json` store with a versioned, creator-scoped WhatsApp workflow. A finite React renderer changes view locally. Authenticated same-origin commands reload the stored state, validate revision and permissions, and reuse the existing registered WhatsApp tool and approval endpoint. Existing send actions remain the authority for external effects. Stable turn IDs reconcile interrupted requests without replaying sends.

**Approaches:** Adopt the owner's first-party typed React approach. ChatKit replacement would replace working chat infrastructure; arbitrary generated JSX would bypass the established component and action boundaries. Neither is needed.

## Constraints and review focus

- Development only; preserve concurrent work and original business controls.
- UI cannot create authority, choose arbitrary tools, or bypass agent bindings.
- Store no credentials in workflow data; status must distinguish unknown from failed/sent.
- A stale tab or duplicate click must not create another approval.
- An interrupted request must reconcile the same operation before another attempt.
- A different organization, agent, conversation or user must not mutate the workflow.
- Removed accounts or changed permissions are checked again on execution.
- Unsupported widget versions fall back to ordinary saved text.

## Tasks

- [ ] Add validated version-1 workflow contract, allowed transitions, tests for malformed commands/stale state and outcome handling.
- [ ] Add authenticated workflow action endpoint and persistence using existing message JSON; test ownership, changed authority, idempotent reconciliation and review-before-request.
- [ ] Attach typed widgets to setup requests and unsuccessful WhatsApp chat turns; save ordinary fallback text and widget together, emit the persisted message ID over SSE.
- [ ] Render contextual setup, recipient, message, review and result views inside the same assistant bubble. Keep local navigation out of the transcript. Refresh current state on reload and after actions.
- [ ] Verify focused behavioral tests, affected types/lint, full web tests and production build. Direct-browser checks must be reported separately from scripts.
- [ ] Push Development and run the authorized release script; wait for completion and verify running revision, health and live interactions.

## Scope boundaries

This slice establishes the reusable protocol and WhatsApp workflow. Existing email cards remain intact. External Meta account registration/credential replacement and the wider future AI configuration assistant are not silently implemented as permission grants. Missing authority must offer an honest resolution, not an executable bypass.
