/**
 * Presentation-only recovery for missing ElevenLabs Voice Chat credentials.
 * Never makes a credential change: the user must explicitly confirm the
 * existing organization-scoped, permission-checked reuse operation.
 */
export type CatalogRecovery = "reuse-realtime" | "configure-capability" | "contact-admin" | null;

export function modelCatalogRecovery(input: {
  provider: string;
  purpose: string;
  error?: string;
  canReuseRealtimeKey?: boolean;
}): CatalogRecovery {
  if (input.provider !== "elevenlabs" || (input.purpose !== "tts" && input.purpose !== "stt")) return null;
  if (input.error === "provider_credentials_unavailable") return "contact-admin";
  if (input.error !== "provider_configuration_required") return null;
  return input.canReuseRealtimeKey === true ? "reuse-realtime" : "configure-capability";
}
