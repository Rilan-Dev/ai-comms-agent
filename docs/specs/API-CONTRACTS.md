# API-CONTRACTS.md — REST / WebSocket / SSE API Surface

This document defines the API surface for `ai-comms-agent`: REST routes, SSE streams, WebSocket endpoints, and webhook receivers. It is the canonical reference for the Next.js API implementation.

This is a Phase 1 document. Exact request/response shapes are validated in Phase 2 (application foundation) and onward.

---

## 1. Conventions

- **Base URL**: `https://<vercel-domain>/api`
- **Auth**: HttpOnly cookies (`session` JWT, `refresh` token). All routes require auth unless marked `public`.
- **Tenant scoping**: every tenant-scoped route takes `organization_id` from the session (selected org) or as a path/param.
- **Content type**: `application/json` for REST; `text/event-stream` for SSE; `application/json` over WebSocket for realtime events.
- **Errors**: RFC 7807 problem+json shape:
  ```json
  {
    "type": "https://ai-comms-agent/errors/permission-denied",
    "title": "Permission denied",
    "status": 403,
    "detail": "You do not have email.send permission on this organization.",
    "correlation_id": "uuid"
  }
  ```
- **Correlation ID**: every response includes `X-Correlation-Id` header (UUID). Clients may send `X-Correlation-Id` to propagate.
- **Rate limiting**: per-user / per-IP / per-org (per `SECURITY.md §9`). 429 with `Retry-After`.
- **Pagination**: cursor-based. `?limit=50&cursor=...`. Response includes `next_cursor` (null if no more).

---

## 2. Auth routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | PostgreSQL-backed email + password login. Sets an opaque HttpOnly session cookie. |
| POST | `/api/auth/magic` | Request magic link. |
| GET | `/api/auth/magic/verify` | Verify magic link token. Sets cookies. |
| GET | `/api/auth/oauth/{provider}` | Start OAuth flow (google, github). |
| GET | `/api/auth/oauth/{provider}/callback` | OAuth callback. Sets cookies. |
| POST | `/api/auth/mfa` | Verify MFA code (after primary auth). |
| POST | `/api/auth/refresh` | Refresh session JWT. |
| POST | `/api/auth/logout` | Logout. Clears cookies. Revokes refresh token. |
| GET | `/api/auth/me` | Current user + memberships. |

---

## 3. Organization routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations` | List user's organizations. |
| POST | `/api/organizations` | Create organization (owner). |
| GET | `/api/organizations/{id}` | Get organization. |
| PATCH | `/api/organizations/{id}` | Update organization (owner/admin). |
| DELETE | `/api/organizations/{id}` | Delete organization (owner + MFA). |
| GET | `/api/organizations/{id}/members` | List members. |
| POST | `/api/organizations/{id}/members/invite` | Invite member. |
| DELETE | `/api/organizations/{id}/members/{user_id}` | Remove member (owner/admin). |
| PATCH | `/api/organizations/{id}/members/{user_id}` | Change member role. |
| GET | `/api/organizations/{id}/api-keys` | List API keys. |
| POST | `/api/organizations/{id}/api-keys` | Create API key. |
| DELETE | `/api/organizations/{id}/api-keys/{key_id}` | Revoke API key. |

---

## 4. Agent routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/agents` | List agents. |
| POST | `/api/organizations/{org_id}/agents` | Create agent (draft). |
| GET | `/api/organizations/{org_id}/agents/{agent_id}` | Get agent. |
| PATCH | `/api/organizations/{org_id}/agents/{agent_id}` | Update agent (creates new version). |
| DELETE | `/api/organizations/{org_id}/agents/{agent_id}` | Archive agent. |
| POST | `/api/organizations/{org_id}/agents/{agent_id}/deploy` | Deploy current version. |
| GET | `/api/organizations/{org_id}/agents/{agent_id}/versions` | List versions. |
| GET | `/api/organizations/{org_id}/agents/{agent_id}/versions/{version_id}` | Get version (with diff from previous). |
| POST | `/api/organizations/{org_id}/agents/{agent_id}/versions/{version_id}/promote` | Promote version to current. |

---

## 5. Agent configuration sub-routes

