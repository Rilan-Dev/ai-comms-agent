# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Primary Implementer

action: |
  Continue Product Completion Slice 1 — Agents. Finish the real persisted agent vertical
  slice: detail editing, version/config workflow, policy, channel binding/unbinding,
  configuration testing, authorization, notifications, responsive states, tests, and
  browser verification. Then advance to Slice 2 — Email Accounts.

constraints:
  database: "PostgreSQL 15+; no Supabase runtime dependency"
  secrets: "Never commit .env/.env.docker; use committed example templates only"
  source_of_truth: "GitHub main"
  clara: "Reuse Clara Core; do not modify Clara source"
  deployment: "Self-hosted Docker is the current deployment path"
  validation: "Verification is an acceptance gate; development continues under the approved development-first override."
```

---

## STOP instruction

**Z.AI must STOP after this correction commit.**

Z.AI must NOT:
- start Phase 4 implementation
- provision production Supabase
- implement email/WhatsApp/agent/scheduling/voice
- modify Clara source
- make any unrelated code changes

Z.AI is in **STOP** state, awaiting ChatGPT's final Phase 3 acceptance decision.

---

## History

| Date | Action |
|---|---|
| 2026-10-03 | Phase 1 → FINAL APPROVAL. Phase 2 → APPROVED. |
| 2026-10-03 | Phase 3 identity/RBAC implemented (commits 11aa13c, 224751a). |
| 2026-10-03 | ChatGPT review: CORRECTION REQUIRED (Findings A-D). |
| 2026-10-03 | Z.AI correction pass 1 (commit bf8dea7). 62 tests. |
| 2026-10-03 | ChatGPT review: FINAL CORRECTION required (4 items). |
| 2026-10-03 | Z.AI final correction (commit d4aa08b). 69 tests. |
| 2026-10-03 | ChatGPT review: owner trigger not transaction-safe; DELETE not covered; createOrganization public. |
| 2026-10-03 | Z.AI transaction-safe owner invariant (commit 4289e53). 91 tests. Vercel READY. Next: ChatGPT final acceptance. Z.AI must STOP. |


### ChatGPT takeover update — 2026-10-04
Before Phase 3 acceptance, perform runtime verification of the corrected migration. The latest code commit is 9fd34d1d69417302f2c8e31d0a453a0836533e27. Verify PostgreSQL migration syntax and owner/RLS behavior in CI or an equivalent PostgreSQL runtime. Do not authorize Phase 4 until evidence is green.


actor: "ChatGPT"
action: "Continue sequential product implementation without waiting for CI/Vercel validation"
then: "Complete provider adapters, sync/queue workers, Clara intelligence/RAG, agent tools/authorization, WhatsApp, scheduling, chat, realtime voice, observability/security, E2E, deployment, and final validation"
validation_policy: "Deferred until development completion by explicit project-controller instruction on 2026-10-04"
phase_4: "active"


### Development-first continuation update — 2026-10-04
Continue development-first execution. Next implementation focus: complete provider adapters and email account connection/runtime flows, then sync queues/workers, intelligence/RAG, agent runtime/tool registry, approvals, WhatsApp, scheduling, Clara chat/realtime voice, observability/security, E2E and deployment. CI/Vercel validation is a final milestone gate rather than a development blocker.
\n\n### Active development override — 2026-10-04\nContinue Phase 4 implementation directly under ChatGPT ownership. Do not pause development for GitHub Actions. CI verification is intentionally deferred until the code-change set is complete.\n

### Current Phase 4 action
Continue implementing the database foundation and security hardening. CI is intentionally disabled for automatic triggers. Do not stop implementation for CI; re-enable it only after the code-change set is complete.


## 2026-10-04 — ChatGPT runtime verification gate

- Main baseline: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes a successful-owner/transfer runtime script, and executes a negative ownerless-organization check.
- A dedicated PR was opened solely to trigger the verification workflow, but GitHub exposed zero workflow runs. The PR was closed without merge because it could not provide runtime evidence.
- Static inspection found the migration's PostgreSQL function quoting valid and the owner/RLS mechanisms structurally correct.
- **Phase 3 acceptance remains pending runtime evidence. Phase 4 remains unauthorized.**


### Docker verification tooling — 2026-10-05
Manual verification is now reproducible without relying on GitHub Actions: 
- `infra/docker-compose.verify.yml` provides disposable PostgreSQL 17.
- `scripts/migrate.sh` applies migrations and records SHA-256 checksums; modified applied migrations fail closed.
- `scripts/migration-changes.sh` checks applied migration files for drift.
- `scripts/verify-docker.sh` runs migration, drift, owner-invariant runtime checks, and expected ownerless-org rejection.
- `scripts/verify.sh` adds typecheck, tests, and both builds.
- CI delegates to the same `scripts/verify.sh` path, so local and CI verification share one implementation.


### 2026-10-05 continuation state
The next implementation target is Phase 5 Email Provider Abstraction completion: persist account connection state through the PostgreSQL repository, then implement Gmail/IMAP-SMTP/Zoho adapters sequentially. Runtime verification of the full migration set remains a required evidence gate, but it must not block source implementation under the current project-owner instruction.
\n 

### 2026-10-05 continuation
1. Wait for/inspect GitHub Actions runtime verification of the latest migration against PostgreSQL 17.
2. Confirm ownerless organization rejection, ownership transfer, final-owner deletion, and RLS helper creation in runtime evidence.
3. Configure Vercel external environment variables only from the user's real provider credentials; current Vercel project has zero environment variables, so do not deploy a false-configured runtime.
4. After Phase 3 acceptance, authorize Phase 4 database foundation work. Until then, Phase 4 remains NOT AUTHORIZED.

## 2026-10-05 — Infrastructure boundary and verification correction

- **Deployment infrastructure policy:** PostgreSQL, Redis, RabbitMQ, and Qdrant are external runtime dependencies; Docker Compose services are opt-in under the `local-infra` profile and are never started by the normal source verification path.
- **Verification policy:** `pnpm run verify` / `scripts/verify.sh` performs source/type/test/build checks only. `scripts/verify-docker.sh` is explicit opt-in disposable PostgreSQL verification.
- **Latest infrastructure correction:** `infra/docker-compose.verify.yml` now uses the actual `postgres` service hostname.
- **CI:** GitHub Actions uses its own disposable PostgreSQL service for runtime migration checks; this is CI infrastructure, not deployment provisioning.
- **Latest known Vercel status:** the Vercel status for the latest code is `failure` due to build-rate-limit; no READY claim is made.
- **Phase 4:** remains the active development phase under the project-owner development-first instruction. Runtime validation remains a release/acceptance gate, not a source-development blocker.


### 2026-10-05 ChatGPT takeover verification checkpoint
- Latest migration correction commit: `477cf8793111555cd33d00230c936a7617bd23d3`.
- Local Docker verification previously exposed invalid PostgreSQL function terminators; all remaining single-dollar terminators are now corrected.
- GitHub Actions rerun still terminates immediately with a generic failure and exposes no usable job log through the connected API. This is not treated as a passing runtime result.
- **Required acceptance evidence:** run `git pull --ff-only origin main` followed by `bash scripts/verify-docker.sh` locally. Expected final line: `Disposable PostgreSQL verification: PASS`.
- Phase 3 acceptance remains pending until that runtime check passes. Phase 4 remains NOT AUTHORIZED.


### 2026-10-05 — Immediate runtime gate
Pull latest `main` and rerun `bash scripts/verify-docker.sh`. The previous exit-code-3 bootstrap failure has been corrected. If it fails again, preserve the PostgreSQL logs before any further schema changes.


### 2026-10-05 — Phase 4 migration-chain correction
- Local disposable PostgreSQL verification exposed a real schema defect: `0002_agent_foundation.sql` and `0002_application_foundation.sql` both defined `agents`, `agent_versions`, and related objects with incompatible columns. The application migration attempted to add `agents_current_version_fk` against a column that did not exist on the already-created table.
- Corrective action: `0002_application_foundation.sql` is now the single authoritative Phase 4 application/agent foundation migration. The richer agent version/deployment/policy fields were consolidated into it, and the duplicate `0002_agent_foundation.sql` migration was removed before production application.
- Latest correction commit: `9fd34d1d69417302f2c8e31d0a453a0836533e27`.
- Required next verification: pull `main` and rerun `bash scripts/verify-docker.sh`; then inspect CI runtime result. Do not claim Phase 4 acceptance until the full migration chain passes.


### Runtime verification finding — 2026-10-05
- Local disposable PostgreSQL verification reached `0002_database_foundation.sql` successfully but failed because its `can_access_organization()` helper referenced Phase 3 RLS helpers without the `private.` schema qualification.
- Corrected in commit `d2da078e406a96fce7245dcd753b2e7f1ab87d74`: `private.is_active_organization_member(...)` and `private.is_active_organization_admin_or_owner(...)` are now explicitly qualified.
- This is a real runtime migration defect caught by the verification harness; it is not a false-positive static test issue.
- Phase 3 acceptance remains pending until the disposable PostgreSQL verification is rerun successfully, including ownerless-organization rejection.
- Phase 4 remains NOT AUTHORIZED.


### 2026-10-05 — Active implementation checkpoint
- Database foundation is being hardened against actual PostgreSQL execution, with migration chain kept forward-only.
- Latest implementation: 0014 email connection metadata migration, PostgreSQL email repository/schema alignment, Gmail provider registration, and migration-test cleanup.
- Continue with Phase 5 email provider abstraction/runtime contracts next; do not claim Phase 4 acceptance until disposable PostgreSQL verification is green.


### 2026-10-05 — Authoritative product completion execution

ChatGPT is the sole active implementer. The user has explicitly requested complete menu-by-menu implementation with no placeholder controls.

Authoritative implementation sequence:
1. Shared Product UX/Runtime Foundation.
2. Agents — complete vertical slice.
3. Email Accounts.
4. Mail.
5. WhatsApp.
6. Agent Intelligence / Knowledge.
7. Automations & Schedules.
8. Chat.
9. Realtime Voice.
10. Settings / Organization / Members.
11. Activity / Audit / Operations.
12. Full E2E and production verification.

Current slice: **0 — Shared Product UX/Runtime Foundation**.

Rules for every slice: real persistence, server authorization, validation, loading/empty/error/retry states, user notifications, working buttons/actions, audit for sensitive mutations, tests, browser verification, accessibility, and no fabricated live data.

Detailed plan: docs/superpowers/plans/2026-10-05-product-completion-menu-plan.md

Do not advance to the next menu until the current menu's acceptance gate is green.


### ChatGPT takeover update — 2026-10-06
Continue Slice 1 Agents: resolve CI/runtime failures, then browser-verify create/edit/version/deploy/policy/channel flows. Only after Slice 1 acceptance move to Email Accounts.


### Verification hardening — 2026-10-06
- CI now provisions PostgreSQL 17, applies the Phase 3 migration, executes transaction-level owner/RLS runtime verification, and asserts ownerless-organization rejection.
- SECURITY DEFINER helpers intentionally use `SET search_path = ''` with fully-qualified `public.*` table references; static tests now enforce this safer pinned path.
- Latest implementation commit: 5bcc9758f374de1d7187d2f9cd814d2589ecf081.
- Phase 3 acceptance remains pending until CI runtime evidence is green.


### 2026-10-06 — ChatGPT continuation
Continue product implementation without waiting on CI: harden Email Accounts provider connection flows next (Gmail OAuth state/PKCE, then IMAP/SMTP and Zoho), while preserving truthful configuration-required states. Keep runtime verification as the acceptance gate.


### 2026-10-06 active development continuation
Formal phase remains 4 until runtime acceptance. In parallel under the development-first directive, Phase 5 email provider abstraction work is being implemented. Next concrete provider-foundation work is capability/runtime contract completion, followed by Phase 4 runtime acceptance when CI infrastructure becomes observable.


## 2026-10-06 — Agents web build repair follow-up
- Agents web build source repair is committed on main.
- Pull main and rerun `bash scripts/manual-up.sh` to verify the corrected production build locally.
- Continue the next product-completion vertical slice after the Agents slice; CI/Vercel validation remains a later gate and does not block development.


### 2026-10-06 — ChatGPT continuation
- Latest implementation corrections: cross-tenant provider binding guard fixed in migration 0010; Gmail OAuth callback now validates state-cookie equality; Gmail accounts remain pending until encrypted credentials are stored successfully.
- Slice 1 Agents remains pending formal acceptance. Development-first implementation continues; no Vercel READY or CI PASS is claimed.
- Next product work remains Email Accounts provider connection hardening (Gmail, then IMAP/SMTP and Zoho), followed by Mail.
