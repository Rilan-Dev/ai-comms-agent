# Personal Catch-up Source Coverage Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a personal, permission-scoped mail catch-up honest and usable while only a page of original source emails is displayed.

**Architecture:** Build on the existing C4 immutable, per-person permitted mailbox selection and its paginated /sources route. A pure source-link coverage presenter derives display state from the existing sourceCount, locally loaded IDs, and pagination cursor; the Catch-up UI renders it without claiming AI generation, inferred inactivity or message review.

**Tech Stack:** TypeScript, React/Next.js 15, existing C4 API, Node 22 native test runner, Superpowers TDD.

**Spec:** `docs/superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md` §§4–5, and `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md` P1.

## Global Constraints

- Phase 4 remains `implementation_in_progress`; C3 generator registration/activation and WhatsApp delivery remain disabled without separate authorization.
- Never infer that a 5-day selected window measures a person's absence or use source count as a count of generated items, completed tasks or unread provider mail.
- Preserve organization+user+agent mailbox grants, immutable source manifest, source links and explicit review; no new raw-mail store or DB migration.
- No write, send, approval bypass, employee monitoring, provider call, background job or consent shortcut from this UI.
- DEV-01 owns this product UI; FIX-01 independently owns implementation defects; OPS-01 deployment/runtime checks.

## Review Focus

- 320 selected messages, only first 200 source links loaded: explain 200 of 320 and permit continued pagination.
- Cursor unexpectedly absent while some selected links are missing: never say complete.
- Duplicate source links across pagination: never overcount or imply all generated items were reviewed.
- Zero selected sources: do not assert zero unread or absence of mail elsewhere.
- A revoked grant or invalidated manifest: existing invalidation state must take precedence; loaded links do not imply access remains valid.

---

### Task 1: Pure, accurate coverage presentation

**Files:**
- Create: `apps/web/src/lib/briefings/source-coverage-display.ts`
- Test: `apps/web/tests/catch-up-source-coverage.test.mjs`

**Interfaces:**
- Consumes: `(sourceCount: number, loadedMessageIds: readonly string[], nextCursor: string | null)`
- Produces: `describeCatchUpSourceCoverage` returning `selectedCount`, `loadedCount`, `remainingCount`, `hasMore`, `complete` and truthful `message`.

- [x] **Step 1:** Add regression cases for empty, 200/320 with cursor, missing links without cursor, fully loaded, duplicate/invalid counts.
- [ ] **Step 2:** Execute committed RED tests in a dependency-equipped checkout (not available to connector session); verified corresponding missing helper/source with GitHub before implementation.
- [x] **Step 3:** Implement bounded, deduplicated source-link presentation; no provider or model call.
- [x] **Step 4:** Run an isolated copy of five helper behavior cases using Node 22 and strict TypeScript, both passed; committed test suite still pending.
- [x] **Step 5:** Commit independent regression and helper to `Development` (`5fb5c549`, `b6aecacf`).

### Task 2: Surface coverage in the authenticated catch-up page

**Files:**
- Modify: `apps/web/src/app/catch-up/catch-up-client.tsx`
- Test: `apps/web/tests/catch-up-source-coverage.test.mjs`

**Interfaces:**
- Consumes: `manifest.sourceCount`, `sources[].messageId`, `nextCursor`.
- Produces: a live, source-specific status line inside the already authorized manifest view.

- [x] **Step 1:** Add source contract assertion for the UI + preserve C3-disabled and explicit-review states.
- [x] **Step 2:** Render the loaded source-link count and pagination guidance without changing the backend or source selection.
- [x] **Step 3:** Re-fetch GitHub source and verify 14/14 targeted structural conditions; do not represent source checks as native test execution.
- [x] **Step 4:** Commit the UI (`cfed27d7`) without altering FIX-01 files or deployment.

### Task 3: Real acceptance and continuation (gated)

**Files:** No source mutation required to run; follow the existing source contract/regression files above and canonical C4 test suite.

- [ ] **Step 1:** Run `node --experimental-strip-types --test apps/web/tests/catch-up-source-coverage.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs` on current checkout; capture PASS/FAIL.
- [ ] **Step 2:** Run `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts` and web typecheck.
- [ ] **Step 3:** Verify authorized two-user/tenant C4 source pagination, stale source/revoked mailbox, 0/200/320 and invalidated manifests in a disposable DB/browser. Never expose another user's source links.
- [ ] **Step 4:** Record the exact checked SHA and send production/browser acceptance and deployment to OPS-01; route independently reproduced bugs to FIX-01.

## Next user-facing phases beyond this slice

1. **P2 evidence-backed AI priority:** when C3 lease/grants/provider negative tests pass, show top three “Needs attention / Worth reviewing / For reference” with quoted source and uncertainty. Do not mark any item reviewed by merely displaying it.
2. **P3 trustworthy welcome back:** consent-based per-user last foreground visit, last review and last digest delivered; no staff attendance surveillance.
3. **P5 one understandable routine wizard:** “daily 9 AM local” versus “every 24 hours”, verified mailbox/language/recipient, quiet hours, dry-run, explicit saved proposal; reuse scheduler and automation rule engines.
4. **P6 narrowly consented WhatsApp:** only after standing consent, verified destination, Meta template, live scope revalidation, bounded send and receipt ledger have independent approval.

**Status:** Tasks 1–2 source committed. Native committed regression, authenticated C4 validation and phase C3/R1b/R3–R4 gates remain OPEN; no claim of deployed readiness.
