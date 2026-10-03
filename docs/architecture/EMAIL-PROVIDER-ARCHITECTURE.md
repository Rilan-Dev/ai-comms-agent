# EMAIL-PROVIDER-ARCHITECTURE.md

This document defines the email provider architecture: the `EmailProvider` adapter model, capability discovery, and the per-provider specifics for Gmail, IMAP/SMTP, and Zoho. Per the master operating prompt §9, email must use an adapter model with provider capability discovery — we must not assume every provider supports every capability.

This is a Phase 1 document. Provider-specific implementation (Phases 5-8) validates the capability matrix against real APIs.

---

## 1. Adapter model

```text
                ┌─────────────────────────┐
                │   EmailProvider          │
                │   (interface)            │
                │                          │
                │  connect()               │
                │  disconnect()            │
                │  discoverCapabilities()  │
                │  capabilities()          │
                │                          │
                │  listFolders()           │
                │  listLabels()            │
                │  sync(state) → events    │
                │  listMessages(folder,opts)│
                │  getThread(id)           │
                │  search(query)           │
                │  createDraft(params)     │
                │  updateDraft(id, params) │
                │  send(draftId or params) │
                │  reply(messageId, params)│
                │  forward(messageId, to)  │
                │  markRead(messageIds,b)  │
                │  archive(messageIds)     │
                │  move(messageIds, folder)│
                │  applyLabels(...)        │
                └─────────────────────────┘
                       ▲         ▲         ▲
                       │         │         │
              ┌────────┴──┐ ┌────┴──────┐ ┌┴──────────┐
              │ GmailAdapter│ │ImapSmtpAd│ │ZohoAdapter│
              │             │ │apter     │ │           │
              │ Gmail API + │ │ IMAP +   │ │ Zoho API +│
              │ Pub/Sub     │ │ SMTP +   │ │ IMAP      │
              │             │ │ IDLE     │ │           │
              └─────────────┘ └──────────┘ └───────────┘
```

Every adapter implements the same interface. Every method that is not universally supported throws `CapabilityNotSupported` if invoked when the capability is not present — the runtime never calls a method without first checking `capabilities()`.

---

## 2. Capability contract

Each adapter exposes a `capabilities()` method returning a `CapabilitySet`:

```typescript
type CapabilitySet = {
  folders: boolean;              // listFolders
  labels: boolean;               // listLabels, applyLabels
  sync_incremental: boolean;     // sync() with cursor
  sync_full: boolean;            // sync() without cursor (full scan)
  sync_webhook: boolean;         // provider pushes changes (Gmail Pub/Sub)
  sync_idle: boolean;            // IMAP IDLE
  search_server_side: boolean;   // provider-side search
  search_client_side: boolean;   // we filter locally
  drafts: boolean;
  reply: boolean;
  forward: boolean;
  mark_read: boolean;
  archive: boolean;
  move: boolean;
  threads: boolean;              // provider-native threading
  attachments_download: boolean;
  attachments_upload: boolean;
  send: boolean;
};
```

The runtime queries `capabilities()` once at connect time, persists the result to `email_accounts.capabilities` (jsonb), and refreshes periodically (daily) or on provider-reported config changes.

Before invoking any operation, the runtime checks `capabilities()`. If unsupported, it returns a structured error to the LLM: "This account's provider does not support X". The LLM may rephrase for the user.

---

## 3. Capability matrix (target — to be validated in Phases 5-8)

