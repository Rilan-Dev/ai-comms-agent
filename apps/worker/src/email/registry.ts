import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";
import { MockEmailProvider } from "./mock-adapter";

/**
 * Server-side provider registry. Provider implementations are constructed per
 * connection so access tokens never live in the registry singleton.
 */
export function createEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register("gmail", () => new GmailAdapter());
  registry.register("imap_smtp", () => new MockEmailProvider());
  return registry;
}
