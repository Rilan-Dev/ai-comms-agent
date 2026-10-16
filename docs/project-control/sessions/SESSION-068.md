# SESSION-068 — FIX-01 realtime voice and shared email tool runtime

- **Date:** 2026-10-16
- **Role:** FIX-01 / Sentinel
- **Branch:** `fix/voice-transport-contract`
- **PR:** https://github.com/Rilan-Dev/ai-comms-agent/pull/27
- **Issue:** https://github.com/Rilan-Dev/ai-comms-agent/issues/26
- **Reference:** `Rilan-Dev/Clara-AI-Platform`, branch `feature/ai-core-from-doable-source`.

## Source changes
- OpenAI native WebRTC negotiation, microphone capture, remote audio, realtime data-channel events and spoken host answers remain on the branch.
- Added Gemini Live constrained ephemeral token issuance with organization/session authorization and a browser WebSocket transcription adapter. Long-lived Gemini credentials remain server-side.
- Added Sarvam Saaras STT + Bulbul TTS and ElevenLabs Scribe STT + ElevenLabs TTS provider-backed utterance pipelines with VAD, PCM16/WAV capture, language selection, spoken output and no browser-exposed provider keys. These are not persistent provider WebSocket relays yet.
- Extracted worker email tool runtime into `@ai-comms-agent/email-agent-runtime`; worker and web now import the same bounded tool loop, registry, executor, allowlist recheck and audit pipeline.
- Wired `/api/voice/turn` to `runEmailAgentTurn` with trusted organization, agent, authenticated user, voice channel, permissions, conversation/session correlation and configured KB context.
- Registered local draft create/update/delete, reply/forward draft creation, mark-read, archive and move tools. Added send/reply/forward request tools that only create `pending_approval` records; they do not send provider messages. The approved-action worker remains the only send/reply/forward execution path.
- Voice UI surfaces provider-specific status, microphone/language controls, transcript history, tool outcomes, pending approval IDs, mute, interrupt, end-session, and startup/transport errors.
- Added static test assertions for OpenAI/Gemini transport, Sarvam/ElevenLabs STT/TTS, authorization, shared email runtime and approval gating. Updated `NEXT_ACTION.md`.

## Scope limits
- Sarvam and ElevenLabs still use provider REST/streaming speech endpoints per utterance; persistent native WebSocket relays are outstanding.
- Some catalogue operations remain intentionally unregistered, including sensitive trash/bulk actions and attachment operations. They must remain unavailable rather than falling through to a generic executor.
- Send/reply/forward requests require explicit approval; creating a request is not a completed send.
- Issue #26 remains open.

## Verification
GitHub source edits only. Tests, typecheck, build, browser microphone, provider credentials, full email action approval/execution and deployment have **not** been run or verified.
