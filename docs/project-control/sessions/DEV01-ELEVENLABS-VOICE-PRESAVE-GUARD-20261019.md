# DEV-01 / Forge — Prevent partial ElevenLabs Voice Chat credential saves — 2026-10-19

## Authorization / starting source
- User explicitly requested continuation of the next DEV-01 ElevenLabs `tts`/`stt` credential-purpose defect, model selection and regressions. Standing owner requirement: **direct `main` source changes; no branches or PRs**.
- Started GitHub main at `a7baa7fe9a4c276120b43102b2ea7d69c38e6209`. Phase 4 still `implementation_in_progress`. Read current `docs/project-control/NEXT_ACTION.md` (concurrent C1 catch-up work exists) and prior `DEV01-ELEVENLABS-VOICE-CREDENTIAL-REUSE-20261019.md`, which already implemented the explicit, same-org encrypted Realtime→TTS/STT reuse action. Preserve that finished work; do not duplicate it or misrepresent it as deployed.
- User's earlier cURL showed `provider_configuration_required` on both production endpoints and included a live `aca-access-token`. **Do not copy/use the session cookie** in code, tests or records; user should revoke the exposed session. Both errors occur before vendor API calls and do not prove an invalid ElevenLabs key.

## Confirmed remaining problem
- `AIProviderSetupShared.saveProvider` saves Voice Chat with **two sequential** PUT requests (`tts`, `stt`).
- When no new key was supplied, a missing STT key could cause the TTS write to succeed before the STT PUT failed. The UI displayed an error after a partial update.
- The standalone `PUT /api/settings/ai-provider-configs` accepted `keepExistingKey:true` without verifying that this organization actually had an encrypted key in that purpose, permitting a keyless enabled row in future callers.
- A successful Voice Chat save/remove refreshed TTS/STT metadata but dropped the Realtime config from client state, causing the explicit reusable-Realtime-key affordance/status to disappear until navigation or reload.

## Source implementation (direct main)
1. `apps/web/src/lib/ai/voice-credential-preflight.ts`: pure capability-scoped preflight checks existing `tts` and `stt` key presence before any sequential save if no new key is provided; informative response without copying plaintext secret; no assumption that `realtime` automatically configures voice capabilities.
2. `apps/web/src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx`: runs the preflight before first network PUT; trims whitespace-only key; retains organization-switch guard; Save/Remove continue affecting **only** `tts` and `stt`, while reloading `realtime` **read-only** metadata afterward for an accurate reuse affordance.
3. `apps/web/src/app/api/settings/ai-provider-configs/route.ts`: after `organization.update` auth, `keepExistingKey:true` with no supplied key must first find an actual encrypted key for exactly `organizationId/provider/purpose`; if missing, return 409 `provider_configuration_required`, no enabled keyless upsert. Source includes no cross-purpose or cross-org implicit fallback.
4. `apps/web/tests/elevenlabs-voice-save-validation.test.mjs`: 10 Node regressions (eight behavioral cases plus two source boundary contracts). Earlier explicit credential-reuse endpoint and its isolation/audit remain unchanged.

## Verification: evidence separated from assumptions
- **Executed** isolated Node v22.16 `node --experimental-strip-types --test` on the byte-for-byte same pure helper module: **8/8 behavioral cases PASS** (both missing, one missing each, both existing, new key, wrong provider/realtime-only, disabled existing, other tabs); no test database or provider calls.
- **Executed** isolated global TypeScript `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022` on exact helper: **PASS**. Exact helper Git blob SHA matches executed local file: `5ff3d09e82186e0161807ade6d995bf54b9a1bd1`.
- **Executed** 10/10 static authenticated-GitHub source assertions on actual latest committed blobs: provider save preflight before PUT; auth-before-key lookup/upsert; no fake keep-existing, whitespace-safe key, Realtime metadata retention, TTS/STT-only mutations, explicit audited reuse left intact. Static predicates **are not actual React/Next integration tests**.
- **Not executed**: new full Node source-contract suite against actual monorepo layout (isolated runtime lacked repo); full web/worker/db/Clara Vitest, typecheck, build, migration-chain checks; live encrypted DB/test org/provider API, both ElevenLabs vendor model catalog requests, actual voice WebSocket/STT/TTS/browser save and reload; deployment. No complete private checkout or `pnpm` in this runner; GitHub code connector supplies source, not a dependency-installed workspace. Current production revision not verified.
- **Limitation:** client preflight prevents the predictable missing-secret half-save. Two HTTP PUT calls can still partially commit on network/server failure between them. A *fully atomic* TTS/STT save requires a new transactional backend operation with its own migration/rollback and security tests; do not claim this safeguard provides SQL transaction atomicity. Existing explicit Realtime reuse DB copy is one SQL statement.

## Exact next action / owners
**DEV-01 (equipped current-main checkout):**
```bash
node --experimental-strip-types --test apps/web/tests/elevenlabs-voice-save-validation.test.mjs
pnpm --filter @ai-comms-agent/web exec vitest run tests/elevenlabs-voice-credential-reuse.test.ts tests/live-model-catalog.test.ts
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
Fix any proven DEV-01 source failures directly on main. Next independent product improvement: a purpose-atomic Voice Chat save API with credential-preserving rules, only if acceptance testing shows half-updates remain operationally problematic.

**OPS-01:** Deploy approved source through normal CI/CD, resolve Vercel build-rate-limit, verify DB encryption/migrations, check deployed SHA and authorized organization setup with *fresh session*, no log-sharing of provider secrets. Once deployed, select AI Provider Setup → Voice Chat → ElevenLabs. Either provide an ElevenLabs key to populate both missing capabilities or explicitly reuse enabled Realtime key (disabled capability rows deliberately stay disabled). Confirm TTS and STT each report enabled key, choose vendor-listed models, save/reload and retry both catalog URLs with authenticated browser; check wrong-org, revoked session and key-decrypt failure handling. No production acceptance until real results.

**FIX-01:** Own unrelated voice transport failures, HTML ingest sanitization issue #36, and WhatsApp runtime defects. Do not change FIX/OPS scope from this DEV-01 UI/key-validation slice.
