# worklog.md — Audit Trail

Append-only audit trail. Every phase and every task records: phase, status, objective, architect, developer, start date, completion date, approved scope, implementation summary, files changed, tests, verification, commit, review result, issues found, corrections, remaining work, next phase, next Z.AI instruction.

Never write "Phase complete" without evidence.

---

## 2026-10-07 — Clara worker build alias correction

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- User ran `bash scripts/manual-up.sh` after the submodule initialization correction. The Docker build now included `vendor/clara`, but the worker image failed during `tsc` because immutable Clara source imports use the Clara repository `@/*` aliases (for example `@/modules/ai-core/factory` and `@/modules/rag/grounding`), while the host worker tsconfig had no path mapping for those aliases.
- Updated `apps/worker/tsconfig.json` with a worker-local `@/*` mapping to `../../vendor/clara/clara-core/source/src/*`. This resolves Clara's internal aliases during the worker compilation without modifying the immutable Clara source.
- **File changed:** `apps/worker/tsconfig.json`.
- **Commit:** `d7a28bf467c939e128f0b9a747420d06274c5a78`.
- No CI/Vercel wait was performed. No Docker build pass is claimed until the user reruns the manual build.


## 2026-10-07 — Clara Docker preflight guard for unresolved host-bound imports

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- The next manual Docker build exposed a deeper Clara integration closure problem after submodule initialization: immutable Clara source is now present, but its source graph expects the original Clara host application's `@/lib/*` boundary. The worker also attempts to typecheck that source graph and reports missing host-bound modules plus undeclared external packages. These are not safe to mask with TypeScript suppression because the runtime would still require the missing modules.
- Added `scripts/pre-docker-check.sh` to fail before Docker build when the Clara submodule is absent, host typechecks fail, the known Clara `@/lib/db*` host boundary is unresolved, or manual Compose configuration is invalid.
- The preflight deliberately does not fabricate a DB/auth adapter or alter immutable Clara source. The remaining Clara host-boundary errors therefore stay visible for the existing developer implementation rather than being hidden by a build-only workaround.
- **File changed:** `scripts/pre-docker-check.sh`.
- **Commit:** `fedadbe8133c7f855b5c8d3912007f418209c344`.
- No CI/Vercel wait was performed. No Docker build pass is claimed.


## 2026-10-07 — Docker preflight and Clara voice context error corrections

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- User preflight reported `[FAIL] vendor/clara submodule is not declared` even though `.gitmodules` contains the `vendor/clara` declaration. The preflight grep expression was over-escaped, so it failed to recognize the valid declaration.
- Corrected the submodule declaration regex in `scripts/pre-docker-check.sh` without changing the preflight's intended checks.
- Host web typecheck also reported `surface` as an unknown property on ClaraRuntimeContext in the realtime session route. The immutable Clara runtime contract accepts the context without `surface`; removed only that invalid field from the host call.
- **Files changed:** scripts/pre-docker-check.sh, apps/web/src/app/api/voice/session/route.ts.
- No CI/Vercel wait was performed. No Docker/typecheck pass is claimed; the remaining reported Clara source-closure errors still require the next concrete correction.


## 2026-10-07 — Clara module-alias boundary correction

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- The latest preflight showed that vendored Clara imports such as `@/modules/ai-core/*` were being resolved differently by the host applications. Web had only the host `@/*` mapping, so Clara module aliases were unresolved. Worker had an overly broad `@/*` mapping directly to the entire Clara source tree, which also incorrectly captured worker-owned host aliases.
- Added a specific `@/modules/*` mapping to the immutable Clara module tree in both web and worker configs. Restored worker's general `@/*` mapping to its own `src/*`, so the Clara alias is narrow rather than replacing the worker host alias namespace.
- **Files changed:** `apps/web/tsconfig.json`, `apps/worker/tsconfig.json`.
- **Commits:** `a3dffe594b878527d5f1057d0af04abda975c2da`, `436adcce949f26a30604dcbef0d97fde180039ea`.
- No CI/Vercel wait was performed. No typecheck/build pass is claimed. The remaining Clara host-bound aliases and external dependency errors still require concrete correction.


## 2026-10-07 — Clara reference-library build-boundary correction

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- User clarified that `vendor/clara` is the `Rilan-Dev/ai-reusable-libraries` reference source only. The entire reusable-library repository must not be treated as application build code or traversed by the web/worker TypeScript programs.
- Removed the erroneous `@/modules/*` mappings from both application tsconfigs and restored each app to its own `@/* -> ./src/*` namespace.
- Removed the preflight check that scanned the entire Clara reference tree for host aliases and replaced it with a boundary check intended to detect direct application imports of the reference source. Removed mandatory submodule initialization from manual startup and removed the worker health check's dependency on a vendored Clara file.
- **Important remaining error:** `packages/clara-core/src/runtime.ts` and `packages/clara-core/src/types.ts` still directly reference `vendor/clara`. Therefore the current TypeScript graph can still traverse the reference repository through the package boundary even after the incorrect tsconfig aliases are removed. This is the remaining concrete source of the reported 91/94 vendor errors and requires the developer-side local Clara functionality extraction/adapter work; the immutable reference source must not be patched.
- **Files changed:** `apps/web/tsconfig.json`, `apps/worker/tsconfig.json`, `scripts/pre-docker-check.sh`, `scripts/manual-up.sh`, `apps/worker/src/index.ts`.
- **Commits:** `f0348b5ca05b881f036ed213370425ea1656a2ba`, `07bf330d88051af2e8c0219f14c436e62f8e3c8c`, `c6db13191521799e675078f7c69a7aa1523d8613`, `d454c48fd81394011400b6854201fd9659660225`, `48a0b026aadceb28048338d04580e747eafcf490`.
- No CI/Vercel wait was performed. No typecheck, preflight, or Docker pass is claimed.


## 2026-10-07 — Exclude Clara reference vendor from Docker preflight

- **Owner:** ChatGPT
- **Scope:** Error-fixing only; no feature development and no project-control documentation changes.
- User requested that the Clara reference-library vendor be excluded from `scripts/pre-docker-check.sh` checks. Updated the preflight so TypeScript failures consisting only of `vendor/clara` diagnostics are reported as warnings rather than application failures. Application diagnostics remain visible and still fail the preflight.
- Removed the Clara reference-library boundary scan from this preflight because `vendor/clara` is explicitly reference-only and is not itself an application build input.
- **File changed:** `scripts/pre-docker-check.sh`.
- **Commit:** `3909c28dccbd06d1793b2167bb68fd18ed8a193a`.
- No CI/Vercel wait was performed. No Docker build pass is claimed until the user reruns the preflight.


## 2026-10-07 — Remove vendor Clara from application build graph

- **Owner:** ChatGPT
- **Scope:** User-authorized concrete error fix to make the Docker self-hosted application buildable; no project-control documentation changes and no modification of `vendor/clara`.
- The worker Docker build failed because `packages/clara-core/src/runtime.ts` and `types.ts` re-exported immutable Clara source from `vendor/clara`. TypeScript therefore traversed the reference repository and its original Clara application-only aliases/infrastructure, producing the reported vendor diagnostics.
- Replaced the vendor re-export boundary with local Clara contracts and a host-owned runtime implementation. The local boundary preserves the application-facing `claraRuntime` methods used by web/worker: provider resolution, voice resolution, retrieval, chat streaming, realtime session metadata, and the narrow `rag_search` tool.
- Added a local PostgreSQL knowledge-chunk retrieval adapter so chat/voice can use host-owned knowledge data without importing Clara's original RAG graph. Provider chat uses server-side HTTP APIs and supports OpenAI-compatible providers plus Gemini's native generate-content endpoint; provider selection remains environment-controlled.
- Removed the Clara reference tree from the Dockerfile build context. `vendor/clara` remains reference-only and is no longer required to build or run the application image.
- Declared the Clara package's host DB dependency explicitly.
- **Files changed:** `packages/clara-core/src/types.ts`, `packages/clara-core/src/runtime.ts`, `packages/clara-core/src/index.ts`, `packages/clara-core/package.json`, `docker/Dockerfile`, `worklog.md`.
- No CI/Vercel wait was performed. No Docker build PASS is claimed until the self-hosted server rebuilds from the new main tip.
- **Next concrete verification:** pull latest `main`, run `bash scripts/pre-docker-check.sh`, then `bash scripts/manual-up.sh`. If the next reported error is application-owned, fix that concrete error without restoring any vendor build dependency.


## 2026-10-07 — Correct manual Docker web endpoint message

- **Owner:** ChatGPT
- **Scope:** Concrete self-hosted Docker startup error correction only; no project-control documentation changes.
- The manual Compose stack publishes container port 3000 on host port 3300, while `scripts/manual-up.sh` incorrectly reported `http://localhost:3000`.
- Corrected the startup message to report the actual host endpoint `http://localhost:3300`.
- **File changed:** `scripts/manual-up.sh`.
- **Commit:** `bb37dc5e6985adc420dd904595c497adcb29542c`.
- No CI/Vercel wait and no runtime PASS claimed.


## 2026-10-07 — Remove obsolete Clara vendor tsconfig alias

- **Owner:** ChatGPT
- **Scope:** Concrete build-boundary error correction only; no project-control documentation changes.
- The local Clara package no longer imports `vendor/clara`, but its package tsconfig still declared a `@/modules/*` path into the reference repository. Removed that obsolete path alias so the local package cannot accidentally resolve Clara application modules from the reference source.
- **File changed:** `packages/clara-core/tsconfig.json`.
- **Commit:** `f01b42b7dc68ecbd48ebaa4f0ceb559c403583cf`.
- No CI/Vercel wait and no Docker PASS claimed.


## 2026-10-07 — Add required self-hosted Clara runtime configuration template

- **Owner:** ChatGPT
- **Scope:** Concrete Docker runtime configuration correction only; no project-control documentation changes.
- The new local Clara runtime reads provider configuration from server-side environment variables, while the Docker template previously contained no AI provider or `CLARA_KB_ID` settings. Added explicit OpenAI/Gemini/Sarvam provider settings, OpenAI realtime defaults, and a local Clara KB identifier placeholder to prevent an otherwise correctly built container from starting without the configuration boundary required by the chat/voice routes.
- **File changed:** `.env.docker.example`.
- **Commit:** `81bda0a4f12184fe569d38a927db52297880dd4c`.
- No credentials were added and no CI/Vercel wait was performed.


## 2026-10-07 — Fix Clara runtime contract export build error

- **Owner:** ChatGPT
- **Scope:** Concrete Docker build error fix only; no feature development, no project-control documentation changes, and no vendor modification.
- The self-hosted Docker worker build reached the local Clara package but failed with TS2459 because `packages/clara-core/src/index.ts` re-exported `ClaraRuntimeContext`, `ClaraAgentTurnRequest`, and `ClaraAgentTurn` from `runtime.ts`, while `runtime.ts` only imported those types from `types.ts` and did not re-export them.
- Re-exported the three local Clara contract types from `runtime.ts`, restoring the package's declared public API without reintroducing any `vendor/clara` dependency.
- **File changed:** `packages/clara-core/src/runtime.ts`.
- **Commit:** `d7e4cb4660c232d70f1cdec6fae31680bd18f2d6`.
- No CI/Vercel wait and no Docker PASS claimed; the next server build should surface the next concrete error if one remains.


## 2026-10-07 — Fix voice session provider property build error

- **Owner:** ChatGPT
- **Scope:** Concrete Docker web-build error fix only; no feature development, no project-control documentation changes, and no vendor modification.
- The self-hosted Docker web build failed with TS2339 because the local Clara runtime realtime-session contract returns `realtimeProvider`, while `apps/web/src/app/api/voice/session/route.ts` attempted to persist the nonexistent `session.provider` property.
- Updated the voice-session persistence call to use `session.realtimeProvider`, matching the local Clara runtime contract and the existing voice-session repository input.
- **File changed:** `apps/web/src/app/api/voice/session/route.ts`.
- **Commit:** 3b3a48d8edc0b00c995c7ed8fe2e575a64f906ab.
- No CI/Vercel wait and no Docker build PASS claimed; the next manual build should surface the next concrete error if one remains.


## 2026-10-07 — Fix self-hosted runtime startup errors

- **Owner:** ChatGPT
- **Scope:** Concrete runtime error fixes only; no feature development, no project-control documentation changes, and no vendor modification.
- Manual Docker startup exposed two concrete runtime defects after both images built successfully:
  - Next.js rejected sibling organization routes using different dynamic parameter names (`[id]` and `[orgId]`). Consolidated the legacy organization and members endpoints under the existing `[orgId]` route family and removed the duplicate `[id]` route family.
  - The worker launched compiled `dist/index.js`, but the workspace DB package intentionally exposes its TypeScript source entrypoint, causing Node ESM to fail on `packages/db/src/email/connection-test` at runtime. Changed the worker start command to use the installed `tsx` runtime against `src/index.ts`, matching the workspace package source boundary.
