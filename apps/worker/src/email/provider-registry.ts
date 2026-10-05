import type { EmailProvider, EmailProviderType } from "@ai-comms-agent/shared";
import { MockEmailProvider } from "./mock-adapter";
import { GmailAdapter } from "./gmail-adapter";

export type EmailProviderFactory = () => EmailProvider;

export interface EmailProviderDescriptor {
  providerId: EmailProviderType;
  displayName: string;
  create: EmailProviderFactory;
}

/**
 * Worker-side provider registry. Concrete provider adapters register here;
 * the application never switches on provider names in business logic.
 */
export class EmailProviderRegistry {
  private readonly factories = new Map<EmailProviderType, EmailProviderDescriptor>();

  register(descriptor: EmailProviderDescriptor): void {
    if (this.factories.has(descriptor.providerId)) {
      throw new Error(`Email provider already registered: ${descriptor.providerId}`);
    }
    this.factories.set(descriptor.providerId, descriptor);
  }

  has(providerId: EmailProviderType): boolean {
    return this.factories.has(providerId);
  }

  create(providerId: EmailProviderType): EmailProvider {
    const descriptor = this.factories.get(providerId);
    if (!descriptor) throw new Error(`Email provider is not registered: ${providerId}`);
    return descriptor.create();
  }

  list(): EmailProviderDescriptor[] {
    return [...this.factories.values()];
  }
}

export function createDefaultEmailProviderRegistry(): EmailProviderRegistry {
  const registry = new EmailProviderRegistry();
  registry.register({
    providerId: "gmail",
    displayName: "Gmail",
    create: () => new GmailAdapter(),
  });
  registry.register({
    providerId: "imap_smtp",
    displayName: "Mock IMAP / SMTP",
    create: () => new MockEmailProvider(),
  });
  return registry;
}
