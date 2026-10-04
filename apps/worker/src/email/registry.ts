import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { MockEmailProvider } from "./mock-adapter";

export function createEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register("imap_smtp", () => new MockEmailProvider());
  return registry;
}
