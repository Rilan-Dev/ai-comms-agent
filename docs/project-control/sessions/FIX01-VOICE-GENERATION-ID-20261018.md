# FIX01-VOICE-GENERATION-ID-20261018

- **Agent:** FIX-01 / Sentinel
- **Date:** 2026-10-18
- **Symptom:** User's Docker deployment build failed during webpack compilation with `Identifier 'generationId' has already been declared` in `apps/web/src/app/ai-voice/voice-workspace.tsx`.
- **Root cause:** The Sarvam/ElevenLabs TTS branch declared the same `const generationId` twice within one lexical block; the declarations compute the same session/sequence value.
- **Fix:** Reuse the first declaration for fallback audio playback. No change to provider behavior or authorization.
- **Regression protection:** `voice-realtime-transport.test.ts` checks that the provider branch has one generation ID declaration and stores it in `ttsGenerationRef`.
- **Commits:** source `f6efffdb42dbd75df38841fab43b985eb565ee3f`; test `05519965adae7ebab837a03e4d7a0d2306e3f0c1`.
- **Verification:** Source/test committed; post-fix build and test pending.
- **Next action:** Pull latest main; rerun `bash scripts/update-and-up.sh`; run focused `voice-realtime-transport.test.ts` after build succeeds.
