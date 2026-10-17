import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerConfigStatus } from '../src/lib/ai/provider-config-status.ts';

const credential = (provider, purpose, enabled = true, hasApiKey = true) =>
  ({ provider, purpose, enabled, hasApiKey });

test('chat is active only with the same provider and purpose configured', () => {
  assert.equal(providerConfigStatus([credential('openai', 'chat')], 'openai', ['chat']), 'active');
  assert.equal(providerConfigStatus([credential('openai', 'tts')], 'openai', ['chat']), 'not configured');
  assert.equal(providerConfigStatus([credential('gemini', 'chat')], 'openai', ['chat']), 'not configured');
});

test('voice-chat never reports active when only TTS or STT has a key', () => {
  assert.equal(providerConfigStatus([credential('elevenlabs', 'tts')], 'elevenlabs', ['tts', 'stt']), 'incomplete');
  assert.equal(providerConfigStatus([credential('elevenlabs', 'stt')], 'elevenlabs', ['tts', 'stt']), 'incomplete');
});

test('voice-chat reports active only when both required keys are enabled', () => {
  const saved = [credential('elevenlabs', 'tts'), credential('elevenlabs', 'stt')];
  assert.equal(providerConfigStatus(saved, 'elevenlabs', ['tts', 'stt']), 'active');
});

test('complete but disabled capabilities are not called active', () => {
  const saved = [credential('elevenlabs', 'tts'), credential('elevenlabs', 'stt', false)];
  assert.equal(providerConfigStatus(saved, 'elevenlabs', ['tts', 'stt']), 'saved (disabled)');
});

test('absent keys and empty capability requests fail closed', () => {
  assert.equal(providerConfigStatus([credential('openai', 'chat', true, false)], 'openai', ['chat']), 'not configured');
  assert.equal(providerConfigStatus([credential('openai', 'chat')], 'openai', []), 'not configured');
});
