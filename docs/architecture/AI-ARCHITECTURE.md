# AI-ARCHITECTURE.md — Agent Runtime, Tool Registry, and Pipeline

This document defines the AI architecture: the agent runtime, the tool registry, the pipeline that every request flows through, and the integration with Clara's `ai-core`, `ai-governance`, `agent-versioning`, `rag`, and `voice-core` modules.

The core principle (per the master operating prompt §10) is: **one agent runtime, one tool registry, three input surfaces**. Chat, voice, and WhatsApp are transport adapters — they normalize input into a common `AgentRequest` and route it through the same `intent → context → policy → authorization → execution → audit` pipeline. Three separate agent implementations are prohibited.

---

## 1. Pipeline

```text
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │  Chat (web)     │     │  Voice (realtime)│     │  WhatsApp       │
   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
            │                       │                       │
            └───────────┬───────────┴───────────┬───────────┘
                        ▼                       ▼
                  ┌─────────────────────────────────────┐
                  │  AgentRequest normalizer             │
                  │  (intent, context, auth subject,     │
                  │   audit metadata, transport hints)   │
                  └────────────────┬────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  1. Intent classification  (LLM-assisted, deterministic│
       │     intent taxonomy — no free-form intents)            │
       └───────────────────────────────────────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  2. Context assembly                                     │
       │     - agent config (version, prompts, KB bindings)      │
       │     - conversation history (recent turns)               │
       │     - RAG retrieval (Clara grounding, Qdrant-backed)    │
       │     - tool capability set                                │
       └───────────────────────────────────────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  3. Policy evaluation  (deterministic, not LLM)         │
       │     - intent → required permission                      │
       │     - subject → has permission?                         │
       │     - intent → safe / sensitive classification          │
       │     - per-organization policy overrides                 │
       └───────────────────────────────────────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  4. Authorization                                       │
       │     - safe: proceed                                      │
       │     - sensitive: check approval policy                  │
       │       (auto-approve / always-ask / never-allow)         │
       │     - if always-ask: create email_action_approval,     │
       │       pause, return approval prompt to user            │
       └───────────────────────────────────────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  5. Tool execution  (via Tool Registry)                 │
       │     - LLM proposes tool calls                            │
       │     - registry validates against allowed-tools          │
       │     - tools execute in bounded sandbox                  │
       │     - results fed back to LLM for next turn             │
       └───────────────────────────────────────────────────────┘
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │  6. Audit                                               │
       │     - append audit_events with correlation_id           │
       │     - record ai_usage_events (tokens, latency, cost)    │
       │     - record tool_call audit                            │
       │     - emit observability traces                         │
       └───────────────────────────────────────────────────────┘
                                   ▼
                  ┌──────────────────────────────┐
                  │  Response (streamed SSE /     │
                  │  WhatsApp message / voice)    │
                  └──────────────────────────────┘
```

---

## 2. AgentRequest shape

Every input surface produces the same `AgentRequest`:

```typescript
type AgentRequest = {
  agent_id: string;
  organization_id: string;
  user_id: string | null;         // null for system/scheduled
  channel: 'chat' | 'voice' | 'whatsapp' | 'schedule';
  transport_metadata: {
    conversation_id?: string;
    voice_session_id?: string;
    whatsapp_contact_id?: string;
    scheduled_job_id?: string;
    stream_id?: string;            // SSE stream id for chat
  };
  user_text: string;               // transcribed for voice
  attachments?: Attachment[];      // for future use
  auth_subject: {
    user_id: string | null;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    permissions: string[];         // resolved RBAC
  };
  audit: {
    correlation_id: string;
    request_id: string;
    started_at: number;
  };
};
```

The transport adapter is responsible for producing this shape. The runtime never sees raw channel-specific data.

---

## 3. Intent taxonomy

Intents are deterministic, not free-form. The LLM classifies a user's text into one of the known intents; if it cannot classify with confidence above a threshold, the runtime asks for clarification.

Initial intent set:

