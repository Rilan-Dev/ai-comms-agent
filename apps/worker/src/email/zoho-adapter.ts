import type {
  CapabilitySet, DraftParams, DraftRef, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: false, sync_full: true,
  sync_webhook: true, sync_idle: false, search_server_side: true,
  search_client_side: true, drafts: true, reply: true, forward: false,
  mark_read: true, archive: true, move: true, threads: true,
  attachments_download: false, attachments_upload: false, send: false,
};


function zohoAccountsDomain(apiDomain: string): string {
  const hostname = new URL(apiDomain).hostname;
  const suffixes: Array<[RegExp, string]> = [
    [/^mail\.zoho\.com$/, "https://accounts.zoho.com"],
    [/^mail\.zoho\.eu$/, "https://accounts.zoho.eu"],
    [/^mail\.zoho\.in$/, "https://accounts.zoho.in"],
    [/^mail\.zoho\.au$/, "https://accounts.zoho.au"],
    [/^mail\.zoho\.jp$/, "https://accounts.zoho.jp"],
    [/^mail\.zoho\.sa$/, "https://accounts.zoho.sa"],
    [/^mail\.zohocloud\.ca$/, "https://accounts.zohocloud.ca"],
  ];
  const match = suffixes.find(([pattern]) => pattern.test(hostname));
  if (!match) throw new Error("Zoho API domain has no trusted OAuth accounts endpoint");
  return match[1];
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Zoho requires ${name}`);
  return value;
}

function normalizeZohoApiDomain(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Zoho API domain is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Zoho API domain must be an HTTPS origin");
  }
  const allowed = [/^mail\.zoho\.(com|eu|in|au|jp|sa)$/, /^mail\.zohocloud\.ca$/];
  if (!allowed.some((pattern) => pattern.test(url.hostname)) || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Zoho API domain is not an allowed Zoho Mail endpoint");
  }
  return url.origin;
}

export class ZohoAdapter implements EmailProvider {
  readonly providerId = "zoho" as const;
  private accessToken?: string;
  private apiDomain?: string;
  private accountId?: string;
  private refreshToken?: string;
  private expiresAt?: number;
  private refreshPromise?: Promise<void>;

  async connect(credentials: EmailCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error("Zoho requires an OAuth access token");
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.apiDomain = normalizeZohoApiDomain(required(credentials.api_domain, "api_domain"));
    this.accountId = credentials.account_id;
    this.expiresAt = credentials.expires_at ? Date.parse(credentials.expires_at) : undefined;

    const accounts = await this.request("/api/accounts");
    const remote = accounts.data?.[0];
    if (!this.accountId && remote?.accountId) this.accountId = String(remote.accountId);
    if (!this.accountId) throw new Error("Zoho returned no mail account");
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.apiDomain = undefined;
    this.accountId = undefined;
    this.expiresAt = undefined;
    this.refreshPromise = undefined;
  }

  capabilities(): CapabilitySet { return { ...CAPABILITIES }; }
  async discoverCapabilities(): Promise<CapabilitySet> { return { ...CAPABILITIES }; }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new Error("Zoho access token expired and no refresh token is available");
    if (this.refreshPromise) return this.refreshPromise;
    const accountsDomain = zohoAccountsDomain(this.apiDomain!);
    this.refreshPromise = (async () => {
      const clientId = process.env.ZOHO_OAUTH_CLIENT_ID;
      const clientSecret = process.env.ZOHO_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("Zoho OAuth client configuration is missing");
      const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken!,
          grant_type: "refresh_token",
        }),
      });
      if (!response.ok) throw new Error(`Zoho token refresh failed: ${response.status}`);
      const data = await response.json() as { access_token?: string; expires_in?: number; api_domain?: string };
      if (!data.access_token) throw new Error("Zoho token refresh returned no access token");
      this.accessToken = data.access_token;
      this.expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
      if (data.api_domain) this.apiDomain = normalizeZohoApiDomain(data.api_domain);
    })();
    try { await this.refreshPromise; } finally { this.refreshPromise = undefined; }
  }

  private async request(path: string, init?: RequestInit, retried = false): Promise<any> {
    if (!this.accessToken || !this.apiDomain || !this.accountId && path !== "/api/accounts") {
      throw new Error("Zoho adapter is not connected");
    }
    if (this.expiresAt && this.expiresAt <= Date.now() + 30_000) await this.refreshAccessToken();
    const response = await fetch(`${this.apiDomain}${path}`, {
      ...init,
      headers: { authorization: `Zoho-oauthtoken ${this.accessToken}`, accept: "application/json", "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 401 && !retried && this.refreshToken) {
      await this.refreshAccessToken();
      return this.request(path, init, true);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Zoho Mail API ${response.status}: ${body.slice(0, 500)}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async listFolders(): Promise<EmailFolder[]> {
    const data = await this.request(`/api/accounts/${this.accountId}/folders`);
    return (data.data ?? []).map((folder: any) => {
      const lower = String(folder.folderName ?? folder.name ?? "").toLowerCase();
      const role = lower === "inbox" ? "inbox" : lower === "sent" ? "sent" : lower === "drafts" ? "drafts" : lower === "trash" ? "trash" : lower === "spam" ? "spam" : lower === "archive" ? "archive" : "custom";
      return {
        id: String(folder.folderId ?? folder.id),
        email_account_id: String(this.accountId),
        provider_folder_id: String(folder.folderId ?? folder.id),
        name: String(folder.folderName ?? folder.name),
        role,
        unread_count: Number(folder.unreadCount ?? 0),
      };
    });
  }

  async listLabels(): Promise<EmailLabel[]> {
    const data = await this.request(`/api/accounts/${this.accountId}/labels`);
    return (data.data ?? []).map((label: any) => ({
      id: String(label.labelId ?? label.id),
      email_account_id: String(this.accountId),
      provider_label_id: String(label.labelId ?? label.id),
      name: String(label.labelName ?? label.name),
      label_type: "user" as const,
    }));
  }

  async sync(state: SyncState): Promise<SyncResult> {
    return {
      added: [], updated: [], deleted: [],
      new_state: { ...state, sync_mode: "incremental", last_sync_at: new Date().toISOString() },
    };
  }

  private normalizeMessage(message: any, folderId = String(message?.folderId ?? "")): EmailMessage {
    const to = String(message.toAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);
    const cc = String(message.ccAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);
    return {
      id: String(message.messageId),
      email_account_id: String(this.accountId),
      thread_id: String(message.threadId ?? message.messageId),
      folder_id: folderId,
      provider_message_id: String(message.messageId),
      message_id_header: String(message.messageIdHeader ?? ""),
      in_reply_to: message.inReplyTo ? String(message.inReplyTo) : undefined,
      references: message.references ? String(message.references).split(/\s+/).filter(Boolean) : undefined,
      from_address: String(message.fromAddress ?? ""),
      to_addresses: to,
      cc_addresses: cc,
      bcc_addresses: String(message.bccAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean),
      subject: String(message.subject ?? ""),
      text_body: String(message.content ?? message.summary ?? ""),
      html_body: message.content ? String(message.content) : undefined,
      snippet: String(message.summary ?? message.content ?? "").slice(0, 240),
      received_at: new Date(Number(message.receivedTime ?? message.date ?? Date.now())).toISOString(),
      is_read: String(message.status ?? "1") !== "0",
      is_starred: String(message.flagid ?? "").includes("flag"),
      is_draft: String(message.folderName ?? "").toLowerCase() === "drafts",
      is_outbound: String(message.fromAddress ?? "").toLowerCase() === String(message.accountAddress ?? "").toLowerCase(),
      importance_score: Number(message.priority ?? 3) >= 4 ? 0.7 : 0.3,
      action_required: false,
      has_attachments: String(message.hasAttachment ?? "0") === "1",
      embedding_status: "pending",
    };
  }

  async listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    const query = new URLSearchParams({ folderId, start: "1" });
    if (opts.limit) query.set("limit", String(Math.min(opts.limit, 200)));
    if (opts.cursor) query.set("start", opts.cursor);
    const data = await this.request(`/api/accounts/${this.accountId}/messages/view?${query}`);
    return (data.data ?? []).map((message: any) => this.normalizeMessage(message, folderId));
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    const data = await this.request(`/api/accounts/${this.accountId}/messages/${encodeURIComponent(messageId)}/originalmessage`);
    if (!data) return null;
    return this.normalizeMessage({ ...(data.data ?? data), messageId });
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    const data = await this.request(`/api/accounts/${this.accountId}/messages/search?searchKey=threadId&searchValue=${encodeURIComponent(threadId)}`);
    return (data.data ?? []).map((message: any) => this.normalizeMessage(message));
  }

  async search(query: SearchQuery): Promise<EmailMessage[]> {
    const term = query.text ?? query.subject ?? query.from;
    if (!term) throw new Error("Zoho search requires text, subject, or from");
    const data = await this.request(`/api/accounts/${this.accountId}/messages/search?searchKey=content&searchValue=${encodeURIComponent(term)}`);
    return (data.data ?? []).map((message: any) => this.normalizeMessage(message));
  }

  async createDraft(params: DraftParams): Promise<DraftRef> {
    const data = await this.request(`/api/accounts/${this.accountId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        mode: "draft",
        fromAddress: await this.senderAddress(),
        toAddress: params.to.join(","),
        ccAddress: params.cc?.join(","),
        bccAddress: params.bcc?.join(","),
        subject: params.subject,
        content: params.body_html ?? params.body_text,
        mailFormat: params.body_html ? "html" : "plaintext",
        inReplyTo: params.reply_to_message_id,
      }),
    });
    const id = data?.data?.messageId ?? data?.messageId;
    if (!id) throw new Error("Zoho did not return a draft message id");
    return { draft_id: String(id), account_id: String(this.accountId) };
  }

  async updateDraft(_draftId: string, _params: Partial<DraftParams>): Promise<DraftRef> {
    throw new Error("Zoho draft update requires the email worker draft repository");
  }

  async deleteDraft(draftId: string): Promise<void> {
    const folders = await this.listFolders();
    const folderId = folders.find((folder) => folder.role === "drafts")?.provider_folder_id ?? "DRAFTS";
    await this.request(`/api/accounts/${this.accountId}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  }

  async sendDraft(_draftId: string): Promise<SentMessageRef> {
    throw new Error("Zoho draft send requires the email worker draft repository");
  }

  async send(draftId: string): Promise<SentMessageRef> { return this.sendDraft(draftId); }

  async reply(messageId: string, params: DraftParams): Promise<SentMessageRef> {
    const data = await this.request(`/api/accounts/${this.accountId}/messages/${encodeURIComponent(messageId)}`, {
      method: "POST",
      body: JSON.stringify({
        action: "reply",
        fromAddress: await this.senderAddress(),
        toAddress: params.to.join(","),
        ccAddress: params.cc?.join(","),
        bccAddress: params.bcc?.join(","),
        subject: params.subject,
        content: params.body_html ?? params.body_text,
        mailFormat: params.body_html ? "html" : "plaintext",
      }),
    });
    const id = data?.data?.messageId ?? data?.messageId;
    if (!id) throw new Error("Zoho did not return a sent message id");
    return { message_id: String(id), provider_message_id: String(id) };
  }

  async forward(_messageId: string, _to: string[]): Promise<SentMessageRef> {
    throw new Error("Zoho forward requires the email worker message composer");
  }

  async markRead(messageIds: string[], isRead: boolean): Promise<void> {
    await this.request(`/api/accounts/${this.accountId}/updatemessage`, {
      method: "PUT",
      body: JSON.stringify({ mode: isRead ? "markAsRead" : "markAsUnread", messageId: messageIds.map(Number) }),
    });
  }

  async markUnread(messageIds: string[]): Promise<void> { return this.markRead(messageIds, false); }

  async archive(messageIds: string[]): Promise<void> {
    await this.request(`/api/accounts/${this.accountId}/updatemessage`, {
      method: "PUT",
      body: JSON.stringify({ mode: "archive", messageId: messageIds.map(Number) }),
    });
  }

  async move(messageIds: string[], targetFolderId: string): Promise<void> {
    await this.request(`/api/accounts/${this.accountId}/updatemessage`, {
      method: "PUT",
      body: JSON.stringify({ mode: "move", messageId: messageIds.map(Number), folderId: targetFolderId }),
    });
  }

  async addLabel(messageIds: string[], labelId: string): Promise<void> {
    await this.request(`/api/accounts/${this.accountId}/updatemessage`, {
      method: "PUT",
      body: JSON.stringify({ mode: "addLabel", messageId: messageIds.map(Number), labelId: [Number(labelId)] }),
    });
  }

  async removeLabel(messageIds: string[], labelId: string): Promise<void> {
    await this.request(`/api/accounts/${this.accountId}/updatemessage`, {
      method: "PUT",
      body: JSON.stringify({ mode: "removeLabel", messageId: messageIds.map(Number), labelId: [Number(labelId)] }),
    });
  }

  async downloadAttachment(_attachmentId: string): Promise<Buffer> {
    throw new Error("Zoho attachment retrieval requires folder/message context from the email worker");
  }

  private async senderAddress(): Promise<string> {
    const data = await this.request(`/api/accounts/${this.accountId}`);
    const address = data?.data?.emailAddress ?? data?.data?.email ?? data?.emailAddress;
    if (!address) throw new Error("Zoho account has no sender address");
    return String(address);
  }
}
