# DEV-01 / Forge and FIX-01 — Sarvam live conversation lifecycle, 2026-10-23

**Status:** Source fix and focused verification complete; live deployment/acoustic acceptance pending.

## Owner request and recovered authority

Owner supplied a voice transcript: greeting worked, a natural last-24-hour mailbox question failed, and a later answer claimed mailbox context without a confirmed read. Owner requested inspection of Clara AI Platform and correction of live Sarvam WebSocket conversation. Work remains directly on Development; preserve concurrent work and existing controls. DEV-01 coordinates/reference-verifies/documents; FIX-01 owns substantial runtime corrections; OPS-01 owns deployment and origin/relay availability. No phase transition, production migration or outbound message is authorized by this source correction.

Recovered source base df053fa7. Earlier Development commits already forbid Sarvam REST pipeline fallback, require both relay streams and microphone before activation, and route spoken 24-hour mail questions through counted scoped reads. Revalidated these instead of duplicating them. The exact production error in the supplied transcript cannot be identified without corresponding server/provider logs; transcript text alone does not prove which transport was active.

## Authoritative reference comparison

Inspected Rilan-Dev/Clara-AI-Platform default-branch HEAD `9a50de9ceffa7a104bf40dce4a43e774be69f6a0`: `src/modules/assistant/core/hooks/useSarvamVoice.ts`, `scripts/sarvam-relay.mjs`, `scripts/sarvam-tts-relay.mjs`, `scripts/sarvam-wire.mjs` and realtime protocol report. The host wire adapter exactly matches reference Git blob `0c7e8879e213996aadecb0e06b77025b328e8834`. Existing vendored immutable source was not edited.

Clara uses continuous PCM capture over a Saaras STT WebSocket, host-authorized text generation/tools, and Bulbul streaming audio over another WebSocket. Streaming speech recognition/synthesis is integral to this design; one-shot REST transcribe/speak fallback is a different behavior. Reference also handles early speech/VAD interruption and generation-aware audio. Host still waits for a completed answer before sending its text to TTS; phrase-level token-to-TTS latency parity remains outside this bounded lifecycle fix.

## Independently reproduced defects and corrections

- STT socket handlers were installed only after awaited audio startup/microphone consent. A real relay connection status arriving during the permission dialog was lost, producing a false startup timeout. Handlers now attach before awaits; activation still requires both upstream statuses and capture.
- Host muted input tracks and suppressed PCM while TTS played, preventing live Sarvam barge-in. Sarvam capture now stays live with echo/noise suppression and honors explicit mute; current-session speech-start/partial events interrupt current audio. Existing ElevenLabs behavior stays scoped separately.
- Manual interruption stopped audio but did not invalidate/abort the pending host turn. Late SSE completion could restart cancelled speech. Interruption now advances the turn sequence and aborts the stream before playback cleanup. This cancels local response generation/playback, not already authorized external actions.
- Missing-relay text and runbook incorrectly promised Sarvam utterance fallback. Provider-specific error guidance and OPS checklist now match fail-closed live mode.

## Evidence and limitations

Implementation checkpoint `b58b4811`; integrated concurrent Development `9d8aa208` in `4fefc41d`, preserving automatic-draft sync source and records. Final verification receipts are recorded below. Before the final patch, all five non-web package typechecks passed, Sarvam tool alias/security tests 4/4 passed and build-entrypoint integrity tests 3/3 passed. Those checks alone do not establish browser acoustic or vendor readiness.

A missing local parse5 dependency blocked web typechecking initially. Installed exact parse5 7.3.0 / entities 6.0.1 outside the checkout with scripts disabled and TLS verification, compared integrity strings against the workspace lock, and linked only ignored local dependencies. No manifest, lockfile or install policy was changed.

First FIX-01 and OPS-01 sessions returned findings before tool usage limits interrupted them. A replacement FIX-01 recovered the actual uncommitted changes and independently reproduced tests before continuing; no patch was discarded. Independent review is read-only.

## OPS handoff and current limits

