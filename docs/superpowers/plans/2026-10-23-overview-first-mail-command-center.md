# Overview-first Personal Mail Command Center — implementation continuation (2026-10-23)

**Owner:** DEV-01 / Forge. **Requested target:** `Development`. **Phase:** 4 `implementation_in_progress`; no acceptance/activation/production authorization implied.
**Status:** Owner-authorized first-screen UX implemented in source; remaining feature phases retain existing consent/security/verification gates.
**Source of truth:** `docs/superpowers/specs/2026-10-18-personal-catch-up-and-routines-design.md`, `docs/superpowers/plans/2026-10-18-personal-mail-catch-up.md`, `docs/superpowers/plans/2026-10-18-assistant-routines-and-digests.md`, `docs/superpowers/plans/2026-10-20-ai-email-command-center-ux-rollout.md`, `docs/superpowers/plans/2026-10-20-r1b-safe-routine-proposals-implementation.md`.

## User goal and product decisions

One familiar Overview home screen should answer: **what matters, where to act, what can wait, and what I delegated**. Support everyday users, employees, small businesses and international organizations without requiring daily app visits. Returning after five days produces an accurate *personal* briefing of eligible mail; it never becomes employee inactivity monitoring or an admin mailbox access shortcut.

- Existing connected mailbox sync **continues independently of login**, as provider capabilities allow. Never create a duplicate raw-mail store. Ingest once in canonical PostgreSQL; derive immutable per-user briefing selections and source-linked summaries separately.
- Keep `last_foreground_visit`, `last_completed_review`, and `last_digest_delivered` conceptually separate. Opening Overview or receiving WhatsApp never automatically marks mail read or acknowledged. Coarse activity is per user, throttled and protected; no inactivity leaderboards.
- Per org/user/agent/authorized-mailbox selection shows the exact window, number of sources, time of last successful mailbox sync, missing coverage and late arrivals. Do not claim complete coverage when connectors are behind or sources are snippet-only.
- Explainable high/medium/low become **Needs attention / Worth reviewing / For reference**, with explicit reason, source link, uncertainty and separately identified suggested action. Surface deadlines only when supported by canonical evidence; human can adjust priority in later reviewed scope.
- `Schedules` and `Automations` stay separate existing trigger mechanisms underneath one future **Routines** experience. Daily 09:00 in a chosen IANA zone is not the same trigger as every 24 elapsed hours. Hourly minimum 60 minutes; weekly and one-off require precise recurrence/date semantics. Never create a second scheduler.
- AI can suggest a digest routine but cannot authorize it. Store immutable proposal/revision and review; a server-authenticated user must explicitly confirm exact mailboxes, timing, destination, limits and recipient. Editing material scope invalidates the scoped consent.
- WhatsApp is an **external export**: deliver only to a verified bound recipient through an approved Meta template or valid window, after checked scopes/permissions at execution and idempotent ledger transitions. Existing manual send approval stays mandatory until a distinct reviewed standing-digest authorization is implemented and verified. No full bodies, attachments, OTPs or secrets in an external briefing.
- Avoid broad autonomous sends, deletions, payments, surveillance, prompt-driven permission changes or unsupported promises about delivery.

## Superpowers-style phase-by-phase work and acceptance

### O0 — Overview as the entry point — SOURCE COMMITTED

- `/` redirects to `/overview`; sidebar/brand select Overview first; `/chat` remains available.
- Responsive Overview gives three concrete destinations: check original mail, ask Clara and manage current schedule/automation mechanisms.
- Authorized `/api/overview` advertises `catchUpAvailable` only from the existing `BRIEFINGS_ENABLED` server gate; the gated preview link is hidden otherwise. Clearly label workspace-wide metrics versus personal review. Do not synthesize personal counts.
- RED/GREEN structural contract: `apps/web/tests/overview-first-entry.test.ts`; update existing shell and Lovable tests to expect current owner choice.
- **Exit evidence:** committed source + 10/10 read-only source assertions. **Still required:** exact-tip Vitest/typecheck, authenticated keyboard/mobile browser, sign-in redirect and negative disabled-flag checks. OPS-01 owns deployment, not DEV-01.

### C3 — Source-grounded personal briefing worker — INTEGRATION ACCEPTANCE PENDING

- Reuse C1 grants, C2 immutable manifest/coverage, C3 canonical-source loader, Clara no-ambient-retrieval adapter, fenced lease/heartbeat and partial/retry state.
- TDD for revocation, deleted/revised sources, cross-user/agent/mailbox boundaries, injected email text, unsupported model dates/claims, transient 429/timeout/abort, concurrent claims, crash/restart and partial source coverage.
- Target worker tests `briefing-worker.test.ts`, `briefing-c3-wiring.test.ts`, `briefing-generation.test.ts` and disposable PostgreSQL grant/lease fixtures. Run db/Clara/email-runtime/worker typechecks at one exact Development SHA.
- **Gate:** do not register/turn on generation merely from source assertions. Only a separately authorized **disabled-by-default** worker registration after focused and negative/lease runtime evidence. FIX-01 owns substantial source defects; OPS-01 owns host/DB/migrations/CI.