| Capability | Gmail | IMAP/SMTP | Zoho |
|---|---|---|---|
| folders | yes | yes | yes |
| labels | yes (native) | no (mapped to folders) | partial (Zoho has its own label system) |
| sync_incremental | yes (historyId) | yes (UIDVALIDITY + modseq) | yes (via IMAP) |
| sync_full | yes | yes | yes |
| sync_webhook | yes (Pub/Sub) | no | partial (Zoho pushes some events) |
| sync_idle | no | yes | yes (via IMAP) |
| search_server_side | yes | yes (if server supports SORT/THREAD) | yes (via IMAP) |
| search_client_side | yes (fallback) | yes (fallback) | yes (fallback) |
| drafts | yes | yes (Drafts folder) | yes |
| reply | yes | yes ( References header ) | yes |
| forward | yes | yes | yes |
| mark_read | yes | yes | yes |
| archive | yes (remove from inbox) | yes (move to Archive) | yes |
| move | yes | yes | yes |
| threads | yes (native) | yes (References header grouping) | yes (References header grouping) |
| attachments_download | yes | yes | yes |
| attachments_upload | yes | yes | yes |
| send | yes (Gmail API) | yes (SMTP) | yes (Zoho API or SMTP) |

This matrix is the **target**. Phase 5 (abstraction), Phase 6 (Gmail), Phase 7 (IMAP/SMTP), Phase 8 (Zoho) each include a capability-validation step in their exit criteria. If a provider lacks a capability the architecture assumed, the capability flag is corrected (not the architecture).

---

## 4. Gmail adapter

- **API**: Gmail API v1 (REST).
- **Auth**: OAuth 2.0 (Gmail scope `https://mail.google.com/` or narrower `gmail.modify`). Tokens stored encrypted in `email_account_credentials`.
- **Sync**: Gmail Pub/Sub push notifications. A per-account Cloud Pub/Sub topic receives Gmail push events; the topic pushes to our `/api/webhooks/gmail` endpoint. We **also** run a periodic incremental sync (every 15 minutes) as a fallback — do not depend exclusively on webhooks (per `RULES.md §10`).
- **Threading**: Native Gmail thread IDs. We map to `email_threads.provider_thread_id`.
- **Labels**: Native. We map to `email_labels`.
- **Folders**: Gmail doesn't expose folders per se — labels include `INBOX`, `SENT`, `DRAFTS`, `TRASH`, `SPAM`. We model these as folders with `role` enum.
- **Send**: Gmail API `users.messages.send`.
- **Capability quirks**: Gmail rate-limits aggressively. Sync must back off on 429/503. Quota is per-user.

---

## 5. IMAP/SMTP adapter