| Method | Path | Description |
|---|---|---|
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/ai` | AI config (provider, model, prompts). |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/voice` | Voice config (provider, voice, latency budget). |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/email` | Connected email accounts + roles. |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/whatsapp` | Connected WhatsApp account. |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/knowledge` | Bound KBs + weights. |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/tools` | Allowed tools. |
| GET/POST | `/api/organizations/{org_id}/agents/{agent_id}/automations` | List / create automation rules. |
| PATCH/DELETE | `/api/organizations/{org_id}/agents/{agent_id}/automations/{rule_id}` | Update / delete automation. |
| GET/POST | `/api/organizations/{org_id}/agents/{agent_id}/schedules` | List / create scheduled jobs. |
| PATCH/DELETE | `/api/organizations/{org_id}/agents/{agent_id}/schedules/{job_id}` | Update / cancel schedule. |
| GET/PUT | `/api/organizations/{org_id}/agents/{agent_id}/security` | Approval policy, allowed/blocked senders, rate limits. |
| GET | `/api/organizations/{org_id}/agents/{agent_id}/activity` | Activity feed (turns, tool calls). |

---

## 6. Email routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/email-accounts` | List email accounts. |
| POST | `/api/organizations/{org_id}/email-accounts` | Connect email account (OAuth flow start or IMAP form). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}` | Get account (with capabilities). |
| DELETE | `/api/organizations/{org_id}/email-accounts/{account_id}` | Disconnect account (deletes credentials). |
| POST | `/api/organizations/{org_id}/email-accounts/{account_id}/sync` | Manual sync trigger. |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/folders` | List folders. |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/labels` | List labels (if supported). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/messages` | List messages (paginated, filterable). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/messages/{message_id}` | Get message (full body). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/threads` | List threads. |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/threads/{thread_id}` | Get thread (all messages). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/search` | Search messages (text + semantic). |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/drafts` | List drafts. |
| POST | `/api/organizations/{org_id}/email-accounts/{account_id}/drafts` | Create draft (manual, not agent). |
| PATCH | `/api/organizations/{org_id}/email-accounts/{account_id}/drafts/{draft_id}` | Update draft. |
| DELETE | `/api/organizations/{org_id}/email-accounts/{account_id}/drafts/{draft_id}` | Delete draft. |
| GET | `/api/organizations/{org_id}/email-accounts/{account_id}/attachments/{attachment_id}` | Download attachment (signed URL). |

---

## 7. Email action / approval routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/email-actions` | List email actions (filterable by status). |
| GET | `/api/organizations/{org_id}/email-actions/{action_id}` | Get action. |
| POST | `/api/organizations/{org_id}/email-actions/{action_id}/approve` | Approve action. |
| POST | `/api/organizations/{org_id}/email-actions/{action_id}/reject` | Reject action. |

---

## 8. WhatsApp routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/whatsapp-accounts` | List WhatsApp accounts. |
| POST | `/api/organizations/{org_id}/whatsapp-accounts` | Connect WhatsApp Business (onboarding flow). |
| GET | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}` | Get account. |
| DELETE | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}` | Disconnect account. |
| GET | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}/conversations` | List conversations (per contact). |
| GET | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}/conversations/{contact_id}` | Get conversation (messages). |
| POST | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}/send` | Send outbound (manual, not agent — goes through approval policy). |
| GET | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}/templates` | List templates. |
| POST | `/api/organizations/{org_id}/whatsapp-accounts/{account_id}/templates` | Submit template for approval. |

---

## 9. Conversation / chat routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/conversations` | List conversations (filterable by agent, channel). |
| GET | `/api/organizations/{org_id}/conversations/{conversation_id}` | Get conversation (with messages). |
| POST | `/api/organizations/{org_id}/agents/{agent_id}/chat` | Start a chat turn. Returns SSE stream URL. |
| GET | `/api/organizations/{org_id}/conversations/{conversation_id}/stream` | SSE stream for an active chat turn. |
| POST | `/api/organizations/{org_id}/conversations/{conversation_id}/cancel` | Cancel an active turn. |

---

## 10. Voice routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/organizations/{org_id}/agents/{agent_id}/voice/session` | Start voice session. Returns session token + relay URL. |
| POST | `/api/voice/turn` | Process a voice turn (transcription → agent → response). |
| POST | `/api/voice/session/{session_id}/end` | End voice session. |
| GET | `/api/organizations/{org_id}/voice-sessions` | List voice sessions. |
| GET | `/api/organizations/{org_id}/voice-sessions/{session_id}` | Get voice session (with telemetry). |

---

## 11. Schedule / automation routes

