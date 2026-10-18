# DEV-01 / Forge — explicit UTC date-range mail reports (2026-10-19)

## Starting state and authorization

- Owner says "please proceed" from the selected prior assistant conclusion that FIX-01's rolling 24-hour report was made accurate from locally stored messages but semantic summaries, arbitrary date ranges and fresh provider sync remain pending. Continuing authorized DEV-01 product work, **direct main only, no branch or PR**. Phase 4 remains implementation in progress.
- Started GitHub `main` SHA `a02fa371446fda90151b170e95385a9f5fa1853e`. Inspected active `NEXT_ACTION.md`, FIX-01 exact 24-hour report and tests, DEV-01 worklog/role memory, and authorization/SQL route. FIX-01 already owns the 24-hour production incident and HTML ingest security; DEV-01 only adds a separate bounded date-range feature. OPS-01 owns CI/CD, database migrations, host/provider sync/deployment and Vercel build-rate limits.
- Security: prior owner content exposed a host password and an app browser session token. **Neither was used or copied.** Owner must rotate the host password and revoke the exposed browser session. Do not add them to logs, test fixtures or GitHub.

## Product functionality committed to main

1. `apps/web/src/lib/mail/explicit-date-range.ts`: parse only **explicit two-date ISO `YYYY-MM-DD` UTC calendar ranges** (e.g. `summarize all unread emails from 2026-10-01 to 2026-10-19`, `list mail between 2024-02-28 and 2024-02-29`), inclusive first/last calendar dates. Upper SQL bound is the **next day's midnight exclusive**, including PostgreSQL microseconds of the last date. Supports optional unread-only, sender **email address** and subject/topic; strict maximum 366 days, at most 1,000 characters, refuses invalid/reversed/extra dates, unsupported filters and ambiguous sender rather than dropping them. This does not support ambiguous natural-language dates, arbitrary combinations of operators, semantic intent, or "sync now" automation.
2. `apps/web/src/app/api/chat/stream/route.ts`: recognize an explicit bounded date range before unrelated chat history/tool planning. Unsupported explicit scopes respond `422 unsupported_mail_date_scope` (private/no-store), never a falsely broad LLM answer. Successful scopes reuse FIX-01's existing **actor email.read, persisted enabled agent email.search/messages.list tool, tenant+agent+read-capable mailbox binding**, parameterized SQL, draft/sent exclusion, unread filter, optional strict sender/topic filters and counted max-500 result. `CASE WHEN $9 THEN m.received_at < $4 ELSE m.received_at <= $4 END` preserves the original rolling-24-hour SQL behavior while covering all microseconds of the selected last UTC calendar day. Source identifier `local_mail_database`, counted matched/included, truthful partial and synchronization disclaimer are unchanged.
3. `apps/web/src/lib/mail/rolling-summary.ts`: backward-compatible optional report window label; existing rolling-24h report output unchanged. New date-range display explicitly states its exclusive upper SQL boundary rather than implying a live provider synchronization.
4. Tests: new executable `apps/web/tests/explicit-date-range-mail.test.mjs` (8 tests) and Vitest auth/SQL route source contract `apps/web/tests/chat-explicit-date-range.test.ts` (5 tests); adjusted the older FIX-01 Vitest contract assertions to correctly inspect shared `requestedMailScope` after adding the date-range branch. Existing FIX-01 24h tests were kept, not weakened.

## Actual test evidence

- Exact source Git objects reproduced in isolated sandbox and **verified byte-for-byte** using `git hash-object`:
  - `explicit-date-range.ts` = `979dd2cca7e26bcc255e7c66a5566ada3b529d72`
  - `rolling-summary.ts` = `d5e23f8649e5a1820bfd3db85ace0393108b576c`
  - New Node test = `46f0cf9fdbb3492619a529b78160fdfea9c5647a`
  - Prior FIX-01 Node test = `bd9cffc8264c11be06d495dc3dba024b21935494`.
- Actually executed: `node --experimental-strip-types --test` on both matched test files: **16/16 PASS, 0 failed** (new explicit-range 8 + existing rolling-24h 8). Actual global `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022` on both exact source modules: **PASS**.
- Authenticated current GitHub source review: **19/19** source-level assertions PASS for parsing, fail-closed filter handling, both time window modes, trusted identity and registered tools, counts and local sync qualifications, tests.
- **NOT executed:** new Vitest and full web/worker/Clara/DB pnpm tests/typechecks/builds, live PostgreSQL parameterized query and seeded microsecond boundary rows, actual provider synchronization/status, real AI semantic summary, mailbox cross-org runtime negatives, browser/chat page, migrations, production deployment. No full private checkout/pnpm or authenticated browser context in this session. Node tests and static GitHub assertions are not sufficient to assert runtime or production acceptance.

## Next action

1. DEV-01 in dependency-equipped current-main checkout:
```bash
node --experimental-strip-types --test apps/web/tests/explicit-date-range-mail.test.mjs apps/web/tests/rolling-mail-summary.test.mjs
pnpm --filter @ai-comms-agent/web exec vitest run tests/chat-explicit-date-range.test.ts tests/chat-rolling-mail-summary.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/clara-core test
pnpm --filter @ai-comms-agent/clara-core typecheck
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
2. DEV-01 follow-on, **after validation**: add *optional* AI semantic grouping/summary over complete, counted **authorized** DB records with citations per message, exact coverage and explicit abstention on partial records; prevent email-body prompt injection and false provider freshness. Do not pretend a generated narrative counted unseen messages.
3. OPS-01 authenticated environment: seed two organizations, two agents, send_only vs primary/read_only binding, 37+ messages including events in final day at 23:59:59.999500Z, unread/read and filters; verify that 24h and explicit dates do not interfere. Check real provider sync freshness separately and fix Vercel build-rate-limit/deployment under OPS-01. No secret sharing in chat.
4. FIX-01 retains prior 24h incident regression, HTML sanitization #36 and realtime transport source incidents. Continue independent DEV-01 product development without waiting/polling CI.

**Production acceptance pending.** No branches/PRs/deployment.
