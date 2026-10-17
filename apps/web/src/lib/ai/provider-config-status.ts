/** Status of an organization's saved provider keys for every required capability. */
export type ProviderConfigStatus = "active" | "incomplete" | "saved (disabled)" | "not configured";

type CredentialState = {
  provider: string;
  purpose: string;
  enabled: boolean;
  hasApiKey: boolean;
};

/**
 * Voice-chat setup saves TTS and STT separately; it must not appear fully
 * configured when only one capability has a usable key.
 */
export function providerConfigStatus(
  configs: readonly CredentialState[],
  provider: string,
  purposes: readonly string[],
): ProviderConfigStatus {
  if (purposes.length === 0) return "not configured";
  const saved = purposes.map((purpose) =>
    configs.find((config) => config.provider === provider && config.purpose === purpose),
  );
  const keyCount = saved.filter((config) => config?.hasApiKey).length;
  if (keyCount === 0) return "not configured";
  if (keyCount !== purposes.length) return "incomplete";
  return saved.every((config) => config?.enabled) ? "active" : "saved (disabled)";
}
