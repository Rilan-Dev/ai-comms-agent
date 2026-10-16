# SESSION-068 — FIX-01 realtime voice and shared email tool runtime

- **Date:** 2026-10-16
- **Role:** FIX-01 / Sentinel
- **Branch:** `fix/voice-transport-contract`
- **PR:** https://github.com/Rilan-Dev/ai-comms-agent/pull/27
- **Issue:** https://github.com/Rilan-Dev/ai-comms-agent/issues/26
- **Reference:** `Rilan-Dev/Clara-AI-Platform`, branch `feature/ai-core-from-doable-source`.

## Source changes
- OpenAI native WebRTC negotiation, microphone capture, remote audio, realtime data-channel events and spoken host answers.
- Gemini Live constrained ephemeral token issuance with organization/session authorization and browser WebSocket transcription. Long-lived Gemini credentials remain server-side.
- Added provider relay service source under `infra/voice-relay/`, adapted from Clara's Sarvam STT/TTS and ElevenLabs Scribe/TTS relay scripts. WebSocket client adapters stream PCM microphone input and provider audio output; HMAC-signed short-lived session claims, origin allowlisting, bootstrap rechecks and metering endpoints are included.
- If `VOICE_RELAY_PUBLIC_URL` is not configured, Sarvam/ElevenLabs use a provider-backed utterance pipeline fallback. The relay source is not deployed or live-verified; OPS-01 must configure the relay URL and allowed origins.
- Extracted worker email tool runtime into `@ai-comms-agent/email-agent-runtime`; worker and web now import the same bounded tool loop, registry, executor, fresh allowlist checks and durable audit.
- Wired `/api/voice/turn` to `runEmailAgentTurn` with trusted organization, agent, authenticated user, voice channel, permissions, conversation/session correlation and configured KB context.
- Registered local draft create/update, reply/forward draft creation, and approval-request tools for send/reply/forward. Pending approval IDs are returned to the voice UI; actions are not sent until the existing approved-action worker processes explicit approval. Existing provider drafts are updated with the approved latest content before send.
- Provider-backed mark-read/archive/move/trash/bulk, attachment and other unimplemented catalogue tools remain unregistered/fail-closed.

## Scope limits
- Source code exists for provider-specific realtime adapters, but relay deployment, provider credentials, browser audio and TTS playback have not been verified.
- Email action requests are approval-gated; they do not claim delivery. Some mailbox operations are intentionally unavailable until provider-backed execution handlers are implemented.
- Issue #26 remains open.

## Verification
GitHub source edits only. Tests, typecheck, build, browser microphone, provider credentials, relay deployment, full approval execution and production behavior have **not** been run or verified.


## Continuation status correction — 2026-10-16
PR #27 was merged at its earlier partial commit and does not contain the later multi-provider relay/shared email runtime work. Draft PR #28 carries this continuation. Issue #26 remains open. The relay still requires OPS-01 deployment/configuration; tests, typecheck, build and live browser/provider verification remain unrun.
