# AI Communications Repair and Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the owner chooses delegated implementation. Steps use checkbox syntax for tracking.

**Goal:** Make the reported mail/WhatsApp flows correct, understandable and verifiably testable, while preserving human approval and tenant boundaries.

**Architecture:** Repair existing PostgreSQL action ledgers, provider adapters, bounded tool execution and Next.js interfaces. Add a small shared host-owned operation-result contract rather than a second runtime. Reuse current authorization and worker dispatch; share presentation and review logic across Chat and manual UI.

**Tech stack:** Existing TypeScript, Next.js 15/React 19, PostgreSQL, Node test runner and Vitest; repository-pinned pnpm 12.8.1; Node24 for Docker verification and runtime.

**Spec:** [Approved repair design](../specs/2026-10-23-frontend-ai-repair.md). [Current evidence and branch reconciliation](../../project-control/sessions/DEV01-FRONTEND-AI-REPAIR-20261025.md). The original 26-case report is retained in the private workspace.

**Status:** Owner-approved implementation. Tasks0–7 are complete; Task8 final verification and live acceptance remain in progress. Source and production changes are recorded in the evidence checkpoint. Development is the integration branch; main is not modified.

## Global constraints

- Human approval remains required for email and WhatsApp sending; no automatic-send bypass.
- Actor permission AND saved agent permission AND mailbox binding AND provider capability checks remain enforced.
- Credentials and raw SQL/message content never appear in browser errors or test evidence.
- Existing immutable Clara vendor source remains untouched; host changes stay in application adapters.
- A blocked delivery prerequisite remains a release blocker; it is never relabelled a passing delivery test.
- Preserve local-first drafts, existing user data, existing saved policies and unrelated feature gates.
- Use real disposable PostgreSQL for persistence/locking/migration tests and test provider transports for deterministic failures. Production paths never use mocks.
- Test-first repair: reproduce the failure, record the failing assertion, implement the minimum fix, rerun, then commit the coherent change.
- No disabled tests, inflated assertions, weakened authorization, fake inbound messages or invented provider receipts to obtain green results.

## Review focus

1. A tool succeeds but its audit/result response fails: reconcile the same operation without sending twice. Task 2 tests this.
2. A draft changes while an approval is being requested or approved: require a new review; never dispatch changed content under old consent. Task 1 tests this.
3. A mailbox or role grant is revoked after proposal: approval and worker execution fail closed. Tasks 1 and 5 test this.
4. The same subject/body legitimately arrives twice or in two accounts: preserve distinct identities while preventing repeated ingest of one provider message. Task 4 tests this.
5. A delayed response arrives after changing agent, organization or conversation: do not display the old result or enable its action. Tasks 2 and 6 test this.

## Task 0 — Establish the actual source, deployment and test baseline

**Inspect:** repository AGENTS.md and current project-control records; package.json; pnpm-lock.yaml; scripts/verify.sh; scripts/manual-up.sh; scripts/update-and-up.sh; deployment configuration; apps/web/src/app/api/health/route.ts; apps/worker/src/index.ts.

**Deliverable:** a revision/runner/schema inventory and fresh failure list. No product change until the failure is reproduced on a known revision.

- [x] Recover a suitable checkout with current authorization and a clean working state; inspect existing attached worktrees before creating isolation. Pin source SHA and compare current main/Development changes relevant to this repair. Do not overwrite concurrent work.
- [x] Inspect lockfile, lifecycle/build hooks and repository install policy. Use pnpm 12.8.1 with a frozen lockfile; do not run the local pnpm 11.25.0 against this repository. Record Node and pnpm versions.
- [x] Run fresh workspace tests, typechecks and web build. Save command, SHA, result counts and exit code. Replace historical reports of 45 web and 9 worker failures with this baseline.
- [x] Identify the revision/image serving each web and worker instance and migration-ledger revision. If supported metadata is absent, add a non-secret build revision to an authenticated operational endpoint in Task 6. A 200 from /api/health is not database/worker readiness.
- [x] Reproduce one failed approval with a harmless local draft and collect a shared correlation ID, safe error code/SQLSTATE and whether the action row/audit record committed. Collect only needed schema metadata: columns/types/defaults/nullability/indexes/enums/ledger; no secret values.
- [x] If the running website predates 090cb66, test the existing mailbox-identifier/rendering fixes on a matching candidate before making a duplicate repair. A production rollout remains subject to Task 8 gates.

