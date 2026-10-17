# WHATSAPP-ARCHITECTURE.md

This document defines the WhatsApp architecture. The core constraint (per the master operating prompt §7) is: **each agent may connect exactly one WhatsApp Business account/phone**. This is enforced at the data-model layer (1:1 relationship — ADR-004) and at the runtime layer (one inbound/outbound stream per agent).

This is a Phase 1 document. WhatsApp-specific implementation is Phase 13.

---

## 1. WhatsApp Business API

The product uses **WhatsApp Business Cloud API** (Meta), not the On-Premise API (deprecated). The Cloud API is HTTP-based, webhook-driven, and supports both inbound and outbound messaging.

- **Account model**: A Meta Business Account owns one or more WhatsApp Business Accounts (WABA). Each WABA owns one or more phone numbers. We model one `whatsapp_accounts` row per phone number.
- **Auth**: System User access token (permanent, scoped to the WABA). Stored encrypted in `whatsapp_accounts.encrypted_credentials`.
- **Webhooks**: Meta pushes inbound messages and status events to our `/api/webhooks/whatsapp` endpoint. Webhook signature verification is mandatory (X-Hub-Signature-256 HMAC).
- **Outbound**: We POST to `https://graph.facebook.com/v21.0/{phone_number_id}/messages` with the System User token.

---

## 2. Agent relationship

Per ADR-004: `agent_whatsapp_accounts` is a 1:1 relationship. Each agent has at most one WhatsApp Business number. Multiple agents **may** share a number if the user explicitly configures it — the schema allows this but the UI warns and requires confirmation. Inbound messages for a shared number are routed to all bound agents (each agent sees the same inbound; each may respond independently — the user is responsible for avoiding double-response, the UI shows "multiple agents bound to this number").

The common case is 1 agent : 1 number.

```text
   ┌────────────┐         ┌────────────────────────┐         ┌──────────────┐
   │  Agent A    │ 1 ──── 1 │  WhatsApp Account      │ 1 ──── 1 │  Phone Number │
   │             │         │  (WABA, phone_number_id)│         │  (+1-XXX-...) │
   └────────────┘         └────────────────────────┘         └──────────────┘
        │                          │                                  ▲
        │ invokes                  │                                  │
        ▼                          ▼                                  │
   ┌────────────┐         ┌────────────────────────┐                 │
   │  Agent     │         │  /api/webhooks/whatsapp│ ◀── Meta push ───┘
   │  runtime   │         │  (signature-verified)  │   (inbound + status)
   └────────────┘         └────────────────────────┘
                                 │
                                 │ enqueues whatsapp.inbound
                                 ▼
                          ┌──────────────┐
                          │  RabbitMQ    │
                          │  whatsapp.*  │
                          └──────────────┘
```

---

## 3. Inbound flow

```text
1. Meta → POST /api/webhooks/whatsapp
   - X-Hub-Signature-256: HMAC-SHA256 of body with verify_token secret
2. API: verify signature (reject if invalid)
3. API: dedupe by provider_event_id (whatsapp_webhook_events, unique)
4. API: persist raw event to whatsapp_webhook_events
5. API: determine target agent(s) via whatsapp_accounts → agent_whatsapp_accounts lookup
6. API: enqueue whatsapp.inbound { agent_id, contact_phone, message }
7. Worker: parse message (text / media / location / interactive)
8. Worker: upsert whatsapp_contacts
9. Worker: persist whatsapp_messages (direction=inbound)
10. Worker: build AgentRequest (channel=whatsapp, user_text=transcribed or text body)
11. Worker: run agent pipeline (same as chat — see AI-ARCHITECTURE.md)
12. Worker: enqueue whatsapp.outbound { agent_id, contact_phone, response_text }
13. Worker: POST WhatsApp Cloud API → Meta → user's phone
14. Worker: persist whatsapp_messages (direction=outbound, status=sent)
15. Worker: emit audit_events
```

---

## 4. Outbound flow

Outbound can be triggered by:
- An inbound message reply (step 12 above)
- A scheduled job (e.g., "every day at 08:00, send summary to WhatsApp")
- An automation rule
- A chat-initiated "send this to my WhatsApp" command

All outbound goes through the same `whatsapp.outbound` queue and the same worker. This ensures:

- Rate limiting (Meta enforces 80 messages/second per number; we throttle per number)
- Template compliance (the first message to a new contact must be a template message — Meta enforces this; we validate before sending)
- Audit (every outbound is logged)
- Retry on Meta 5xx

