# DEV-01 — C3 disabled worker core checkpoint — 2026-10-20

## Recovery and authorization
Started at GitHub main `16d3fb6fb48713a711c7de38274f81e44f2768c4`; recovered prior C1/C2 handoff and canonical batch API. Phase 4 remains `implementation_in_progress`. Owner authorized independent DEV-01 implementation, no branch/PR, production activation, database execution or deployment.

## Symptom and root cause
C3 `generateBriefingBatch` and C2 claim/heartbeat/completion contracts existed, but `apps/worker/src/index.ts` did not register a dedicated briefing worker and no `apps/worker/src/briefings` orchestration was present. Provider-backed canonical source loading and scheduler integration remain unimplemented.

## Remedy
Commit `7da1d2b5e153e9ee361a832d3535e103cb40f753` adds an **unregistered**, dependency-injected worker core under `apps/worker/src/briefings/briefing-worker.ts`. It requires trusted principal and fenced batch claim, exact source count/mailbox/revision correspondence, generation through existing grounded helper, rejects truncated input, periodically heartbeats at 30 seconds, refuses completion after observed lease loss, and delegates final grant/revision/lease revalidation to canonical C2 completion transaction. Six regression tests are in `apps/worker/tests/briefing-worker.test.ts`.

## Evidence and failed approaches
GitHub object creation and main branch fast-forward were successful; no force push. No failed implementation approach beyond discovering the missing worker integration. **Tests NOT RUN** in this connector-only session: new Node/tsx tests, full worker/web/Clara suites, TypeScript, build, live providers, PostgreSQL, authenticated browser. This commit is NOT verified product acceptance and requires test execution before any enablement.

## Risks and lessons
Heartbeat is best effort; the lease token and live authorization in C2 completion remain authoritative. Do not mark source coverage ready when bounded input is truncated. Provider exception and malformed output produce partial fallbacks, never trusted facts. Error/retry telemetry and retry scheduling still need integration. The worker has no production registration and cannot run automatically.

## Next exact authorized task
Complete the **host-only canonical source loader** using scoped read-only PostgreSQL access with live grant, account, agent and revision checks; connect the existing Clara generation adapter without creating a competing provider; add regression tests for provider 429/timeout, prompt injection, amount/deadline grounding, partial batch recovery and multi-tenant identity isolation; run focused worker tests and typechecks. Only after safe verification add an explicitly disabled-by-default registration path. Then undertake C4 authenticated five-day/two-device acceptance. OPS-01 owns deployment and database operation; FIX-01 owns unrelated substantial runtime defects.
