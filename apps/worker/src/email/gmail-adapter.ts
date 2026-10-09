import type {
  CapabilitySet, DraftParams, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState
} from "@ai-comms-agent/shared";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: true, sync_full: true,
  sync_webhook: true, sync_idle: false, search_server_side: true,
  search_client_side: true, drafts: true, reply: true, forward: true,
  mark_read: true, archive: true, move: true, threads: true,
  attachments_download: true, attachments_upload: false, send: true,
};

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(data?: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collectBody(part: any, mime: string): string {
  if (!part) return "";
  if (part.mimeType === mime && part.body?.data) return decodeBody(part.body.data);
  for (const child of part.parts ?? []) {
    const value = collectBody(child, mime);
    if (value) return value;
  }
  return "";
}

function toMessage(raw: any): EmailMessage {
  const h = raw.payload?.headers;
  const labels = raw.labelIds ?? [];
  const from = header(h, "From");
  const match = from.match(/<([^>]+)>/) ?? [null, from];
  return {
    id: raw.id,
    email_account_id: "gmail",
    thread_id: raw.threadId ?? raw.id,
    folder_id: labels.includes("INBOX") ? "INBOX" : (labels[0] ?? "ALL"),
    provider_message_id: raw.id,
    message_id_header: header(h, "Message-ID"),
    in_reply_to: header(h, "In-Reply-To") || undefined,
    references: header(h, "References") ? header(h, "References").split(/\s+/) : [],
    from_address: match[1] ?? from,
    to_addresses: header(h, "To").split(",").map((v: string) => v.trim()).filter(Boolean),
    cc_addresses: header(h, "Cc").split(",").map((v: string) => v.trim()).filter(Boolean),
    bcc_addresses: header(h, "Bcc").split(",").map((v: string) => v.trim()).filter(Boolean),
    subject: header(h, "Subject"),
    text_body: collectBody(raw.payload, "text/plain") || raw.snippet || "",
    html_body: collectBody(raw.payload, "text/html") || undefined,
    snippet: raw.snippet ?? "",
    received_at: new Date(Number(raw.internalDate ?? Date.now())).toISOString(),
    is_read: !labels.includes("UNREAD"),
    is_starred: labels.includes("STARRED"),
    is_draft: labels.includes("DRAFT"),
    is_outbound: labels.includes("SENT"),
    importance_score: labels.includes("IMPORTANT") ? 0.8 : 0.3,
    action_required: false,
    has_attachments: JSON.stringify(raw.payload ?? {}).includes('"attachmentId"'),
    embedding_status: "pending",
  };
}

function mime(params: DraftParams): string {
  const lines = [
    `To: ${params.to.join(", ")}`,
    ...(params.cc?.length ? [`Cc: ${params.cc.join(", ")}`] : []),
    ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(", ")}`] : []),
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body_text,
  ];
  return lines.join("\r\n");
}

export class GmailAdapter implements EmailProvider {
  readonly providerId = "gmail" as const;
  private accessToken?: string;
  private refreshToken?: string;
  private expiresAt?: number;
  private refreshPromise?: Promise<void>;
  private oauthClientId?: string;
  private oauthClientSecret?: string;
  private credentialMetadata: Record<string, unknown> = {};

  async connect(credentials: EmailCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error("Gmail requires an OAuth access token");
    const stored = credentials as unknown as Record<string, unknown>;
    this.credentialMetadata = { ...stored };
    this.oauthClientId = typeof stored.oauth_client_id === "string" ? stored.oauth_client_id : undefined;
    this.oauthClientSecret = typeof stored.oauth_client_secret === "string" ? stored.oauth_client_secret : undefined;
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.expiresAt = credentials.expires_at ? Date.parse(credentials.expires_at) : undefined;
    await this.request("/profile");
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.expiresAt = undefined;
    this.refreshPromise = undefined;
    this.oauthClientId = undefined;
    this.oauthClientSecret = undefined;
    this.credentialMetadata = {};
  }

  getCredentialSnapshot(): Record<string, unknown> {
    return {
      ...this.credentialMetadata,
      credential_type: "oauth_token",
      ...(this.accessToken ? { access_token: this.accessToken } : {}),
      ...(this.refreshToken ? { refresh_token: this.refreshToken } : {}),
      ...(this.expiresAt ? { expires_at: new Date(this.expiresAt).toISOString() } : {}),
      ...(this.oauthClientId ? { oauth_client_id: this.oauthClientId } : {}),
      ...(this.oauthClientSecret ? { oauth_client_secret: this.oauthClientSecret } : {}),
    };
  }

  async discoverCapabilities(): Promise<CapabilitySet> { return { ...CAPABILITIES }; }
  capabilities(): CapabilitySet { return { ...CAPABILITIES }; }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new Error("Gmail access token expired and no refresh token is available");
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const clientId = this.oauthClientId;
      const clientSecret = this.oauthClientSecret;
      if (!clientId || !clientSecret) throw new Error("Gmail OAuth client configuration is missing from the encrypted account credential.");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken!,
          grant_type: "refresh_token",
        }),
      });
      if (!response.ok) throw new Error(`Gmail token refresh failed: ${response.status}`);
      const data = await response.json() as { access_token?: string; expires_in?: number };
      if (!data.access_token) throw new Error("Gmail token refresh returned no access token");
      this.accessToken = data.access_token;
      this.expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
    })();
    try { await this.refreshPromise; } finally { this.refreshPromise = undefined; }
  }

  private async request(path: string, init?: RequestInit, retried = false): Promise<any> {
    if (!this.accessToken) throw new Error("Gmail adapter is not connected");
    if (this.expiresAt && this.expiresAt <= Date.now() + 30_000) await this.refreshAccessToken();
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 401 && !retried && this.refreshToken) {
      await this.refreshAccessToken();
      return this.request(path, init, true);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail API ${response.status}: ${body.slice(0, 500)}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async listFolders(): Promise<EmailFolder[]> {
    const data = await this.request("/labels");
    return (data.labels ?? []).map((label: any) => ({
      id: label.id, email_account_id: "gmail", provider_folder_id: label.id,
      name: label.name, role: label.id === "INBOX" ? "inbox" : label.id === "SENT" ? "sent" : label.id === "DRAFT" ? "drafts" : label.id === "TRASH" ? "trash" : "custom",
      unread_count: label.messagesUnread ?? 0, last_synced_at: new Date().toISOString(),
    }));
  }

  async listLabels(): Promise<EmailLabel[]> {
    const data = await this.request("/labels");
    return (data.labels ?? []).filter((l: any) => l.type === "user").map((l: any) => ({
      id: l.id, email_account_id: "gmail", provider_label_id: l.id, name: l.name, label_type: "user",
    }));
  }

  async sync(state: SyncState): Promise<SyncResult> {
    // Complete a paginated initial import before switching to history-based
    // incremental sync. Capture historyId before page one so changes arriving
    // during the import are picked up by the first incremental pass.
    if (state.sync_mode === "initial" || state.cursor || !state.history_token) {
      const profile = state.history_token ? null : await this.request("/profile");
      const baselineHistoryId = state.history_token ?? profile?.historyId;
      const params = new URLSearchParams({ maxResults: "100" });
      if (state.cursor) params.set("pageToken", state.cursor);
      const page = await this.request(`/messages?${params.toString()}`);
      const added = (page.messages ?? [])
        .filter((message: any) => typeof message.id === "string" && message.id.length > 0)
        .map((message: any) => ({ message_id: message.id, provider_message_id: message.id }));
      const cursor = typeof page.nextPageToken === "string" ? page.nextPageToken : undefined;
      return {
        added,
        updated: [],
        deleted: [],
        new_state: {
          ...state,
          cursor,
          history_token: baselineHistoryId ? String(baselineHistoryId) : undefined,
          last_sync_at: new Date().toISOString(),
          sync_mode: cursor ? "initial" : "incremental",
        },
      };
    }

    let history: any;
    try {
      history = await this.request(`/history?startHistoryId=${encodeURIComponent(state.history_token)}&historyTypes=messageAdded&historyTypes=labelAdded&historyTypes=labelRemoved`);
    } catch (error) {
      // Gmail history IDs expire after enough mailbox changes. Re-baseline with
      // a paginated full import; database upserts make this recovery idempotent.
      if (error instanceof Error && /Gmail API 404:/.test(error.message)) {
        return this.sync({ ...state, cursor: undefined, history_token: undefined, sync_mode: "initial" });
      }
      throw error;
    }
    const ids = new Set<string>();
    for (const item of history.history ?? []) {
      for (const added of item.messagesAdded ?? []) {
        if (typeof added.message?.id === "string") ids.add(added.message.id);
      }
      for (const message of item.messages ?? []) {
        if (typeof message.id === "string") ids.add(message.id);
      }
    }
    return {
      added: [...ids].map((id) => ({ message_id: id, provider_message_id: id })),
      updated: [],
      deleted: [],
      new_state: {
        ...state,
        cursor: undefined,
        history_token: history.historyId ?? state.history_token,
        last_sync_at: new Date().toISOString(),
        sync_mode: "incremental",
      },
    };
  }

  async listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    const query = new URLSearchParams({ maxResults: String(Math.min(opts.limit ?? 50, 100)), labelIds: folderId });
    if (opts.cursor) query.set("pageToken", opts.cursor);
    const data = await this.request(`/messages?${query}`);
    return Promise.all((data.messages ?? []).map((m: any) => this.request(`/messages/${m.id}?format=full`).then(toMessage)));
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      return toMessage(await this.request(`/messages/${encodeURIComponent(messageId)}?format=full`));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Gmail API 404:")) return null;
      throw error;
    }
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    const data = await this.request(`/threads/${encodeURIComponent(threadId)}?format=full`);
    return (data.messages ?? []).map(toMessage);
  }

  async search(query: SearchQuery): Promise<EmailMessage[]> {
    const q = [
      query.from && `from:${query.from}`,
      query.subject && `subject:${query.subject}`,
      query.date_from && `after:${Math.floor(new Date(query.date_from).getTime()/1000)}`,
      query.date_to && `before:${Math.floor(new Date(query.date_to).getTime()/1000)}`,
      query.label && `label:${query.label}`,
      query.folder && `label:${query.folder}`,
      query.text,
    ].filter(Boolean).join(" ");
    const data = await this.request(`/messages?maxResults=100&q=${encodeURIComponent(q)}`);
    return Promise.all((data.messages ?? []).map((m: any) => this.request(`/messages/${m.id}?format=full`).then(toMessage)));
  }

  async createDraft(params: DraftParams) {
    const data = await this.request("/drafts", { method: "POST", body: JSON.stringify({ message: { raw: b64url(mime(params)) } }) });
    return { draft_id: data.id, account_id: "gmail" };
  }

  async updateDraft(draftId: string, params: Partial<DraftParams>) {
    const current = await this.request(`/drafts/${draftId}?format=full`);
    const currentMessage = toMessage(current.message);
    const merged: DraftParams = {
      to: params.to ?? currentMessage.to_addresses, cc: params.cc ?? currentMessage.cc_addresses,
      bcc: params.bcc ?? currentMessage.bcc_addresses, subject: params.subject ?? currentMessage.subject,
      body_text: params.body_text ?? currentMessage.text_body, body_html: params.body_html,
    };
    await this.request(`/drafts/${draftId}`, { method: "PUT", body: JSON.stringify({ id: draftId, message: { raw: b64url(mime(merged)) } }) });
    return { draft_id: draftId, account_id: "gmail" };
  }

  async deleteDraft(draftId: string): Promise<void> {
    await this.request(`/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  }

  async sendDraft(draftId: string): Promise<SentMessageRef> {
    const data = await this.request("/drafts/send", { method: "POST", body: JSON.stringify({ id: draftId }) });
    return { message_id: data.id, provider_message_id: data.id };
  }

  async send(draftId: string): Promise<SentMessageRef> {
    return this.sendDraft(draftId);
  }

  async reply(messageId: string, params: DraftParams): Promise<SentMessageRef> {
    const draft = await this.createDraft(params);
    return this.send(draft.draft_id);
  }

  async forward(messageId: string, to: string[]): Promise<SentMessageRef> {
    const message = toMessage(await this.request(`/messages/${messageId}?format=full`));
    const draft = await this.createDraft({ to, subject: `Fwd: ${message.subject}`, body_text: message.text_body });
    return this.send(draft.draft_id);
  }

  async markRead(messageIds: string[], isRead: boolean): Promise<void> {
    await Promise.all(messageIds.map((id) => this.request(`/messages/${encodeURIComponent(id)}/modify`, {
      method: "POST",
      body: JSON.stringify(isRead ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }),
    })));
  }

  async markUnread(messageIds: string[]): Promise<void> {
    await this.markRead(messageIds, false);
  }

  async archive(messageIds: string[]): Promise<void> {
    await Promise.all(messageIds.map((id) => this.request(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["INBOX"] }) })));
  }

  async move(messageIds: string[], targetFolderId: string): Promise<void> {
    await Promise.all(messageIds.map((id) => this.request(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: [targetFolderId] }) })));
  }

  async applyLabels(messageIds: string[], labelIds: string[]): Promise<void> {
    await Promise.all(messageIds.map((id) => this.request(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: labelIds }) })));
  }

  async downloadAttachment(attachmentId: string): Promise<Buffer> {
    const slash = attachmentId.indexOf("/");
    if (slash < 1) throw new Error("attachmentId must be messageId/attachmentId");
    const messageId = attachmentId.slice(0, slash);
    const attachment = attachmentId.slice(slash + 1);
    const data = await this.request(`/messages/${messageId}/attachments/${attachment}`);
    return Buffer.from(data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  }
}
