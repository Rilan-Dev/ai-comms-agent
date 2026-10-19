import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missingVoiceCredentials, voiceCredentialSaveError } from "../src/lib/ai/voice-credential-preflight.ts";

const setup = readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/app/api/settings/ai-provider-configs/route.ts", import.meta.url), "utf8");

const tts = { provider: "elevenlabs", purpose: "tts", enabled: true, hasApiKey: true };
const stt = { provider: "elevenlabs", purpose: "stt", enabled: true, hasApiKey: true };
const input = (saved, newKeySupplied = false) => ({
  provider: "elevenlabs", isVoiceChat: true, saved, newKeySupplied,
});

test("missing both voice capabilities prevents a predictable partial save", () => {
  assert.deepEqual(missingVoiceCredentials(input([])), ["tts", "stt"]);
  assert.match(voiceCredentialSaveError(input([])), /TTS and STT require an API key/);
});

test("missing only STT is detected before the first TTS write", () => {
  assert.deepEqual(missingVoiceCredentials(input([tts])), ["stt"]);
  assert.match(voiceCredentialSaveError(input([tts])), /STT requires an API key/);
});

test("missing only TTS is detected before STT write", () => {
  assert.deepEqual(missingVoiceCredentials(input([stt])), ["tts"]);
  assert.match(voiceCredentialSaveError(input([stt])), /TTS requires an API key/);
});

test("both existing purpose keys can be preserved during model-only save", () => {
  assert.deepEqual(missingVoiceCredentials(input([tts, stt])), []);
  assert.equal(voiceCredentialSaveError(input([tts, stt])), null);
});

test("an explicitly supplied key supports initial TTS+STT configuration", () => {
  assert.equal(voiceCredentialSaveError(input([], true)), null);
});

test("never mistake another organization's or provider's model metadata for a usable secret", () => {
  assert.deepEqual(missingVoiceCredentials(input([
    { provider: "sarvam", purpose: "tts", enabled: true, hasApiKey: true },
    { provider: "elevenlabs", purpose: "realtime", enabled: true, hasApiKey: true },
  ])), ["tts", "stt"]);
});

test("existing disabled keys are present; enabling requires explicit form selection", () => {
  assert.equal(voiceCredentialSaveError(input([{ ...tts, enabled: false }, stt])), null);
});

test("the preflight is scoped to Voice Chat, not ordinary Chat settings", () => {
  assert.equal(voiceCredentialSaveError({ ...input([]), isVoiceChat: false }), null);
});

test("UI preflights before any request and preserves realtime metadata after reload", () => {
  const start = setup.indexOf("async function saveProvider()");
  const put = setup.indexOf('fetch("/api/settings/ai-provider-configs",', start);
  const guard = setup.indexOf("voiceCredentialSaveError({", start);
  assert.ok(start >= 0 && guard > start && guard < put);
  assert.match(setup, /if \(missingKeyError\) \{/);
  assert.equal((setup.match(/\(tab === "voice-chat" \? \[\.\.\.purposes, "realtime"\] : purposes\)/g) ?? []).length, 2);
  assert.ok(setup.includes("apiKey: apiKey.trim() || undefined"));
  assert.ok(setup.includes("keepExistingKey: !apiKey.trim()"));
});

test("API refuses keepExistingKey when the capability has no encrypted secret", () => {
  const authorizeIndex = api.indexOf("await authorize(request", api.indexOf("export async function PUT("));
  const lookupIndex = api.indexOf("await getProviderConfig(organizationId, provider, purpose);");
  const insertIndex = api.indexOf("await upsertProviderConfig({");
  assert.ok(authorizeIndex >= 0 && lookupIndex > authorizeIndex && insertIndex > lookupIndex);
  assert.ok(api.includes("if (!existing?.hasApiKey)"));
  assert.ok(api.includes('error: "provider_configuration_required"'));
});
