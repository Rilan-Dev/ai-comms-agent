# DEV-01 / Forge — native final tokens directly after authorized read-only tools

**Date:** 2026-10-18  
**Authorized user request:** Continue the exact next DEV-01 milestone: run full integration tests, then stream the final model answer directly after authorized tool execution, removing the extra model request that previously copied a buffered answer. Standing owner direction: **commit on `main` directly; no branch/PR**. Phase 4 remains `implementation_in_progress`.

## Recovery and scope

- Recovered current GitHub `main` at start `f623f512e8d55b044583faab955e725ed3081020`, `docs/project-control/NEXT_ACTION.md`, `VERIFICATION_STATE.md`, latest DEV-01 role memory/worklog and prior `DEV01-VERIFIED-TOOL-ANSWER-STREAMING-20261018`, host Chat/Voice loops, provider OpenAI/Gemini native streamed tool-call parsers, shared email runtime policy.
- Native OpenAI/Gemini streamed **tool-decision** parsers already exist and pass previous isolated tests. The remaining latency was post-tool: host loops generated the complete answer via `completeWithTools` and then performed a *second* model request to reproduce that answer byte-for-byte, which often fell back and consumed extra provider tokens.
- FIX-01 remains owner of unrelated provider voice transport defects (#26), email HTML sanitization and historic rows (#36), WhatsApp runtime issues; OPS-01 owns CI/CD, migrations, host/credentials, deployment/Vercel. No takeover.

## Source delivered directly on main

1. **Bounded read-only final answer input.** New `packages/clara-core/src/tool-result-final.ts` constructs a strict host-owned system prompt + one user-context block from the latest user request and completed read-only tool outputs; tool data are explicitly UNTRUSTED, **not system instructions**. Reject missing original request, unmatched/orphaned or duplicate tool IDs, more than eight tool results and oversized serialized context. Tool IDs are tracked for the whole batch, including consumed IDs: an actual six-test run exposed and fixed an ID reuse gap.
2. **Direct native final provider SSE.** New `claraRuntime.streamAuthorizedReadOnlyToolAnswer(ctx, completedHistory, signal)` re-resolves the current organization+agent provider/credentials and calls **`chatStream` directly, with no tools/functions available**, one native OpenAI/Gemini/Sarvam model-generation stream from completed host results. This replaces the buffered-final-answer **plus exact-copy** post-tool sequence for eligible successful read-only operations. The existing `streamCanonicalToolAnswer` helper remains in source temporarily for rollback/tests but no Chat/Voice endpoint calls it.
3. **Chat host.** `runInteractiveHostToolLoop` gains an optional onSafeReadOnlyFinal callback invoked **only after a fully parsed, authenticated, registered, executed and audited first batch** of all successful safe email.read / whatsapp.read tools without approval markers. The callback streams true final provider tokens to the browser and returns accumulated text for normal persistence. Denials, writes, pending approvals and other tool-loop cases retain the previous bounded multi-round and canonical-answer behavior.
4. **Voice host.** The shared `runEmailAgentTurn` gains the same optional callback and a `streamed` return flag, with host-derived readOnly and zero pending approvals. Voice SSE uses that callback and real generated tokens, while ineligible responses still send the untouched host-approved result. Original JSON voice mode remains unchanged; voice TTS still begins after full text turn, not sentence-by-sentence.
5. **Tests.** New `packages/clara-core/tests/tool-result-final.test.mjs` (six actual Node tests), updated `apps/web/tests/verified-tool-streaming-contract.test.ts` and new worker regression cases for direct callback, denied and approval-required tool results. Do not claim these full Vitest/worker suites ran.
6. **Security limits:** No tool is offered to the second (final) model call; actual tool actions only occur in the already-audited host path. Retrieved content remains untrusted data. A model can still make inaccurate *textual* claims, so tests must verify denial/approval messaging in real provider sessions. The direct-final fast path intentionally ends after **one successful read-only batch** rather than allowing multi-hop read tool decisions; other/complex cases stay on the existing multi-round loop. This tradeoff needs real-world acceptance and future adaptive planning. Errors mid-stream must surface as incomplete partial answers, not false success; abort signal is forwarded to native fetch.

## Executed evidence (source-matched, not production)

- First actual standalone run of the exact committed new builder/test: **5/6**, surfaced a genuine reused-tool-ID hole in the prompt validator (a consumed ID could be re-declared).
- Corrected source on `main`, reconstructed exact updated files in the local isolated runtime, checked `git hash-object` for both matching committed GitHub source blobs: builder `f2c78e9a46b8449ff7b0b03b60c0da970c5b78f4`, test `99530eda7fa8804b4decfaa60b16b51a35de0c95`.
- Reran `node --experimental-strip-types --test tests/tool-result-final.test.mjs`: **6/6 PASS**, 0 failed.
- Isolated strict `tsc --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022` against the byte-exact builder plus a minimal type-only stub **PASS**.
- Authenticated latest-GitHub source-contract checks: **18/18 PASS** for server-scoped runtime provider settings, no tools in final generation, size caps, reused ID rejection, server-derived registry/approval gates, direct Chat/Voice token delivery, JSON compatibility and test suite presence. These are NOT executed browser, React, database or provider flows.

**NOT RUN / BLOCKERS:** Full `pnpm` integration suites, complete web/worker/DB/Clara TypeScript/build, real PostgreSQL, authorized browser, Chat/Voice streaming with real provider credentials, disconnect/multi-hop scenarios, voice TTS, migration execution and deployment. Execution container has Node 22 + TypeScript but **no full private repo checkout, no `pnpm`, and GitHub DNS unavailable to shell** (`Could not resolve host github.com`). GitHub Actions CI is manual-only and its run/deploy ownership stays OPS-01. No production acceptance.

## Exact next DEV-01 action

On an authorized complete checkout of the current **main** (record SHA at execution time):
```bash
pnpm install --no-frozen-lockfile
pnpm --filter @ai-comms-agent/clara-core test
pnpm --filter @ai-comms-agent/clara-core typecheck
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/verified-tool-answer.test.mjs
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
Correct concrete DEV-01 failures directly on main. For browser acceptance, compare current deployed SHA, use nonproduction org A/B and two agent-bound mailboxes: normal inbox read showing first visible provider token while still generating, authorized WhatsApp history, denied cross-account read, provider-secret redaction, failed/malformed streamed decision, approval request (never stream/write), model tool output injection, reused call IDs, user cancellation mid-turn, malformed network SSE/EOF, multiple tool calls, old voice JSON client and new voice SSE text/TTS timing. Verify read-only one-batch sufficiency and cost/TTFT versus old exact-copy flow. FIX-01 and OPS-01 retain their scopes. Do not turn this source checkpoint into a production acceptance claim.
