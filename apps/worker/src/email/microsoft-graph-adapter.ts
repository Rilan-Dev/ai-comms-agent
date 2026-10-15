import { CapabilityNotSupported } from "@ai-comms-agent/shared";
import type {
  AttachmentRef,
  CapabilitySet,
  DraftParams,
  DraftRef,
  EmailCredentials,
  EmailFolder,
  EmailProviderCapability,
  EmailMessage,
  EmailProvider,
  ListOptions,
  SearchQuery,
  SentMessageRef,
  SyncResult,
  SyncState,
} from "@ai-comms-agent/shared";

const GRAPH_ORIGIN = "https://graph.microsoft.com";
const GRAPH_BASE = GRAPH_ORIGIN + "/v1.0";
const DELTA_SELECT = [
  "id", "conversationId", "internetMessageId", "internetMessageHeaders",
  "subject", "from", "toRecipients", "ccRecipients", "bccRecipients",
  "receivedDateTime", "sentDateTime", "isRead", "isDraft", "hasAttachments",
  "importance", "flag", "body", "bodyPreview", "parentFolderId",
].join(",");
const CAPABILITIES: CapabilitySet = {
  folders: true,
  labels: false,
  sync_incremental: true,
  sync_full: true,
  // Graph subscriptions are enabled only after the subscription worker/receiver is configured.
  sync_webhook: false,
  sync_idle: false,
  search_server_side: true,
  search_client_side: true,
  drafts: false,
  reply: false,
  forward: false,
  mark_read: false,
  archive: false,
  move: false,
  threads: true,
  attachments_download: false,
  attachments_upload: false,
  send: false,
};

type GraphRecipient = { emailAddress?: { address?: string; name?: string } };
type GraphMessage = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  bccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  importance?: string;
  flag?: { flagStatus?: string };
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
  parentFolderId?: string;
  "@removed"?: { reason?: string };
};
type GraphPage<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};
type GraphProfile = { id?: string; displayName?: string; mail?: string; userPrincipalName?: string };

