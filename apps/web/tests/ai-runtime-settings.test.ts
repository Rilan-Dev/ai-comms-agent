import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeRuntimeSettings } from "../src/lib/ai/runtime-settings-state";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Organization AI runtime form state", () => {
  it("hydrates ALL persisted camelCase fields before a snake_case PUT without overwriting KB or prompt", () => {
    const state = normalizeRuntimeSettings({
      defaultProvider: "gemini",
      knowledgeBaseId: "org-kb-private",
      realtimeVoiceProvider: "openai",
      realtimeVoiceModel: "live-model-id",
      voiceId: "sage",
      temperature: 0,
      maxTokens: 3072,
      systemPrompt: "Organization policy survives reload",
    });
    expect(state).toEqual({
      default_provider: "gemini",
      knowledge_base_id: "org-kb-private",
      realtime_voice_provider: "openai",
      realtime_voice_model: "live-model-id",
      voice_id: "sage",
      temperature: 0,
      max_tokens: 3072,
      system_prompt: "Organization policy survives reload",
    });
    expect(read("../src/app/settings/ai-runtime-settings.tsx")).toContain("setSettings(normalizeRuntimeSettings(value))");
  });
});

describe("Organization AI configuration", () => {
  it("persists tenant-scoped Clara runtime settings with validated values", () => {
    const migration = read("../../../supabase/migrations/0028_organization_ai_runtime_settings.sql");
    const route = read("../src/app/api/settings/ai-runtime/route.ts");
    expect(migration).toContain("organization_ai_runtime_settings");
    expect(migration).toContain("knowledge_base_id");
    expect(migration).toContain("can_manage_organization(organization_id)");
    expect(route).toContain('permission: "organization.update"');
    expect(route).toContain("temperature < 0 || temperature > 2");
    expect(route).toContain("maxTokens > 32768");
  });

  it("exposes configuration screens for runtime, provider credentials, model selection and voice", () => {
    const page = read("../src/app/settings/page.tsx");
    const runtime = read("../src/app/settings/ai-runtime-settings.tsx");
    const providers = read("../src/app/settings/ai-provider-settings.tsx");
    expect(page).toContain("AIRuntimeSettings");
    expect(page).toContain("AIProviderSettings");
    expect(runtime).toContain("Clara knowledge-base ID");
    expect(runtime).toContain("Realtime voice provider");
    expect(providers).toContain('type="password"');
    expect(providers).toContain("LiveModelSelect");
    expect(runtime).toContain("LiveModelSelect");
  });

  it("stores provider credentials encrypted and never returns plaintext credentials", () => {
    const route = read("../src/app/api/settings/ai-providers/route.ts");
    expect(route).toContain("encryptCredential");
    expect(route).toContain("encrypted_api_key");
    expect(route).toContain("hasApiKey");
    expect(route).not.toContain("return NextResponse.json({ apiKey");
    expect(route).toContain("CREDENTIALS_MASTER_KEY");
  });

  it("resolves per-organization provider/model and voice preferences in the Clara runtime", () => {
    const runtime = read("../../../packages/clara-core/src/runtime.ts");
    expect(runtime).toContain("organizationAIConfig");
    expect(runtime).toContain("organization_ai_runtime_settings");
    expect(runtime).toContain("decryptCredential");
    expect(runtime).toContain("providerSettings");
    expect(runtime).toContain("system_prompt");
  });

  it("uses organization knowledge-base configuration for chat, voice and worker execution", () => {
    const chat = read("../src/app/api/chat/stream/route.ts");
    const voiceTurn = read("../src/app/api/voice/turn/route.ts");
    const voiceSession = read("../src/app/api/voice/session/route.ts");
    const worker = read("../../../apps/worker/src/agent/execution-dispatcher.ts");
    for (const source of [chat, voiceTurn, voiceSession, worker]) {
      expect(source).toContain("organization_ai_runtime_settings");
      expect(source).toContain("knowledge_base_id");
    }
  });

  it("fetches provider model catalogs server-side without returning credentials to clients", () => {
    const route = read("../src/app/api/settings/ai-providers/route.ts");
    expect(route).toContain("decryptCredential");
    expect(route).toContain("fetchLiveModelCatalog");
    expect(read("../src/lib/ai/live-model-catalog.ts")).toContain("/v1/models");
    expect(read("../src/lib/ai/live-model-catalog.ts")).toContain("/v1beta/models");
    expect(route).toContain("model_catalog_unavailable");
    expect(route).toContain("officialBaseUrl");
    expect(route).toContain("Only the official HTTPS API origin");
  });
});
