# DEV-01 / Forge — native provider SSE tool-call assembly (2026-10-18)

## Scope and authorization
Owner asked to continue the prior streaming work. This is DEV-01 product source on **current `main` only**; no branch, PR, migration, deployment, phase promotion or other agent-role takeover. Starting main from the interruption: `4f9729daf0880fa8c8b2e5dfb3de39cc51a823fb`. Governing records: `docs/project-control/NEXT_ACTION.md`, `VERIFICATION_STATE.md`, `PROJECT_STATE.md`, existing DEV-01 sessions/worklog/memory. Project remains **Phase 4 implementation in progress**.

## Changes committed directly to main
- **OpenAI tool SSE parser:** `packages/clara-core/src/tool-call-stream.ts` reconstructs fragmented tool IDs, names and JSON arguments from `/v1/chat/completions` events. No tool calls leave the parser until a completed `finish_reason:tool_calls` and `[DONE]`; malformed/incomplete/non-object/oversized/duplicate-index/duplicate-ID calls fail closed with zero executable calls. Streaming text with `stop` returns no calls; provider body reader is cancelled/closed when done. Crucially, this parser **does not execute anything**.
- **Gemini tool SSE parser:** `packages/clara-core/src/gemini-tool-stream.ts` collects `streamGenerateContent?alt=sse` functionCall objects, requires full EOF and `STOP`, bounds arguments/call count, deduplicates identical snapshots, rejects contradictory same-name arguments and generates unique per-turn IDs. It too only returns a validated completion; no external tool changes originate here.
- **Adapter wiring:** `packages/clara-core/src/runtime.ts` now requests native SSE tool decisions from OpenAI/Gemini and passes *only completed/validated* parse results back to existing bounded Chat/Voice tool loops. JSON-compatible gateway responses preserve the prior validated JSON path. Sarvam native tool calling stays deliberately unsupported pending vendor contract verification.
- **Tests:** `packages/clara-core/tests/tool-call-stream.test.mjs` (10 Node cases), `packages/clara-core/tests/gemini-tool-stream.test.mjs` (9 cases), `packages/clara-core/package.json` `test` script and `apps/worker/tests/clara-tool-calling.test.ts` mock OpenAI/Gemini streaming adapter scenarios and malformed argument rejection.
- **Security boundary unchanged:** Agent tool registry, account binding, org/user permissions, allowlists, typed input validation, side-effect approvals and audit are still evaluated in host executors, *after* parsing. The parser must never be used as a substitute for authorization. Tool-generated final answer display still uses the previously added verified, optional second model pass for successful read-only tools; this work does not yet replace it with first-pass streamed final provider tokens.

## Actually executed tests
1. Reproduced the exact committed OpenAI parser blob `57c2544a4ecb02642277dced07bdb3cbaab82e42` and test blob `b41e8084acb83732579232806c1a5dd3025d9915` in an isolated Node v22.16.0 checkout mirror, checked with `git hash-object`: **10/10 Node tests PASS**.
2. Reproduced exact committed Gemini parser blob `a5a0ac5391302c48e14d174902c7b2451e698442` and test blob `ca0fdf59e92427863788af3771aebf69d85da710`, hashes verified: **9/9 Node tests PASS**.
3. Combined `node --experimental-strip-types --test tests/tool-call-stream.test.mjs tests/gemini-tool-stream.test.mjs`: **19/19 PASS**, no failures or skips.
4. `tsc --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --lib ES2022,DOM --target ES2022 --module ESNext --moduleResolution Bundler src/tool-call-stream.ts src/gemini-tool-stream.ts` **PASS**. A minimal local `ChatToolCompletion` type stub was used strictly for isolated module compilation; this is **not** a full workspace typecheck.
5. Checked integration hooks and host authorization boundaries against the latest GitHub source. Existing Chat/Voice tool-loop approval/auth code was not modified.

## Still unverified / exact next actions
- **Not executed:** `apps/worker/tests/clara-tool-calling.test.ts` mocked adapter integration, full repo `pnpm` tests/typechecks/Next/worker builds, PostgreSQL/migrations, browser, real OpenAI/Gemini API and time-to-first-token, interrupted network sessions, multi-tenant and actual action approvals, deployment. This execution environment has neither a complete private checkout nor `pnpm`; `git ls-remote` failed DNS resolution to github.com. Do not confuse 19 isolated parser tests with end-to-end production acceptance.
- **Next DEV-01 in dependency-equipped latest main:**
```bash
pnpm --filter @ai-comms-agent/clara-core test
pnpm --filter @ai-comms-agent/clara-core typecheck
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/mail-threads-workspace.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
- Next source work after full executable verification: eliminate the optional exact-copy second model pass where provider-native final answer SSE can be emitted *after* the last authorized host tool result, while retaining approval-required non-streaming status; add abort/timeouts to the provider tool-decision request and mock disconnect tests, then browser acceptance.
- **FIX-01** retains existing voice transport defects, HTML sanitizer issue #36 and other underlying incidents. **OPS-01** retains CI/CD/deployment/secrets/migrations/Vercel and real provider environment validation. Do not poll them instead of doing independent DEV-01 source work.

**Status:** native decision SSE source implemented on `main`, isolated parser tests and strict TS PASS; full project and production acceptance pending.