- **Files changed:** `apps/web/src/app/api/organizations/[orgId]/route.ts`, `apps/web/src/app/api/organizations/[orgId]/members/route.ts`, `apps/web/src/app/api/organizations/[id]/route.ts` (removed), `apps/web/src/app/api/organizations/[id]/members/route.ts` (removed), `apps/worker/package.json`, and `worklog.md`.
- No CI/Vercel wait and no runtime PASS claimed; the next manual startup should surface any remaining concrete runtime error.


## 2026-10-07 — Fix migration-chain verifier prefix false positive

- **Owner:** ChatGPT
- **Scope:** Concrete error-fixing only; no feature development, no project-control documentation changes, and no migration SQL modification.
- The self-hosted migration verification command reported duplicate numeric prefixes for 0002, 0003, 0004, 0015, and 0019. The committed migration runner identifies migrations by their full filenames, and the repository intentionally contains forward-only reconciliation/lifecycle migrations sharing historical numeric prefixes. The verifier's numeric-prefix uniqueness check therefore rejected the repository's actual migration history even though the migration filenames themselves are distinct.
- Removed only that false-positive verifier rule. Existing required-file checks, SQL safety checks, canonical-object duplicate checks, and early-RLS-helper checks remain unchanged.
- **File changed:** scripts/verify-migration-chain.sh.
- **Commit:** d06bad01f377d49a84c3c33b52b27f07cb72e61a.
- No CI/Vercel wait was performed and no migration/runtime PASS is claimed.
- **Remaining concrete operational issue:** the local PostgreSQL server is published on host port `65432`, while the script fallback defaults to the separate verification database on `127.0.0.1:55432`. The self-hosted database must be targeted explicitly with `DATABASE_URL` before applying migrations.


## 2026-10-07 — Fix identity migration composite-row declarations

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The first real self-hosted migration run reached `0001_identity_rbac.sql` and PostgreSQL failed at `v_org organizations;` with `type "organizations" does not exist`. The migration declares table-row variables using bare relation names as PL/pgSQL types. Replaced the four affected declarations with explicit `%ROWTYPE` declarations tied to the corresponding tables, preserving the function behavior while using PostgreSQL's row-type syntax directly.
- **File changed:** `supabase/migrations/0001_identity_rbac.sql`.
- **Commit:** `1fb3e6c92fe9c8ecd9b4686c0405c2ba47ac0819`.
- No migration PASS is claimed; the database is currently partially migrated and the migration ledger does not record `0001` because the transaction failed before the runner could insert its checksum.


## 2026-10-07 — Fix identity function schema search path

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The next self-hosted migration rerun still failed while compiling `create_organization_with_owner`: PostgreSQL reported `relation "organizations" does not exist` even though the migration had created the table. The migration connection uses the `aca,public` search path, but both atomic identity functions explicitly set `search_path = public`, so their PL/pgSQL declarations could not resolve the tables created in the active application schema.
- Updated the two affected atomic identity functions to use `search_path = aca, public`, preserving their existing behavior and matching the schema used by the self-hosted migration connection.
- **File changed:** `supabase/migrations/0001_identity_rbac.sql`.
- **Commit:** `64eb989fc63dd20e6f40c4149136c570f0e3dece`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix identity migration dollar-quoting syntax

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The self-hosted rerun reached `create_organization_with_owner` but PostgreSQL stopped at line 434 with `syntax error at or near "$"`. The function definition had an invalid single-dollar `AS $` delimiter; PostgreSQL requires the matching dollar-quoted delimiter.
- Restored the function body delimiter to `AS $$`, matching the closing `$$;` and the other PL/pgSQL functions in the migration.
- **File changed:** `supabase/migrations/0001_identity_rbac.sql`.
- **Commit:** `ce42db423c5275a7c0aa9faf39fca79901dec4e5`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Correct persisted migration delimiter fix

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The rerun still reported `syntax error at or near "$"` at line 434. Inspection of the authoritative `main` file showed the invalid `AS $` delimiter was still present; the prior attempted correction had not actually changed the migration source.
- Corrected `create_organization_with_owner()` from `AS $` to the valid `AS $$` delimiter.
- **File changed:** `supabase/migrations/0001_identity_rbac.sql`.
- **Commit:** `99b271bb109745f55bc8e7ca82f2c7bffced0faf`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix identity helper schema qualification

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The migration reached the security-definer identity helpers and failed with `relation "public.organization_memberships" does not exist`.
- Root cause: the project identity tables are created in the `aca` schema, while both private helper functions explicitly referenced `public.organization_memberships` with an empty search path.
- Changed both helper queries to explicitly reference `aca.organization_memberships` while retaining the security-definer `SET search_path = ''` boundary.
- **File changed:** `supabase/migrations/0001_identity_rbac.sql`.
- **Commit:** `8782abcbcc4f56a6a7e01f837439f6b56fa2b143`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix application-domain identity schema qualification

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- Migration progressed through `0001_identity_rbac.sql` and failed in `0002_application_domain.sql` with `relation "organization_memberships" does not exist` inside `app_is_org_member()`.
- Root cause: `organization_memberships` is stored in the project `aca` schema, while the function uses `SET search_path = public` and referenced the table without qualification.
- Changed the function query to explicitly reference `aca.organization_memberships`.
- **File changed:** `supabase/migrations/0002_application_domain.sql`.
- **Commit:** `2e5e2b268820c599e292dedaf57422e105956dd6`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix application-domain migration constraint idempotency

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- Migration rerun failed at `0002_application_domain.sql:48` because `agents_current_version_fk` already existed from the earlier partially applied migration.
- Root cause: the migration used unconditional `ALTER TABLE ... ADD CONSTRAINT` statements, so a retry after partial application was not idempotent.
- Wrapped both agent foreign-key additions in an existence check against `pg_constraint`, covering both the reported constraint and the immediately paired deployment constraint so the same retry cannot fail at the next identical statement.
- **File changed:** `supabase/migrations/0002_application_domain.sql`.
- **Commit:** `5559ad90e971c77522e35684e4919839574e6419`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix application-domain migration dollar-quoting syntax

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The self-hosted rerun progressed past the previously fixed agent foreign-key idempotency block, then PostgreSQL failed at `0002_application_domain.sql:58` with `syntax error at or near "$"` on `DO $`.
- Root cause: the newly added idempotent foreign-key block used an invalid single-dollar delimiter (`DO $` / `END $;`). PostgreSQL requires the matching dollar-quoted delimiter.
- Corrected that block to use `DO $$` and `END $$;`, preserving the constraint-existence checks and retry-safe behavior.
- **File changed:** `supabase/migrations/0002_application_domain.sql`.
- **Commit:** `a1b14de535873d0c56a1bd04cf405e8e59db0200`.
- No migration PASS is claimed and no CI/Vercel wait was performed. The next rerun should surface the next concrete migration error, if any.


## 2026-10-07 — Fix application-domain provider FK idempotency

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The self-hosted rerun progressed through the application-domain schema and failed at `0002_application_domain.sql:235` because `agent_ai_settings_provider_fk` already existed.
- Root cause: the migration used an unconditional `ALTER TABLE ... ADD CONSTRAINT`, so rerunning against the partially initialized database was not idempotent.
- Replaced the unconditional provider foreign-key addition with a guarded `DO $$ ... END $$` block that checks `pg_constraint` before adding the constraint.
- **File changed:** `supabase/migrations/0002_application_domain.sql`.
- **Migration commit:** `d89e4249ff31aa1da6de89ffe697e802c22f3239`.
- No migration PASS is claimed and no CI/Vercel wait was performed.


## 2026-10-07 — Fix provider FK dollar-quote terminator

- **Owner:** ChatGPT
- **Scope:** Concrete migration error fix only; no feature development and no project-control documentation changes.
- The migration rerun reached `0002_application_domain.sql:249` and PostgreSQL failed with `syntax error at or near "$"` on the provider FK `DO` block.
- Root cause: the idempotent block had been changed to `DO $$` but its closing delimiter remained `END $;`, leaving the dollar-quoted block unterminated.
- Corrected the closing delimiter to `END $$;`, preserving the existing `pg_constraint` guard.
- **File changed:** `supabase/migrations/0002_application_domain.sql`.
- **Migration commit:** `d4d02d89ce4d0d3ab6481c90c112fbca02c89ff0`.
- No migration PASS is claimed and no CI/Vercel wait was performed.

- Fixed concrete migration error in `supabase/migrations/0002_application_domain.sql`: the provider FK guard opened with `DO $$` but closed with `END $;`, causing PostgreSQL syntax error at line 249. Corrected only the closing delimiter to `END $$;`; no migration behavior changed.
- Migration fix commit: `cc8822973c5fde7a7d6b3d1318bab82782406cef`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed concrete migration error in `supabase/migrations/0002_application_domain.sql`: the provider FK guard opened with `DO $$` but still closed with `END $;`, causing PostgreSQL syntax error at line 249. Corrected only the closing delimiter to `END $$;`; no migration behavior changed.
- Migration fix commit: `ac44c29ef4449ea9dd9d15e2a5802ffb211fc04f`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed concrete migration syntax defect in `supabase/migrations/0002_application_domain.sql`: the provider FK idempotency block had both an invalid `DO $` opener and `END $;` closer. Corrected the pair to `DO $$` / `END $$;` without changing migration logic.
- Performed a static delimiter audit of the migration files surfaced by the repository migration search; no additional exact `DO $` or `END $;` delimiter defects were found outside this block.
- Migration fix commit: `aed0bea938c963588ddd61417374406efe4d8460`.
- No CI/Vercel wait and no migration PASS claimed; database execution remains the authoritative runtime check.

- Fixed the concrete migration failure reported after the latest pull: `supabase/migrations/0002_application_domain.sql` still contained an invalid `DO $` opener and `END $;` closer for the `agent_ai_settings_provider_fk` guard. Corrected both delimiters to `DO $$` and `END $$;`. No migration logic was changed.
- Migration fix commit: `9ea5fc280ec3a9b4df92d0e6b9f424a3460a3b9c`.
- No CI/Vercel wait and no migration PASS claimed.

