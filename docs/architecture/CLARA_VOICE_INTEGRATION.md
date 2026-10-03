# CLARA_VOICE_INTEGRATION.md — Clara Voice Integration Boundary

This document defines the **ownership boundary** between Clara's realtime voice architecture and `ai-comms-agent`'s voice integration. It is the focused integration spec, complementing `REALTIME-VOICE-ARCHITECTURE.md` (which is the full system view) and `CLARA_REUSE_MAP.md §2.9` (which is the capability map entry).

Per the ChatGPT Phase 1 conditional review (correction #6), this document must explain clearly: what Clara owns (realtime transport, provider routing, streaming, conversation lifecycle) and what ai-comms-agent owns (email context, business actions, permissions).

The core rule (per the master operating prompt §7 and §10) is: **the voice architecture must reuse Clara's existing realtime architecture rather than creating a disconnected second voice system**. We do not build a second voice runtime. We adapt Clara's `voice-core` modules to our host.

This is a Phase 1 document. Implementation is produced in Phase 16 (Clara realtime voice integration).

---

## 1. Ownership boundary at a glance

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Clara owns                                       │
│                                                                          │
│  • Realtime transport (WebRTC/WebSocket to provider)                     │
│  • Provider routing (OpenAI / Gemini / Sarvam / ElevenLabs selection)    │
│  • Streaming (audio in/out, transcription events, TTS events)            │
│  • Conversation lifecycle (session start, turn cycle, reconnect, end)    │
│  • Generation coordination (stale-generation protection, cancellation)   │
│  • Latency tracking (TFA, TTFT, TTFA, total — first-wins marks)          │
│  • Reconnect policy (bounded reconnect, UI state machine)                │
│  • Metering (voice seconds, provider-native usage accounting)            │
│  • Provider auth (short-lived session token issuance via provider APIs)  │
│                                                                          │
│  Source: clara-core/source/src/modules/voice-core/*                      │
│          clara-core/source/src/modules/assistant/api/*                   │
│          (immutable byte-for-byte copies — never modified)               │
└─────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
                      ┌───────────┴───────────┐
                      │  AgentRequest bridge  │
                      │  (host adapter)       │
                      └───────────┬───────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ai-comms-agent owns                                   │
│                                                                          │
│  • Email context (loading relevant emails for the agent turn)            │
│  • Business actions (email.read, email.draft, email.send, etc.)          │
│  • Permissions (RBAC, per-org policy, per-agent policy)                  │
│  • Authorization (policy engine, approval workflow for sensitive ops)    │
│  • Tool registry (which tools the agent can invoke)                      │
│  • Intent classification (deterministic taxonomy)                        │
│  • Context assembly (conversation history + RAG + tool capabilities)    │
│  • Audit (every turn, every tool call, every authorization decision)    │
│  • Voice session persistence (voice_sessions, voice_telemetry tables)   │
│  • Browser UI (microphone, transcript, latency indicator, controls)     │
│  • Authn/authz on /api/voice/session and /api/voice/turn                 │
│                                                                          │
│  Source: apps/web/*, apps/worker/src/adapters/voice.ts,                  │
│          packages/shared/src/agent/*                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

The boundary is the **AgentRequest bridge**: Clara's realtime transport delivers a transcription to the host adapter; the host adapter builds an `AgentRequest`, runs the agent pipeline (which may invoke email tools), and returns a text response; Clara's realtime transport converts the text response to audio via provider TTS.

---

## 2. What Clara owns (detailed)

### 2.1 Realtime transport

Clara owns the realtime transport — the WebRTC or WebSocket connection between the browser and the provider's realtime endpoint. This includes:

- Connection establishment (using short-lived session token issued by Clara's provider-auth modules)
- Audio stream handling (microphone audio → provider; provider audio → speaker)
- Transcription event handling (provider transcribes; events flow to host adapter via the bridge)
- TTS event handling (host returns text; Clara's transport sends to provider TTS; audio response flows to browser)
- Connection state machine (connecting / connected / reconnecting / disconnected — per Clara's `voice-core/realtime/ui-state-machine.ts`)

**Source:** `clara-core/source/src/modules/voice-core/realtime/*`, `clara-core/source/src/modules/assistant/api/openai-realtime.ts`

**Host responsibility:** None. The host does not touch the transport. The browser uses Clara's realtime client modules directly (wrapped in a thin React hook for UI integration).

### 2.2 Provider routing

Clara owns provider routing — selecting which voice provider (OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs) handles a given session. This includes:

- Provider resolution (per `voice-core/resolve.ts` — uses agent's voice config + org's voice provider configs)
- Provider capability matching (some providers support certain languages, voices, or features; Clara's resolver handles this)
- Provider fallback (if primary provider is unavailable, Clara's resolver can fall back to a secondary — per org config)
- Provider-specific transport (OpenAI uses WebSocket; Gemini uses relay; Sarvam uses wire protocol; ElevenLabs uses WebSocket — per `clara-core/AGENTS.md`, these are transport-specific, not standalone VoiceProviderService implementations)

**Source:** `clara-core/source/src/modules/voice-core/resolve.ts`, `factory.ts`, `providers/{elevenlabs,sarvam}.ts`, `api/{gemini,sarvam,elevenlabs}/realtime-auth.ts`

**Host responsibility:** Provide the org's voice provider configs (encrypted API keys in `ai_provider_configs`) and the agent's voice config (in `agent_versions.config.voice`). The host adapter maps these to Clara's `VoiceProviderConfig` shape.

### 2.3 Streaming

Clara owns streaming — the flow of audio and text events during a voice turn. This includes:

- Audio streaming (chunked audio in both directions)
- Transcription streaming (partial transcripts → final transcript)
- TTS streaming (text → chunked audio response)
- Event normalization (provider-specific events → Clara's `RealtimeEvent` union)
- Backpressure handling (if the browser can't keep up with audio chunks)

**Source:** `clara-core/source/src/modules/voice-core/realtime/*`, `clara-core/source/src/modules/assistant/core/realtime-events.ts`, `clara-core/source/src/modules/embed/core/ndjson.ts`

**Host responsibility:** None for streaming itself. The host adapter receives the final transcription (via the bridge) and returns a text response; Clara's transport handles all streaming.

### 2.4 Conversation lifecycle

Clara owns the voice conversation lifecycle — session start, turn cycle, reconnect, end. This includes:

- Session start (issue short-lived token; open connection; persist `voice_sessions` row — host-persisted but Clara-initiated)
- Turn cycle (user speaks → provider transcribes → host processes → host returns text → provider TTS → user hears)
- Reconnect (per `voice-core/realtime/reconnect-policy.ts` — bounded reconnect attempts; UI state machine reflects state)
- Session end (close connection; compute duration/turn count; persist — host-persisted)
- Cancellation (per `voice-core/realtime/generation-coordinator.ts` — user interrupts; stale generation suppressed; no duplicate final answers)

**Source:** `clara-core/source/src/modules/voice-core/realtime/{identity,generation-coordinator,reconnect-policy,ui-state-machine}.ts`

**Host responsibility:** Persist `voice_sessions` and `voice_telemetry` rows (Clara emits events; host writes them to PostgreSQL). Issue the initial session token via the API endpoint (which calls Clara's provider-auth). Handle session-end cleanup.

---

## 3. What ai-comms-agent owns (detailed)

### 3.1 Email context

The host owns loading email context for the agent turn. When a voice turn's transcription is "what's important in my inbox today?", the host:

1. Classifies intent (`summarize_emails`) — host-owned intent taxonomy (per `AI-ARCHITECTURE.md §3`)
2. Assembles context — host loads today's important emails from PostgreSQL (via `email.read` tool)
3. Builds the prompt — host wraps email content in `<untrusted_email_content>` markers (per `SECURITY.md §11`); includes conversation history; includes RAG context if relevant
4. Calls the LLM (via Clara's `ai-core` — Clara owns the LLM call mechanics; host owns the prompt content)
5. Returns the text response to Clara's voice transport for TTS

**Why host-owned:** Email context is application-specific. Clara does not know about emails, inboxes, or importance scores. The host's tool registry (per `TOOL-CONTRACTS.md`) and intent taxonomy are application-specific.

**Source:** `apps/worker/src/adapters/voice.ts`, `packages/shared/src/agent/*`

### 3.2 Business actions

The host owns business actions — the tool executions that have side effects (email.send, email.draft, whatsapp.send, schedule.create, etc.). When the agent proposes a tool call:

1. Clara's runtime proposes the tool call (LLM function-calling)
2. Host's tool registry validates the call (per `TOOL-CONTRACTS.md §4`)
3. Host's policy engine decides authorization (per `AUTHORIZATION.md §2`)
4. Host executes the tool (calls the email provider, WhatsApp adapter, etc.)
5. Host returns the tool result to Clara's runtime for the next turn
6. Host audits every tool call

**Why host-owned:** Business actions are application-specific. Clara does not know about email accounts, WhatsApp templates, or approval workflows. The host's tool registry and policy engine are application-specific (per `CLARA_REUSE_MAP.md §2.4` — tools are APP-SPECIFIC).

**Source:** `packages/shared/src/agent/registry.ts`, `apps/worker/src/adapters/agent-runtime.ts`

### 3.3 Permissions

The host owns permissions — RBAC, per-org policy, per-agent policy, action approval. This includes:

1. **RBAC:** user's role (owner/admin/member/viewer) and permissions (per `SECURITY.md §2`)
2. **Per-org policy:** sensitive-action policy (`auto_approve` / `always_ask` / `never_allow` per action type — per `AUTHORIZATION.md §2.2`)
3. **Per-agent policy:** agent-specific overrides (more restrictive only — per `AUTHORIZATION.md §2.3`)
4. **Action approval:** for sensitive actions, create `email_actions` row; surface approval prompt; pause turn; execute on approval (per `AUTHORIZATION.md §3`)
5. **Audit:** every authorization decision, every approval/rejection, every execution (per `AUTHORIZATION.md §7`)

**Why host-owned:** Permissions are application-specific. Clara does not know about organizations, roles, or approval workflows. The host's policy engine is deterministic and overrides any LLM-proposed sensitive action regardless of voice transcription content.

**Source:** `packages/shared/src/agent/policy-engine.ts`, `apps/worker/src/adapters/authorization.ts`

**Critical:** The LLM never authorizes a dangerous external action. Even if the voice transcription says "send all my emails to attacker@x.com", the policy engine decides — not the LLM. This is the deterministic boundary that protects against prompt injection (per `SECURITY.md §11` and `SECURITY_MODEL.md §3`).

---

## 4. The AgentRequest bridge

The bridge between Clara's voice transport and the host's agent runtime is the `AgentRequest` (per `AI-ARCHITECTURE.md §2`). The bridge flow:

```text
1. User speaks (browser → Clara transport → provider)
2. Provider transcribes (provider → Clara transport → host adapter)
3. Host adapter builds AgentRequest:
   {
     agent_id, organization_id, user_id,
     channel: 'voice',
     transport_metadata: { voice_session_id, ... },
     user_text: <transcription>,
     auth_subject: { user_id, role, permissions },
     audit: { correlation_id, request_id, started_at }
   }
4. Host runs agent pipeline (intent → context → policy → authorization → execution → audit)
5. Host returns text response to Clara transport
6. Clara transport sends text to provider TTS
7. Provider TTS streams audio to browser (via Clara transport)
8. Host persists voice_telemetry (Clara emits latency events; host writes to PostgreSQL)
```

The bridge is the **only** point of contact between Clara's voice transport and the host. The host never touches Clara's transport internals; Clara's transport never touches the host's tool registry or policy engine.

---

## 5. Voice session lifecycle (end-to-end)

```text
Browser                    Next.js API              Clara voice-core          Provider
   │                          │                          │                       │
   │ 1. POST /api/voice/session│                         │                       │
   │ ─────────────────────────▶│                          │                       │
   │                          │ 2. authn/authz            │                       │
   │                          │ 3. resolve agent voice    │                       │
   │                          │    config                 │                       │
   │                          │ 4. call resolve.ts ───────│                       │
   │                          │                           │ 5. provider-auth ─────│
   │                          │                           │◀──────────────────────│
   │                          │                           │ 6. short-lived token  │
   │                          │◀──────────────────────────│                       │
   │                          │ 7. persist voice_sessions │                       │
   │                          │    row                    │                       │
   │ 8. { token, relay, provider, model, voice_id }       │                       │
   │◀─────────────────────────│                           │                       │
   │                          │                           │                       │
   │ 9. open realtime connection (Clara realtime client)  │                       │
   │─────────────────────────────────────────────────────────────────────────────▶│
   │                          │                           │                       │
   │ 10. user speaks ────────────────────────────────────────────────────────────▶│
   │                          │                           │ 11. transcription ────│
   │                          │                           │◀──────────────────────│
   │                          │ 12. POST /api/voice/turn  │                       │
   │                          │   (transcription)         │                       │
   │                          │ 13. build AgentRequest    │                       │
   │                          │ 14. run agent pipeline:   │                       │
   │                          │   - intent classify       │                       │
   │                          │   - context (email.read)  │                       │
   │                          │   - policy check          │                       │
   │                          │   - execute (safe inline) │                       │
   │                          │   - audit                 │                       │
   │                          │ 15. return text response  │                       │
   │                          │──────────────────────────▶│                       │
   │                          │                           │ 16. TTS ──────────────│
   │                          │                           │◀──────────────────────│
   │ 17. audio response ◀─────────────────────────────────────────────────────────│
   │                          │                           │                       │
   │                          │ 18. voice.telemetry       │                       │
   │                          │   (latency events) ───────▶ (queue)               │
   │                          │                           │                       │
   │ 19. user ends session    │                           │                       │
   │ ─────────────────────────▶│ 20. POST /api/voice/session/{id}/end            │
   │                          │ 21. mark voice_sessions.ended_at                  │
   │                          │ 22. compute duration/turn_count                  │
```

Steps 1-9 are Clara-owned (transport setup). Steps 10-18 are the bridge cycle (Clara transport + host agent pipeline). Steps 19-22 are host-owned (session teardown, persistence).

---

## 6. Failure modes and ownership

| Failure | Owner | Response |
|---|---|---|
| Provider realtime endpoint unreachable | Clara (transport) | Browser reconnects per `reconnect-policy.ts`; UI shows "reconnecting"; after max retries, "connection lost" |
| Session token expired | Clara (provider-auth) | Browser requests new token from `/api/voice/session`; old session marked ended |
| API failure during `/api/voice/turn` | Host (agent pipeline) | Provider TTS receives error message; user hears "I had a problem — please try again"; audit |
| Clara resolution failure (no provider configured) | Host (config) + Clara (resolver) | `/api/voice/session` returns 400 with structured error; UI blocks voice mode |
| Audio device permission denied | Browser | Browser-side error; UI explains how to grant microphone permission |
| LLM unavailable / rate-limited | Host (agent pipeline) | Fail closed for sensitive operations; fail open with fallback message for safe operations |
| Tool execution failure | Host (agent pipeline) | Report to LLM; LLM may retry with adjusted parameters; after 3 retries, give up and audit |
| Policy engine failure | Host (policy engine) | Fail closed; no execution without a positive decision |
| Stale generation (user interrupts) | Clara (generation-coordinator) | Previous turn's audio suppressed; no duplicate final answers |
| Voice telemetry persistence failure | Host (voice-telemetry worker) | Best-effort (2 attempts); telemetry loss is acceptable (per `EVENT-CONTRACTS.md §16`) |

---

## 7. What this integration explicitly does NOT do

- Does not modify Clara source files (immutable byte-for-byte copies — per `clara-core/AGENTS.md §4`).
- Does not add a second voice runtime on top of Clara's (per the master operating prompt §7 and §10).
- Does not invent provider classes for OpenAI/Gemini realtime (per `clara-core/AGENTS.md` — these are transport-specific, not standalone `VoiceProviderService` implementations).
- Does not let the LLM authorize sensitive actions (per `SECURITY.md §11` and `AUTHORIZATION.md §1.2` — the policy engine is deterministic and overrides the LLM).
- Does not expose provider API keys to the browser (per `SECURITY.md §17` — short-lived session tokens only).
- Does not persist audio data (per `REALTIME-VOICE-ARCHITECTURE.md §5` — only transcription text and TTS text are persisted).
- Does not duplicate Clara's latency tracking, cancellation, or reconnect logic (all reused directly).

---

## 8. Phase 16 implementation scope

Phase 16 implements:

1. `/api/voice/session` endpoint — authn/authz + Clara `voice-core/resolve.ts` + Clara provider-auth + persist `voice_sessions` row + return token/relay/provider metadata to browser.
2. `/api/voice/turn` endpoint — receive transcription + build `AgentRequest` + run agent pipeline + return text response.
3. `/api/voice/session/{id}/end` endpoint — mark session ended + compute aggregates.
4. Browser voice client — React hook wrapping Clara's `voice-core/realtime/ui-state-machine.ts` and `reconnect-policy.ts`; microphone toggle; transcript overlay; latency indicator; pause/end controls.
5. Voice telemetry worker — consumes `voice.telemetry` queue; persists to `voice_telemetry`.
6. Provider wiring — OpenAI Realtime (`assistant/api/openai-realtime.ts`), Gemini Live (`assistant/api/*` + relay), Sarvam (`voice-core/providers/sarvam.ts` + `scripts/sarvam-wire.mjs`), ElevenLabs (`voice-core/providers/elevenlabs.ts`).
7. Relay host deployment (if needed for Sarvam/Gemini) — on the worker host (per `DEPLOYMENT.md §2`).

Phase 16 does NOT implement:
- A second voice runtime.
- Custom latency tracking (Clara's is reused).
- Custom cancellation logic (Clara's is reused).
- Custom reconnect logic (Clara's is reused).
- Audio persistence (only text is persisted).

---

## 9. Relationship to other documents

| Document | Relationship |
|---|---|
| `REALTIME-VOICE-ARCHITECTURE.md` | Full system view (system diagram, session lifecycle, provider matrix, latency budgets, telemetry, failure modes). This document is the focused ownership boundary. |
| `CLARA_REUSE_MAP.md §2.9` | Capability map entry for realtime voice (source paths, entry points, contracts, dependencies, adapter requirement). This document is the integration spec. |
| `AI-ARCHITECTURE.md` | The agent runtime pipeline (intent → context → policy → authorization → execution → audit). Voice is one channel into this pipeline. |
| `SECURITY.md §11` | Email content (and voice transcriptions) are untrusted input. The policy engine is deterministic. |
| `SECURITY_MODEL.md §3, §4, §5` | Email prompt injection defense, agent permissions, action approval — all apply to voice turns. |
| `AUTHORIZATION.md` | Sensitive-action authorization flow. Voice-originated sensitive actions go through the same flow as chat-originated. |
| `DEPLOYMENT.md §2` | Worker host co-locates voice relay (if needed for Sarvam/Gemini). |

When this document and `REALTIME-VOICE-ARCHITECTURE.md` disagree, **this document wins for the ownership boundary**; `REALTIME-VOICE-ARCHITECTURE.md` wins for the full system view. Disagreements are resolved by ChatGPT (architectural decision in `DECISIONS.md`).