| Intent | Description | Sensitivity |
|---|---|---|
| `summarize_emails` | Summarize a time range or scope | safe |
| `find_emails` | Search emails by person, topic, date | safe |
| `classify_emails` | Mark importance / action-required | safe |
| `extract_information` | Extract dates, contacts, deadlines from emails | safe |
| `draft_email` | Create a draft (not sent) | safe |
| `draft_reply` | Create a reply draft (not sent) | safe |
| `send_email` | **Send an email** | **sensitive** |
| `forward_email` | **Forward an email** | **sensitive** |
| `delete_email` | **Delete an email** | **sensitive** |
| `bulk_modify` | **Bulk read/unread/label/archive** | **sensitive** |
| `send_whatsapp_message` | **Send an outbound WhatsApp message** | **sensitive** |
| `create_schedule` | Create a scheduled job | safe (but creates durable state) |
| `list_schedules` | List scheduled jobs | safe |
| `cancel_schedule` | Cancel a scheduled job | safe (but mutates durable state) |
| `general_qa` | General question (uses RAG) | safe |

New intents are added via an explicit architecture decision (record in `DECISIONS.md`), not by LLM improvisation.

---

## 4. Tool registry

The tool registry is the single source of truth for what tools exist, what they do, and what authorization they require. Tools are grouped by domain.

### 4.1 Email tools

- `email.read(account_id, query, options)` — read/search emails. Safe.
- `email.classify(account_id, message_ids)` — compute importance/action-required. Safe.
- `email.summarize(message_ids)` — generate a summary. Safe.
- `email.extract(message_ids, fields)` — extract structured information. Safe.
- `email.draft(account_id, params)` — create a draft (not sent). Safe.
- `email.draft_reply(message_id, params)` — create a reply draft. Safe.
- `email.send(draft_id or params)` — **send**. Sensitive.
- `email.forward(message_id, to)` — **forward**. Sensitive.
- `email.delete(message_id)` — **delete**. Sensitive.
- `email.modify(account_id, message_ids, op)` — bulk read/unread/label/archive. Sensitive (when count > threshold).
- `email.list_folders(account_id)` — list folders/labels. Safe.
- `email.list_accounts(agent_id)` — list connected accounts. Safe.

### 4.2 WhatsApp tools

- `whatsapp.send(agent_id, contact, message)` — **send outbound**. Sensitive.
- `whatsapp.history(agent_id, contact, limit)` — read conversation history. Safe.

### 4.3 Schedule tools

- `schedule.create(agent_id, cron, intent, params)` — create a scheduled job. Safe.
- `schedule.list(agent_id)` — list. Safe.
- `schedule.cancel(job_id)` — cancel. Safe.

### 4.4 Summary tools

- `summary.generate(scope, period)` — generate a summary. Safe.

### 4.5 Knowledge / RAG tools

- `kb.search(query, options)` — semantic search via Clara RAG. Safe.
- `kb.list(agent_id)` — list bound KBs. Safe.

### 4.6 Conversation tools

- `conversation.history(conversation_id, limit)` — read conversation. Safe.

### 4.7 Tool contract

Every tool has:

```typescript
type Tool = {
  name: string;
  description: string;            // for the LLM
  input_schema: JSONSchema;       // for LLM function-calling
  sensitivity: 'safe' | 'sensitive';
  required_permission: string;    // e.g., 'email.send'
  capability?: string;            // provider capability required (for email tools)
  execute: (input, context) => Promise<ToolResult>;
};
```

The LLM proposes a tool call; the registry validates `required_permission` against the auth subject's permissions **and** `sensitivity` against the policy engine **before** executing.

---

## 5. Policy engine (deterministic, not LLM)

The policy engine is a deterministic function: `(intent, auth_subject, target, organization_policy) → decision`. It runs after intent classification and before tool execution. The LLM **never** decides whether a sensitive action is authorized.

Per-organization policy overrides are stored in `organizations.policy_jsonb` (added to `organizations` in Phase 4):

```json
{
  "sensitive_actions": {
    "email.send": "always_ask",
    "email.forward": "always_ask",
    "email.delete": "never_allow",
    "whatsapp.send": "auto_approve_for_known_contacts"
  }
}
```

Decision values: `auto_approve`, `always_ask`, `never_allow`, `auto_approve_with_conditions`.