(Already covered in §5 agent sub-routes. Top-level for cross-agent views:)

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/schedules` | List all scheduled jobs (across agents). |
| GET | `/api/organizations/{org_id}/automations` | List all automation rules. |
| GET | `/api/organizations/{org_id}/schedules/{job_id}/runs` | List scheduled job runs. |
| GET | `/api/organizations/{org_id}/automations/{rule_id}/runs` | List automation runs. |

---

## 12. AI & Voice config routes (organization-level)

| Method | Path | Description |
|---|---|---|
| GET/PUT | `/api/organizations/{org_id}/ai-settings` | AI provider configs (per-provider API key, default model). |
| GET/PUT | `/api/organizations/{org_id}/voice-settings` | Voice provider configs. |
| GET | `/api/organizations/{org_id}/ai-usage` | Usage dashboard data (tokens, cost, per-agent). |
| GET | `/api/organizations/{org_id}/voice-telemetry` | Voice telemetry dashboard data. |

---

## 13. Knowledge routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/knowledge-bases` | List KBs. |
| POST | `/api/organizations/{org_id}/knowledge-bases` | Create KB. |
| GET | `/api/organizations/{org_id}/knowledge-bases/{kb_id}` | Get KB. |
| DELETE | `/api/organizations/{org_id}/knowledge-bases/{kb_id}` | Delete KB. |
| POST | `/api/organizations/{org_id}/knowledge-bases/{kb_id}/documents` | Upload document (ingest). |
| GET | `/api/organizations/{org_id}/knowledge-bases/{kb_id}/documents` | List documents. |
| DELETE | `/api/organizations/{org_id}/knowledge-bases/{kb_id}/documents/{doc_id}` | Delete document. |
| POST | `/api/organizations/{org_id}/knowledge-bases/{kb_id}/search` | Test search. |
| POST | `/api/organizations/{org_id}/knowledge-bases/{kb_id}/reindex` | Trigger reindex. |

---

## 14. Activity / audit routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations/{org_id}/activity` | Activity feed (agent turns, tool calls, runs). |
| GET | `/api/organizations/{org_id}/audit` | Audit log (admin-only; filterable). |
| GET | `/api/organizations/{org_id}/audit/export` | Export audit log (JSON/CSV). |

---

## 15. Webhook receivers (public, signature-verified)

| Method | Path | Description |
|---|---|---|
| GET | `/api/webhooks/whatsapp` | WhatsApp webhook verification (setup-time). |
| POST | `/api/webhooks/whatsapp` | WhatsApp inbound + status events. |
| POST | `/api/webhooks/gmail` | Gmail Pub/Sub push notifications. |
| POST | `/api/webhooks/zoho` | Zoho Mail webhook events. |
| POST | `/api/webhooks/oauth/{provider}/callback` | OAuth callback (for email account connection). |

---

## 16. Health / status routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness probe (always 200 if process is up). |
| GET | `/api/ready` | Readiness probe (checks DB, Redis, RabbitMQ connectivity). |
| GET | `/api/version` | Version info (commit SHA, build time). |

---

## 17. SSE event format

For chat streams (`/api/.../chat` and `/api/.../stream`):

```text
event: turn_start
data: {"turn_id":"uuid","correlation_id":"uuid"}

event: tool_call
data: {"tool":"email.read","input_summary":"...","call_id":"uuid"}

event: tool_result
data: {"call_id":"uuid","ok":true,"output_summary":"3 messages found"}

event: approval_required
data: {"action_id":"uuid","action_type":"send","target_summary":"..."}

event: token
data: {"text":"Today you have "}

event: token
data: {"text":"3 important emails."}

event: turn_end
data: {"turn_id":"uuid","status":"complete","tokens_in":123,"tokens_out":45}
```

The client renders tokens as they arrive. `tool_call` / `tool_result` are shown inline. `approval_required` pauses the stream until the user approves/rejects via `POST /api/.../email-actions/{action_id}/approve` or `/reject`.

---

## 18. WebSocket / realtime voice

Realtime voice is **not** a WebSocket API exposed to the browser directly. The browser connects to the provider's realtime endpoint (OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs) using a short-lived session token issued by `POST /api/.../voice/session`. The provider transcribes; the browser forwards transcription to `POST /api/voice/turn`; the API runs the agent pipeline and returns text; the browser sends the text to the provider for TTS.

This indirection keeps provider API keys server-side and reuses Clara's realtime contracts (per `REALTIME-VOICE-ARCHITECTURE.md`).

---

## 19. Versioning

The API is unversioned in v1 (URL is `/api/...`). If a breaking change is needed:

1. Add new routes at `/api/v2/...` (parallel to existing).
2. Deprecate old routes (response includes `Deprecation` header).
3. After deprecation window (default 6 months), remove old routes.

Schema changes are versioned per `EVENT-CONTRACTS.md §19`.
