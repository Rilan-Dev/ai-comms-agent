# Stateful WhatsApp chat workflow — 2026-10-30

Owner-approved continuation of the five-view in-chat design. Development only; existing theme, registered WhatsApp tool and approval checks retained. No provider, credential or permission changes.

## Implementation

- Durable version-1 assistant-message widget with creator/organization/agent/conversation scoping and revision compare-and-swap.
- Setup, recipient editor, message editor, exact review and approval/result states in the same conversation. Local view changes do not insert artificial user messages.
- Setup explanations use the selected provider with verified readiness facts and no mutation tools; a factual fallback survives provider failure.
- Requests use a stable turn ID, registered tool and existing approval endpoint. A committed request is reconciled before further actions; unknown outcomes cannot create another send.
- Widget is stored before the WhatsApp mutation, then reconciled even if streaming is interrupted. Approved requests can resume the existing queue operation.
- Expired/declined requests can begin a fresh review without logging out. This does not extend an old approval or bypass the provider messaging window.

## Review and validation

Fresh-context review identified disconnect recovery and approved-queue continuation defects. Both received failing regression tests and fixes. The reviewer stopped due to quota before completing the rest of its review; no completed independent acceptance is claimed.

Focused tests: 23 passed, including disconnect preservation and approved continuation. Type checking passed. Lint: zero errors, 16 existing warnings. Full web suite and server release validation are recorded below when complete.

Local production build failed with a native out-of-memory error while the full suite was running. The server build must succeed before replacement of running application services. This is not a successful local build claim.

## Scope and outstanding verification

- This is a first-party WhatsApp workflow, not a general AI configuration-writing engine or arbitrary model-generated UI.
- Meta phone registration, secrets, missing permissions and approved template management retain their existing dedicated controls.
- Provider accepted is not delivered; the card labels these truthfully. No new WhatsApp delivery has yet been verified by this change.
- Live browser checks, exact running revision and release outcome remain pending at this checkpoint.

Full web suite: 187 files / 1,255 tests passed on 2026-10-30. Typecheck exit 0; lint exit 0 (16 warnings).
