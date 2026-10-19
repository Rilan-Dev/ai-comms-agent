# DEV-01 / Forge — C3 canonical source and Clara integration — 2026-10-20

## Authority and repository recovery
- Starting GitHub main: `23ceb97637e47b9326cb2df181f3c1f9208a6fbf`.
- Read the prior DEV-01 handoff, C3 worker checkpoint, C2 grant/selection/coverage and model generation code, Clara runtime, migration contract and worker registration.
- Source commits on existing `main`: `1bae80c8f7374e9f10f5d19446c884e91111a46b`, `8f382eadcd10e0ab9e2c82648552b32f4dd8c430`, `464ab70de55288ffefbc974bee6be2c295db3d39`. No branch, PR, force push, reset or concurrent work deletion. Last source HEAD: `464ab70de55288ffefbc974bee6be2c295db3d39`; documentation follows this checkpoint.
- Phase 4 remains `implementation_in_progress`; **C3 not accepted or enabled**.

## Symptom and root cause
The previously committed C3 worker core had no real canonical source loader or Clara adapter. Blind use of the general `createChatTurn` would initiate ambient retrieval outside a personal briefing manifest; `completeWithTools` requires at least one registered tool, and granting it one would introduce an unauthorized tool channel. A partial provider response could leave uncovered source IDs unrepresented, and accepting a valid item while silently discarding an invented one could incorrectly mark a source complete. Transient provider 429/timeouts previously completed a permanent partial batch rather than leaving it recoverable.

## Remedy, exact files
- `packages/db/src/briefings/canonical-sources.ts`: host-only immutable-claim fetch, principal/organization/user/agent checks, current active mailbox grants and scope version, exact fenced lease, selected source IDs/revisions/thread/mailbox, canonical text rather than raw HTML; snippet-only sources explicitly partial.
- `packages/db/src/index.ts`: exports canonical loader and row validator.
- `packages/clara-core/src/runtime.ts`: additive `createBriefingTurn` using existing per-organization/agent Clara provider resolution, **without ambient RAG**, external tools or recipients; optional abort signal, bounded output tokens.
- `apps/worker/src/briefings/clara-generator.ts`: adapter with trusted host instructions, untrusted JSON source payload, UTF-16 evidence request, output length cap and aborting 60-second deadline. Canonical worker-dependency constructor; still unregistered.
- `apps/worker/src/briefings/briefing-worker.ts`: preserve explicit partial source links when batch input exceeds budget and propagate transient provider failure so C2 lease-expiry reclaim can retry.
- `packages/email-agent-runtime/src/briefings/generation.ts`: unsupported narrative dates/currency rejected, high/medium without priority-reason evidence downgraded, incomplete/snippet/oversized sources always partial, invalid candidate in mixed response forces partial, optional worker-only provider-error propagation (legacy fallback default retained).
- `apps/worker/tests/briefing-c3-wiring.test.ts`: 11 new tests authored including cross-mailbox/revision substitution, snippet-only partial, invented dates/amounts, priority evidence, provider 429/abort, malicious email prompts, restart claim, oversized and mixed-valid/invalid output. Existing six worker-core regressions retained.

## Failed approaches and prevention lessons
- Rejected `createChatTurn` for private catch-up because its implicit knowledge/mail retrieval is not scoped by C1 user mailbox grants.
- Rejected empty-tool `completeWithTools`: existing Clara implementation explicitly throws for zero tools. Do not install a dummy model-executable tool.
- Retained existing C2 grants/claim/heartbeat/completion and provider resolver; no competing engine, scheduler, schema or provider transport.
- Preserve source evidence on partial failure and never advance review/coverage for missing or invented model items.
- Provider errors can now be retried only after the existing 120-second fenced lease becomes reclaimable on a future worker invocation. No polling has been activated.

## Verification
- **PASS (source-level only):** 11/11 deterministic read-only assertions against actual final GitHub source paths for principal isolation, scope grants, fenced lease, revision, no raw HTML, no ambient retrieval, no tools, worker retry, mixed-candidate partial, disabled worker registration, and test case presence.
- **NOT RUN:** 11 new Node/tsx test cases, six previous worker-core tests, full worker/web/db/Clara suites, TypeScript checks, production builds, structural migration checker, actual PostgreSQL integration, live providers, or authenticated C4 browser acceptance.
- **ENVIRONMENT:** shell cannot resolve github.com; no local full checkout or pnpm installation. Connector writes/retrieval succeeded. These read-only source assertions are not a replacement for compiled tests.
- No production database migrations, feature flags enabled, deployment, provider sends or real messages.

## Remaining risks and exact next action
1. On a verified clean main checkout with dependencies installed, execute `cd apps/worker && node --import tsx --test tests/briefing-worker.test.ts tests/briefing-c3-wiring.test.ts tests/briefing-generation.test.ts`, plus worker, db and Clara TypeScript checks; repair any type or runtime failures **before** enablement.
2. Verify host-only PostgreSQL read/load grant revocation, deleted/stale source, concurrent lease expiry and cross-user isolation with disposable fixtures; add provider failure observability and safe retry quota/backoff as necessary.
3. Only after these pass, connect an explicit **disabled-by-default** C3 worker registration/poll mechanism without a competing scheduler; do not activate product routines or actual delivery.
4. Following C3 acceptance, DEV-01 runs authenticated C4 five-day return, priorities, source links, review/snooze, reconnect, keyboard/accessibility and two-device tests. FIX-01 owns unrelated runtime/security bugs; OPS-01 owns migration, infrastructure, credential incident and deployment.

Historical controls, other agents' work and all SQL migrations preserved.