Verification commands after reviewed dependency setup:

```text
pnpm -r test
pnpm -r typecheck
pnpm --filter @ai-comms-agent/web build
bash scripts/verify-migration-chain.sh
```

Expected: a truthful baseline. A failing baseline is recorded and assigned, not accepted as release readiness. Verify the project's actual lint commands as well; do not assume the current web `next lint` script works with its installed Next/ESLint versions.

## Task 1 — Repair approval persistence and queue visibility

**Modify only where diagnosis proves necessary:**

- packages/db/src/email/actions.ts
- packages/email-agent-runtime/src/email-write-tools.ts
- apps/web/src/app/api/mail/actions/route.ts
- apps/web/src/app/api/mail/approvals/route.ts
- apps/worker/src/email/action-executor.ts
- next unused supabase/migrations sequence, only for proven schema drift; do not edit applied historical SQL.

**Tests:** add apps/web/tests/email-approval-persistence.integration.test.ts; extend apps/web/tests/email-send-draft-idempotency.test.mjs with behavioral integration coverage instead of relying on source patterns; extend the relevant worker executor tests located in Task 0.

**Interfaces:** retain createEmailAction(CreateEmailActionInput), getEmailActionForOrganization, listPendingEmailActionsForOrganization and decideEmailAction. AI and manual callers must share the same persisted action contract. Internal email status names remain unchanged.

- [x] Add a failing real-database case: create a draft as an authorized actor, request approval via AI service and manual route, reload queue, assert the returned action ID exists with correct organization/account/draft/requester, immutable snapshot and pending_approval status.
- [x] Add cases for fresh migrations and a supported upgraded schema. Assert required action columns, unique idempotency index and executing status are usable. Inspect all later migrations before treating old CREATE TABLE definitions as the active schema.
- [x] Add races: simultaneous AI/manual requests; same key/same content; same key/different content; concurrent draft edit. Assert at most one valid pending review, conflicting content gets 409, no provider send before approval.
- [x] Add approve/reject/expiry/cross-tenant/revoked-grant cases. Assert expired/rejected actions cannot execute; a second approval cannot create a second send; worker receives the reviewed snapshot only.
- [x] Reproduce the original SQL/service error, then fix only its verified cause. If a forward migration is required, prove it on disposable fresh and upgrade databases before any production proposal. Do not assume a missing migration from the generic banner alone.
- [x] Make queue reads and action reads use the same organization/account scope as creation. A response must not claim pending approval unless the action committed; audit failure after commit must return a reconciliable result rather than invite a duplicate request.
- [x] Run integration and worker cases with a test SMTP transport and Gmail stub. Assert one provider invocation after authorized approval, zero on denial/rejection/expiry, persisted provider outcome and safe reconciliation after timeout.
- [x] Commit the tested approval repair with its migration evidence, if any.

Primary test command: `pnpm --filter @ai-comms-agent/web exec vitest run tests/email-approval-persistence.integration.test.ts`. The test must require an explicitly disposable database setting and refuse the production target. Run the actual worker test file identified in Task 0 as well. Success means behavioral and persistence assertions pass, not merely matching SQL source text.

## Task 2 — Make action confirmations authoritative for every phrasing and channel

**Modify:** apps/web/src/app/api/chat/stream/route.ts; apps/web/src/app/api/voice/turn/route.ts; apps/web/src/lib/mail/action-feedback.ts; packages/email-agent-runtime/src/email-agent-loop.ts; apps/worker/src/agent/whatsapp-tool-runtime.ts.

