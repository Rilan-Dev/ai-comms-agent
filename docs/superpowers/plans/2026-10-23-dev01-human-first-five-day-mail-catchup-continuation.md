# Human-first five-day mail catch-up and safe AI routines — DEV-01 continuation

**Owner / role:** DEV-01 / Forge • **Branch:** `Development` • **Date:** 2026-10-23 • **Phase:** 4 `implementation_in_progress`.

**Authorization:** The owner requested a practical assistant for individuals, employees, small businesses and international organizations that summarizes missed mail, prioritizes real work and eventually creates user-requested recurring digests with optional WhatsApp delivery. The current safe scope is **product planning, inert preview UX and already authorized source implementation**, not background dispatch, new RBAC grants, workplace attendance monitoring, automatic email sending or routine activation. This is a continuation of (not a replacement for) `2026-10-23-overview-first-mail-command-center.md`, `2026-10-18-personal-mail-catch-up.md`, `2026-10-18-assistant-routines-and-digests.md`, `2026-10-20-r1b-safe-routine-proposals-implementation.md`, and the 18 Oct Superpowers spec.

## Product problem, in everyday language

A returning user should be able to answer four questions in under one minute: **What happened since I last reviewed? What requires my action? What can wait? What has my AI actually done?** A small business might need customer replies and invoice exceptions; an employee may need decisions and deadlines; a person may need bills and important personal communication; a multinational user must handle multiple authorized accounts, language and time zone without assuming colleagues' access. Avoid a wall of inbox items, hallucinated urgency, approval ambiguity, hidden auto-sends, duplicate reminders and costly continuous summarization.

An absence of five days is **not** equivalent to an unreviewed-mail interval. Mail sync must run independently; actual `last_foreground_visit`, `last_completed_review` and `last_digest_delivered` are distinct per-user signals. There must be no attendance leaderboard or organization-wide shortcut into personal email. Until presence/coverage is fully modeled and authorized, present a **user-selected five-day lookback**, never claim automatic five-day absence detection.

## Release slices (Superpowers-style: test → bounded code → source check → equipped runtime acceptance)

### O0 — Familiar Overview first (already committed; acceptance pending)

- [x] Authenticated `/` redirects to `/overview`; Chat remains `/chat`; Overview-first navigation.
- [x] Three plain entry points: Inbox, Ask Clara, existing Schedules/Automations. Catch-up entry server-gated.
- [ ] Run Overview Vitest, web typecheck, authenticated desktop/mobile/screenreader and flag-disabled 404 acceptance at current SHA.
- **Exit:** No personal count inferred from organization metrics; no false status claims. OPS-01 owns production rollout.

### C1/C2 — Canonical personal mail, identity and reviewed coverage (source implemented)

- [x] Reuse provider-synced PostgreSQL mail; mailbox grants scoped to organization + person + agent; immutable source manifest and revision-backed review acknowledgments.
- [ ] Disposable Postgres checks for duplicate/revised mail, 200+ source pages, two devices, revoked grant, different organization/user/agent and stale revision.
- **Exit:** Reopening Overview does not mark messages read or reviewed; only explicit review of complete generated obligations can acknowledge work.

### C3 — Source-grounded priorities (code exists; generation worker remains off)

- [ ] Execute focused worker + Clara + DB typechecks and generation tests; verify tenant/grant/rate-limit/prompt-injection/quote offsets, deadlines, retries and fenced leases.
- [ ] Acceptance with a disposable seeded 5-day mailbox: exact sources and revisions, `Needs attention` (high), `Worth reviewing` (medium), `For reference` (low), evidence reasons, unknown coverage visibly partial.
- [ ] Separate authorization before registering disabled-by-default generator; do not activate from this plan.
- **Exit:** No fabricated deadline, delivery confirmation or summary of ungranted messages. Expose pending, partial, failed and invalidated states.

### C4a — Guided 5-day personal preview from Overview (this DEV-01 source slice)

- [x] Add **Review last 5 days** only behind the existing server `BRIEFINGS_ENABLED` response; retain unrestricted ordinary Inbox and Chat links.
- [x] Validate `?days=5` against fixed 1/5/7/30 UTC window presets on the private server page. Default direct `/catch-up` stays 7 days.
- [x] Show scope explanation and actual manifest period as UTC instants; never infer login gap or reset reviewed/provider mail state.
- [x] Reuse C4 bound-mailbox selector, source pagination, priorities and explicit **Mark this item reviewed**; no new database tables or external sends.
- [x] Add native Node behavioral/source regression. [ ] Run the checked-out native test/web TypeScript/authenticated browser acceptance.
- **Exit:** 5-day deep link has a bounded exact UTC period, is denied when feature-off/no grants, is not a completed AI-summary claim when generator is off, and returns source links only for authorized scope.

### C4b — Real “Welcome back / your next three actions” (future gated implementation)

