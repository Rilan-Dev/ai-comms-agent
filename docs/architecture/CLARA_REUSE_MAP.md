# CLARA_REUSE_MAP.md — Clara Capability Reuse Map

This document is the canonical map of every Clara capability that `ai-comms-agent` depends on, with the source path, implementation entry point, public API/contracts, dependencies, adapter requirement, and our usage. It is the authoritative reference for the integration boundary defined in `CLARA-INTEGRATION.md`.

Per the master operating prompt §4, Clara is the permanent reference for AI, RAG, voice, agent runtime, and related capabilities. Per `CLARA-INTEGRATION.md`, every capability is classified as **REUSE** (use Clara directly), **ADAPTER** (wrap Clara with a host-specific adapter), or **APP-SPECIFIC** (write new code, only if genuinely necessary).

> **Source of truth for this map:** `Rilan-Dev/ai-reusable-libraries` at `clara-core/source/src/`. The map is based on a depth-1 clone inspection performed during Phase 1. The Phase 2 deep audit (per `CLARA-INTEGRATION.md §8` and `ISSUES.md ISS-002`) re-verifies every entry against a full clone and runs Clara's `scripts/verify-extraction.mjs`.

---

## 1. Legend

- **Capability** — the Clara-owned functional area.
- **Source path** — location within `clara-core/source/src/`.
- **Implementation entry point** — the file a host imports to use the capability.
- **Public API / contracts** — the exported types/functions/interfaces.
- **Dependencies** — other Clara modules or external services the capability relies on.
- **Adapter requirement** — what the host must provide (REUSE = nothing; ADAPTER = host wrapper; APP-SPECIFIC = no Clara dependency).
- **ai-comms-agent usage** — how this project uses the capability, with the phase that implements it.

---

## 2. Capability map

### 2.1 AI provider registry

| Field | Value |
|---|---|
| **Capability** | AI provider registry — multi-provider configuration storage and lookup |
| **Source path** | `modules/ai-core/` |
| **Implementation entry point** | `modules/ai-core/factory.ts` |
| **Public API / contracts** | `AIProvider`, `AIProviderService` (in `modules/ai-core/types.ts`); `createAIProvider(config)` factory |
| **Dependencies** | `modules/ai-governance/core/resolver.ts` (resolution); host DB (for provider config storage) |
| **Adapter requirement** | **ADAPTER** — host provides `ai_provider_configs` table and a thin adapter that reads encrypted API keys and maps to Clara's `AIProviderConfig` shape |
| **ai-comms-agent usage** | Phase 3 stores provider configs in `ai_provider_configs` (encrypted); Phase 11 resolves provider at request time via Clara's factory. Providers: OpenAI, Gemini, Sarvam, TEI. |

---

### 2.2 Model resolution

| Field | Value |
|---|---|
| **Capability** | Model resolution — pick the right model for an agent/request based on config, governance, and live catalog |
| **Source path** | `modules/ai-core/resolve.ts`, `modules/ai-core/resolve-cache.ts`, `modules/ai-governance/core/resolver.ts`, `modules/ai-governance/core/live-catalog.ts` |
| **Implementation entry point** | `modules/ai-core/resolve.ts` → `resolveAIModel(agentConfig, governanceContext)` |
| **Public API / contracts** | `ResolvedAIModel`, `ResolutionContext`, `ResolutionCache` |
| **Dependencies** | `modules/ai-core/model-catalog.ts`; `modules/ai-governance/core/entitlements-db.ts` (entitlement checks); host DB (for agent AI settings) |
| **Adapter requirement** | **ADAPTER** — host provides `agent_ai_settings` table and maps to Clara's `AgentAIConfig`; host wraps `resolve-cache.ts` with Redis-backed cache if needed |
| **ai-comms-agent usage** | Phase 11 calls Clara's resolver for every agent turn. Resolution order: agent override → org default → platform default. Cached per `(agent_id, model_id)` for the request duration. |

---

### 2.3 Agent runtime

