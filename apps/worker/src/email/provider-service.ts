import type {
  CapabilitySet,
  EmailCredentials,
  EmailProvider,
  EmailProviderType,
} from "@ai-comms-agent/shared";
import { EmailProviderRegistry, normalizeCapabilitySet } from "@ai-comms-agent/shared";

export interface ConnectedEmailProvider {
  provider: EmailProvider;
  capabilities: CapabilitySet;
}

export class EmailProviderService {
  constructor(private readonly registry: EmailProviderRegistry) {}

  async connect(
    providerType: EmailProviderType,
    credentials: EmailCredentials,
  ): Promise<ConnectedEmailProvider> {
    const provider = this.registry.create(providerType);
    await provider.connect(credentials);
    const capabilities = normalizeCapabilitySet(await provider.discoverCapabilities());
    return { provider, capabilities };
  }

  requireProvider(providerType: EmailProviderType): EmailProvider {
    return this.registry.create(providerType);
  }
}
