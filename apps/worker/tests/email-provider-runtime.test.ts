import { strict as assert } from "node:assert";
import { test } from "node:test";
import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { MockEmailProvider } from "../src/email/mock-adapter";
import { EmailProviderRuntime } from "../src/email/provider-runtime";

test("mock provider advertises a complete capability set", async () => {
  const registry = new EmailProviderRegistry();
  registry.register("imap_smtp", () => new MockEmailProvider());

  const runtime = new EmailProviderRuntime(registry);
  const session = await runtime.connect("imap_smtp", { credential_type: "password", password: "test" });

  assert.equal(session.provider.providerId, "imap_smtp");
  assert.equal(session.capabilities.send, true);
  assert.equal(session.capabilities.drafts, true);
});

test("runtime blocks unsupported capabilities before provider execution", async () => {
  class LimitedProvider extends MockEmailProvider {
    override capabilities() {
      return { ...super.capabilities(), send: false };
    }
    override async discoverCapabilities() {
      return this.capabilities();
    }
  }

  const registry = new EmailProviderRegistry();
  registry.register("imap_smtp", () => new LimitedProvider());

  const runtime = new EmailProviderRuntime(registry);
  const session = await runtime.connect("imap_smtp", { credential_type: "password", password: "test" });

  await assert.rejects(
    () => runtime.send(session, "draft-1"),
    /does not support capability send/,
  );
});
