import * as tls from "node:tls";
import { promises as dns } from "node:dns";
import type {
  CapabilitySet, DraftParams, DraftRef, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: false, sync_incremental: true, sync_full: true,
  sync_webhook: false, sync_idle: false, search_server_side: false,
  search_client_side: true, drafts: false, reply: false, forward: false,
  mark_read: false, archive: false, move: false, threads: true,
  attachments_download: false, attachments_upload: false, send: false,
};

type ImapConnection = {
  socket: tls.TLSSocket;
  buffer: string;
  tag: number;
};

function required(credentials: EmailCredentials, name: keyof EmailCredentials): string {
  const value = credentials[name];
  if (typeof value !== "string" || !value) throw new Error(`IMAP/SMTP requires ${name}`);
  return value;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isPrivateOrLocalAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 0);
}

async function resolvePublicHost(host: string): Promise<{ address: string; family: 4 | 6 }> {
  const normalized = host.trim().toLowerCase();
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost")) {
    throw new Error("IMAP/SMTP host must resolve to a public address");
  }
  const result = await dns.lookup(host, { family: 0 });
  if (isPrivateOrLocalAddress(result.address)) throw new Error("IMAP/SMTP host resolves to a private or local address");
  if (result.family !== 4 && result.family !== 6) throw new Error("IMAP/SMTP host resolved to an unsupported address family");
  return { address: result.address, family: result.family };
}

