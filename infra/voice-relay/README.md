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

This service has been added as source only. It has not been built, deployed, tunnel-exposed or live-tested. OPS-01 should wire the relay into the target deployment environment and set `VOICE_RELAY_PUBLIC_URL` and `VOICE_RELAY_ALLOWED_ORIGINS`. Until that is configured, the app intentionally uses the Sarvam/ElevenLabs utterance pipeline fallback instead of claiming a native WebSocket connection.
