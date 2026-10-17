import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialRuntimeSettings, normalizeRuntimeSettings } from '../src/lib/ai/runtime-settings-state.ts';

test('normalizes persisted camelCase settings without resetting the organization knowledge base', () => {
  const got = normalizeRuntimeSettings({
    defaultProvider: 'gemini', knowledgeBaseId: 'tenant-kb-123',
    realtimeVoiceProvider: 'elevenlabs', realtimeVoiceModel: 'model-from-vendor',
    voiceId: 'custom-voice', temperature: 0.1, maxTokens: 4096,
    systemPrompt: 'Organization-specific policy.',
  });
  assert.deepEqual(got, {
    default_provider: 'gemini', knowledge_base_id: 'tenant-kb-123',
    realtime_voice_provider: 'elevenlabs', realtime_voice_model: 'model-from-vendor',
    voice_id: 'custom-voice', temperature: 0.1, max_tokens: 4096,
    system_prompt: 'Organization-specific policy.',
  });
  assert.equal(Object.hasOwn(got, 'knowledgeBaseId'), false);
});

test('preserves snake_case and numeric string values when returned by a compatible API', () => {
  const got = normalizeRuntimeSettings({
    default_provider: 'sarvam', knowledge_base_id: 'kb-snake',
    realtime_voice_provider: 'openai', realtime_voice_model: 'actual-model',
    voice_id: 'alloy', temperature: '0', max_tokens: '500', system_prompt: 'Persisted prompt',
  });
  assert.equal(got.knowledge_base_id, 'kb-snake');
  assert.equal(got.temperature, '0');
  assert.equal(got.max_tokens, '500');
  assert.equal(got.system_prompt, 'Persisted prompt');
});

test('uses safe form defaults only for genuinely absent fields', () => {
  assert.deepEqual(normalizeRuntimeSettings(undefined), initialRuntimeSettings);
  assert.deepEqual(normalizeRuntimeSettings([]), initialRuntimeSettings);
  assert.deepEqual(normalizeRuntimeSettings({ maxTokens: null, temperature: 'abc' }), initialRuntimeSettings);
});

test('explicit zero temperature and blank model are preserved', () => {
  const got = normalizeRuntimeSettings({ temperature: 0, realtimeVoiceModel: '' });
  assert.equal(got.temperature, 0);
  assert.equal(got.realtime_voice_model, '');
});
