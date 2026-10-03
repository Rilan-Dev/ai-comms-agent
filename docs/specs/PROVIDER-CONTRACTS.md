# PROVIDER-CONTRACTS.md — Provider Abstraction Contracts

This document defines the provider abstraction contracts: the `EmailProvider` interface, the WhatsApp integration contract, and the AI/voice provider contract (delegated to Clara). Per the master operating prompt §9, email must use an adapter model with provider capability discovery.

This is a Phase 1 document. Exact TypeScript signatures are validated against real APIs in Phases 5-8 (email) and Phase 13 (WhatsApp). AI/voice provider contracts come from Clara and are not redefined here.

---

## 1. EmailProvider interface

```typescript
// packages/shared/src/email/provider.ts

export type EmailProviderCapability =
  | 'folders'
  | 'labels'
  | 'sync_incremental'
  | 'sync_full'
  | 'sync_webhook'
  | 'sync_idle'
  | 'search_server_side'
  | 'search_client_side'
  | 'drafts'
  | 'reply'
  | 'forward'
  | 'mark_read'
  | 'archive'
  | 'move'
  | 'threads'
  | 'attachments_download'
  | 'attachments_upload'
  | 'send';

export type CapabilitySet = Record<EmailProviderCapability, boolean>;

export interface EmailProvider {
  readonly providerId: 'gmail' | 'imap_smtp' | 'zoho';

  // Lifecycle
  connect(credentials: EmailCredentials): Promise<void>;
  disconnect(): Promise<void>;
  discoverCapabilities(): Promise<CapabilitySet>;
  capabilities(): CapabilitySet;

  // Folders / labels
  listFolders(): Promise<EmailFolder[]>;
  listLabels?(): Promise<EmailLabel[]>;

  // Sync
  sync(state: SyncState): Promise<SyncResult>;
  // returns: { added: MessageRef[], updated: MessageRef[], deleted: string[], new_state: SyncState }

  // Read
  listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]>;
  getThread(threadId: string): Promise<EmailMessage[]>;
  search(query: SearchQuery): Promise<EmailMessage[]>;

  // Drafts
  createDraft(params: DraftParams): Promise<DraftRef>;
  updateDraft(draftId: string, params: Partial<DraftParams>): Promise<DraftRef>;

  // Send / reply / forward (sensitive)
  send(draftId: string): Promise<SentMessageRef>;
  reply(messageId: string, params: DraftParams): Promise<SentMessageRef>;
  forward(messageId: string, to: string[]): Promise<SentMessageRef>;

  // Modify
  markRead(messageIds: string[], isRead: boolean): Promise<void>;
  archive(messageIds: string[]): Promise<void>;
  move(messageIds: string[], targetFolderId: string): Promise<void>;
  applyLabels?(messageIds: string[], labelIds: string[]): Promise<void>;

  // Attachments
  downloadAttachment(attachmentId: string): Promise<Buffer>;
  uploadAttachment?(filename: string, content: Buffer, mimeType: string): Promise<AttachmentRef>;
}

export class CapabilityNotSupported extends Error {
  constructor(providerId: string, capability: EmailProviderCapability) {
    super(`Provider ${providerId} does not support capability ${capability}`);
  }
}
```

The runtime queries `capabilities()` before invoking any optional method. If unsupported, the runtime returns a structured error to the LLM; it does not call the method.

---

## 2. Gmail adapter contract

Implements `EmailProvider` with `providerId: 'gmail'`.

- **API**: Gmail API v1 (REST).
- **Auth**: OAuth 2.0 (`https://mail.google.com/`).
- **Capabilities** (target — validated in Phase 6):
  - `folders`: true (modeled as system labels: `INBOX`, `SENT`, `DRAFTS`, `TRASH`, `SPAM`)
  - `labels`: true
  - `sync_incremental`: true (via `historyId`)
  - `sync_full`: true
  - `sync_webhook`: true (Pub/Sub)
  - `sync_idle`: false
  - `search_server_side`: true
  - `search_client_side`: true (fallback)
  - `drafts`: true
  - `reply`: true
  - `forward`: true
  - `mark_read`: true (via `modify` API)
  - `archive`: true (remove `INBOX` label)
  - `move`: true (via `modify` API — add target label, remove `INBOX`)
  - `threads`: true (native `threadId`)
  - `attachments_download`: true
  - `attachments_upload`: true (via `messages.attachments.insert`)
  - `send`: true (`messages.send`)

---

## 3. IMAP/SMTP adapter contract

Implements `EmailProvider` with `providerId: 'imap_smtp'`.

