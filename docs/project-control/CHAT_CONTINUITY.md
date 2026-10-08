# CHAT_CONTINUITY.md — Fresh-Conversation Recovery Protocol

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