async function connectTls(host: string, port: number, timeoutMs = 10_000): Promise<tls.TLSSocket> {
  const resolved = await resolvePublicHost(host);
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: resolved.address, port, servername: host, rejectUnauthorized: true }, () => resolve(socket));
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TLS connection timeout to ${host}:${port}`));
    }, timeoutMs);
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
    socket.once("close", () => clearTimeout(timer));
  });
}

type SocketReader = {
  socket: tls.TLSSocket;
  buffer: string;
  error?: Error;
};

function createReader(socket: tls.TLSSocket): SocketReader {
  return { socket, buffer: "" };
}

async function readLine(reader: SocketReader, timeoutMs = 10_000): Promise<string> {
  const existing = reader.buffer.indexOf("\r\n");
  if (existing >= 0) {
    const line = reader.buffer.slice(0, existing);
    reader.buffer = reader.buffer.slice(existing + 2);
    return line;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => cleanup(new Error("TLS response timeout")), timeoutMs);
    const onData = (chunk: Buffer | string) => {
      reader.buffer += chunk.toString();
      const index = reader.buffer.indexOf("\r\n");
      if (index < 0) return;
      const line = reader.buffer.slice(0, index);
      reader.buffer = reader.buffer.slice(index + 2);
      cleanup();
      resolve(line);
    };
    const onError = (error: Error) => cleanup(error);
    const cleanup = (error?: Error) => {
      clearTimeout(timer);
      reader.socket.off("data", onData);
      reader.socket.off("error", onError);
      if (error) reject(error);
    };
    reader.socket.on("data", onData);
    reader.socket.once("error", onError);
  });
}

async function smtpCommand(reader: SocketReader, command: string): Promise<string> {
  reader.socket.write(command + "\r\n");
  return readLine(reader);
}

export class ImapSmtpAdapter implements EmailProvider {
  readonly providerId = "imap_smtp" as const;
  private credentials?: EmailCredentials;
  private imap?: ImapConnection & { reader: SocketReader };
  private smtp?: { socket: tls.TLSSocket; reader: SocketReader };

  async connect(credentials: EmailCredentials): Promise<void> {
    const host = required(credentials, "host");
    const username = required(credentials, "username");
    const password = credentials.password ?? credentials.access_token;
    if (!password) throw new Error("IMAP/SMTP requires password or app_password credentials");
    const imapHost = credentials.imap_host ?? host;
    const smtpHost = credentials.smtp_host ?? host;
    const imapPort = credentials.imap_port ?? credentials.port ?? 993;
    const smtpPort = credentials.smtp_port ?? 465;

    if (credentials.tls === false) throw new Error("IMAP/SMTP requires TLS; plaintext transport is disabled");
    const imapSocket = await connectTls(imapHost, imapPort);
    const imapReader = createReader(imapSocket);
    const greeting = await readLine(imapReader);
    if (!greeting.startsWith("*")) {
      imapSocket.destroy();
      throw new Error("IMAP server returned an invalid greeting");
    }
    const connection: ImapConnection & { reader: SocketReader } = { socket: imapSocket, buffer: "", tag: 0, reader: imapReader };
    const loginTag = this.nextTag(connection);
    imapSocket.write(`${loginTag} LOGIN ${quote(username)} ${quote(password)}\r\n`);
    const login = await readLine(imapReader);
    if (!login.startsWith(`${loginTag} OK`)) {
      imapSocket.destroy();
      throw new Error("IMAP authentication failed");
    }

    const smtpSocket = await connectTls(smtpHost, smtpPort);
    const smtpReader = createReader(smtpSocket);
    const smtpGreeting = await readLine(smtpReader);
    if (!/^220\b/.test(smtpGreeting)) {
      smtpSocket.destroy();
      imapSocket.destroy();
      throw new Error("SMTP server returned an invalid greeting");
    }
    await smtpCommand(smtpReader, `EHLO ${smtpHost}`);
    const auth = await smtpCommand(
      smtpReader,
      `AUTH PLAIN ${Buffer.from(`\0${username}\0${password}`).toString("base64")}`,
    );
    if (!/^235\b/.test(auth)) {
      smtpSocket.destroy();
      imapSocket.destroy();
      throw new Error("SMTP authentication failed");
    }

    this.credentials = { ...credentials, password: undefined, access_token: undefined };
    this.imap = connection;
    this.smtp = { socket: smtpSocket, reader: smtpReader };
  }

  async disconnect(): Promise<void> {
    this.smtp?.socket.write("QUIT\r\n");
    this.smtp?.socket.destroy();
    this.imap?.socket.write(`${this.nextTag(this.imap)} LOGOUT\r\n`);
    this.imap?.socket.destroy();
    this.smtp = undefined;
    this.imap = undefined;
    this.credentials = undefined;
  }

  async discoverCapabilities(): Promise<CapabilitySet> { return { ...CAPABILITIES }; }
  capabilities(): CapabilitySet { return { ...CAPABILITIES }; }

  private nextTag(connection: ImapConnection): string {
    connection.tag += 1;
    return `A${String(connection.tag).padStart(4, "0")}`;
  }

  private ensureConnected(): { imap: ImapConnection & { reader: SocketReader }; smtp: tls.TLSSocket; credentials: EmailCredentials } {
    const imap = this.imap;
    const smtp = this.smtp;
    const credentials = this.credentials;
    if (!imap || !smtp || !credentials) throw new Error("IMAP/SMTP adapter is not connected");
    return { imap, smtp: smtp.socket, credentials };
  }

  async listFolders(): Promise<EmailFolder[]> {
    const { imap } = this.ensureConnected();
    const tag = this.nextTag(imap);
    imap.socket.write(`${tag} LIST "" "*"\r\n`);
    const folders: EmailFolder[] = [];
    while (true) {
      const line = await readLine(imap.reader);
      if (line.startsWith(`${tag} OK`)) return folders;
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) throw new Error(`IMAP LIST failed: ${line}`);
      const match = line.match(/^\* LIST \([^)]*\) "[^"]*" (.+)$/);
      if (match) {
        const rawName = match[1]?.replace(/^"|"$/g, "");
        if (!rawName) continue;
        const lower = rawName.toLowerCase();
        const role = lower === "inbox" ? "inbox" : lower === "sent" ? "sent" : lower === "drafts" ? "drafts" : lower === "trash" ? "trash" : lower === "spam" ? "spam" : "custom";
        folders.push({ id: rawName, email_account_id: "imap_smtp", provider_folder_id: rawName, name: rawName, role, unread_count: 0 });
      }
    }
  }

  private async command(command: string): Promise<string[]> {
    const { imap } = this.ensureConnected();
    const tag = this.nextTag(imap);
    imap.socket.write(`${tag} ${command}\r\n`);
    const lines: string[] = [];
    while (true) {
      const line = await readLine(imap.reader, 20_000);
      if (line.startsWith(`${tag} OK`)) return lines;
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
        throw new Error(`IMAP command failed (${command.split(" ")[0]}): ${line}`);
      }
      lines.push(line);
    }
  }

  private parseRawMessage(raw: string, folderId: string, uid: string, flagsLine = ""): EmailMessage {
    const split = raw.search(/\r?\n\r?\n/);
    const headerText = split >= 0 ? raw.slice(0, split) : raw;
    const body = split >= 0 ? raw.slice(split).replace(/^\r?\n\r?\n/, "") : "";
    const unfolded = headerText.replace(/\r?\n[ \t]+/g, " ");
    const headers = new Map<string, string>();
    for (const line of unfolded.split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
    }
    const decodeHeader = (value: string) => value.replace(/=?UTF-8?\?B\?([^?]+)\?=/gi, (_m, encoded: string) => {
      try { return Buffer.from(encoded, "base64").toString("utf8"); } catch { return encoded; }
    }).replace(/=?UTF-8?\?Q\?([^?]+)\?=/gi, (_m, encoded: string) => encoded.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_h, hex: string) => String.fromCharCode(parseInt(hex, 16))));
    const addressList = (value: string | undefined) => (value ?? "").split(",").map((item) => item.match(/<([^>]+)>/)?.[1] ?? item.trim()).filter((item) => /^[^\s@]+@[^\s@]+$/.test(item));
    const from = headers.get("from") ?? "";
    const contentType = headers.get("content-type") ?? "text/plain";
    let textBody = body;
    const transfer = (headers.get("content-transfer-encoding") ?? "").toLowerCase();
    if (transfer === "base64") {
      try { textBody = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8"); } catch { /* retain raw body */ }
    } else if (transfer === "quoted-printable") {
      textBody = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    }
    if (/multipart\//i.test(contentType)) {
      const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
      if (boundary) {
        const plainPart = body.split(`--${boundary}`).find((part) => /content-type:\s*text\/plain/i.test(part));
        if (plainPart) textBody = plainPart.replace(/^.*?\r?\n\r?\n/s, "").replace(/\r?\n--?\s*$/s, "");
      }
    }
    const fromAddress = addressList(from)[0] ?? from.replace(/^.*<([^>]+)>.*$/, "$1").trim();
    const date = headers.get("date");
    const received = date ? new Date(date) : new Date();
    const safeDate = Number.isNaN(received.getTime()) ? new Date() : received;
    const subject = decodeHeader(headers.get("subject") ?? "");
    const messageId = headers.get("message-id") ?? "";
    const uidMatch = flagsLine.match(/UID\s+(\d+)/i);
    const flags = flagsLine.match(/FLAGS\s+\(([^)]*)\)/i)?.[1] ?? "";
    return {
      id: `${folderId}:${uid}`, email_account_id: "imap_smtp", thread_id: headers.get("references")?.split(/\s+/).filter(Boolean)[0] || messageId || `${folderId}:${uid}`,
      folder_id: folderId, provider_message_id: `${folderId}:${uidMatch?.[1] ?? uid}`, message_id_header: messageId,
      in_reply_to: headers.get("in-reply-to"), references: (headers.get("references") ?? "").split(/\s+/).filter(Boolean),
      from_address: fromAddress, to_addresses: addressList(headers.get("to")), cc_addresses: addressList(headers.get("cc")), bcc_addresses: addressList(headers.get("bcc")),
      subject, text_body: textBody.slice(0, 100_000), html_body: undefined, snippet: textBody.replace(/\s+/g, " ").slice(0, 240),
      received_at: safeDate.toISOString(), is_read: /\\Seen/i.test(flags), is_starred: /\\Flagged/i.test(flags),
      is_draft: /drafts/i.test(folderId), is_outbound: /sent/i.test(folderId), importance_score: 0.3, action_required: false,
      has_attachments: /content-disposition:\s*attachment/i.test(body), embedding_status: "pending",
    };
  }

  async sync(state: SyncState): Promise<SyncResult> {
    const { imap } = this.ensureConnected();
    const folders = await this.listFolders();
    const encoded = state.cursor?.startsWith("imap:") ? state.cursor.slice(5) : "";
    let folderIndex = 0;
    let lastUid = 0;
    let previousValidity = "";
    if (encoded) {
      const parts = encoded.split(":");
      folderIndex = Number(parts[0]) || 0;
      lastUid = Number(parts[1]) || 0;
      previousValidity = parts[2] ?? "";
    }
    const checkpoints: Record<string, { uid: number; validity: string }> = {};
    // Checkpoints must survive bounded initial-import batches too, not only incremental runs.
    if (state.history_token?.startsWith("imap-v1:")) {
      try { Object.assign(checkpoints, JSON.parse(decodeURIComponent(state.history_token.slice(8)))); } catch { /* invalid cursor forces safe rescan */ }
    }
    const added: SyncResult["added"] = [];
    const updated: SyncResult["updated"] = [];
    let pages = 0;
    while (folderIndex < folders.length && pages < 2) {
      const folder = folders[folderIndex]!;
      const selected = await this.command(`SELECT ${quote(folder.provider_folder_id)}`);
      const validity = selected.join("\n").match(/UIDVALIDITY\s+(\d+)/i)?.[1] ?? "unknown";
      const savedCheckpoint = checkpoints[folder.provider_folder_id];
      if ((!encoded || (!previousValidity && lastUid === 0)) && (state.sync_mode === "incremental" || savedCheckpoint)) lastUid = savedCheckpoint?.validity === validity ? savedCheckpoint.uid : 0;
      if (previousValidity && previousValidity !== validity) lastUid = 0;
      const lines = await this.command("UID SEARCH ALL");
      const uidLine = lines.find((line) => /^\* SEARCH(?:\s|$)/i.test(line)) ?? "";
      const uids = (uidLine.replace(/^\* SEARCH\s*/i, "").match(/\d+/g) ?? []).map(Number).filter((uid) => uid > 0).sort((a,b)=>a-b);
      const fresh = uids.filter((uid) => uid > lastUid).slice(0, 50);
      for (const uid of fresh) {
        const fetched = await this.command(`UID FETCH ${uid} (UID FLAGS INTERNALDATE BODY.PEEK[])`);
        const start = fetched.findIndex((line) => /FETCH \(/i.test(line) && /BODY\[\]/i.test(line));
        if (start < 0) continue;
        const raw = fetched.slice(start).join("\r\n");
        const message = this.parseRawMessage(raw, folder.provider_folder_id, String(uid), fetched[start] ?? "");
        (state.sync_mode === "initial" ? added : updated).push({ message_id: message.id, provider_message_id: message.provider_message_id ?? message.id });
      }
      pages++;
      if (fresh.length === 50 && (uids.find((uid) => uid > fresh[fresh.length - 1]!) !== undefined)) {
        lastUid = fresh[fresh.length - 1]!;
        checkpoints[folder.provider_folder_id] = { uid: lastUid, validity };
        return {
          added, updated, deleted: [],
          new_state: {
            ...state,
            cursor: `imap:${folderIndex}:${lastUid}:${validity}`,
            history_token: `imap-v1:${encodeURIComponent(JSON.stringify(checkpoints))}`,
            sync_mode: "initial",
            last_sync_at: new Date().toISOString(),
          },
        };
      }
      checkpoints[folder.provider_folder_id] = { uid: uids.length ? Math.max(...uids) : 0, validity };
      folderIndex++;
      lastUid = 0;
      previousValidity = "";
    }
    const hasMore = folderIndex < folders.length;
    return {
      added, updated, deleted: [],
      new_state: { ...state, cursor: hasMore ? `imap:${folderIndex}:0:` : undefined, history_token: `imap-v1:${encodeURIComponent(JSON.stringify(checkpoints))}`, sync_mode: hasMore ? "initial" : "incremental", last_sync_at: new Date().toISOString() },
    };
  }

  async listMessages(folderId: string, opts: ListOptions): Promise<EmailMessage[]> {
    await this.command(`SELECT ${quote(folderId)}`);
    const result = await this.command("UID SEARCH ALL");
    const line = result.find((entry) => /^\* SEARCH/i.test(entry)) ?? "";
    const uids = (line.replace(/^\* SEARCH\s*/i, "").match(/\d+/g) ?? []).slice(-(Math.min(opts.limit ?? 50, 100)));
    const messages: EmailMessage[] = [];
    for (const uid of uids) {
      const fetched = await this.command(`UID FETCH ${uid} (UID FLAGS INTERNALDATE BODY.PEEK[])`);
      const start = fetched.findIndex((entry) => /FETCH \(/i.test(entry) && /BODY\[\]/i.test(entry));
      if (start >= 0) messages.push(this.parseRawMessage(fetched.slice(start).join("\r\n"), folderId, uid, fetched[start] ?? ""));
    }
    return messages;
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    const split = messageId.lastIndexOf(":");
    if (split < 1) return null;
    const folder = messageId.slice(0, split);
    const uid = messageId.slice(split + 1);
    await this.command(`SELECT ${quote(folder)}`);
    const fetched = await this.command(`UID FETCH ${uid} (UID FLAGS INTERNALDATE BODY.PEEK[])`);
    const start = fetched.findIndex((entry) => /FETCH \(/i.test(entry) && /BODY\[\]/i.test(entry));
    return start < 0 ? null : this.parseRawMessage(fetched.slice(start).join("\r\n"), folder, uid, fetched[start] ?? "");
  }

  async getThread(threadId: string): Promise<EmailMessage[]> {
    return (await this.search({ text: threadId })).filter((message) => message.thread_id === threadId || message.message_id_header === threadId);
  }

  async search(query: SearchQuery): Promise<EmailMessage[]> {
    const folders = query.folder ? [{ provider_folder_id: query.folder }] : await this.listFolders();
    const messages: EmailMessage[] = [];
    for (const folder of folders) {
      const rows = await this.listMessages(folder.provider_folder_id, { limit: 100 });
      messages.push(...rows.filter((message) =>
        (!query.from || message.from_address.toLowerCase().includes(query.from.toLowerCase())) &&
        (!query.subject || message.subject.toLowerCase().includes(query.subject.toLowerCase())) &&
        (!query.text || `${message.subject}\n${message.text_body}\n${message.from_address}`.toLowerCase().includes(query.text.toLowerCase())) &&
        (!query.date_from || message.received_at >= query.date_from) &&
        (!query.date_to || message.received_at <= query.date_to)
      ));
    }
    return messages;
  }

  async createDraft(_params: DraftParams): Promise<DraftRef> { throw new Error("IMAP draft persistence is implemented by the email-sync worker"); }
  async updateDraft(_draftId: string, _params: Partial<DraftParams>): Promise<DraftRef> { throw new Error("IMAP draft persistence is implemented by the email-sync worker"); }
  async deleteDraft(_draftId: string): Promise<void> { throw new Error("IMAP draft persistence is implemented by the email-sync worker"); }
  async sendDraft(_draftId: string): Promise<SentMessageRef> { throw new Error("SMTP send requires persisted draft resolution"); }
  async send(_draftId: string): Promise<SentMessageRef> { return this.sendDraft(_draftId); }
  async reply(_messageId: string, _params: DraftParams): Promise<SentMessageRef> { throw new Error("SMTP reply requires persisted message resolution"); }
  async forward(_messageId: string, _to: string[]): Promise<SentMessageRef> { throw new Error("SMTP forward requires persisted message resolution"); }
  async markRead(_messageIds: string[], _isRead: boolean): Promise<void> { throw new Error("IMAP flag updates are implemented by the email-sync worker"); }
  async markUnread(_messageIds: string[]): Promise<void> { throw new Error("IMAP flag updates are implemented by the email-sync worker"); }
  async archive(_messageIds: string[]): Promise<void> { throw new Error("IMAP archive is implemented by the email-sync worker"); }
  async move(_messageIds: string[], _targetFolderId: string): Promise<void> { throw new Error("IMAP move is implemented by the email-sync worker"); }
  async downloadAttachment(_attachmentId: string): Promise<Buffer> { throw new Error("IMAP attachment retrieval is implemented by the email-sync worker"); }
}
