# REALTIME-VOICE-ARCHITECTURE.md

This document defines the realtime voice architecture. The core rule (per the master operating prompt §7 and §10) is: **the voice architecture must reuse Clara's existing realtime architecture rather than creating a disconnected second voice system**. We do not build a second voice runtime. We adapt Clara's `voice-core` modules to our host.

This is a Phase 1 document. Provider-specific implementation details are validated against real APIs in Phase 16 (Clara realtime voice integration).

---

## 1. Why Clara's voice architecture is reused

Clara's `voice-core` already provides:

- Provider-neutral contracts (`voice-core/types.ts`, `voice-core/config-types.ts`)
- Provider resolution (`voice-core/resolve.ts`, `voice-core/factory.ts`)
- Concrete providers: ElevenLabs, Sarvam (`voice-core/providers/*`)
- Realtime identity, generation coordination, cancellation (`voice-core/realtime/identity.ts`, `generation-coordinator.ts`)
- Latency tracking and logging (`voice-core/realtime/latency-tracker.ts`, `latency-log.ts`)
- Reconnect policy (`voice-core/realtime/reconnect-policy.ts`)
- UI state machine (`voice-core/realtime/ui-state-machine.ts`)
- Relay URL resolution (`voice-core/realtime/relay-url.ts`)
- Provider-specific realtime auth (`voice-core/api/{gemini,sarvam,elevenlabs}/realtime-auth.ts`)
- Metering (`voice-core/metering.ts`)

OpenAI and Gemini realtime are transport/API-specific (per `clara-core/AGENTS.md` §"Realtime voice completeness") — they live in `assistant/api/openai-realtime.ts` and `assistant/api/*` rather than as standalone `VoiceProviderService` implementations. We must not invent provider classes merely for symmetry.

---

## 2. System diagram

```text
                    ┌────────────────────┐
                    │   Browser (Web UI)  │
                    │   voice mode        │
                    └──────────┬─────────┘
                               │
                               │ 1. POST /api/voice/session
                               │    (agent_id, channel=voice)
                               ▼
                    ┌──────────────────────┐
                    │  Next.js API          │
                    │  - authn/authz        │
                    │  - resolve agent      │
                    │  - resolve voice config│
                    │    (Clara voice-core) │
                    │  - issue short-lived  │
                    │    session token      │
                    └──────────┬───────────┘
                               │
                               │ 2. { session_token, relay_url,
                               │      provider, model, voice_id }
                               ▼
                    ┌──────────────────────┐
                    │  Browser              │
                    │  Clara realtime client │
                    │  (voice-core/realtime) │
                    │  + provider transport  │
                    └──────────┬───────────┘
                               │
                               │ 3. WebRTC / WebSocket
                               │    to provider (via relay if needed)
                               ▼
              ┌────────────────────────────────────┐
              │  Provider realtime endpoint          │
              │  (OpenAI Realtime / Gemini Live /    │
              │   Sarvam / ElevenLabs)               │
              └────────────────┬───────────────────┘
                               │
                               │ 4. transcription events
                               │    (provider → client → API)
                               ▼
                    ┌──────────────────────┐
                    │  Next.js API          │
                    │  /api/voice/turn      │
                    │  - build AgentRequest │
                    │  - run agent pipeline │
                    │  - return text reply  │
                    └──────────┬───────────┘
                               │
                               │ 5. text reply → provider TTS
                               │    (or direct text channel)
                               ▼
                    ┌──────────────────────┐
                    │  Provider → user      │
                    │  (audio response)     │
                    └──────────────────────┘
                               │
                               │ 6. telemetry
                               ▼
                    ┌──────────────────────┐
                    │  voice.telemetry queue │
                    │  → voice_telemetry    │
                    └──────────────────────┘
```

---

## 3. Session lifecycle

1. **Session start**: Browser requests `/api/voice/session` with `agent_id`. API authenticates, resolves the agent's voice config via Clara's `voice-core/resolve.ts`, calls the provider's realtime auth (e.g., `voice-core/api/gemini/realtime-auth.ts`) to obtain a short-lived session token, persists a `voice_sessions` row, returns the token + relay URL + provider metadata to the browser.

2. **Connection**: Browser opens the realtime connection (WebRTC or WebSocket, provider-specific) using Clara's realtime client modules. Connection metadata is logged.