| Field | Value |
|---|---|
| **Capability** | Agent runtime — the core orchestration loop that turns an `AgentRequest` into an `AgentResponse` |
| **Source path** | `modules/ai-platform-core/clara-runtime.ts` |
| **Implementation entry point** | `modules/ai-platform-core/clara-runtime.ts` → `ClaraRuntime` class |
| **Public API / contracts** | `ClaraRuntime`, `RuntimeRequest`, `RuntimeResponse`, `RuntimeTurn` |
| **Dependencies** | `modules/ai-core/` (provider calls), `modules/rag/grounding.ts` (RAG), `modules/assistant/core/config.ts` (assistant config), `modules/ai-governance/` (usage tracking) |
| **Adapter requirement** | **ADAPTER** — host wraps `ClaraRuntime` with a thin `AgentRuntimeAdapter` that injects: host auth subject, host organization context, host tool registry (per `TOOL-CONTRACTS.md`), host audit emitter. The host does NOT reimplement the runtime loop. |
| **ai-comms-agent usage** | Phase 11 instantiates `ClaraRuntime` per agent turn. The adapter feeds the `AgentRequest` (per `AI-ARCHITECTURE.md §2`) and consumes the streamed `RuntimeResponse`. Intent classification, context assembly, and audit are host-owned; the LLM call loop, streaming, and tool-call marshalling are Clara-owned. |

> **Note on intent/policy/authorization:** Clara's runtime handles the LLM call loop and tool-call marshalling. The **intent taxonomy, policy engine, and authorization flow** (per `AI-ARCHITECTURE.md §3-5` and `AUTHORIZATION.md`) are **application-specific** — they sit in the host adapter, not in Clara. Clara's runtime proposes tool calls; the host adapter validates them against the policy engine before Clara executes. This boundary is documented in `CLARA_VOICE_INTEGRATION.md §3` (the same pattern applies to chat/WhatsApp).

---

### 2.4 Tools

