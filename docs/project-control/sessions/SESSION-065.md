# SESSION-065 — Shared email hybrid retrieval core

Date: 2026-10-16
Role: DEV-01 / Forge
Scope: Build the shared PostgreSQL + Clara/Qdrant retrieval core without bypassing ISS-026.

## Actions completed

- Added `packages/db/src/email/hybrid-retrieval.ts`, a shared retrieval service intended for both Chat and realtime voice.
- The service resolves `agent_email_accounts` grants from PostgreSQL on every call, permits only `primary` and `read_only` bindings, intersects optional requested account IDs with the persisted allowlist, and fails closed for an explicitly empty filter.
- It combines bounded PostgreSQL lexical candidates with Clara semantic candidates, then re-fetches candidate messages through authoritative SQL using organization, agent, account, active-account, date, sender and subject constraints.
- Added `packages/db/src/email/clara-vector-search.ts` for the authenticated Clara endpoint, with server-side credentials, timeout, HTTPS enforcement in production and defensive org/account response filtering.
- Exported the shared service and Clara search adapter through `packages/db/src/index.ts`.
- Added contentHash to Clara search hits. The host adapter rejects missing/malformed hashes, and semantic-only candidates are checked against the current PostgreSQL knowledge-document hash before being returned.
- Added tests in `apps/worker/tests/email-hybrid-retrieval.test.ts` and `apps/worker/tests/clara-vector-search.test.ts`.

## Security boundary

ISS-026 remains open and owned by FIX-01/Sentinel. This service is not wired to the Chat route or realtime voice runtime. The Clara adapter remains unbound in worker startup and the vector-sync outbox loop remains stopped. Do not expose email retrieval or start vector indexing until the FIX-01 authorization fix is closed and verified.

## Verification

Source edits only. Tests, typechecks, lint, builds, live Clara API/Qdrant calls, ingestion, runtime isolation and latency checks were not run. No PASS is claimed.

## Next actions

1. Continue source review and correct concrete defects.
2. Run targeted tests/typechecks in a dependency-equipped environment.
3. After FIX-01 closes ISS-026, connect this same service through the trusted Chat and realtime voice tool path and bind/start the vector outbox after API verification.
4. OPS-01 owns live Qdrant setup, initial ingestion, runtime isolation evidence and latency/correctness acceptance.