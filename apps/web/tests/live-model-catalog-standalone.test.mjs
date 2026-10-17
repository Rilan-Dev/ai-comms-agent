/**
 * Dependency-free smoke tests for Clara-style vendor-live model discovery.
 * Run from the repo root with:
 *   node --experimental-strip-types --test apps/web/tests/live-model-catalog-standalone.test.mjs
 * Node 22.16+ is required for built-in TypeScript stripping.
 * These mocked vendor tests do NOT establish production API connectivity.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { documentedRealtimeModels, fetchLiveModelCatalog, hasDocumentedRealtimeModels, supportsLiveCatalog } from '../src/lib/ai/live-model-catalog.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function vendor(responseFor) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const response = responseFor(String(url));
    return { ok: true, status: 200, json: async () => response };
  };
  return calls;
}

test('provider capability matrix is fail closed', async () => {
  assert.equal(supportsLiveCatalog('sarvam', 'tts'), false);
  assert.equal(supportsLiveCatalog('tei', 'embedding'), false);
  assert.equal(supportsLiveCatalog('elevenlabs', 'stt'), true);
  await assert.rejects(fetchLiveModelCatalog('sarvam', 'tts', 'test-key'), /does not publish/);
});

test('OpenAI live models are filtered by purpose and de-duplicated', async () => {
  const calls = vendor(() => ({ data: [
    { id: 'gpt-next-2026' }, { id: 'gpt-next-2026' },
    { id: 'gpt-realtime' }, { id: 'text-embedding-3-small' },
    { id: 'whisper-1' }, { id: 'tts-1' }, { id: 'gpt-4o-audio-preview' },
  ] }));
  const purposes = {
    chat: ['gpt-next-2026'], realtime: ['gpt-realtime'],
    embedding: ['text-embedding-3-small'], stt: ['whisper-1'], tts: ['tts-1'],
  };
  for (const [purpose, expected] of Object.entries(purposes)) {
    assert.deepEqual((await fetchLiveModelCatalog('openai', purpose, 'test-key')).map((m) => m.id), expected);
  }
  assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-key');
  assert.equal(calls[0].options.cache, 'no-store');
});

test('Gemini follows live pages and supportedGenerationMethods', async () => {
  const calls = vendor((url) => url.includes('pageToken=page2')
    ? { models: [{ name: 'models/gemini-live', supportedGenerationMethods: ['bidiGenerateContent'] }] }
    : { models: [
      { name: 'models/gemini-chat', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
    ], nextPageToken: 'page2' });
  assert.deepEqual((await fetchLiveModelCatalog('gemini', 'chat', 'test-key')).map((m) => m.id), ['gemini-chat']);
  assert.deepEqual((await fetchLiveModelCatalog('gemini', 'embedding', 'test-key')).map((m) => m.id), ['gemini-embedding']);
  assert.deepEqual((await fetchLiveModelCatalog('gemini', 'realtime', 'test-key')).map((m) => m.id), ['gemini-live']);
  assert.ok(calls.some(({ url }) => url.includes('pageToken=page2')));
});

test('Sarvam live IDs intersect with supported v1 chat runtime', async () => {
  vendor(() => ({ data: [{ id: 'sarvam-105b-conversations' }, { id: 'sarvam-105b' }, { id: 'gemma4' }] }));
  assert.deepEqual((await fetchLiveModelCatalog('sarvam', 'chat', 'test-key')).map((m) => m.id),
    ['sarvam-105b', 'sarvam-105b-conversations']);
});

test('ElevenLabs TTS and Scribe STT lists remain distinct', async () => {
  vendor(() => [
    { model_id: 'eleven_flash_v2_5', can_do_text_to_speech: true },
    { model_id: 'scribe_v2', can_do_text_to_speech: false },
  ]);
  assert.deepEqual((await fetchLiveModelCatalog('elevenlabs', 'tts', 'test-key')).map((m) => m.id), ['eleven_flash_v2_5']);
  assert.deepEqual((await fetchLiveModelCatalog('elevenlabs', 'stt', 'test-key')).map((m) => m.id), ['scribe_v2']);
});

test('vendor HTTP errors reject without static-model fallback', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchLiveModelCatalog('openai', 'chat', 'test-key'), /HTTP 503/);
});

test('Sarvam realtime STT documents only model IDs accepted by our websocket relay', () => {
  assert.equal(hasDocumentedRealtimeModels('sarvam', 'realtime'), true);
  assert.deepEqual(documentedRealtimeModels('sarvam', 'realtime').map((m) => m.id), ['saaras:v3-realtime', 'saaras:v4']);
  assert.equal(supportsLiveCatalog('sarvam', 'realtime'), false);
});

test('ElevenLabs realtime STT is a Scribe model, not the unrelated Conversational AI agent', () => {
  assert.equal(hasDocumentedRealtimeModels('elevenlabs', 'realtime'), true);
  assert.deepEqual(documentedRealtimeModels('elevenlabs', 'realtime').map((m) => m.id), ['scribe_v2_realtime']);
  assert.equal(documentedRealtimeModels('elevenlabs', 'realtime').some((m) => m.id === 'elevenlabs-conversational'), false);
  assert.equal(supportsLiveCatalog('elevenlabs', 'realtime'), false);
});

test('documented choices are never falsely advertised for live or unrelated capabilities', () => {
  assert.deepEqual(documentedRealtimeModels('openai', 'realtime'), []);
  assert.deepEqual(documentedRealtimeModels('sarvam', 'chat'), []);
  assert.deepEqual(documentedRealtimeModels('elevenlabs', 'tts'), []);
  assert.equal(hasDocumentedRealtimeModels('tei', 'embedding'), false);
});
