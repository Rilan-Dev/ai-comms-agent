# Original Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Preserve the established native execution method; the owner approved the design and instructed proceeding on26 October2026.

**Goal:** Improve the original platform's daily usability and mixed Chat workflows while preserving the current theme, every business function and server control, and introducing reviewed configuration revisions.

**Architecture:** Use existing Next.js screens, typed host tools and PostgreSQL repositories. Correct request scoping first; add a scoped continuation checkpoint and a separate configuration-revision service behind existing authorized mutation adapters. Current mutable configuration becomes the active projection of reviewed revisions, with an independent immediate-revocation barrier; no future AI configuration executor is registered.

**Tech Stack:** Existing TypeScript/Next.js/React, PostgreSQL/pg, Clara runtime, Vitest/Node tests, existing Tailwind/theme components; no new framework/provider.

**Spec:** `docs/superpowers/specs/2026-10-26-original-screen-priority-and-versioning-addendum.md`, with its referenced25 October design and `docs/reviews/2026-10-26-original-screen-feedback-and-control-audit.md`.

## Implementation status — 28 October 2026

The detailed session ledger records the evidence for each checkpoint. A source checkpoint is not a claim of production acceptance.

- [x] Tasks 0–2: source inventory, mixed-request classification and scoped continuation implemented and source/database tested.
- [x] Task 3: source implementation of shared permission selection, sending-mode explanations and sender entry editing; enforcement of stored sender/rate rules remains unproven and must not be claimed.
- [x] Task 4: immutable configuration candidate foundation implemented and tested in a dedicated database; activation remains gated.
- [ ] Task 5: complete and accept governed configuration workflow, mutation boundaries, runtime consistency and revocation.
- [ ] Task 6: operational dashboard, on-demand identity and browser/mobile/keyboard acceptance. Identity disclosure has a source checkpoint; dashboard remains incomplete.
- [ ] Task 7: accept Policy, Channels and preserved AI settings draft workflows end to end.
- [ ] Task 8: complete and verify history, review, apply and restore interface.
- [ ] Task 9: complete interactive Chat workflows and verification.
- [ ] Task 10: inventory and improve remaining original screens with per-area verification.
- [ ] Task 11: whole-branch review, complete tests, guarded deployment and live acceptance. Resolve the container operation conflict before another release.

Task 8 source checkpoint: restoring now atomically selects the new candidate as the editor's recoverable draft, and rejects a restore when an existing working draft would be replaced. Isolated database regressions cover refresh, active-state preservation, legacy partial coverage and concurrent restore/save. The restore interface, complete review and production acceptance remain outstanding; the configuration feature stays gated.

## Global Constraints

- Preserve the current theme tokens, fonts, components, sidebar and all seven tabs.
- Keep original `AgentAISettingsPanel` layout,16 overrides,22 registered tools, custom/unknown policy keys, all roles, provider behavior and existing business controls.
- Development only; main untouched. Reconcile concurrent upstream normally; never force-push or reset another task's work.
- Save draft → Review changes → Apply/deploy for configuration; immediate recorded access revocation remains separate and cannot be undone silently by restore.
- Restore creates a new reviewed candidate; never replay communications, resurrect secrets or invent missing legacy snapshots.
- Inherited null keeps current-workspace-default semantics. Capture dependency fingerprints and reject stale apply; do not silently pin old defaults.
- Server authorization, tenant/binding/capability checks, immutable approval snapshots, expiry, revocation, idempotency and uncertain-outcome rules remain authoritative.
- Existing user prompt for acceptance: `Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails`.
- Latest3 means3 total in displayed assigned-readable-mailbox scope, canonical within each mailbox, most recent first; unread state unchanged.
- Continuation preserves exact summary/source IDs/recipient for15 minutes, rechecks current access, never silently reselects new mail.
- No configuration-write AI tools, RAG setup executor or standing-delivery expansion. Metadata/help foundations only.
- Dedicated test database: loopback `aca_repair_test`; no production credentials in automated tests. No destructive production reset.
- Use existing local dependencies when available; bounded Linux verification remains the fallback for Windows memory/runtime constraints.
- Label live external fixtures; review and approve at most one required harmless operation per intended test; never blindly resend.

## File structure and interfaces

