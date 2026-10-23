# Human-readable five-day email sources — DEV-01 P1b

**Date/role:** 2026-10-23 · DEV-01 / Forge · `Development`
**Existing approved design:** [Personal catch-up and routines](../specs/2026-10-18-personal-catch-up-and-routines-design.md), [P0–P7 practical roadmap](2026-10-23-practical-email-assistant-roadmap.md), [C4 source coverage](2026-10-23-catch-up-source-coverage-clarity.md).
**State:** Source implemented; native repository tests, tenant DB/browser, worker generation and deployment acceptance pending.

## Person and problem

An ordinary person, employee or business owner sees only opaque message IDs such as “Open source email a92c1e10” in the five-day Catch-up source selection. The immutable manifest may show 200/320 authorized links without helping them identify which to open. C3 model-grounded priority generation is deliberately off until its own permission/provider/lease acceptance, so the current product must make **known canonical email headers** usable without pretending to have evaluated importance.

## Chosen approach and alternatives

1. **Selected:** Return only bounded canonical *subject, sender and received time* alongside existing authorized source IDs; display them as clearly labeled original email links. Small, immediate improvement using canonical PostgreSQL records and the existing C1/C2/C4 authorization boundary.
2. **Rejected:** Add a second raw-email store or ask Clara to hallucinate a subject/priority from an ID. Duplicates data, adds privacy risk and cannot work while C3 is disabled.
3. **Deferred:** AI high/medium/low sorting and personalized “last visited” logic. They depend on accepted C3 generation and separately authorized per-person presence/privacy.

**Authority:** Existing `currentManifest` checks organization, user, agent, granted mailbox scope and message revisions before any source display. The feature flag and `email.read` still apply. No provider calls, mail-body export, server-side write, read-state mutation, background job, attendance monitoring or WhatsApp send.

## Superpowers RED → GREEN slices and files

### Task 1 — Human-readable source header presenter (source done)
- [x] RED contract authored first: `apps/web/tests/catch-up-source-details.test.mjs` covers accurate canonical values, explicit UTC, malformed/missing fields, bounded control characters and DOM data rendering. Committed test did not run RED in this connector-only workspace.
- [x] Implement pure `apps/web/src/lib/briefings/source-email-display.ts`: `describeBriefingSource` returns bounded plain subject and sender, or truthful unavailable labels; ISO timestamp + UTC display only when parseable.
- [x] Mirror execution: local Node 22 test **3/3 pass** and strict `tsc --noEmit` exit zero. Mirror tests are not the committed repository suite.

### Task 2 — Keep source pagination private and minimal (source done)
- [x] Add a tenant/account-matched `LEFT JOIN email_messages` to `listBriefingSources` in `packages/db/src/briefings/coverage.ts`, after `currentManifest`, with explicit principal predicates.
- [x] Preserve the exact UUID cursor/200-page behavior, immutable source IDs and revisions; project only subject, from_email, received_at in addition to current source IDs. No bodies/attachments.
- [ ] Execute actual disposable PostgreSQL checks for same/cross tenant, two users, revoked scope, stale content revision, missing message, missing date and >200 source pagination. Schema/authorization architecture unchanged.

### Task 3 — Readable existing C4 UI (source done)
- [x] Extend local `Source` response type; render subject, sender and clear UTC `<time>` with focusable “Open original email” links in `apps/web/src/app/catch-up/catch-up-client.tsx`.
- [x] Preserve manifest status, source coverage, explicit review action, agent request invalidation, feature-disabled guard, and unactivated C3 truthfulness.
- [ ] Native `node --experimental-strip-types --test apps/web/tests/catch-up-source-details.test.mjs apps/web/tests/catch-up-source-coverage.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs`
- [ ] `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts tests/overview-first-entry.test.ts`
- [ ] `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`
- [ ] Authenticated browser: 320px and desktop, English+Tamil email subject rendering, no malformed markup execution, 0/200/320, keyboard/screen reader, missing/null source details, revoked user, feature-off 404 and no read-state mutation.

## Release hierarchy — deliberately unchanged

P0 Overview first (source present, acceptance pending) → P1 personal permitted source scope/readable links (this slice) → P2 C3 AI high/medium/low generation (gated/off) → P3 personal, opt-in review-gap privacy and actionable cards (new approval) → P4 inert timezone/DST routine preview (source present) → P5 one reviewed Routines UX over existing schedule+automation engines (consent/security review) → P6 scoped WhatsApp digest delivery with explicit standing consent, verified recipient, Meta policy and delivery ledger (separate authorization/deployment) → P7 correction feedback, regional language and cost/alert controls.

A user's chosen 5-day lookback **is not** proof they have been away for 5 days; login, provider sync, review, and delivery are independent. Daily 09:00 *local* is not every 24 elapsed hours. No unattended email sending, external WhatsApp or automatic scheduler activation is authorized.

## Evidence, limitations and exact next

- Actual GitHub `Development` blobs re-fetched: 17/17 source invariants check header projection, auth/scope before query, cursor, UI, feature flag and no body.
- Native mirror helper tests 3/3 and strict TS pass; **actual new five-case repo test, real DB, web build, Vitest, authenticated browser, C3 and OPS deployment NOT RUN.**
- **Next DEV-01:** Execute the exact native/DB/browser commands above on a sanitized authorized test setup, fix DEV-01 UI regressions, route independent implementation defects to FIX-01 and provider/deploy/environment failures to OPS-01. Continue C3 permission/provider/lease negative acceptance without activating the worker. Request separate owner authorization for P3 presence and P5/P6 persisted consent/dispatch.
