/**
 * Email provider abstraction — adapter model with capability discovery.
 * Per docs/architecture/EMAIL-PROVIDER-ARCHITECTURE.md and docs/specs/PROVIDER-CONTRACTS.md.
 *
 * The provider contract and capability discovery are shared across the active Gmail,
 * IMAP/SMTP, and Zoho adapter implementations. Provider-specific runtime completeness
 * is tracked by the roadmap and must not be inferred from registration alone.
 */

export type EmailProviderType = "gmail" | "imap_smtp" | "zoho" | "microsoft_graph";

export type EmailProviderCapability =
  | "folders"
  | "labels"
  | "sync_incremental"
  | "sync_full"
  | "sync_webhook"
  | "sync_idle"
  | "search_server_side"
  | "search_client_side"
  | "drafts"
  | "reply"
  | "forward"
  | "mark_read"
  | "archive"
  | "move"
  | "threads"
  | "attachments_download"
  | "attachments_upload"
  | "send";

export type CapabilitySet = Record<EmailProviderCapability, boolean>;

export interface EmailAccount {
  id: string;
  organization_id: string;
  provider: EmailProviderType;
  email_address: string;
  display_name?: string;
  capabilities: CapabilitySet;
  status: "connected" | "pending" | "revoked" | "error" | "disconnected";
  last_sync_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailFolder {
  id: string;
  email_account_id: string;
  provider_folder_id: string;
  name: string;
  parent_id?: string | null;
  role: "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive" | "custom";
  unread_count: number;
  last_synced_at?: string;
}

export interface EmailLabel {
  id: string;
  email_account_id: string;
  provider_label_id: string;
  name: string;
  color?: string;
  label_type: "system" | "user";
}

export interface EmailMessage {
  id: string;
  email_account_id: string;
  thread_id: string;
  folder_id: string;
  provider_message_id?: string;
  message_id_header: string;
  in_reply_to?: string;
  references?: string[];
  from_address: string;
  from_name?: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  text_body: string;
  html_body?: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_outbound: boolean;
  importance_score: number;
  action_required: boolean;
  has_attachments: boolean;
  embedding_status: "pending" | "indexed" | "failed" | "skipped";
}

export interface EmailThread {
  id: string;
  email_account_id: string;
  provider_thread_id?: string;
  subject: string;
  snippet: string;
  last_message_at: string;
  message_count: number;
  is_unread: boolean;
  importance_score: number;
  action_required: boolean;
}

export interface SyncState {
  cursor?: string;
  history_token?: string;
  last_sync_at: string;
  sync_mode: "initial" | "incremental";
}

export interface SyncResult {
  added: Array<{ message_id: string; provider_message_id: string }>;
  updated: Array<{ message_id: string; provider_message_id: string }>;
  deleted: string[];
  new_state: SyncState;
}

export interface SearchQuery {
  from?: string;
  subject?: string;
  date_from?: string;
  date_to?: string;
  label?: string;
  folder?: string;
  text?: string;
  semantic?: string;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface DraftParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  reply_to_message_id?: string;
  forward_of_message_id?: string;
}

export interface DraftRef {
  draft_id: string;
  account_id: string;
}

export interface SentMessageRef {
  message_id: string;
  provider_message_id: string;
}

export interface AttachmentRef {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface EmailProvider {
  readonly providerId: EmailProviderType;

  connect(credentials: EmailCredentials): Promise<void>;
  disconnect(): Promise<void>;
  discoverCapabilities(): Promise<CapabilitySet>;
  capabilities(): CapabilitySet;

  listFolders(): Promise<EmailFolder[]>;
  listLabels?(): Promise<EmailLabel[]>;

  sync(state: SyncState): Promise<SyncResult>;

  listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]>;
  getMessage(messageId: string): Promise<EmailMessage | null>;
  getThread(threadId: string): Promise<EmailMessage[]>;
  search(query: SearchQuery): Promise<EmailMessage[]>;

  createDraft(params: DraftParams): Promise<DraftRef>;
  updateDraft(draftId: string, params: Partial<DraftParams>): Promise<DraftRef>;
  deleteDraft(draftId: string): Promise<void>;

  sendDraft(draftId: string): Promise<SentMessageRef>;
  /** @deprecated Use sendDraft for an explicit draft operation. */
  send(draftId: string): Promise<SentMessageRef>;
  reply(messageId: string, params: DraftParams): Promise<SentMessageRef>;
  forward(messageId: string, to: string[]): Promise<SentMessageRef>;

  markRead(messageIds: string[], isRead: boolean): Promise<void>;
  markUnread(messageIds: string[]): Promise<void>;
  archive(messageIds: string[]): Promise<void>;
  move(messageIds: string[], targetFolderId: string): Promise<void>;
  addLabel?(messageIds: string[], labelId: string): Promise<void>;
  removeLabel?(messageIds: string[], labelId: string): Promise<void>;
  applyLabels?(messageIds: string[], labelIds: string[]): Promise<void>;

  downloadAttachment(attachmentId: string): Promise<Buffer>;
  uploadAttachment?(filename: string, content: Buffer, mimeType: string): Promise<AttachmentRef>;
}

export interface EmailCredentials {
  credential_type: "oauth_token" | "password" | "app_password";
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  password?: string;
  username?: string;
  host?: string;
  port?: number;
  imap_host?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_port?: number;
  tls?: boolean;
  scopes?: string[];
  api_domain?: string;
  account_id?: string;
  data_center?: string;
  /** OAuth client used for this account; these fields only exist inside decrypted server-side credentials. */
  oauth_client_id?: string;
  oauth_client_secret?: string;
  zoho_client_id?: string;
  zoho_client_secret?: string;
  oauth_config_id?: string;
  zoho_config_id?: string;
  microsoft_tenant_id?: string;
  microsoft_client_id?: string;
  microsoft_client_secret?: string;
  microsoft_user_id?: string;
  microsoft_graph_client_state?: string;
}

export class CapabilityNotSupported extends Error {
  constructor(
    public readonly providerId: string,
    public readonly capability: EmailProviderCapability,
  ) {
    super(`Provider ${providerId} does not support capability ${capability}`);
    this.name = "CapabilityNotSupported";
  }
}