- [ ] After C3 acceptance, expose per-person **review-gap**, last successful source sync, selected source count, omissions, late arrivals and revision-aware review progress on Overview using trusted existing C1/C2 state.
- [ ] Group threads to avoid duplicate asks. Per item include original mail link, quoted reason and confidence; offer optional human priority correction and preview-only suggested reply.
- [ ] Use 1/5/7/30-day presets initially; offer 90-day bounded custom lookback only with explicit source and API support. Low-bandwidth and assistive-technology acceptance required.
- **Exit:** Two users with identical org membership cannot see each other's private review state or ungranted mail; stale provider sync never shows “all caught up.”

### R1a — Understand schedules versus automations (pure preview exists)

- [x] Reuse deterministic `normalizeRoutineDraft`, `routineConfigHash`, `previewRoutineDraft` and clock helper, with existing schedule and event systems.
- [ ] UI differentiates **daily 09:00 local time in a chosen IANA zone**, **every 24 elapsed hours**, weekly, once and `email.received` event with minimum hourly interval and DST examples.
- [ ] Show next three fire instants and limits as a **proposal only**; never create running jobs just from natural language.
- **Exit:** A preview has zero side effects and is clearly marked not saved or scheduled.

### R1b/R2 — One user-friendly Routines surface over existing engines (review/consent gate)

- [ ] Persist a proposed `RoutineDraft` and immutable revision only after architecture/tenant-grant review; offer Edit, Confirm, Pause, Resume, History.
- [ ] Confirmation must be by authenticated human for exact authorized accounts, trigger, recipient, language, quiet hours, message limits and destination, with hash/revision compare-and-set. Default disabled/paused.
- [ ] AI chat/voice may suggest/preview a routine and explain evidence, but cannot mint permission, activate it or silently change the scope.
- [ ] Reuse `scheduled_jobs` for time triggers and `automation_rules` for event triggers under one UX; no second scheduler or competing occurrence ledger.
- **Exit:** stale revision, wrong tenant, expired consent, unauthorized account and changed recipient fail before writes.

### R3/R4 — Optional 09:00 WhatsApp digest after independent approval/provider gate

- [ ] Scope output to minimal source-grounded importance + action counts, not full body/attachment/secret. Require verified recipient, checked effective grants at execution, quiet hours, approved Meta template/conversation window and delivery ledger.
- [ ] Distinguish *scheduled, generating, queued, submitted, provider accepted, delivered, failed/expired* with true provider IDs; retries must be idempotent and bounded.
- [ ] Human-approved **standing digest consent** is different from ordinary email/WhatsApp send approval and requires separate architecture + security approval. Until then outgoing sends remain on existing per-action approval.
- **Exit:** Revocation, failed provider, skipped DST hour, duplicate restart, paused routines and expired consent yield no external message. OPS-01 owns real Meta/deploy integration.

### E1 — Prioritize usability, not feature count (later product acceptance)

- [ ] Plain-language statuses and 3-item action cards; regional language selection and accessible keyboard/mobile views.
- [ ] Optional VIP/important-sender corrections, waiting-for-reply nudges, per-user alert fatigue/quiet-hour controls and transparent cost/usage; no inferred staff performance.
- [ ] Track source coverage, accuracy, false high severity, missed deadlines, security denials and user correction rates. Never label unverified AI guesses as facts.

## Architecture and role boundaries

| Concern | Existing authoritative layer | Owner |
|---|---|---|
| Original messages, sync and provider capabilities | Canonical PostgreSQL + adapters/workers | Existing app; OPS-01 provider/runtime |
| Per-user authorization, immutable selections/review | C1/C2 DB briefing grants, manifest and review | DEV-01 scoped feature; FIX-01 defects |
| AI priority/summaries | Existing Clara + bounded C3 source-grounded worker | DEV-01 after source/integration verification |
| Daily, 24h, weekly and event triggers | Existing `scheduled_jobs` / `automation_rules` | DEV-01 feature; FIX-01 scheduler bugs |
| Sensitive writes and external WhatsApp | Host policy/executor/approvals, verified Meta sender | Security owner authorization; OPS-01 runtime |
| Deployment/CI/migrations/host health | Independent operational pipeline | OPS-01 |

## Immediate next on exact latest Development tip

1. Run `node --experimental-strip-types --test apps/web/tests/catch-up-five-day-entry.test.mjs`; focused `pnpm --filter @ai-comms-agent/web exec vitest run tests/overview-first-entry.test.ts tests/briefing-c2-c4-contract.test.ts tests/briefing-access-route.test.ts`; `pnpm --filter @ai-comms-agent/web typecheck`.
2. In an authenticated disposable org, test Overview link with flag on/off, `/catch-up?days=5` versus `?days=90`, no-grants, 200+ paginated sources, review explicitness, five-day period and separate accounts/users. Record SHA and outcome. No production data test or scheduled send.
3. Then C3 grant/lease/provider **negative/runtime** acceptance at the same SHA. Keep worker registration off until separately approved. Parallel R1a/R1b preview tests remain safe, while R1b persistence/activation and R3/R4 WhatsApp require their own authorization.
4. Hand substantial source defects to FIX-01 and deployment/CI/Meta/DB runtime failures to OPS-01. Do not poll CI/Vercel or infer acceptance from static source checks.
