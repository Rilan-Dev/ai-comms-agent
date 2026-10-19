import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modelCatalogRecovery } from "../src/lib/ai/model-catalog-recovery.ts";

const picker = readFileSync(new URL("../src/components/live-model-select.tsx", import.meta.url), "utf8");
const setup = readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/app/api/settings/ai-models/route.ts", import.meta.url), "utf8");
const reuse = readFileSync(new URL("../src/app/api/settings/ai-provider-configs/reuse-voice-key/route.ts", import.meta.url), "utf8");

test("missing ElevenLabs TTS key with enabled Realtime offers explicit recovery", () => {
  assert.equal(modelCatalogRecovery({
    provider: "elevenlabs", purpose: "tts",
    error: "provider_configuration_required", canReuseRealtimeKey: true,
  }), "reuse-realtime");
});

test("missing ElevenLabs STT key with enabled Realtime offers explicit recovery", () => {
  assert.equal(modelCatalogRecovery({
    provider: "elevenlabs", purpose: "stt",
    error: "provider_configuration_required", canReuseRealtimeKey: true,
  }), "reuse-realtime");
});

test("missing purpose key without eligible Realtime key requires explicit configuration", () => {
  assert.equal(modelCatalogRecovery({
    provider: "elevenlabs", purpose: "tts",
    error: "provider_configuration_required", canReuseRealtimeKey: false,
  }), "configure-capability");
});

test("decryption failure is distinguished from missing configuration", () => {
  assert.equal(modelCatalogRecovery({
    provider: "elevenlabs", purpose: "stt",
    error: "provider_credentials_unavailable", canReuseRealtimeKey: true,
  }), "contact-admin");
});

test("other providers, unrelated capabilities and failed vendor catalogs offer no credential-copy action", () => {
  for (const input of [
    { provider: "sarvam", purpose: "tts", error: "provider_configuration_required", canReuseRealtimeKey: true },
    { provider: "elevenlabs", purpose: "realtime", error: "provider_configuration_required", canReuseRealtimeKey: true },
    { provider: "elevenlabs", purpose: "tts", error: "model_catalog_unavailable", canReuseRealtimeKey: true },
    { provider: "elevenlabs", purpose: "stt", error: "catalog_unsupported", canReuseRealtimeKey: true },
  ]) assert.equal(modelCatalogRecovery(input), null);
});

test("picker only shows the recovery action for an authorized, recoverable model lookup", () => {
  assert.match(picker, /modelCatalogRecovery\(\{ provider, purpose, error: body\.error, canReuseRealtimeKey: body\.canReuseRealtimeKey \}\)/);
  assert.match(picker, /if \(controller\.signal\.aborted\) return;/);
  assert.match(picker, /onClick=\{onReuseSavedRealtimeKey\}/);
  assert.match(picker, /disabled=\{reuseCredentialBusy \|\| !onReuseSavedRealtimeKey\}/);
});

test("both TTS and STT model pickers reuse only an enabled, saved Realtime source", () => {
  assert.equal((setup.match(/onReuseSavedRealtimeKey=\{canReuseRealtimeKey \? \(\) => void reuseSavedRealtimeKey\(\) : undefined\}/g) ?? []).length, 2);
  assert.match(setup, /realtimeVoiceConfig\?\.enabled === true && realtimeVoiceConfig\.hasApiKey && missingVoiceKey/);
  assert.match(setup, /confirm\("Reuse the enabled ElevenLabs Realtime API key/);
});

test("recovery keeps the server-side organization permission and no-secret response", () => {
  assert.ok(catalog.indexOf("await authorize(request") < catalog.indexOf("await getDecryptedProviderConfig("));
  assert.match(catalog, /canReuseRealtimeKey: true/);
  assert.match(reuse, /permission: "organization\.update"/);
  assert.match(reuse, /reuseElevenLabsRealtimeKeyForVoiceChat\(organizationId\)/);
  assert.doesNotMatch(reuse, /return NextResponse\.json\(\{[^}]*apiKey/s);
});
