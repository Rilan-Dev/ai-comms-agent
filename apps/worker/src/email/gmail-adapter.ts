import type {
  CapabilitySet, DraftParams, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState
} from "@ai-comms-agent/shared";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CAPABILITIES: CapabilitySet = {
  folders: true, labels: true, sync_incremental: true, sync_full: true,
  // Gmail push/watch is not wired to a Pub/Sub receiver in this app yet.
  sync_webhook: false, sync_idle: false, search_server_side: true,
  search_client_side: true, drafts: true, reply: false, forward: false,
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

function htmlToText(html: string): string {
  return html
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
    .replace(/\n\s+/g, "\n")
    .trim();
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
    text_body: collectBody(raw.payload, "text/plain") || htmlToText(collectBody(raw.payload, "text/html")) || raw.snippet || "",
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
  private draftIndexPromise?: Promise<Map<string, string>>;

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
    this.draftIndexPromise = undefined;
  }

  getCredentialSnapshot(): EmailCredentials {
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
      let quotaLimited = response.status === 429;
      try {
        const parsed = JSON.parse(body) as { error?: { errors?: Array<{ reason?: string }>; message?: string } };
        const reasons = parsed.error?.errors?.map((item) => item.reason ?? "").join(" ") ?? "";
        quotaLimited ||= /quotaExceeded|userRateLimitExceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i.test(
          `${reasons} ${parsed.error?.message ?? ""}`,
        );
      } catch {
        quotaLimited ||= /quota exceeded|user rate limit|rateLimitExceeded|userRateLimitExceeded/i.test(body);
      }
      const classification = quotaLimited ? " (quota/rate limit; retry later)" : "";
      throw new Error(`Gmail API ${response.status}${classification}: ${body.slice(0, 500)}`);
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
    // Complete the initial import before switching to history-based incremental
    // sync. Keep the baseline historyId stable while paging the import so every
    // change that arrives during the import is replayed by the first delta pass.
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

    // Gmail history is paginated. Never commit the returned historyId until
    // every page has been read and the caller has persisted all resulting
    // changes. A 404 means the cursor expired and triggers an idempotent
    // re-baseline instead of advancing a stale checkpoint.
    const added = new Set<string>();
    const updated = new Set<string>();
    const deleted = new Set<string>();
    let pageToken: string | undefined;
    let newestHistoryId: string | undefined = state.history_token;

    try {
      do {
        const params = new URLSearchParams({
          startHistoryId: state.history_token!,
          historyTypes: "messageAdded",
        });
        params.append("historyTypes", "labelAdded");
        params.append("historyTypes", "labelRemoved");
        params.append("historyTypes", "messageDeleted");
        if (pageToken) params.set("pageToken", pageToken);

        const history = await this.request(`/history?${params.toString()}`);
        if (typeof history.historyId === "string") newestHistoryId = history.historyId;

        for (const item of history.history ?? []) {
          for (const event of item.messagesAdded ?? []) {
            const id = event.message?.id;
            if (typeof id !== "string" || !id) continue;
            deleted.delete(id);
            updated.delete(id);
            added.add(id);
          }
          for (const event of item.labelsAdded ?? []) {
            const id = event.message?.id;
            if (typeof id !== "string" || !id || added.has(id) || deleted.has(id)) continue;
            updated.add(id);
          }
          for (const event of item.labelsRemoved ?? []) {
            const id = event.message?.id;
            if (typeof id !== "string" || !id || added.has(id) || deleted.has(id)) continue;
            updated.add(id);
          }
          for (const event of item.messagesDeleted ?? []) {
            const id = event.message?.id;
            if (typeof id !== "string" || !id) continue;
            added.delete(id);
            updated.delete(id);
            deleted.add(id);
          }
          // Gmail's aggregate messages array contains messages involved in
          // history records. Treat these as updates unless a more specific
          // add/delete event above already classified the message.
          for (const message of item.messages ?? []) {
            const id = message.id;
            if (typeof id !== "string" || !id || added.has(id) || deleted.has(id)) continue;
            updated.add(id);
          }
        }

        pageToken = typeof history.nextPageToken === "string" && history.nextPageToken
          ? history.nextPageToken
          : undefined;
      } while (pageToken);
    } catch (error) {
      if (error instanceof Error && /Gmail API 404:/.test(error.message)) {
        return this.sync({ ...state, cursor: undefined, history_token: undefined, sync_mode: "initial" });
      }
      throw error;
    }

    return {
      added: [...added].map((id) => ({ message_id: id, provider_message_id: id })),
      updated: [...updated].map((id) => ({ message_id: id, provider_message_id: id })),
      deleted: [...deleted],
      new_state: {
        ...state,
        cursor: undefined,
        history_token: newestHistoryId,
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

  async listDraftIdsByMessage(): Promise<Map<string, string>> {
    if (!this.draftIndexPromise) {
      this.draftIndexPromise = (async () => {
        const result = new Map<string, string>();
        let pageToken: string | undefined;
        do {
          const params = new URLSearchParams({ maxResults: "100" });
          if (pageToken) params.set("pageToken", pageToken);
          const page = await this.request(`/drafts?${params.toString()}`);
          for (const draft of page.drafts ?? []) {
            if (typeof draft.id === "string" && typeof draft.message?.id === "string") {
              result.set(draft.message.id, draft.id);
            }
          }
          pageToken = typeof page.nextPageToken === "string" ? page.nextPageToken : undefined;
        } while (pageToken);
        return result;
      })();
    }
    return this.draftIndexPromise;
  }

  async findDraftIdForMessage(messageId: string): Promise<string | null> {
    return (await this.listDraftIdsByMessage()).get(messageId) ?? null;
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      return toMessage(await this.request(`/messages/${encodeURIComponent(messageId)}?format=full`));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Gmail API 404:")) return null;
      throw error;
    }
  }

  /**
   * Batch fetch up to 100 messages per HTTP request using Gmail's multipart
   * batch endpoint (POST /batch/gmail/v1). Returns a Map keyed by message id
   * for O(1) lookup by callers.
   *
   * The single-message `getMessage` path sends one HTTP request per message
   * ID — at Gmail's 250ms throttle that's ~4 messages/sec. With batching
   * the same 100 messages land in one HTTP round-trip (~500ms), giving a
   * ~50× throughput improvement for initial sync.
   *
   * Idempotent and safe to retry: if the batch endpoint returns 4xx for a
   * single sub-request (e.g., 404 for a deleted message), we still resolve
   * the rest. Network errors throw and the caller's checkpoint loop will
   * retry the un-acked IDs.
   */
  async batchGetMessages(messageIds: string[]): Promise<Map<string, EmailMessage>> {
    const result = new Map<string, EmailMessage>();
    if (messageIds.length === 0) return result;

    // Gmail's batch endpoint caps at 100 sub-requests per multipart request.
    const CHUNK_SIZE = 100;
    for (let offset = 0; offset < messageIds.length; offset += CHUNK_SIZE) {
      const chunk = messageIds.slice(offset, offset + CHUNK_SIZE);
      if (this.expiresAt && this.expiresAt <= Date.now() + 30_000) await this.refreshAccessToken();
      if (!this.accessToken) throw new Error("Gmail adapter is not connected");

      // Build multipart/mixed body with one sub-request per message id.
      const boundary = `batch_${Math.random().toString(36).slice(2)}`;
      const lines: string[] = [];
      for (const id of chunk) {
        lines.push(`--${boundary}`);
        lines.push("Content-Type: application/http");
        lines.push("Content-ID: <" + id + "@ai-comms-agent.local>");
        lines.push("");
        lines.push(`GET /gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full HTTP/1.1`);
        lines.push("Accept: application/json");
        lines.push("");
      }
      lines.push(`--${boundary}--`, "");
      const body = lines.join("\r\n");

      const response = await fetch("https://www.googleapis.com/batch/gmail/v1", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
        body,
      });

      if (response.status === 401 && this.refreshToken) {
        await this.refreshAccessToken();
        // Retry the chunk once after token refresh.
        const retryResponse = await fetch("https://www.googleapis.com/batch/gmail/v1", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body,
        });
        this.parseBatchResponse(await retryResponse.text(), chunk, result);
        continue;
      }
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`Gmail batch get failed (${response.status}): ${errBody.slice(0, 500)}`);
      }
      this.parseBatchResponse(await response.text(), chunk, result);
    }
    return result;
  }

  /** Parse a multipart batch response and append to the result Map. */
  private parseBatchResponse(body: string, chunk: string[], result: Map<string, EmailMessage>): void {
    // Split on the boundary marker. The exact boundary is in the response's
    // Content-Type header; we read it from the first line of the body to
    // avoid needing to parse headers separately.
    const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
    const boundary = firstLine.replace(/^--/, "").trim();
    if (!boundary) return;
    const parts = body.split(`--${boundary}`);
    // Build Content-ID → message id mapping from the request chunk.
    const contentIdToMessageId = new Map<string, string>();
    for (const id of chunk) contentIdToMessageId.set(`<${id}@ai-comms-agent.local>`, id);

    for (const part of parts) {
      if (!part.trim() || part.startsWith("--")) continue;
      const headersEnd = part.indexOf("\r\n\r\n");
      if (headersEnd < 0) continue;
      const partHeaders = part.slice(0, headersEnd);
      const partBody = part.slice(headersEnd + 4).trim();

      // Extract Content-ID
      const cidMatch = partHeaders.match(/Content-ID:\s*<([^>]+)>/i);
      // Google prefixes every response Content-ID with "response-". Remove
      // that protocol prefix before mapping the response back to our request ID.
      // Without this, every valid response was keyed as "response-<id>" and
      // batchGetMessages() returned no messages for the original IDs.
      const responseContentId = cidMatch?.[1] ?? "";
      const requestContentId = responseContentId.replace(/^response-/i, "");
      const messageId = contentIdToMessageId.get(`<${requestContentId}>`)
        ?? requestContentId.replace(/@.*$/, "");

      // The part body is itself an HTTP response: status line + headers + JSON.
      const statusMatch = partBody.match(/^HTTP\/[\d.]+\s+(\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      if (status !== 200) {
        // 404 means the message was deleted between list+get; mark as not found.
        continue;
      }
      const jsonStart = partBody.indexOf("\r\n\r\n");
      if (jsonStart < 0) continue;
      const jsonText = partBody.slice(jsonStart + 4).trim();
      try {
        const raw = JSON.parse(jsonText);
        const message = toMessage(raw);
        if (messageId) {
          result.set(messageId, message);
        } else if (raw.id) {
          result.set(String(raw.id), message);
        }
      } catch {
        // Skip unparseable part — the sync loop will retry this ID on next tick.
      }
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
