import assert from "node:assert/strict";
import test from "node:test";
import { createEmailProviderRegistry } from "../src/email/registry";
import { MockEmailProvider } from "../src/email/mock-adapter";
import type { EmailProviderCapability } from "@ai-comms-agent/shared";

const REQUIRED_CAPABILITIES: EmailProviderCapability[] = [
  "folders", "labels", "sync_incremental", "sync_full", "sync_webhook", "sync_idle",
  "search_server_side", "search_client_side", "drafts", "reply", "forward", "mark_read",
  "archive", "move", "threads", "attachments_download", "attachments_upload", "send",
];

test("mock email provider exposes the complete capability contract", async () => {
  const provider = new MockEmailProvider();
  const discovered = await provider.discoverCapabilities();
  for (const capability of REQUIRED_CAPABILITIES) {
    assert.equal(typeof discovered[capability], "boolean", `missing capability: ${capability}`);
  }
  assert.deepEqual(discovered, provider.capabilities());
});

test("mock provider enforces connection lifecycle", async () => {
  const provider = new MockEmailProvider();
  await assert.rejects(() => provider.listFolders(), /not connected/);
  await provider.connect({ credential_type: "app_password", host: "mock", port: 993 });
  assert.equal((await provider.listFolders())[0]?.role, "inbox");
  await provider.disconnect();
  await assert.rejects(() => provider.search({ text: "hello" }), /not connected/);
});

test("registry creates registered providers and rejects duplicates", () => {
  const registry = createEmailProviderRegistry();
  assert.deepEqual(registry.list(), ["gmail", "imap_smtp", "zoho"]);
  assert.ok(registry.create("imap_smtp"));
  assert.throws(() => registry.register("imap_smtp", () => new MockEmailProvider()), /already registered/);
});
