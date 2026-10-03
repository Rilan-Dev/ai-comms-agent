# EVENT-CONTRACTS.md — Queue Message Schemas

This document defines the schemas for every RabbitMQ message in the system. It is the canonical reference for producers and consumers. Per `EVENTS-AND-QUEUES.md`, every message shares a common envelope; this document specifies the `payload` shape per queue.

This is a Phase 1 document. Exact TypeScript types are validated in Phase 4 (database foundation) and Phase 9 (sync workers).

---

## 1. Common envelope

Every message has the envelope defined in `EVENTS-AND-QUEUES.md §3`:

```typescript
type Message<T> = {
  id: string;
  correlation_id: string;
  idempotency_key: string;
  routing_key: string;
  producer: string;
  consumer: string;
  attempt_count: number;
  max_attempts: number;
  enqueued_at: string;
  available_at: string;
  payload: T;
};
```

This document specifies `T` for each queue.

---

## 2. `email.sync`

```typescript
type EmailSyncPayload = {
  account_id: string;            // uuid
  history_id?: string;           // Gmail historyId; omit for full sync
  refresh?: boolean;             // if true, refresh OAuth token first
  triggered_by: 'webhook' | 'poll' | 'manual' | 'refresh';
};
```

- **Producer**: API webhook handlers (`api.webhook.gmail`, `api.webhook.zoho`), scheduled poller (`worker.cron.email-poll`), manual UI trigger (`api.email.sync-now`)
- **Consumer**: `worker.email-sync`
- **Idempotency key**: `{account_id}:{history_id or 'full'}`
- **Max attempts**: 5

---

## 3. `email.parse`

```typescript
type EmailParsePayload = {
  message_id: string;            // uuid — email_messages.id
};
```

- **Producer**: `email.sync` consumer
- **Consumer**: `worker.email-parse`
- **Idempotency key**: `{message_id}`
- **Max attempts**: 5

---

## 4. `email.index`

```typescript
type EmailIndexPayload = {
  message_id: string;            // uuid
};
```

