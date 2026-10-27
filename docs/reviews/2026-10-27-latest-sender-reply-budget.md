# Latest-sender reply execution correction

## Reproduced failure

The deployed 48a2a6dc draft-only request for the latest email from the owner's named test sender saved no draft and showed the generic unconfirmed-operation answer. A read-only replay using the actual saved runtime context returned `finish_reason: length` with no visible text or calls. A comparison of prepared and legacy contexts showed identical provider, model, temperature, prompt length and 1500-token budget; different configuration loading was not the cause.

Sarvam's current primary documentation explains that reasoning consumes completion tokens and supports `reasoning_effort: null` for short replies: https://docs.sarvam.ai/api/getting-started/models/sarvam-105b. A read-only replay with that setting still encountered deleted mailbox references from old history. Combining it with a self-contained current request produced current account discovery, sender search, thread retrieval and the correct original-source draft-reply proposal. The diagnostic stopped before mutation; this is not a saved-draft or delivery acceptance result.

## Correction

- Short native Sarvam 105B tool requests (at most 2048 completion tokens) disable hidden reasoning without changing the saved model, budget or permissions. Other models and larger budgets retain their existing behavior.
- A narrow complete latest-sender reply grammar excludes unrelated old history from planning. Unknown suffixes and references to earlier wording retain history; all current request text, exact-body rules and normal tool authorization remain intact.
- Exhausted JSON/SSE tool completions expose zero proposed calls or text, retain their exhaustion diagnosis, and raise a safe coded error before execution. Chat shows a bounded response-limit explanation with a correlation reference instead of implying an ordinary no-draft outcome. Any operations completed in earlier rounds still require checking saved records before retrying.

## Verification and review

Failing wire and planner tests preceded implementation. Regression cases include the exact live draft request, wording we just drafted, agreed wording, quoted body boundaries, partial JSON/SSE calls and safe error redaction. Core provider Node tests: 41 passed. Focused web tests and type/lint checks are recorded in the session ledger; full release gates and deployed acceptance follow separately.

A read-only reviewer found two initial issues (reference-dependent wording and lost exhaustion diagnosis). Both were reproduced by failing tests and corrected; the reviewer found no remaining blocker in this correction. Catch-up activation, provider read-write handling and routines remain outside that verdict and are not claimed complete.

The previously deployed 48a2a6dc release was healthy on both web and worker, with all 79 migrations applied, a backup restored successfully in a disposable database, and both catch-up and configuration-revision rollout flags off. This correction introduces no migration or provider/permission change.
