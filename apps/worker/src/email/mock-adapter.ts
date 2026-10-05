import {
  CapabilityNotSupported,
  type CapabilitySet,
  type DraftParams,
  type EmailCredentials,
  type EmailFolder,
  type EmailLabel,
  type EmailMessage,
  type EmailProvider,
  type EmailProviderCapability,
  type EmailThread,
  type ListOptions,
  type SearchQuery,
  type SentMessageRef,
  type SyncResult,
  type SyncState,
} from "@ai-comms-agent/shared";

const ALL_CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: true, sync_full: true,
  sync_webhook: false, sync_idle: false, search_server_side: true,
  search_client_side: true, drafts: true, reply: true, forward: true,
  mark_read: true, archive: true, move: true, threads: true,
  attachments_download: true, attachments_upload: true, send: true,
};

export class MockEmailProvider implements EmailProvider {
  readonly providerId = "imap_smtp" as const;
  private connected = false;
  private readonly messages: EmailMessage[] = [];
  private readonly drafts = new Map<string, DraftParams>();

  async connect(_credentials: EmailCredentials): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  async discoverCapabilities(): Promise<CapabilitySet> { return { ...ALL_CAPABILITIES }; }
  capabilities(): CapabilitySet { return { ...ALL_CAPABILITIES }; }

  private ensureConnected(): void {
    if (!this.connected) throw new Error("Mock email provider is not connected");
  }

  async listFolders(): Promise<EmailFolder[]> {
    this.ensureConnected();
    return [{ id: "mock-inbox", email_account_id: "mock-account", provider_folder_id: "INBOX", name: "Inbox", role: "inbox", unread_count: 0 }];
  }

  async listLabels(): Promise<EmailLabel[]> {
    this.ensureConnected();
    return [];
  }

  async sync(state: SyncState): Promise<SyncResult> {
    this.ensureConnected();
    return { added: [], updated: [], deleted: [], new_state: { ...state, sync_mode: "incremental", last_sync_at: new Date().toISOString() } };
  }

  async listMessages(_folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    this.ensureConnected();
    return this.messages.slice(0, Math.min(opts.limit ?? 50, 100));
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    this.ensureConnected();
    return this.messages.find((m) => m.id === messageId) ?? null;
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    this.ensureConnected();
    return this.messages.filter((m) => m.thread_id === threadId);
  }

  async search(query: SearchQuery): Promise<EmailMessage[]> {
    this.ensureConnected();
    return this.messages.filter((m) => {
      if (query.from && !m.from_address.toLowerCase().includes(query.from.toLowerCase())) return false;
      if (query.subject && !m.subject.toLowerCase().includes(query.subject.toLowerCase())) return false;
      if (query.text && !m.text_body.toLowerCase().includes(query.text.toLowerCase())) return false;
      return true;
    });
  }

  async createDraft(params: DraftParams) {
    this.ensureConnected();
    const draftId = `mock-draft-${this.drafts.size + 1}`;
    this.drafts.set(draftId, params);
    return { draft_id: draftId, account_id: "mock-account" };
  }

  async updateDraft(draftId: string, params: Partial<DraftParams>) {
    this.ensureConnected();
    const existing = this.drafts.get(draftId);
    if (!existing) throw new Error(`Unknown draft: ${draftId}`);
    this.drafts.set(draftId, { ...existing, ...params });
    return { draft_id: draftId, account_id: "mock-account" };
  }

  async deleteDraft(draftId: string): Promise<void> {
    this.ensureConnected();
    this.drafts.delete(draftId);
  }

  async sendDraft(draftId: string): Promise<SentMessageRef> {
    this.ensureConnected();
    if (!this.drafts.has(draftId)) throw new Error(`Unknown draft: ${draftId}`);
    return { message_id: `mock-sent-${draftId}`, provider_message_id: `mock-provider-${draftId}` };
  }

  async send(draftId: string): Promise<SentMessageRef> {
    return this.sendDraft(draftId);
  }

  async reply(messageId: string, params: DraftParams): Promise<SentMessageRef> {
    const draft = await this.createDraft({ ...params, reply_to_message_id: messageId });
    return this.send(draft.draft_id);
  }

  async forward(messageId: string, to: string[]): Promise<SentMessageRef> {
    const draft = await this.createDraft({ to, subject: `Fwd: ${messageId}`, body_text: `Forwarded message ${messageId}` });
    return this.send(draft.draft_id);
  }

  async markRead(_messageIds: string[], _isRead: boolean): Promise<void> { this.ensureConnected(); }
  async markUnread(messageIds: string[]): Promise<void> {
    await this.markRead(messageIds, false);
  }
  async archive(_messageIds: string[]): Promise<void> { this.ensureConnected(); }
  async move(_messageIds: string[], _targetFolderId: string): Promise<void> { this.ensureConnected(); }
  async downloadAttachment(attachmentId: string): Promise<Buffer> {
    this.ensureConnected();
    if (!attachmentId) throw new Error("attachmentId is required");
    return Buffer.from("");
  }
  async uploadAttachment(filename: string, content: Buffer, mimeType: string) {
    this.ensureConnected();
    if (!filename || !mimeType) throw new Error("filename and mimeType are required");
    return { attachment_id: `mock-attachment-${Date.now()}`, filename, mime_type: mimeType, size_bytes: content.byteLength };
  }
}

export function assertEmailCapability(provider: EmailProvider, capability: EmailProviderCapability): void {
  if (!provider.capabilities()[capability]) {
    throw new CapabilityNotSupported(provider.providerId, capability);
  }
}