- **Producer**: `email.parse` consumer
- **Consumer**: `worker.email-index` (uses Clara's `knowledge-bases/core/embedding-index.ts`)
- **Idempotency key**: `{message_id}`
- **Max attempts**: 5

---

## 5. `email.attachments`

```typescript
type EmailAttachmentsPayload = {
  message_id: string;            // uuid
  attachment_id: string;         // uuid — email_attachments.id
};
```

- **Producer**: `email.parse` consumer
- **Consumer**: `worker.email-attachments`
- **Idempotency key**: `{message_id}:{attachment_id}`
- **Max attempts**: 5

---

## 6. `email.classify`

```typescript
type EmailClassifyPayload = {
  message_id: string;            // uuid
};
```

- **Producer**: `email.parse` consumer
- **Consumer**: `worker.email-classify`
- **Idempotency key**: `{message_id}`
- **Max attempts**: 3

---

## 7. `email.draft`

```typescript
type EmailDraftPayload = {
  agent_id: string;              // uuid
  account_id: string;            // uuid
  draft_params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body_text: string;
    body_html?: string;
    reply_to_message_id?: string;   // uuid — for replies
    forward_of_message_id?: string; // uuid — for forwards
  };
  conversation_id: string;       // uuid
  turn_id: string;               // uuid
};
```

- **Producer**: agent runtime (when intent is `draft_email` or `draft_reply`)
- **Consumer**: `worker.email-draft`
- **Idempotency key**: `{agent_id}:{hash(draft_params)}`
- **Max attempts**: 5

---

## 8. `email.send`

```typescript
type EmailSendPayload = {
  action_id: string;             // uuid — email_actions.id (after approval)
  draft_id?: string;             // uuid — email_messages.id (if sending a draft)
  send_params?: {                // if sending inline (no draft)
    account_id: string;
    to: string[];
    cc?: string[];
    subject: string;
    body_text: string;
    body_html?: string;
  };
};
```

- **Producer**: agent runtime (after authorization for `send_email`)
- **Consumer**: `worker.email-send`
- **Idempotency key**: `{action_id}` — strictly one send per approved action
- **Max attempts**: 5

---

## 9. `email.action`

```typescript
type EmailActionPayload = {
  action_id: string;             // uuid — email_actions.id
};
```

Used for bulk modify, delete, forward (after authorization). The worker reads `email_actions` to determine the action type and parameters.

- **Producer**: agent runtime (after authorization for non-send sensitive actions)
- **Consumer**: `worker.email-action`
- **Idempotency key**: `{action_id}`
- **Max attempts**: 5

---

## 10. `whatsapp.inbound`

```typescript
type WhatsappInboundPayload = {
  whatsapp_account_id: string;   // uuid
  provider_event_id: string;     // Meta's message id (unique)
  raw_event: object;             // full webhook payload (for audit/forensics)
};
```

- **Producer**: API webhook handler (`api.webhook.whatsapp`)
- **Consumer**: `worker.whatsapp-inbound`
- **Idempotency key**: `{provider_event_id}`
- **Max attempts**: 5

---

## 11. `whatsapp.outbound`

```typescript
type WhatsappOutboundPayload = {
  agent_id: string;              // uuid
  contact_phone: string;         // E.164
  message:
    | { type: 'text'; body: string }
    | { type: 'template'; name: string; language: string; parameters: any[] }
    | { type: 'media'; media_type: 'image' | 'audio' | 'document'; media_url: string; caption?: string };
  conversation_id?: string;      // uuid — if part of a conversation
  reply_to_provider_message_id?: string;
};
```

- **Producer**: agent runtime (reply), scheduled job, automation
- **Consumer**: `worker.whatsapp-outbound`
- **Idempotency key**: `{agent_id}:{contact_phone}:{hash(message)}`
- **Max attempts**: 5

---

## 12. `agent.schedule`

```typescript
type AgentSchedulePayload = {
  scheduled_job_id: string;      // uuid
  fire_at: string;               // ISO 8601 — the scheduled fire time
};
```

- **Producer**: cron loop (`worker.cron`)
- **Consumer**: `worker.agent-schedule`
- **Idempotency key**: `{scheduled_job_id}:{fire_at}` — strictly one execution per fire
- **Max attempts**: 3

---

## 13. `agent.execute`

```typescript
type AgentExecutePayload = {
  agent_id: string;              // uuid
  conversation_id: string;       // uuid
  turn_id: string;               // uuid
  request: AgentRequest;         // the full AgentRequest (per AI-ARCHITECTURE.md §2)
};
```

- **Producer**: `agent.schedule` consumer, `whatsapp.inbound` consumer, automation runner
- **Consumer**: `worker.agent-execute`
- **Idempotency key**: `{conversation_id}:{turn_id}`
- **Max attempts**: 3

---

## 14. `summary.generate`

```typescript
type SummaryGeneratePayload = {
  agent_id: string;              // uuid
  scope: 'daily' | 'custom' | 'on_demand';
  period_start: string;          // ISO 8601
  period_end: string;            // ISO 8601
  conversation_id?: string;      // uuid — if requested from a conversation
  scheduled_job_id?: string;     // uuid — if triggered by a schedule
  delivery?: {
    channel: 'whatsapp' | 'email' | 'in_app';
    target?: string;             // phone number or email
  };
};
```

- **Producer**: agent runtime (intent `summarize_emails`), scheduled job
- **Consumer**: `worker.summary-generate`
- **Idempotency key**: `{agent_id}:{scope}:{period_start}:{period_end}`
- **Max attempts**: 3

---

## 15. `embedding.generate`

```typescript
type EmbeddingGeneratePayload = {
  source_type: 'email' | 'kb';
  source_id: string;             // uuid — email_messages.id or kb_documents.id
  model: string;                 // e.g., 'text-embedding-3-small'
};
```

- **Producer**: `email.index` consumer, KB ingest worker
- **Consumer**: `worker.embedding-generate` (uses Clara's `ai-core/multilingual-embeddings.ts`)
- **Idempotency key**: `{source_type}:{source_id}:{model}`
- **Max attempts**: 5

---

## 16. `voice.telemetry`

```typescript
type VoiceTelemetryPayload = {
  voice_session_id: string;      // uuid
  turn_id: string;               // uuid
  stage: 'tfa' | 'ttft' | 'ttfa' | 'total';
  latency_ms: number;
  provider_metadata: {
    provider: 'openai' | 'gemini' | 'sarvam' | 'elevenlabs';
    model?: string;
    voice_id?: string;
  };
};
```

- **Producer**: API `/api/voice/turn` handler
- **Consumer**: `worker.voice-telemetry`
- **Idempotency key**: `{voice_session_id}:{turn_id}:{stage}`
- **Max attempts**: 2 (best-effort)

---

## 17. `audit.persist`

```typescript
type AuditPersistPayload = {
  audit_event: {
    id: string;                  // uuid
    organization_id: string;     // uuid
    actor_type: 'user' | 'agent' | 'system';
    actor_id: string;            // uuid
    event_type: string;          // e.g., 'email.send', 'agent.tool.invoke'
    target_type: string;
    target_id: string;           // uuid
    metadata: object;
    correlation_id: string;      // uuid
    created_at: string;          // ISO 8601
  };
};
```

- **Producer**: every API route and every worker (after a successful or failed operation)
- **Consumer**: `worker.audit-persist`
- **Idempotency key**: `{audit_event.id}`
- **Max attempts**: 10 (audit is critical — must not be lost)
- **Failure handling**: if persist fails 10x, write to a local file-based fallback on the worker host and alert. The file-based fallback is replayed on recovery.

---

## 18. Message lifecycle

```text
   Producer
       │
       │ publish (with idempotency_key)
       ▼
   RabbitMQ queue
       │
       │ deliver to consumer
       ▼
   Consumer
       │
       ├── SETNX idempotency:{routing_key}:{idempotency_key} = {message_id} EX 86400
       │     │
       │     ├── returns 1 (new): process message
       │     │     │
       │     │     ├── success: ack; Redis key persists (prevents reprocessing for 24h)
       │     │     ├── failure (retryable): DEL Redis key; nack with requeue=false;
       │     │     │                       re-publish with attempt_count+1, delayed available_at
       │     │     └── failure (permanent): DEL Redis key; nack with requeue=false;
       │     │                              goes to DLQ
       │     │
       │     └── returns 0 (exists):
       │           ├── stored value == current message_id: re-delivery; ack without processing
       │           └── stored value != current message_id: different message same key;
       │                                                log warning; ack without processing
       │
       └── after max_attempts: nack with requeue=false → DLQ
```

DLQ messages are not auto-retried. They require manual intervention (admin replays or discards via UI).

---

## 19. Schema versioning

Schemas are versioned via a `schema_version` field in the payload (default `1`). If a schema changes:

1. Bump `schema_version`.
2. Consumer supports both old and new versions (during migration).
3. Producer sends new version after all consumers are upgraded.
4. Old version is supported for a deprecation window (default 30 days), then removed.

Schema changes are architectural decisions (record in `DECISIONS.md`).
