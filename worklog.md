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
