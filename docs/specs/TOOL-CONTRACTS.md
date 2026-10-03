# TOOL-CONTRACTS.md — Agent Tool Registry Contracts

This document defines the agent tool registry: the contract every tool satisfies, the tool catalogue (initial set), and the runtime semantics (safety classification, authorization, execution). Per the master operating prompt §10, the same agent tools must be usable from web chat, realtime voice, and WhatsApp — three separate agent implementations are prohibited.

This is a Phase 1 document. Exact tool implementations are produced in Phase 11 (Agent runtime + tools + authorization).

---

## 1. Tool contract

Every tool in the registry satisfies this contract:

```typescript
// packages/shared/src/agent/tool.ts

export type ToolSensitivity = 'safe' | 'sensitive';

export interface Tool<I = any, O = any> {
  // Identity
  name: string;                          // e.g., 'email.read'
  domain: 'email' | 'whatsapp' | 'schedule' | 'summary' | 'kb' | 'conversation';
  description: string;                   // for the LLM (concise, action-oriented)

  // Schema (for LLM function-calling)
  input_schema: JSONSchema;              // JSON Schema for the tool's input

  // Authorization
  sensitivity: ToolSensitivity;
  required_permission: string;           // e.g., 'email.read', 'email.send'
  required_capability?: string;          // for email tools — capability that must be present

  // Execution
  execute: (input: I, context: ToolContext) => Promise<ToolResult<O>>;

  // Optional metadata
  timeout_ms?: number;                   // default 30s; per-tool override
  retryable?: boolean;                   // default false; true for idempotent read tools
  idempotent?: boolean;                  // for safe retries
}

export interface ToolContext {
  agent_id: string;
  organization_id: string;
  user_id: string | null;
  conversation_id: string;
  turn_id: string;
  correlation_id: string;
  channel: 'chat' | 'voice' | 'whatsapp' | 'schedule';
  auth_subject: {
    user_id: string | null;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    permissions: string[];
  };
}

export interface ToolResult<O = any> {
  ok: boolean;
  output?: O;
  error?: { code: string; message: string; retryable: boolean };
  audit: {
    tool_name: string;
    input_summary: string;               // truncated, PII-redacted
    output_summary: string;              // truncated, PII-redacted
    duration_ms: number;
    provider_calls?: ProviderCallSummary[];
  };
}
```

---

## 2. Tool registry

```typescript
// packages/shared/src/agent/registry.ts

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | null;
  list(domain?: Tool['domain']): Tool[];
  listForAgent(agent_id: string): Tool[];   // filtered by agent's allowed-tools config
  validate(toolName: string, input: any): { valid: boolean; errors?: string[] };
}
```

The registry is populated at startup from a static catalogue (below). Tools are not dynamically registered at runtime — adding a tool is a code change.