If `always_ask`, the runtime creates an `email_actions` row with status `pending_approval`, returns an approval prompt to the user, and pauses. The user approves or rejects in the UI; the runtime then executes or rejects.

---

## 6. Clara integration (recap)

Detailed in `CLARA-INTEGRATION.md`. Summary:

- **`ai-core`** — provider/model resolution, governance. We use `resolve.ts`, `factory.ts`, `providers/{openai,gemini,sarvam,tei}.ts` directly.
- **`ai-governance`** — usage tracking, entitlements, quota. We use `usage-db.ts`, `entitlements-db.ts`, `live-catalog.ts` directly.
- **`agent-versioning`** — version/diff/projection. We use `service.ts`, `diff.ts`, `projection.ts` directly.
- **`rag`** — grounding, retrieval, cross-lingual, diversify, turn guidance. We use all `rag/*` modules directly.
- **`knowledge-bases`** — KB contracts. We use `core/*` directly; the host adapter wraps Supabase-specific DB access.
- **`voice-core`** — realtime voice. Detailed in `REALTIME-VOICE-ARCHITECTURE.md`.
- **`embed`** — public embed runtime. Used for the public agent endpoint (if/when exposed).
- **Host adapters** — identity/tenancy, secrets, HTTP/Next.js handlers, vendor webhooks. These are application-specific.

---

## 7. Streaming and cancellation

Chat uses SSE (Server-Sent Events) for streaming. Each turn has a `stream_id`; the client can send a cancel message which propagates to the LLM provider via Clara's existing cancellation contracts.

Voice uses Clara's realtime transport (`voice-core/realtime/generation-coordinator.ts`), which handles stale-generation protection and concurrent generation. The voice transport adapter wraps this; the agent runtime sees a normal `AgentRequest`/`AgentResponse` cycle.

WhatsApp has no streaming — responses are segmented into message-sized chunks and sent sequentially.

---

## 8. Context window and memory

- **Short-term context**: the last N turns of the conversation (configurable per agent, default 20).
- **RAG context**: retrieved via Clara's `rag/grounding.ts` from Qdrant. Up to K chunks (default 8) per turn.
- **Long-term memory**: optional, per-agent. Stored as KB entries via the `kb.search` tool. Not auto-populated; users explicitly mark summaries for memory.
- **Tool results**: included in context for the same turn. Truncated if they exceed a per-tool budget.

The context budget is enforced by Clara's existing turn-guidance and quota-admission modules.

---

## 9. Model selection

Per-agent model selection uses Clara's `ai-core/resolve.ts` against `agent_ai_settings` and `ai_provider_configs`. Resolution order:

1. Agent-level override (if set in `agent_ai_settings.model_overrides`)
2. Organization-level default (in `ai_provider_configs` for the chosen provider)
3. Platform default (in a `platform_defaults` table, populated in Phase 4)

Voice model selection follows the same pattern but uses `voice-core/resolve.ts` against voice-specific config.

---

## 10. Failure modes

- **LLM unavailable / rate-limited**: fail closed for sensitive operations, fail open with a fallback message for safe operations.
- **Tool execution failure**: report to LLM; LLM may retry with adjusted parameters or report to user. After 3 retries, give up and audit.
- **Policy engine failure**: fail closed. No execution without a positive decision.
- **Authorization pause (always_ask)**: pause indefinitely; user must approve or reject. Auto-expire after 7 days.
- **RAG retrieval failure**: continue without RAG context; flag in audit.
- **Clara provider failure**: surface as a structured error to the LLM; LLM may choose an alternate provider if configured (Clara's `resolve.ts` supports fallback).

---

## 11. What is NOT in this architecture

- No prompt-chaining or multi-agent orchestration in Phase 1 scope. Single-agent per request.
- No autonomous background agents (beyond scheduled jobs, which are explicitly user-configured).
- No agent-to-agent communication.
- No LLM-driven intent creation. Intents are deterministic.
- No LLM-driven authorization. The policy engine is deterministic.

These constraints are deliberate. They may be relaxed in a future phase, but only via an explicit architecture decision in `DECISIONS.md`.
