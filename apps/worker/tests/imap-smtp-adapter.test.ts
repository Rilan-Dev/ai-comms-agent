import assert from "node:assert/strict";
import test from "node:test";
import { ImapSmtpAdapter } from "../src/email/imap-smtp-adapter";

test("IMAP/SMTP adapter advertises the implemented secure connection capabilities", () => {
  const provider = new ImapSmtpAdapter();
  const capabilities = provider.capabilities();

  assert.equal(capabilities.folders, true);
  assert.equal(capabilities.sync_full, true);
  assert.equal(capabilities.sync_idle, true);
  assert.equal(capabilities.search_server_side, true);
  assert.equal(capabilities.drafts, true);
  assert.equal(capabilities.send, true);
  assert.equal(capabilities.labels, false);
  assert.equal(capabilities.archive, false);
  assert.equal(capabilities.threads, false);
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
