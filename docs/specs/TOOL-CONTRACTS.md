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

---

## 8. Email tool contract inventory (EMAIL-OPS-01)

The current shared source exports `EMAIL_TOOL_CATALOG` and `listEmailToolDescriptors()` from `packages/shared/src/agent/mail-operations.ts` and `packages/shared/src/index.ts`. The inventory covers account/capability discovery, folders/labels, paginated message reads, thread reads, search, sync status, drafts, reply/forward draft intent, read/archive/move/label actions, attachment metadata/download, summaries, trash, and bounded bulk operations. Sensitive send/reply/forward descriptors remain withheld until their executable approval-safe handlers are registered.

Each descriptor includes a JSON Schema, permission name, sensitivity, channel list, required provider capabilities, optional alternative capabilities, and whether the policy engine is required. The helper filters against the connected account's *actual capability set* and an optional agent allowlist.

**Important status boundary:** these descriptors are contract metadata, not executable tool handlers. They must not be sent to a model or invoked as if implemented until the host runtime has registered the corresponding service handler and passed execution-time organization, agent, account, permission, capability, policy, approval, idempotency, and audit checks. A catalogue entry does not prove provider support. Chat, realtime voice, WhatsApp and scheduled execution must reuse one host registry and one service path.

Gmail reply and forward capability flags are deliberately fail-closed while thread-aware RFC reply/forward semantics are incomplete. Re-enable them only after implementation and adapter contract tests prove the operation. A generic draft capability is not proof that a provider can construct a correct reply/forward draft.

## 9. Shared registry implementation status

`packages/shared/src/agent/registry.ts` now provides a provider-neutral registry with duplicate-registration rejection, tool lookup/listing, agent allowlist filtering, and validation for the JSON Schema subset used by current tool descriptors. A missing agent allowlist fails closed and exposes no tools.

The registry is **not** the full execution security boundary: it does not itself invoke handlers, resolve an email account, prove the agent/account binding, evaluate the approval policy, or persist audit events. Read-only handlers exist in `apps/worker/src/agent/email-read-tools.ts`; they recheck the organization/agent/account binding and return bounded outputs with audit summaries. `apps/worker/src/agent/email-tool-runtime.ts` loads the persisted agent allowlist, creates an agent-scoped registry, supplies account/capability authorization, and writes sanitized tool-call audit events through the DB audit repository. `apps/worker/src/agent/tool-executor.ts` requires the authorizer and audit writer and fails closed on denial or audit failure. These helpers are not yet called by the actual chat/realtime voice/WhatsApp/scheduled transport pipeline. Do not expose tools to a model until the transport uses this shared path and the cross-agent context isolation issue ISS-026 is fixed by FIX-01.


## 10. Native provider tool-call adapter and bounded worker loop (2026-10-13)

The Clara boundary now has provider-neutral tool-call types and `claraRuntime.completeWithTools(ctx, messages, tools)`. OpenAI-compatible calls serialize assistant tool-call history into the provider wire shape; Gemini uses functionCall/functionResponse parts. Malformed OpenAI tool arguments fail closed. Sarvam tool calling deliberately throws an explicit unsupported error until its behavior is verified.

`apps/worker/src/agent/email-agent-loop.ts` uses only tools actually registered and allowlisted for the agent, creates a bounded 4-round / 8-call loop, validates trusted tenant/agent identity, invokes every model-emitted tool name through the shared executor (including unknown names so denials reach durable audit), caps tool result text, and marks results as untrusted data. The bounded loop is now connected to interactive web chat for registered, allowlisted email read tools and WhatsApp history. Realtime voice, inbound WhatsApp conversation turns, and scheduled execution are not yet connected to this host invocation path.

Do not send contract-only catalogue entries to the model. Currently registered handlers are read-only. Drafts, mutation, attachment, and send descriptors are not executable. The runtime still needs execution-time allowlist/policy refresh, all-of/any-of capability enforcement for future multi-capability tools, cancellation/timeouts, token-aware output limits, and live provider contract evidence. ISS-026 remains FIX-01-owned and blocks safe chat transport integration.

Source tests were added but not run. No typecheck/build/provider/database/runtime/CI/deployment PASS is claimed.


### Authorization follow-up — 2026-10-13

`email-tool-runtime.ts` now re-reads the persisted agent allowlist during each invocation and applies all-of/any-of capability checks from the canonical `EMAIL_TOOL_CATALOG` descriptor for account-scoped calls. This is still source-only: add tests for allowlist revocation between tool calls, missing one required capability, and no supported any-capability alternative. Keep contract-only tools hidden until these checks and transport wiring are verified.


## 11. Interactive chat host loop and WhatsApp outbound approval — 2026-10-17

Interactive chat now builds its `ToolContext` from the authenticated server subject and invokes only registered tools from the per-agent email/WhatsApp registries. It bounds execution to four rounds and eight calls, caps tool-result serialization, and writes each invocation through the shared audited executor. The route does not trust model-supplied tenant, actor, role, or permissions.

WhatsApp outbound API proposals persist to `whatsapp_send_actions`. Authenticated organization-update users can approve/reject them. Text proposals are queued only after a fresh account check and evidence of an inbound customer message within 24 hours. Outside that window the action is marked `requires_template` and no free-form text is sent. Approved template submission/status synchronization and template delivery are not implemented yet, so `whatsapp.send` remains unregistered and must not be advertised to the model.

Source-only state: no test/typecheck/build/migration/Meta/browser/deployment verification has been performed for this checkpoint.