---

## 5. Template messages

Meta requires the first outbound to a new contact (no inbound in the last 24 hours) to use an approved template. We model this:

- `whatsapp_templates` table (id, whatsapp_account_id, name, language, status: `pending`/`approved`/`rejected`, parameters jsonb, created_at)
- The runtime checks `whatsapp_contacts.last_message_at` before sending. If outside the 24-hour window, the runtime requires a template. If no approved template matches the intent, the runtime **fails closed** and audits — it does not improvise a non-template message.
- Templates are submitted via Meta's approval process before they can be used. This is a user-operational task, not a Z.AI task.

---

## 6. Webhook verification

Meta requires a one-time webhook verification at setup:

1. User configures webhook URL (`https://<our-domain>/api/webhooks/whatsapp`) and verify token in Meta Business Manager.
2. Meta sends `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
3. Our API verifies the `hub.verify_token` matches `whatsapp_accounts.verify_token` and returns `hub.challenge` as plaintext.
4. Meta marks the webhook as verified.

This is a setup-time flow, not a runtime flow. Stored in `whatsapp_accounts.verify_token` (not encrypted — it's a user-chosen string, not a secret).

---

## 7. Status events

Meta pushes status events (`sent`, `delivered`, `read`, `failed`) for outbound messages. We persist these to `whatsapp_messages.status` and surface read receipts in the UI. `failed` events trigger an audit and a notification to the user.

---

## 8. Security

- **Webhook signature verification**: mandatory. Reject any request with an invalid signature. Log rejected requests for monitoring.
- **System User token**: stored envelope-encrypted in `whatsapp_accounts.encrypted_credentials`. Never exposed to the browser. Rotated periodically (per `SECURITY.md`).
- **Rate limiting**: per-phone-number rate limiter (Redis-based, 80 messages/second per Meta's limit). Excess messages are queued, not dropped.
- **Template compliance**: enforced at the runtime layer. The LLM cannot bypass template requirements — the deterministic policy engine checks before sending.
- **PII handling**: WhatsApp message bodies are PII. Stored in `whatsapp_messages.body` (PostgreSQL, RLS-enforced). Retention per organization policy (default: 2 years, configurable). Deletion is soft-delete; hard delete via a retention job.
- **Audit**: every inbound and outbound emits an `audit_events` row.

---

## 9. Failure modes

- **Webhook signature invalid**: reject with 401, log, do not process.
- **Unknown whatsapp_account**: reject with 404, log (likely Meta misconfiguration).
- **Outbound 5xx from Meta**: retry with exponential backoff (max 5 attempts, then DLQ).
- **Outbound 4xx (template required, invalid contact, etc.)**: do not retry; audit; surface to user.
- **Token revoked**: `whatsapp_accounts.status = revoked`; UI warns; user must re-onboard.
- **Rate limit hit**: queue pauses for that phone number; resumes when the limit window resets.

---

## 10. What is deferred to Phase 13

- Concrete webhook receiver implementation.
- Outbound worker implementation.
- Template submission flow (UI for composing + submitting templates to Meta).
- WhatsApp Business Account onboarding UI.
- Rate limiter implementation.
- Status event handling.
- UI for WhatsApp conversation view.

Phase 13 cannot complete end-to-end without the user's Meta Business Account and WhatsApp Business number registration (RSK-004). The user should begin that process during Phase 11.


## Implementation checkpoint — 2026-10-17

Outbound requests through `POST /api/whatsapp/messages` now create a pending `whatsapp_send_actions` record rather than enqueueing a message directly. `GET /api/whatsapp/send-actions?organizationId=...` lists the organization-scoped approval queue. `POST /api/whatsapp/send-actions/decision` accepts authenticated `approve`/`reject` decisions and records audit events. Text sends are queued only when the account remains connected and a recent inbound customer message proves the 24-hour window is open; otherwise the action is marked `requires_template` and fails closed.

**Implemented at source level:** Meta template submission/status sync; supported text-body template payload persistence and worker delivery; approval queue UI; authenticated approve/reject endpoint; approval-time and worker-time 24-hour/live-template checks; and proposal-only `whatsapp.send` registration. The tool creates a pending action only and never sends directly. Unsupported media/dynamic-header/button templates fail closed. **Still unverified:** tests/typecheck/build, migration execution, browser workflow, Meta API behavior, and deployed sends. Source edits only; migration/tests/runtime not verified.
