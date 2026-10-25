## DEV-01 — frontend AI repair continuation — 2026-10-25

Development contains current main; main remains untouched. Exact release **4898fa33** passed **1,809 tests**, types/lint/build/migration checks and guarded deployment. Current Operations and both containers confirm that revision and health. Natural reply drafting now preserves exact provider body and thread headers with zero sends; explicit WhatsApp human review stays pending despite the saved autonomous policy. After one manual approval, Meta rejected the fresh labelled test with **131005 Access denied**. Read-only diagnostics confirm valid token, messaging scopes, correct phone/account and subscriptions; owner was asked to inspect Meta sending restrictions. Earlier genuine WhatsApp Read and both independent email CC receipts remain historical evidence. See [current session](sessions/DEV01-FRONTEND-AI-REPAIR-20261025.md). Task8/phase remain implementation_in_progress pending fresh WhatsApp delivery. Preserve existing grants, policies, data and concurrent scheduling features.

---
# CHAT_CONTINUITY.md — Fresh-Conversation Recovery Protocol

> **Latest DEV-01 continuation (2026-10-18):** Start at [DEV01-CATCHUP-ROUTINES-20261018](sessions/DEV01-CATCHUP-ROUTINES-20261018.md) and the latest NEXT_ACTION checkpoint for the new personal catch-up/routines proposals, owner-selected consent, current baseline evidence and FIX-01/OPS-01 handoffs. Recover older active sessions without closing them. Planning is complete; feature implementation/acceptance remains pending the recorded review and dependency gates.


This file is the canonical procedure a fresh ChatGPT (or Z.AI) conversation must follow to recover full project state from the repository alone. **No conversation history is required.** If the procedure fails, Phase 1 is not complete and `ISSUES.md` must be updated.

---

## 1. The recovery invariant

A fresh ChatGPT session, given only the GitHub repository URL and no other context, must be able to determine:

```text
current phase
last completed phase
current commit
last verified commit
open issues
open risks
next authorized task
developer handoff
```

If any of these cannot be determined from the repository alone, the project-control documentation is incomplete.

---

## 2. Recovery procedure (for a fresh ChatGPT or Z.AI conversation)

### Step 1 — Clone the repository

```bash
git clone https://github.com/Rilan-Dev/ai-comms-agent.git
cd ai-comms-agent
git log --oneline -50
```

Note the latest commit SHA and the most recent commit message. The commit message indicates which phase the work belongs to.

### Step 2 — Read the entry-point documents in this order

1. `README.md` — project identity, operating model, current state, repository layout, reference library.
2. `AGENTS.md` — mandatory first-read for any AI agent. Rules, reading order, document map.
3. `docs/project-control/PROJECT_STATE.md` — one-screen project status (phase, commit, blockers, next action).
4. `docs/project-control/CURRENT_PHASE.md` — current phase scope, status, exit criteria.
5. `docs/project-control/NEXT_ACTION.md` — the exact next authorized action.
6. `docs/project-control/ZAI_HANDOFF.md` — the active formal handoff, if any.
7. `docs/project-control/VERIFICATION_STATE.md` — what was actually verified (machine-readable).
8. `docs/project-control/DECISIONS.md` — architectural decisions log.
9. `docs/project-control/ISSUES.md` — open issues.
10. `docs/project-control/RISKS.md` — open risks.
11. `docs/project-control/RULES.md` — full operating rules (the master prompt, condensed).
12. `worklog.md` — audit trail (append-only; read from the bottom up for the most recent state).

### Step 3 — Read the architecture documents relevant to your assigned scope

If your scope is broad (e.g., Phase 2 application foundation), read all of `docs/architecture/`. If your scope is narrow (e.g., Phase 6 Gmail), read at least:

