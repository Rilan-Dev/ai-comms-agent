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
  const [a,b] = p;
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
async function smtpCommand(socket: tls.TLSSocket, command: string): Promise<string> { socket.write(command + "\r\n"); return line(socket); }

export async function testImapSmtpConnection(input: ImapSmtpConnectionTestInput): Promise<{ imap: boolean; smtp: boolean }> {
  if (input.tls === false) throw new Error("TLS is mandatory for IMAP/SMTP connection testing");
  const imap = await connect(input.host, input.port);
  try {
    const greeting = await line(imap);
    if (!greeting.startsWith("*")) throw new Error("IMAP server returned an invalid greeting");
    const safeUser = input.username.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safePassword = input.password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    imap.write(`A0001 LOGIN "${safeUser}" "${safePassword}"\r\n`);
    const auth = await line(imap);
    if (!auth.startsWith("A0001 OK")) throw new Error("IMAP authentication failed");
  } finally { imap.destroy(); }
  const smtp = await connect(input.smtpHost, input.smtpPort);
  try {
    const greeting = await line(smtp);
    if (!/^220\b/.test(greeting)) throw new Error("SMTP server returned an invalid greeting");
    const ehlo = await smtpCommand(smtp, "EHLO ai-comms-agent");
    if (!/^250\b/.test(ehlo)) throw new Error("SMTP server rejected EHLO");
    const auth = await smtpCommand(smtp, `AUTH PLAIN ${Buffer.from(`\\0${input.username}\\0${input.password}`).toString("base64")}`);
    if (!/^235\b/.test(auth)) throw new Error("SMTP authentication failed");
  } finally { smtp.destroy(); }
  return { imap: true, smtp: true };
}
