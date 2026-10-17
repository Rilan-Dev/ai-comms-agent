# DEV-01 — Worker Clara vector tests wired into real worker test runner — 2026-10-18

## Authorization and scope
User: "Please proceed" with the recorded verification → secure email/RAG development priorities. Owner's previous explicit instruction remains to commit **directly to main** and create **no branch or PR**. Phase 4 remains implementation in progress; no production deployment or phase acceptance is authorized. Started from main `d915f2ff3d2429e410cc793bbfa01795d12cbaca`, while other agents may commit concurrently.

## Concrete defect corrected
- `apps/worker/package.json` defines `test: node --import tsx --test tests/*.test.ts` and does **not** list `vitest`. The pre-existing `apps/worker/src/knowledge/clara-email-vector-adapter.test.ts` imported Vitest, lived under `src/knowledge` and was excluded from `apps/worker/tsconfig.json` and the worker test glob. Thus neither the normal test run nor worker typecheck verified it; prior NEXT_ACTION's worker `vitest` command required an undeclared package.
- Migrated the full adapter test suite into `apps/worker/tests/clara-email-vector-adapter.test.ts` using the repo's built-in Node test/assert APIs, removing the inaccessible old Vitest-only file. Coverage: upsert metadata/hash/chunks, separate account/message cleanup, cleared metadata, HTTPS URL/secret gate, HTTP/provider errors, explicitly confirmed results, malformed JSON, malformed tenant/account/message/source identities without network I/O. The new test uses a fresh `Response.clone()` per mocked HTTP call to preserve multi-step body semantics.
- Hardened `apps/worker/src/knowledge/clara-email-vector-adapter.ts` to refuse invalid/blank/whitespace-padded/oversized/control-character organization ID, account ID, provider-message ID, source identity hash, and missing/invalid content/metadata SHA-256 hashes on upsert before sending to a server-key-bearing Clara endpoint. Message-delete/account-purge also reject blank/invalid org/account/message identity. Errors omit raw values. Existing authorized behavior/endpoint/approval/tenant boundaries unchanged.
- Source commits direct to main: `1513f237` new Node tests; `6cdde3fe` removal of undiscovered Vitest test; `8bc21242` source scope validation; `dccd8a7f` negative identity tests; `247e5a6c` fresh mocked Response bodies. No branch/PR created.

## Executed evidence vs unverified
- **ACTUALLY EXECUTED locally now:** `node --experimental-strip-types --test` with four previously committed exact-source standalone test files (vendor live catalog 6, runtime state 4, provider status 5, Clara vector read/search 5) → **20/20 PASS**, exit code 0. Node v22.16.0; global TypeScript 5.8.3 installed.
- **ACTUALLY CHECKED against current GitHub source:** 12/12 deterministic source/test runner assertions PASS: worker test glob includes new test; uses node:test; old Vitest test absent; `redirect: "error"`; all 3 operation validation gates; SHA-256 checks; non-secret HTTP error behavior; negative I/O test coverage; cloned response bodies; delete/purge and malformed JSON tests. Current source blob `b07e2b45f438b5f8cb0475837ced81b86a71a2ab`, new test blob `97e2e6abd070e45955e4c6a176bebf2772ff7a76`.
- **NOT RUN / NOT VERIFIED:** New `apps/worker/tests/clara-email-vector-adapter.test.ts` dynamic Node/tsx execution (full checkout unavailable), full worker test suite, worker/web TypeScript, Next/worker build, migration chain, live Clara endpoint/Qdrant, browser, WhatsApp/Gmail/voice E2E, production deploy. Do not claim a full test/build PASS from the 20 existing portable tests or static assertions.
- **Toolchain / deployment:** This container has Node/TypeScript and old portable module copies but no private `ai-comms-agent` checkout or `pnpm`; GitHub DNS via shell fails. GitHub Actions CI is intentionally manual-only `workflow_dispatch`; did not enable auto-runs or trigger a workflow. OPS-01 owns host/credentials/deployment/Vercel build-rate-limit. Clara vector API upstream merged to Vite-Converted, but authenticated live deployment and ISS-026 live endpoint cross-agent isolation remain gates for any vector outbox/Chat/Voice activation.

## Exact next commands
On latest `main` with pnpm installed:
```bash
node --experimental-strip-types --test apps/worker/tests/clara-email-vector-adapter.test.ts
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/worker build
pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/ai-runtime-settings.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
bash scripts/verify-migration-chain.sh
```
Alternatively manually run existing GitHub Actions → CI → Run workflow for `main` through its approved operator path; do not silently alter the manual-only trigger. Record full output and fix any concrete source failures on main. Before enabling email vector search/sync, validate the current Clara authenticated API and Qdrant operations, cross-organization and cross-agent account denial, deletion/reindex/latency and provider credential protection.
