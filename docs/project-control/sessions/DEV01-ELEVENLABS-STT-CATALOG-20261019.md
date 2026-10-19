# DEV-01 / Forge — ElevenLabs Voice Chat STT catalog provenance correction (2026-10-19)

## Authorization, baseline and scope
- User asked to continue development after sharing two live `provider_configuration_required` responses for ElevenLabs TTS and STT model lists. Direct edits on `main` only; no branch/PR and no production deployment.
- Baseline GitHub `main`: `b207f06a082de4f6790d47af5685e13bb51c2219`. **Current top NEXT_ACTION authority before this focused repair** is C1 verified foundation with the next C2 immutable source-manifest/coverage selection slice. This UX/catalog correction does not authorize changing or activating C1/C2, routines, agent permissions or OPS release status.
- Read `docs/project-control/NEXT_ACTION.md`, `VERIFICATION_STATE.md`, DEV-01 WORKLOG, `sessions/DEV01-CATCHUP-C1-20261018.md`, `sessions/DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019.md` and exact web/DB provider setup, REST model catalogue and selector source.
- The user-provided command disclosed a session cookie. Do NOT copy its value into docs/tests/issues, logs or replay it. Recommend revoking that session and signing in again.

## Confirmed situation
1. Both reported 409 errors occur **inside the local provider-key gate before any vendor HTTP**, not proof of a failed ElevenLabs API request. Encrypted keys are purpose-specific: `elevenlabs:realtime`, `elevenlabs:tts`, `elevenlabs:stt` are independent rows in the chosen organization.
2. The **existing** UI has an explicit, confirmed opt-in “Use saved Realtime key for missing TTS/STT” action and authenticated backend endpoint, previously implemented and tested at source level. It only works if a decryptable, enabled Realtime key exists for that organization. Otherwise an authorized user must enter/save a valid key under Voice Chat. Disabled capabilities are intentionally not enabled automatically. No secret was copied or tested in this session.
3. The generic official ElevenLabs `GET /v1/models` schema documents available TTS models with `can_do_text_to_speech`, not an authoritative, per-account Scribe batch STT listing; the docs separately specify batch model `scribe_v2`. Treating `/v1/models` Scribe-looking entries as a *live STT catalogue* was a misleading product boundary.
   - Official TTS model list: https://elevenlabs.io/docs/api-reference/models/list
   - Official batch Scribe model: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text
   - Separate realtime WebSocket STT model: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime (`scribe_v2_realtime`).
4. Thus the clear, safe workflow: authenticated organization-scoped enabled `tts` key → live TTS catalogue; authenticated enabled `stt` key → explicitly **vendor-documented** `scribe_v2` (batch) choice; authenticated enabled `realtime` key → vendor-documented `scribe_v2_realtime` transport. These are different models and capabilities, not interchangeable.

## Source changes committed directly to main
- `apps/web/src/lib/ai/live-model-catalog.ts`: ElevenLabs `/v1/models` now supports only the *live TTS* purpose; new `hasDocumentedSpeechToTextModels` + `documentedSpeechToTextModels` identify `scribe_v2` as vendor-documented batch STT, explicitly not a live listing or fallback on a failed live API.
- `apps/web/src/app/api/settings/ai-models/route.ts`: continue auth before decrypt and require a saved enabled *purpose-specific* key; only **after this gate** return `source:"documented", capability:"batch_stt"` for batch STT with `Cache-Control: private,no-store`. For TTS, continue calling vendor live API; for realtime, continue documented `streaming_stt`. No key, cross-org or disabled row does NOT get options.
- `apps/web/src/components/live-model-select.tsx`: accept documented response only for exact `elevenlabs + stt + batch_stt` or previously approved realtime combinations; maintain provenance and no fake live badge; reject unexpected documented source/purpose/capability.
- `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`: clear capability-specific explanation and explicit key-reuse option. Preserve secret clearing on org/provider switch and opt-in-only copying.
- `apps/web/tests/live-model-catalog-standalone.test.mjs`, `apps/web/tests/live-model-catalog.test.ts`: update expectations that STT is documented not returned from `/v1/models`, add auth/provenance guards.
- Main source commits: `1118088c`, `c59256ed`, `018f2f39`, `dc95d2cd`, `959dd409`, `234d2646`. No branches/PRs/deploy.

## Verification and limitations
- **Actually inspected fresh GitHub source at head `234d26467100c561c66c6ad03238ab52d01dc8d3`: 15/15 custom deterministic source assertions PASS**: provider matrix and documented STT, key gate and org authorization ordering, source/capability markers, no-store, selector constraints, UI helper, opt-in reuse retention and updated tests. These are **not executed Node/Vitest/browser/DB tests**.
- **NOT RUN:** full private monorepo checkout and pnpm Vitest/TS/build, database query/decryption, actual TTS/STT vendor HTTP, authenticated user browser save/reload, wrong-organization negative integration, migrations, live voice, production deployment. This chat container has Node 22 but not the complete private repo or pnpm. Latest C1 documentation already records earlier dependency-equipped web/typecheck/build and migration evidence on a **different** revision; do not transfer to these commits.
- **No production verification or credential use**. Account may need an OPS-01 deployed build that contains this code and the existing reuse endpoint.

## Exact next actions / roles
1. **DEV-01 in equipped current-main checkout**:
```bash
node --experimental-strip-types --test apps/web/tests/live-model-catalog-standalone.test.mjs
pnpm --filter @ai-comms-agent/web exec vitest run tests/live-model-catalog.test.ts tests/elevenlabs-voice-credential-reuse.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/clara-core test
pnpm --filter @ai-comms-agent/db typecheck
bash scripts/verify-migration-chain.sh
```
Fix any demonstrated DEV-01 regression directly on main; record exact outputs.
2. **Authenticated acceptance after OPS approved deploy**: revoke exposed browser session and login anew; choose target organization → AI Provider Setup → Voice Chat → ElevenLabs. Confirm enabled TTS/STT keys independently. If an enabled Realtime key exists, explicitly confirm “Use saved Realtime key for missing TTS/STT”; otherwise enter/save an authorized key in Voice Chat. Retry both model lists; TTS shows **live** vendor options, STT shows `scribe_v2` with **documented** provenance. Select and save models; reload and verify; then call actual vendor TTS and batch STT under server-controlled credentials; verify denied/missing/disabled/cross-org cases. The realtime session's `scribe_v2_realtime` is separate.
3. **Current broader DEV-01 NEXT_ACTION remains C2**: implement stable private catch-up selection/coverage with failing edge-case tests and immutable manifests, then independent review. This focused vendor UX correction does **not** change C1 flag state or grant broader feature rollout permission.
4. **FIX-01** owns existing realtime-transport and email HTML sanitization bug #36; **OPS-01** owns CI/CD, database migrations, Vercel build-rate-limit and deployment/production secrets. Do not poll/alter infrastructure in DEV-01.

**Status:** source correction committed; runtime and release acceptance pending.