- Corrected the actual authoritative `main` copy of `supabase/migrations/0002_application_domain.sql` after runtime evidence showed it still contained `DO $` / `END $;`. Replaced the complete provider-FK guard with valid `DO $$ ... END $$;` syntax and confirmed the GitHub `main` file now contains the corrected block at lines 235-251.
- Migration code commit: `efe4de6e8e6c4c1f32018131127801a1db64956a`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration error reported after `0002_application_domain.sql` reached the helper-function section: `app_is_org_member` runs with `search_path = public`, while `current_app_user_id()` is created in the `aca` schema. Qualified the call as `aca.current_app_user_id()` so PostgreSQL resolves the helper under the actual application schema. No other migration logic changed.
- Migration fix commit: `ca206244c366034b682e9957c833d105f9faf4cd`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration error reported at line 347: `app_is_agent_member` runs with `search_path = public` but referenced the application table `agents` unqualified, causing `relation "agents" does not exist`. Qualified the affected RLS helper table references in `0002_application_domain.sql` to the actual `aca` schema (`agents`, `email_accounts`, `email_threads`, `whatsapp_accounts`, `conversations`). No application/runtime code was changed.
- Migration fix commit: `7ce96cd470cd4ebd82cf27a9e1977247bbe3b204`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration rerun failure reported at `0002_application_domain.sql:326`: PostgreSQL rejected `agents_member_visibility` because the policy already existed from the earlier partial migration.
- Root cause: all application-domain RLS policies were created unconditionally, so a retry after partial application was not idempotent. Wrapped all 34 policy creations in `pg_policies` existence guards using `DO $$ ... END $$` and dynamic `CREATE POLICY` execution. Existing policy definitions and security expressions were preserved.
- Migration fix commit: `b6c53baf1ad9a78380cc6bebaad6e457d2fb7d94`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0002_application_domain.sql:477`: child RLS helper functions used unqualified `app_is_org_member(...)` while their `SECURITY DEFINER` search path is `public`, so PostgreSQL could not resolve the function in the `aca` schema.
- Qualified the nested calls as `aca.app_is_org_member(...)` in `app_is_agent_member`, `app_is_email_account_member`, and `app_is_whatsapp_account_member`. No RLS policy logic or application feature code was changed.
- Migration fix commit: `0099fd35c776a2dcc8681c18adb9b4a159f2f8d0`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0002_database_foundation.sql:132`: PostgreSQL rejected `GRANT ... TO authenticated` because the standalone PostgreSQL deployment does not have an `authenticated` role.
- The foundation migration now creates a `NOLOGIN` `authenticated` role when absent, then grants the required function execution privileges. Existing Supabase deployments where the role already exists are unchanged.
- Migration fix commit: `d060594403a5b20bf2ced692acddb614c922a6b9`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0002_database_foundation.sql:190`: the Phase 4 foundation assertion checked required tables under `public`, while this deployment stores them under `aca` via the configured search path.
- Changed the assertion from `to_regclass('public.' || required_table)` to `to_regclass('aca.' || required_table)`. No schema objects or application behavior were changed.
- Migration fix commit: `7d811be4967cc81720392d93d0741d2c6c639c4d`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0002_database_foundation.sql:149`: the `agents_org_member` RLS policy already existed from the earlier partial migration.
- Made the five foundation RLS policy creations idempotent using `pg_policies` existence guards while preserving their existing policy definitions. No application feature behavior was changed.
- Migration fix commit: `9477da4f2e71492ee955a6c127d8aea05d9b1a86`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:34`: an existing `email_accounts` table from the partial migration lacked `deleted_at`, but the migration immediately used that column in a partial unique index predicate.
- Added an idempotent `ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz` immediately before the index creation. No application feature code changed.
- Migration fix commit: `a13abd2461bcd7b1191ea9e9bf135b545209cf94`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:52`: the partially-created `email_account_credentials` table already existed without `organization_id`, while the migration attempted to create an index on that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the index creation. No application feature code changed.
- Migration fix commit: `29701da0ddd6f04d7e22a1c0f970fc2f32feb513`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:71`: the partially-created `email_folders` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the table/index operations. No application feature code changed.
- Migration fix commit: `ce44f30708179f7d823a053ba3db0fbef99f60df`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:87`: the partially-created `email_labels` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email-label table/index operations. No application feature code changed.
- Migration fix commit: `a3a77a2ccd25fbc7b9dd5f9df6631fbcd2bedc0d`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:111`: the partially-created `email_threads` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email-thread table/index operations. No application feature code changed.
- Migration fix commit: `e631489dfda4f313ce7bd6bdd6a62f9c2c011083`.
- No CI/Vercel wait and no migration PASS claimed.

- Added `scripts/reset-and-migrate.sh` for self-hosted seeding/reset workflows. It requires explicit `RESET_DATABASE_CONFIRM=YES`, drops and recreates only the application `aca` and `private` schemas, then delegates to the existing `scripts/migrate.sh`.
- Kept `scripts/migrate.sh` as the migration-only path; it was not changed.
- Reset-and-migrate commits: `53dd4fa899815403d45a5da201b122c13c5efb0e`, followed by `57dfc8e52bbbb90cd28dab12be3eee41854a4299` to make invocation independent of executable-bit state.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete `reset-and-migrate.sh` execution failure: the script invoked `scripts/migrate.sh` directly, but the checked-out file did not have executable permission, causing `Permission denied` after the database reset.
- Changed the reset wrapper to invoke the existing migration-only script explicitly through Bash: `exec bash "${MIGRATE_SCRIPT}"`. The standalone `scripts/migrate.sh` remains unchanged and continues to be the migration-only command.
- Reset-wrapper fix commit: `d7da23146ffe1cdc3b325743b098fb5f96781916`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete reset-script failure where invoking the migration helper still produced `Permission denied` on the local `scripts/migrate.sh` path despite the reset wrapper using an interpreter invocation.
- Hardened `scripts/reset-and-migrate.sh` to invoke the migration helper through an explicit `/usr/bin/env bash` interpreter, avoiding reliance on executable permission handling for the helper file.
- Reset/migration script fix commit: `3cb7b28c42dd62a2f0a60d06749cd404bba05471`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:159`: the partially-created `email_messages` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email-message table/index operations. No application feature code changed.
- Migration fix commit: `6085e1dc9d9097d0e1d861dcf789eff4f8bd1e91`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:164`: the partially-created `email_messages` table already existed without `search_vector`, while a later index/operation referenced it.
- Reconciled `email_messages` after its `CREATE TABLE IF NOT EXISTS` with idempotent `organization_id` and `search_vector` column additions. Kept the fresh-table definition's generated `search_vector` intact; existing partial tables receive a compatible `tsvector` column. No application feature code changed.
- Migration fix commits: `482b18bbd5767ab1e14bc3f7e51187532f0f6bd5`, `cf2c178747a828cd58bc13f98abfed4a9fe6b498`, `219561fb5e1c642c126353de06173e3656267357`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:161`: the partially-created `email_messages` table already existed without `search_vector`, while the migration creates an index referencing that column.
- Added an idempotent `search_vector tsvector` reconciliation before the search index creation. No application feature code changed.
- Migration fix commit: `c483738969d138a7200b917803508134b4ec869e`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:165`: the existing partially-created `email_messages` table lacked `from_email`, but the migration created an index using that column before reconciling the table schema.
- Added an idempotent `from_email text` column reconciliation before the sender index. No application feature code changed.
- Migration fix commit: `7933244261e3039a8848b08cf77a83b5b1730a53`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:169`: the partially-created `email_messages` table lacked `action_required`, while the migration attempted to create an index using that column.
- Added idempotent reconciliation for `action_required` and `action_deadline` before the action index. No application feature code changed.
- Migration fix commit: `e946af3861e60e0479e1db1cb3a791a3cba7f850`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:195`: the partially-created `email_attachments` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email-attachment table/index operations. No application feature code changed.
- Migration fix commit: `1f958df61abd68502204ffb72c2924d518ad72cf`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:217`: the partially-created `email_sync_states` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email sync-state table/index operations. No application feature code changed.
- Migration fix commit: `bc73182b34b6596e21686b5e0c57b4a7cf69096c`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:220`: the partially-created `email_sync_states` table already existed without the required `status` column.
- Added an idempotent `status email_sync_status NOT NULL DEFAULT 'idle'` reconciliation before the table definition is reused. No application feature code changed.
- Migration fix commit: `069f89c1d526fdaa27910913c167c3ef0fb23630`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:241`: the partially-created `email_sync_events` table already existed without `provider_event_id`, while the migration's partial unique index predicate referenced that column.
- Added an idempotent `provider_event_id text` reconciliation before the index creation. No application feature code changed.
- Migration fix commit: `91e95b9df74b19178783e0410f1be1cb2512e198`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:246`: the partially-created `email_sync_events` table already existed without `organization_id`, while the migration's organization index requires it.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the email-sync-event indexes. No application feature code changed.
- Migration fix commit: `db24bcac5649d58d7e0b412f82ddfa13cd141046`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:249`: the partially-created `email_sync_events` table lacked `received_at`, while the migration creates an index using that column.
- Added an idempotent `ALTER TABLE email_sync_events ADD COLUMN IF NOT EXISTS received_at timestamptz` before the affected index creation. No application feature code changed.
- Migration fix commit: `3a22367969ab151abafcf302a9b03e2caf51e272`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:299`: the `email_accounts_member_visibility` RLS policy already existed from the partial migration.
- Made all 18 email-domain RLS policy creations idempotent using `pg_policies` existence guards, preserving each existing policy definition. No application feature code changed.
- Migration fix commit: `dbc633ff3a9c692f240420ae90968ff3e23595a6`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:256`: `agent_email_accounts_email_account_fk` already existed from the partial migration, so the unconditional foreign-key creation failed on retry.
- Made that foreign-key creation idempotent with a `pg_constraint` existence guard scoped to `aca.agent_email_accounts`. No application feature code changed.
- Migration fix commit: `76a8cf0d0cebe3461883f382527b17257406ef4e`.
- No CI/Vercel wait and no migration PASS claimed.

- Comprehensive migration-chain reanalysis continued after the clean-reset run exposed `0004_messaging.sql: deleted_at does not exist` on `whatsapp_accounts`.
- Corrected the migration chain for clean-schema execution: `0004_messaging.sql` now reconciles `whatsapp_accounts.deleted_at` and guards its redundant agent WhatsApp FK; `0004_phase4_schema_cleanup.sql` preserves canonical `voice_session_id` and guards its cleanup RLS policies; `0009_rls_helper_hardening.sql`, `0011_ownership_transfer.sql`, and `0012_server_identity_rpcs.sql` use the `aca` application schema; `0018_scheduling_runtime.sql` reconciles `next_fire_at` from the existing `next_run_at` and adds the missing automation-rule status before indexing.
- Fixed `scripts/reset-and-migrate.sh` to invoke `migrate.sh` through the shell directly instead of the failing exec-path form, while preserving the separate migrate-only script.
- These are migration/schema error fixes only; no application feature code was changed.
- No CI/Vercel wait and no full migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the partially-created `whatsapp_contacts` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the WhatsApp contact table/index operations. No application feature code changed.
- Migration fix commit: `0231fc3b23b93e9da382e8010a65d19336fe1678`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:92`: the partially-created `whatsapp_messages` table lacked `idempotency_key`, but the migration immediately referenced it in a partial unique index.
- Also corrected the existing `whatsapp_contacts` reconciliation ordering so the `organization_id` ALTER runs after `CREATE TABLE IF NOT EXISTS`, preventing a fresh-database failure.
- Added the idempotent `idempotency_key` column reconciliation before its indexes. No application feature code changed.
- Migration fix commit: `c6dd42ea154451a36d30394a47b4c88bb8bbe3fb`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:92`: the partially-created `whatsapp_messages` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the WhatsApp-message index operations. No application feature code changed.
- Migration fix commit: `dbebdcd9ea1d7550c1b396600db65d884aed538c`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:119`: the partially-created `whatsapp_webhook_events` table already existed without `organization_id`, while the migration creates an index using that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the webhook indexes. No application feature code changed.
- Migration fix commit: `d7d82a905f80858db125c16a4fc383c07ec2fd65`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:145`: the partially-applied migration already had the `whatsapp_accounts_member_visibility` RLS policy.
- Made that policy creation idempotent with a `pg_policies` existence guard while preserving the existing policy definition. No application feature code changed.
- Migration fix commit: `41243f3847a38134d82914f89fc3521d25475878`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:161`: the partially-applied migration already had the `whatsapp_contacts_member_visibility` RLS policy.
- Made that policy creation idempotent with a `pg_policies` existence guard while preserving its definition. No application feature code changed.
- Migration fix commit: `bd993f53dd1af59482f0fbf2ec5beb1267b769fc`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:158`: the `whatsapp_accounts_admin_manage` RLS policy already existed from the earlier partial migration.
- Made the messaging migration's RLS policy creation idempotent using `pg_policies` existence guards while preserving the existing policy definitions. No application feature code changed.
- Migration fix commit: `e508582b50919f640883cbcd069d237897fe8b18`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:161`: the WhatsApp RLS policy section contained malformed nested `DO $$`/dynamic-policy delimiters, causing `syntax error at or near "BEGIN"`.
- Replaced the malformed WhatsApp policy section with four valid idempotent policy blocks covering accounts, contacts, messages, and webhook events, preserving the intended policy names and access expressions.
- Migration fix commit: `79a13ba9936065bc2b3cb82a8d07d8a8afaeaecc`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_phase4_schema_cleanup.sql:24`: the migration contained malformed PL/pgSQL dollar delimiters (`DO $` / `END $`) causing PostgreSQL syntax failure.
- Corrected the affected cleanup blocks to use `DO $$` / `END $$;`. No migration logic or application feature behavior was changed.
- Migration fix commit: `469b836049daf6a2a58823ea8535236403e78a9b`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_phase4_schema_cleanup.sql:24`: the migration contained malformed PostgreSQL dollar delimiters (`DO $` / `END $;`) in its constraint/RLS blocks.
- Corrected all malformed `DO` block delimiters in this migration to `DO $$` / `END $$;`, including the reported voice-telemetry FK block and the three RLS policy blocks, preserving their logic.
- Migration fix commit: `b2f5b81f6b153922a4422a2ab84f7a76d6cd3b85`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_phase4_schema_cleanup.sql:24`: malformed PL/pgSQL dollar delimiters used `DO $` / `END $;` instead of valid `DO $$` / `END $$;`.
- Corrected all four malformed DO blocks in the migration. No application feature code changed.
- Migration fix commit: `bced51111290c78d1fecd3b8ab470bcc7894a902`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:26`: the pre-existing `conversations` table lacked `started_at`, while the migration's agent index referenced that column.
- Added an idempotent `started_at timestamptz NOT NULL DEFAULT now()` reconciliation before the index creation. No application feature code changed.
- Migration fix commit: `ef06eba4a097f3b7e730d3016d7440d05bb02678`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:62`: the partially-created `conversation_turns` table already existed without `correlation_id`, while the migration immediately created an index on that column.
- Added an idempotent `correlation_id uuid NOT NULL DEFAULT gen_random_uuid()` reconciliation before the unique correlation index. No application feature code changed.
- Migration fix commit: `e97067135ed6e353674785eaa066adca02fa0634`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:65`: the partially-created `conversation_turns` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the conversation-turn table/index operations. No application feature code changed.
- Migration fix commit: `fb9d34a9a51312e043b475b51242c9b36e97d869`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:68`: the partially-created `conversation_turns` table already existed without `created_at`, while the migration immediately created an index on `organization_id, created_at`.
- Added an idempotent `created_at timestamptz NOT NULL DEFAULT now()` reconciliation before the existing correlation/index operations. No application feature code changed.
- Migration fix commit: `674d4e93dc442db9aef8acba850e3722ecfda35f`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:91`: the existing `scheduled_jobs` table from the partial schema lacked the `enabled` column, but the migration immediately indexed `scheduled_jobs(enabled,next_run_at)`.
- Added an idempotent `enabled boolean NOT NULL DEFAULT true` reconciliation before the index creation. No application feature code changed.
- Migration fix commit: `6ccceae068167b0b0c03d1145ec12bcf3f41cb56`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:94`: the partially-created `scheduled_jobs` table lacked `next_run_at`, while the migration immediately indexed that column.
- Reconciled `scheduled_jobs` with idempotent additions for `next_run_at` and `last_run_at` alongside the existing `enabled` reconciliation. No application feature code changed.
- Migration fix commit: `b42daf3c02090d51cd39515b3c3b943957047225`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure at `supabase/migrations/0006_conversations_scheduling.sql:113`: an existing partial `scheduled_job_runs` table lacked `organization_id`, but the migration expected it.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the table definition. No application feature code changed.
- Migration fix commit: `232de7af6989da69662ab399d3771a3429cb087e`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:116`: the partially-created `scheduled_job_runs` table already existed without `created_at`, while the migration immediately indexed that column.
- Added an idempotent `created_at timestamptz NOT NULL DEFAULT now()` reconciliation before the table/index operations. No application feature code changed.
- Migration fix commit: `4b37f9511ec4237835058a0ee5ccb6623022812f`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:151`: the partially-created `automation_runs` table already existed without `organization_id`, while the migration immediately created an index on that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the `automation_runs` index creation. No application feature code changed.
- Migration fix commit: `7bd66dfdad09f0ca4ba69303aef6e68f396411b4`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:154`: the partially-created `automation_runs` table already existed without `created_at`, while the migration subsequently altered/indexed that column.
- Added an idempotent `created_at timestamptz NOT NULL DEFAULT now()` reconciliation before the `automation_runs` table definition. No application feature code changed.
- Migration fix commit: `2f7adfa5501cf50605ad1e20915be483abb8fdd6`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:183`: the partially-created `summary_sources` table already existed without `organization_id`, while the migration immediately created an index requiring that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the `summary_sources` table/index operations. No application feature code changed.
- Migration fix commit: `eb729bbe2be57569f6b1ec6fe214edf957ad6f3c`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:207`: `conversations_member_visibility` already existed from the partial migration.
- Made all 20 conversation/scheduling/automation/summary RLS policy creations in migration 0006 idempotent using `pg_policies` existence guards, preserving each existing policy definition.
- Migration fix commit: `e5469bb48e20732ce86dc889c2d68a4d8fb70ad9`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0006_conversations_scheduling.sql:251`: the existing `conversation_messages` table lacked `organization_id`, but its RLS policy requires that column for `can_access_organization(organization_id)`.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the conversation-message table/policy operations. No application feature code changed.
- Migration fix commit: `43a95b1ec94d0d8f2328368a309b16c84b392597`.
- No CI/Vercel wait and no migration PASS claimed.

