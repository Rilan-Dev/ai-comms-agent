# Sarvam + Gemini Configuration Guide

Switch an organization's AI runtime from OpenAI-default to **Sarvam for chat+voice+realtime** and **Gemini for embedding**. Useful when:
- The org has no active OpenAI API key with realtime API scope
- Sarvam is the preferred chat provider (multilingual, low cost)
- Gemini is the preferred embedding provider (good quality, low cost)

## Why This Config

The default org settings ship with `realtime_voice_provider='openai'` and `embedding_provider='openai'`. For orgs that only have chat-purpose OpenAI keys (no realtime-purpose key), the OpenAI Realtime WebRTC negotiation would fail with HTTP 401 — "OpenAI Realtime negotiation failed (401)". Switching to Sarvam for voice routes the voice path through the host transcript bridge (Sarvam STT + Sarvam chat + Sarvam TTS via `/api/voice/turn`), which works with the existing Sarvam chat-purpose key.

Gemini's `text-embedding-004` model produces 768-dim embeddings at $0.075/MTok — significantly cheaper than OpenAI's `text-embedding-3-small` (1536-dim, $0.02/MTok) for the same RAG quality.

## Prerequisites

1. **Sarvam chat-purpose credential** must exist in `ai_provider_configs`:
   ```sql
   SELECT * FROM aca.ai_provider_configs
   WHERE organization_id = $1 AND provider='sarvam' AND purpose='chat';
   -- must return a row with enabled=true and encrypted_api_key of length > 0
   ```

2. **Sarvam realtime-purpose credential** must exist (used by Sarvam realtime model `saaras:v3-realtime`):
   ```sql
   SELECT * FROM aca.ai_provider_configs
   WHERE organization_id = $1 AND provider='sarvam' AND purpose='realtime';
   -- must return a row with enabled=true
   ```

3. **Gemini embedding-purpose credential** must exist with a VALID API key:
   ```sql
   SELECT * FROM aca.ai_provider_configs
   WHERE organization_id = $1 AND provider='gemini' AND purpose='embedding';
   -- must return a row with enabled=true
   -- the decrypted key must start with "AIza..." and be accepted by
   --   https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
   -- If the API returns 400 "API_KEY_INVALID", the key is expired or
   -- revoked — the user must update it via the AI Provider Setup menu.
   ```

## Apply The Config

Run this SQL against the org's `organization_ai_runtime_settings` row. Replace `$1` with the org's UUID.

```sql
UPDATE aca.organization_ai_runtime_settings
SET
  -- Chat: Sarvam (default_provider was likely already 'sarvam' for
  -- orgs that hit the OpenAI 401 issue)
  default_provider          = 'sarvam',

  -- Realtime voice: Sarvam saaras:v3-realtime. This routes the voice
  -- path through the host transcript bridge (no OpenAI WebRTC).
  realtime_voice_provider   = 'sarvam',
  realtime_voice_model       = 'saaras:v3-realtime',
  voice_id                  = 'shubh',  -- Sarvam Bulbul v3 default speaker

  -- Voice-chat pipeline (host bridge TTS+STT). Used by /api/voice/turn
  -- to synthesize assistant responses and transcribe user audio.
  voice_chat_provider       = 'sarvam',
  voice_chat_tts_model       = 'bulbul:v3',     -- Sarvam Bulbul v3 (multilingual)
  voice_chat_stt_model       = 'saaras:v3',     -- Sarvam Saaras v3 STT
  voice_chat_voice_id       = 'shubh',

  -- Embedding: Gemini text-embedding-004 (768-dim).
  embedding_provider        = 'gemini',
  embedding_model           = 'text-embedding-004',
  embedding_dimension       = 768,

  updated_at                = now()
WHERE organization_id = $1;
```

## Per-Agent Overrides (Optional)

By default, per-agent overrides on `agents` are NULL — agents inherit the org-level settings. This means switching the org-level `realtime_voice_provider` switches all agents in the org.

