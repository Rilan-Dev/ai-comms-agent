import * as tls from "node:tls";
import { promises as dns } from "node:dns";
import type {
  CapabilitySet, DraftParams, DraftRef, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: false, sync_incremental: false, sync_full: true,
  sync_webhook: false, sync_idle: true, search_server_side: true,
  search_client_side: true, drafts: true, reply: true, forward: true,
  mark_read: true, archive: false, move: true, threads: false,
  attachments_download: true, attachments_upload: false, send: true,
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
      `AUTH PLAIN ${Buffer.from(`\\0${username}\\0${password}`).toString("base64")}`,
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
    imap.socket.write(`${tag} LIST "" "*"
`);
    const folders: EmailFolder[] = [];
    while (true) {
      const line = await readLine(imap.reader);
      if (line.startsWith(`${tag} OK`)) return folders;
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) throw new Error(`IMAP LIST failed: ${line}`);
      const match = line.match(/^\* LIST \([^)]*\) "[^"]*" (.+)$/);
      if (match) {
        const rawName = match[1].replace(/^"|"$/g, "");
        const lower = rawName.toLowerCase();
        const role = lower === "inbox" ? "inbox" : lower === "sent" ? "sent" : lower === "drafts" ? "drafts" : lower === "trash" ? "trash" : lower === "spam" ? "spam" : "custom";
        folders.push({ id: rawName, email_account_id: "imap_smtp", provider_folder_id: rawName, name: rawName, role, unread_count: 0 });
      }
    }
  }

  async sync(state: SyncState): Promise<SyncResult> {
    this.ensureConnected();
    return { added: [], updated: [], deleted: [], new_state: { ...state, sync_mode: "incremental", last_sync_at: new Date().toISOString() } };
  }

  async listMessages(_folderId: string, _opts: ListOptions): Promise<EmailMessage[]> { throw new Error("IMAP message sync is implemented by the email-sync worker"); }
  async getMessage(_messageId: string): Promise<EmailMessage | null> { throw new Error("IMAP message retrieval is implemented by the email-sync worker"); }
  async getThread(_threadId: string): Promise<EmailMessage[]> { throw new Error("IMAP thread retrieval is implemented by the email-sync worker"); }
  async search(_query: SearchQuery): Promise<EmailMessage[]> { throw new Error("IMAP search is implemented by the email-sync worker"); }

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