- Request intent: existing shared `operations/human-approval.ts` and web `chat/draft-only-scope.ts` retain their exports. Tests use the actual functions and handler paths.
- Mixed task: new web `chat/mail-whatsapp-task.ts` parses/displays required stages; new db `conversation/task-checkpoint.ts` owns host-only scoped checkpoints in existing `content_json`; route and existing Chat components consume them.
- Configuration domain: new shared `agent/configuration-revision.ts` owns the typed snapshot/diff; new db `agent/configuration-revisions.ts` owns immutable candidates, atomic apply, baseline, restore and revocation barriers. Existing repository remains the active projection and read adapter.
- New web `lib/agents/configuration-commands.ts` centralizes field-specific authorization and dependency checks; existing APIs adapt to it rather than write around history. New revision APIs expose scoped draft/review/apply/restore; existing callers migrate explicitly.
- Dashboard: new web `lib/agents/operational-summary.ts` reads authorized agent-scoped facts, existing detail client displays them and an on-demand identity editor.
- Existing policy, Channels, AI settings, Versions, Test, Activity and Chat retain their screens/components; small extracted helpers only when needed to keep ownership clear.
- Allocate the first unused migration after0055 (planned `supabase/migrations/0056_agent_configuration_revisions.sql`). Recheck before writing; never rename/rewrite an applied migration.

## Review Focus

1. A WhatsApp task that mentions email only as source material must not lose its WhatsApp tool to the email draft-only guard (Task1/2).
2. Partial/custom policy and unsupported saved models survive all unrelated edits and catalog failures (Task3/7/8).
3. A concurrent default/role/revocation change defeats a stale draft/apply/restore without mixed-version runtime reads (Task4/5).
4. Refresh/duplicate continuation after new mail arrives never changes the reviewed summary or creates a second action (Task2/9).
5. Agent versus workspace counts, unknown readiness and incomplete historical snapshots never become fabricated dashboard/rollback claims (Task0/4/6/11).

## Task 0 — Source inventory and bounded baseline

**Files:** Create `docs/project-control/sessions/DEV01-ORIGINAL-WORKSPACE-20261026.md`; consume the existing audit, route inventory and screenshots. No product change.

**Interfaces:** Produces a table of existing control→field/API→side effect/authority→retained location, with current source HEAD and separate live revision. Preserve the established isolated clone on Development; do not create another checkout or move main.

- [ ] Record current state and agent/configuration callers; include independent setting endpoints, immediate unbind, original AI panel, raw/custom policy and preview-only routines.
- [ ] Run `node --experimental-strip-types --test apps/web/tests/email-permission-presets.test.mjs`.
  Expected:3 pass; no send or database mutation.
- [ ] From `apps/web`, run `node node_modules/vitest/vitest.mjs run tests/human-approval-directive.test.ts tests/chat-draft-only-scope.test.ts tests/explicit-human-approval.test.ts --maxWorkers=1 --minWorkers=1` with bounded heap.
  Expected: existing30 cases pass. Record new discovered failures as baseline evidence, do not weaken assertions.
- [ ] Commit inventory/session evidence with current independent-upstream boundaries.

## Task 1 — Correct mixed request scoping and explicit review intent

**Files:** Modify `packages/shared/src/operations/human-approval.ts`, `apps/web/src/lib/chat/draft-only-scope.ts`; tests `human-approval-directive.test.ts`, `chat-draft-only-scope.test.ts`, `explicit-human-approval.test.ts`.

**Interfaces:** Existing `requiresHumanApproval(message:string):boolean`, `isDraftOnlyRequest(message:string):boolean`; no additional grants/context authority. Task2 consumes the corrected trusted classification.

- [ ] Add failing exact-prompt assertions: `requiresHumanApproval(prompt) === true`, `isDraftOnlyRequest(prompt) === false`. Cover noun/verb request variants, reverse sentence order, no period, literal/fenced payloads, negated directives and true draft-only email mentioning WhatsApp.
- [ ] Derive handler context from the actual helper for the exact prompt; assert WhatsApp action pending and queue spy0 with autonomous policy true. Existing autonomous=false-directive controls remain unchanged.
- [ ] Run the three focused files; Expected: new assertions fail for the two actual classifiers/handler queue result, not loader errors.
- [ ] Implement explicit noun-form review parsing and email-compose intent classification. Mere email/unread source mentions cannot create a draft-only restriction; genuine compose/draft-only requests retain the restrictive executor wrapper. Preserve literal/negation boundaries.
- [ ] Rerun all focused cases and actual package typechecks. Expected: all pass; no previously denied draft-only tool becomes permitted.
- [ ] Commit `fix(chat): recognize mixed WhatsApp review requests safely`.

## Task 2 — Complete mixed task and safe continuation

**Files:** Create `apps/web/src/lib/chat/mail-whatsapp-task.ts`, `packages/db/src/conversation/task-checkpoint.ts`, `apps/web/tests/mail-whatsapp-task.test.ts`, `apps/web/tests/mail-whatsapp-checkpoint.integration.test.ts`; modify Chat stream route, db exports and existing feedback. Integrate Task1 classifiers.