- **API**: IMAP for read/sync; SMTP for send.
- **Auth**: OAuth 2.0 (RFC 7628) where supported; app-password otherwise.
- **Capabilities** (target — validated in Phase 7):
  - `folders`: true
  - `labels`: false (some servers expose flags we map to labels)
  - `sync_incremental`: true (UIDVALIDITY + modseq)
  - `sync_full`: true
  - `sync_webhook`: false
  - `sync_idle`: true (where supported)
  - `search_server_side`: true (SORT/THREAD where supported)
  - `search_client_side`: true (fallback)
  - `drafts`: true (Drafts folder)
  - `reply`: true (References header)
  - `forward`: true
  - `mark_read`: true (`\Seen` flag)
  - `archive`: true (move to Archive folder)
  - `move`: true (`MOVE` extension or COPY+STORE+EXPUNGE)
  - `threads`: true (grouped by References header — no native thread ID)
  - `attachments_download`: true
  - `attachments_upload`: true (append to Drafts folder)
  - `send`: true (SMTP)

---

## 4. Zoho adapter contract

Implements `EmailProvider` with `providerId: 'zoho'`.

- **API**: Zoho Mail REST API for CRUD; IMAP for sync fallback.
- **Auth**: OAuth 2.0 (Zoho Mail scope).
- **Capabilities** (target — validated in Phase 8):
  - `folders`: true
  - `labels`: partial (Zoho has its own label system)
  - `sync_incremental`: true (via IMAP)
  - `sync_full`: true
  - `sync_webhook`: partial (account-level webhook for some events)
  - `sync_idle`: true (via IMAP)
  - `search_server_side`: true (via IMAP)
  - `search_client_side`: true (fallback)
  - `drafts`: true
  - `reply`: true
  - `forward`: true
  - `mark_read`: true
  - `archive`: true
  - `move`: true
  - `threads`: true (grouped by References header)
  - `attachments_download`: true
  - `attachments_upload`: true
  - `send`: true (Zoho Mail API `sendMail` or SMTP)

---

## 5. WhatsApp integration contract

WhatsApp is **not** a generic provider — the product supports only WhatsApp Business Cloud API (Meta). The integration is a single concrete implementation, not an adapter model.

```typescript
// packages/shared/src/whatsapp/client.ts

export interface WhatsAppClient {
  // Webhook verification (setup-time)
  verifyWebhook(mode: string, token: string, challenge: string): string | null;

  // Webhook event handling (runtime)
  parseWebhookEvent(body: any, signature: string): WhatsAppWebhookEvent;

  // Outbound
  send(phoneNumberId: string, to: string, message: WhatsAppOutboundMessage): Promise<{ messageId: string }>;
  sendTemplate(phoneNumberId: string, to: string, templateName: string, languageCode: string, parameters: any[]): Promise<{ messageId: string }>;

  // Templates
  listTemplates(wabaId: string): Promise<WhatsAppTemplate[]>;
  submitTemplate(wabaId: string, template: WhatsAppTemplateParams): Promise<{ templateId: string }>;
}
```

The `WhatsAppClient` is a thin wrapper over the Meta Cloud API. The agent runtime calls `send` or `sendTemplate` via the `whatsapp.send` tool (per `AI-ARCHITECTURE.md §4.2`). Template compliance is enforced before sending (per `WHATSAPP-ARCHITECTURE.md §5`).

---

## 6. AI/voice provider contracts (delegated to Clara)

AI and voice provider abstractions are **not** redefined here. They come from Clara:

- AI: `clara-core/source/src/modules/ai-core/types.ts`, `ai-core/config-types.ts`, `ai-core/providers/*`.
- Voice: `clara-core/source/src/modules/voice-core/types.ts`, `voice-core/config-types.ts`, `voice-core/providers/*`.

Our code uses Clara's interfaces directly. We do not wrap them in a second abstraction. Per-organization provider configuration is stored in `ai_provider_configs` (per `DATA-MODEL.md §9`) and resolved at runtime via Clara's `resolve.ts`.

---

## 7. Future providers

New email providers (e.g., Outlook Graph API) require:

1. New adapter implementing `EmailProvider`.
2. New entry in the `email_accounts.provider` enum (migration).
3. Capability matrix validation (Phase-5-style exit criteria).
4. Auth flow implementation (OAuth client registration).
5. Sync flow implementation (webhook/IDLE/poll).

The runtime, tool registry, and agent pipeline do not change. This is the point of the adapter model.

New voice/AI providers require extending Clara (in the Clara library, not here) and updating our pin. This is a ChatGPT-level decision, not a Z.AI decision.

---

## 8. Capability discovery runtime

At connect time, the runtime calls `provider.discoverCapabilities()` and persists the result to `email_accounts.capabilities` (jsonb). The runtime also re-discovers daily (or on provider-reported config changes).

Before invoking any operation:

```typescript
if (!provider.capabilities()[capability]) {
  throw new CapabilityNotSupported(provider.providerId, capability);
}
return await provider[operation](...args);
```

The agent runtime catches `CapabilityNotSupported` and returns a structured error to the LLM: "This account's provider does not support {capability}. The agent cannot perform {operation}." The LLM rephrases for the user.