The agent runtime uses the registry to:
1. List tools for the LLM (filtered by agent's allowed-tools config).
2. Validate LLM-proposed tool calls against `input_schema`.
3. Check `required_permission` against the auth subject's permissions.
4. Check `sensitivity` against the policy engine.
5. Check `required_capability` against the email account's capabilities (for email tools).
6. Execute the tool with a `ToolContext`.
7. Persist the `audit` block to `audit_events`.

---

## 3. Tool catalogue (initial set)

### 3.1 Email tools (domain: `email`)

| Name | Sensitivity | Required permission | Required capability | Description |
|---|---|---|---|---|
| `email.read` | safe | `email.read` | (none — uses search) | Read/search emails by query (sender, subject, date, label, full-text, semantic) |
| `email.classify` | safe | `email.read` | (none) | Compute importance/action-required scores for a set of messages |
| `email.summarize` | safe | `email.read` | (none) | Generate a summary for a set of messages or a thread |
| `email.extract` | safe | `email.read` | (none) | Extract structured fields (dates, contacts, deadlines, action items) from messages |
| `email.draft` | safe | `email.write` | `drafts` | Create a draft (not sent) |
| `email.draft_reply` | safe | `email.write` | `drafts`, `reply` | Create a reply draft (not sent) |
| `email.send` | **sensitive** | `email.send` | `send` | **Send an email** (requires authorization) |
| `email.forward` | **sensitive** | `email.send` | `forward` | **Forward an email** (requires authorization) |
| `email.delete` | **sensitive** | `email.delete` | (none — uses `move` to Trash) | **Delete an email** (requires authorization) |
| `email.modify_bulk` | **sensitive** | `email.modify_bulk` | `mark_read` / `archive` / `move` / `labels` | Bulk read/unread/archive/move/label (requires authorization when count > threshold) |
| `email.list_folders` | safe | `email.read` | `folders` | List folders/labels for an account |
| `email.list_accounts` | safe | `email.read` | (none) | List email accounts connected to the agent |

### 3.2 WhatsApp tools (domain: `whatsapp`)

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `whatsapp.send` | **sensitive** | `whatsapp.send` | **Send an outbound WhatsApp message** (requires authorization; template compliance enforced) |
| `whatsapp.history` | safe | `whatsapp.read` | Read conversation history with a contact |

### 3.3 Schedule tools (domain: `schedule`)

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `schedule.create` | safe | `schedule.write` | Create a scheduled job (durable) |
| `schedule.list` | safe | `schedule.read` | List scheduled jobs for the agent |
| `schedule.cancel` | safe | `schedule.write` | Cancel a scheduled job |

### 3.4 Summary tools (domain: `summary`)

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `summary.generate` | safe | `email.read` | Generate a summary for a scope/period |

### 3.5 Knowledge / RAG tools (domain: `kb`)

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `kb.search` | safe | `kb.read` | Semantic search via Clara RAG (Qdrant-backed) |
| `kb.list` | safe | `kb.read` | List KBs bound to the agent |

### 3.6 Conversation tools (domain: `conversation`)

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `conversation.history` | safe | `agent.read` | Read conversation history |

---

## 4. Tool execution flow

```text
LLM proposes tool call: { name, input }
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 1. Registry lookup (get tool by name)                  │
│    - if not found: return structured error to LLM      │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 2. Schema validation (input vs tool.input_schema)      │
│    - if invalid: return structured error to LLM        │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 3. Permission check (auth_subject.permissions          │
│    includes tool.required_permission?)                  │
│    - if not: return "permission denied" error to LLM;  │
│      audit the denial                                  │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 4. Capability check (for email tools — read            │
│    email_accounts.capabilities for the target account) │
│    - if unsupported: return CapabilityNotSupported     │
│      error to LLM                                      │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 5. Sensitivity check (tool.sensitivity)                │
│    - if 'safe': proceed to execution                   │
│    - if 'sensitive': invoke policy engine              │
│      (see AUTHORIZATION.md)                            │
│        - auto_approve: proceed                         │
│        - always_ask: create email_action_approval,     │
│          return approval prompt to user, pause turn    │
│        - never_allow: return "not allowed" error to    │
│          LLM; audit the refusal                        │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 6. Execute (call tool.execute(input, context))         │
│    - enforce timeout_ms                                │
│    - on retryable error and tool.retryable: retry      │
│      with backoff (max 3)                              │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 7. Audit (persist tool.audit block to audit_events)    │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 8. Return ToolResult to LLM for next turn              │
└────────────────────────────────────────────────────────┘
```

---

## 5. Tool input schema (example)

Example: `email.read`

```json
{
  "name": "email.read",
  "description": "Search and read emails from a connected account. Supports filtering by sender, subject, date range, label, and free-text query. Returns up to 50 results by default.",
  "input_schema": {
    "type": "object",
    "properties": {
      "account_id": { "type": "string", "format": "uuid", "description": "Email account ID. Use email.list_accounts to find." },
      "query": {
        "type": "object",
        "properties": {
          "from": { "type": "string", "description": "Sender email or name substring" },
          "subject": { "type": "string" },
          "date_from": { "type": "string", "format": "date-time" },
          "date_to": { "type": "string", "format": "date-time" },
          "label": { "type": "string" },
          "folder": { "type": "string" },
          "text": { "type": "string", "description": "Full-text search query" },
          "semantic": { "type": "string", "description": "Semantic search query (uses embeddings)" }
        },
        "additionalProperties": false
      },
      "limit": { "type": "integer", "minimum": 1, "maximum": 200, "default": 50 }
    },
    "required": ["account_id", "query"],
    "additionalProperties": false
  },
  "sensitivity": "safe",
  "required_permission": "email.read"
}
```

The LLM sees this schema (without the `sensitivity` and `required_permission` fields, which are runtime-only) and can propose calls. The runtime validates and executes.

---

## 6. Tool result format

Tool results returned to the LLM are truncated and PII-redacted:

```json
{
  "ok": true,
  "output": {
    "messages": [
      {
        "id": "uuid",
        "from": "alice@example.com",
        "subject": "Project update",
        "snippet": "Hi, just wanted to update you on...",
        "received_at": "2026-10-03T10:00:00Z",
        "importance_score": 0.85,
        "action_required": true
      }
    ],
    "total": 1
  }
}
```

For large results, the LLM gets a summary + a cursor to fetch more. Full email bodies are not sent to the LLM unless the LLM explicitly asks (via a separate `email.get_body` tool — added in a later phase if needed).

---

## 7. Adding new tools

Adding a tool requires:

1. Implement the `Tool` interface (new file in `packages/shared/src/agent/tools/`).
2. Register it in the static catalogue.
3. Add the corresponding `permission` to the permissions catalogue.
4. Add tests (allowed path, denied path, capability-missing path).
5. Update this document.
6. Update `AI-ARCHITECTURE.md` if the tool introduces a new intent.
7. ChatGPT review.

Tools are not added silently. Every new tool is an architectural decision (record in `DECISIONS.md`).

---

## 8. Tool versioning

Tools are versioned with the agent (per `agent_versions.config.tools`). If a tool's schema changes, old agent versions continue using the old schema; new versions use the new schema. This requires tool implementations to support multiple schema versions — managed via a `tool_versions` table (Phase 11).

For Phase 1, the catalogue above is the v1 shape.