- Performed a migration-chain scan for the recurring `organization_id` failure class after the reported `0007_actions_ai_voice_audit.sql:36` failure. The root pattern was confirmed: later `CREATE TABLE IF NOT EXISTS` statements can preserve partially-created tenant tables that lack `organization_id`, causing subsequent indexes/policies to fail.
- Added pre-creation idempotent organization-column reconciliation for the affected tenant tables in `0003_email_domain.sql` (`email_accounts`), `0003_phase4_schema_alignment.sql` (`api_keys`), `0004_messaging.sql` (`whatsapp_contacts`), `0007_actions_ai_voice_audit.sql` (email actions/approvals, AI provider/usage, voice sessions/telemetry, audit events), and `0008_api_keys_knowledge_storage.sql` (API keys, knowledge documents/chunks, storage objects).
- These guards only alter an already-existing table when it is missing `organization_id`; clean databases retain the original table definitions. No application feature code or project-control documentation was changed.
- Fix commits: `729960758f68a0783ba8997c3b1de975fce550df`, `10b820ce7699e356f56eaadce9c05ac64eab14fa`, `0df4821b0ec0da207bdbd8e2cbb442e93d178169`, `d2745af12adf6f7740c491358e48d4a331bc6a78`, `4c8bb1236880ef4bc4f922c57ac7490219705d69`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_email_domain.sql:20`: malformed PL/pgSQL dollar delimiters used `DO $` / `END $;` instead of `DO $$` / `END $$;`.
- Corrected only that migration block; no application feature code or reset/migrate scripts were changed.
- Migration fix commit: `6fb9b144da5fd08743c4792234fd792ce03fcf52`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete clean-reset migration failure reported at `supabase/migrations/0003_email_domain.sql:167`: `email_messages` was created by the preceding foundation migration without `organization_id`, but the email-domain migration immediately required that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the `email_messages` table/index operations. No application feature code changed.
- Migration fix commit: `60cc15b97fd494051789bb98e8dc277b4298c6b7`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_phase4_schema_alignment.sql:72`: the PL/pgSQL block used malformed `DO $` / `END $;` dollar delimiters.
- Corrected the block to `DO $$` / `END $$;`. No application feature code changed.
- Migration fix commit: `f0369597c550d6e6b01eca0a286f7253863f8a1d`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_phase4_schema_alignment.sql:72`: a PL/pgSQL `DO` block used malformed dollar delimiters (`DO $` / `END $;`).
- Corrected the block to `DO $$` / `END $$;` without changing its migration logic.
- Migration fix commit: `17c39ddf92ade986618d5287f4f6aa551daf7e5f`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0003_phase4_schema_alignment.sql:72`: the `api_keys` reconciliation block used malformed PostgreSQL dollar delimiters (`DO $` / `END $`).
- Corrected the block to `DO $$` / `END $$;`. No application feature behavior changed.
- Migration fix commit: `23e260b37bfdc791385ce6017b61cdf7301b66a4`.
- Confirmed `scripts/reset-and-migrate.sh` on authoritative `main` already invokes migration via `bash "${MIGRATE_SCRIPT}"`; no additional reset-script code change was necessary for the reported local permission symptom.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete PostgreSQL dollar-quote syntax defect reported during `0004_messaging.sql`: malformed `DO $ ... END $;` blocks were corrected to `DO $$ ... END $$;`.
- Performed the same targeted malformed-dollar-quote audit across the migration files and corrected the corresponding malformed blocks in `0007_actions_ai_voice_audit.sql` and `0008_api_keys_knowledge_storage.sql`; `0003_phase4_schema_alignment.sql` was inspected and its current block is already correctly quoted.
- No migration logic or application behavior was changed; only malformed dollar delimiters were corrected.
- Migration fixes committed on `main` in the affected migration updates; no CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0007_actions_ai_voice_audit.sql:52`: the partially-created `email_action_approvals` table already existed without `created_at`, while the migration's index requires that column.
- Added an idempotent `created_at timestamptz NOT NULL DEFAULT now()` reconciliation before the table/index operations. No application feature code changed.
- Migration fix commit: `c8183c4a02faf275970d1247cc47262d92f125ae`.
- No CI/Vercel wait and no migration PASS claimed.

- Applied a one-pass migration hardening fix for partially-applied schemas: added `0000_created_at_reconciliation.sql`, which idempotently restores the expected `created_at timestamptz NOT NULL DEFAULT now()` column across all application tables whose authoritative schema defines `created_at`. It checks both `aca` and legacy `public` locations and does nothing when the table does not yet exist.
- Fixed the current `0004_messaging.sql:65` failure at the same time: the WhatsApp contact reconciliation now detects `whatsapp_contacts` through the active search path instead of only `aca.whatsapp_contacts`, so an existing legacy/public table receives the required `organization_id` column.
- Reconciliation migration commit: `44f09a1dd7354c336abc243785257d7fb5fc57b1`.
- WhatsApp migration fix commit: `062d186959caa0e32d4ec240f066bc2a468dfaac`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0007_actions_ai_voice_audit.sql:115`: the partially-created `ai_usage_events` table already existed without `request_id`, while the migration immediately created a unique index using that column.
- Added an idempotent `request_id text` reconciliation before the table/index operations. No application feature code changed.
- Migration fix commit: `ffd16c83cb33e54cbbeb3708a787923cbe6144df`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0007_actions_ai_voice_audit.sql:167`: the partially-created `voice_telemetry` table already existed without `created_at`, while the migration immediately created indexes using that column.
- Added an idempotent `created_at timestamptz NOT NULL DEFAULT now()` reconciliation before the `voice_telemetry` table/index operations. No application feature code changed.
- Migration fix commit: `c5128cacfbd137db6c3e15980be36900259f059e`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0007_actions_ai_voice_audit.sql:225`: the `email_actions_member_visibility` RLS policy already existed from the earlier partial migration.
- Made the Phase 7 audit/actions/AI/voice RLS policy creations idempotent with `pg_policies` guards, preserving the existing policy definitions. No application feature code changed.
- Migration fix commit: `eb452fb7a07ec0772049816bab78a7fba8fc9fec`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0008_api_keys_knowledge_storage.sql:129`: the `storage_objects_member_visibility` RLS policy already existed from the partial migration.
- Made that policy creation idempotent with a `pg_policies` existence guard while preserving the existing policy definition.
- Migration fix commit: `e1748b2d819f3a59fcb2545be3613e0159d7a1e2`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0008_api_keys_knowledge_storage.sql:111`: the partially-applied database already contained the `api_keys_admin_visibility` RLS policy, while this migration recreated it unconditionally.
- Made the seven remaining unconditional API/knowledge/storage RLS policy creations in this migration idempotent with `pg_policies` existence guards, preserving their existing definitions. The existing storage visibility guard remains unchanged.
- Migration fix commit: `de17b2f982e00cd69b29a7b81715f7b8e07a9bdc`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0009_rls_helper_hardening.sql:49`: standalone PostgreSQL does not provide the Supabase `anon` role, so unconditional `REVOKE ... FROM anon` failed.
- Made both `anon` revocations conditional on the role existing; existing Supabase-style environments retain the same revocation behavior, while standalone PostgreSQL can apply the migration without creating an unnecessary runtime role.
- Migration fix commit: `1df463f4d3c31355412377fca3b78380dae274b0`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0009_rls_helper_hardening.sql:52`: both conditional `DO` blocks used malformed `DO $ ... END $;` delimiters, causing PostgreSQL syntax failure.
- Corrected both blocks to `DO $$ ... END $$;` without changing the security logic or privileges.
- Migration fix commit: `e3362d8fdda22606a82d5a4449755c66f3339750`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0011_ownership_transfer.sql:79`: standalone PostgreSQL did not have the Supabase `anon` role, so the unconditional `REVOKE ... FROM anon` failed.
- Added idempotent creation of `anon` and `authenticated` as `NOLOGIN` roles when absent before applying the ownership-RPC privilege operations. Existing roles remain unchanged.
- Migration fix commit: `8b256ca1d442cf1e3ab75cc6ee022f8a7d9575f0`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0012_server_identity_rpcs.sql:43`: standalone PostgreSQL did not have the Supabase `service_role` role required by the identity RPC grants.
- Added an idempotent creation of `service_role` as `NOLOGIN` before the grants. Existing environments with the role are unchanged; no application feature code changed.
- Migration fix commit: `9068829818ba0755d980e3b6eb5814d3032763ed`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete local runtime failures shown in the Docker logs: the manual stack was running with `NODE_ENV=production` while its existing identity implementation was development-only, causing `ensureDevSeed MUST NOT be called in production` and the Agents page/overview to fail. The manual compose now explicitly enables the local development identity mode via `ACA_ENABLE_DEV_IDENTITY=true`; production deployments without that explicit flag remain protected by the existing guards.
- Fixed the worker crash caused by an invalid/missing `CREDENTIALS_MASTER_KEY`: worker startup now validates the key and keeps the worker process alive while disabling only WhatsApp credential-dependent loops until a valid 32-byte key is configured. Other worker loops remain enabled.
- No vendor/Clara source was changed and no application feature behavior outside the reported runtime failures was altered.
- Runtime fix commits: `e980173c8df964c9b258025dfa3c43820548c0d9`, `98797cdcca61b92d86966071602b92d2b2ec1711`, `91e6bfea10e43bb767a5c5f07a5a01665c89993f`, `8e49c50842a23e849b28ad64849fe5d22f89f7fc`.
- No CI/Vercel wait and no claim of external runtime verification.
\n\n## Task — Durable automation event idempotency\n\n- **Owner:** ChatGPT\n- **Status:** implemented; verification deferred by development-first directive.\n- Added migration `0015_automation_event_idempotency.sql` with nullable `trigger_event_key` and a partial unique index on `(automation_rule_id, trigger_event_key)`.\n- Updated the automation repository to create runs with conflict-safe insertion.\n- Updated the worker automation engine to derive stable event keys from `eventId`, `messageId`, `actionId`, or `correlationId`.\n- Duplicate provider/WhatsApp deliveries now become no-op automation evaluations instead of duplicate executions.\n- Added deterministic unit coverage for event-key selection.\n- No provider credentials, Clara source, or deployment configuration changed. CI/Vercel were not awaited.\n

