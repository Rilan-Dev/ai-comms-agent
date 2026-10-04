import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";
import { MockEmailProvider } from "./mock-adapter";

export function createEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register("gmail", () => new GmailAdapter());
  registry.register("imap_smtp", () => new MockEmailProvider());
  registry.register("zoho", () => new MockEmailProvider());
  return registry;
}
