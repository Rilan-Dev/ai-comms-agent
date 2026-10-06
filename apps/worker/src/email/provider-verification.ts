import type { CapabilitySet, EmailCredentials, EmailProvider } from "@ai-comms-agent/shared";
import { normalizeCapabilitySet } from "@ai-comms-agent/shared";

export interface ProviderVerificationResult {
  capabilities: CapabilitySet;
}

/**
 * Verify one provider connection and discover the runtime capability surface.
 * The provider instance is always disconnected, including on failure.
 * Credentials remain owned by the caller and are never returned.
 */
export async function verifyEmailProviderConnection(
  provider: EmailProvider,
  credentials: EmailCredentials,
): Promise<ProviderVerificationResult> {
  let connected = false;
  try {
    await provider.connect(credentials);
    connected = true;
    const capabilities = normalizeCapabilitySet(await provider.discoverCapabilities());
    return { capabilities };
  } finally {
    if (connected) await provider.disconnect();
  }
}
