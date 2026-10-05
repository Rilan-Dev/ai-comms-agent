import tls from "node:tls";
import type {
  CapabilitySet, DraftParams, EmailCredentials, EmailFolder, EmailLabel,
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

function connectTls(host: string, port: number, timeoutMs = 10_000): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true }, () => resolve(socket));
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TLS connection timeout to ${host}:${port}`));
    }, timeoutMs);
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
    socket.once("close", () => clearTimeout(timer));
  });
}

async function readLine(socket: tls.TLSSocket, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => reject(new Error("TLS response timeout")), timeoutMs);
    const onData = (chunk: Buffer | string) => {
      data += chunk.toString();
      const index = data.indexOf("\r\n");
      if (index >= 0) {
        cleanup();
        resolve(data.slice(0, index));
      }
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

async function smtpCommand(socket: tls.TLSSocket, command: string): Promise<string> {
  socket.write(command + "\r\n");
  return readLine(socket);
}

export class ImapSmtpAdapter implements EmailProvider {
  readonly providerId = "imap_smtp" as const;
  private credentials?: EmailCredentials;
  private imap?: ImapConnection;
  private smtp?: tls.TLSSocket;

  async connect(credentials: EmailCredentials): Promise<void> {
    const host = required(credentials, "host");
    const username = required(credentials, "username");
    const password = credentials.password ?? credentials.access_token;
    if (!password) throw new Error("IMAP/SMTP requires password or app_password credentials");
    const imapPort = credentials.imap_port ?? credentials.port ?? 993;
    const smtpPort = credentials.smtp_port ?? 465;

    const imapSocket = await connectTls(host, imapPort);
    const greeting = await readLine(imapSocket);
    if (!greeting.startsWith("*")) {
      imapSocket.destroy();
      throw new Error("IMAP server returned an invalid greeting");
    }
    const connection: ImapConnection = { socket: imapSocket, buffer: "", tag: 0 };
    const loginTag = this.nextTag(connection);
    imapSocket.write(`${loginTag} LOGIN ${quote(username)} ${quote(password)}\r\n`);
    const login = await readLine(imapSocket);
    if (!login.startsWith(`${loginTag} OK`)) {
      imapSocket.destroy();
      throw new Error("IMAP authentication failed");
    }

    const smtpSocket = await connectTls(credentials.smtp_host ?? host, smtpPort);
    const smtpGreeting = await readLine(smtpSocket);
    if (!/^220\b/.test(smtpGreeting)) {
      smtpSocket.destroy();
      imapSocket.destroy();
      throw new Error("SMTP server returned an invalid greeting");
    }
    await smtpCommand(smtpSocket, `EHLO ${host}`);
    const auth = await smtpCommand(
      smtpSocket,
      `AUTH LOGIN ${Buffer.from(username).toString("base64")} ${Buffer.from(password).toString("base64")}`,
    );
    if (!/^235\b/.test(auth)) {
      smtpSocket.destroy();
      imapSocket.destroy();
      throw new Error("SMTP authentication failed");
    }

    this.credentials = { ...credentials, password: undefined, access_token: undefined };
    this.imap = connection;
    this.smtp = smtpSocket;
  }

  async disconnect(): Promise<void> {
    this.smtp?.write("QUIT\r\n");
    this.smtp?.destroy();
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

  private ensureConnected(): { imap: ImapConnection; smtp: tls.TLSSocket; credentials: EmailCredentials } {
    if (!this.imap || !this.smtp || !this.credentials) throw new Error("IMAP/SMTP adapter is not connected");
    return { imap: this.imap, smtp: this.smtp, credentials: this.credentials };
  }

  async listFolders(): Promise<EmailFolder[]> {
    const { imap } = this.ensureConnected();
    const tag = this.nextTag(imap);
    imap.socket.write(`${tag} LIST "" "*"
`);
    const folders: EmailFolder[] = [];
    while (true) {
      const line = await readLine(imap.socket);
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

  async createDraft(_params: DraftParams) { throw new Error("IMAP draft persistence is implemented by the email-sync worker"); }
  async updateDraft(_draftId: string, _params: Partial<DraftParams>) { throw new Error("IMAP draft persistence is implemented by the email-sync worker"); }
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
