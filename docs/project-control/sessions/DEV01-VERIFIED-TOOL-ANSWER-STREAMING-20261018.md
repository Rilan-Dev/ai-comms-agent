# DEV-01 / Forge — verified read-only tool-answer model streaming (2026-10-18)

## Authorization and starting point

- Owner repeated "Please proceed" for the exact next DEV-01 milestone: safe actual model tokens after authorized email/WhatsApp tools, with regression, TypeScript/build and browser/provider verification. The established owner instruction is **commit directly to current main; no branch or PR**. Phase 4 remains implementation in progress.
- Starting main: `ba9e948b4b58a4f270d5382f919957843e6eecb5`. Recovered `docs/project-control/NEXT_ACTION.md`, `docs/project-control/sessions/DEV01-MAIL-THREADS-STREAMING-20261018.md`, DEV-01 role-local worklog/memory and the actual Chat/Voice and email/WhatsApp host loops, Clara model runtime.
- Role boundaries: DEV-01 AI streaming/product source. FIX-01 retains existing voice transport defects and HTML sanitization issue #36. OPS-01 owns complete checkout/CI, deployment, migrations, live credentials and Vercel build-rate-limit. No infrastructure or deployed release changed.

## Confirmed gap and safety design

Existing ordinary Chat and Voice replies already use native provider SSE deltas. When mail/WhatsApp tool intent is detected, Chat's bounded `runInteractiveHostToolLoop` and Voice's bounded `runEmailAgentTurn` call the non-streaming `claraRuntime.completeWithTools`; the result was sent in one final `delta`. These are important authorization, agent account binding, execution and audit boundaries and were not bypassed.

A new **bounded interim final-delivery mechanism** streams real provider-generated tokens *after* the host has finished its normal tool loop and generated the canonical final answer:
1. Only successful, **registered server-side tools** whose sensitivity is `safe` and permission is `email.read` or `whatsapp.read` (Chat), or `email.read` (Voice) qualify. This metadata comes from the host tool registry, **not** model arguments/tool names. Voice also requires `finishReason === "completed"` and **zero pending approvals**.
2. The existing canonical answer must be nonempty, at most 6,000 chars. Ineligible, denied, mutating, approval-required and safety-limit responses remain canonical **without a second model pass**; they are not mislabeled as streamed.
3. The Clara runtime resolves the same org+agent provider credentials and makes a **read-only, no-tools** streaming model call with a strict verbatim instruction and bounded token budget. No tool or resource mutation is reachable from this presentation-only request.
4. `emitVerifiedToolAnswer` shows each *actual model chunk* only if it is an exact prefix continuation of the completed canonical answer. It never releases hallucinated approvals, sends, account IDs or changed text. On drift, network/provider error or truncation, it sends the unchanged canonical remainder as **one fallback** with truthful `canonical-fallback` mode. Abort stops output/no completion. TTS still starts only after the canonical answer completes.
5. This **does not yet implement provider-native incremental tool-call decision parsing**; tool planning and approval execution remain buffered and must remain so until specific OpenAI/Gemini streaming function-call adapters are tested. It incurs an optional *extra provider request* for eligible read-only turns and may fall back for vendors that cannot reproduce exact canonical text. No fake character timers or speculation.

## Committed source on main

- `apps/web/src/lib/streaming/verified-tool-answer.ts`: pure streaming prefix guard, abort, canonical fallback, accurate result mode.
- `packages/clara-core/src/runtime.ts`: `claraRuntime.streamCanonicalToolAnswer`, same org+agent provider/config, true model SSE, no tool definitions, bounded input and output.
- `apps/web/src/app/api/chat/stream/route.ts`: derive read-only from actual registered email/WhatsApp tool; stream verified final response after normal bounded execution, preserving canonical write/denial behavior.
- `packages/email-agent-runtime/src/email-agent-loop.ts`: annotate completed, audited tool call summaries with `readOnly` derived from registered safe email.read metadata, without altering invocation/approval logic.
- `apps/web/src/app/api/voice/turn/route.ts`: only completed approval-free successful read tool results use guarded actual tokens; sensitive and pending outcomes preserve canonical response; legacy JSON voice clients still supported.
- `apps/web/tests/verified-tool-answer.test.mjs`: 8 executable Node tests covering mid-generation visible deltas, changed approval/send claims, provider failure, partial EOF, abort before/after tokens, Unicode splits and malicious extra suffix.
- `apps/web/tests/verified-tool-streaming-contract.test.ts`: authored Vitest source contracts for native no-tools delivery, registered host readOnly gates, approval and JSON compatibility.
- `apps/worker/tests/email-agent-loop.test.ts`: an existing worker regression now asserts the registered email.read handler is classified read-only; not executed in the full repo.

## Verification, exact and honest

**ACTUALLY executed** (Node v22.16.0):
```bash
node --experimental-strip-types --test tests/verified-tool-answer.test.mjs
# PASS 8/8 (0 failed)
tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022 src/lib/streaming/verified-tool-answer.ts
# PASS
git hash-object src/lib/streaming/verified-tool-answer.ts tests/verified-tool-answer.test.mjs
# ab488dfa888066bf86399cae7227ba3c996d24df
# 33fae517247b47c5776796d4db83cfb5bb87965f
```
The executable local files' two hash values match the exact corresponding files committed to main. **16/16** independent current-GitHub-source assertions also PASS (provider org binding/no tools, bounded answer, host-derived safe read permissions, Voice no approval and legacy JSON, literal prefix safety, fallback, abort, added tests). These are source-level invariants, not browser/server integration tests.

