/**
 * Resolve the voice provider from the SAME settings record that the agent's
 * AI Settings screen saves. A nullable new override means "inherit", not
 * "fall back to the retired agents.voice_provider field".
 *
 * The legacy agent column is consulted only for agents without any row in
 * agent_ai_settings, preserving older configurations during migration.
 */
export function resolveAgentRealtimeVoiceProvider(input: {
  agentSettings: { realtimeVoiceProviderOverride: string | null } | null;
  legacyAgentVoiceProvider: string | null | undefined;
  organizationRealtimeVoiceProvider: string | null | undefined;
  environmentRealtimeVoiceProvider: string | null | undefined;
}): string {
  const provider = input.agentSettings?.realtimeVoiceProviderOverride?.trim()
    || (input.agentSettings === null ? input.legacyAgentVoiceProvider?.trim() : "")
    || input.organizationRealtimeVoiceProvider?.trim()
    || input.environmentRealtimeVoiceProvider?.trim()
    || "openai";
  return provider.toLowerCase();
}
