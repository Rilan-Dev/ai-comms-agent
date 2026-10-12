# EMAIL-OPS-01 — DEV-01 self-review and quality gap audit

Date: 2026-10-13
Branch: `feature/email-ops-e1-e3`
Status: **IN PROGRESS — NOT VERIFIED; DO NOT MERGE AS COMPLETE**

## Scope reviewed

Reviewed the branch's Clara provider boundary, shared email tool catalogue/registry, worker read handlers, authorization/audit executor, agent-scoped runtime factory, Gmail sync reconciliation, and new provider tool-call adapter/worker orchestration. Compared the Clara boundary files with the current `main` baseline. The baseline `LLMProvider` only supports text streaming and embeddings; the new tool-call contracts are additive and do not replace the existing streaming path. The separate `Rilan-Dev/ai-reusable-libraries` reference repository could not be resolved by the connected repository file/search calls in this session, so this is **not** a byte-for-byte comparison against that external library. No external source behavior is assumed.

## Implemented in this session

- Added provider-neutral `ChatToolDefinition`, `ChatToolCall`, `ToolChatMessage`, and `ChatToolCompletion` contracts.
- Added non-streaming native function/tool-call completion in Clara for OpenAI-compatible OpenAI requests and Gemini's function-calling request/response shape.
- Explicitly rejects Sarvam tool calling until its behavior is verified; ordinary existing Sarvam text streaming remains unchanged.
- Serializes assistant tool-call history into OpenAI's required `tool_calls[].function.arguments` wire shape; maps Gemini function-call and function-response turns separately.
- Fails closed on malformed OpenAI tool-call arguments instead of silently dropping them and potentially treating an incomplete tool request as a final answer.
- Added `apps/worker/src/agent/email-agent-loop.ts`: builds exposed definitions only from the current agent's registered/allowlisted handlers, validates trusted tenant/agent identity, executes calls through the shared executor, serializes bounded untrusted tool results, limits the turn to 4 model rounds and 8 calls, and routes unexpected tool names through the executor so denial is audited.
- Added source tests for loop success, tenant/agent context mismatch, and tool-call limit behavior.

## Critical remaining gaps (do not claim production-ready)

1. **Not connected to a transport.** No chat route, realtime voice route, WhatsApp consumer, or scheduled-job consumer calls `runEmailAgentTurn`. Therefore the model cannot use this implementation in the actual product yet. Do not expose catalogue-only descriptors in a transport before this integration and security review.
2. **FIX-01 security handoff remains open.** ISS-026 identifies organization-scoped email context that is not constrained by the active agent's mailbox bindings. FIX-01 owns that remediation. DEV-01 must not bypass the handoff by wiring a transport around the issue.
3. **Only read handlers are registered.** Draft creation/update/delete, reply/forward drafts, message mutations, attachment operations, bulk actions, and send are catalogue contracts without executable handlers. They must remain unavailable to the model.
4. **Provider support is incomplete.** OpenAI and Gemini have source adapters; Sarvam tool calls intentionally fail closed. Neither provider adapter has been exercised against a live provider/model. No claim is made about all configured model versions supporting the exact schema.
5. **Tool output safety is partial.** Results are capped by characters, not by token budget; truncation can produce partial JSON. Add structured output projection/token-aware budgets and redact secrets/attachment data before wider tool exposure. Email text must always be treated as untrusted prompt-injection content.
6. **Authorization hardening remains.** Current runtime authorization checks a single `Tool.required_capability`, whereas some catalog contracts require multiple capabilities or alternatives. Before registering those handlers, implement all-of/any-of capability enforcement and recheck current policy/allowlist at invocation time, not only when the runtime is created.
7. **Operational resilience remains.** Tool `timeout_ms`/retry metadata is not enforced by the executor; provider requests lack explicit abort/timeout and retry policy; no per-turn token/cost budget or cancellation propagation exists.
8. **Audit and failure semantics need tests.** The executor writes audit after handler execution; if audit persistence fails after a read or future mutation, the caller receives a reconciliation warning. Verify idempotency and side-effect reconciliation before adding write tools. Unexpected provider tool names now pass through the executor, but the full audit path is not integration-tested.
9. **Email domain completeness remains.** IMAP/SMTP parsing is basic and not proven against real multipart/charset/attachment cases; live Gmail/Zoho/IMAP sync and deletion reconciliation are unverified. Provider event ordering, duplicate delivery, cursor expiry, UIDVALIDITY changes, rate limits, retries, and account disconnect/revoke flows need deterministic contract coverage.
10. **RAG/indexing is not complete.** Clara's local boundary has retrieval code but no verified email indexing pipeline. Qdrant, RabbitMQ, and Redis production paths remain unverified; OPS-01 owns live infrastructure blockers.
11. **Quality evidence is absent.** GitHub source writes were accepted, but no test runner, TypeScript check, lint, build, browser test, provider call, database integration, live sync, or deployment was run during this session. All new tests are source-only until executed.
12. **Reference-source comparison is limited.** This review compared the Clara adapter to `main`; the separate reusable-library repository was not retrievable here. Before claiming source parity, inventory the exact original source paths and compare APIs, provider capability behavior, auth boundaries, and licensing/provenance.

## Quality recommendations in priority order

- P0: Complete FIX-01 ISS-026 and obtain its source/test evidence before wiring the email context into chat.
- P0: Add a transport-owned factory that creates `ToolContext` only from authenticated server state and invokes the bounded loop; never accept org/agent/permissions from model arguments or client JSON.
- P0: Add integration tests that prove cross-agent mailbox isolation, missing allowlist denial, missing permission denial, account-role denial, capability denial, audit failure, and provider-emitted unknown-tool denial.
- P1: Implement provider contract tests with mocked fetch payloads for OpenAI and Gemini, including multiple calls, empty content, malformed JSON, unknown tool names, non-2xx responses, and tool-result continuation. Run them and the Clara/worker typechecks.
- P1: Implement execution-time policy/allowlist reload and all-of/any-of capability checks; enforce timeout/cancellation and bounded tool-output budgets.
- P1: Implement write operations only as separate explicit services with approval, idempotency keys, dry-run/preview, confirmation UX, and durable audit. Never infer send/delete approval from a natural-language model response alone.
- P2: Build provider capability matrix from adapter methods plus tested behavior; distinguish implemented, unsupported, partial, and unverified for Gmail, Zoho, IMAP/SMTP.
- P2: Add sync observability and reconciliation: per-account sync cursor/status, last success/failure, retry/backoff, dead-letter visibility, provider quota handling, and repair/replay tools.
- P2: Add mailbox privacy and data lifecycle controls: least-privilege scopes, token revocation, retention/deletion propagation to derived indexes, attachment malware/content controls, PII redaction, and auditable export/delete.
- P2: Add quality gates based on local focused tests/typecheck; do not wait for unrelated CI/Vercel when independent work remains, but do not represent source edits as verified.

## Exact next action

DEV-01 should continue with mocked provider-contract tests and static type-safety corrections for the new Clara tool-call adapter/worker loop, then update this audit with actual evidence. In parallel, wait for FIX-01's ISS-026 handoff only at the point transport integration depends on it; continue independent source work without polling CI/Vercel. Keep the PR draft and unmerged.
