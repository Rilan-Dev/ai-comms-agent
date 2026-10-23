# DEV01-ROUTINE-TIMING-PREVIEW-20261023 — safe, understandable routine planning

**Role:** DEV-01 / Forge
**Date/branch:** 2026-10-23, `Development`
**Starting SHA:** `c62666531b95f65e840621ddc6caf0a7b3bd7620`
**User authorization:** Continue customer-friendly email catch-up and agent schedules/automations phase by phase, show Overview first, use Superpowers planning, do not perform FIX-01 or OPS-01 work and do not wait on CI/Vercel.
**Phase:** 4 `implementation_in_progress`. No acceptance or release transition.

## Recovery and scope

Read canonical `CHAT_CONTINUITY.md`, `NEXT_ACTION.md`, `AGENTS.md`, `AGENT_SKILLS.md`, Phase, shared `AGENT_MEMORY.md`, central agent registry/sessions/events/handoff/backlog, issues/verification, DEV-01 local memory/worklog and the existing Superpowers catch-up/routines plans. Inspected current Overview, private C4 catch-up, Schedules, Automations, canonical `RoutineTrigger`, worker clock engine and worker timing regressions. Current C1/C2 source manifest and C4 five-day guided preview are present, while C3 generator activation and R1b standing-consent persistence remain gated. Concurrent FIX-01 repairs were intentionally left untouched.

## User-centered findings

A single “schedule email summary” input conflates calendar 09:00 local time, elapsed every-24-hour intervals and event triggers. Existing Schedules ask users to type cron and existing Automations present event/action selections; neither explains the timing distinction or guarantees the user's separately required consent for exported WhatsApp digests. For personal users and business staff this ambiguity causes wrong delivery time expectations and inappropriate confidence in auto-send. This DEV slice adds **read-only timing education**, not a new executor or authorization grant.

## Test-first completed changes

1. **RED contract:** `apps/web/tests/routine-timing-preview.test.mjs`, commit `20c41cfb4bd326b874af9e23650559ef5de80bb6`, five Node source tests for correct existing clock usage, different trigger semantics, bounded/private GET, Overview entry and independent delivery approval. No native RED runner executed before implementation.
2. **GREEN page:** `apps/web/src/app/routines/preview/page.tsx`, commit `7a7f0565618885a9c960531745b53a351d6cb3bf`. Server-only, authenticated and GET-only; delegates to existing `@ai-comms-agent/email-agent-runtime/routines/time`, with next three exact UTC/local instants and offset. Handles daily/weekly 09:00-style calendar, 24 elapsed hours, once with explicit ISO offset, event without fixed time, invalid IANA zones and past one-off instants. Clearly says **Preview only — nothing saved or sent**. No schedule/job/proposal grant/database write, provider send, webhook or new public API.
3. **Overview:** `apps/web/src/app/overview/page.tsx`, commit `75cb3ac3586891df6d35492fe1d4cc9ff846589f`, adds preview action before existing Schedules/Automations entries. Overview-first home, Chat and private Catch-up unchanged.
4. **Test matcher refinement:** `86f49eb01d500bc58ba04091b046c61c19885000` aligns one cadence assertion with actual typed discriminant; `4169392676b6c6cfc92e23e5aa030b7cbe7e6048` asserts user-visible daily option instead of a non-existent explicit branch. No production code change.
5. **Integrated product phases:** `docs/superpowers/plans/2026-10-23-practical-email-assistant-roadmap.md`, commit `4d18e1923a628e6ec661d35dca3d0facaeff8ae5`, documents P0–P7 personas, correctness/privacy, verified priority, source coverage, two existing engines, user review, consent and WhatsApp release gates.

## Evidence, unresolved items and next action

**Source-only:** GitHub re-fetch of the page, Overview, tests and existing worker clock shows canonical helper and no write path, private login check, fixed 24-hour interval, local calendar/DST and explicit event/one-time instructions. A first static inspector reported 18/19 due to a test-only expectation looking for a synthetic `kind === "daily"` condition. Test corrected to assert the actual daily option. Re-run focused static assertions below.

**Not run:** Committed Node suite, seven existing worker clock tests, web/worker/shared TypeScript, authenticated browser, PostgreSQL, provider/voice, CI/Vercel or deployment. Tool-connected GitHub view is not a dependency-equipped checkout; never claim native tests or production readiness.

**Next on an equipped current `Development` SHA:**
```bash
node --experimental-strip-types --test apps/web/tests/routine-timing-preview.test.mjs apps/web/tests/catch-up-five-day-entry.test.mjs
cd apps/worker && node --import tsx --test tests/routine-time.test.ts
# return to repo root
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web exec vitest run tests/overview-first-entry.test.ts tests/briefing-c2-c4-contract.test.ts
```
Authenticated browser: invalid/missing login, UTC/Asia/Kolkata/America-New_York zones, DST spring skip/fall duplicate, weekly ISO weekday, one-off past/requires explicit UTC offset, keyboard/mobile, no network writes and no activated jobs. Then proceed to separately authorized **C3** negative grant/lease/provider runtime verification and C4 persona/source-coverage acceptance. **Do not** register C3, create new R1b persistence/migration, silently activate routines or send WhatsApp.

**Routing:** Significant source bugs to FIX-01, infrastructure/provider/CI/build/deployment to OPS-01, architecture/standing delivery consent back to owner review. No polling other roles; continue independent DEV work.
