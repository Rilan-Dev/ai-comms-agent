/** Validate both voice capabilities before starting sequential provider saves.
 * No secret values are stored or returned by this helper.
 */
export type VoiceCredentialRow = {
  provider: string;
  purpose: string;
  hasApiKey: boolean;
  enabled: boolean;
};
export type VoiceCredentialPreflight = {
  provider: string;
  isVoiceChat: boolean;
  newKeySupplied: boolean;
  saved: readonly VoiceCredentialRow[];
};

export function missingVoiceCredentials(input: VoiceCredentialPreflight): Array<"tts" | "stt"> {
  if (!input.isVoiceChat || input.newKeySupplied) return [];
  return (["tts", "stt"] as const).filter((purpose) => !input.saved.some(
    (entry) => entry.provider === input.provider && entry.purpose === purpose && entry.hasApiKey,
  ));
}

export function voiceCredentialSaveError(input: VoiceCredentialPreflight): string | null {
  const missing = missingVoiceCredentials(input);
  if (!missing.length) return null;
  const names = missing.map((purpose) => purpose.toUpperCase()).join(" and ");
  return `Cannot save Voice Chat: ${names} ${missing.length === 1 ? "requires" : "require"} an API key. Enter the provider key to configure both capabilities, or explicitly reuse an enabled ElevenLabs Realtime key where available. No provider settings were changed.`;
}