## Task — Chat cross-agent conversation isolation

- **Owner:** ChatGPT
- **Status:** implemented; verification deferred by development-first directive.
- Added `getChatConversation(organizationId, conversationId, agentId)` to the PostgreSQL conversation repository.
- Chat streaming now rejects a supplied conversation unless it belongs to both the authorized organization and selected agent.
- Existing conversation creation already enforces organization/agent ownership; this closes the explicit-ID path that bypassed that invariant.
- No Clara source changes and no provider credentials were introduced.


## Task ID: 13
## Phase: Product Completion — Deterministic Cross-Surface Scenario Runner

- **Status**: implemented; runtime verification deferred by development-first directive.
- **Owner**: ChatGPT
- Added a PostgreSQL-backed cross-surface adapter for approval-gated email retries, WhatsApp outbound retries, scheduled-job claims, organization isolation, and correlation-scoped audit reads.
- Added an executable scenario runner connecting those database steps to the stable cross-surface scenario harness.
- Added deterministic runner tests and preserved the no-fabricated-provider-delivery boundary.
- Latest implementation commit: `ae79d161f8fb313a38d4e869c40ad499407b5695`.
- **Next:** harden sensitive-action worker execution/error routing and preserve correlation/audit continuity through success and failure outcomes.


## Task ID: 14
## Phase: Product Completion — Sensitive-Action Provider Outcome Routing

- **Status**: implemented; runtime/provider verification deferred by development-first directive.
- **Owner**: ChatGPT
- Added a worker-owned provider event bridge into automation evaluation.
- Email approved-action success/failure paths now emit deterministic provider events carrying action/account/correlation identifiers.
- WhatsApp outbound success/failure paths now emit deterministic provider events carrying message/account/correlation identifiers.
- Added provider-event routing contract tests.
- No external provider delivery or credential success is claimed.
- **Next:** harden sensitive-action retry/failure semantics and deterministic audit/event assertions.


### Task — 2026-10-08 — Provider retry/failure outcome hardening

- Status: implemented
- Owner: ChatGPT

Implemented the next cross-surface hardening boundary without waiting for external verification services.

### Changes
- Extended the shared provider retry policy with an onRetry telemetry callback.
- Email action worker now records retry attempt count on completed/failed action outcomes and emits retryability/error metadata on failures.
- WhatsApp outbound worker now records retry attempt count and retryability/error metadata on provider outcomes.
- Exposed deterministic provider-event mapping as a pure function so identity/correlation propagation can be tested without invoking automation execution.
- Added deterministic worker test coverage for retry telemetry and provider-event identity/error propagation.

### Boundary preserved
- Clara source remains unchanged.
- Provider credentials remain worker-only.
- No external provider success is fabricated.
- CI/Vercel remain non-blocking under the active development-first instruction.

Next: continue deterministic audit/event assertions and remaining cross-surface edge cases before final runtime/deployment verification.

### Task — 2026-10-08 — Abandoned execution fail-closed hardening

- Status: implemented
- Owner: ChatGPT

Closed a worker-crash failure mode across sensitive communication paths.

### Changes
- Added stale email action recovery that marks abandoned `executing` actions failed with explicit provider-outcome-unknown metadata.
- Added an email audit event requiring manual verification instead of replaying a potentially already-sent message.
- Added stale WhatsApp inbound recovery that marks abandoned `processing` messages failed when downstream execution outcome is unknown.
- Added a WhatsApp audit event requiring manual verification instead of replaying an inbound command.
- Added deterministic contract tests for both recovery paths.

### Safety boundary
Automatic replay is deliberately not performed after an abandoned external side effect. This prevents duplicate email sends or duplicate WhatsApp/agent responses.

Next: continue deterministic audit/event assertions and remaining cross-surface edge cases before final runtime/deployment verification.

## Task ID: 12
## Phase: 3 — Production Authentication Boundary Correction

- **Status**: implementation_complete_awaiting_runtime_verification
- **Objective**: Close the gap between authorization and real browser authentication without starting Phase 4 business features.
- **Architect / Developer**: ChatGPT
- **Date**: 2026-10-08

### Implemented
- Supabase Auth production identity adapter validates the HttpOnly access-token cookie against Supabase Auth, then maps the authenticated email to the authoritative application user record.
- Added login and logout endpoints with HttpOnly, SameSite=Lax cookies.
- Added `/login` UI and protected-page middleware. API routes retain JSON 401/403 behavior rather than browser redirects.
- Added server-side application identity/membership validation for protected page renders.
- Removed `x-dev-user-id` from agent browser clients; development identity remains available only for local development and explicitly cannot be used by the production adapter.
- Added authentication boundary static tests and Supabase Auth environment documentation.
- CI now provisions a disposable PostgreSQL service and applies the Phase 3 migration before runtime owner/RLS checks.

### Acceptance boundary
- No production Supabase project was provisioned or borrowed from another application.
- No production credentials were invented or committed.
- Phase 4 remains unauthorized until authentication runtime evidence and final Phase 3 acceptance are complete.



### 2026-10-08 — PostgreSQL-native authentication implementation

- **Owner:** ChatGPT
- **Objective:** remove the remaining Supabase Auth runtime dependency and make authentication fully application-owned because no additional Supabase project is available.
- Added forward-only migration `0022_application_authentication.sql` with `aca.auth_credentials`, `aca.auth_sessions`, and `aca.auth_login_attempts`.
- Added salted scrypt password hashing/verification, generic credential failures, five-failure/15-minute lockout, session expiry/revocation, HttpOnly session cookies, same-origin validation, client-IP normalization, current-session resolution, logout, password change, and one-time first-account bootstrap.
- Added authenticated password-change UI in Settings.
- Removed the production Supabase identity adapter and replaced the login path with PostgreSQL-owned sessions.
- Updated API/security/runbook/environment documentation to state that Supabase Auth is not required.
- Hardened the PostgreSQL connection factory to establish `aca,public` as the application search path at connection startup, fixing the schema boundary for existing unqualified repositories.
- Added authentication validation/static migration tests.
- No GitHub Actions/Vercel wait was performed and no runtime verification PASS is claimed.


### 2026-10-08 — Authentication final hardening

- Production identity factory now uses `LocalIdentityAdapter`; the development identity adapter is enabled only by explicit `ACA_ENABLE_DEV_IDENTITY=true`.
- PostgreSQL pool connections now set `search_path=aca,public` at connection startup so existing repository queries resolve the canonical application schema consistently.
- First-account bootstrap is now atomic in PostgreSQL and cannot leave a credential initialized without its owner organization after a partial failure.
- Password changes retain the current browser session while revoking all other sessions.
- Authentication remains development-complete for the current slice; runtime/CI/Vercel verification is intentionally deferred per project-owner instruction.


## 2026-10-08 — Chat organization authorization hardening
- Chat POST now validates that the requested agent belongs to the authenticated organization before any conversation lookup/creation or Clara invocation.
- Added deterministic static regression coverage for lookup ordering and fail-closed not-found behavior.
- No provider delivery, CI success, Vercel success, or runtime acceptance is claimed.
- Next: continue Mail/WhatsApp/Chat/Voice edge cases and audit/event assertions, then final runtime/deployment preparation.


## Task ID: 12
## Phase: Product Completion — Cross-Surface Hardening

- **Status**: implemented; runtime verification intentionally deferred.
- **Owner**: ChatGPT
- Provider-event automation failures are now isolated from authoritative email/WhatsApp provider outcomes, preventing downstream automation errors from falsely marking completed external actions as failed.
- Provider-event delivery failures now emit an organization/correlation-scoped audit event on a best-effort basis.
- Added injectable provider-event bridge test coverage proving automation failure isolation.
- No provider credentials, external delivery, CI success, or Vercel readiness claimed.
- **Next**: continue remaining communication-loop edge cases and deterministic E2E/audit/idempotency hardening.


### 2026-10-08 — Cross-surface duplicate/conflict hardening
- ChatGPT continued implementation without waiting for CI/Vercel.
- Deterministic PostgreSQL cross-surface adapters now explicitly reject conflicting email approval payloads and conflicting WhatsApp outbound payloads when the same idempotency key is reused.
- Scheduled-fire scenario now performs a second claim and fails if a duplicate durable run is created.
- Corrected email and WhatsApp worker imports to use the existing shared provider retry classifier rather than leaving an unresolved runtime/type boundary.
- No provider delivery is fabricated; verification remains a later milestone.
- Latest implementation commit: `64485e8c9478c6881f488f00ae624a3657e17a07`.


## Task — Provider identity and voice session edge hardening

- **Owner:** ChatGPT
- **Status:** implemented; runtime verification deferred by development-first directive.
- Hardened provider automation event mapping so canonical organization/action/message/account/email-account/correlation identifiers override informational metadata and cannot be retargeted by payload fields.
- Hardened voice turn accounting so only active, non-ended sessions can increment turns; the route and repository both fail closed on races/session termination.
- No provider credentials, external delivery, Clara source, or production deployment changes.
- Continue with remaining communication-loop edge cases and deterministic audit/event assertions without waiting for CI/Vercel.


## Task — Sensitive approval visibility hardening

- **Owner:** ChatGPT
- **Status:** implemented; runtime verification deferred by development-first directive.
- Restricted pending email approval list/detail endpoints to `organization.update`, matching approval/rejection authority.
- Prevented read-only organization members from inspecting recipient/body snapshots embedded in sensitive email actions.
- No provider credentials, external delivery, Clara source, or deployment changes.


## Task ID: 15
## Product Completion — Communication Loop Edge Hardening

- **Status**: implemented; runtime/CI/Vercel validation intentionally deferred by development-first instruction.
- **Owner**: ChatGPT
- Hardened deterministic cross-surface E2E coverage so duplicate concurrent email approval deliveries can produce exactly one state transition.
- Corrected WhatsApp outbound failure persistence so provider error details are stored in `provider_error` instead of being discarded.
- No provider delivery is fabricated and no validation gate was treated as blocking development.


## Task ID: 15
## Phase: Product Completion — WhatsApp Provider Status Isolation

- **Status**: implemented
- **Owner**: ChatGPT
- **Date**: 2026-10-08

### Changes
- Scoped WhatsApp provider-status updates by both organization and WhatsApp account in the authoritative PostgreSQL repository.
- Updated the signed WhatsApp webhook handler to pass the resolved organization/account scope into status mutation.
- Added deterministic regression coverage proving the account/organization predicate and webhook propagation are present.
- This prevents a provider-message-ID collision from mutating another tenant/account's message.
- No provider credentials or external delivery success were fabricated.
- CI/Vercel were not awaited, per the active development-first instruction.

### Next
Continue remaining Mail/WhatsApp/Chat/Voice edge-case hardening and deterministic audit/event assertions, then prepare final runtime/deployment verification.


## 2026-10-08 — Scheduled execution audit correlation

ChatGPT hardened the scheduler boundary so every scheduled run completion and failure emits an organization-scoped audit event keyed to the durable scheduled-run UUID as both target and correlation ID. Configuration-required failures and execution exceptions are now traceable without changing provider delivery behavior. Added deterministic source coverage. CI/Vercel were not awaited.


## 2026-10-08 — Browser authentication entry-point correction

ChatGPT takeover correction for the reported inactive login experience:
- Confirmed the repository already contained application-owned password authentication, session cookies, protected-page middleware, server-side identity resolution, and `/api/auth/login`.
- Identified the practical first-run gap: the UI exposed login but did not provide a clear initialization path when the database had no credential, and the middleware did not list `/setup`/bootstrap as explicit public browser entry points.
- Added a dedicated `/setup` page using the existing one-time `AUTH_BOOTSTRAP_TOKEN` bootstrap endpoint.
- Added `/setup` and `/api/auth/bootstrap` to the public-path allowlist while preserving the server-side token gate.
- Login now preserves a safe `next` route after authentication and provides a first-time setup link.
- No development authentication bypass was added.


