import * as tls from "node:tls";
import { randomUUID } from "node:crypto";
import { promises as dns } from "node:dns";
import type {
  CapabilitySet, DraftParams, DraftRef, EmailCredentials, EmailFolder, EmailLabel,
  EmailMessage, EmailProvider, ListOptions, SearchQuery, SentMessageRef, SyncResult, SyncState,
} from "@ai-comms-agent/shared";
import { parseRfc822 } from "@ai-comms-agent/shared";

const CAPABILITIES: CapabilitySet = {
  folders: true, labels: false, sync_incremental: true, sync_full: true,
  sync_webhook: false, sync_idle: false, search_server_side: false,
  search_client_side: true, drafts: true, reply: true, forward: true,
  mark_read: true, archive: true, move: true, threads: true,
  attachments_download: false, attachments_upload: false, send: true,
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

export function serverSupportsImapIdle(lines: string[]): boolean {
  return lines.some((line) => /^\* CAPABILITY\b/i.test(line) && /(?:^|\s)IDLE(?:\s|$)/i.test(line));
}

export function isImapIdleChangeNotification(line: string): boolean {
  return /^\*\s+\d+\s+(?:EXISTS|EXPUNGE|FETCH)\b/i.test(line)
    || /^\*\s+VANISHED\b/i.test(line);
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

/**
 * The deadline applies ONLY to TLS negotiation. Once secureConnect fires, the
 * socket belongs to the IMAP/SMTP command reader and must not be destroyed by
 * an expired handshake timer during an otherwise healthy mailbox import.
 */
export function waitForTlsHandshake(socket: tls.TLSSocket, host: string, port: number, timeoutMs: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onReady = () => settle();
    const onError = (error: Error) => settle(error);
    const onClose = () => settle(new Error(`TLS connection closed before handshake to ${host}:${port}`));
    const timer = setTimeout(() => settle(new Error(`TLS connection timeout to ${host}:${port}`)), timeoutMs);
    function settle(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("secureConnect", onReady);
      socket.off("error", onError);
      socket.off("close", onClose);
      if (error) {
        socket.destroy();
        reject(error);
      } else {
        resolve(socket);
      }
    }
    socket.once("secureConnect", onReady);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function connectTls(host: string, port: number, timeoutMs = 10_000): Promise<tls.TLSSocket> {
  const resolved = await resolvePublicHost(host);
  const socket = tls.connect({ host: resolved.address, port, servername: host, rejectUnauthorized: true });
  return waitForTlsHandshake(socket, host, port, timeoutMs);
}

type SocketReader = {
  socket: tls.TLSSocket;
  buffer: Buffer;
  error?: Error;
};

function createReader(socket: tls.TLSSocket): SocketReader {
  const reader: SocketReader = { socket, buffer: Buffer.alloc(0) };
  // One PERSISTENT data listener per reader. All readLine / readBytes calls
  // poll this same buffer; no readLine/readBytes ever registers its own
  // data listener. This eliminates the buffer-duplication bug where two
  // listeners (a persistent one from readLine and a transient one from
  // readBytes) would each append the same chunk to the same buffer.
  socket.on("data", (chunk: Buffer | string) => {
    reader.buffer = Buffer.concat([reader.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  });
  socket.on("error", (error: Error) => { reader.error = error; });
  socket.on("close", () => { reader.error ??= new Error("TLS socket closed before IMAP/SMTP response completed"); });
  return reader;
}

/**
 * Resolve when the reader may have made progress — new data buffered, an
 * error recorded, or the socket closed — or after `timeoutMs`, whichever
 * comes first.
 *
 * Waiting is fully event-driven. The previous implementation polled with
 * `await setImmediate(...)` in a `while` loop, which spins the event loop
 * continuously: one active IMAP IDLE watch (RFC 2177 pushes can be silent
 * for the full 25-minute reissue window) burned an entire CPU core on the
 * production worker. Registering listeners for the socket's own events keeps
 * the loop idle instead.
 */
function waitForReaderProgress(reader: SocketReader, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      reader.socket.off("data", wake);
      reader.socket.off("error", wake);
      reader.socket.off("close", wake);
      resolve();
    };
    const timer = setTimeout(wake, Math.max(0, timeoutMs));
    // The persistent data/error/close listeners installed by createReader
    // were registered first, so by the time `wake` runs the chunk is already
    // appended to reader.buffer (or reader.error is already set).
    reader.socket.once("data", wake);
    reader.socket.once("error", wake);
    reader.socket.once("close", wake);
  });
}

async function readBytes(reader: SocketReader, length: number, timeoutMs = 10_000): Promise<Buffer> {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid IMAP literal length");
  const start = Date.now();
  for (;;) {
    if (reader.buffer.length >= length) break;
    if (reader.error) throw reader.error;
    const remaining = timeoutMs - (Date.now() - start);
    if (remaining <= 0) break;
    await waitForReaderProgress(reader, remaining);
  }
  if (reader.buffer.length < length) throw new Error("TLS response timeout");
  const result = reader.buffer.subarray(0, length);
  reader.buffer = reader.buffer.subarray(length);
  return result;
}

async function readLine(reader: SocketReader, timeoutMs = 10_000): Promise<string> {
  const delimiter = Buffer.from("\r\n");
  const start = Date.now();
  for (;;) {
    const index = reader.buffer.indexOf(delimiter);
    if (index >= 0) {
      const line = reader.buffer.subarray(0, index).toString("utf8");
      reader.buffer = reader.buffer.subarray(index + delimiter.length);
      return line;
    }
    if (reader.error) throw reader.error;
    const remaining = timeoutMs - (Date.now() - start);
    if (remaining <= 0) break;
    await waitForReaderProgress(reader, remaining);
  }
  throw new Error("TLS response timeout");
}

/** Read an IMAP response while consuming literal payloads by octet length. */
export async function readImapResponse(reader: SocketReader, timeoutMs = 60_000): Promise<string> {
  let response = await readLine(reader, timeoutMs);
  const literalMarker = /\{(\d+)\+?\}$/;
  while (true) {
    const match = response.match(literalMarker);
    if (!match) return response;
    const length = Number(match[1]);
    if (!Number.isSafeInteger(length) || length > 50 * 1024 * 1024) throw new Error("IMAP literal exceeds the 50 MiB safety limit");
    const literal = await readBytes(reader, length, timeoutMs);
    response += "\r\n" + literal.toString("utf8");
    response += "\r\n" + await readLine(reader, timeoutMs);
  }
}

/**
 * Read lines from the IMAP socket until we find one whose tag matches `tag`.
 *
 * IMAP servers can emit zero or more untagged responses (lines starting with
 * `*`) before the tagged response (e.g. `A0001 OK …`). The plain readLine
 * helper only reads the FIRST line, which broke against Gmail's LOGIN
 * response: Gmail sends `* CAPABILITY …\r\nA0001 OK authenticated` and the
 * first-line check saw `* CAPABILITY` instead of `A0001 OK`, producing a
 * spurious "IMAP authentication failed" error.
 */
async function readUntilTag(reader: SocketReader, tag: string, timeoutMs = 20_000): Promise<string> {
  while (true) {
    const line = await readLine(reader, timeoutMs);
    // Tagged response matches "<tag> <result>" (e.g. "A0001 OK …").
    if (line.startsWith(tag + " ")) return line;
    // Untagged responses (`* …`) and continuation requests (`+ …`) are
    // skipped; we keep reading until the tagged response arrives.
  }
}

async function smtpCommand(reader: SocketReader, command: string): Promise<string> {
  reader.socket.write(command + "\r\n");
  // SMTP responses can be multi-line: continuation lines have the form
  // "NNN-" and the final line has the form "NNN " (3-digit code, then either
  // '-' for continuation or ' ' for the final line). We must consume ALL
  // continuation lines, otherwise the next smtpCommand reads a stale buffered
  // line instead of its own response.
  let line = await readLine(reader);
  while (/^\d{3}-/.test(line)) {
    line = await readLine(reader);
  }
  return line;
}

/**
 * IMAP LIST can include hierarchy-only containers (for example Gmail's
 * `[Gmail]` with \\Noselect). These must never be passed to SELECT/FETCH.
 * Preserve the original selectable folder name for subsequent UID commands.
 */
export function parseSelectableImapFolder(line: string): EmailFolder | null {
  const match = line.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i);
  if (!match) return null;
  if (/\\(?:Noselect|NonExistent)(?:\s|$)/i.test(match[1] ?? "")) return null;
  const rawName = match[2]?.replace(/^"|"$/g, "");
  if (!rawName || rawName === "NIL") return null;
  const lower = rawName.toLowerCase();
  const role = lower === "inbox" ? "inbox" : lower === "sent" ? "sent" : lower === "drafts" ? "drafts" : lower === "trash" ? "trash" : lower === "spam" ? "spam" : "custom";
  return { id: rawName, email_account_id: "imap_smtp", provider_folder_id: rawName, name: rawName, role, unread_count: 0 };
}

/**
 * UID FETCH responses wrap the RFC822 message in an IMAP literal:
 *   * 1 FETCH (BODY[] {N}\r\n<RFC822 N octets>\r\n)
 * Parsing the wrapper as message headers leaks transport framing into the
 * body; use the declared octet length to exclude the closing IMAP tokens.
 */
export function extractImapRfc822Source(response: string): string {
  const literal = /BODY\[\] \{(\d+)\+?\}\r\n/i.exec(response);
  if (!literal) return response;
  const length = Number(literal[1]);
  if (!Number.isSafeInteger(length) || length < 0 || length > 50 * 1024 * 1024) {
    throw new Error("Invalid IMAP RFC822 literal length");
  }
  const start = literal.index + literal[0].length;
  const bytes = Buffer.from(response.slice(start), "utf8");
  if (bytes.length < length) throw new Error("Incomplete IMAP RFC822 literal");
  return bytes.subarray(0, length).toString("utf8");
}

export class ImapSmtpAdapter implements EmailProvider {
  readonly providerId = "imap_smtp" as const;
  private credentials?: EmailCredentials;
  private idleSupported?: boolean;
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
    // Read past untagged CAPABILITY / continuation lines until the tagged
    // OK/NO/BAD response arrives. Gmail emits `* CAPABILITY …\r\nA0001 OK …`
    // which a single readLine would not match.
    const login = await readUntilTag(imapReader, loginTag);
    if (!login.startsWith(`${loginTag} OK`)) {
      imapSocket.destroy();
      const detail = login.slice(loginTag.length + 1).trim();
      throw new Error(`IMAP authentication failed: ${detail || "server rejected credentials"}`);
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
    this.idleSupported = undefined;
  }

  async supportsIdle(): Promise<boolean> {
    const lines = await this.command("CAPABILITY");
    this.idleSupported = serverSupportsImapIdle(lines);
    return this.idleSupported;
  }

  async discoverCapabilities(): Promise<CapabilitySet> {
    try { await this.supportsIdle(); } catch { this.idleSupported = false; }
    return this.capabilities();
  }
  capabilities(): CapabilitySet {
    return { ...CAPABILITIES, sync_idle: this.idleSupported ?? false };
  }

  /**
   * Wait for an Inbox change using RFC 2177 IDLE. Always leave IDLE with DONE
   * before returning so callers can run a normal UID/cursor reconciliation.
   * A 25-minute default reissue interval stays below RFC 2177's 29-minute
   * client termination recommendation.
   */
  async waitForMailboxChange(
    timeoutMs = 25 * 60 * 1000,
    signal?: AbortSignal,
  ): Promise<"changed" | "timeout" | "unsupported"> {
    const { imap } = this.ensureConnected();
    if (!(await this.supportsIdle())) return "unsupported";
    await this.command(`SELECT ${quote("INBOX")}`);

    const tag = this.nextTag(imap);
    imap.socket.write(`${tag} IDLE\r\n`);
    const deadline = Date.now() + Math.max(1_000, timeoutMs);
    let enteredIdle = false;
    let taggedComplete = false;
    let changed = false;
    try {
      while (!signal?.aborted && Date.now() < deadline) {
        let line: string;
        try {
          line = await readLine(imap.reader, Math.min(1_000, Math.max(1, deadline - Date.now())));
        } catch (error) {
          if (error instanceof Error && error.message === "TLS response timeout") continue;
          throw error;
        }

        if (!enteredIdle) {
          if (line.startsWith("+")) {
            enteredIdle = true;
            continue;
          }
          if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
            taggedComplete = true;
            throw new Error(`IMAP IDLE rejected: ${line.slice(tag.length).trim()}`);
          }
          if (line.startsWith(`${tag} OK`)) {
            taggedComplete = true;
            changed = true;
            break;
          }
          continue;
        }

        if (line.startsWith(`${tag} `)) {
          taggedComplete = true;
          changed = true;
          break;
        }
        if (isImapIdleChangeNotification(line)) {
          changed = true;
          break;
        }
      }
    } finally {
      if (enteredIdle && !taggedComplete && !imap.socket.destroyed) {
        imap.socket.write("DONE\r\n");
        await readUntilTag(imap.reader, tag, 5_000).catch(() => undefined);
      }
    }

    return changed ? "changed" : "timeout";
  }

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
      const line = await readImapResponse(imap.reader);
      if (line.startsWith(`${tag} OK`)) return folders;
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) throw new Error(`IMAP LIST failed: ${line}`);
      const folder = parseSelectableImapFolder(line);
      if (folder) folders.push(folder);
    }
  }

  private async command(command: string): Promise<string[]> {
    const { imap } = this.ensureConnected();
    const tag = this.nextTag(imap);
    imap.socket.write(`${tag} ${command}\r\n`);
    const lines: string[] = [];
    while (true) {
      const line = await readImapResponse(imap.reader, 60_000);
      if (line.startsWith(`${tag} OK`)) return lines;
      if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
        throw new Error(`IMAP command failed (${command.split(" ")[0]}): ${line}`);
      }
      lines.push(line);
    }
  }

  private parseRawMessage(raw: string, folderId: string, uid: string, flagsLine = ""): EmailMessage {
    // Shared MIME parser handles multipart/alternative, nested MIME parts,
    // quoted-printable UTF-8, base64, and sender names. The former inline
    // parser returned undecoded part headers and discarded text/html entirely.
    const parsed = parseRfc822(extractImapRfc822Source(raw));
    const messageId = parsed.message_id ? `<${parsed.message_id}>` : "";
    const references = parsed.references.map((id) => `<${id}>`);
    const received = parsed.date ? new Date(parsed.date) : new Date();
    const safeDate = Number.isNaN(received.getTime()) ? new Date() : received;
    const uidMatch = flagsLine.match(/UID\s+(\d+)/i);
    const flags = flagsLine.match(/FLAGS\s+\(([^)]*)\)/i)?.[1] ?? "";
    const textBody = parsed.text_body;
    return {
      id: `${folderId}:${uid}`,
      email_account_id: "imap_smtp",
      thread_id: references[0] || messageId || `${folderId}:${uid}`,
      folder_id: folderId,
      provider_message_id: `${folderId}:${uidMatch?.[1] ?? uid}`,
      message_id_header: messageId,
      in_reply_to: parsed.in_reply_to ? `<${parsed.in_reply_to}>` : undefined,
      references,
      from_address: parsed.from,
      from_name: parsed.from_name || undefined,
      to_addresses: parsed.to,
      cc_addresses: parsed.cc,
      bcc_addresses: parsed.bcc,
      subject: parsed.subject,
      text_body: textBody.slice(0, 100_000),
      // Raw sender HTML is UNTRUSTED; never render it in React's DOM.
      // The existing mail reader uses an opaque-origin iframe with a strict
      // no-script/no-network CSP. Ingestion sanitization remains a separate
      // FIX-01 security gate and is not implied by the DB column name.
      html_body: parsed.html_body ? parsed.html_body.slice(0, 1_000_000) : undefined,
      snippet: textBody.replace(/\s+/g, " ").slice(0, 240),
      received_at: safeDate.toISOString(),
      is_read: /\\Seen/i.test(flags),
      is_starred: /\\Flagged/i.test(flags),
      is_draft: /\\Draft\b/i.test(flags) || /drafts/i.test(folderId),
      is_outbound: /sent/i.test(folderId),
      importance_score: 0.3,
      action_required: false,
      has_attachments: /content-disposition:\s*attachment/i.test(raw),
      embedding_status: "pending",
    };
  }

  async sync(state: SyncState): Promise<SyncResult> {
    this.ensureConnected();
    const folders = (await this.listFolders()).sort((a, b) =>
      Number(b.role === "inbox") - Number(a.role === "inbox"));
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
      const available = uids.filter((uid) => uid > lastUid);
      const historicalBudget = state.initial_message_limit == null ? 50
        : Math.max(0, state.initial_message_limit - (state.initial_imported_count ?? 0) - added.length);
      // Fresh connections import the newest bounded UIDs, never thousands of
      // old full MIME bodies. The highest UID becomes the checkpoint for
      // subsequent live polling; unselected old UIDs are deliberately skipped.
      const recentInitial = state.sync_mode === "initial" && !encoded && !savedCheckpoint;
      const fresh = recentInitial
        ? available.slice(-Math.min(100, historicalBudget))
        : available.slice(0, 50);
      // UID SEARCH is sufficient to stage work. Fetching complete MIME bodies
      // here blocks all checkpointing (and duplicates getMessage() downloads).
      // The mailbox worker fetches/persists each staged UID separately.
      for (const uid of fresh) {
        const messageId = `${folder.provider_folder_id}:${uid}`;
        (state.sync_mode === "initial" ? added : updated).push({
          message_id: messageId, provider_message_id: messageId,
        });
      }
      pages++;
      if (!recentInitial && fresh.length === 50 && (uids.find((uid) => uid > fresh[fresh.length - 1]!) !== undefined)) {
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

  private validateAddresses(addresses: string[]): string[] {
    if (!Array.isArray(addresses) || addresses.length === 0) throw new Error("At least one recipient is required");
    return addresses.map((address) => {
      const value = address.trim();
      if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value) || /[\r\n]/.test(value)) {
        throw new Error("Invalid email recipient address");
      }
      return value;
    });
  }

  private buildMime(params: DraftParams, messageId = `<${randomUUID()}@ai-comms-agent.local>`, extraHeaders: Record<string, string> = {}): string {
    const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
    const subject = cleanHeader(params.subject ?? "");
    const subjectHeader = /^[\x20-\x7e]*$/.test(subject) ? subject : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
    const to = this.validateAddresses(params.to).join(", ");
    const cc = params.cc?.length ? this.validateAddresses(params.cc).join(", ") : "";
    const bcc = params.bcc?.length ? this.validateAddresses(params.bcc).join(", ") : "";
    const headers = [
      `From: ${cleanHeader(this.ensureConnected().credentials.username ?? "")}`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subjectHeader}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      ...Object.entries(extraHeaders).map(([key, value]) => `${key}: ${cleanHeader(value)}`),
      `MIME-Version: 1.0`,
      params.body_html
        ? "Content-Type: text/html; charset=UTF-8"
        : "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.body_html ?? params.body_text,
    ];
    return headers.join("\r\n");
  }

  private async appendDraft(raw: string): Promise<DraftRef> {
    const { imap, credentials } = this.ensureConnected();
    const folder = (await this.listFolders()).find((item) => item.role === "drafts" || /drafts/i.test(item.name));
    if (!folder) throw new Error("The IMAP server does not expose a Drafts folder");
    await this.command(`SELECT ${quote(folder.provider_folder_id)}`);
    const tag = this.nextTag(imap);
    const literal = Buffer.from(raw, "utf8");
    imap.socket.write(`${tag} APPEND ${quote(folder.provider_folder_id)} (\\Draft) {${literal.length}}\r\n`);
    const continuation = await readLine(imap.reader);
    if (!continuation.startsWith("+")) throw new Error(`IMAP APPEND rejected: ${continuation}`);
    imap.socket.write(Buffer.concat([literal, Buffer.from("\r\n", "utf8")]));
    const result = await readUntilTag(imap.reader, tag, 30_000);
    if (!result.startsWith(`${tag} OK`)) throw new Error(`IMAP draft save failed: ${result}`);
    const appendedUid = result.match(/APPENDUID\s+\d+\s+(\d+)/i)?.[1];
    let uid = appendedUid;
    if (!uid) {
      const messageId = raw.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim();
      if (messageId) {
        const found = await this.command(`UID SEARCH HEADER Message-ID ${quote(messageId)}`);
        uid = found.join("\n").match(/\* SEARCH\s+(\d+)/i)?.[1];
      }
    }
    if (!uid) throw new Error("Draft was appended but the server did not expose its UID; refusing to return an unstable draft reference");
    return { draft_id: `${folder.provider_folder_id}:${uid}`, account_id: credentials.account_id ?? "imap_smtp" };
  }

  async createDraft(params: DraftParams): Promise<DraftRef> {
    this.ensureConnected();
    const messageId = `<${randomUUID()}@ai-comms-agent.local>`;
    return this.appendDraft(this.buildMime(params, messageId, params.reply_to_message_id ? { "In-Reply-To": params.reply_to_message_id, References: params.references_header ?? params.reply_to_message_id } : {}));
  }

  async updateDraft(draftId: string, params: Partial<DraftParams>): Promise<DraftRef> {
    const existing = await this.getMessage(draftId);
    if (!existing || !existing.is_draft) throw new Error("Draft not found in the IMAP Drafts folder");
    const updated: DraftParams = {
      to: params.to ?? existing.to_addresses,
      cc: params.cc ?? existing.cc_addresses,
      bcc: params.bcc ?? existing.bcc_addresses,
      subject: params.subject ?? existing.subject,
      body_text: params.body_text ?? existing.text_body,
      body_html: params.body_html,
      reply_to_message_id: params.reply_to_message_id ?? existing.in_reply_to,
      references_header:params.references_header??existing.references?.join(" "),
    };
    const replacement = await this.createDraft(updated);
    await this.deleteDraft(draftId);
    return replacement;
  }

  async deleteDraft(draftId: string): Promise<void> {
    const split = draftId.lastIndexOf(":");
    if (split < 1 || !/^\d+$/.test(draftId.slice(split + 1))) throw new Error("Invalid IMAP draft reference");
    const folder = draftId.slice(0, split);
    const uid = draftId.slice(split + 1);
    await this.command(`SELECT ${quote(folder)}`);
    await this.command(`UID STORE ${uid} +FLAGS.SILENT (\\Deleted)`);
    await this.command("UID EXPUNGE " + uid).catch(async () => {
      // Roll back the Deleted flag when UID EXPUNGE is unavailable; never fall back
      // to EXPUNGE, which could remove unrelated messages already marked deleted.
      await this.command(`UID STORE ${uid} -FLAGS.SILENT (\\\\Deleted)`).catch(() => undefined);
      throw new Error("This IMAP server lacks UID EXPUNGE; draft deletion is not safe to complete");
    });
  }

  private async smtpSend(params: DraftParams, extraHeaders: Record<string, string> = {}): Promise<SentMessageRef> {
    const { smtp, credentials } = this.ensureConnected();
    const sender = (credentials.username ?? "").trim();
    if (!sender || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender)) throw new Error("A valid authenticated sender address is required");
    const recipients = [...this.validateAddresses(params.to), ...(params.cc?.length ? this.validateAddresses(params.cc) : []), ...(params.bcc?.length ? this.validateAddresses(params.bcc) : [])];
    const messageId = `<${randomUUID()}@ai-comms-agent.local>`;
    // Bcc recipients belong in the SMTP envelope, never in the delivered headers.
    const raw = this.buildMime(params, messageId, extraHeaders).replace(/^Bcc:.*\r?\n/im, "");
    const mail = await smtpCommand(this.smtp!.reader, `MAIL FROM:<${sender}>`);
    if (!/^250\b/.test(mail)) throw new Error("SMTP server rejected sender");
    for (const recipient of recipients) {
      const response = await smtpCommand(this.smtp!.reader, `RCPT TO:<${recipient}>`);
      if (!/^(250|251)\b/.test(response)) throw new Error(`SMTP server rejected recipient ${recipient}`);
    }
    const ready = await smtpCommand(this.smtp!.reader, "DATA");
    if (!/^354\b/.test(ready)) throw new Error("SMTP server did not accept message data");
    const dotStuffed = raw.replace(/\r?\n\./g, (match) => match.replace(".", "..")).replace(/\r?\n/g, "\r\n");
    smtp.write(dotStuffed + "\r\n.\r\n");
    const accepted = await readLine(this.smtp!.reader, 30_000);
    if (!/^250\b/.test(accepted)) throw new Error(`SMTP message submission failed: ${accepted}`);
    return { message_id: messageId, provider_message_id: messageId };
  }

  async sendDraft(draftId: string): Promise<SentMessageRef> {
    const message = await this.getMessage(draftId);
    if (!message || !message.is_draft) throw new Error("Draft not found in the IMAP Drafts folder");
    const result = await this.smtpSend({
      to: message.to_addresses, cc: message.cc_addresses, bcc: message.bcc_addresses,
      subject: message.subject, body_text: message.text_body,
    }, message.in_reply_to ? { "In-Reply-To": message.in_reply_to, References: message.references?.length?message.references.join(" "):message.in_reply_to } : {});
    await this.deleteDraft(draftId);
    return result;
  }

  async send(draftId: string): Promise<SentMessageRef> { return this.sendDraft(draftId); }

  async reply(messageId: string, params: DraftParams): Promise<SentMessageRef> {
    const source = await this.getMessage(messageId);
    if (!source) throw new Error("Source message not found");
    const to = params.to.length ? params.to : [source.from_address];
    const replyParams = { ...params, to, subject: params.subject || (/^re:/i.test(source.subject) ? source.subject : `Re: ${source.subject}`) };
    const references = [...(source.references ?? []), source.message_id_header].filter(Boolean).join(" ");
    return this.smtpSend(replyParams, {
      ...(source.message_id_header ? { "In-Reply-To": source.message_id_header } : {}),
      ...(references ? { References: references } : {}),
    });
  }

  async forward(messageId: string, to: string[]): Promise<SentMessageRef> {
    const source = await this.getMessage(messageId);
    if (!source) throw new Error("Source message not found");
    return this.smtpSend({
      to, subject: /^fwd?:/i.test(source.subject) ? source.subject : `Fwd: ${source.subject}`,
      body_text: `---------- Forwarded message ----------\nFrom: ${source.from_address}\nDate: ${source.received_at}\nSubject: ${source.subject}\nTo: ${source.to_addresses.join(", ")}\n\n${source.text_body}`,
    });
  }

  async markRead(messageIds: string[], isRead: boolean): Promise<void> {
    await this.updateFlags(messageIds, isRead ? "+FLAGS.SILENT (\\Seen)" : "-FLAGS.SILENT (\\Seen)");
  }

  async markUnread(messageIds: string[]): Promise<void> { return this.markRead(messageIds, false); }

  private async updateFlags(messageIds: string[], operation: string): Promise<void> {
    for (const messageId of messageIds) {
      const split = messageId.lastIndexOf(":");
      if (split < 1 || !/^\d+$/.test(messageId.slice(split + 1))) throw new Error("Invalid IMAP message reference");
      await this.command(`SELECT ${quote(messageId.slice(0, split))}`);
      await this.command(`UID STORE ${messageId.slice(split + 1)} ${operation}`);
    }
  }

  async archive(messageIds: string[]): Promise<void> {
    const folders = await this.listFolders();
    const archive = folders.find((folder) => folder.role === "archive" || /^(all mail|archive)$/i.test(folder.name));
    if (!archive) throw new Error("No Archive folder is available on this IMAP server");
    await this.move(messageIds, archive.provider_folder_id);
  }

  async move(messageIds: string[], targetFolderId: string): Promise<void> {
    const folders = await this.listFolders();
    if (!folders.some((folder) => folder.provider_folder_id === targetFolderId)) throw new Error("Target IMAP folder does not exist");
    for (const messageId of messageIds) {
      const split = messageId.lastIndexOf(":");
      if (split < 1 || !/^\d+$/.test(messageId.slice(split + 1))) throw new Error("Invalid IMAP message reference");
      const sourceFolder = messageId.slice(0, split);
      const uid = messageId.slice(split + 1);
      if (sourceFolder === targetFolderId) continue;
      await this.command(`SELECT ${quote(sourceFolder)}`);
      try {
        await this.command(`UID MOVE ${uid} ${quote(targetFolderId)}`);
      } catch {
        // Fallback is deliberately avoided: COPY + EXPUNGE can delete unrelated
        // messages on servers without UIDPLUS. Report unsupported instead.
        throw new Error("This IMAP server does not support safe UID MOVE");
      }
    }
  }

  async downloadAttachment(_attachmentId: string): Promise<Buffer> { throw new Error("IMAP attachment retrieval is not implemented"); }
}