To pin a specific agent to a different provider, set the agent's `realtime_voice_provider_override` column:

```sql
-- Pin Sarvam Chat Agent to Sarvam (explicit, even if org changes later)
UPDATE aca.agents
SET realtime_voice_provider_override = 'sarvam',
    realtime_voice_model = 'saaras:v3-realtime',  -- NOT a column; use realtime_stt_model + realtime_tts_model
    updated_at = now()
WHERE id = $agent_id;
```

## Switching Back to OpenAI

To switch back to OpenAI for realtime voice (requires a dedicated `realtime`-purpose OpenAI key — NOT a chat-purpose key):

```sql
UPDATE aca.organization_ai_runtime_settings
SET
  realtime_voice_provider   = 'openai',
  realtime_voice_model       = 'gpt-realtime-2.1-mini',
  voice_id                  = 'alloy',  -- OpenAI realtime default voice
  updated_at                = now()
WHERE organization_id = $1;
```

Without a dedicated `realtime`-purpose OpenAI key, the voice path stays on `transcript_bridge` (which is the desired fallback behavior after commit `610d4018`).

## Verification

After applying the config:

1. **Sarvam chat** — `POST /api/chat/stream` with the Sarvam agent should respond normally. Verify:
   ```bash
   node scripts/verify-sarvam-only-config.mjs
   ```

2. **Sarvam voice** — `POST /api/voice/session` with the Sarvam agent should return:
   ```json
   {
     "session": { "provider": "sarvam", "status": "starting" },
     "transport": {
       "realtimeProvider": "sarvam",
       "transportMode": "transcript_bridge",
       "turnEndpoint": "/api/voice/turn"
     }
   }
   ```
   Verify: `node scripts/verify-voice-401-fix.mjs`

3. **Gemini embedding** — direct API test against the decrypted key:
   ```bash
   node scripts/verify-gemini-embedding.mjs
   ```
   Expected: 768-dim vector returned from `text-embedding-004`. If the API returns `400 API_KEY_INVALID`, the Gemini key must be updated.

## Source Code Path

The Sarvam-only configuration is supported by:

| Code path | File | Notes |
|-----------|------|-------|
| Org settings load | `packages/clara-core/src/runtime.ts:organizationAIConfig()` | Reads `organization_ai_runtime_settings` + per-agent overrides |
| Voice provider resolve | `packages/clara-core/src/runtime.ts:resolveVoice()` | Returns `transportMode='transcript_bridge'` when no realtime-purpose OpenAI key (commit `610d4018`) |
| Voice session start | `apps/web/src/app/api/voice/session/route.ts:POST` | Calls `claraRuntime.startRealtimeSession` with `voiceOverride` from org+agent settings |
| OpenAI Realtime negotiation | `apps/web/src/app/api/voice/realtime/route.ts:POST` | Only called when `transportMode='realtime'` — Sarvam-configured orgs never hit this path |
| Sarvam TTS | Sarvam Bulbul v3 via `https://api.sarvam.ai/` (model catalog: `bulbul:v3`) | Used by the host transcript bridge for assistant response synthesis |
| Sarvam STT | Sarvam Saaras v3 via `https://api.sarvam.ai/` (model catalog: `saaras:v3`) | Used by the host transcript bridge for user audio transcription |
| Gemini embedding | `packages/clara-core/src/runtime.ts:embedTextOnce()` | Calls `https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={apiKey}` |

## Test Artifacts

- `scripts/inventory-sarvam-gemini.mjs` — show current Sarvam + Gemini provider state in DB
- `scripts/switch-org-to-sarvam-gemini.mjs` — apply the org settings switch
- `scripts/verify-sarvam-only-config.mjs` — E2E verification (chat + voice)
- `scripts/verify-voice-401-fix.mjs` — voice session resolver check
- `scripts/verify-gemini-embedding.mjs` — direct Gemini embedding API test
- `apps/web/tests/voice-401-regression.test.ts` — source-level regression tests for the 401 fix
