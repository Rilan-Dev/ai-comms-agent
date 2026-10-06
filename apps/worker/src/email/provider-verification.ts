import type { CapabilitySet, EmailCredentials, EmailProvider } from "@ai-comms-agent/shared";
import { normalizeCapabilitySet } from "@ai-comms-agent/shared";

export interface ProviderVerificationResult {
  capabilities: CapabilitySet;
}

/**
 * Verify a provider and run work that requires the live connection.
 * The adapter is disconnected exactly once after the callback, including on failure.
 */
export async function verifyEmailProviderConnection<T = void>(
  provider: EmailProvider,
  credentials: EmailCredentials,
  onConnected?: (context: { provider: EmailProvider; capabilities: CapabilitySet }) => Promise<T>,
): Promise<ProviderVerificationResult & (T extends void ? { value?: undefined } : { value: T })> {
  await provider.connect(credentials);
  try {
    const capabilities = normalizeCapabilitySet(await provider.discoverCapabilities());
    if (onConnected) {
      const value = await onConnected({ provider, capabilities });
      return { capabilities, value } as ProviderVerificationResult & (T extends void ? { value?: undefined } : { value: T });
    }
    return { capabilities } as ProviderVerificationResult & (T extends void ? { value?: undefined } : { value: T });
  } finally {
    await provider.disconnect();
  }
}