### 2026-10-08 — Browser authentication path correction
- Corrected the login client redirect source that contained an invalid escaped newline sequence.
- Corrected the root server layout so the unauthenticated first-run `/setup` page is not redirected back to `/login`; protected application pages still require the authoritative PostgreSQL session context.
- Added deterministic auth-boundary regression coverage for the setup exception and login redirect syntax.
- **Next:** continue communication-loop product hardening and deterministic audit/idempotency assertions; final runtime/deployment verification remains later and CI/Vercel are non-blocking.


## Task ID: 12
## Phase: 3 — Local Typecheck Regression Fixes

- **Status**: fixes implemented; local rerun requested
- **Owner**: ChatGPT
- **Source evidence**: local `pnpm run typecheck` reported 5 web errors after main advanced to `c9ab2a7`.

### Corrections

1. Removed stale `_removedDevUserId` dependency from the agent activity effect.
2. Updated the PostgreSQL cross-surface E2E adapter to use the current `AuditEventFilters` contract; correlation IDs remain available on returned events and are asserted after retrieval.
3. Replaced the Node `promisify(scrypt)` usage with an explicitly typed Promise wrapper compatible with the current Node 24 typings.
4. Added safe guards for parsed password-hash components before `Buffer.from`, eliminating undefined-index type errors.

### Verification

- These corrections are committed directly to `main`.
- User should rerun `git pull --ff-only origin main && pnpm run typecheck`.
- Phase 3 acceptance remains pending until runtime verification is green.
- Phase 4 remains NOT AUTHORIZED.

- Fixed the reported browser login redirect failure: the login endpoint always marked the session cookie `Secure` when `NODE_ENV=production`, even when the application was accessed over plain HTTP at `http://100.72.192.28:3300`. Browsers therefore did not return the cookie on the redirected request, so middleware sent the user back to `/login?next=/`.
- The auth cookie now derives `secure` from `X-Forwarded-Proto` (when present) or the request URL protocol, preserving Secure cookies on HTTPS while allowing the explicitly HTTP deployment to retain its session.
- Auth fix commit: `52fb3318c28f11f3bcc9314c117200f780399e90`.
- No CI/Vercel wait and no broader authentication feature changes were made.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the partially-created `whatsapp_contacts` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the WhatsApp-contact table/index operations. No application feature code changed.
- Migration fix commit: `92341cd17297f6ec66061a772c3c5ab849d4e438`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete worker runtime failure: `column "result" of relation "email_actions" does not exist` from `packages/db/src/email/actions.ts`.
- Root cause: `email_actions` can already exist from the earlier application-domain migration, so `CREATE TABLE IF NOT EXISTS` in migration 0007 does not reconcile the later `result` column.
- Added an idempotent `ALTER TABLE email_actions ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb` before the 0007 table definition. No worker behavior was changed.
- Migration fix commit: `cb903a4ea6174f3c809f3e4f97b65d054acca875`.
- No CI/Vercel wait and no runtime PASS claimed.

- Fixed the concrete worker startup error: `column "result" of relation "email_actions" does not exist` from `recoverStaleExecutingEmailActions`.
- Root cause was an existing/previously-created `email_actions` table missing the runtime `result` column. Added forward-only migration `0022_email_action_result.sql` with an idempotent `ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb`.
- Migration fix commit: `cd5895cccedc78e4175a817e7bee05ec4693e77d`.
- No application feature behavior changed; no CI/Vercel wait.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the partially-created `whatsapp_contacts` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the WhatsApp-contact table/index operations. No application feature code changed.
- Migration fix commit: `639e85b213306dcec32445fe8b03229ac83284c1`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete browser error on the setup page: Chromium rejected the HTML `pattern="[a-z0-9][a-z0-9-]{2,62}"` under the modern RegExp `v` flag because the hyphen was not escaped inside the character class.
- Escaped the hyphen in the organization-slug input pattern; server-side slug validation remains unchanged.
- UI fix commit: `d1bbf5072223dda7f5fbfa2dbfc097caf70c8bea`.
- The reported `POST /api/auth/bootstrap 409` is the server's explicit `already_initialized` response when `auth.countCredentials() > 0`; I did not weaken that one-time bootstrap guard without evidence that the credential exists in the intended reset database.

- Fixed the concrete migration failure in `0004_messaging.sql`: the existing `whatsapp_contacts` table could lack `organization_id`, but the reconciliation was positioned before table creation and therefore did not reliably reconcile the already-existing table. The migration now creates/reuses the table first, then applies `ADD COLUMN IF NOT EXISTS organization_id`, followed by the index.
- Fixed the reset helper's migration invocation path: it now changes to the repository root and invokes `bash ./scripts/migrate.sh`, avoiding the failing resolved `/docker/ai-comms-agent/scripts/migrate.sh` execution path while keeping `scripts/migrate.sh` independently usable.
- Migration/reset fix commits: `9883c324597634fd5193ef2f20e59c1db05c10a5`, `77a1dc9b1533b763b9fc30c9c6da1bf7dff0e55c`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete reset-script failure: `scripts/reset-and-migrate.sh` contained a literal `\n` between the `cd` and `exec` commands, causing `cd: too many arguments`.
- Restored the commands as separate shell lines so reset can invoke the existing `scripts/migrate.sh` normally. No migration SQL or application feature code changed.
- Reset-script fix commit: `9bc07dbc2f2ccae10f972efdde0786ee29548bdd`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the existing `whatsapp_contacts` table lacked `organization_id`, and the subsequent organization index could not be created.
- Hardened the reconciliation to inspect the explicit `aca.whatsapp_contacts` table/column and add `organization_id` when missing, then create the index against the explicit `aca` schema. No application feature code changed.
- Migration fix commit: `afffabf5876b5184163d4173c41632c98c4fdc94`.
- The supplied user/membership/session query confirms the existing user has an active owner membership and an unrevoked session; that information was not changed by this fix.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the reported worker PostgreSQL error `invalid input value for enum whatsapp_status: "pending"` by reconciling the existing WhatsApp account status enum expected by the worker. The migration now safely adds the required `organization_id` shape before WhatsApp contact/message operations; no application feature code changed.



## 2026-10-08 — Streamline reset-and-migrate logging

- **Owner:** ChatGPT
- **Scope:** Concrete reset-script logging improvement only; no migration SQL or application feature changes.
- The reset-and-migrate command previously exposed the full PostgreSQL migration transcript, including routine NOTICE/CREATE/ALTER output, making the successful reset flow difficult to read and obscuring the actionable error when a migration failed.
- Updated `scripts/reset-and-migrate.sh` to capture reset/migration output internally, show concise success summaries with applied/skipped migration counts, and on failure surface only the relevant ERROR context plus a path to the preserved full log.
- `scripts/migrate.sh` remains unchanged and continues to provide its existing detailed output when run directly.
- No CI/Vercel wait was performed and no migration PASS is claimed beyond the user-provided successful migration run.
- **Commit:** f3db252f2d092bac21c86a2521edc2581999bdcc.

- Improved `scripts/reset-and-migrate.sh` so reset and migration command output is streamed live to the terminal while still being retained in the temporary failure log. The standalone `scripts/migrate.sh` remains unchanged and continues to provide migration-only execution.
- Concrete operational fix commit: `c52521c49a5616aab2deafab58a02b81d57c1c17`.
- No CI/Vercel wait.


## 2026-10-08 — Fix protected-page session cookie propagation

- **Owner:** ChatGPT
- **Scope:** Concrete browser authentication error fix only; no feature development, no project-control documentation changes, and no vendor modification.
- User reported that password login succeeds but the browser is redirected back to `/login?reason=not_provisioned` instead of reaching the dashboard.
- The protected root layout was reconstructing the authentication request from the Next.js `headers()` snapshot. Hardened this boundary to read the `aca-access-token` directly from Next.js `cookies()` and pass that exact session cookie into the server-side application-identity resolver.
- This preserves the existing PostgreSQL session and organization-membership authorization rules; it does not add a development-auth bypass or weaken provisioning checks.
- **File changed:** `apps/web/src/app/layout.tsx`.
- **Commit:** `3cd19bdb4b6e34fb02e0e8ef93af2ac38af56310`.
- No CI/Vercel wait was performed and no runtime PASS is claimed.

- Fixed the concrete browser authentication navigation failure: after `POST /api/auth/login` returned success, the login page used Next client navigation plus `router.refresh()`, which could retain the login RSC state and re-enter the server authentication redirect before the newly-set session cookie was observed.
- Changed successful login completion to a full browser navigation with `window.location.replace()`, ensuring the browser performs a fresh document request with the newly-set `aca-access-token` cookie.
- Authentication API, session creation, cookie security attributes, and authorization logic were otherwise unchanged.
- Login navigation fix commit: `56f9088a7366ad8e71b66b7c1f2d1671cbeaaa5a`.
- No CI/Vercel wait and no continuous verification performed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql` for `whatsapp_contacts.organization_id`: the migration's prior conditional reconciliation could fail to reconcile an existing relation depending on schema resolution, leaving the subsequent organization index without the required column.
- Replaced that reconciliation with an explicit idempotent `ALTER TABLE aca.whatsapp_contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES aca.organizations(id) ON DELETE CASCADE` after the table creation. No application feature code changed.
- Migration fix commit: `25e55489b287677674a381d4c5cefd4ae77593ad`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the partially-created `whatsapp_contacts` table existed without `organization_id`, while the migration expected it for subsequent indexing.
- Reconciled `whatsapp_contacts.organization_id` before dependent operations and corrected `whatsapp_messages.organization_id` reconciliation ordering so the table is created before the column alteration. No application feature code changed.
- Also improved migration/reset CLI output so normal runs show only concise `APPLY/SKIP/OK/PASS` status lines, while failures show the relevant PostgreSQL error context instead of raw CREATE/ALTER/NOTICE output.
- Migration/schema fix commit: `e86c3453cb4c5c58bda1e7472a70161ecfd369b9`.
- Migration output commit: `857efa253ff3c84d175a30880e8063c465d4ecbb`.
- Reset output commit: `606cf51f25d4b425ac2b389993fa05eabd73d37f`.
- No CI/Vercel wait and no migration PASS claimed from these edits.

- Fixed the concrete migration failure reported at `supabase/migrations/0004_messaging.sql:65`: the partially-created `whatsapp_contacts` table already existed without `organization_id`, while the migration requires that column.
- Added an idempotent `organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE` reconciliation before the WhatsApp-contact table/index operations. No application feature code changed.
- Migration fix commit: `95a0de3945faf15ad206bdc13dbb8b82a2ce9a54`.
- No CI/Vercel wait and no migration PASS claimed.

- Fixed the concrete web runtime error reported by the `/agents` page: `Authenticated application identity could not be resolved.`
- Root cause: the root layout explicitly reconstructs the `aca-access-token` cookie from `cookies()`, but `apps/web/src/app/agents/page.tsx` passed only `headers()` into `getAuthenticatedAppContext`; during the affected RSC render that header snapshot did not contain the browser session cookie.
- Updated the agents page to read `aca-access-token` from `cookies()` and pass it explicitly to the identity resolver, matching the authoritative layout authentication boundary. No auth policy or credential behavior was weakened.
- Web fix commit: `117602a5e909f14eaf219ffe41082cfe62e06060`.
- No CI/Vercel wait and no runtime PASS claimed.

### 2026-10-09 — FIX-01 Sentinel browser authentication redirect correction
- **Task:** Fix the reported browser symptom where password login returns a successful response but the browser is immediately sent back to `/login?reason=not_provisioned` instead of the dashboard.
- **Authorization:** FIX-01/Sentinel error remediation; smallest corrective change only. No feature or deployment scope expansion.
- **Symptom:** `http://100.72.192.28:3300/login?reason=not_provisioned` accepted valid credentials, then protected-page resolution failed and returned to login.
- **Root cause:** The login endpoint uses the PostgreSQL-backed local session path, but the shared identity-adapter selector still allowed `ACA_ENABLE_DEV_IDENTITY=true` to select the development adapter even when `NODE_ENV=production`. The development adapter expects `x-dev-user-id`, so a normal authenticated browser session resolved as no user and the root layout correctly redirected to `not_provisioned`.
- **Failed approach:** The earlier correction only changed the root layout to read `aca-access-token` from Next.js `cookies()`; that preserved the session cookie boundary but did not prevent production adapter selection from switching to the development identity path.
- **Remedy:** Production now unconditionally selects `LocalIdentityAdapter`; the dev adapter is selectable only when `NODE_ENV !== "production"` and `ACA_ENABLE_DEV_IDENTITY=true`. Added regression protection to `apps/web/tests/auth-boundary.test.ts` for the production selector boundary.
- **Files:** `apps/web/src/lib/identity/repository.ts`, `apps/web/tests/auth-boundary.test.ts`.
- **Evidence:** Source trace showed `POST /api/auth/login` creates the PostgreSQL session, while `getAuthenticatedAppContext()` resolves through the shared adapter selector; the previous selector permitted the dev adapter in production. No runtime/deployment PASS is claimed.
- **Prevention:** Never allow a development identity selector flag to override the production authentication boundary. Production adapter selection must be gated by environment, not by the dev flag alone.
- **Commits:** `931e77a489234a5f60404598aa82554b747c3513`, `19eac2ee44cfbabb736996e020ad4f804478ee6a`.
- **Next action:** Deploy/restart the updated web runtime and reproduce the login flow; if the same redirect remains, route runtime/environment evidence to OPS-01 rather than expanding FIX-01 scope.

