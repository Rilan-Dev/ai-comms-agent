# FIX-01 / OPS-01 — unexpected build-hook incident, 2026-10-19

## Confirmed evidence and containment

During DEV-01 C2 reconciliation, upstream commit `c99252a49afa9b1044a03e8e4e504c0ef9b66bb5` was found to introduce root `api.js` with obfuscated executable code, root `build`/`dev` commands prepending `node api.js`, and an independent obfuscated executable tail in `apps/web/postcss.config.mjs`. It also added ignore entries for `branch_structure.json`, `temp_auto_push.bat` and `temp_interactive_push.bat`, bundled with legitimate briefing code. The Git author/title alone does not establish who introduced the payload.

Vite/Vitest automatically loaded the changed PostCSS configuration during tests. Even source-only tests emitted unsolicited outbound HTTPS `ENETUNREACH` failures. Execution was paused once the hook was identified. No agent intentionally evaluated/deobfuscated payloads or invoked their destinations. Root build/dev payload was not intentionally executed. The exact payload behavior and any successful earlier outbound requests are unconfirmed.

DEV-01 removed root `api.js`, restored the known-clean declarative PostCSS configuration, removed root build/dev execution hooks and suspicious ignore additions, preserving unrelated upstream product/OPS changes. FIX-01 added `scripts/tests/build-entrypoint-integrity.test.mjs`: current entrypoints, historical bad blobs read only as text, and lifecycle-hook bypass; **3/3 passed, zero skipped**. Cleaned Vitest validation subsequently completed successfully without the prior outbound error. Stage/index contents must contain only the sanitized versions at the final push.

## OPS-01 read-only assessment and limits

Named ignored artifacts were absent from checkout metadata inspection. Visible old Node/Vitest/esbuild/Git processes were zombies; no live unexpected process was observed. Live processes matched platform/Codex, Docker and the disposable PostgreSQL service. Limited persistence metadata did not identify a new task-local startup hook. No secrets/environment values or payloads were executed/read by OPS, and no provider requests, rotations, deployment or infrastructure mutations were made for this investigation.

These observations do **not** establish that credentials were never accessed, that every outbound request failed, or that the environment is fully trustworthy. Credentials available to an environment that executed the hook may need rotation, and affected build/development environments should be replaced with a clean environment. This remediation is separate from removing tracked hooks. Do not execute historical payload blobs when investigating Git history.

## Ownership and next actions

- FIX-01: investigate introduction path and audit other changed executable entrypoints; preserve incident commit reference without running it.
- OPS-01: identify environments that ran the affected revision, assess accessible credential scope without logging values, and arrange clean environment recreation and necessary credential rotation with the owner. No production/deployment acceptance implied.
- DEV-01: push sanitized integration, verify remote SHA, retain focused/full-suite evidence and continue only normal source development. The user was informed during work; final response must retain the exposure uncertainty.

Local detailed OPS report: `/workspace/.onboarding/ai-comms-agent/c2/ops-security.md`. Repository test evidence does not certify the previously affected environment.
