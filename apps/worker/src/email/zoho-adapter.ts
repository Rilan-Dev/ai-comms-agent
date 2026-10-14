import type {
  CapabilitySet, DraftParams, DraftRef, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";
import { parseRfc822 } from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: true, sync_full: true,
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
  private oauthClientId?: string;
  private oauthClientSecret?: string;
  private readonly draftMessageIds = new Set<string>();
  private readonly messageFolderById = new Map<string, string>();

  async connect(credentials: EmailCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error("Zoho requires an OAuth access token");
    const stored = credentials as unknown as Record<string, unknown>;
    this.oauthClientId = typeof stored.zoho_client_id === "string" ? stored.zoho_client_id : undefined;
    this.oauthClientSecret = typeof stored.zoho_client_secret === "string" ? stored.zoho_client_secret : undefined;
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.apiDomain = normalizeZohoApiDomain(required(credentials.api_domain, "api_domain"));
  console.error("[zoho-adapter] api_domain:", credentials.api_domain, "type:", typeof credentials.api_domain, "normalized:", this.apiDomain);
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
    this.oauthClientId = undefined;
    this.oauthClientSecret = undefined;
    this.draftMessageIds.clear();
    this.messageFolderById.clear();
  }

  capabilities(): CapabilitySet { return { ...CAPABILITIES }; }
  async discoverCapabilities(): Promise<CapabilitySet> { return { ...CAPABILITIES }; }

  getCredentialSnapshot(): EmailCredentials {
    if (!this.accessToken || !this.apiDomain || !this.accountId) {
      throw new Error("Zoho adapter is not connected");
    }
    return {
      credential_type: "oauth_token",
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_at: this.expiresAt ? new Date(this.expiresAt).toISOString() : undefined,
      api_domain: this.apiDomain,
      account_id: this.accountId,
      zoho_client_id: this.oauthClientId,
      zoho_client_secret: this.oauthClientSecret,
    };
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new Error("Zoho access token expired and no refresh token is available");
    if (this.refreshPromise) return this.refreshPromise;
    const accountsDomain = zohoAccountsDomain(this.apiDomain!);
    this.refreshPromise = (async () => {
      const clientId = this.oauthClientId;
      const clientSecret = this.oauthClientSecret;
      if (!clientId || !clientSecret) throw new Error("Zoho OAuth client configuration is missing from the encrypted account credential.");
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
      // NOTE: Zoho's OAuth token-refresh response includes an `api_domain`
      // field, but it returns the GENERAL Zoho API endpoint
      // (https://www.zohoapis.com), NOT the Mail-specific endpoint
      // (https://mail.zoho.com). Overwriting this.apiDomain with that value
      // would fail the SSRF whitelist in normalizeZohoApiDomain() and break
      // every subsequent Mail API call. The Mail API domain is correctly
      // set ONCE at connect() time from connection_config (saved by the
      // OAuth callback from the MAIL_API_DOMAINS map keyed by dataCenter).
      // Do NOT overwrite it here.
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
    const folders = await this.listFolders();
    const added: SyncResult["added"] = [];
    const updated: SyncResult["updated"] = [];
    const pageSize = 100;

    if (state.sync_mode === "incremental" && state.history_token === "zoho-full-v1") {
      // Zoho's REST API does not expose a stable mailbox-wide history cursor.
      // Refresh the newest page in each folder on the scheduled poll; the
      // PostgreSQL upsert key makes this bounded refresh idempotent.
      for (const folder of folders) {
        const page = await this.listMessages(folder.provider_folder_id, { limit: pageSize, cursor: "1" });
        for (const message of page) {
          const id = message.provider_message_id || message.id;
          if (id) {
            updated.push({ message_id: id, provider_message_id: id });
            this.messageFolderById.set(id, folder.provider_folder_id);
            if (folder.role === "drafts") this.draftMessageIds.add(id);
          }
        }
      }
      return {
        added, updated, deleted: [],
        new_state: { ...state, cursor: undefined, history_token: "zoho-full-v1", sync_mode: "incremental", last_sync_at: new Date().toISOString() },
      };
    }

    // Keep the folder-local offset in the durable cursor, so large initial
    // mailboxes drain over multiple worker ticks rather than stopping at page 1.
    const [folderIndexRaw, startRaw] = (state.cursor ?? "0:1").split(":");
    let folderIndex = Number(folderIndexRaw);
    let start = Number(startRaw);
    if (!Number.isInteger(folderIndex) || folderIndex < 0 || !Number.isInteger(start) || start < 1) {
      folderIndex = 0;
      start = 1;
    }
    let pagesRead = 0;
    while (folderIndex < folders.length && pagesRead < 2) {
      const folder = folders[folderIndex]!;
      const page = await this.listMessages(folder.provider_folder_id, { limit: pageSize, cursor: String(start) });
      for (const message of page) {
        const id = message.provider_message_id || message.id;
        if (id) {
          added.push({ message_id: id, provider_message_id: id });
          this.messageFolderById.set(id, folder.provider_folder_id);
          if (folder.role === "drafts") this.draftMessageIds.add(id);
        }
      }
      pagesRead += 1;
      if (page.length >= pageSize) {
        start += page.length;
      } else {
        folderIndex += 1;
        start = 1;
      }
    }
    const hasMore = folderIndex < folders.length;
    return {
      added, updated, deleted: [],
      new_state: {
        ...state,
        cursor: hasMore ? `${folderIndex}:${start}` : undefined,
        history_token: hasMore ? state.history_token : "zoho-full-v1",
        sync_mode: hasMore ? "initial" : "incremental",
        last_sync_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Normalize a Zoho Mail API message object into our EmailMessage shape.
   *
   * The Zoho API returns DIFFERENT shapes depending on the endpoint:
   *   - /messages/view (list): { subject, fromAddress, toAddress, content, ... }
   *     metadata with body content as a string field
   *   - /messages/{id}/originalmessage: returns raw RFC822 source as the
   *     `content` field (full MIME source — "Delivered-To: ... Return-Path:
   *     ... Subject: ... <body>")
   *
   * The /originalmessage endpoint is what getMessage() calls during sync
   * (because Zoho's structured /messages/{id} endpoint doesn't return
   * body content). So when `content` looks like RFC822 source (starts
   * with "Delivered-To:" / "Received:" / "Return-Path:"), we PARSE it
   * to extract the real subject / from / to / text_body / html_body.
   *
   * This fixes the bug where Zoho emails showed raw RFC822 headers as
   * the snippet (e.g., "Delivered-To: rilan@... Return-Path: <...> ARC-Seal:...")
   * and "(No subject)" as the subject.
   */
  private normalizeMessage(message: any, folderId = String(message?.folderId ?? "")): EmailMessage {
    const rawContent = String(message.content ?? message.summary ?? "");
    const isRfc822Source = /^[A-Za-z-]+:/i.test(rawContent) && (
      rawContent.startsWith("Delivered-To:") ||
      rawContent.startsWith("Return-Path:") ||
      rawContent.startsWith("Received:") ||
      rawContent.startsWith("MIME-Version:") ||
      rawContent.startsWith("ARC-Seal:")
    );

    // If we have raw RFC822 source, parse it and use the parsed values
    // as the source of truth (Zoho's API metadata fields may be empty
    // or stale on the /originalmessage endpoint).
    const parsed = isRfc822Source ? parseRfc822(rawContent) : null;

    const to = parsed
      ? parsed.to
      : String(message.toAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);
    const cc = parsed
      ? parsed.cc
      : String(message.ccAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);

    const subject = parsed ? parsed.subject : String(message.subject ?? "");
    const textBody = parsed ? parsed.text_body : rawContent;
    const htmlBody = parsed ? parsed.html_body : (message.content ? String(message.content) : undefined);
    const fromAddress = parsed ? parsed.from : String(message.fromAddress ?? "");
    const fromName = parsed ? parsed.from_name : "";
    const messageIdHeader = parsed ? parsed.message_id : String(message.messageIdHeader ?? "");
    const inReplyTo = parsed ? parsed.in_reply_to : (message.inReplyTo ? String(message.inReplyTo) : "");
    const references = parsed
      ? parsed.references
      : (message.references ? String(message.references).split(/\s+/).filter(Boolean) : undefined);

    // Build a clean snippet from the text body — strip remaining header
    // artifacts and collapse whitespace.
    const snippetText = textBody || rawContent;
    const snippet = snippetText
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

    return {
      id: String(message.messageId),
      email_account_id: String(this.accountId),
      thread_id: String(message.threadId ?? message.messageId),
      folder_id: folderId,
      provider_message_id: String(message.messageId),
      message_id_header: messageIdHeader,
      in_reply_to: inReplyTo || undefined,
      references: references && references.length ? references : undefined,
      from_address: fromAddress,
      from_name: fromName || undefined,
      to_addresses: to,
      cc_addresses: cc,
      bcc_addresses: String(message.bccAddress ?? "").split(",").map((v: string) => v.trim()).filter(Boolean),
      subject: subject || "(No subject)",
      text_body: textBody,
      html_body: htmlBody,
      snippet,
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
    const normalized = this.normalizeMessage(
      { ...(data.data ?? data), messageId },
      this.messageFolderById.get(messageId) ?? String((data.data ?? data).folderId ?? ""),
    );
    if (this.draftMessageIds.has(messageId)) normalized.is_draft = true;
    return normalized;
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

  async updateDraft(draftId: string, params: Partial<DraftParams>): Promise<DraftRef> {
    const payload: Record<string, unknown> = {};
    if (params.to !== undefined) payload.toAddress = params.to.join(",");
    if (params.cc !== undefined) payload.ccAddress = params.cc.join(",");
    if (params.bcc !== undefined) payload.bccAddress = params.bcc.join(",");
    if (params.subject !== undefined) payload.subject = params.subject;
    if (params.body_html !== undefined || params.body_text !== undefined) {
      payload.content = params.body_html ?? params.body_text ?? "";
      payload.mailFormat = params.body_html !== undefined ? "html" : "plaintext";
    }
    if (params.reply_to_message_id !== undefined) payload.inReplyTo = params.reply_to_message_id;
    const data = await this.request(`/api/accounts/${this.accountId}/messages/${encodeURIComponent(draftId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const id = data?.data?.messageId ?? data?.messageId ?? draftId;
    return { draft_id: String(id), account_id: String(this.accountId) };
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
