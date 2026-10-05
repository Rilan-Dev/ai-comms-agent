# NEXT_ACTION.md

The single exact next authorized action. Update this file on every commit.

---

## Current next action

```yaml
actor: ChatGPT
role: Chief Architect / Project Controller / Primary Implementer

action: |
  Continue Product Completion Slice 2 — Email Accounts. Complete the persisted provider
  connection vertical slice: Gmail OAuth state/PKCE and callback persistence, IMAP/SMTP
  secure connection and worker verification, Zoho OAuth foundation, connect/disconnect/
  reconnect lifecycle, connection tests, truthful pending/error/retry states, folder/label
  discovery, agent assignment, authorization/audit, responsive UI, and tests. Do not
  fabricate provider connectivity without real user-owned credentials.

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


## 2026-10-06 — Gmail provider build blocker
- Fixed the worker TypeScript contract failure in Gmail adapter commit `418439093ae87ceb76a32709b371b7e772d8fd04`.
- Next: pull `main` and rerun `bash scripts/manual-up.sh`; if the worker passes, continue the next Email Accounts provider-foundation slice without waiting on CI/Vercel.


### 2026-10-06 — Gmail provider hardening
- Registered the real Gmail adapter in the canonical worker provider registry.
- Hardened Gmail OAuth credentials with proactive refresh before expiry and a single 401 retry refresh path, with concurrency de-duplication.
- Added adapter tests for expiry refresh and unauthorized-response recovery.
- **Next implementation focus:** generic IMAP/SMTP secure connection flow, validation, encrypted credential persistence, connection testing, and adapter registration; then Zoho OAuth foundation.


### 2026-10-06 — ChatGPT provider implementation checkpoint
- Gmail provider registration and OAuth token lifecycle hardening are implemented.
- Replaced the provider-neutral IMAP/SMTP mock registration with a real TLS-backed `ImapSmtpAdapter`.
- Added explicit IMAP/SMTP connection credentials (username, host/ports, TLS) and fail-closed plaintext transport rejection.
- Implemented authenticated IMAP folder discovery and secure SMTP authentication; credential secrets are retained only in adapter memory during an active connection and are cleared on disconnect.
- Remaining provider work: move persisted draft/message operations into the sync/runtime workers, add dedicated adapter tests and connection-test API/UI, then implement Zoho OAuth.
- Do not claim runtime provider connectivity without real provider credentials.


### 2026-10-06 — ChatGPT email provider continuation
- Fixed a duplicate SMTP helper that would have blocked the IMAP/SMTP worker build.
- Added dedicated IMAP/SMTP adapter tests and fail-closed protection against localhost/private-network targets to reduce SSRF risk from user-supplied mail hosts.
- Added Zoho OAuth PKCE start/callback with data-center-aware Accounts endpoints, encrypted credential persistence, state-cookie validation, and server-side authorization.
- Added the initial Zoho REST adapter foundation (OAuth refresh, account discovery, folders, labels, message listing) and registered it in the worker provider registry.
- **Next:** finish generic IMAP/SMTP persisted connection flow and adapter operations, then complete Zoho message/draft/send/search operations and webhook integration. Do not claim provider runtime connectivity without real credentials.


### 2026-10-06 — Agents implementation continuation
- Added persisted agent version JSON editing before immutable version creation.
- Added agent email/WhatsApp unbinding controls with audit events.
- Hardened repository channel binding against cross-organization email/WhatsApp account IDs.
- Slice 1 implementation is materially complete; formal acceptance remains pending tests/runtime/browser evidence.
- Per the project-owner development-first instruction, continue immediately with Slice 2 Email Accounts rather than waiting for CI/Vercel.

### Current development action — Slice 2 Email Accounts
Implement the real provider connection surface: secure IMAP/SMTP form and persistence, connection-test lifecycle, reconnect/disconnect/error recovery, capability/status display, and then finish Zoho runtime operations. Gmail OAuth remains configuration-required when server credentials are absent. No provider credentials are to be fabricated.

### 2026-10-06 — Active implementation checkpoint
ChatGPT is continuing Slice 2 directly. The IMAP/SMTP connect action was corrected so it no longer fails the action discriminator before reaching connection logic. A server-side TLS/authentication connection-test path is now being added before credentials are persisted, with SSRF-safe public-host resolution and no credential return to the browser. Next: add reconnect/retry/error-state controls and finish Zoho runtime operations. CI/Vercel remain non-blocking under the explicit development-first instruction.


## Current authorized action — Phase 4 (2026-10-06)

ChatGPT is the primary implementer. Continue Phase 4 Database Foundation and Migrations directly. GitHub Actions/Vercel completion is not required to continue implementation. Runtime PostgreSQL migration/RLS verification remains an acceptance requirement. Do not begin Phase 5 until Phase 4 is accepted.


### 2026-10-06 — Provider security continuation
ChatGPT continued Email Accounts provider hardening without waiting for CI/Vercel. Zoho OAuth callback and worker adapter now allow only HTTPS Zoho Mail regional API origins, preventing an untrusted `api_domain` from becoming a server-side request target. Added deterministic adapter security tests. Next provider work: complete connection-test/reconnect lifecycle and then proceed to Mail vertical slice after Email Accounts acceptance evidence is available.


### 2026-10-06 — active implementation checkpoint
- Agent version editor now persists the edited JSON configuration instead of silently creating an empty configuration.
- Version configuration has a server-side validation boundary and regression tests.
- Agent safety policy UI now exposes security-policy and rate-limit controls.
- Agent list now supports status filtering and robust create-network error handling.
- Continue development without waiting for CI or Vercel. Acceptance remains a separate gate.

### 2026-10-06 — Slice 1 agent completion continuation
- Added authorized per-agent audit history API and Activity UI.
- Added live organization WhatsApp account discovery/selection for agent channel binding; binding remains exactly-one-per-agent and cross-tenant guarded.
- Added strict server-side agent policy validation and regression tests.
- Latest implementation commit: bc31ded2df82e7a42b985343951381751504402b.
- Continue Slice 1 Agents with remaining UX/error-state/browser-verification work; do not advance to Email Accounts yet. CI/Vercel remain deferred validation gates under the explicit development-first instruction.


### 2026-10-06 — Agents implementation slice complete / acceptance pending
ChatGPT has completed the remaining source implementation for Slice 1 Agents: persisted list/search/status filtering, create/edit, immutable version configuration with explicit version selection, deploy/retire authorization, policy validation, organization-scoped email/WhatsApp bindings and unbinding, configuration simulation, audit history, notifications, and functional responsive channel navigation. Automated/runtime and browser verification remain acceptance evidence and are intentionally not blocking development.

### Current next implementation action — Slice 2 Email Accounts
Continue Product Completion Slice 2 — Email Accounts. Complete the persisted provider connection vertical slice in this order: connection status model/UI, Gmail OAuth state/PKCE and callback persistence, IMAP/SMTP secure connection form + worker connection verification, Zoho OAuth foundation and regional endpoint handling, connect/disconnect/reconnect lifecycle, connection-test results, truthful pending/error/retry states, folder/label discovery, agent assignment, authorization/audit, responsive UI, and tests. Do not fabricate provider connectivity without real user-owned credentials.


ChatGPT continued Slice 1 without waiting for CI/Vercel: repaired literal source-newline artifacts in the agent detail/repository files, made version selection explicit for deployment, improved configuration-test coverage to include WhatsApp binding validity, initialized the editor from the selected persisted version, and made overview channel actions functional. Slice 1 remains pending formal runtime/browser acceptance. Next implementation focus remains completing remaining Agent slice gaps before moving to Email Accounts.


### 2026-10-06 — Email Accounts implementation continuation
- Added server-side IMAP/SMTP reconnect/retry using the encrypted persisted credential record; credentials are decrypted only on the server and never returned to the browser.
- Email account UI now exposes reconnect/test actions by provider, capability badges, and persisted connection error messages.
- Hardened Zoho regional OAuth refresh routing so EU/IN/AU/CA/JP/SA accounts refresh against the matching regional Accounts endpoint instead of assuming the India/default endpoint.
- Added deterministic regression coverage for Zoho regional refresh routing.
- Provider credentials remain configuration-dependent; no live provider connection is claimed.

### Current next implementation action — Email Accounts
Continue Email Accounts with provider lifecycle completion: OAuth reconnect/error handling for Gmail/Zoho, IMAP/SMTP reconnect UI refinement, capability/status refresh, folder/label discovery persistence, agent assignment UX, and provider contract/runtime tests. Then proceed to Mail.


### 2026-10-06 — Current implementation checkpoint
Continue Product Completion Slice 2 — Email Accounts. Finish provider lifecycle hardening and persistence: validate Gmail/Zoho OAuth reconnect idempotency, complete worker-backed folder/label discovery persistence, finalize provider contract tests and truthful error/retry states, then proceed to the Mail vertical slice. Do not fabricate provider connectivity without real user-owned credentials.


### 2026-10-06 — Capability truthfulness correction
- Aligned persisted IMAP/SMTP and Zoho capability metadata with the operations actually implemented by their adapters; unsupported draft/send/forward/attachment operations are no longer advertised as available.
- Gmail remains the fully advertised provider surface where its adapter implements the corresponding contract.
- Latest code commit: be4925cbd3e73ebeec28a951a5d062d70fba19ae.
- Runtime/browser verification remains deferred and no live provider connection is claimed.


### 2026-10-06 — Slice 2 Email Accounts lifecycle hardening
- IMAP/SMTP connection persistence is now idempotent by organization/provider/address; reconnect updates the existing record instead of creating duplicates.
- Credential-save failure transitions the account to `error` rather than leaving a misleading pending record.
- Gmail and Zoho OAuth callbacks now remain `pending` until worker verification/discovery rather than falsely claiming runtime connectivity.
- Email Accounts UI now distinguishes connected vs total records and reports OAuth/IMAP states truthfully.
- Next implementation: wire worker-backed folder/label discovery persistence into the account lifecycle, then finish provider contract/runtime tests and Mail vertical slice.


### 2026-10-06 — Active provider implementation checkpoint
ChatGPT continues Slice 2 Email Accounts under the development-first directive. Provider registry/runtime alignment is being hardened, folder/label discovery persistence is in place, Gmail/IMAP-SMTP/Zoho adapters are registered, and truthful credential-required states remain mandatory. Next concrete implementation: complete provider runtime contract tests and persisted discovery/status lifecycle, then finish Email Accounts UI acceptance work before moving to Mail. CI/Vercel results remain deferred validation gates and are not a development blocker.


### 2026-10-06 — Slice 2 provider lifecycle continuation
ChatGPT completed another Email Accounts hardening pass: folder/label discovery is now an atomic replacement snapshot, successful worker discovery persists runtime capabilities and connected status, discovery failures become explicit account errors, and IMAP/SMTP/Zoho capability metadata is truthful to the implemented adapter surface. Continue the Mail vertical slice after Email Accounts implementation is complete; runtime acceptance remains a separate gate.

### 2026-10-06 — Email repository correctness hardening
- Corrected the PostgreSQL email account repository status mapping to match the canonical enum (pending, connected, error, disconnected, revoked); legacy active/expired assumptions were removed.
- Normal account reads/listing/config/capability/status updates now exclude soft-deleted records.
- Restoring a mailbox clears stale connection errors and records connected_at when appropriate.
- Added regression coverage in apps/web/tests/email-account-repository-contract.test.ts.
- Continue Email Accounts provider contract/runtime hardening; then proceed to Mail. No CI/Vercel wait and no fabricated provider credentials.


### 2026-10-06 — ChatGPT active implementation checkpoint
Email Accounts provider lifecycle continuation: complete truthful provider contract/runtime coverage, persisted folder/label discovery lifecycle, OAuth reconnect/error handling, agent assignment UX, then start Mail vertical slice. Do not fabricate provider connectivity.


### 2026-10-06 — OAuth reconnect hardening
- Gmail and Zoho reconnect flows now carry an optional signed target `accountId` through OAuth state.
- OAuth callbacks validate the target account belongs to the same organization and provider before updating persisted credentials, preventing reconnect from silently creating/updating the wrong mailbox.
- Mail Accounts UI now passes the selected account identity for Gmail/Zoho reconnect.
- Added regression coverage for Gmail reconnect-state binding without network access.
- Latest implementation commit: `242396815fadb6495e7f9c766ef6b17d6c52a53b`.
- Next implementation: complete persisted folder/label discovery and provider lifecycle runtime, then begin Mail vertical slice. Validation remains a later acceptance gate under the active development-first instruction.


### 2026-10-06 — Mail vertical slice active
The Email Accounts implementation has advanced through provider lifecycle, credential persistence, reconnect/disconnect, capability truthfulness, folder/label discovery, and OAuth foundations. Under the development-first instruction, continue into the Mail slice now: persisted inbox/thread reads, organization-scoped search/filtering, message detail, then read/unread/archive/move/labels, drafts, reply/forward, attachments, and approval-safe send flows. Do not show fabricated messages. Runtime CI/Vercel remain acceptance evidence and are not a development blocker.

Current implementation commits: 792213ab7219623df2452e5d32e9de2c87120d02.
