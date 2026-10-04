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

  async connect(credentials: EmailCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error("Gmail requires an OAuth access token");
    this.accessToken = credentials.access_token;
    await this.request("/profile");
  }

  async disconnect(): Promise<void> { this.accessToken = undefined; }
  async discoverCapabilities(): Promise<CapabilitySet> { return { ...CAPABILITIES }; }
  capabilities(): CapabilitySet { return { ...CAPABILITIES }; }

  private async request(path: string, init?: RequestInit): Promise<any> {
    if (!this.accessToken) throw new Error("Gmail adapter is not connected");
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
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
    if (state.history_token) {
      const history = await this.request(`/history?startHistoryId=${encodeURIComponent(state.history_token)}&historyTypes=messageAdded&historyTypes=labelAdded&historyTypes=labelRemoved`);
      const ids = new Set<string>();
      for (const item of history.history ?? []) {
        for (const added of item.messagesAdded ?? []) ids.add(added.message?.id);
        for (const message of item.messages ?? []) ids.add(message.id);
      }
      const added = [];
      for (const id of ids) {
        const msg = await this.request(`/messages/${id}?format=full`);
        added.push({ message_id: id, provider_message_id: id });
        void msg;
      }
      return { added, updated: [], deleted: [], new_state: { ...state, history_token: history.historyId ?? state.history_token, last_sync_at: new Date().toISOString(), sync_mode: "incremental" } };
    }
    const data = await this.request("/messages?maxResults=100&labelIds=INBOX");
    const added = (data.messages ?? []).map((m: any) => ({ message_id: m.id, provider_message_id: m.id }));
    const profile = await this.request("/profile");
    return {
      added,
      updated: [],
      deleted: [],
      new_state: {
        ...state,
        history_token: profile.historyId,
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

  async send(draftId: string): Promise<SentMessageRef> {
    const data = await this.request("/drafts/send", { method: "POST", body: JSON.stringify({ id: draftId }) });
    return { message_id: data.id, provider_message_id: data.id };
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
    await Promise.all(messageIds.map((id) => this.request(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify(isRead ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }) })));
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