**NOT EXECUTED / NOT ACCEPTED:** New Vitest test, worker test suite, whole web/db/worker `pnpm` typechecks/Next build, voice with real provider credentials/transport, provider API streamed verbatim fidelity, test mailbox database/tenant denial, deployment/browser E2E and TTS latency. The container has Node/tsc but no complete private repository checkout or `pnpm`; browser plugin not connected to originating authenticated user tab. No provider API claims or production acceptance.

## Exact next action

1. **DEV-01 equipped current-main checkout**:
```bash
node --experimental-strip-types --test apps/web/tests/verified-tool-answer.test.mjs
pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/workspace-shell.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
Fix actual DEV-01 regressions directly on main (no branches/PRs).
2. **DEV-01 product follow-on:** Add provider-native streamed function-call decision parsing to OpenAI/Gemini with tool deltas assembled **fully before any execution**; preserve registry permissions, schema, account binds, audit, approval, bounded loops, cancellations and native streaming final model turn without an extra verbatim pass. Then retire optional copy mechanism when contract acceptance shows correctness and lower latency.
3. **DEV-01 authenticated browser acceptance, OPS-environment assisted:** test read-only inbox/WhatsApp history (true incremental tokens and exact answer), blocked mailbox, denied permission, approval-required send (no false send claim), malformed provider response, disconnect mid-stream (no leaked tail), wrong org/agent, failed provider, provider credential override, small/large mail answers, real microphone + TTS, p95 time-to-first-text/cost. Record redacted artifacts and runtime output; compare deployed SHA to main.
4. **FIX-01** continues existing transport bug #26, sanitizer #36, WhatsApp source incidents; **OPS-01** current-head CI, approved migrations/deploy and Vercel/provider account/secret readiness. Avoid CI polling while independent coding exists.

**Status:** source implemented, partial unit/module evidence. Full product E2E and production acceptance pending.

- **Follow-up interruption cleanup:** `packages/clara-core/src/runtime.ts` now cancels the upstream OpenAI/Sarvam-compatible and Gemini reader in both model SSE generator finalizers when the host consumer returns early, instead of merely releasing its lock. Added source assertion in `apps/web/tests/verified-tool-streaming-contract.test.ts`. This was committed to `main` but is **not** yet provider/browser E2E tested.

## Continued DEV-01 follow-up — client cancellation, approvals and regression execution (2026-10-18)

**User:** "Please continue where you left." Work continues within DEV-01 on current `main` only, no branches/PRs; no deployment action.

- `packages/clara-core/src/runtime.ts`: propagated optional `AbortSignal` from `streamCanonicalToolAnswer` through `chatStream` to **both** OpenAI/Sarvam-compatible and Gemini streaming `fetch` calls. Previous generator finalizer cancellation remains in place. This corrects a gap where user disconnect could stop displaying tokens but leave the upstream HTTP request in progress until a later read completed.
- `apps/web/src/app/api/chat/stream/route.ts` and `apps/web/src/app/api/voice/turn/route.ts`: thread actual `request.signal` through the authorized post-tool stream into its upstream HTTP fetch.
- Chat host loop and shared `packages/email-agent-runtime/src/email-agent-loop.ts` now mark `readOnly` **false** when a successful registered read tool returns `status:pending_approval` **or** `approval_required:true`. A tool's server-registered `safe` sensitivity and `email.read`/`whatsapp.read` permission alone cannot override a resulting approval request.
- Added regression test `apps/worker/tests/email-agent-loop.test.ts` for the approval-shaped successful read output: `readOnly=false`, pending approval present. Added two Vitest contract cases to `apps/web/tests/verified-tool-streaming-contract.test.ts` for provider HTTP abort propagation and both Chat/Voice approval guards. All authored files committed directly to main.
- **Actually re-executed now**: exact bytes of `apps/web/src/lib/streaming/verified-tool-answer.ts` and `apps/web/tests/verified-tool-answer.test.mjs` in an isolated Node v22.16 test workspace matched their Git blobs `ab488dfa888066bf86399cae7227ba3c996d24df` and `33fae517247b47c5776796d4db83cfb5bb87965f`; `node --experimental-strip-types --test` **8/8 PASS**; standalone `tsc --noEmit` on the exact helper **PASS**. Current GitHub source-contract checks for abort and approval gates **12/12 PASS**. These checks are not full React/Vitest/Next/build/real provider tests.
- **Blocked/unverified:** full checkout or `pnpm` not available in local execution environment, GitHub raw DNS unavailable, no authenticated app/browser/provider credentials. Newly authored Vitest cases and worker test have **not** run dynamically. No live token latency, mailbox, provider, migration or production acceptance verified.
- **Next DEV-01 gate in an equipped latest-main checkout:** `pnpm --filter @ai-comms-agent/web exec vitest run tests/verified-tool-streaming-contract.test.ts tests/streaming-conversations.test.ts tests/mail-threads-workspace.test.ts`, `pnpm --filter @ai-comms-agent/web typecheck`, `pnpm --filter @ai-comms-agent/web build`, `pnpm --filter @ai-comms-agent/worker test`, `pnpm --filter @ai-comms-agent/worker typecheck`, `pnpm --filter @ai-comms-agent/db typecheck`, `bash scripts/verify-migration-chain.sh`. Real browser: abort mid-read and verify upstream cancellation, approval-shaped tool output never triggers model-copy stream, cross-account/org/agent denial, malformed provider SSE, read-only Chat/Voice partial tokens, real TTS after answer.
- **Still pending design:** native provider OpenAI/Gemini streaming tool-call decision aggregation and post-tool final generation (not extra exact-copy pass), safe policy/audit/approval validation before execution; sentence-level audio TTS streaming. FIX-01 continues voice transport/HTML sanitizer source defects; OPS-01 continues CI, deployment, DB migrations and provider runtime credentials.
