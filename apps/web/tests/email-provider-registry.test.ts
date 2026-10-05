import { describe, expect, it } from "vitest";
import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "../../apps/worker/src/email/gmail-adapter";
import { ImapSmtpAdapter } from "../../apps/worker/src/email/imap-smtp-adapter";
import { ZohoAdapter } from "../../apps/worker/src/email/zoho-adapter";
import { createEmailProviderRegistry } from "../../apps/worker/src/email/registry";

describe("EmailProviderRegistry", () => {
  it("prevents duplicate provider registrations", () => {
    const registry = new EmailProviderRegistry();
    registry.register("gmail", () => new GmailAdapter());
    expect(() => registry.register("gmail", () => new GmailAdapter())).toThrow(/already registered/);
  });

  it("creates all currently implemented email adapters", () => {
    const registry = createEmailProviderRegistry();
    expect(registry.list()).toEqual(["gmail", "imap_smtp", "zoho"]);
    expect(registry.create("gmail")).toBeInstanceOf(GmailAdapter);
    expect(registry.create("imap_smtp")).toBeInstanceOf(ImapSmtpAdapter);
    expect(registry.create("zoho")).toBeInstanceOf(ZohoAdapter);
  });
});
