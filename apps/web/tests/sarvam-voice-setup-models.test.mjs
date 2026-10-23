import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = readFileSync(new URL("../src/lib/ai/live-model-catalog.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/settings/ai-models/route.ts", import.meta.url), "utf8");
const save = readFileSync(new URL("../src/app/api/settings/ai-provider-configs/route.ts", import.meta.url), "utf8");
const picker = readFileSync(new URL("../src/components/live-model-select.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url), "utf8");

test("vendor-documented Sarvam voice models are reachable only after org auth and a saved enabled purpose-specific key", () => {
  const auth = route.indexOf("await authorize(request");
  const key = route.indexOf("const saved = await getDecryptedProviderConfig");
  const credentialGuard = route.indexOf("if (!saved?.enabled || !saved.apiKey)");
  const documentedVoice = route.indexOf("hasDocumentedSarvamVoiceModels(provider, purpose)) {");
  assert.ok(auth >= 0 && key > auth && credentialGuard > key && documentedVoice > credentialGuard);
  assert.match(route, /documentedSarvamVoiceModels\(provider, purpose\)/);
  assert.match(route, /source: "documented"/);
  assert.match(route, /capability: purpose/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(route, /process\.env\.SARVAM_API_KEY/);
});

test("TTS and STT options are not mistaken for live models or another provider capability", () => {
  assert.match(catalog, /export function hasDocumentedSarvamVoiceModels\(/);
  assert.match(catalog, /export function documentedSarvamVoiceModels\(/);
  assert.match(picker, /provider === "sarvam" && \["tts", "stt"\]\.includes\(purpose\)/);
  assert.match(picker, /body\.capability !== purpose/);
  assert.match(picker, /catalogSource === "documented"/);
  assert.match(page, /vendor-documented.*TTS.*STT/);
});

test("save rejects incorrect Sarvam voice model IDs, but does not alter other providers", () => {
  assert.match(save, /hasDocumentedSarvamVoiceModels\(provider, purpose\)/);
  assert.match(save, /documentedSarvamVoiceModels\(provider, purpose\)\.some/);
  assert.match(save, /unsupported_voice_model/);
  assert.match(save, /await authorize\(request/);
});