**Create:** packages/shared/src/operations/result.ts, exported through the existing shared package entry; apps/web/src/lib/chat/operation-feedback.ts.

**Tests:** add apps/web/tests/current-turn-operation-results.test.ts; extend apps/web/tests/chat-voice-email-action-feedback.test.mjs, apps/web/tests/chat-host-tool-loop.test.ts and apps/worker/tests/email-agent-loop.test.ts.

**Interfaces:** define a discriminated OperationResult using channel, operation, state, turnId, callId, correlationId, resourceId when persisted, and safe errorCode when failed. Use channel-specific state variants described in the design. `formatOperationFeedback(results: readonly OperationResult[]): string` renders only host outcomes. `verifiedEmailToolSummary` may remain as a compatibility wrapper during migration; remove it only after all callers share the tested result path.

- [x] Add failing cases for the exact live Create, Update, Prepare and WhatsApp prompts, mixed read/write prompts, unsupported provider tool calls and a no-tool assistant response that says “Verified ... results”. Assert no mutation success card or delivery claim without a current verified result.
- [x] Assert prior assistant content containing old draft/action IDs cannot satisfy a new request. Bind results to current turn/call IDs and to an actually returned, organization-scoped resource. A model-supplied resource ID alone is insufficient.
- [x] Preserve successful draft output when approval subsequently fails. Assert the response explicitly distinguishes the two outcomes and links the real saved draft.
- [x] Add response-loss/audit-loss-after-commit tests and reconnect/retry tests. Reconciliation must use a persisted idempotency record; no blind new provider send.
- [x] Preserve tool schema validation, call/round budgets, read-only classification and fail-closed authorization. Fix Create/Update/Prepare recognition for clarification, but enforce authoritative results for ALL mutations regardless of lexical matching.
- [x] Test Chat and voice compatibility, provider text with forged success, abort after execution, delayed SSE after scope switch, unknown outcome and safe error mapping. No private reasoning or raw technical tool names in ordinary output.
- [x] Run focused web/worker tests and shared/runtime/web/worker typechecks; commit only after passing.

## Task 3 — Resolve account choices and preserve exact draft content

**Modify:** packages/email-agent-runtime/src/account-identifier.ts; packages/email-agent-runtime/src/email-read-tools.ts; packages/email-agent-runtime/src/email-write-tools.ts; packages/email-agent-runtime/src/email-tool-runtime.ts; apps/web/src/lib/mail/compose-identity.ts; apps/worker/src/agent/whatsapp-tool-runtime.ts; the current Clara host adapter guidance only where required.

**Tests:** extend apps/web/tests/email-account-identifier-resolution.test.ts and apps/web/tests/email-read-tools.test.ts; add apps/web/tests/draft-content-boundaries.test.ts and apps/web/tests/channel-account-selection.test.ts.

**Interfaces:** reuse resolveAccountIdentifier(organizationId, agentId, identifier). Keep existing draft tools. Derive WhatsApp account from the trusted agent binding when uniquely bound; if choosing is necessary, expose a human-readable account choice and carry its resolved ID server-side.

- [x] Run existing address/UUID-resolution cases, including case/whitespace, unbound mailbox and cross-tenant UUID. Verify the existing resolver fix dynamically before changing it.
- [x] Add zero/one/multiple mailbox cases. A unique explicitly named bound mailbox resolves; two eligible senders require a visible choice; revoked/disconnected accounts cannot be selected.
- [x] Add the exact live Body-plus-instructions regression. Assert recipient, subject and email body are structured separately; operational instructions such as request approval/do not send do not silently become message text. Preserve exact quoted body, whitespace and Unicode. If boundaries are ambiguous, show the proposed body for review rather than strip words heuristically.
- [x] Add draft update, reply and forward cases that retain sender/thread/recipients and invalidate any prior approval snapshot after changes. Reply targets come from authorized message records and validated addresses, not an invented thread ID.
- [x] Eliminate raw account_id/message_id questions for ordinary users. Provide a selectable mailbox/message when ambiguity is real; do not widen account authorization.
- [x] Run focused tests and runtime/web/worker typechecks; commit.

