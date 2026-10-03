import type { EmailProvider, EmailProviderType } from "./provider";

export type EmailProviderFactory = () => EmailProvider;

export class EmailProviderRegistry {
  private readonly factories = new Map<EmailProviderType, EmailProviderFactory>();

  register(provider: EmailProviderType, factory: EmailProviderFactory): void {
    if (this.factories.has(provider)) {
      throw new Error(`Email provider already registered: ${provider}`);
    }
    this.factories.set(provider, factory);
  }

  has(provider: EmailProviderType): boolean {
    return this.factories.has(provider);
  }

  create(provider: EmailProviderType): EmailProvider {
    const factory = this.factories.get(provider);
    if (!factory) {
      throw new Error(`No email adapter registered for provider: ${provider}`);
    }
    return factory();
  }

  list(): EmailProviderType[] {
    return [...this.factories.keys()];
  }
}
