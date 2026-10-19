import { describe, expect, it } from "vitest";
import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "../../../apps/worker/src/email/gmail-adapter";
import { ImapSmtpAdapter } from "../../../apps/worker/src/email/imap-smtp-adapter";
import { ZohoAdapter } from "../../../apps/worker/src/email/zoho-adapter";
import { createEmailProviderRegistry } from "../../../apps/worker/src/email/registry";
import { EMAIL_CAPABILITIES } from "@ai-comms-agent/shared";

describe("EmailProviderRegistry", () => {
  it("prevents duplicate provider registrations", () => {
    const registry = new EmailProviderRegistry();
    registry.register("gmail", () => new GmailAdapter());
    expect(() => registry.register("gmail", () => new GmailAdapter())).toThrow(/already registered/);
  });

  it("creates all currently implemented email adapters", () => {
    const registry = createEmailProviderRegistry();
    expect(registry.list()).toEqual(["gmail", "imap_smtp", "zoho", "microsoft_graph"]);
    expect(registry.create("gmail")).toBeInstanceOf(GmailAdapter);
    expect(registry.create("imap_smtp")).toBeInstanceOf(ImapSmtpAdapter);
    expect(registry.create("zoho")).toBeInstanceOf(ZohoAdapter);
  });
  it("exposes a complete capability map for every registered adapter", async () => {
    const registry = createEmailProviderRegistry();
    for (const providerId of registry.list()) {
      const provider = registry.create(providerId);
      const discovered = await provider.discoverCapabilities();
      const declared = provider.capabilities();
      expect(Object.keys(declared).sort()).toEqual([...EMAIL_CAPABILITIES].sort());
      expect(discovered).toEqual(declared);
    }
  });

  it("does not advertise unsupported IMAP/SMTP or Zoho operations", () => {
    const registry = createEmailProviderRegistry();
    const imap = registry.create("imap_smtp").capabilities();
    const zoho = registry.create("zoho").capabilities();

    // IMAP/SMTP now supports send, drafts, reply, forward (via SMTP)
    expect(imap.send).toBe(true);
    expect(imap.drafts).toBe(true);
    expect(imap.reply).toBe(true);
    expect(imap.forward).toBe(true);
    expect(imap.attachments_download).toBe(false);

    // Zoho does not support send, forward, or attachment download
    expect(zoho.send).toBe(false);
    expect(zoho.forward).toBe(false);
    expect(zoho.attachments_download).toBe(false);
  });

});