| Field | Value |
|---|---|
| **Capability** | Tool registry — register, validate, and execute agent tools |
| **Source path** | *(none — Clara does not provide a standalone tool runtime; see ISS-005)* |
| **Implementation entry point** | *(none)* |
| **Public API / contracts** | *(none — Clara's `WORKLOG.md` line 23: "Generic MCP/tool runtime still has no standalone Clara implementation to extract.")* |
| **Dependencies** | n/a |
| **Adapter requirement** | **APP-SPECIFIC** — ai-comms-agent builds its own `ToolRegistry` per `docs/specs/TOOL-CONTRACTS.md`. The registry integrates with Clara's runtime via the host adapter (the adapter validates tool calls against the registry before Clara executes). |
| **ai-comms-agent usage** | Phase 11 implements `ToolRegistry`, `Tool` contract, and the initial tool catalogue (email, WhatsApp, schedule, summary, kb, conversation tools). The registry is the single source of truth for what tools exist, their schemas, sensitivity, and required permissions. |

---

### 2.5 MCP (Model Context Protocol)

| Field | Value |
|---|---|
| **Capability** | MCP integration — connect external MCP servers as tool sources |
| **Source path** | *(none — Clara has an `enableMcp` flag in `modules/rag/config.ts` but no standalone MCP runtime; see ISS-005)* |
| **Implementation entry point** | *(none)* |
| **Public API / contracts** | `enableMcp: boolean` flag in `RagConfig` (`modules/rag/config.ts`); no MCP client/server module in `clara-core/source/src/modules/` |
| **Dependencies** | n/a (flag only; no implementation) |
| **Adapter requirement** | **APP-SPECIFIC (future)** — MCP is out of scope for Phases 1-19. If/when Clara extracts an MCP runtime, this map is updated and MCP becomes ADAPTER. If business requirements demand MCP before Clara provides it, a new ADR (in `DECISIONS.md`) records the decision to build app-specifically. |
| **ai-comms-agent usage** | Not used in Phases 1-19. The `enableMcp` flag in Clara's RAG config is set to `false` (the default). |

---

### 2.6 RAG (Retrieval-Augmented Generation)

| Field | Value |
|---|---|
| **Capability** | RAG — grounding, retrieval, cross-lingual, diversify, turn guidance, query embedding cache |
| **Source path** | `modules/rag/` |
| **Implementation entry point** | `modules/rag/grounding.ts` → `groundResponse(retrievedContext, prompt)`; `modules/rag/turn-guidance.ts` → `buildTurnGuidance(context)` |
| **Public API / contracts** | `RagConfig` (`modules/rag/config.ts`), `RetrievedContext`, `GroundedPrompt`, `TurnGuidance` |
| **Dependencies** | `modules/ai-core/multilingual-embeddings.ts` (embeddings); `modules/admin/core/vector-store.ts` (Qdrant); `modules/rag/query-embedding-cache.ts` (cache); `modules/rag/cross-lingual.ts`, `diversify.ts`, `knowledge-topics.ts` |
| **Adapter requirement** | **ADAPTER** — host provides Qdrant connection (via Clara's `admin/core/vector-store.ts`) and a `RagAdapter` that maps agent KB bindings to Clara's `RagConfig`. The host does NOT reimplement grounding or retrieval. |
| **ai-comms-agent usage** | Phase 10 builds the RAG pipeline: email messages and KB documents are embedded (via Clara's `multilingual-embeddings.ts`) and stored in Qdrant (via Clara's `vector-store.ts`). Phase 11 uses `grounding.ts` and `turn-guidance.ts` for every agent turn that has RAG context. Cross-lingual search (Clara's `cross-lingual.ts`) is enabled for multi-language email corpora. |

---

### 2.7 Embeddings

| Field | Value |
|---|---|
| **Capability** | Multilingual embedding generation for text (email bodies, KB documents, queries) |
| **Source path** | `modules/ai-core/multilingual-embeddings.ts`, `modules/ai-core/providers/tei.ts` (Text Embeddings Inference provider) |
| **Implementation entry point** | `modules/ai-core/multilingual-embeddings.ts` → `embed(texts, model)` |
| **Public API / contracts** | `EmbeddingModel`, `EmbeddingResult`, `EmbeddingProvider` |
| **Dependencies** | `modules/ai-core/resolve.ts` (model resolution); `modules/ai-governance/core/usage-db.ts` (usage tracking); external embedding provider (OpenAI, Sarvam, or TEI) |
| **Adapter requirement** | **REUSE** — used directly. Host enqueues `embedding.generate` messages (per `EVENT-CONTRACTS.md §15`); the worker calls Clara's `embed()` directly. |
| **ai-comms-agent usage** | Phase 9 (`email.index` worker) and Phase 10 (KB ingest) use Clara's embeddings. Email messages are embedded on ingest; KB documents on upload. Query embeddings are cached via Clara's `query-embedding-cache.ts`. Models: OpenAI `text-embedding-3-small` (default), Sarvam (for Indian-language corpora), TEI (for self-hosted). |

---

### 2.8 Chat

| Field | Value |
|---|---|
| **Capability** | Chat — assistant config, language policy, streaming, conversation context |
| **Source path** | `modules/assistant/core/config.ts`, `modules/assistant/core/language-policy.ts`, `modules/assistant/api/conversation-context.ts`, `modules/embed/core/ndjson.ts` |
| **Implementation entry point** | `modules/assistant/core/config.ts` → `buildAssistantConfig(agentConfig)`; `modules/embed/core/ndjson.ts` → NDJSON stream helpers |
| **Public API / contracts** | `AssistantConfig`, `LanguagePolicy`, `ConversationContext`, `NDJSONEvent` |
| **Dependencies** | `modules/ai-core/` (provider calls); `modules/rag/` (grounding); `modules/ai-governance/` (usage) |
| **Adapter requirement** | **ADAPTER** — host wraps `AssistantConfig` builder with agent-config mapping; host wraps NDJSON stream with SSE transport (Next.js Route Handler). Language policy is reused directly. |
| **ai-comms-agent usage** | Phase 15 implements the chat experience. SSE stream (per `API-CONTRACTS.md §17`) wraps Clara's NDJSON events. Conversation context is persisted in `conversations` / `conversation_messages` (host-owned) and mapped to Clara's `ConversationContext` at turn start. Multi-turn memory uses Clara's context builder. |

---

### 2.9 Realtime voice

| Field | Value |
|---|---|
| **Capability** | Realtime voice — provider-neutral voice contracts, realtime identity, generation coordination, latency tracking, reconnect, UI state machine, metering |
| **Source path** | `modules/voice-core/` (types, config, factory, resolve, providers, metering) + `modules/voice-core/realtime/` (identity, generation-coordinator, latency-tracker, latency-log, reconnect-policy, ui-state-machine, relay-url) + `modules/voice-core/api/{gemini,sarvam,elevenlabs}/realtime-auth.ts` |
| **Implementation entry point** | `modules/voice-core/factory.ts` → `createVoiceProvider(config)`; `modules/voice-core/realtime/generation-coordinator.ts` → `GenerationCoordinator` |
| **Public API / contracts** | `VoiceProvider`, `VoiceProviderService`, `VoiceSession`, `VoiceCapability`, `RealtimeIdentity`, `LatencyStage`, `ReconnectPolicy`, `UIState` |
| **Dependencies** | `modules/ai-core/` (for chat-provider voice models, e.g., OpenAI Realtime); `modules/assistant/api/openai-realtime.ts` (OpenAI transport); `modules/assistant/api/*` (Gemini Live); `scripts/sarvam-wire.mjs` (Sarvam relay); external voice providers (OpenAI, Gemini, Sarvam, ElevenLabs) |
| **Adapter requirement** | **ADAPTER** — host provides: (1) `voice_sessions` table and persistence adapter; (2) short-lived session-token issuance endpoint (`/api/voice/session`); (3) browser-side voice client using Clara's `ui-state-machine.ts` and `reconnect-policy.ts`; (4) `voice.telemetry` worker that persists Clara's `LatencyStage` events to `voice_telemetry`. The host does NOT reimplement generation coordination, cancellation, or reconnect. |
| **ai-comms-agent usage** | Phase 16 implements voice mode. Detailed ownership boundary in `CLARA_VOICE_INTEGRATION.md`. Providers: OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs (per org config). Latency budgets: TTFA < 1.5s cold, < 800ms warm. |

> **Note on OpenAI/Gemini realtime:** Per `clara-core/AGENTS.md`, "OpenAI and Gemini realtime are transport/API-specific rather than standalone VoiceProviderService implementations. Do not invent provider classes merely for symmetry." We follow this rule — OpenAI realtime uses `modules/assistant/api/openai-realtime.ts`; Gemini Live uses `modules/assistant/api/*` + relay scripts; Sarvam uses `modules/voice-core/providers/sarvam.ts` + `scripts/sarvam-wire.mjs`; ElevenLabs uses `modules/voice-core/providers/elevenlabs.ts`.

---

### 2.10 Conversation state

| Field | Value |
|---|---|
| **Capability** | Conversation state — short-term context (recent turns), conversation lifecycle |
| **Source path** | `modules/assistant/api/conversation-context.ts` |
| **Implementation entry point** | `modules/assistant/api/conversation-context.ts` → `buildConversationContext(history, currentTurn)` |
| **Public API / contracts** | `ConversationContext`, `ConversationMessage`, `ConversationTurn` |
| **Dependencies** | `modules/assistant/core/config.ts`; host DB (for persisted conversation history) |
| **Adapter requirement** | **ADAPTER** — host persists conversations in `conversations` / `conversation_messages` / `conversation_turns` (per `DATA-MODEL.md §5`) and maps to Clara's `ConversationContext` at turn start. Long-term memory (KB entries) is also host-owned. |
| **ai-comms-agent usage** | Phase 15 (chat) and Phase 16 (voice) load recent turns (default 20) from PostgreSQL, map to Clara's `ConversationContext`, and pass to the runtime. Turn results are persisted back to `conversation_messages` and `conversation_turns`. |

---

### 2.11 Telemetry (voice + general)

| Field | Value |
|---|---|
| **Capability** | Telemetry — voice latency tracking/logging; general latency contracts |
| **Source path** | `modules/voice-core/realtime/latency-tracker.ts`, `modules/voice-core/realtime/latency-log.ts` |
| **Implementation entry point** | `modules/voice-core/realtime/latency-tracker.ts` → `LatencyTracker`; `modules/voice-core/realtime/latency-log.ts` → `LatencyLog` |
| **Public API / contracts** | `LatencyTracker`, `LatencyStage` (tfa, ttft, ttfa, total), `LatencyRecord`, `firstWinsLatencyMark()` |
| **Dependencies** | `modules/voice-core/realtime/identity.ts` (turn IDs); host persistence (for `voice_telemetry` table) |
| **Adapter requirement** | **ADAPTER** — host subscribes to Clara's `LatencyTracker` events and enqueues `voice.telemetry` messages (per `EVENT-CONTRACTS.md §16`); the `voice-telemetry` worker persists to `voice_telemetry`. The host does NOT reimplement latency tracking. |
| **ai-comms-agent usage** | Phase 16 wires the latency tracker. Per-turn telemetry (TFA, TTFT, TTFA, total) is recorded. Voice session-level aggregates (duration, turn count) are computed on session end. Surfaced in the voice telemetry dashboard (Phase 17). |

---

### 2.12 Usage tracking

| Field | Value |
|---|---|
| **Capability** | Usage tracking — per-call token/cost/latency accounting; entitlements; live catalog |
| **Source path** | `modules/ai-governance/core/usage-db.ts`, `modules/ai-governance/core/entitlements-db.ts`, `modules/ai-governance/core/live-catalog.ts`, `modules/ai-governance/core/types.ts`, `modules/voice-core/metering.ts` |
| **Implementation entry point** | `modules/ai-governance/core/usage-db.ts` → `recordUsage(event)`; `modules/voice-core/metering.ts` → `meterVoiceSession(session)` |
| **Public API / contracts** | `UsageEvent`, `Entitlement`, `LiveCatalogEntry`, `UsageFilter`, `UsageAggregate` |
| **Dependencies** | Host DB (Clara's `usage-db.ts` reads Clara's schema; host adapter writes to `ai_usage_events` — see note below) |
| **Adapter requirement** | **ADAPTER** — Clara's `usage-db.ts` reads Clara's schema; ai-comms-agent writes to its own `ai_usage_events` table (per `DATA-MODEL.md §9`) which mirrors Clara's `UsageEvent` shape. The host adapter translates between the two. Voice metering (`voice-core/metering.ts`) is reused directly; the host adapter persists its output. |
| **ai-comms-agent usage** | Phase 11 (chat usage) and Phase 16 (voice usage) record every AI/voice call. Per-org cost dashboards (Phase 17) aggregate from `ai_usage_events`. Quota admission uses Clara's `lib/quota-admission.ts`. Note: `lib/plan-guard.ts` is **not used** (SaaS billing — per `RULES.md §5`). |

---

### 2.13 Streaming events

| Field | Value |
|---|---|
| **Capability** | Streaming events — NDJSON event format for chat/realtime streaming |
| **Source path** | `modules/embed/core/ndjson.ts`, `modules/assistant/core/realtime-events.ts` |
| **Implementation entry point** | `modules/embed/core/ndjson.ts` → `serializeNDJSON(event)`, `parseNDJSON(line)`; `modules/assistant/core/realtime-events.ts` → `RealtimeEvent` union |
| **Public API / contracts** | `NDJSONEvent`, `RealtimeEvent` (token, tool_call, tool_result, turn_start, turn_end, error, etc.) |
| **Dependencies** | `modules/assistant/core/config.ts` |
| **Adapter requirement** | **ADAPTER** — host wraps NDJSON events in SSE transport for browser consumption (per `API-CONTRACTS.md §17`). The event shapes are reused directly; only the wire format changes (NDJSON over WebSocket → SSE over HTTP). |
| **ai-comms-agent usage** | Phase 15 (chat) and Phase 16 (voice) consume Clara's `RealtimeEvent` stream and re-emit as SSE events. The browser renders tokens, tool calls, and approvals inline. Cancellation is propagated via Clara's existing cancellation contracts (host sends cancel → Clara suppresses further events for that turn). |

---

### 2.14 Agent versioning (supporting capability)

| Field | Value |
|---|---|
| **Capability** | Agent versioning — draft/branch/version/deployment lifecycle, diff, projection |
| **Source path** | `modules/agent-versioning/core/` (types, service, diff, projection, db) |
| **Implementation entry point** | `modules/agent-versioning/core/service.ts` → `AgentVersionService`; `modules/agent-versioning/core/diff.ts` → `diffVersions(v1, v2)` |
| **Public API / contracts** | `AgentVersion`, `AgentDeployment`, `VersionDiff`, `VersionProjection` |
| **Dependencies** | Host DB (Clara's `db.ts` reads Clara's schema; host adapter wraps Supabase queries) |
| **Adapter requirement** | **ADAPTER** — host persists versions in `agent_versions` and deployments in `agent_deployments` (per `DATA-MODEL.md §2`). The host adapter maps between our schema and Clara's. Diff and projection logic is reused directly. |
| **ai-comms-agent usage** | Phase 11 implements agent versioning. Every config change creates a new version (immutable). Promoting a version to current creates a deployment. Diff view in the UI (Phase 15+) uses Clara's `diff.ts`. |

---

## 3. Summary table

| # | Capability | Decision | Adapter file (Phase 2+) |
|---|---|---|---|
| 2.1 | AI provider registry | ADAPTER | `apps/worker/src/adapters/ai-provider-registry.ts` |
| 2.2 | Model resolution | ADAPTER | `apps/worker/src/adapters/model-resolver.ts` |
| 2.3 | Agent runtime | ADAPTER | `apps/worker/src/adapters/agent-runtime.ts` |
| 2.4 | Tools | **APP-SPECIFIC** | `packages/shared/src/agent/registry.ts` (per `TOOL-CONTRACTS.md`) |
| 2.5 | MCP | **APP-SPECIFIC (future)** | *(out of scope Phases 1-19; see ISS-005)* |
| 2.6 | RAG | ADAPTER | `apps/worker/src/adapters/rag.ts` |
| 2.7 | Embeddings | REUSE | (used directly by `email.index` and KB ingest workers) |
| 2.8 | Chat | ADAPTER | `apps/web/lib/chat-adapter.ts` + `apps/worker/src/adapters/chat.ts` |
| 2.9 | Realtime voice | ADAPTER | `apps/web/lib/voice-client.ts` + `apps/worker/src/adapters/voice.ts` |
| 2.10 | Conversation state | ADAPTER | `apps/worker/src/adapters/conversation-context.ts` |
| 2.11 | Telemetry | ADAPTER | `apps/worker/src/adapters/voice-telemetry.ts` |
| 2.12 | Usage tracking | ADAPTER | `apps/worker/src/adapters/usage.ts` |
| 2.13 | Streaming events | ADAPTER | `apps/web/lib/sse-stream.ts` |
| 2.14 | Agent versioning | ADAPTER | `apps/worker/src/adapters/agent-versioning.ts` |

**Totals:** 1 REUSE, 12 ADAPTER, 1 APP-SPECIFIC (tools), 1 APP-SPECIFIC-future (MCP).

---

## 4. What Clara does NOT provide (and we build app-specifically)

Per the master operating prompt §4 and this map:

1. **Tools** — Clara has no standalone tool runtime (ISS-005). ai-comms-agent builds its own `ToolRegistry` per `TOOL-CONTRACTS.md`.
2. **MCP** — Clara has an `enableMcp` flag but no MCP runtime (ISS-005). MCP is out of scope for Phases 1-19.
3. **Email provider integration** (Gmail, IMAP/SMTP, Zoho) — Clara does not provide email. We build the `EmailProvider` adapter model per `EMAIL-PROVIDER-ARCHITECTURE.md` and `EMAIL_AGENT_ARCHITECTURE.md`.
4. **Messaging channel integration** (WhatsApp, future channels) — Clara does not provide messaging. We build the `MessagingChannel` abstraction per `MESSAGING_CHANNEL_ARCHITECTURE.md`.
5. **Scheduling** — Clara does not provide durable scheduled jobs. We build `scheduled_jobs` per `DATA-MODEL.md §6`.
6. **Automation rules** — Clara does not provide event-triggered automation. We build `automation_rules` per `DATA-MODEL.md §6`.
7. **Auth / RBAC / tenancy** — host-boundary concern per `clara-core/AGENTS.md §6`. We build per `SECURITY.md` and `SECURITY_MODEL.md`.
8. **Webhook receivers** — host-boundary concern. We build per `API-CONTRACTS.md §15`.
9. **Approval workflow** — application-specific policy engine per `AUTHORIZATION.md`.
10. **UI** — host-boundary concern. We build per `UI-UX.md`.

---

## 5. Phase 2 deep-audit checklist

Before Phase 2 implementation, the deep audit (per `CLARA-INTEGRATION.md §8` and `ISSUES.md ISS-002`) must:

1. Full clone of `Rilan-Dev/ai-reusable-libraries` (not depth-1).
2. Run `clara-core/scripts/verify-extraction.mjs` — validate the immutable extraction manifest.
3. Read every file referenced in this map's "Source path" and "Implementation entry point" columns.
4. Validate that the "Public API / contracts" entries match Clara's actual exports (signatures, types).
5. Validate the ISS-005 finding (no standalone MCP/tool runtime) against the full clone — re-check `clara-core/source/src/modules/` for any `tools/` or `mcp/` directory that the depth-1 clone might have missed.
6. Identify any Clara files with hidden coupling (e.g., `doable-source/AI_RAG_ARCHITECTURE.md` notes that `engine-resolver.ts` directly imports Doable SQL — these need adapter wrapping, not direct use).
7. Update this map with any corrections from the audit.
8. Record audit results in `worklog.md` and `VERIFICATION_STATE.md`.

The deep audit is a Phase 2 task (or earlier if ChatGPT directs). Until it completes, this map is the **planning baseline** — actual import statements in Phase 2+ code are validated against the audit results.
