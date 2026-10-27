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

## Live acceptance at 3009e173 and next approval correction

Exact3009e173 deployed and passed health/revision checks on web and worker. Full web verification165files/1170tests passed, with type/lint checks. Direct Chrome then submitted the exact latest-sender draft-only request. The database confirms one saved draft, synchronized provider state, expected recipient and subject, original reply header and original thread, and zero send actions. Drafts also visibly displays the same QA acknowledgement. No outgoing email was sent.

The follow-up natural-language request for human approval still returned no confirmed operation and made no tool calls. A read-only isolated replay proposed an unwanted new draft instead of a saved-draft send request; the diagnostic stopped before mutation. AI approval intent execution remains pending and must not be described as accepted.

Testing the existing manual approval control exposed a separate false conflict. Its generic message loader omits reply_provider_thread_id, while createEmailAction correctly enriches the locked draft and compares all threading fields. A read-only live comparison confirmed that the generic and draft-specific approval snapshots differ, with zero prior actions. The correction uses the existing tenant-scoped getLocalDraftForOrganization for the send-email approval branch. Account/draft/recipient/review guards, locked snapshot matching, idempotency and human approval are retained. Actual POST regression failed before the change and passes afterward; full web166files/1171tests pass, and read-only review found no blocker. Deployment and manual pending-approval acceptance follow separately.

Automatic Overview activation, per-source freshness, provider read writes/optional low-priority handling, executable digest routines and WhatsApp delivery acceptance are still pending. The rollout flags remain off; no catch-up completion or delivery is inferred from the passing reply test.

## Verified manual review acceptance at c3297878

Exact c32978781585d1092a423bf5041a32b837b00374 deployed healthy on web and worker after another restored-backup check; all79 migrations remain verified, with no schema or environment change. Web image bc324df8b602a1e8b168f1f715e0cbb0aa9d48d88aa38ddb753cddd368bb35f9, worker image 00fa4f929e822d64c7c6d6ede63a354fc3a1d893886852777fe486ce5dbbea61.

Direct Chrome reloaded the same existing QA draft and requested review using the existing manual control. The interface confirms approval was requested, and the Approval queue displays the exact persisted QA body and intended sender/recipient. Independent database evidence shows the same single synchronized draft, original reply header/thread still intact, and exactly one pending_approval action. No approval or sending action was taken. Final screenshots are outside Git: latest-sender-draft-verified.jpg and latest-sender-pending-approval.jpg.

This accepts AI reply drafting and manual human-review creation only. The natural-language saved-draft approval planner, automatic Overview activation and the other pending phases remain open. Development contains all code changes; main was not changed. A subsequent evidence-only commit does not change the deployed application code.

## 2026-10-28 — saved-draft approval and focused verification continuation

Implemented a narrow, complete-current-command path for requesting human review of an existing saved draft. It uses the current registered account/message/send-request tools, checks saved recipient and draft identity, forces human review, and cannot create or automatically send a replacement draft. Live acceptance remains pending deployment; the previous manual approval remains pending and was not approved.

Added an unapplied forward migration and bounded per-source provider observation/verification foundation. Focused mailbox work uses the existing mailbox lease and provider metadata contract, preserves historical sweep timestamps/cursors, and does not acknowledge personal review. Current personal grants and exact source revisions are required. A real PostgreSQL regression exposed queued verification of draft/sent/provider-unavailable sources; the correction rejects those sources and keeps the worker selector consistent.

Fresh verification: web Vitest 167 files / 1,175 tests PASS; focused worker/read-state Node tests 10 PASS; disposable PostgreSQL mailbox-flag suite 11 PASS (including observed RED then GREEN for ineligible sources); web/worker/database type checks PASS; changed web source lint PASS; git diff check PASS. Direct Chrome extension access is working and live Overview was read successfully. No new email or WhatsApp message was sent in this continuation. Development had no upstream divergence; main was untouched.

NOT ACCEPTED/NOT DEPLOYED: automatic Overview activation, integration of per-source checks into generation/publication/item paging, confirmed provider read/deleted exclusions, provider mark-read operations and scoped low-priority rule, AI routine persistence/delivery grants, scheduled digest and WhatsApp delivery acceptance. Rollout remains off. Current production application remains c32978781585d1092a423bf5041a32b837b00374. Local migration 0061 has only been applied in the disposable fixture, never production.