3. **Turn cycle**:
   - User speaks. Provider transcribes.
   - Transcription is forwarded to `/api/voice/turn` (or via the provider's server-side function-calling, depending on provider).
   - API builds an `AgentRequest` with `channel='voice'` and runs the standard agent pipeline (see `AI-ARCHITECTURE.md`).
   - Pipeline returns a text response.
   - Text response is sent to the provider's TTS (or returned to the browser for client-side TTS, depending on provider).
   - Latency stages (TFA, TTFT, TTFA, total) are recorded via Clara's `latency-tracker.ts` and persisted to `voice_telemetry`.

4. **Cancellation**: If the user interrupts, Clara's `generation-coordinator.ts` handles stale-generation protection — a cancelled turn cannot emit a duplicate final answer.

5. **Reconnect**: If the connection drops, Clara's `reconnect-policy.ts` governs bounded reconnect attempts. The browser UI uses `ui-state-machine.ts` to reflect connection state to the user.

6. **Session end**: Browser closes the connection; API marks `voice_sessions.ended_at` and computes `duration_seconds` and `turn_count`.

---

## 4. Provider matrix

| Provider | Realtime API | Use case | Notes |
|---|---|---|---|
| OpenAI Realtime | WebSocket (`assistant/api/openai-realtime.ts`) | General-purpose voice | Transport/API-specific; not a `VoiceProviderService` |
| Gemini Live | WebSocket + relay | Multimodal, low-latency | Uses `assistant/api/*` + relay scripts |
| Sarvam | WebSocket + wire (`scripts/sarvam-wire.mjs`) | Indian-language voice | Provider-specific wire protocol |
| ElevenLabs | WebSocket (`voice-core/providers/elevenlabs.ts`) | High-quality TTS + conversational | Standalone VoiceProviderService |

Per `clara-core/AGENTS.md`: "OpenAI and Gemini realtime are transport/API-specific rather than standalone VoiceProviderService implementations. Do not invent provider classes merely for symmetry." We follow this rule.

The user configures which provider(s) to enable per organization via `ai_provider_configs`. Multiple providers can be enabled simultaneously; the agent's voice config selects which one to use for a given session.

---

## 5. Security boundaries

- **Provider API keys** never reach the browser. They live in Vercel project env vars (server-only).
- **Session tokens** are short-lived (typically seconds to minutes, provider-specific). Issued by the API, consumed by the browser, used only for the realtime connection.
- **Relay**: where a provider requires a server-side relay (e.g., Sarvam wire protocol, Gemini Live relay), the relay is operated as a separate host (likely the worker host — see ADR-007). The relay sees only realtime transport, never provider API keys (relay uses short-lived tokens too).
- **Audio data**: never persisted. Only transcription text and TTS text are persisted (in `conversation_messages` and `voice_telemetry`).
- **Auth on `/api/voice/session` and `/api/voice/turn`**: same authn/authz as all other API routes. Organization-scoped, RBAC-checked.

---

## 6. Latency budgets

Per `clara-core/REFERENCE-MAP.md` and the IMPLEMENTATION-PLAYBOOK, the contract is:

- **TTFA** (time to first audio): target < 800 ms for cache-warm sessions, < 1500 ms for cold sessions.
- **TTFT** (time to first token): tracked for transcription.
- **Total turn latency**: tracked end-to-end.

Targets are configurable per organization (in `agent_ai_settings.feature_flags`). Actual latencies are recorded per turn in `voice_telemetry` and surfaced in the observability dashboard (see `OBSERVABILITY.md`).

If a provider consistently exceeds the latency budget, the organization's admin can switch to a faster provider (Clara's `resolve.ts` supports runtime provider switching).

---

## 7. Cancellation and concurrent generation

Clara's `voice-core/realtime/generation-coordinator.ts` handles:

- **Stale-generation protection**: if a new turn starts before the previous one completes, the previous turn's audio output is suppressed.
- **Concurrent generation**: only one generation per voice session at a time. A second request must wait or cancel the first.
- **First-wins latency marks**: the first event to mark a latency stage wins; later events for the same stage are ignored.

We reuse this directly. We do not implement our own cancellation logic.

---

## 8. Telemetry

Per-turn telemetry is emitted to the `voice.telemetry` RabbitMQ queue and persisted to `voice_telemetry`:

```json
{
  "voice_session_id": "...",
  "turn_id": "...",
  "stage": "ttfa",
  "latency_ms": 612,
  "provider_metadata": { "model": "gemini-2.0-flash-exp", "voice_id": "..." },
  "created_at": "2026-..."
}
```

Voice session-level telemetry (total duration, turn count, error rate) is computed on session end and stored in `voice_sessions`.

---

## 9. Failure modes

- **Provider realtime endpoint unreachable**: browser reconnects per `reconnect-policy.ts`. After max retries, UI shows "connection lost" and the user can retry.
- **Session token expired**: browser requests a new token from `/api/voice/session`. Old session is marked ended.
- **API failure during `/api/voice/turn`**: provider TTS receives an error message; user hears "I had a problem — please try again".
- **Clara resolution failure (no provider configured)**: `/api/voice/session` returns 400 with a structured error. UI blocks voice mode.
- **Audio device permission denied**: browser-side error; UI explains how to grant microphone permission.

---

## 10. What is deferred to Phase 16

- Concrete provider SDK wiring (OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs).
- Relay host deployment (if needed for Sarvam/Gemini).
- Browser-side voice UI (microphone toggle, transcript overlay, cancellation button).
- Latency dashboard.
- Voice-specific observability alerts.

Phase 16 also validates the latency budgets against real provider behavior. If a provider cannot meet the budget, the architecture stays; the provider is demoted or removed from the default set.