- `docs/architecture/ARCHITECTURE.md` (overall)
- `docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md` (provider model)
- `docs/architecture/CLARA-INTEGRATION.md` (what to reuse)
- `docs/specs/PROVIDER-CONTRACTS.md` (contracts)
- `docs/plans/ROADMAP.md` (your phase's exit criteria)

### Step 4 — Determine the recovery answers

After reading, you must be able to answer:

```text
What was planned?        → docs/plans/ROADMAP.md + docs/project-control/CURRENT_PHASE.md
What was completed?      → worklog.md + docs/project-control/PROJECT_STATE.md
What was actually verified? → docs/project-control/VERIFICATION_STATE.md
What failed?             → docs/project-control/ISSUES.md + worklog.md
What remains?            → docs/plans/ROADMAP.md (phases not yet closed)
What is the next authorized action? → docs/project-control/NEXT_ACTION.md
```

If any answer is missing or ambiguous, **STOP** and report the gap to ChatGPT before doing any work. Do not fill gaps from conversation memory — only from the repository.

### Step 5 — If your scope touches AI, voice, RAG, embeddings, tools, or agent runtime

Inspect the Clara library:

```bash
git clone https://github.com/Rilan-Dev/ai-reusable-libraries.git
cd ai-reusable-libraries/clara-core
cat README.md AGENTS.md REFERENCE-MAP.md IMPLEMENTATION-PLAYBOOK.md
```

Then navigate to the specific modules relevant to your scope using `REFERENCE-MAP.md` as the index. The rule is: do not recreate Clara functionality; reuse, adapt, or — only if genuinely necessary — write application-specific code.

### Step 6 — Resume work only with a valid handoff

If `ZAI_HANDOFF.md` contains an active handoff (`active_handoff: true`), Z.AI may resume work on that handoff. If not, Z.AI is in STOP state and must wait for the next ChatGPT architect instruction.

---

## 3. Self-test: continuity check

Before considering the project-control architecture complete (this is part of Phase 1 exit criteria), perform the following self-test:

1. Pretend the current ChatGPT conversation no longer exists.
2. Clone the repository into a fresh workspace.
3. Follow the recovery procedure above.
4. Verify all seven recovery answers can be determined from the repository alone.

Phase 1 self-test result: **passed**. A reader following `AGENTS.md §3` reading order can recover full project state from the repository alone. The continuity check is recorded in `VERIFICATION_STATE.md` under `evidence.continuity_test_performed: true`.

---

## 4. When the recovery procedure fails

If a future reader finds the recovery procedure fails (an answer is missing, ambiguous, or requires conversation history):

1. **STOP** — do not improvise the answer.
2. Open a new issue in `ISSUES.md` describing the gap.
3. If the gap is architectural, also record a proposed decision in `DECISIONS.md` (status: `proposed`).
4. Append a note to `worklog.md` describing the gap and the proposed fix.
5. Wait for ChatGPT to resolve the gap before continuing.

The recovery procedure is the canonical test of project-control completeness. Failures are not minor — they break the project's source-of-truth invariant.

## APCP Adaptive Control Layer

For adaptive continuation and fresh-session recovery, also read `docs/project-control/NAVIGATION.md` and `docs/project-control/ADAPTIVE_PROJECT_CONTROL.md`. These documents add governance/navigation only and do not change the current implementation plan.

Fresh sessions must recover current phase, active scope, authorization/handoff, blockers, verification state, lessons and `NEXT_ACTION.md` from repository state. Do not depend on prior ChatGPT/Z.AI conversation memory.

A phase/task/checklist stop is a durable boundary. Inspect the current documents and determine whether the next action is already authorized before proceeding; do not infer authorization from a commit. When authorized independent work exists, do not wait or repeatedly poll for CI/CD, Vercel, deployment, review or verification.

Current owner requirements may change earlier requirements. Material changes require impact analysis and updated/superseding authorization; completed work may be reopened when the current authorized requirement requires it. Rules-only governance updates must not mutate product scope or implementation plans.

Use the copy/paste commands in `ADAPTIVE_PROJECT_CONTROL.md` for Continue, Execute Next, New Requirement, Change Requirement, Modify Implementation, Stopped Boundary, and Route Blocker.

## APCP agent invocation layer

Fresh sessions may be started for a specific APCP role without depending on another agent's chat history.

Before role-specific work, read:
- `docs/project-control/NAVIGATION.md`
- `docs/project-control/AGENT_REGISTRY.md`
- `docs/project-control/AGENT_SKILLS.md`
- `docs/project-control/AGENT_INVOCATION.md`

Then recover the normal project-control state and execute only the work authorized for the invoked role.

A new FIX-01 or OPS-01 session does not need DEV-01 to stop first. Likewise, DEV-01 does not wait for a pending FIX-01/OPS-01 task when independent authorized development exists.

The role prompt is an execution instruction, not a source of project authority.


## Independent-agent continuity extension

The same repository-first recovery model applies to DEV-01 / Forge, FIX-01 / Sentinel, OPS-01 / Shipwright, and WORK-01 / Rover.

A fresh role session reads AGENT_MEMORY.md first, then central events/sessions/handoffs/backlog, then its role-local MEMORY.md/WORKLOG.md, then the normal project-control state. This allows any agent to be invoked without a project briefing or previous chat transcript.

WORK-01 may execute SAFE-LOCAL or already AUTHORIZED daily work, but it cannot bypass authorization for a MATERIAL-CHANGE. Memory is supplementary; repository truth and current authorization remain authoritative.


## Human invocation and fresh-chat usage

The user does not need to carry project context between chats. For a fresh session, the preferred copy/paste instructions are in `docs/project-control/HOW_TO_USE_AGENTS.md`. The invoked agent must recover the project from GitHub and durable project-control records rather than requiring the previous conversation.

The user may invoke DEV-01, FIX-01, OPS-01, or WORK-01 while another agent is active. The new session must work independently, avoid conflicting edits, route dependencies, and continue any independent valid work without repeated waiting/polling.

## Latest continuation snapshot — 2026-10-10

Current working branch for the latest FIX-01 corrections is `fix/migration-verification-phase4-contract`. GitHub commits corrected worker test-runner/ESM incompatibilities, provider discovery retry, IMAP encoded-word parsing, provider-event informational metadata, and test contracts/mocks for Clara indexing, IMAP literals, Zoho refresh/account discovery, and email-action approval/recovery.

Do not infer test or deployment success from the commits. Tests, typechecks, build, live integration, and deployment remain unverified in this continuation. The exact next action is in `docs/project-control/NEXT_ACTION.md`; verification truth is in `docs/project-control/VERIFICATION_STATE.md`. Keep the local lockfile and backup files intact, and continue without waiting for GitHub Actions or Vercel.



## Latest continuation snapshot — 2026-10-10, user test feedback

User-run output: email action contract 8/8 passed; migration verification 85/86 passed (lockfile header count differs in /docker/ai-comms-agent from GitHub's current branch lockfile, which has one of each top-level header); worker suite 79/81 passed (IMAP multiple-literal and scheduling-idempotency assertion failures). Targeted test fixes are now committed in a666d98b8b9f1e437355c392d01c42a9dc54bfe9 and bb987c60129ebd1d4f3d5bd8f132068859ffb6c2. Web/worker typechecks showed no errors. Next: pull latest branch, re-run focused tests, and diagnose realpath pnpm-lock.yaml plus git status --short/header grep in the user's runtime; preserve local backups. Do not claim full suite, build, integration, or deployment success until observed.


## 2026-10-10 follow-up
User reran focused tests: scheduling idempotency passes; IMAP multiple-literal test failed because regex `/BODY\[\] {5}/` interprets `{5}` as quantifier rather than literal marker. Corrected both marker regexes in commit b87d5bc804331470a280bf54ee020b463a186d5f. User's local lockfile inspection found duplicate headers at lines 2 and 159, and `git status` shows tracked `pnpm-lock.yaml` modified plus four untracked backup artifacts. GitHub branch lockfile has a single header pair. Next: pull latest, run focused IMAP test; inspect `git diff -- pnpm-lock.yaml`, preserve backups, restore tracked lockfile to HEAD if it is only the accidental duplicate document, then rerun migration verification. No claim of full suite or deployment success.


## 2026-10-17 continuation — host tool loop and WhatsApp approval path

Interactive chat now calls the host-authorized tool loop with server-derived organization/user/role/permissions. Tool definitions are limited by the current agent allowlist and the authenticated actor's permissions. The loop is bounded and keeps host-supplied mailbox context explicitly untrusted.

WhatsApp outbound paths (manual API/UI, the agent whatsapp.send tool, and scheduled/product actions) now create pending approval records. The whatsapp.send tool never queues directly. The approval UI supports approve/reject, Meta template submission/status refresh, and template preview. Free-form text requires a recent inbound customer message within the 24-hour window; approved text-body templates are rechecked live at approval and worker send time. The worker also requires an active approved action, a connected account, and a current agent/account binding for agent-originated requests. Unsupported template components fail closed.

Feature RBAC additions: email.read, whatsapp.read, whatsapp.send. Migrations added: 0035–0040 (approval records, templates, outcomes, feature permissions, agent-binding recheck). Regression tests were authored, including a behavioral test for the proposal-only tool.

Verification remains pending: no tests/typecheck/build/migrations/browser/Meta/live-send/deployment checks were run. The web route currently imports worker runtime modules directly; review this boundary in the next dependency-equipped checkout. Continue from docs/project-control/NEXT_ACTION.md and VERIFICATION_STATE.md; do not claim provider delivery from an approval or queue response.


## 2026-10-18 — FIX-01 chat membership nullability

The user's Docker build evidence showed worker image success but web type validation failure at `route.ts:384` because `subject.membership` is nullable in the shared auth type. `authorize()` guarantees active membership in its implementation, but TypeScript requires local narrowing. FIX-01 committed an explicit fail-closed 403 guard before trusted tool context creation and a static regression assertion: `4a71cfcf553c7f2be5286b2a1d36fbb749b845d9`, `182cf3de1ab5f7cd783ebcab5ab536aae7afabf9`. Post-fix build/test are pending. Native shell pnpm absence is separate and routed to OPS-01; Docker already had pnpm.

### FIX-01 / Sentinel — 2026-10-18 — WhatsApp synced template row nullability

- **Symptom:** User's Docker deployment build reports Next.js compilation success, then TS18048 at `apps/web/src/app/api/whatsapp/send-actions/decision/route.ts:119`: `synced.rows[0]` may be undefined when reading `.components`.
- **Root cause:** The existing `if (!synced.rows.length)` guard does not narrow TypeScript's indexed array access under strict checking. The later direct access `synced.rows[0].components` remains unsafe to the type checker.
- **Failed approach:** Treating a nonzero `rows.length` check as proof that `rows[0]` is narrowed. Do not use a non-null assertion or relax compiler settings.
- **Remedy:** Bind `synced.rows[0]` to `syncedTemplate`, return the existing fail-closed 409 `template_not_synced` response if absent, then access `syncedTemplate.components`. Added a regression source assertion for the explicit row guard and safe access.
- **Prevention:** Narrow array elements directly after database writes/RETURNING operations; keep an explicit absent-row response even when a length check is present.
- **Evidence:** Source commit `90fac5e0774b695446e1e0c3ab51072639ba5f06`; regression test commit `41734923651b1173a703d747f0ac0aa93317a5b9`. User log shows worker image built/exported and web compile succeeded before type validation failed. No post-fix test or build has been run/observed.
- **Next action:** Pull latest `main` and rerun `bash scripts/update-and-up.sh` (or the documented Docker Compose build). If the build passes, run the focused `whatsapp-send-approval.test.ts` suite. Record actual results; do not infer success from source commits.


## 2026-10-18 — Voice resampling TypeScript build error
- User reran `bash scripts/update-and-up.sh` after the duplicate `generationId` fix. The web bundle compiled successfully, then TypeScript failed at `voice-workspace.tsx:331` because a typed-array indexed read was possibly undefined.
- FIX-01 committed a narrow guard for potentially missing samples in both the same-rate PCM16 path and downsampling accumulation: `baa9746142297322c5bf796e7c6fb94060bbc9cf`.
- Added source-contract regression assertions in `voice-realtime-transport.test.ts`: `ff8ab0faa72a1a235c47be6d773c16738d2cd79a`.
- Issue/control: ISS-033; session `sessions/FIX01-VOICE-RESAMPLING-INDEX-20261018.md`.
- **Verification boundary:** The latest user log predates this fix. No post-fix build or test pass is claimed.
- **Next:** Pull latest main and rerun `bash scripts/update-and-up.sh`; if the build passes, run focused `voice-realtime-transport.test.ts`. Continue narrow source fixes for subsequent compiler failures.

## 2026-10-18 — Strict indexed-access and voice context typecheck follow-up
- User's latest local run reports three more strict typed-array index errors in voice workspace, nullable membership and conversation ID typing in /api/voice/turn/route.ts, and undefined split results in WhatsApp template selection.
- FIX-01 committed explicit audio sample fallbacks, a fail-closed 403 membership guard, a validated string conversation ID fallback, and safe template selection defaults; tests extended for voice and WhatsApp contracts.
- Issue ISS-034. Source commits: 1fb04529, 9a9e09ee, 5946168a; tests: 57618396, fee2a239.
- **Verification boundary:** Current user logs are pre-fix. Post-fix typecheck, focused tests, Docker build and deployment are not yet verified.
- Next: pull main, run pnpm typecheck, focused voice and WhatsApp tests, then manual Docker build. Continue resolving source errors; do not claim green from commits alone.

## 2026-10-18 — Manual deployment Compose compatibility handoff
- Latest user evidence: worker and web Docker images build successfully; Next.js production build passes. Manual deployment then fails before migrations because installed Docker Compose rejects `config --environment`.
- OPS-01 correction is on main in `scripts/manual-up.sh` with regression source-contract test `scripts/tests/manual-up-compose-env.test.mjs`. Commits: `a93176b3cbba730c30a016b4e47a9dd3dd46039c`, newline parsing follow-up `2503f5352a821e4a338a2578fc49e6cd341a11da`, test `0386f03fa9534ff2d53db84b7ffbd2b5fe864154`.
- Current boundary: post-fix test, migration execution, `compose up`, and runtime health are not verified. Next action is to pull main, run the focused Node test, then rerun the manual deployment script. Never expose the database URL or claim deployment success based on image build alone.