## Task 4 — Make summaries, deduplication and counts trustworthy

**Modify:** apps/web/src/lib/mail/rolling-summary.ts; apps/web/src/app/api/chat/stream/route.ts; packages/email-agent-runtime/src/email-read-tools.ts; apps/worker/src/email/mailbox-sync-worker.ts. Follow existing provider-specific parsing/repository code where diagnosis identifies the duplicate origin.

**Tests:** extend apps/web/tests/rolling-mail-summary.test.mjs and apps/web/tests/chat-rolling-mail-summary.test.ts; add apps/web/tests/mail-report-coverage.integration.test.ts; extend sync-worker identity tests found during Task 0.

**Interfaces:** return an authorized report evidence object with scope, fromUtc, toUtc, matchedCount, includedCount, hasMore/cursor and sync freshness. Counts represent canonical message identities within the selected accounts. The formatter and model writer consume the same evidence; neither invents totals.

- [x] Add failing requests for the detailed live prompt, output-column words sender/subject, specified mailbox, unread-only, sender/date constraints, empty results, exact 24-hour boundaries and malformed dates.
- [x] Assert metadata formatting requests do not become filters; real filters are never silently discarded. Unsupported filters produce a clear clarification result, not an unfiltered “all mail” report.
- [x] Insert duplicate representations of one provider message, legitimate same-subject messages, and copies in two mailboxes. Establish provider/folder UID identity before choosing a reconciliation strategy. Reingest is idempotent; legitimate distinct mail stays distinct. Historical repair is non-destructive and previewed separately.
- [x] Assert draft/sent mail exclusion, stable page boundaries while new mail arrives, zero/three/500/510 results and explicit incomplete coverage. A top-three result cannot be described as the mailbox's total unread count.
- [x] Ground summaries in fetched snippets/bodies and source links. Missing full bodies must be labelled; private content remains untrusted data and cannot trigger sends.
- [x] Run Node tests, Vitest integration and affected sync-worker tests; commit.

## Task 5 — Complete WhatsApp selection, readiness and allowed delivery

**Modify:** apps/worker/src/agent/whatsapp-tool-runtime.ts; apps/web/src/app/whatsapp/whatsapp-client.tsx; apps/web/src/app/api/whatsapp/send-actions/decision/route.ts; agent Policy/Channels components discovered in the checkout. Preserve existing Meta adapter and template validation.

**Tests:** extend apps/web/tests/whatsapp-send-approval.test.ts, apps/worker/tests/whatsapp-tool-runtime.test.ts and apps/worker/tests/whatsapp-send-tool.test.ts; add apps/web/tests/whatsapp-readiness.test.ts.

**Interfaces:** one server-derived readiness response consumed by Policy, Channels and WhatsApp. Distinguish loading, disconnected, bound-without-permission, template_required, ready and provider_error. Readiness is explanatory; approval/worker authorization still rechecks actual state.

- [x] Add consistency tests: the same connected bound phone cannot appear disconnected in Policy; missing saved tool permission is distinct from disconnected account; delayed responses after agent switch are ignored.
- [x] Assert AI proposal returns a persisted action ID matching queue content. Repeated turns with different test bodies create distinct requests; idempotent retries reconcile only identical actor/account/recipient/payload.
- [x] Add exact window boundaries, no-inbound, revoked binding, invalid/unapproved template, mismatched template parameters, recipient eligibility failure, provider timeout and delayed receipt cases.
- [x] Provide one actionable next step for a closed window: select an approved template or explain the required inbound conversation. Keep approval-time and worker-time rechecks; do not disable the 24-hour rule.
- [x] Verify Reject produces zero worker/provider sends. Verify allowed approval queues exactly once and records provider acceptance separately from delivery/read receipts.
- [x] Configure/verify a real approved-template or inbound-window prerequisite through the supported authenticated setup during Task 8; no fake webhook/inbound data or hard-coded approved template.
- [x] Run focused web/worker tests; commit.