function htmlToText(value: string): string {
  return value
    .replace(/<(script|style|head|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function addressList(values: GraphRecipient[] | undefined): string[] {
  return (values ?? []).map((item) => item.emailAddress?.address ?? "").filter(Boolean);
}

function toMessage(raw: GraphMessage): EmailMessage {
  const headers = new Map((raw.internetMessageHeaders ?? []).map((header) => [
    (header.name ?? "").toLowerCase(),
    header.value ?? "",
  ]));
  const body = raw.body?.content ?? "";
  const isHtml = (raw.body?.contentType ?? "").toLowerCase() === "html";
  const textBody = isHtml ? htmlToText(body) : body;
  return {
    id: raw.id,
    email_account_id: "microsoft_graph",
    thread_id: raw.conversationId ?? raw.id,
    folder_id: raw.parentFolderId ?? "inbox",
    provider_message_id: raw.id,
    message_id_header: raw.internetMessageId ?? headers.get("message-id") ?? "",
    in_reply_to: headers.get("in-reply-to") || undefined,
    references: (headers.get("references") ?? "").split(/\s+/).filter(Boolean),
    from_address: raw.from?.emailAddress?.address ?? "",
    from_name: raw.from?.emailAddress?.name,
    to_addresses: addressList(raw.toRecipients),
    cc_addresses: addressList(raw.ccRecipients),
    bcc_addresses: addressList(raw.bccRecipients),
    subject: raw.subject ?? "",
    text_body: textBody.slice(0, 100_000),
    html_body: isHtml ? body : undefined,
    snippet: raw.bodyPreview ?? textBody.replace(/\s+/g, " ").slice(0, 240),
    received_at: raw.receivedDateTime ?? raw.sentDateTime ?? new Date().toISOString(),
    is_read: raw.isRead === true,
    is_starred: raw.flag?.flagStatus === "flagged",
    is_draft: raw.isDraft === true,
    is_outbound: false,
    importance_score: raw.importance === "high" ? 0.8 : raw.importance === "low" ? 0.2 : 0.4,
    action_required: false,
    has_attachments: raw.hasAttachments === true,
    embedding_status: "pending",
  };
}

export class MicrosoftGraphAdapter implements EmailProvider {
  readonly providerId = "microsoft_graph" as const;
  private credentials?: EmailCredentials;
  private profile?: GraphProfile;

  async connect(credentials: EmailCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error("Microsoft Graph requires an OAuth access token.");
    this.credentials = { ...credentials };
    try {
      this.profile = await this.request<GraphProfile>("/me?$select=id,displayName,mail,userPrincipalName");
      if (!this.profile.id) throw new Error("Microsoft Graph did not return a user ID.");
      this.credentials.microsoft_user_id = this.profile.id;
    } catch (error) {
      this.credentials = undefined;
      this.profile = undefined;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.credentials = undefined;
    this.profile = undefined;
  }

  async discoverCapabilities(): Promise<CapabilitySet> {
    return { ...CAPABILITIES };
  }

  capabilities(): CapabilitySet {
    return { ...CAPABILITIES };
  }

  getCredentialSnapshot(): EmailCredentials {
    if (!this.credentials) throw new Error("Microsoft Graph adapter is not connected.");
    return { ...this.credentials };
  }

  getMailboxProfile(): { id: string; emailAddress: string; displayName: string } {
    if (!this.profile?.id) throw new Error("Microsoft Graph adapter is not connected.");
    return {
      id: this.profile.id,
      emailAddress: this.profile.mail || this.profile.userPrincipalName || "",
      displayName: this.profile.displayName || this.profile.mail || this.profile.userPrincipalName || "",
    };
  }

  private async refreshAccessToken(): Promise<void> {
    const credentials = this.credentials;
    if (!credentials?.refresh_token || !credentials.microsoft_client_id || !credentials.microsoft_client_secret) {
      throw new Error("Microsoft Graph access token expired and refresh credentials are missing.");
    }
    const tenant = credentials.microsoft_tenant_id || "common";
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.microsoft_client_id,
        client_secret: credentials.microsoft_client_secret,
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
        scope: "openid profile offline_access User.Read Mail.Read",
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string;
    };
    if (!response.ok || !payload.access_token) {
      throw new Error(`Microsoft token refresh failed: ${(payload.error_description ?? response.statusText).slice(0, 200)}`);
    }
    this.credentials = {
      ...credentials,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? credentials.refresh_token,
      expires_at: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : credentials.expires_at,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    if (!this.credentials?.access_token) throw new Error("Microsoft Graph adapter is not connected.");
    const url = path.startsWith("https://") ? new URL(path) : new URL(path, GRAPH_BASE);
    if (url.origin !== GRAPH_ORIGIN || !url.pathname.startsWith("/v1.0/")) {
      throw new Error("Refusing an untrusted Microsoft Graph URL.");
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        authorization: `Bearer ${this.credentials.access_token}`,
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (response.status === 401 && retry) {
      await this.refreshAccessToken();
      return this.request<T>(url.toString(), options, false);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`Microsoft Graph HTTP ${response.status}: ${detail || response.statusText}`);
    }
    if (response.status === 204) return {} as T;
    return await response.json() as T;
  }

  async createInboxSubscription(
    notificationUrl: string,
    clientState: string,
    expirationDateTime: string,
  ): Promise<{ id: string; expirationDateTime: string }> {
    const url = new URL(notificationUrl);
    if (url.protocol !== "https:") throw new Error("Microsoft Graph notification URL must use HTTPS.");
    if (clientState.length < 16 || clientState.length > 128) throw new Error("Microsoft Graph clientState length is invalid.");
    return this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl: url.toString(),
        resource: "me/mailFolders('inbox')/messages",
        expirationDateTime,
        clientState,
      }),
    });
  }

  async renewSubscription(
    subscriptionId: string,
    expirationDateTime: string,
  ): Promise<{ id: string; expirationDateTime: string }> {
    return this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ expirationDateTime }),
    });
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
  }

  async listFolders(): Promise<EmailFolder[]> {
    const page = await this.request<GraphPage<{
      id: string; displayName?: string; unreadItemCount?: number; parentFolderId?: string;
    }>>("/me/mailFolders?$top=100&$select=id,displayName,unreadItemCount,parentFolderId");
    return (page.value ?? []).map((folder) => {
      const name = folder.displayName ?? "Folder";
      const lower = name.toLowerCase();
      const role = lower === "inbox" ? "inbox" : lower === "sent items" ? "sent"
        : lower === "drafts" ? "drafts" : lower === "deleted items" ? "trash"
        : lower === "junk email" ? "spam" : lower === "archive" ? "archive" : "custom";
      return {
        id: folder.id, email_account_id: "microsoft_graph", provider_folder_id: folder.id,
        name, parent_id: folder.parentFolderId, role, unread_count: folder.unreadItemCount ?? 0,
      };
    });
  }

  async sync(state: SyncState): Promise<SyncResult> {
    const isInitial = !state.history_token;
    const startUrl = state.cursor
      ?? (isInitial
        ? `/me/mailFolders/inbox/messages/delta?$select=${encodeURIComponent(DELTA_SELECT)}`
        : state.history_token!);
    let page: GraphPage<GraphMessage>;
    try {
      page = await this.request<GraphPage<GraphMessage>>(startUrl);
    } catch (error) {
      if ((state.cursor || state.history_token) && error instanceof Error && /HTTP (?:404|410)\b/.test(error.message)) {
        return this.sync({ ...state, cursor: undefined, history_token: undefined, sync_mode: "initial" });
      }
      throw error;
    }

    const added: SyncResult["added"] = [];
    const updated: SyncResult["updated"] = [];
    const deleted: string[] = [];
    for (const message of page.value ?? []) {
      if (!message.id) continue;
      if (message["@removed"]) {
        deleted.push(message.id);
      } else if (isInitial) {
        added.push({ message_id: message.id, provider_message_id: message.id });
      } else {
        updated.push({ message_id: message.id, provider_message_id: message.id });
      }
    }

    if (page["@odata.nextLink"]) {
      return {
        added, updated, deleted,
        new_state: { ...state, cursor: page["@odata.nextLink"], sync_mode: "initial" },
      };
    }
    return {
      added, updated, deleted,
      new_state: {
        last_sync_at: new Date().toISOString(),
        cursor: undefined,
        history_token: page["@odata.deltaLink"] ?? state.history_token,
        sync_mode: "incremental",
      },
    };
  }

  async listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    const path = opts.cursor
      ? opts.cursor
      : `/me/mailFolders/${encodeURIComponent(folderId)}/messages?$top=${Math.min(100, Math.max(1, opts.limit ?? 50))}&$select=${encodeURIComponent(DELTA_SELECT)}`;
    const page = await this.request<GraphPage<GraphMessage>>(path);
    return (page.value ?? []).map(toMessage);
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      const message = await this.request<GraphMessage>(
        `/me/messages/${encodeURIComponent(messageId)}?$select=${encodeURIComponent(DELTA_SELECT)}`,
      );
      return toMessage(message);
    } catch (error) {
      if (error instanceof Error && /HTTP 404\b/.test(error.message)) return null;
      throw error;
    }
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    const escaped = threadId.replace(/'/g, "''");
    const path = `/me/messages?$filter=conversationId eq '${encodeURIComponent(escaped)}'&$top=100&$select=${encodeURIComponent(DELTA_SELECT)}`;
    const page = await this.request<GraphPage<GraphMessage>>(path);
    return (page.value ?? []).map(toMessage);
  }

  async search(query: SearchQuery): Promise<EmailMessage[]> {
    const terms = [query.from && `from:${query.from}`, query.subject && `subject:${query.subject}`, query.text]
      .filter(Boolean).join(" ");
    if (!terms) return [];
    const path = `/me/messages?$search=${encodeURIComponent('"' + terms.replace(/"/g, '\"') + '"')}&$top=50&$select=${encodeURIComponent(DELTA_SELECT)}`;
    const page = await this.request<GraphPage<GraphMessage>>(path, { headers: { ConsistencyLevel: "eventual" } });
    return (page.value ?? []).map(toMessage);
  }

  private unsupported(capability: EmailProviderCapability): never {
    throw new CapabilityNotSupported(this.providerId, capability);
  }

  async createDraft(_params: DraftParams): Promise<DraftRef> { return this.unsupported("drafts"); }
  async updateDraft(_draftId: string, _params: Partial<DraftParams>): Promise<DraftRef> { return this.unsupported("drafts"); }
  async deleteDraft(_draftId: string): Promise<void> { return this.unsupported("drafts"); }
  async sendDraft(_draftId: string): Promise<SentMessageRef> { return this.unsupported("send"); }
  async send(draftId: string): Promise<SentMessageRef> { return this.sendDraft(draftId); }
  async reply(_messageId: string, _params: DraftParams): Promise<SentMessageRef> { return this.unsupported("reply"); }
  async forward(_messageId: string, _to: string[]): Promise<SentMessageRef> { return this.unsupported("forward"); }
  async markRead(_messageIds: string[], _isRead: boolean): Promise<void> { return this.unsupported("mark_read"); }
  async markUnread(_messageIds: string[]): Promise<void> { return this.unsupported("mark_read"); }
  async archive(_messageIds: string[]): Promise<void> { return this.unsupported("archive"); }
  async move(_messageIds: string[], _targetFolderId: string): Promise<void> { return this.unsupported("move"); }
  async downloadAttachment(_attachmentId: string): Promise<Buffer> { return this.unsupported("attachments_download"); }
  async uploadAttachment(_filename: string, _content: Buffer, _mimeType: string): Promise<AttachmentRef> {
    return this.unsupported("attachments_upload");
  }
}
