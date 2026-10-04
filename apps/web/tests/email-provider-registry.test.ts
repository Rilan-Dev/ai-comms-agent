import { describe, expect, it } from "vitest";
import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "../../apps/worker/src/email/gmail-adapter";
import { createEmailProviderRegistry } from "../../apps/worker/src/email/registry";

describe("EmailProviderRegistry", () => {
  it("prevents duplicate provider registrations", () => {
    const registry = new EmailProviderRegistry();
    registry.register("gmail", () => new GmailAdapter());
    expect(() => registry.register("gmail", () => new GmailAdapter())).toThrow(/already registered/);
  });

  it("creates the implemented Gmail adapter only", () => {
    const registry = createEmailProviderRegistry();
    expect(registry.list()).toEqual(["gmail"]);
    expect(registry.create("gmail")).toBeInstanceOf(GmailAdapter);
    expect(() => registry.create("zoho")).toThrow(/No email adapter/);
  });
});
