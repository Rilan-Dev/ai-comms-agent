# AI Comms Agent voice relay

This isolated Node WebSocket service hosts the provider relay code adapted from the Clara AI Platform realtime implementation. It keeps provider API keys on the web/server side and accepts browser sockets only from explicit origins.

## Build and run

From the repository root:

```sh
docker build -f infra/voice-relay/Dockerfile -t ai-comms-voice-relay .
docker run --rm -p 3301:3301 \
  -e VOICE_RELAY_PORT=3301 \
  -e AUTH_SECRET="$AUTH_SECRET" \
  -e AI_COMMS_WEB_URL="https://YOUR-AI-COMMS-WEB-ORIGIN" \
  -e VOICE_RELAY_ALLOWED_ORIGINS="https://YOUR-AI-COMMS-WEB-ORIGIN" \
  ai-comms-voice-relay
```

Expose the service through a TLS reverse proxy or Cloudflare Tunnel that supports WebSocket upgrades. Do not expose port 3301 directly to the public internet without that proxy and origin restrictions.

## Required configuration

- `AUTH_SECRET`: same secret as the web app; minimum 32 characters. Never expose it to the browser.
- `AI_COMMS_WEB_URL`: base URL of the deployed ai-comms-agent web app. The relay calls its HMAC-protected bootstrap and metering endpoints.
- `VOICE_RELAY_ALLOWED_ORIGINS`: comma-separated exact browser origins, for example the production and preview web origins. No wildcard is accepted.
- `VOICE_RELAY_PORT`: optional; defaults to 3301.
- Web app: set `VOICE_RELAY_PUBLIC_URL` to the public `wss://` URL of this relay. The web app must use the same `AUTH_SECRET`.

Provider credentials remain in the organization's encrypted provider configuration or the web server's provider environment variables. The relay obtains provider credentials only from the HMAC-protected web bootstrap route; do not add provider API keys to the relay's public environment.

## Endpoints

- `/api/voice/sarvam/realtime`: Sarvam realtime STT WebSocket relay.
- `/api/voice/sarvam/tts-realtime`: Sarvam streaming TTS relay.
- `/api/voice/elevenlabs/realtime`: ElevenLabs Scribe realtime STT relay.
- `/api/voice/elevenlabs/tts-realtime`: ElevenLabs streaming TTS relay.
- `/health`: process health only; it does not verify provider credentials or external connectivity.

The web app mints a five-minute HMAC-signed token only after verifying the authenticated user, organization, agent and starting voice session. Bootstrap endpoints verify a relay-only HMAC header and re-check session ownership/provider before returning server-side configuration. Browser API keys are never returned.

## OPS-01 deployment handoff

OPS-01 owns deployment and live provider verification. Source presence and the relay process health endpoint do not establish that a production relay is configured or connected. The repository does not automatically start this service through its application Compose files. Wire the dedicated relay into the approved deployment and set the web and relay settings above.

**Sarvam live conversations fail closed when the relay is missing or either stream cannot connect. There is no REST utterance fallback in Sarvam live mode.** A separately selected voice-chat speech pipeline is a different feature. ElevenLabs retains its existing explicitly named pipeline fallback.

## What the live path means

The Clara reference uses two authenticated WebSocket streams: continuous PCM microphone frames to Saaras, and generation-tagged text/audio frames to/from Bulbul. Recognized final speech passes through the host-authorized Clara turn and email tools; the model never gains permission to read or send mail from a transcript alone. Using streaming speech recognition and synthesis is part of this live architecture; calling a one-shot REST transcribe/speak endpoint as a silent replacement is not.

The browser waits for both relay connection statuses and microphone readiness before presenting the session as active. A relay `connected` event currently reflects the vendor WebSocket opening (and, for TTS, sending its configuration); it is **not** a separate vendor configuration acknowledgement or proof of successful audio generation. Validate actual transcription and synthesized audio before claiming end-to-end readiness.

## Production acceptance checklist (OPS-01)

- Verify the deployed web and relay image/source revisions from deployment provenance; `/api/health` and relay `/health` do not attest a Git SHA.
- Verify the exact public web origin is allowlisted, TLS is valid, and the public proxy permits upgrades on both Sarvam paths. Provider keys and signed relay tokens must not appear in browser logs, command output or the runbook.
- Verify web `VOICE_RELAY_PUBLIC_URL`, matching web/relay `AUTH_SECRET`, relay `AI_COMMS_WEB_URL`, and exact `VOICE_RELAY_ALLOWED_ORIGINS`. The default application environment example alone does not configure a relay.
- Check authenticated, user/agent/session-scoped token issuance and server-side bootstrap; reject foreign/ended sessions, expired tokens and disallowed origins.
- Confirm both vendor streams open, then actual PCM transcription and generation-tagged audio playback. Test missing/invalid provider configuration and disconnects; the UI must not claim success or fall back to REST speech.
- Test delayed microphone consent, explicit mute, cancellation, stale-session events, and user speech during playback on a real device with echo cancellation. Mock lifecycle tests cannot establish acoustic echo behavior.
- Confirm spoken mailbox questions use successful authorized reads, exact coverage and source facts; verify denied mailbox access. No email or WhatsApp send is required to validate live speech.

The Sarvam relay currently resolves one server-side key using the configured realtime/STT/TTS/chat/general priority and pins its TTS model in the bootstrap adapter. Do not infer that independently selected Voice Chat keys/models automatically become live-relay settings. Check the resolved server-side provider configuration without printing key values.
