# MESSAGING_CHANNEL_ARCHITECTURE.md — Messaging Channel Abstraction

This document defines the messaging channel abstraction: a provider-neutral `MessagingChannel` interface with a `ProviderAdapter` pattern, of which WhatsApp is one concrete implementation. Per the ChatGPT Phase 1 conditional review (correction #5), the architecture must **not couple directly to WhatsApp** — WhatsApp is one messaging channel among potential future channels (SMS, Telegram, Messenger, etc.).

This document supersedes the direct-WhatsApp coupling implied in `WHATSAPP-ARCHITECTURE.md`. `WHATSAPP-ARCHITECTURE.md` is now the detailed implementation reference for the WhatsApp `ProviderAdapter`; this document is the abstraction layer.

This is a Phase 1 document. The abstraction is implemented in Phase 13 (WhatsApp integration) with the architecture in place to add future channels without runtime changes.

---

## 1. Why an abstraction

The master operating prompt §7 specifies WhatsApp as the first messaging channel. But the product objective — "a single AI agent capable of operating across four communication surfaces" — does not require WhatsApp to be the *only* messaging channel forever. Future phases may add:

- **SMS** (via Twilio or Vonage — Clara's `phone/` module already has providers, per `clara-core/source/src/modules/phone/providers/`)
- **Telegram** (Telegram Bot API)
- **Messenger** (Facebook Messenger API)
- **Slack** (Slack Bolt API)
- **Microsoft Teams** (Graph API)

Building a WhatsApp-specific runtime would require duplicating the entire inbound/outbound/rate-limit/template/approval flow for each future channel. Building a `MessagingChannel` abstraction means each new channel is a new `ProviderAdapter` — the runtime, tool registry, agent pipeline, and approval workflow do not change.

This is the same architectural principle as the `EmailProvider` adapter model (per `EMAIL-PROVIDER-ARCHITECTURE.md`): one interface, many adapters, capability discovery.

---

## 2. Abstraction overview

```text
                ┌─────────────────────────────────────────┐
                │   MessagingChannel (interface)          │
                │                                         │
                │   connect(credentials)                  │
                │   disconnect()                          │
                │   discoverCapabilities()                │
                │   capabilities()                        │
                │                                         │
                │   receiveInbound(rawEvent) → InboundMsg │
                │   send(to, message) → OutboundResult    │
                │   listContacts() / getContact(phone)    │
                │   listConversations() / getConversation │
                │   submitTemplate(name, lang, params)    │
                │   listTemplates()                       │
                └─────────────────────────────────────────┘
                       ▲         ▲         ▲         ▲
                       │         │         │         │
              ┌────────┴───┐ ┌───┴──────┐ ┌┴────────┐ ┌┴──────────┐
              │ WhatsApp   │ │ SMS      │ │Telegram │ │ Messenger │
              │ Adapter    │ │ Adapter  │ │ Adapter │ │ Adapter   │
              │ (Phase 13) │ │ (future) │ │(future) │ │ (future)  │
              └────────────┘ └──────────┘ └─────────┘ └───────────┘
```

Every adapter implements the same interface. Every method that is not universally supported throws `CapabilityNotSupported` if invoked when the capability is not present — the runtime never calls a method without first checking `capabilities()`.

---

## 3. MessagingChannel interface

```typescript
// packages/shared/src/messaging/channel.ts

export type MessagingCapability =
  | 'inbound_webhook'        // provider pushes inbound via webhook
  | 'inbound_poll'           // we poll for inbound
  | 'outbound_send'          // we can send outbound messages
  | 'outbound_template'      // template/message-template support
  | 'contacts'               // provider maintains a contact list
  | 'conversations'          // provider has native conversation grouping
  | 'media_inbound'          // inbound can include media (image/audio/video/document)
  | 'media_outbound'         // outbound can include media
  | 'status_events'          // provider pushes delivery/read/failed events
  | 'interactive_messages'   // provider supports buttons/lists/replies
  | 'location_inbound'       // inbound can include location
  | 'voice_clip_inbound'     // inbound can include voice clips
  | 'rate_limit_per_number'  // rate limit is per-sender (vs per-account)
  | 'template_approval'      // templates require provider approval before use
  | '24h_window'             // outbound restricted to 24h after last inbound
  ;

export type CapabilitySet = Record<MessagingCapability, boolean>;

export interface MessagingChannel {
  readonly channelType: 'whatsapp' | 'sms' | 'telegram' | 'messenger' | 'slack' | 'teams';

  // Lifecycle
  connect(credentials: MessagingCredentials): Promise<void>;
  disconnect(): Promise<void>;
  discoverCapabilities(): Promise<CapabilitySet>;
  capabilities(): CapabilitySet;

  // Inbound
  parseWebhookEvent(rawEvent: any, signature: string): InboundWebhookEvent;
  // verifies signature, deduplicates by provider_event_id, returns structured event

  // Outbound
  send(target: string, message: OutboundMessage): Promise<{ providerMessageId: string }>;
  sendTemplate(target: string, templateName: string, languageCode: string, parameters: any[]): Promise<{ providerMessageId: string }>;

  // Contacts
  listContacts?(): Promise<Contact[]>;
  getContact?(target: string): Promise<Contact | null>;

  // Conversations (provider-native grouping, if supported)
  listConversations?(): Promise<Conversation[]>;
  getConversation?(contactTarget: string): Promise<Conversation>;

  // Templates (where supported)
  listTemplates?(): Promise<Template[]>;
  submitTemplate?(params: TemplateParams): Promise<{ templateId: string }>;
}

export class CapabilityNotSupported extends Error {
  constructor(channelType: string, capability: MessagingCapability) {
    super(`Channel ${channelType} does not support capability ${capability}`);
  }
}
```

---

## 4. Capability matrix (target — to be validated per channel)

| Capability | WhatsApp | SMS (Twilio) | Telegram | Messenger |
|---|---|---|---|---|
| inbound_webhook | yes | yes | yes | yes |
| inbound_poll | no | yes | no | no |
| outbound_send | yes | yes | yes | yes |
| outbound_template | yes (required for first outbound to new contact) | no | no | yes (optional) |
| contacts | yes (per WhatsApp account) | yes (per phone number) | no (per chat) | yes (per PSID) |
| conversations | yes (per contact) | no (per phone number pair) | yes (per chat) | yes (per PSID) |
| media_inbound | yes | yes (MMS) | yes | yes |
| media_outbound | yes | yes (MMS) | yes | yes |
| status_events | yes (sent/delivered/read/failed) | yes (queued/sent/delivered/failed) | yes (sent/read) | yes (sent/delivered/read) |
| interactive_messages | yes (buttons/lists) | no | yes (inline keyboards) | yes (buttons) |
| location_inbound | yes | no | yes | yes |
| voice_clip_inbound | yes | no | yes | no |
| rate_limit_per_number | yes (80 msg/sec per Meta) | yes (per Twilio number) | no (per bot) | yes (per page) |
| template_approval | yes (Meta approval required) | no | no | no |
| 24h_window | yes (Marketing/Utility templates outside 24h) | no | no | yes (24h standard window) |

This matrix is the **target**. Each channel's implementation phase (Phase 13 for WhatsApp, future phases for others) validates the matrix against the real API. If a channel lacks a capability the architecture assumed, the capability flag is corrected (not the architecture).

---

## 5. WhatsApp as MessagingChannel

The WhatsApp `ProviderAdapter` implements `MessagingChannel` with `channelType: 'whatsapp'`. Detailed implementation in `WHATSAPP-ARCHITECTURE.md` (now reframed as the WhatsApp adapter reference).

**Key WhatsApp specifics:**
- **API:** WhatsApp Business Cloud API (Meta), not On-Premise (deprecated)
- **Auth:** System User access token (permanent, WABA-scoped); envelope-encrypted at rest
- **Webhook:** Meta pushes inbound + status to `/api/webhooks/messaging/whatsapp`; `X-Hub-Signature-256` HMAC verification mandatory
- **Templates:** required for first outbound to a new contact (no inbound in last 24h); submitted via Meta approval before use
- **Rate limit:** 80 messages/second per phone number; enforced via Redis token bucket per `phone_number_id`
- **Agent assignment:** 1:1 (per ADR-004) — one `MessagingChannel` instance per agent

**Adapter file:** `apps/worker/src/messaging/adapters/whatsapp.ts` (Phase 13)

---

## 6. Agent relationship (unchanged from ADR-004)

Per ADR-004, each agent may connect exactly one WhatsApp Business account. With the messaging abstraction, this generalizes to:

> Each agent may connect exactly one **messaging channel instance** per `channelType`.

So an agent could have:
- 1 WhatsApp connection
- 1 SMS connection (future)
- 1 Telegram connection (future)

But not 2 WhatsApp connections. The schema enforces this via `agent_messaging_assignments` (Phase 13 migration):

```sql
CREATE UNIQUE INDEX agent_messaging_assignments_agent_channel_uniq
  ON agent_messaging_assignments (agent_id, channel_type);
```

This replaces the WhatsApp-specific `agent_whatsapp_accounts` 1:1 enforcement. The migration is a Phase 13 task (renames/generalizes the table).

---

## 7. Inbound flow (channel-agnostic)

```text
1. Provider → POST /api/webhooks/messaging/{channel_type}
   - signature header (channel-specific: X-Hub-Signature-256 for WhatsApp, X-Twilio-Signature for SMS, etc.)
2. API: verify signature (reject 401 if invalid)
3. API: route to channel.parseWebhookEvent(body, signature)
4. Channel adapter: parse → InboundWebhookEvent { provider_event_id, contact_target, message, status? }
5. API: dedupe by provider_event_id (in {channel}_webhook_events table)
6. API: persist raw event
7. API: determine target agent(s) via agent_messaging_assignments lookup
8. API: enqueue messaging.inbound { agent_id, channel_type, contact_target, message }
9. Worker: upsert contact in {channel}_contacts
10. Worker: persist message in {channel}_messages (direction=inbound)
11. Worker: build AgentRequest (channel=channel_type, user_text from message body)
12. Worker: run agent pipeline (same as chat — see AI-ARCHITECTURE.md)
13. Worker: enqueue messaging.outbound { agent_id, channel_type, contact_target, response }
14. Worker (outbound): call channel.send() or channel.sendTemplate()
15. Worker: persist message (direction=outbound, status=sent)
16. Worker: emit audit_events
```

The flow is identical for every channel. Only the adapter (Step 3-4) and the persistence tables (Step 6, 9, 10) differ per channel.

---

## 8. Outbound flow (channel-agnostic)

Outbound can be triggered by:
- An inbound message reply (Step 13 above)
- A scheduled job (e.g., "every day at 08:00, send summary to WhatsApp")
- An automation rule
- A chat-initiated "send this to my phone" command

All outbound goes through the same `messaging.outbound` queue and the same worker. The worker:

1. Resolves the channel adapter for `{channel_type}` + `{agent_id}`
2. Checks `capabilities()` for `outbound_send` (and `outbound_template` if template)
3. If `24h_window` capability and contact is outside window: requires template; if no approved template matches intent, **fails closed** and audits (does not improvise a non-template message)
4. If `rate_limit_per_number`: checks Redis token bucket; waits if budget exhausted
5. Calls `channel.send()` or `channel.sendTemplate()`
6. Persists outbound message; updates status on provider status event
7. Audit

---

## 9. Unified schema (generalized from WhatsApp-specific)

The WhatsApp-specific tables in `DATA-MODEL.md §4` are generalized to (Phase 13 migration):

- `messaging_accounts` (was `whatsapp_accounts`) — adds `channel_type` enum
- `agent_messaging_assignments` (was `agent_whatsapp_accounts`) — adds `channel_type`; unique on `(agent_id, channel_type)`
- `messaging_contacts` (was `whatsapp_contacts`) — adds `channel_type`; unique on `(messaging_account_id, channel_type, contact_target)`
- `messaging_messages` (was `whatsapp_messages`) — adds `channel_type`
- `messaging_webhook_events` (was `whatsapp_webhook_events`) — adds `channel_type`
- `messaging_templates` (was `whatsapp_templates`) — adds `channel_type`; only for channels with `template_approval` capability

The migration is forward-only and preserves existing WhatsApp data (if any exists by Phase 13). The migration is reviewed by ChatGPT before applying (per `RULES.md §11`).

**Note:** `DATA-MODEL.md §4` will be updated in Phase 13 to reflect this generalization. For Phase 1, the WhatsApp-specific naming in `DATA-MODEL.md` is the planning baseline; the actual Phase 13 migration uses the generalized naming.

---

## 10. Tool registry (messaging tools)

The WhatsApp-specific tools in `TOOL-CONTRACTS.md §3.2` are generalized to (per `TOOL-CONTRACTS.md §7` — adding tools is an architectural decision):

| Name | Sensitivity | Required permission | Description |
|---|---|---|---|
| `messaging.send` | **sensitive** | `messaging.send` | **Send an outbound message** (requires authorization; template/window compliance enforced) |
| `messaging.history` | safe | `messaging.read` | Read conversation history with a contact |
| `messaging.list_contacts` | safe | `messaging.read` | List contacts for the agent's messaging channel |

The `whatsapp.send` and `whatsapp.history` tools in `TOOL-CONTRACTS.md §3.2` are aliased to `messaging.send` and `messaging.history` for backward compatibility. New code uses the `messaging.*` names.

---

## 11. Webhook routing

The Next.js API has a single webhook router:

```typescript
// apps/web/app/api/webhooks/messaging/[channelType]/route.ts

export async function POST(req: Request, { params }: { params: { channelType: string } }) {
  const channel = getMessagingChannel(params.channelType);
  if (!channel) return new Response('Unknown channel', { status: 404 });

  const signature = req.headers.get(channel.signatureHeader());
  const body = await req.text();

  const event = channel.parseWebhookEvent(body, signature);
  // ... dedupe, persist, enqueue messaging.inbound
}
```

Each channel's signature header (`X-Hub-Signature-256` for WhatsApp, `X-Twilio-Signature` for SMS, etc.) is declared by the adapter. The router is generic; the adapter handles channel-specific verification.

---

## 12. Security (channel-agnostic)

Per `SECURITY.md §7` and `SECURITY_MODEL.md`:

- **Webhook signature verification:** mandatory for every channel. Reject 401 on mismatch. Log rejected requests.
- **Credentials:** envelope-encrypted at rest in `messaging_accounts.encrypted_credentials`.
- **Rate limiting:** per-channel, per-account, per-contact (Redis token bucket).
- **Template compliance:** enforced at the runtime layer (not LLM). Channels with `template_approval` capability require approved templates for first-outbound-to-new-contact.
- **24h window:** enforced at the runtime layer. Channels with `24h_window` capability require template outside window; runtime fails closed if no approved template.
- **PII:** message bodies are PII. Stored in `messaging_messages.body` (PostgreSQL, RLS-enforced). Retention per organization policy (default 2 years). Soft-delete; hard delete via retention job.
- **Audit:** every inbound and outbound emits an `audit_events` row.

---

## 13. Future channels (informational)

Adding a new messaging channel requires:

1. New `ProviderAdapter` implementing `MessagingChannel` (new file in `apps/worker/src/messaging/adapters/`).
2. New entry in `messaging_accounts.channel_type` enum (migration).
3. Capability matrix declaration (per channel).
4. Auth flow implementation (OAuth, API key, etc.).
5. Webhook signature verification implementation.
6. Template submission flow (if `template_approval` capability).
7. Rate limiter configuration (if `rate_limit_per_number` capability).
8. Capability validation against real API (Phase-13-style exit criteria).

The runtime, tool registry, agent pipeline, approval workflow, and UI conversation view do not change. This is the point of the abstraction.

**Candidate channels (post-Phase 19):**
- **SMS (Twilio):** reuses Clara's `phone/providers/twilio.ts` as a reference (not directly — that's telephony voice, not SMS text, but the auth/signature patterns are similar)
- **Telegram:** Telegram Bot API; webhook-based; no templates; no 24h window
- **Messenger:** Facebook Messenger API; webhook-based; 24h standard window; no template approval
- **Slack:** Slack Bolt API; event-based; no templates; no 24h window; app-specific auth
- **Microsoft Teams:** Graph API; webhook-based; app-specific auth

These are **not** in the Phase 1-19 scope. They are recorded here for context only.

---

## 14. Relationship to other documents

| Document | Relationship |
|---|---|
| `WHATSAPP-ARCHITECTURE.md` | Detailed implementation reference for the WhatsApp `ProviderAdapter`. Now a sub-document of this abstraction. |
| `MESSAGING_CHANNEL_ARCHITECTURE.md` (this doc) | The abstraction layer. Authoritative for the messaging boundary. |
| `AI-ARCHITECTURE.md` | The agent runtime invokes `messaging.send` / `messaging.history` tools (per `TOOL-CONTRACTS.md §3.2`). The runtime is channel-agnostic. |
| `TOOL-CONTRACTS.md` | `messaging.*` tools (generalized from `whatsapp.*`). |
| `EVENT-CONTRACTS.md` | `messaging.inbound` / `messaging.outbound` queue messages (generalized from `whatsapp.*`). |
| `API-CONTRACTS.md` | `/api/webhooks/messaging/{channelType}` webhook router (generalized from `/api/webhooks/whatsapp`). |
| `DATA-MODEL.md` | `messaging_*` tables (generalized from `whatsapp_*` in Phase 13). |
| `DOMAIN_MODEL.md` | `WhatsApp Connection` is one concrete `MessagingChannel` instance. |
| `SECURITY.md` / `SECURITY_MODEL.md` | Channel-agnostic security (signature, encryption, rate limit, template, PII, audit). |

When this document and `WHATSAPP-ARCHITECTURE.md` disagree, **this document wins for the abstraction boundary**; `WHATSAPP-ARCHITECTURE.md` wins for WhatsApp-specific implementation details. Disagreements are resolved by ChatGPT (architectural decision in `DECISIONS.md`).

---

## 15. ADR addition

This abstraction introduces an implicit ADR:

> **ADR-010 (proposed):** Messaging channels use a provider-neutral `MessagingChannel` abstraction with a `ProviderAdapter` pattern. WhatsApp is the first implementation (Phase 13); future channels (SMS, Telegram, Messenger, Slack, Teams) are added as new adapters without runtime changes. Generalizes ADR-004 (one WhatsApp account per agent) to "one messaging channel instance per `channelType` per agent."

This ADR will be formally recorded in `DECISIONS.md` and ratified (or corrected) by ChatGPT during Phase 1 final approval.