**Interfaces:** `parseMailWhatsAppTask(message:string): MailWhatsAppTask|null` captures bounded latest-unread count, explicit recipient/account and human-review intent. `saveMailTaskCheckpoint(input:MailTaskCheckpointInput):Promise<CheckpointRef>` and `loadMailTaskCheckpoint(scope:CheckpointScope,ref:string):Promise<MailTaskCheckpoint|null>` keep exact generated body,3 source IDs/scopes/as-of, original host operation identity and15-minute expiry in host-written message metadata. `continueMailWhatsAppReview(scope,ref):Promise<OperationResult>` rechecks authority and atomically reconciles the one existing/pending action.

- [ ] RED: exact owner task requests authorized latest3 total, stable order/canonical scope and no mark-read; zero/fewer matches truthful; unsupported scope clarifies. A stopped model cannot claim completion after only discovery/search.
- [ ] RED: checkpoint refresh retains original summary despite new mail; expiry/revocation/tampered client body denied; concurrent continuation returns same action; rejected/queued/sent/uncertain outcomes are never replayed.
- [ ] Use existing email/WhatsApp registered tools and host receipts. Permit at most one bounded missing-stage continuation, no successful mutation replay. Return actual partial progress and a typed continuation reference when safe; no generic email-Drafts instruction for a WhatsApp failure.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/mail-whatsapp-task.test.ts` in web; then isolated integration config for checkpoint behavior. Expected: new behavioral tests fail first, then all pass.
- [ ] Commit scoped completion/checkpoint implementation; do not register generic configuration tools.

## Task 3 — One policy selection and accurate mode/help

**Files:** Existing `email-permission-presets.ts`, `agent-detail-client.tsx`, WhatsApp permission/readiness descriptions, Chat permission previews; new `apps/web/src/lib/agents/effective-policy.ts`, `apps/web/tests/effective-agent-policy.test.ts`; existing preset tests.

**Interfaces:** `describeEffectiveAgentPolicy(input:EffectivePolicyInput):EffectivePolicySummary` derives preset/custom and capability/mode effects from current allowedTools, autonomous flag, actor/account capability inputs; never persists another high-level enabled flag. Existing preset mapping remains authoritative.

- [ ] RED matrix: no send tool in either mode grants nothing; enabled/review stays pending; enabled/automatic preserves existing policy; explicit human-review overrides both. Partial tool changes derive Custom; unknown keys survive; off semantics unchanged.
- [ ] Replace contradictory never-auto-send labels with capability language and a visible actual mode. Keep22 controls and one autonomous editor; custom JSON cannot compete with it.
- [ ] Add entry-aware sender list editing with current100-string round-trip, accessible add/remove/paste, no invented wildcard/email grammar. Inventory sender/rate consumers and behavioral proof; label unverified protection honestly until original semantics/enforcement are established.
- [ ] Run preset/effective-policy tests; Expected: RED→GREEN matrix and preserved current negative checks. Commit focused helpers/copy without changing saved policy values.

## Task 4 — Immutable configuration domain and database candidates

**Files:** Create shared `agent/configuration-revision.ts`, db `agent/configuration-revisions.ts`, additive0056 migration after verifying availability, db exports, `apps/web/tests/agent-configuration-revisions.integration.test.ts`; retain legacy version tables/data.

**Interfaces:** `AgentConfigurationSnapshotV1` includes identity, complete custom policy/tool/sender/rate fields, complete binding roles/WhatsApp reference,16 nullable AI values, legacy version config and nonsecret dependency fingerprint. `createAgentConfigurationDraft(scope,snapshot,expectedActiveRevision):Promise<Revision>`; `reviewAgentConfigurationRevision(scope,id):Promise<RevisionReview>`; `restoreAgentConfigurationRevision(scope,id,expectedActiveRevision):Promise<Revision>` creates a new candidate. Shared `diffAgentConfiguration(before,after):ConfigurationDiff` covers all changed fields without secrets.

- [ ] RED real-PG: baseline captures saved state without applying changes; immutable candidates; no-op/invalid draft; complete unknown-field round-trip; legacy partial history identified; cross-tenant/history field access denied; secret values absent.
- [ ] Add immutable payload records, active/draft/deployment links and scoped dependency metadata using existing transactions/constraints. Seed real baseline lazily or via reviewed migration without rewriting legacy versions or invoking providers.
- [ ] Run dedicated-PG suite (loopback aca_repair_test guard required), migration structure/chain checks and shared/db types. Expected: RED behavior then GREEN; failure rolls back all inserts.
- [ ] Commit domain/migration/repository without claiming live activation or applying production migrations.

## Task 5 — Governed commands, atomic apply, runtime consistency and revocation

**Files:** New web `lib/agents/configuration-commands.ts`; agent revision route handlers; existing identity/policy/channels/AI/version/deploy handlers; db agent/AI repositories and runtime read adapters; new `agent-configuration-apply.integration.test.ts` and route tests.

**Interfaces:** `applyAgentConfigurationRevision(scope,revisionId,expectedActiveRevision):Promise<AppliedRevision>` validates each changed section, current creator/applying actor authority, dependency fingerprint and connected resources, then atomically updates active projection/pointer and deployment/audit. `revokeAgentAccessNow(scope,changes,expectedActiveRevision):Promise<AppliedRevocation>` permits only explicit deny/removal, records barrier/history and never stages broadening. `loadActiveAgentConfiguration(scope):Promise<ActiveConfiguration>` reads one consistent revision plus current deny barrier; current operation/dispatch authorization remains fresh.

- [ ] RED: concurrent editors/default change/revoked creator/deleted account/invalid model/stale apply all reject; injected failure leaves old active state; repeated apply idempotent; consistent turn snapshot; current immediate revoke blocks old candidate/restore; old JSON history cannot fabricate a full rollback.
- [ ] Inventory every mutation caller. Adapt existing endpoints and Chat permission forms to drafts/reviews; prohibit hidden legacy active-write bypass. Apply keeps the strongest existing deployment and per-field authorization. No secret replay or provider calls inside apply.
- [ ] Run route tests plus isolated-PG apply/restore/contention suites and types. Expected: all gates pass, history attributed, no partial active settings or business-action replay.
- [ ] Commit; activation UI is not released over incomplete adapters.

## Task 6 — Operational Overview and on-demand identity

**Files:** Existing agent detail page/client; create `lib/agents/operational-summary.ts`, scoped read API and `agent-operational-summary.test.ts`. Existing global overview/catch-up components are later Task10, not replaced here.

**Interfaces:** `getAgentOperationalSummary(scope):Promise<AgentOperationalSummary>` returns authorized attention/action references, scoped counts/coverage, recent outcomes and active/draft state; unknown differs from0. Task5 provides revision status.

- [ ] RED query/access cases: non-admin/read-revoked scoped omission, unrelated organization/account excluded, partial sync explicitly bounded, pending/failure distinct from delivered; no mark-read.
- [ ] Preserve theme/header/tabs/sections, prioritize actual attention/current work, frequent actions then compact state. Identity fields open only via Edit details; preserve all values, cancel and dirty-state. Conditional setup coaching only.
- [ ] Run summary tests and browser verify original-theme baseline, closed identity, working edit/cancel, true counts/loading/errors,320/390 section reachability and keyboard focus. Do not add mirrored CSS/string tests for a simple disclosure.
- [ ] Commit original-screen UX changes with unchanged theme tokens/AI layout.

## Task 7 — Policy/Channels draft forms and preserved AI panel

**Files:** Existing agent detail client and original `agent-ai-settings-panel.tsx`; helpers/components in `lib/agents`; route/UI behavioral tests.

**Interfaces:** Task3 summary and Task5 scoped draft/review/apply commands. Form dirty state records only touched fields and correct base revision; one panel save cannot clear unrelated overrides/custom keys.

- [ ] RED: preset and granular forms agree; exact binding role update, multiple primary accounts and one WhatsApp preserved; staged assignment versus immediate Revoke are distinct; stale state conflicts; null/custom/inherited AI settings survive catalog failure and unrelated edits.
- [ ] Keep original AI panel layout and16 controls/LiveModelSelect. Add concise help, draft/active status and scoped Save draft; no generic replacement. Keep list/JSON/custom tools and explain effective authority.
- [ ] Run focused form/API tests and original-browser journeys including unavailable connection/partial save, keyboard and mobile. Expected: all fields map correctly; no active mutation before reviewed apply, no tab navigation mutations.
- [ ] Commit each coherent form adapter with its proof.

## Task 8 — Real history/review/apply/restore interface

**Files:** Existing Versions/Test/Activity areas; typed revision review component; route tests and current account/policy/API adapters.

**Interfaces:** Task4 diff/legacy metadata and Task5 commands. UI shows actual draft/active/deployment/history state; Restore creates a candidate, not an immediate overwrite.

- [ ] RED: legacy partial version labelled; no Apply before complete current validation; conflict is actionable; failed apply retains active revision; permissions/secrets hidden appropriately; immediate revocation cannot disappear via restore.
- [ ] Display concise change summaries with exact details on demand, current dependencies and specific Apply/Restore labels. Preserve existing version JSON/history and original diagnostics scope; never claim a saved draft is deployed.
- [ ] Run revision route/database gates and browser create→review→apply→history→restore-to-draft journeys using disposable scoped fixtures, no communication side effects. Commit.

## Task 9 — Current-style interactive Chat cards

**Files:** Existing `chat/chat-client.tsx` and inline review components; small task/checkpoint card component; existing streaming/SSE and operation feedback tests.

**Interfaces:** Task2 typed scope/checkpoint/action references; existing draft/message approvals and Task5 configuration previews for manual navigation only. No configuration execution tool registration.

- [ ] RED: safe actual stage/summary feedback, exact recipient/body review, edit creates replacement/reapproval, no approval while unsaved, cancelled/expired/revoked continuation blocked, refreshed task never reselects mail silently or queues twice.
- [ ] Add optional task chips/pickers/contextual help within current Chat look; keep free-text/voice/history/agent picker and every existing inline draft function. Ask only missing/ambiguous information. No settings/credentials indexed into RAG.
- [ ] Run Chat/voice/shared operation tests and actual browser/mobile/keyboard walkthroughs. No live send for UI-only proof. Commit.

## Task 10 — Extend priority/help to original project areas

**Files:** Original routes listed in the26 October audit, not a replacement app; extend the control/function inventory and session evidence per area. Preserve routine preview gate, original AI Provider Setup and safe secrets entry.

**Interfaces:** Reuse current theme, contextual-help metadata `{key,label,purpose,validationReference,authorityCategory}` and governed command contracts only for real integrated configuration resources. Each area identifies its own primary user job and existing backend calls.

- [ ] Inspect each original page/control before editing; inventory accounts/mail/drafts/approvals/threads, scheduling, knowledge, activity/audit/operations and workspace settings. Live inspection coverage stays distinct from source inventory.
- [ ] Apply attention/current-work-first and on-demand rare editing per area's job, not blanket card removal; reuse original working layouts. Configuration resources join draft/review/apply/history only when complete backend adapters/tests exist. Operational actions keep their own existing audits and consent.
- [ ] Run owning focused behavior checks and browser journeys per changed area; preserve every function and role. Record remaining explicit independent feature gates, never silently enable them. Commit per area.

## Task 11 — Whole-branch review, complete verification and guarded release

**Files:** Existing verification/deploy scripts, session/report/worklog/project-control records. Do not introduce a new deployment platform.

**Interfaces:** Exact committed Development candidate, verified migrations/active revision and control inventory. Fresh whole-branch reviewer once under executing-plans; fix important findings with observed RED→GREEN and full renewed gates.

- [ ] Verify every original control/field/endpoint/caller maps to working retained behavior and original theme/AI layout. Each review-focus condition above has its owning regression.
- [ ] Run all web/worker/shared/Clara/standalone suites, dedicated PostgreSQL suites, package types, lint, production builds and migration gates with pinned tooling. Expected:0 unexplained failures/skips; no source test removed just to obtain green.
- [ ] Back up/prove restore before approved forward migration; retain compatible rollback images/config. Guard serving source/images, active dispatch/sync/jobs and concurrent operator changes; never reset production or remove infrastructure containers.
- [ ] Deploy exact verified artifacts through existing Development path. Verify revision/migration parity, real worker readiness, authenticated read-only health and browser original-screen matrix.
- [ ] Execute only required labelled owner-recipient acceptance with separate human review; verify persisted pending/noqueue, exact snapshot and actual provider receipt. If external access blocks a test, record it without replay or false pass.
- [ ] Publish exact test counts/evidence/limits, final function/theme preservation and all ledger rulings; update Development and leave main unchanged. Do not mark project-wide unrelated gates complete.

## Plan self-review and execution decision

Coverage: Tasks1–3 own classifier/receipt/capability semantics; Tasks4–5 own full revision lifecycle and inheritance/revocation; Tasks6–9 own the eight original-screen comments and current Chat; Task10 owns the broader source inventory/application; Task11 owns fresh review/release proof. Inputs and outputs are named above; later tasks cannot substitute UI labels for missing persistence. New source evidence showed the mixed prompt is actually misclassified draft-only, so Task1 fixes this before any missing-stage orchestration.

Owner approval/proceed is already supplied. Continue the established native method in the existing isolated Development clone, task by task, without another execution-method question. If source changes require a design decision outside these constraints, record the smallest justified ruling or ask only when genuinely dependent on missing owner intent.
