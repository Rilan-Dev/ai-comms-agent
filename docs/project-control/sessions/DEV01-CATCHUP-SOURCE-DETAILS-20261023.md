# DEV01-CATCHUP-SOURCE-DETAILS-20261023 — familiar email subject/sender links

**Agent:** DEV-01 / Forge · **Branch:** Development · **Date:** 2026-10-23
**Starting HEAD:** `10860d93c4fc2aac299ae3ae4132d8bd235ad7e8`
**Scope and authorization:** Owner requested practical AI communication assistance for ordinary people, employees, SMEs and multinational users, 5-day mail catch-up, understandable importance, future recurring assistant routines/WhatsApp, Overview first, continue the next authorized product work. Build only within approved P0–P7/C1/C2/C4a and inert R1a. No C3 generator activation, R1b standing-consent persistence, background jobs or external sends.

## Repository recovery

Read `AGENTS.md`, `CHAT_CONTINUITY.md`, `NEXT_ACTION.md`, `CURRENT_PHASE.md`, `PROJECT_STATE.md`, existing shared `AGENT_MEMORY`, `AGENT_SESSIONS`, `AGENT_EVENTS`, `AGENT_BACKLOG`, `AGENT_HANDOFF`, issues and verification, DEV-01 role memory/worklog, and existing Superpowers plans/specs. Used Superpowers brainstorming, writing-plans, TDD, executing-plans and verification-before-completion guidance; existing user-approved architecture/roadmap is the binding scope.

**Phase 4 remains `implementation_in_progress`.** Existing provider sync writes canonical PostgreSQL mail regardless of login, C1/C2 maintain private granted scope and manifest source revisions, C4 has five-day presets and 200-per-page sources behind `BRIEFINGS_ENABLED`. C3 generation code exists but its background registration/activation is withheld pending security/provider/lease tests. R1a schedule clock preview exists without jobs; P5/R1b proposals and P6 WhatsApp standing consent/dispatch require separate explicit security approval. `/overview` is the intended first authenticated screen; real deployed SHA/UX acceptance is OPS-01.

## User problem and chosen smallest authorized source increment

When a person chose “Review last 5 days,” their original permitted mail list showed only internal IDs like “Open source email abcdef12.” That forces even a person with 200 messages to open every link to know what it is. With C3 AI priorities disabled, showing speculative “High/Medium/Low” would be dishonest. The approved P1 solution is source-owned sender+subject+UTC received time on each already permissioned link; keep source counts and AI completion separate. No additional mailbox provider access, duplicate raw-message store, model call or attendance inference.

## TDD and implementation evidence

1. **RED contract first:** `apps/web/tests/catch-up-source-details.test.mjs`, `7d1230b9c165b425d19eaaf76e775f1bb7b0c5d9`. Five cases for normal metadata/UTC, missing/malformed values, untrusted control chars and length, SQL scope/no body, and C4 source-link UI. The actual RED runner was unavailable (connector-only repository) and no false executed-RED claim is made; source prior lacked the fields.
2. **Pure presenter:** `apps/web/src/lib/briefings/source-email-display.ts`, `abe796cd289f29e840fd6f5df756ba86f9d61a0e`. Reject non-string/missing source fields, replace control characters, bound to 160 chars, use ISO/UTC or “unavailable.”
3. **DB/API source envelope:** `packages/db/src/briefings/coverage.ts`, `37e7ac1ea89078f3839ee7059db1786bc66870f9`. After existing `currentManifest` private owner/agent/grants/revision revalidation, query canonical tenant/account-matched `email_messages` for *only* subject, from_email, received_at. Add explicit organization/user/agent predicates. Preserve IDs, revisions, UUID cursor, 200-per-page cap. No body or attachment payload.
4. **UI:** `apps/web/src/app/catch-up/catch-up-client.tsx`, `bebd8775c31de9ea23f2710e13009c8d184dc4fc`. Show bounded subject, “From …” and UTC received time with keyboard-focusable original link, not raw ID, and graceful missing-header fallback. Preserve C4 scope changes, status, 1/5/7/30-day period, partial pagination, manual review only, and C3-disabled disclaimer.
5. **Regression correction:** `61d0a74313ee181390a8f08ff1a9f6c372f7e847` scopes the test's prohibited-column assertion to SQL rather than hitting an explanatory source comment (a false-positive test design, not an implementation leak).
6. **Independent phase-by-phase plan:** `docs/superpowers/plans/2026-10-23-human-readable-catchup-sources.md`, `fa5e72b2e3edc40d5116029feff0e9f92c9c86b2`; inherits the existing P0–P7 roadmap rather than starting another scheduler.

## Evidence and risks

- Re-fetched GitHub source, API, UI, feature gate and tests; **17/17 targeted structural checks** confirm private scope-before-select, exact canonical tenant/account join, metadata-only projection, cursor cap, UI labels, disabled C3 disclosure and five-case regression file.
- In isolated local Node 22 mirror, **3/3 helper behavior cases passed**, and strict `tsc --noEmit --target es2022` succeeded. These are **not** the actual committed native repo tests.
- **NOT RUN:** committed five-case Node test, existing C2/C4 Vitest, full web/DB typecheck, real Postgres scope/revision race, 0/200/320 manifest, two user/org, authenticated browser/mobile accessibility, C3 generation, GitHub Actions/Vercel or production. No user email was read and no provider/WhatsApp operation performed.

## Failed/avoided approaches and lessons

Opaque IDs have poor UX. Inferring “important” from subject alone is unreliable. Showing “five days away” from a selected five-day window is false. Do not fetch bodies, export sensitive email to public/AI providers or track employee attendance to solve a source-link display problem. Even benign sender/subject metadata must travel **only after private grant and revision checks**. Source links, generated AI judgments, user review and external delivery are distinct facts. A source-contract test that scans comments for forbidden words can misreport a security failure: examine the SQL projection itself.

## Blockers, ownership, exact next

1. **DEV-01:** On authorized, dependency-equipped latest Development run `node --experimental-strip-types --test apps/web/tests/catch-up-source-details.test.mjs apps/web/tests/catch-up-source-coverage.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs`; `pnpm --filter @ai-comms-agent/web exec vitest run tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts tests/overview-first-entry.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck && pnpm --filter @ai-comms-agent/db typecheck`. Validate private 0/200/320 links, source deletions/revisions, missing subjects/dates, cross-user/org and revocation, keyboard/mobile and feature-off 404. Return to C3 grant/lease/provider-negative acceptance only, with generator OFF.
2. **FIX-01:** Owns any independently reproduced DB authorization/Next/worker source defects. No code edits were made in shared Chat, voice, policy or operational infrastructure.
3. **OPS-01:** Owns worker/deploy/vendor/production health, current promoted SHA and approved runtime acceptance; no CI polling here.
4. **Owner/security decisions:** Personal `last_foreground_visit` opt-in privacy and employer visibility; R1b persisted consent; P6 verified WhatsApp recipient, Meta template/window and standing digest dispatch need separate approval. **Never** treat a prompt as permission to send or auto-activate a job.