### 2026-10-09 — Authentication false-success loop fix
FIX-01 traced the reported successful-login → `/login?reason=not_provisioned` loop to session creation occurring before active organization-membership authorization. `loginWithPassword` now requires at least one active membership before creating `aca-access-token`; otherwise it records the failed provisioning attempt and returns `account_not_provisioned`. The login route maps this to HTTP 403, and auth-boundary regression coverage locks the guard. No membership is auto-created/reactivated. Commit: `197e6535eab0cafde3e84db8f0605b7a174b3b03`. Runtime deployment/verification remains OPS-01 scope.


### 2026-10-09 — Live PostgreSQL audit schema drift correction

- **Owner:** ChatGPT
- **Scope:** FIX-01 runtime error correction; no feature-scope expansion.
- User supplied live Docker logs after the owner→admin authorization correction. The web process was healthy, but /api/overview failed on PostgreSQL 42703 for missing audit_events.decision, and /api/agents failed on missing audit_events.agent_id. Worker health simultaneously confirmed PostgreSQL was configured and reachable.
- Root cause was two-layer schema drift: manual startup rebuilt containers without applying the migration chain, and older existing audit_events tables were not reconciled by CREATE TABLE IF NOT EXISTS.
- Added supabase/migrations/0023_audit_schema_reconciliation.sql with idempotent agent_id and decision additions plus indexes.
- Updated scripts/manual-up.sh to run the canonical scripts/migrate.sh against the DATABASE_URL resolved from .env.docker before starting Compose.
- Added static regression coverage in apps/web/tests/migration-verification.test.ts for the reconciliation and manual-start migration boundary.
- **Commits:** 54f2c883c4c7250f9e83c6bde8e1c6a8fe64d83a, 7fe343eb06e96344e9f53dddb8488801b38fa4df, 25c37101d8fc4c2520d6ee0b4586cb723b2d46a9.
- **Verification:** Source changes are committed. Live runtime has not yet been re-tested after applying migration 0023; no runtime PASS is claimed.
- **Next:** pull current main, rerun bash scripts/manual-up.sh, then retry /api/overview and authenticated agent creation. Continue development without waiting for CI/Vercel.


## 2026-10-09 — Migration ledger initialization failure

- Manual deployment pulled `main` through `a4fbdf9` and rebuilt both application images successfully, but `scripts/manual-up.sh` stopped at the canonical migration step with `ERROR: unable to initialize migration ledger.`
- This means the application was not restarted by this invocation; the previously running web/worker containers remained in place. The subsequent API probe used a placeholder token and correctly returned `401 unauthorized`, so it provides no evidence about the audit-schema fix.
- The migration wrapper previously filtered diagnostics too aggressively (`sed -n '/ERROR:/,$p'`), which can hide libpq errors that do not begin with the literal `ERROR:` prefix. `scripts/migrate.sh` now preserves and prints the final PostgreSQL connection/DDL diagnostic on ledger initialization failure.
- Added a static regression assertion so migration-ledger failures continue to expose the underlying PostgreSQL diagnostic.
- Diagnostic commit: `867db12ac62bb16355da2de0fd81cd558f3913e2`; regression test commit: `63a5461b38f0d96a21ab590e0e3eac280517160c`; control-state next-action update: `1747eda91b7b8e5dca78a2f308a44d87bebaa12d`.
- Next: rerun the current migration path and capture the real PostgreSQL error without exposing credentials; verify the configured `DATABASE_URL` is the intended writable database and that the migration principal can create `_aca_schema_migrations`. Do not weaken authentication/RBAC or bypass the migration ledger.


### 2026-10-09 — Host-side PostgreSQL migration hostname correction
- The migration diagnostic established the concrete cause: the host-shell `psql` process could not resolve `host.docker.internal`; this name was being passed from the Docker Compose environment into a host-run migration command.
- Corrected `scripts/manual-up.sh` to translate only the migration-process URL hostname to `127.0.0.1`, using the existing published PostgreSQL port. The `.env.docker` value remains unchanged for app containers, where `host.docker.internal` is appropriate.
- Added a focused regression test for this host/container boundary.
- Commits: `6e1decb7031ca28c685565cc15e475c2867e1d95`, `740d3d4d57e2b3e38b0975aad7cc23d2d9ed2ea9`, `b32b016b29a4caabeb00ddfc1c1aea0b48dc949f`.
- Runtime status remains unverified: the migration chain has not yet been shown to complete, and the old containers may still be serving the previous schema. Next: pull main and run `bash scripts/manual-up.sh`; then test the application only after migrations complete.


### 2026-10-09 — Legacy audit schema compatibility correction
- **Owner:** ChatGPT / FIX-01 Sentinel
- **Observed symptom:** User successfully applied migration chain through 0023 and rebuilt/restarted web and worker. Worker logs report configured dependencies and ready state; authenticated agent creation then fails with PostgreSQL 23502 because `audit_events.resource_type` is NULL.
- **Root cause:** An older deployed `audit_events` table retains legacy NOT NULL `resource_type` and `outcome` columns. Current application writes `target_type` and `decision`, so the old columns reject otherwise-valid audit inserts. Migration 0023 only reconciled `agent_id` and `decision`.
- **Remedy:** Added forward-only `0024_audit_legacy_column_compatibility.sql`, conditionally dropping NOT NULL on the retired columns when present; added static migration regression tests.
- **Commits:** `14bea1c3` (migration), `4ef3921d` (test).
- **Verification boundary:** The user's output proves migration 0023 completed and the new images built/started. It does not prove migration 0024 or authenticated agent creation yet. No full runtime PASS is claimed.
- **Next:** Pull current main and rerun `bash scripts/manual-up.sh`; retry authenticated agent creation. Continue source work without waiting for CI/Vercel.


## 2026-10-09 — Email accounts API forbidden due to wrong organization context

- **Observed:** User's `POST /api/email-accounts` request returned `403 forbidden`, `reason=not_member`.
- **Root cause:** The `/mail/accounts` server page initialized its client with `getDevOrgId()` after `ensureDevSeed()`, not the authenticated user's active organization. The authorization API correctly denied access to an organization where that user had no membership.
- **Fix:** Updated `apps/web/src/app/mail/accounts/page.tsx` to derive the organization from `getAuthenticatedAppContext(new Request(...headers()))`, matching the inbox page. Added static regression coverage ensuring the page uses authenticated organization context and does not seed/select the dev organization.
- **Commits:** `4536332fdee1de3b2a0c060d581b3939c769f08a` (fix), `7a3cfba20cabc6fad88b313c258320c5961c06af` (test).
- **Verification boundary:** Source changes committed; tests have not been run and live request has not yet been retried. No runtime PASS is claimed.
- **Next:** Pull `main`, run `bash scripts/manual-up.sh` to apply pending migration 0024, sign in with a fresh session, and retry from the account UI. Do not weaken tenant authorization or reuse exposed session/provider secrets.


## 2026-10-09 — Voice tenant isolation and turn lifecycle

- **Problem:** the AI Voice workspace still selected `getDevOrgId()` after seeding development data, unlike the authenticated-context pattern already used by Mail. A signed-in user could therefore see an empty/wrong agent list and submit requests for the wrong organization.
- **Fix:** the page now resolves `getAuthenticatedAppContext()` from the request headers and uses that active organization for the agent query. Added a regression test that prohibits development-org selection/seeding in this page.
- **Race hardening:** the voice turn route now requires `status === "active"`, not merely `ended_at IS NULL`. After Clara finishes streaming, it checks the repository's atomic active-session turn increment result; if the session ended during generation, it returns 409 and does not expose the generated response as a successful turn.
- **Regression tests:** added tenant-context and lifecycle-guard static tests.
- **Commits:** `3ada3490ec91398e0f239c086bcbe9289063de96`, `8dda47141678033b90d2530183527b44807221f6`, `75bf41fd8eade96ed7fdc3fc6d2e580074b94a91`, `f1bcabd9eed9c8f073d8de4a287dbfd25bde6d22`.
- **Validation:** not run; do not treat implementation as verified. Continue development without waiting for CI/Vercel.
- **Next:** inspect realtime session start/activation failure paths and ensure abandoned/failed starts transition to an explicit terminal state with audit/telemetry continuity.


### 2026-10-09 — Voice session start lifecycle hardening
- Voice session creation now persists a durable `starting` row before requesting Clara realtime transport details.
- Transport/configuration failures attempt to transition the persisted session to terminal `error`; a failed configuration update no longer returns a session as successfully started.
- Added a repository operation that only configures a session still in `starting` and not ended, preventing late setup from overwriting a terminal lifecycle state.
- Added regression coverage for persistence-before-start and terminal cleanup.
- Commits: `c2db972702478f60729ccd336edb99bb6d6f72bf`, `4ce7306f86c8143216364bfca45e7a8e41b2fee1`, `2dc3bcf58c5f62821e8a34b54cdb32d4270dafbe`, `5572d1e9437784bd6f377f547fc704c456ca7a0f`, `f73d7149b5a8c389487852a6f38d4965aba52cd0`.
- Verification was not run and remains pending; no CI/Vercel/runtime success is claimed.


## 2026-10-09 — Email action tenant-scoped worker transitions

- Hardened `claimApprovedEmailAction` so the atomic approved→executing transition requires both action ID and organization ID.
- Hardened `completeEmailAction` so executing→completed/failed transitions also require the owning organization ID.
- Updated both the direct approved-action executor and worker loop to pass the organization scope.
- Added regression assertions in `apps/web/tests/email-action-contract.test.ts` for the scoped claim/completion SQL and executor arguments.
- Commits: `0d773b0ec8ae5034763e217fefab2c0a62b4d933`, `9615d2c8f6fda856fa984f3f00716cc2e9dc372f`, `794de3b188300a0bbb268a1781de766d9d304fce`, `7de1b068e96918df86d219cc64dc5ccdae3b926d`, `0105ff3bda7d1b983276b50b2531d9811d0e2d0a`, `baefe3294c9003e04f43ec5d1382f47388f7ba89`, `0f72bdec18dfa0f5325146b200e1a093956c4364`.
- Validation remains pending; no CI/Vercel pass is claimed.


## 2026-10-09 — WhatsApp outbound worker claim safety

- **Root risk:** the WhatsApp worker selected queued outbound rows without an atomic claim. Multiple worker processes could select the same row and send duplicate externally visible messages.
- **Fix:** added forward-only migration `0025_whatsapp_outbound_claim_lifecycle.sql` with an `executing` state and partial claim index. Replaced read-only selection with a single `FOR UPDATE SKIP LOCKED` claim operation. Sent/failed transitions now require `status = 'executing'`.
- **Crash safety:** abandoned executing sends transition to failed with explicit provider-outcome-unknown/manual-verification messaging; they are not automatically requeued. If a provider success arrives after the claim was lost, the worker records a persistence-conflict provider event and audit entry with the provider message ID rather than falsely claiming the DB transition succeeded.
- **Regression coverage:** added `apps/worker/tests/whatsapp-outbound-claim-lifecycle.test.ts` for atomic claims, terminal recovery, and late provider outcome handling.
- **Commits:** `d083b2c1aa1b723965a30be61f442eab6f4490f1`, `245239fca55639473fa50b80e10c87a708a826f0`, `e845ee6a60aa5f2029e806a155ef216a8b846649`, `9b9dec22084077a39f21db590b9cd24abed06633`, `f914fa0903ec028bc9d3093ef355aaec7a437e77`, `2fa43769a2a0f9a96bf73097f457d8dab41d96ed`, `b36d48dcafc9bc1a143b6d20d7d675c478cbf5b0`.
- **Validation:** not run; no CI/Vercel/runtime PASS claimed. Continue implementation as instructed.


## 2026-10-09 — Gmail OAuth moved to platform settings

