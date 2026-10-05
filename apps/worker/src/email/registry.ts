import { EmailProviderRegistry } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";
import { MockEmailProvider } from "./mock-adapter";
import { ImapSmtpAdapter } from "./imap-smtp-adapter";
import { ZohoAdapter } from "./zoho-adapter";

/**
 * Server-side provider registry. Provider implementations are constructed per
 * connection so credentials never live in the registry singleton.\n * The mock adapter remains available only to tests; production resolution uses the real adapter.
 */
export function createEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register("gmail", () => new GmailAdapter());
  registry.register("imap_smtp", () => new ImapSmtpAdapter());
  registry.register("zoho", () => new ZohoAdapter());
  return registry;
}
