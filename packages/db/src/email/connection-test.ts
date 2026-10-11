import * as tls from "node:tls";
import { promises as dns } from "node:dns";

export interface ImapSmtpConnectionTestInput {
  host: string; port: number; username: string; password: string;
  smtpHost: string; smtpPort: number; tls?: boolean;
}

function privateAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const p = address.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const a = p[0] ?? -1;
  const b = p[1] ?? -1;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
}
async function publicAddress(host: string): Promise<string> {
  const h = host.trim().toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost")) throw new Error("Mail host must resolve to a public address");
  const result = await dns.lookup(host, { family: 0 });
  if (privateAddress(result.address)) throw new Error("Mail host resolves to a private or local address");
  return result.address;
}
function connect(host: string, port: number): Promise<tls.TLSSocket> {
  return publicAddress(host).then((address) => new Promise((resolve, reject) => {
    const socket = tls.connect({ host: address, port, servername: host, rejectUnauthorized: true });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("TLS connection timed out")); }, 10000);
    socket.once("secureConnect", () => { clearTimeout(timer); resolve(socket); });
    socket.once("error", (e) => { clearTimeout(timer); reject(e); });
  }));
}
function line(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => cleanup(new Error("Mail server response timed out")), 10000);
    const onData = (chunk: Buffer) => { buffer += chunk.toString(); const i = buffer.indexOf("\r\n"); if (i >= 0) cleanup(undefined, buffer.slice(0, i)); };
    const onError = (e: Error) => cleanup(e);
    const cleanup = (error?: Error, value?: string) => { clearTimeout(timer); socket.off("data", onData); socket.off("error", onError); if (error) reject(error); else resolve(value ?? ""); };
    socket.on("data", onData); socket.once("error", onError);
  });
}

/**
 * Read lines from the IMAP socket until we find one whose tag matches `tag`.
 *
 * IMAP servers can emit zero or more untagged responses (lines starting with
 * `*`) before the tagged response (e.g. `A0001 OK …`). The previous
 * implementation only read the first line, which broke against Gmail's
 * LOGIN response: Gmail sends `* CAPABILITY …\r\nA0001 OK authenticated`
 * and the first-line check saw `* CAPABILITY` instead of `A0001 OK`,
 * producing a spurious "IMAP authentication failed" error.
 */
function imapReadUntilTag(socket: tls.TLSSocket, tag: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => { socket.off("data", onData); reject(new Error("IMAP server response timed out")); }, 10000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      // Process complete lines as they arrive.
      let nl: number;
      while ((nl = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        // Tagged response matches "<tag> <result>" (e.g. "A0001 OK …").
        if (line.startsWith(tag + " ")) {
          clearTimeout(timer);
          socket.off("data", onData);
          resolve(line);
          return;
        }
        // Untagged responses (`* …`) and continuation requests (`+ …`) are
        // skipped; we keep reading until the tagged response arrives.
      }
    };
    socket.on("data", onData);
    socket.once("error", (e) => { clearTimeout(timer); socket.off("data", onData); reject(e); });
  });
}

async function imapCommand(socket: tls.TLSSocket, tag: string, command: string): Promise<string> {
  socket.write(`${tag} ${command}\r\n`);
  return imapReadUntilTag(socket, tag);
}

async function smtpCommand(socket: tls.TLSSocket, command: string): Promise<string> {
  socket.write(command + "\r\n");
  // SMTP multiline responses use "nnn-" for continuation lines and "nnn " for
  // the final line. The first-line reader is sufficient for our tests because
  // we only check the leading 3-digit status code, and EHLO's first line is
  // always "250-" or "250 " which both satisfy /^250\b/.
  return line(socket);
}

export async function testImapSmtpConnection(input: ImapSmtpConnectionTestInput): Promise<{ imap: boolean; smtp: boolean }> {
  if (input.tls === false) throw new Error("TLS is mandatory for IMAP/SMTP connection testing");
  const imap = await connect(input.host, input.port);
  try {
    const greeting = await line(imap);
    if (!greeting.startsWith("*")) throw new Error("IMAP server returned an invalid greeting");
    const safeUser = input.username.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safePassword = input.password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // Send LOGIN and read all untagged responses until the tagged OK/NO/BAD.
    imap.write(`A0001 LOGIN "${safeUser}" "${safePassword}"\r\n`);
    const auth = await imapReadUntilTag(imap, "A0001");
    if (!auth.startsWith("A0001 OK")) {
      // Surface the server's actual failure text instead of a generic message.
      const detail = auth.slice("A0001 ".length).trim();
      throw new Error(`IMAP authentication failed: ${detail || "server rejected credentials"}`);
    }
  } finally { imap.destroy(); }
  const smtp = await connect(input.smtpHost, input.smtpPort);
  try {
    const greeting = await line(smtp);
    if (!/^220\b/.test(greeting)) throw new Error("SMTP server returned an invalid greeting");
    const ehlo = await smtpCommand(smtp, "EHLO ai-comms-agent");
    if (!/^250\b/.test(ehlo)) throw new Error("SMTP server rejected EHLO");
    // AUTH PLAIN uses base64("\0user\0pass"). Note the literal \0 (NUL)
    // separators, not the two-character string "\\0".
    const auth = await smtpCommand(smtp, `AUTH PLAIN ${Buffer.from(`\0${input.username}\0${input.password}`).toString("base64")}`);
    if (!/^235\b/.test(auth)) throw new Error("SMTP authentication failed");
  } finally { smtp.destroy(); }
  return { imap: true, smtp: true };
}
