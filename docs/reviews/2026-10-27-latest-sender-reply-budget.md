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

## Follow-up: bounded source lookup

The subsequent exact2a131a21 release passed health checks on web and worker. A helper variable substitution initially produced an incorrect image label; the pre-deployment check blocked replacement of the running site. The corrected build retained the tested backup and deployed the expected revision. No environment or database migration changes were needed.

That deployed draft-only test still saved no draft: the provider exhausted the twelve-call host allowance while repeatedly reading messages. Its audit confirms reads, not a successful write. The next correction therefore moves the narrow self-contained latest-sender draft lookup into bounded host orchestration over the existing registered, authorized, audited read tools. It compares exact incoming sender matches across at most four current mailboxes, fails closed on ties or incomplete candidate pages, and rereads the selected source. The remaining exposed operation is draft_reply; its request-local authorizer fences the exact selected account/message and still invokes the existing current-access authorizer. No sending or approval requirement is bypassed.

Real read-only replay exposed two integration details before release: PostgreSQL returns native Date values, and synthetic model call history cannot refer to tools removed from Sarvam's current alias mapping. The resolver now handles Date/string timestamps, and audited host read evidence uses the existing explicitly untrusted context path instead of invented model tool calls. The corrected live read-only replay performed three authorized reads, selected the expected source, and proposed draft_reply in the first model round. It stopped before mutation.

Eight resolver/host tests include actual executeRegisteredTool denial/audit assertions for wrong sources and alternate send mutations, retained current-access revocation checks, and authorized exact-source execution. Read-only review found no remaining release blocker in this correction. Full current verification and actual deployed draft acceptance are tracked separately; automatic catch-up activation remains outside this verdict.
