# DEV-01 / Forge — ElevenLabs TTS/STT capability credentials vs Realtime key

**Recorded:** 2026-10-19. **Owner direction:** Proceed with repository development and address the reported production `/api/settings/ai-models` errors for `elevenlabs&purpose=tts` and `elevenlabs&purpose=stt`. **Main-only** source changes (no new branch/PR); Phase 4 still `implementation_in_progress`. Source started at main `ad8fc7015886700436a72107d3d3d32f71d420e4`.

## Observed user evidence, handled safely

- The owner reported HTTP `provider_configuration_required` for ElevenLabs **both TTS and STT** on the deployed organization-scoped catalog API. The pasted command included a live session cookie: **do not repeat, store, test with, or copy it into tickets/docs**. The user should terminate the exposed session and log back in.
- The API fails at the local saved-key gate **before contacting ElevenLabs**. Thus this error by itself does **not** prove vendor invalid API keys, empty models or platform outage; nor does it prove which rows really exist in production DB.
- The code stores encrypted keys keyed by `(organization_id, provider, purpose)` where `realtime`, `tts`, `stt` are separate. A saved enabled Realtime key **does not imply** separate enabled TTS/STT keys. This was the main UX mismatch.
- ElevenLabs official `GET /v1/models` exposes model ID and TTS capability; Scribe STT endpoint has its own documented model IDs. A vendor model return is still a separate acceptance gate after credential setup. No hardcoded live catalogue or provider availability claim added.

## Direct-main DEV-01 source correction

1. **Opt-in secure reuse endpoint**: `POST /api/settings/ai-provider-configs/reuse-voice-key` accepts only an explicit ElevenLabs action plus organization ID, then enforces `organization.update` **before** reading any credential. The source must be an enabled, decryptable `elevenlabs:realtime` key for the **same organization**. A race-safe, single PostgreSQL statement copies the existing encrypted envelope to only the missing enabled `tts`/`stt` slots. **Never** overwrites existing keys, intentionally disabled capability rows, or separately chosen TTS/STT models; never returns the plaintext. Records provider-key reuse in the host audit log.
2. **DB source helper**: `packages/db/src/ai-provider/repository.ts` adds `reuseElevenLabsRealtimeKeyForVoiceChat`, exported through `packages/db/src/index.ts`. Also corrects `rowToProviderConfig` to identify an existing `encrypted_api_key` even in the decrypted lookup, distinguishing *missing* from *stored but unreadable* credentials.
3. **Truthful catalog errors**: `GET /api/settings/ai-models` now identifies a disabled capability row, reports a saved-but-unreadable encrypted key with a server-configuration hint (503), and—if appropriate—explains the existing enabled Realtime key and explicit Voice Chat reuse action (409). No automatic fallback across purposes. Same auth and org-level encryption protection.
4. **Voice Chat UX**: initial config metadata load includes `realtime` alongside `tts`/`stt`, but Save and Remove still mutate **only** TTS/STT. The ElevenLabs tab now visibly distinguishes TTS and STT credential readiness and offers a confirmation-gated **Use saved Realtime key for missing TTS/STT** action **only** when source is enabled and a target capability needs a key. Refreshes the organization settings and model picker after successful server response; protects organization switching and hidden key fields.
5. **Regression test**: `apps/web/tests/elevenlabs-voice-credential-reuse.test.ts` asserts auth ordering, same-tenant/same-provider constraints, explicit action, no overwrite/disabled capability mutation, no plaintext API output, decryptability check, source metadata-only UI, purpose-specific saves and backend audit.

## Verification — evidence, blockers and instructions

- **Actually performed against exact fresh GitHub source:** 29/29 source-contract assertions passed after correcting a mismatch in the new Vitest file. Verified GitHub file SHAs from latest main; these are source inspections, **not** an executed Vitest/browser/DB integration suite.
- **Unavailable:** Private full repository checkout, `pnpm`, working `git` DNS from model sandbox; therefore no complete web/worker/DB/Clara test, typecheck, production build or database migration-chain execution. No authorized live provider/DB access or originating authenticated browser session. No production change or credential validation claimed.
- **Current GitHub HEAD Vercel status:** `failure` with a `build-rate-limit` target at time of check; **not** a source compiler verdict. OPS-01 must resolve CI/CD/environment/deployment and verify the deployed revision.
- **Exact main-checkout commands (DEV-01):**
```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts tests/ai-provider-setup-safety.test.mjs
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/worker build
pnpm --filter @ai-comms-agent/clara-core test
pnpm --filter @ai-comms-agent/clara-core typecheck
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
  Run from a real repository checkout and adjust to actual package scripts if a command is unavailable; record full outputs rather than inferring a pass.
- **Authenticated acceptance, after OPS deploys verified main**: In AI Provider Setup → Voice Chat select ElevenLabs; check that TTS/STT show missing/disabled/ready correctly. If Realtime has an enabled key, choose **Use saved Realtime key** and explicitly confirm. Verify TTS and STT metadata are enabled in the same organization, choose vendor-listed model IDs separately, save/reload, retry both `GET /api/settings/ai-models` calls. Test existing TTS key preservation, disabled STT refusal to auto-enable, org B denial, a missing Realtime source, an undecryptable credential (503), and cross-org rejection; do not send secret values into issue logs. Then test actual ElevenLabs TTS/STT provider endpoint behavior.
- **Next DEV-01 work:** complete full source tests/build checks in a dependency-equipped environment, then real agent Chat/Voice streaming and secure read-only tool/provider validation. **FIX-01** retains realtime transport bugs and HTML sanitizer issue #36. **OPS-01** owns deployed Vercel build-rate-limit, migrations, CI/CD and secrets. No new branch/PR, no production acceptance.
