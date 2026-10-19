# DEV-01 / Forge — operator release test failure triage (2026-10-19)

## User evidence and authorization
- User supplied full console log (206 lines) for: `git pull --ff-only origin main && ACA_RELEASE_TARGET=migration bash scripts/operator-one-shot.sh`.
- Reported checkout was current `main` at `6fdeb5a39d8210443636787cf4fbcb78ffd6e833` prior to this fix.
- Existing owner instruction: source changes directly to `main` only; no new branch/PR. DEV-01 may correct source/test assertions; OPS-01 owns production Docker, release operator, databases/backup/migrations/deployment and CI. No production resource was accessed in this session.

## What the log actually proves
- Operator migration wrapper/core/one-shot tests: **29 pass / 0 fail**.
- Migration declaration safety and chain **PASS**.
- Production web Docker image **built**; the later operator verification image was built (cached workspace build layers).
- Shared, DB, Clara Core, email-agent-runtime, web and worker TypeScript checks all **PASS** in the isolated build.
- Clara Core tests **26 pass / 0 fail**.
- Full `pnpm -r test` launched web and worker in parallel. Web Vitest suffered an unhandled DNS request to `eth-mainnet.public.blastapi.io` while the operator container correctly had `--network none`; source search found no literal RPC hostname. The unexpected request needs package/test isolation; not evidence that Next failed to compile.
- Worker emitted failed test headings (one Clara knowledge contract plus 8 vector-adapter tests) but `pnpm` then terminated worker with `SIGKILL` when web failed. There is **no full worker failure detail** in the supplied log. Isolated worker test execution is required to confirm exact errors.
- Script stopped **before** target PostgreSQL database identification, migration planning, restore-tested backup affirmation, `APPLY` confirmation, migration or deployment. **No source evidence of DB mutation** and no released build.

## Concrete DEV-01 source bugs corrected on main
1. **Root cause matching the 8 vector adapter failures**: `apps/worker/src/knowledge/clara-email-vector-adapter.ts` had a double-escaped regex source `/[\\u0000-\\u001f\\u007f]/` for C0/DEL control characters. In JavaScript regex syntax it matches ordinary letters/digits in IDs, so normal `org-1`, `account-1`, `source-hash` and message IDs throw `requires a valid ...` before HTTP mocks. Changed to the correctly escaped `/[\u0000-\u001f\u007f]/`; still fails closed for NUL/newline/DEL. Committed `013a230c`.
2. Added `apps/worker/tests/clara-email-vector-adapter.test.ts` regressions for actual escaped NUL, DEL and newline chars. Fixed test literals so they produce controls at runtime rather than a literal slash-u. Commits `05ace89c`, `cd0590f3`.
3. **Stale source contract** in `apps/worker/tests/clara-email-knowledge-contract.test.ts` expected `to_tsvector('simple', kc.content) @@ to_tsquery('simple', $4)`, but current Clara Core runtime binds `textQuery` at `$3` and row limit at `$4`. Corrected assertion `$4 → $3` without altering production SQL. Commit `77aadf38`.
4. **Static/dynamic limited check performed on exact fresh GitHub source**: regex extracted from committed module was actually evaluated as JavaScript `RegExp` against 4 normal identifiers and NUL/newline/DEL; all expected outcomes PASS. Code/test contract checks **6/6 PASS** including zero double-escaped regression literals, runtime/test SQL parameter alignment and term query. This is not the complete worker test suite, HTTP mock run, Postgres integration or Next build.

## OPS-01 handoff
- Created GitHub issue [#38](https://github.com/Rilan-Dev/ai-comms-agent/issues/38) for unexpected offline web test Ethereum RPC request and interruption of parallel worker tests. Security boundary **`docker run --network none` must stay intact**; do not grant network access/production credentials to work around a test issue.
- Run two failing suites **alone**, with verbose output, on new built image from latest main. Avoid the parallel test aggregator masking the worker failure root:
```bash
git pull --ff-only origin main
docker build --target web --tag "aca-operator-verify:$(git rev-parse --short HEAD)" .
docker run --rm --network none --entrypoint sh "aca-operator-verify:$(git rev-parse --short HEAD)" -euc '
  cd /workspace/apps/worker
  node --import tsx --test tests/clara-email-knowledge-contract.test.ts tests/clara-email-vector-adapter.test.ts
'
docker run --rm --network none --entrypoint sh "aca-operator-verify:$(git rev-parse --short HEAD)" -euc '
  cd /workspace/apps/web
  pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --reporter=verbose
'
```
- If all checks pass, return to the authorized operator release process with separate DB identity, migration plan, restore-tested backup reference and explicit `APPLY <database>` confirmation. Do not perform production migration in this DEV session. Do not bypass test gate because compiler succeeded.
- Still pending: actual rerun of full worker and web suites, integration checks, migration ledger verification and production acceptance. OPS-01 owns remaining environment/test runner investigation and release.

## Agent continuity
- Phase 4 remains implementation in progress; no promotion, deployment or DB migration claimed.
- Exact next DEV-01 action when OPS posts isolated failure stacks: fix source-level errors in own scope directly on main and rerun relevant focused suites; otherwise continue independent secure streaming and mail UX tasks per NEXT_ACTION.
- FIX-01 retains unrelated HTML sanitization and runtime voice issues; no code changes made in those domains beyond regression source above.
