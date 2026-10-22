/**
 * Resolve model/voice only from the selected provider's configuration.
 * A foreign organization/provider default must not leak to a Sarvam, Gemini,
 * ElevenLabs, or different legacy agent transport.
 * This helper has no database, network, or credential side effects.
 */
export type ProviderVoiceInput = {
  provider: string;
  hasModernAgentSettings?: boolean;
  agentSttModel?: string | null;
  agentVoiceId?: string | null;
  legacyAgentProvider?: string | null;
  legacyAgentModel?: string | null;
  legacyAgentVoiceId?: string | null;
  organizationProvider?: string | null;
  organizationModel?: string | null;
  organizationVoiceId?: string | null;
  providerModel?: string | null;
  openAiDefaultModel?: string | null;
  openAiDefaultVoice?: string | null;
  sarvamDefaultVoice?: string | null;
  elevenLabsDefaultVoice?: string | null;
  geminiDefaultVoice?: string | null;
};

const SARVAM_SPEAKERS = new Set([
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan",
  "simran", "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun",
  "manan", "sumit", "roopa", "kabir", "aayan", "ashutosh", "advait",
  "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti",
  "suhani", "mohit", "kavitha", "rehan", "soham", "rupali",
]);
const clean = (value: string | null | undefined): string => value?.trim() ?? "";
const normalized = (value: string | null | undefined): string => clean(value).toLowerCase();

export function resolveProviderVoiceConfig(input: ProviderVoiceInput): { model: string; voiceId: string } {
  const provider = normalized(input.provider);
  const sameOrganizationProvider = normalized(input.organizationProvider) === provider;
  const sameLegacyProvider = !input.hasModernAgentSettings && normalized(input.legacyAgentProvider) === provider;

  const model = clean(input.agentSttModel)
    || (sameLegacyProvider ? clean(input.legacyAgentModel) : "")
    || (sameOrganizationProvider ? clean(input.organizationModel) : "")
    || clean(input.providerModel)
    || (provider === "sarvam" ? "saaras:v3-realtime"
      : provider === "elevenlabs" ? "scribe_v2_realtime"
      : provider === "gemini" ? "gemini-3.5-transcribe-live"
      : clean(input.openAiDefaultModel) || "gpt-realtime-2.1-mini");

  const configuredVoice = clean(input.agentVoiceId)
    || (sameLegacyProvider ? clean(input.legacyAgentVoiceId) : "")
    || (sameOrganizationProvider ? clean(input.organizationVoiceId) : "");
  // Do not interpret an OpenAI speaker as a provider-specific voice.
  const permittedVoice = provider === "sarvam" ? (SARVAM_SPEAKERS.has(configuredVoice) ? configuredVoice : "")
    : provider === "openai" ? configuredVoice
    : configuredVoice === "alloy" ? "" : configuredVoice;
  const fallbackVoice = provider === "sarvam"
    ? (SARVAM_SPEAKERS.has(clean(input.sarvamDefaultVoice)) ? clean(input.sarvamDefaultVoice) : "shubh")
    : provider === "elevenlabs" ? clean(input.elevenLabsDefaultVoice)
    : provider === "gemini" ? clean(input.geminiDefaultVoice)
    : clean(input.openAiDefaultVoice) || "alloy";

  return { model, voiceId: permittedVoice || fallbackVoice };
}
