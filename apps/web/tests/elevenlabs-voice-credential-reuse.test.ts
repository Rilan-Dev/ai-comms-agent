import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string): string => readFileSync(resolve(__dirname, path), "utf8");
const db = source("../../../packages/db/src/ai-provider/repository.ts");
const exportFile = source("../../../packages/db/src/index.ts");
const api = source("../src/app/api/settings/ai-provider-configs/reuse-voice-key/route.ts");
const setup = source("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx");
const catalog = source("../src/app/api/settings/ai-models/route.ts");

describe("ElevenLabs purpose-specific credentials", () => {
  it("explains missing TTS/STT as capability-specific and never downgrades authorization", () => {
    expect(catalog).toContain("getDecryptedProviderConfig(organizationId, provider, purpose");
    expect(catalog).toContain('error: "provider_configuration_required"');
    expect(catalog.indexOf("await authorize")).toBeLessThan(catalog.indexOf("await getDecryptedProviderConfig"));
    expect(api).toContain('permission: "organization.update"');
    expect(api.indexOf("await authorize(")).toBeLessThan(api.indexOf("await getDecryptedProviderConfig("));
  });

  it("only reuses an enabled source key within the same organization and provider", () => {
    const part = db.slice(db.indexOf("export async function reuseElevenLabsRealtimeKeyForVoiceChat("));
    expect(part).toContain("organization_id = $1");
    expect(part).toContain("provider = 'elevenlabs' AND purpose = 'realtime'");
    expect(part).toContain("enabled = TRUE AND encrypted_api_key IS NOT NULL");
    expect(part).toContain("target_purposes(purpose) AS (VALUES ('tts'), ('stt'))");
    expect(part).toContain("SELECT $1, 'elevenlabs'");
    expect(part).toContain("WHERE ai_provider_configs.encrypted_api_key IS NULL");
    expect(part).toContain("AND ai_provider_configs.enabled = TRUE");
    expect(part).toContain("RETURNING purpose");
    expect(part).not.toContain("DECRYPT(");
    expect(exportFile).toContain("reuseElevenLabsRealtimeKeyForVoiceChat");
  });

  it("never returns a plaintext secret or overwrites a TTS/STT model", () => {
    expect(api).toContain("source.hasApiKey");
    expect(api).toContain("if (!source.apiKey)");
    expect(api).toContain("reuseElevenLabsRealtimeKeyForVoiceChat(organizationId)");
    expect(api).toContain("recordAuditEvent");
    expect(api).toContain("source_configuration_required");
    expect(api).toContain("provider_credentials_unavailable");
    expect(api).toContain('action: "copy_missing_voice_credentials"');
    expect(api).toContain("getDecryptedProviderConfig");
    expect(api).toContain("Do not include plaintext in the HTTP response");
    expect(db).toContain("NULL, TRUE,");
    expect(api).toContain('"Cache-Control": "private, no-store"');
  });

  it("requires explicit UI action; source realtime is only loaded for voice-chat metadata", () => {
    expect(setup).toContain('const purposes = tab === "voice-chat" ? ["tts", "stt", "realtime"]');
    expect(setup).toContain('async function reuseSavedRealtimeKey()');
    expect(setup).toContain('confirm("Reuse the enabled ElevenLabs Realtime API key');
    expect(setup).toContain('"/api/settings/ai-provider-configs/reuse-voice-key"');
    expect(setup).toContain("Use saved Realtime key for missing TTS/STT");
    expect(setup).toContain("setCatalogVersion((version) => version + 1)");
    expect(setup).toContain("setLoadRetry((version) => version + 1)");
    expect((setup.match(/const purposes = tab === "voice-chat" \? \["tts", "stt"\] :/g) ?? []).length).toBe(2);
  });
});
