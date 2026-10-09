import assert from "node:assert/strict";
import test from "node:test";
import { ImapSmtpAdapter, readImapResponse } from "../src/email/imap-smtp-adapter";

test("IMAP/SMTP adapter advertises the implemented secure connection capabilities", () => {
  const provider = new ImapSmtpAdapter();
  const capabilities = provider.capabilities();

  assert.equal(capabilities.folders, true);
  assert.equal(capabilities.sync_full, true);
  assert.equal(capabilities.sync_idle, false);
  assert.equal(capabilities.search_server_side, false);
  assert.equal(capabilities.sync_incremental, true);
  assert.equal(capabilities.search_client_side, true);
  assert.equal(capabilities.drafts, false);
  assert.equal(capabilities.send, false);
  assert.equal(capabilities.labels, false);
  assert.equal(capabilities.archive, false);
  assert.equal(capabilities.threads, true);
});

test("IMAP/SMTP adapter rejects plaintext transport before opening sockets", async () => {
  const provider = new ImapSmtpAdapter();
  await assert.rejects(
    () => provider.connect({
      credential_type: "password",
      username: "user@example.test",
      password: "not-a-real-secret",
      host: "mail.example.test",
      tls: false,
    }),
    /requires TLS/,
  );
});

test("IMAP/SMTP adapter requires authentication credentials", async () => {
  const provider = new ImapSmtpAdapter();
  await assert.rejects(
    () => provider.connect({
      credential_type: "password",
      username: "user@example.test",
      host: "mail.example.test",
      tls: true,
    }),
    /password or app_password credentials/,
  );
});

test("IMAP/SMTP adapter fails closed when used before connection", async () => {
  const provider = new ImapSmtpAdapter();
  await assert.rejects(() => provider.listFolders(), /not connected/);
});


test("IMAP/SMTP adapter blocks private and local network targets to prevent server-side request abuse", async () => {
  const provider = new ImapSmtpAdapter();
  await assert.rejects(
    () => provider.connect({ credential_type: "password", username: "user", password: "secret", host: "127.0.0.1", tls: true }),
    /private or local address/,
  );
  await assert.rejects(
    () => provider.connect({ credential_type: "password", username: "user", password: "secret", host: "localhost", tls: true }),
    /public address/,
  );
});


test("IMAP RFC822 parser extracts identity, headers, recipients, body and draft folder semantics", () => {
  const provider = new ImapSmtpAdapter() as unknown as {
    parseRawMessage: (raw: string, folderId: string, uid: string, flags?: string) => {
      provider_message_id?: string; message_id_header: string; thread_id: string; from_address: string;
      to_addresses: string[]; subject: string; text_body: string; is_read: boolean; is_draft: boolean;
    };
  };
  const message = provider.parseRawMessage(
    "From: Alice Example <alice@example.test>\r\nTo: Bob <bob@example.test>\r\nSubject: =?UTF-8?B?SGVsbG8=?=\r\nMessage-ID: <m-1@example.test>\r\nDate: Thu, 08 Oct 2026 10:00:00 +0000\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from IMAP",
    "Drafts", "42", "* 1 FETCH (UID 42 FLAGS (\\\\Draft))",
  );
  assert.equal(message.provider_message_id, "Drafts:42");
  assert.equal(message.message_id_header, "<m-1@example.test>");
  assert.equal(message.thread_id, "<m-1@example.test>");
  assert.equal(message.from_address, "alice@example.test");
  assert.deepEqual(message.to_addresses, ["bob@example.test"]);
  assert.equal(message.subject, "Hello");
  assert.equal(message.text_body, "Hello from IMAP");
  assert.equal(message.is_draft, true);
});


function bufferedReader(response: string) {
  return {
    socket: {} as never,
    buffer: Buffer.from(response, "utf8"),
  };
}

test("IMAP response reader consumes a literal containing CRLF by octet count", async () => {
  const reader = bufferedReader("* 1 FETCH (BODY[] {12}\r\nhello\r\nworld)\r\nA0001 OK fetch complete\r\n");
  const response = await readImapResponse(reader);
  assert.match(response, /hello\r\nworld/);
  assert.match(response, /FETCH/);
  assert.equal(reader.buffer.toString("utf8"), "A0001 OK fetch complete\r\n");
});

test("IMAP response reader handles multiple literals in one FETCH response", async () => {
  const reader = bufferedReader("* 1 FETCH (BODY[HEADER] {4}\r\nFrom BODY[] {5}\r\nHello)\r\nA0001 OK fetch complete\r\n");
  const response = await readImapResponse(reader);
  assert.match(response, /From\s+BODY\[\] {5}/);
  assert.match(response, /Hello/);
  assert.equal(reader.buffer.toString("utf8"), "A0001 OK fetch complete\r\n");
});

test("IMAP response reader rejects oversized literals before consuming payload", async () => {
  const reader = bufferedReader("* 1 FETCH (BODY[] {52428801}\r\n");
  await assert.rejects(() => readImapResponse(reader), /50 MiB safety limit/);
});


test("IMAP response reader handles literal markers and payload split across socket chunks", async () => {
  const { PassThrough } = await import("node:stream");
  const socket = new PassThrough();
  const reader = { socket: socket as never, buffer: Buffer.alloc(0) };
  const responsePromise = readImapResponse(reader);
  const chunks = [
    "* 7 FETCH (BODY[] {",
    "12}\r\nhel",
    "lo\r\nworld)\r",
    "\nA0007 OK fetch complete\r\n",
  ];
  for (const chunk of chunks) {
    socket.write(chunk);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  const response = await responsePromise;
  assert.match(response, /hello\r\nworld/);
  assert.equal(reader.buffer.toString("utf8"), "A0007 OK fetch complete\r\n");
  socket.destroy();
});