### C4 — Personal five-day return and importance journey — NEXT UX ACCEPTANCE

- On `/overview`, eventually offer a trusted personal **Welcome back** card and a one-action path to the existing `/catch-up` screen. Derive the actual gap from per-user visit/review/coverage facts, not from organizational unread counts.
- 1/7/30-day window and permitted accounts; freeze a manifest and paginate late-synced sources. Show high/medium/low with evidence/source link, uncertainty and a human review/snooze action. Explicit empty/partial/error/revoked state.
- Test initial use, five-day away, 200+ message pagination, multi-mailbox, grant revoked mid-review, two devices, screen reader, low bandwidth and mobile. Never set read/review state just from a page visit.
- **Gate:** verified worker and authorized C4 browser acceptance, before treating the preview as an automated completed briefing.

### R1b–R2 — Reviewable AI routine definitions — PURE PREVIEW EXISTS, PERSISTENCE NOT AUTHORIZED

- Reuse `normalizeRoutineDraft`, `routineConfigHash`, `previewRoutineDraft` and R1a deterministic clock preview. Keep proposal text inert and sanitized.
- Next task, only after separate scope/authorization review: tenant-scoped proposal persistence and revision-bound user confirmation with live effective mailbox grants, role, agent bindings, recipient verification, quiet hours and exact config-hash compare; no LLM-driven confirm or hidden privileges.
- Test unknown fields, DST, exact time zone, 24h vs 09:00, stale revision, concurrent two-device confirm, changed recipient, revoked mailbox and preview-time mismatch with a disposable database.
- Keep all new routines paused/off; never infer that legacy Schedules/Automations form already authorizes digest sending.

### R3–R4 — Reliable execution and optional WhatsApp digest — FUTURE REVIEW/PROVIDER GATE

- Adapt the existing schedule/event trigger evaluation, durable occurrence and audit ledgers, retry fencing, source-grounded C3 summary and approval policy. Do not add a parallel automation worker.
- Show queued, generated, submitted, provider-accepted, delivered and failed as separate states with evidence. Bound duplicate prevention across worker restarts and user edits, and handle quiet hours, timezone, cancellation/revocation and missed occurrences.
- Require exact-scope standing consent architecture approval plus OPS-01 Meta Business sender, verified recipient, approved template, sanitized live integration. No current WhatsApp automatic dispatch is authorized.
- Test denied/expired consent, provider retry, mixed partial coverage, stale worker, no-provider, template rejection and cross-tenant negatives before any activation.

### E1 — Human-friendly intelligence — PROPOSED ENHANCEMENTS

- User priority correction and VIP preferences; source-backed action extraction (reply needed, invoice exception, decision pending), waiting-on-reply follow-up and safe suggestion/draft previews.
- Language choice including regional languages, accessible cards, plain descriptions, digest cost/volume controls and organization-aware but never org-wide-authorized inbox delegation.
- Measure source-support, omission, wrong-high-severity, permission denials and digest usefulness; review failures before expanding automation.

## Current exact next action and role handoffs

1. On **sanitized, dependency-equipped exact current Development SHA**, run `pnpm --filter @ai-comms-agent/web exec vitest run tests/overview-first-entry.test.ts tests/workspace-shell.test.ts tests/lovable-ui-migration.test.ts` and `pnpm --filter @ai-comms-agent/web typecheck`; then authenticated Overview/browser/mobile navigation and `BRIEFINGS_ENABLED=false` negative. Record actual SHA/output. These have **not** run in this connector-only session.
2. Independently resume C3 focused worker/DB negative and retry verification; only then C4 five-day UX. R1b pure proposal tests/typechecks also remain pending at current tip. Never activate C3 worker or create live routine/external delivery absent separate authority.
3. DEV-01 owns Overview/C3/C4 feature and R1b typed UX work. FIX-01 owns scheduler/tenant/security/source errors (including currently active mail-draft RBAC work). OPS-01 owns CI, Vercel, rollout, host, DB operational migrations, credentials, Meta/provider and the historical build-hook incident. Do not wait for their independent work.
4. Recheck `docs/project-control/NEXT_ACTION.md`, actual migration tip and concurrent active sessions before each new implementation slice. Append worklogs; never overwrite concurrent history. Phase 4 remains in progress.