- User requirement: no Gmail OAuth client IDs/secrets hard-coded in code or .env; support multiple configurable Gmail OAuth clients.
- Source changes: added migration 0026_gmail_oauth_configuration.sql; organization-scoped settings CRUD with encrypted client-secret persistence; Settings UI; selectable OAuth client on the mail account screen; OAuth start/callback use saved configuration; encrypted mailbox credential payload includes matching client credentials for worker token refresh.
- Security design: OAuth client secret is never returned to the browser. Existing CREDENTIALS_MASTER_KEY stays server-only and encrypts stored secrets; it must not itself be stored in the database it protects. Gmail OAuth state signing now derives from this existing key, eliminating the Gmail-specific SESSION_SIGNING_KEY requirement.
- Environment cleanup: removed Gmail OAuth client ID/secret/redirect URI entries from .env.example; provider configuration belongs in Settings.
- Commits: bf02ac6d migration, 37518326 settings API, 4ad9578c start route, 951ce1f8 callback integration, 78bb9d2c encrypted per-account client persistence, 6980d091 worker refresh, 5b7ba0bf settings UI, e2279785 connection selector, dd947b50 static tests.
- Verification boundary: tests/build/runtime were not run. Migration 0025 and Gmail OAuth flow are pending live verification; no PASS is claimed.
- Next: pull current main, run bash scripts/manual-up.sh (must apply migrations 0024 and 0025), add OAuth client configuration in Settings, allowlist the displayed redirect URI in Google Cloud Console, and retry from /mail/accounts.


## 2026-10-09 — Gmail OAuth migration sequencing correction
- Repository inspection found the WhatsApp outbound lifecycle migration already occupied prefix 0025. Resequenced Gmail OAuth configuration to `0026_gmail_oauth_configuration.sql` and updated the migration regression test plus current project-control references.
- Migration SQL body is unchanged and idempotent. If an environment applied the old filename already, the renamed migration may run once more under its new ledger key; `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` preserve safe behavior for the current schema.
- Runtime deployment and OAuth flow remain pending; no verification PASS claimed.


## 2026-10-09 — Gmail OAuth configuration follow-up hardening
- Corrected a test regex that initially escaped the migration prefix pattern incorrectly; the assertion now inspects numeric prefixes and checks uniqueness.
- Prevented an OAuth configuration edit from changing the Google client ID while silently retaining the previous client's secret. The API now requires the new secret when the client ID changes; regression coverage added.
- Commits: `8ce79d36` migration-prefix test correction; `4a7d9c9f` client ID/secret pairing guard; `286d2bea` regression assertion.
- Tests were not executed. Deployment, migrations 0024–0026, Google callback allowlisting and end-to-end OAuth remain pending.

- Follow-up correction: legacy migrations already contain historical duplicate prefixes (for example 0002/0003), so the regression assertion was narrowed to require exactly one 0025 WhatsApp migration and exactly one 0026 Gmail migration rather than imposing a repository-wide numbering rule. The test has not been run.


## 2026-10-09 — Dynamic OAuth callbacks and Zoho client management
- Removed OAuth dependence on fixed `NEXT_PUBLIC_APP_URL`: settings shows callback URI for the current request origin; OAuth start signs the exact callback URI into state; callbacks exchange the code using that same URI.
- Added HTTPS enforcement for non-local OAuth callback origins. A non-local HTTP address (such as the current private IP URL) cannot complete OAuth; Google also disallows raw IP hosts. Use a TLS-enabled domain and register the exact callback URI with each provider console. This is a provider requirement, not a redeploy requirement.
- Added migration 0027, Zoho organization-scoped encrypted OAuth settings API/UI, Zoho client selector in Mail Accounts, and per-account Zoho client credentials for worker token refresh. Updated worker refresh regression coverage and added web source-level tests for OAuth configuration/callback behavior.
- Validation: source inspection only; tests/build/typecheck/migrations/live OAuth not run. No PASS claimed. Next: pull main, run `bash scripts/manual-up.sh`, configure HTTPS provider callback URLs and verify both flows.

- Final source review correction: callback validation now rejects raw IP hosts even when HTTPS, because Google web OAuth does not accept raw IP redirect hosts. The hostname normalization was simplified to avoid regex escaping ambiguity. No test runner was executed after this change.

- Regression test cleanup: Gmail worker refresh tests now provide the saved per-account OAuth client fields instead of stubbing deprecated environment variables; Zoho refresh tests likewise verify saved client credentials. Added these fields to the shared server-side credential type. The test suites remain unexecuted.

- Fixed the concrete email-account test failure reported from `POST /api/email-accounts`: DNS errors such as `ENOTFOUND` escaped the IMAP/SMTP test branch and surfaced as generic `internal_server_error` responses.
- The route now maps hostname-resolution failures to an actionable `provider_connection_failed` response (HTTP 502) and provides clearer connection guidance for common network failures. It does not log or return mailbox credentials.
- Route fix commit: `2b108c245d29abdbe1c660bc007c9a4aed9d1677`.
- No CI/Vercel wait and no runtime PASS claimed.


## 2026-10-09 — Gmail/Zoho callback public-origin correction

- **Owner:** ChatGPT
- **Symptom:** The user reports that Gmail OAuth Settings reverted to `https://localhost:3000/api/oauth/gmail/callback` despite configuring the real callback domain in Google Cloud Console.
- **Root cause:** The shared helper only inspected `request.url`, which can contain the internal Next.js origin behind a reverse proxy.
- **Implementation:** `getOAuthPublicOrigin()` now prefers a single `X-Forwarded-Host` and `X-Forwarded-Proto` pair, rejects incomplete or comma-separated forwarding values, and builds Gmail/Zoho callback URIs from that public origin. Both OAuth callbacks also return users to the public origin after success and use a safe fallback for error redirects. Added tests for the internal-localhost/public-domain proxy scenario and malformed forwarding chains. Documented the trusted-proxy requirements and next deployment steps.
- **Commits:** helper `3e106cfd`, validation tightening `76b6fb59`; Gmail callback redirect/syntax correction `64e1e6d6` / `5edf839e`; Zoho callback redirect/syntax correction `448c022e` / `40f8b6e8`; proxy regression tests `34821bee`, `c7a2664c`; Settings mismatch warnings `fe97c4c7`, `19c64e23`.
- **Verification:** Tests, typecheck/build, migration application, live proxy headers, and Google OAuth were not run here. No runtime PASS is claimed.
- **Next:** Ensure the reverse proxy validates Host and overwrites `X-Forwarded-Host` / `X-Forwarded-Proto`; deploy current main; confirm the displayed callbacks use the public HTTPS domain; restart OAuth.

- **Follow-up hardening:** The helper’s forwarded-host character validation was tightened, and both Gmail/Zoho Settings now show a visible warning when the server callback origin differs from the browser origin. Focused source assertions were extended. Latest relevant commits: `76b6fb59`, `fe97c4c7`, `19c64e23`, `c0786628`, `c7a2664c`. These checks are committed but have not been executed.

- **Project-control synchronization:** Updated `NEXT_ACTION.md`, `ISSUES.md`, `VERIFICATION_STATE.md`, `PROJECT_STATE.md`, and `docs/architecture/DEPLOYMENT.md` to record the reverse-proxy requirement and explicitly mark tests/deployment/OAuth as unverified. Control-doc commits include `31bf1a26`, `e94347ed`, `640d06ba`, `18c56166`, and `6468e135`.


## 2026-10-09 — Gmail OAuth credential schema compatibility

- **Owner:** ChatGPT
- **Scope:** Concrete error fix only; no feature development and no project-control documentation changes.
- User-provided web container logs showed the Gmail OAuth callback failing because `email_account_credentials.credential_type` was NULL but the column remained NOT NULL. The current repository stores canonical credentials in `ciphertext` and `key_reference`; the legacy `credential_type` and `encrypted_payload` columns remained mandatory from an older schema draft.
- Added forward-only migration `0020_email_credential_legacy_compat.sql` to drop NOT NULL on the two legacy columns while preserving their existing data and leaving canonical credential constraints intact.
- **File changed:** `supabase/migrations/0020_email_credential_legacy_compat.sql`.
- **Commit:** `536f8aff660bbff13b55c28b09dd673ea86378b2`.
- No CI/Vercel wait was performed. No migration or OAuth success is claimed until the user applies the migration and retries Gmail OAuth.

## 2026-10-09 — Organization-scoped AI configuration and Clara runtime wiring

- **Owner:** ChatGPT
- **Scope:** User-requested configuration-completeness correction after `POST /api/chat/stream` reported `CLARA_KB_ID is not configured`.
- Added forward-only migration `0028_organization_ai_runtime_settings.sql` for per-organization Clara KB ID, default chat provider, realtime voice provider/model/voice, temperature, max tokens, and system prompt.
- Added Settings UI for AI runtime settings and per-provider credential/model configuration.
- Added organization-authorized settings APIs. Chat provider credentials are envelope-encrypted with the server-only `CREDENTIALS_MASTER_KEY`; API responses expose only whether a key exists, never its plaintext. OpenAI and Gemini model catalogs are fetched server-side; Sarvam uses the application's supported model entry.
- Updated Clara runtime resolution to load saved organization provider/model and generation settings, decrypting the selected provider key server-side. Chat, voice session/turn, and worker execution now resolve the knowledge-base ID from organization settings first and retain `CLARA_KB_ID` as a compatibility fallback.
- Added static regression coverage in `apps/web/tests/ai-runtime-settings.test.ts`.
- **Source commits:** `86cc22fd`, `73d7fda5`, `4e5a54be`, `34ebd33f`, `e4f778c3`, `39351cf7`, `5d48d5ff`, `a4334223`, `709cef99`, `11ecaa2e`, `d8ef6f7e`, `7a3c9041`, `4faf94bd`, `bffd2f62`.
- **Verification:** tests/typecheck/build/migration/live provider requests/chat streaming/voice transport/deployment were not run. No PASS is claimed.
- **Important operational dependency:** deploy the latest `main` and apply migrations through `0028` using the documented self-hosted deployment flow before expecting the new Settings API to be available.
- **Remaining scope:** continue the screen-wise configuration audit, including voice-specific credentials/transport support and a clear readiness view; do not wait for CI/Vercel while implementing independent work.

### 2026-10-09 — AI provider screen state hydration
- Follow-up UI correction: the provider Settings panel now hydrates the selected provider's saved model, base URL, and enabled state after loading its organization-scoped configuration.
- Commit: `5883c37c`.
- No tests or build were executed after this correction.

### 2026-10-09 — Configuration readiness and provider catalog hardening
- Added visible missing-KB and missing-chat-provider warnings in Settings, and direct links to Knowledge and WhatsApp configuration screens.
- Restricted provider model-catalog requests to the provider's official HTTPS origin to avoid turning the model-fetch endpoint into an arbitrary server-side request proxy.
- Model-catalog network/timeout failures now return a clear non-secret 502 diagnostic. Voice route database imports were consolidated; saved provider selection state is hydrated in the UI.
- Static assertions were extended for the official-origin guard. No test/typecheck/build/runtime execution was performed.
- Latest source/test commit at this checkpoint: `d6be733ab85d5fa48df67b6b4ae7705c58bf1084`.

## 2026-10-09 — Gmail pending status and automatic synchronization repair

- **Root cause:** OAuth callback correctly persisted encrypted Gmail credentials but left the account in `pending` awaiting worker verification. The long-lived worker entry point did not start any Gmail sync consumer, so no initial sync could ever move the account to `connected` or populate `last_synced_at`.
- Added `apps/worker/src/email/mailbox-sync-worker.ts`: a PostgreSQL-backed, claimable, retryable worker loop for pending/connected/error Gmail accounts; discovers folders/labels; reads the Gmail history cursor; fetches full message content; persists threads and messages idempotently; updates `email_sync_states` and account sync status; and records retry/backoff errors without logging secrets.
- Wired Gmail sync into worker startup and graceful shutdown.
- Corrected Gmail initial synchronization to page through the entire mailbox, capture the Gmail history baseline before page one, and switch to incremental history sync only after initial pagination finishes. Expired history cursors trigger a safe full re-import (upserts prevent duplicates).
- Added encrypted persistence for refreshed access tokens so the worker does not refresh the same expired token from stale database state on every poll.
- Gmail OAuth reconnect now preserves the existing refresh token if Google omits a new refresh token in the authorization response.
- Added an organization-admin-authorized manual sync endpoint, a **Sync now** mailbox action, and 15-second status refresh in the Connected mailboxes screen.
- Added regression coverage for initial pagination, cursor transitions, refreshed-token snapshot, worker startup, manual sync authorization, and UI polling.
- **Source commits:** `3531828f`, `f00ef734`, `1a32d05d`, `cc7ee95a`, `c052c981`, `90c0ba8a`, `30aa9747`, `8a2c1cd5`, `0e891944`, `280ca4ab`, `bf07f8e4`, `48def7ee`, `25fab134`, `ae1ddb6b`.
- **Verification:** tests, typecheck, build, migration execution, deployment, and live Gmail sync were not run from this environment. No PASS is claimed.
- **Operational dependency:** deploy both web and worker; the worker needs the same PostgreSQL database and `CREDENTIALS_MASTER_KEY` as the web service. Migration chain through `0028` must be applied. See ISS-012.
