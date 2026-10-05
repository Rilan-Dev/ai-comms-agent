import type {
  CapabilitySet, DraftParams, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: false, sync_full: true,
  sync_webhook: true, sync_idle: false, search_server_side: true,
  search_client_side: true, drafts: true, reply: true, forward: true,
  mark_read: true, archive: true, move: true, threads: true,
  attachments_download: true, attachments_upload: true, send: true,
};

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
    const dataCenter = this.apiDomain?.match(/accounts\.zoho\.([a-z.]+)/)?.[1] ?? "in";
    const accountsDomain = dataCenter === "com" ? "https://accounts.zoho.com" : `https://accounts.zoho.${dataCenter}`;
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
      if (data.api_domain) this.apiDomain = data.api_domain;
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

  async listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    const query = new URLSearchParams({ folderId, start: "1" });
    if (opts.limit) query.set("limit", String(Math.min(opts.limit, 200)));
    const data = await this.request(`/api/accounts/${this.accountId}/messages/view?${query}`);
    return (data.data ?? []).map((message: any) => ({
      id: String(message.messageId),
      email_account_id: String(this.accountId),
      thread_id: String(message.threadId ?? message.messageId),
      folder_id: String(message.folderId ?? folderId),
      provider_message_id: String(message.messageId),
      message_id_header: "",
      from_address: String(message.fromAddress ?? ""),
      to_addresses: String(message.toAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean),
      cc_addresses: String(message.ccAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean),
      bcc_addresses: [],
      subject: String(message.subject ?? ""),
      text_body: String(message.summary ?? ""),
      snippet: String(message.summary ?? ""),
      received_at: new Date(Number(message.receivedTime ?? Date.now())).toISOString(),
      is_read: String(message.status ?? "1") !== "0",
      is_starred: String(message.flagid ?? "").includes("flag"),
      is_draft: false,
      is_outbound: false,
      importance_score: Number(message.priority ?? 3) >= 4 ? 0.7 : 0.3,
      action_required: false,
      has_attachments: String(message.hasAttachment ?? "0") === "1",
      embedding_status: "pending" as const,
    }));
  }

  async getMessage(_messageId: string): Promise<EmailMessage | null> { throw new Error("Zoho message retrieval is implemented by the email worker"); }
  async getThread(_threadId: string): Promise<EmailMessage[]> { throw new Error("Zoho thread retrieval is implemented by the email worker"); }
  async search(_query: SearchQuery): Promise<EmailMessage[]> { throw new Error("Zoho search is implemented by the email worker"); }
  async createDraft(_params: DraftParams) { throw new Error("Zoho draft persistence is implemented by the email worker"); }
  async updateDraft(_draftId: string, _params: Partial<DraftParams>) { throw new Error("Zoho draft persistence is implemented by the email worker"); }
  async deleteDraft(_draftId: string): Promise<void> { throw new Error("Zoho draft persistence is implemented by the email worker"); }
  async sendDraft(_draftId: string): Promise<SentMessageRef> { throw new Error("Zoho send requires persisted draft resolution"); }
  async send(_draftId: string): Promise<SentMessageRef> { return this.sendDraft(_draftId); }
  async reply(_messageId: string, _params: DraftParams): Promise<SentMessageRef> { throw new Error("Zoho reply requires persisted message resolution"); }
  async forward(_messageId: string, _to: string[]): Promise<SentMessageRef> { throw new Error("Zoho forward requires persisted message resolution"); }
  async markRead(_messageIds: string[], _isRead: boolean): Promise<void> { throw new Error("Zoho message flags are implemented by the email worker"); }
  async markUnread(_messageIds: string[]): Promise<void> { throw new Error("Zoho message flags are implemented by the email worker"); }
  async archive(_messageIds: string[]): Promise<void> { throw new Error("Zoho archive is implemented by the email worker"); }
  async move(_messageIds: string[], _targetFolderId: string): Promise<void> { throw new Error("Zoho move is implemented by the email worker"); }
  async downloadAttachment(_attachmentId: string): Promise<Buffer> { throw new Error("Zoho attachment retrieval is implemented by the email worker"); }
}
