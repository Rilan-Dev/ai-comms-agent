import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";

export function createEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register("gmail", () => new GmailAdapter());
  return registry;
}