The repository's application Compose/CI does not automatically wire this standalone relay. Production needs reviewed TLS WebSocket upgrades, exact-origin allowlist, web VOICE_RELAY_PUBLIC_URL, matching web/relay AUTH_SECRET, relay AI_COMMS_WEB_URL and server-side credentials. Both relay connected statuses mean upstream sockets opened; they are not vendor configuration ACKs or audio proof. Health endpoints do not attest a deployed Git SHA. Resolve image/release provenance independently.

Existing source uses one resolved Sarvam key by realtime/STT/TTS/chat/general priority, with TTS model pinned by bootstrap. Do not infer independently configured Voice Chat models/keys control the live relay. No deployed configuration or provider key was read or changed in this fix. Earlier observed production HTTP 522 remains a separate OPS availability issue until closed with runtime evidence.

## Exact next action

Source fix, review correction pass, focused verification and current Development integration are complete. OPS-01 deploys an approved web+relay revision and verifies real upstream streams/audio and reliable HTTPS. DEV-01/FIX-01 then execute delayed consent, explicit mute, barge-in during speech, end/reconnect, stale generation, denied read and real scoped last-24-hour question on a real device. No email/WhatsApp send is needed for this voice acceptance.

## Review resolution and executed verification

The independent read-only reviewer found four Important issues and no Critical issue: abandoned microphone permission could reopen capture, stale activation rejection could tear down a new call, old source completion could decrement new generation counters, and speech onset during pending host generation did not cancel it. FIX-01 reproduced these cases and corrected them in one bounded fix pass. Post-await guards stop abandoned tracks, both activation paths are connection-fenced, ended sources check their generation, and an active host request is aborted/sequence-invalidated on qualifying speech. The active request ref is cleared at completion so idle VAD is not a new cancellation. Stale TTS handlers are likewise scoped to the current connection. No new runtime or approval bypass was introduced.

- Initial readiness reproduction failed with early relay status while consent was pending, then passed 2/2 after handler movement. Four initial duplex/interruption cases failed before their fixes. Further review regressions exposed late permission, stale activation, old ended-source and pending-response speech bugs before correction. Final lifecycle regression file has 13 cases.
- Final merged-tree focused voice/security/lifecycle run: **54/54 passed across 10 files**, zero skipped, sanitized process environment; log `/workspace/.onboarding/ai-comms-agent/sarvam-live-20261023/final-voice-tests.log`. Includes the six-file 41-case implementation suite plus disconnect, end, session-start and turn-lifecycle regressions.
- Sarvam tool alias/security **4/4** and entrypoint integrity **3/3** passed; relay server/STT/TTS modules passed Node syntax checks.
- All five non-web package TypeScript checks passed again after integration. Final production web build passed with a sanitized environment (`final-web-build.log`), including Next type validation. Standalone web TypeScript check also passed after the build. Full unrelated package suites, production SQL, live Sarvam APIs, real microphone/acoustic barge-in, browser device policy and a deployed web/relay pair were not verified. Existing full-suite baselines must not be interpreted as current acceptance.

Reviewer declined live vendor/acoustic/deployment proof and complete Clara feature/phrase-streaming parity. These remain explicit acceptance/follow-up work; they were not silently dropped or inferred from mocks. The executed tests exercise actual extracted/transpiled connector, interruption, playback and SSE code with browser boundaries replaced, plus source contracts; they do not replace real-device testing.

## Shared lessons and exact recovery

Do not install WebSocket callbacks after a permission prompt, disable live Sarvam input to work around echo, or equate canceling audio with canceling a host response. Every async continuation and playback callback must retain its session/connection/generation identity. Cancellation invalidates the old response; it does not undo a previously authorized write. Reference protocol reuse is necessary but does not automatically provide browser lifecycle parity.

Recover `Development`, source fix `b58b4811`, concurrent integration `4fefc41d`, and this dated handoff. No worker/routine activation, provider credential edit, permission grant, database migration, live email/WhatsApp send or deployment was performed.
