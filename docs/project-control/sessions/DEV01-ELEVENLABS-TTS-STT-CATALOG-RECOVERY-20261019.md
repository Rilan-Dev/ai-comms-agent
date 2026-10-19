# DEV-01 / Forge — ElevenLabs TTS/STT model-catalog recovery (2026-10-19)

## Scope, authorization and evidence
- User reported two production GET responses from `/api/settings/ai-models`, one with `provider=elevenlabs&purpose=tts` and one with `purpose=stt`, both `409 provider_configuration_required`; requested a fix committed to GitHub. User included a live session cookie in the report: **never reproduce, use or store that token**. Owner should revoke the exposed login session/token and sign back in.
- Established owner direction: source changes directly on `main`; no branch/PR. Phase 4 remains implementation in progress. Started from main `89f402c912553d8251a43ed28f9e0f8c276db3f9`. FIX-01 owns substantive realtime/WhatsApp/HTML-security incidents; OPS-01 owns CI, host/deployment, migrations, provider credentials and production validation.

## Confirmed root cause
- The GET API loads encrypted provider credentials strictly by authenticated `organizationId`, provider and purpose. An enabled `elevenlabs/realtime` configuration is **not** an enabled `elevenlabs/tts` or `elevenlabs/stt` key. For missing/unreadable per-purpose keys it correctly returns 409 (or 503 when a stored encrypted key cannot be decrypted), not a fake model list or a silent fallback to another credential.
- Existing approved solution on main: `POST /api/settings/ai-provider-configs/reuse-voice-key` explicitly copies the encrypted *same-organization, same-provider*, enabled Realtime key into **missing, enabled** TTS/STT records only, after `organization.update` authorization, source key decrypt check and audit. Existing rows, disabled capabilities, models and independent secrets are not overwritten. An administrator must confirm the action.
- User-facing issue: `LiveModelSelect` displayed only the provider 409 message and Retry with no direct route to the already-implemented recovery from the exact failed model picker. Users cannot distinguish missing capability credential from a provider model outage.

## Committed source change (main, no branch/PR)
1. `apps/web/src/lib/ai/model-catalog-recovery.ts`: small pure helper restricting recovery to ElevenLabs TTS/STT, differentiating `provider_configuration_required` with server-confirmed `canReuseRealtimeKey`, missing source key, and `provider_credentials_unavailable`.
2. `apps/web/src/components/live-model-select.tsx`: consumes the backend's typed `error` and `canReuseRealtimeKey` after successful-org response/abort checks. For recoverable missing key, displays an explicit **Use saved Realtime key for TTS/STT** action, disabled if no authenticated handler or while saving; for no eligible source, guides admin to enter/configure enabled TTS/STT keys; for undecryptable stored key, shows the encryption-configuration/admin explanation. No automatic GET-to-POST, no credential text in UI, no fallback static models or silent key sharing. Picker still retries live vendor catalogue after explicit reuse refresh.
3. `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`: wires **both** TTS and STT model selectors to the existing confirmed, organization-checked and permission-enforced `reuseSavedRealtimeKey` handler. Existing root Voice Chat reuse button and capabilities status remain, and the handler refreshes config metadata and model listing after success.
4. `apps/web/tests/elevenlabs-voice-catalog-recovery.test.mjs`: eight behavioral + source-guard regression checks authored for catalog error recovery, TTS/STT, disabled/absent source, no automatic other-purpose copy, abort/race protection, existing confirmation, and permission boundaries.

## Executed verification
- Node v22.16.0: eight isolated behavioral tests on the **byte-identical** helper `apps/web/src/lib/ai/model-catalog-recovery.ts` **8/8 PASS**, zero failures; `git hash-object` for executed helper equals committed GitHub blob `3108547c5ebe73975fee37198e71a69afc1b21c5`.
- Global TypeScript `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022` on the exact helper **PASS**.
- Current authenticated GitHub source assertions: **15/15 PASS**, covering response typing, async organization safety, local explicit handler, both pickers, source eligibility, backend `organization.read` and `organization.update`, audit/encryption guard, and no plaintext response.
- **Not executed:** the full committed 8-case source+behavior suite in the full repository (only isolated helper behavior was run), web/worker/DB/Clara full pnpm tests/typechecks/builds, migration chain, browser authenticated flow, actual ElevenLabs TTS/STT vendor APIs, production deploy, new UI at deployed SHA, and Vercel build-rate-limit resolution. No full dependency-installed private checkout or authenticated browser session in this execution environment. Existing 409s on the deployed site may persist until the configured/admin-confirmed organization action and deployment of this UI revision.

## Exact next action
1. **DEV-01 in dependency-equipped main checkout**:
```bash
node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-catalog-recovery.test.mjs
node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-save-validation.test.mjs
pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker test
pnpm --filter @ai-comms-agent/worker typecheck
pnpm --filter @ai-comms-agent/db typecheck
pnpm --filter @ai-comms-agent/clara-core typecheck
bash scripts/verify-migration-chain.sh
```
Fix actual DEV-01 regressions directly on main; any deployment/runtime symptom goes to OPS-01, unrelated source/runtime incidents to FIX-01.
2. **OPS-01 / authorized admin after current-head deploy**: revoke exposed session cookie; verify deployed Git SHA; sign in with a **new** session. Open AI Provider Setup → Voice Chat (TTS/STT) → ElevenLabs. Inspect TTS and STT statuses. If an eligible saved Realtime key exists, explicitly click the reuse action and confirm. Otherwise enter/save an appropriately scoped ElevenLabs API key for voice chat. Then re-run authenticated TTS/STT catalog fetch (without pasting auth tokens), verify non-empty provider-advertised models, save separate model choices, reload, and test real audio/STT/TTS. Validate forbidden actor (no `organization.update`) cannot copy secrets, disabled source/target remains untouched, and failed vendor model API remains a distinct 502. Record redacted results.
3. **No production acceptance** until full CI/build/migration/provider/browser verification and OPS-01 deploy. Vercel build-rate-limit is OPS-01, not a compilation verdict.

## Known boundary
The repository cannot create a purpose-specific encrypted provider key from a public unauthenticated GET request. A 409 remains correct until an authorized admin has saved or explicitly reused the eligible secret for TTS and STT. The change fixes **discoverability and recovery**, not missing source credentials or host-side secrets.