## Task 6 — Simplify the frontend and repair error/loading behavior

**Modify:** apps/web/src/app/chat/chat-client.tsx; apps/web/src/app/chat/interactive-message-controls.tsx; apps/web/src/lib/chat/interactive-replies.ts; apps/web/src/app/mail/compose/compose-client.tsx; apps/web/src/app/mail/approvals/approvals-client.tsx; apps/web/src/lib/identity/authorization.ts; authenticated Operations/readiness endpoint and components discovered in Task 0.

**Tests:** extend apps/web/tests/chat-interactive-responses.test.mjs; add apps/web/tests/review-operation-state.test.ts and apps/web/tests/frontend-loading-errors.test.ts. Use the supported browser for keyboard/mobile and hydration checks; no new browser framework is required for the initial repair.

**Interfaces:** UI consumes Task 2 OperationResult and the existing immutable review snapshot helper. Show Draft saved, Awaiting approval, Rejected, Queued, Provider accepted, Delivered or Needs verification only when backed by the corresponding evidence. No raw internal enum names in normal labels.

- [x] Replace unconditional/repetitive follow-up panels with one relevant action on a successful answer; none after failure, denial or empty results. Preserve an explicit way to compose manually.
- [x] Share draft review presentation between Chat and Compose. Keep sender, exact recipients, subject and body visible together; edits invalidate approval; action links reference the current persisted record.
- [x] Add explicit loading states so empty accounts/drafts/queues are not shown while requests are pending. Distinguish loading error from an empty result and use stable server/client timestamp rendering to remove reproduced hydration mismatch.
- [x] Move granular agent tools and raw identifiers to Advanced/admin details. Preserve existing presets, grants, navigation, audit access and inactive feature gates. Sync provider draft remains a secondary action with truthful status.
- [x] Return a safe error message, operation reference and retry/reconciliation option from approval failures. Preserve HTTP status and tenant checks. Never present an unexpected database failure as a request to increase user permissions.
- [x] Diagnose the 502 using matching host/proxy/container timestamps and request IDs. Fix the demonstrated cause only; add bounded timeouts/cancellation and graceful error states where required. Do not claim readiness merely because the basic health route returns 200.
- [x] Verify keyboard flow, screen-reader labels, responsive widths 320/390/768 and desktop, loading/offline/scope-change races, and absence of recurring React hydration errors. Commit the tested UI slice.

## Task 7 — Make the complete automated test baseline green

**Scope:** all current failing tests in the affected web/worker/shared/db/Clara suites, not just new happy-path tests. No production feature expansion to accommodate stale fixtures.

- [x] Classify every Task 0 failure: actual regression, obsolete expectation, incomplete mock, runner/fixture/configuration problem or infrastructure dependency. Replace string-presence tests with behavior assertions where they concealed these failures.
- [x] Fix actual defects. Update an obsolete expectation only when current approved behavior proves it wrong; document why. Preserve rejection, revocation, tenant isolation and prompt-injection assertions.
- [x] Run all repository test entry points, including standalone Node .mjs suites not exercised by package-level Vitest scripts. Check each suite actually discovered and executed its expected tests.
- [x] Run typechecks, lint with a working pinned configuration, production web build, worker build and migration tests against fresh and upgrade fixtures.
- [x] Save final test totals, failures/skips, command logs and candidate SHA. All required tests must pass; explicitly scoped live-only prerequisites remain blockers rather than skipped green checks.

Core commands, supplemented by each package's checked-in verification scripts:

```text
pnpm -r test
pnpm -r typecheck
pnpm -r lint
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker build
node --experimental-strip-types --test apps/web/tests/rolling-mail-summary.test.mjs apps/web/tests/chat-voice-email-action-feedback.test.mjs apps/web/tests/chat-interactive-responses.test.mjs apps/web/tests/email-send-draft-idempotency.test.mjs
bash scripts/verify-migration-chain.sh
```

Node and source-contract tests complement, rather than replace, the real database and browser tests. Any additional standalone suite inventory found in Task 0 must be run too.

## Task 8 — Controlled rollout and rerun the live acceptance matrix

**Deliverable:** updated 26-case report with actual current evidence and explicit remaining blockers; same candidate SHA on tested web/worker instances.

- [ ] Review candidate diff, migrations and operational procedure. Obtain the supported deployment/log access and any applicable final production approval; preserve current production data. No destructive reset. Back up and prove restoration before an approved forward migration.
- [ ] Deploy via the existing reviewed path, verify image/revision/migration parity and worker readiness, then run read-only smoke checks. If a rollback is needed, retain schema compatibility and stop new dispatch until ambiguous outcomes are reconciled.
- [ ] Replay all 26 cases using fresh and longer conversations. Reset only labelled disposable fixtures; keep existing user mail unchanged. Record actual prompts, record IDs, safe references and screenshots.
- [ ] Send one harmless approved test email from each provider to the owner-approved test recipient; verify provider acceptance and independently verified recipient receipt. Do not double-send on refresh/retry.
- [ ] Test email rejection, expired approval, modified draft, duplicate approval, revoked role/binding and denied direct-send attempts. All must result in zero unauthorized dispatch.
- [ ] Complete one allowed WhatsApp test to the owner-provided WhatsApp test number after the real conversation/template and test-recipient prerequisites exist. Verify its provider message ID and delivered receipt. Recheck that the no-window/unapproved-template case still blocks.
- [ ] Cover reply/forward threading, attachments, malformed addresses, partial failure, permission-less disposable user and cross-tenant access. Externally consequential tests use test recipients and fixtures only.
- [ ] Update worklog/project-control evidence on the implementation branch and publish the final report. Mark the repair complete only when automation, all required browser cases and both channel delivery acceptance pass.

## Acceptance mapping to the original report

| Original cases | Responsible tasks | Required proof |
|---|---|---|
| 01 | 0, 3, 6 | Correct connected-account state and scope, including loading/error cases. |
| 02–05 | 4 | Exact report filters, deduplicated identities, truthful counts and coverage; detailed wording works. |
| 06–07 | 3, 1 | Exact draft content and real provider synchronization, no delivery claim. |
| 08 | 1, 2 | Unapproved sending remains blocked with zero provider calls. |
| 09–11 | 1, 2 | Correct persisted review visible to the authorized approver; no model-only success. |
| 12 | 3, 4 | Authorized existing-thread lookup and actual reply draft. |
| 13–17 | 1, 2, 3 | Fresh/long-chat Gmail create/edit/request work with exact current resource IDs. |
| 18 | 3, 6 | Invalid recipient rejected with clear frontend feedback. |
| 19–20 | 3, 5 | Human-readable account resolution and persisted WhatsApp proposal. |
| 21–22 | 5, 8 | Closed window still blocks; real approved-template/allowed-window delivery passes separately. |
| 23–24 | 2, 5 | Second distinct proposal persists and explicit rejection dispatches nothing. |
| 25 | 0, 6, 8 | Known serving revision, diagnosed host error, stable fresh-chat navigation. |
| 26 | 1, 7, 8 | Human-approved email delivery plus verified receipt for both tested providers. |

## Ready-to-start checkpoint

The owner approved native implementation, server deployment and labelled delivery tests. Tasks0–7 are complete. Continue Task8 from the current evidence checkpoint; do not repeat completed mutations or reset existing user data.