- **API**: IMAP for read/sync; SMTP for send.
- **Auth**: OAuth 2.0 (RFC 7628 IMAP/SMTP OAuth) where supported (Gmail, Outlook, Yahoo); app-password for providers that don't support OAuth.
- **Sync**: IMAP IDLE for realtime push (where supported); periodic `FETCH 1:* (FLAGS)` poll for providers without IDLE. UIDVALIDITY + modseq for incremental sync.
- **Threading**: Group by `References` / `In-Reply-To` headers. No native thread ID.
- **Folders**: IMAP `LIST` command. Map to `email_folders`.
- **Labels**: Not native. Some providers expose flags we map to labels (e.g., `\Flagged` → `starred`). Otherwise `labels` capability is false.
- **Send**: SMTP `SEND` (with proper DKIM/SPF setup by the user's mail provider).
- **Capability quirks**: Server-side search quality varies (some support `SORT`, some don't). IDLE connections have server-side idle timeouts (typically 30 min); we re-IDLE.

---

## 6. Zoho adapter

- **API**: Zoho Mail REST API for CRUD; IMAP for full sync fallback.
- **Auth**: OAuth 2.0 (Zoho Mail scope).
- **Sync**: Zoho pushes some events via webhook (account-level); we also poll via IMAP as fallback.
- **Threading**: Zoho has its own conversation view; we group by `References` header for portability.
- **Folders/Labels**: Zoho has a hybrid folder/label system. We map folders to `email_folders` and labels to `email_labels` with `email_account_id` scoping.
- **Send**: Zoho Mail API `sendMail` (preferred) or SMTP.
- **Capability quirks**: Zoho's API has tighter rate limits than Gmail. Quota per organization, not per user.

---

## 7. Sync architecture (per provider)

The sync flow is defined in `EVENTS-AND-QUEUES.md` and `ARCHITECTURE.md`. Per-provider specifics:

### Gmail
1. Pub/Sub push → `/api/webhooks/gmail` → enqueue `email.sync { account_id, history_id }`
2. Worker: call `GmailAdapter.sync(state)` → returns added/updated/deleted message IDs
3. For each new message: enqueue `email.parse { message_id }`
4. After parse: enqueue `email.index { message_id }` (embeddings) and `email.classify { message_id }`
5. Update `email_sync_states` with new history_id

### IMAP/SMTP
1. IDLE connection receives EXISTS notification → enqueue `email.sync { account_id, folder_id }`
2. Worker: call `ImapSmtpAdapter.sync(state)` → returns new UIDs
3. Same downstream as Gmail (parse → index → classify)
4. Fallback poller (every 15 min for accounts without IDLE)

### Zoho
1. Webhook → `/api/webhooks/zoho` → enqueue `email.sync { account_id, event }`
2. Worker: call `ZohoAdapter.sync(state)` → returns message IDs
3. Same downstream as Gmail

---

## 8. Token refresh

OAuth tokens expire. The runtime refreshes tokens before they expire:

- A periodic job (every hour) scans `email_account_credentials` for tokens expiring within 1 hour.
- For each, enqueue `email.sync { account_id, refresh: true }`.
- The worker calls the provider's refresh endpoint, updates `email_account_credentials.encrypted_payload`, and proceeds with a normal sync.
- If refresh fails (revoked, network error), `email_accounts.status` is set to `expired` or `revoked`, and the user is notified in the UI.

---

## 9. Email content security

Per `RULES.md §9` and `SECURITY.md`:

- **HTML sanitization**: at ingest, `email_messages.html_body` is sanitized via an HTML allowlist (strip scripts, event handlers, dangerous tags). The raw HTML is **not** stored. The sanitized HTML is rendered in the UI with `rel="noreferrer noopener"` on links.
- **Attachments**: scanned for malware (ClamAV or provider-side scan). Suspicious attachments are quarantined; never auto-opened.
- **Prompt injection**: email content fed to the LLM is wrapped in untrusted-content markers. The LLM is instructed (system prompt) that email content is data, not instructions. The policy engine is deterministic and overrides any LLM-proposed sensitive action regardless of email content.
- **Links**: links in emails are flagged in the UI; clicking opens in a new tab with `noopener`. The agent does not auto-fetch links.
- **SSRF protection**: the agent does not fetch URLs from email content. If a future tool fetches URLs, it goes through an SSRF guard (deny private IPs, allowlist schemes).

---

## 10. Future providers

Adding a new provider (e.g., Outlook Graph API, Proton Mail Bridge) requires:

1. Implementing the `EmailProvider` interface (new adapter file).
2. Declaring the capability matrix.
3. Adding the provider to the `email_accounts.provider` enum (migration).
4. Adding auth flow (OAuth client registration or app-password flow).
5. Adding sync flow (webhook/IDLE/poll).
6. Validating capabilities against the real API (Phase-5-style exit criteria).

The runtime does not change. The tool registry does not change. The agent pipeline does not change. This is the point of the adapter model.

---

## 11. What is deferred to Phases 5-8

- Concrete adapter implementations (`GmailAdapter`, `ImapSmtpAdapter`, `ZohoAdapter`).
- OAuth client registration (Gmail, Zoho) — user-owned.
- Sync worker implementation.
- HTML sanitization library selection (likely `sanitize-html` or DOMPurify server-side).
- Attachment storage (Supabase Storage bucket) and malware scan integration.
- Capability matrix validation against real APIs.

Phase 5 produces the abstraction + a mock adapter. Phase 6 produces Gmail. Phase 7 produces IMAP/SMTP. Phase 8 produces Zoho. Each phase has its own exit criteria in `docs/plans/ROADMAP.md`.
