# SESSION-073 — Clean multi-provider voice transport replacement

- **Date:** 2026-10-16
- **Role:** FIX-01 / Sentinel
- **Branch:** `feature/voice-transport-clean`
- **Previous oversized draft:** PR #28 — https://github.com/Rilan-Dev/ai-comms-agent/pull/28
- **Purpose:** Keep the current `main` history intact and transfer only voice transport, provider relay, shared email runtime, targeted tests, and project-control changes.

## Scope transferred
- Dedicated voice workspace transport UI for OpenAI WebRTC, Gemini Live, Sarvam and ElevenLabs, with explicit connected/pipeline/bridge status, microphone mute, interruption, transcript and pending approval display.
- Provider-specific Gemini session and Sarvam/ElevenLabs STT/TTS relay routes, HMAC-signed short-lived relay tokens, origin allowlist, relay service source and deployment README.
- Shared `@ai-comms-agent/email-agent-runtime` package used by web voice and worker email agent loop.
- Voice turns retain authenticated organization/user/agent/session checks, record the turn before invoking tools, and pass server-derived identity, permissions, voice channel, conversation correlation and knowledge-base context to the shared runtime.
- Send/reply/forward operations remain approval-gated; provider-backed mailbox mutation tools that lack executors remain fail-closed.
- Added focused voice relay/email runtime tests and updated the existing realtime transport contract test.

## Deliberately excluded
- No wholesale copy of the old source branch, environment templates, unrelated migrations, docs, worker/provider changes or the historical repository snapshot.
- No new database migration was required by this source tranche; it reuses the current main schema.
- Current main's strict OpenAI realtime-purpose credential guard was preserved. Provider credential resolution for OpenAI must not fall back to a chat-only saved key.

## Verification state
Source edits only through GitHub. Tests, typecheck, build, lockfile install validation, browser microphone/transport, live provider credentials, relay deployment and approval execution have not been run or verified. PR #28 remains open and unmerged; the clean replacement PR is to stay draft until source review and required verification are complete.
