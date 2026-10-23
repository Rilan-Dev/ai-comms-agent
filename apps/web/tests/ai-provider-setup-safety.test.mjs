import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx', import.meta.url), 'utf8');

test('switching providers clears the previously typed unsaved secret', () => {
  const start = source.indexOf('function chooseProvider(next: string)');
  const end = source.indexOf('async function saveProvider()', start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.ok(handler.indexOf('setProvider(next);') >= 0);
  assert.ok(handler.indexOf('setApiKey("");') > handler.indexOf('setProvider(next);'));
  assert.ok(handler.includes('setModel("");'));
  assert.ok(handler.includes('setSttModel("");'));
  assert.ok(handler.includes('setNotice("");'));
  assert.ok(handler.includes('setError("");'));
});

test('provider cards use the secret-clearing switch handler without a duplicate dropdown', () => {
  assert.ok(source.includes('onClick={() => chooseProvider(p)}'));
  assert.ok(source.includes('aria-pressed={p === provider}'));
  assert.ok(source.includes('onClick={() => chooseProvider("")}'));
  assert.ok(!source.includes('onChange={(e) => chooseProvider(e.target.value)}'));
  assert.ok(!source.includes('onClick={() => setProvider(p)}'));
  assert.ok(!source.includes('onChange={(e) => setProvider(e.target.value)}'));
});

test('delete API failures cannot report successful provider removal', () => {
  const start = source.indexOf('async function deleteProvider()');
  assert.ok(start >= 0);
  const block = source.slice(start);
  const guard = block.indexOf('if (!response.ok)');
  const success = block.indexOf('setNotice("Provider config removed.")');
  assert.ok(guard >= 0 && success > guard);
  assert.ok(block.includes('method: "DELETE"'));
  assert.ok(block.includes('throw new Error(body?.message'));
});

test('failed config reload cannot report successful save', () => {
  const start = source.indexOf('async function saveProvider()');
  const end = source.indexOf('async function deleteProvider()', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.ok(block.includes('if (!r.ok) throw new Error(body?.message ?? "Provider configs could not reload.");'));
  assert.ok(block.indexOf('if (!r.ok)') < block.indexOf('setNotice("Provider settings saved.'));
});

test('removing a credential invalidates the previously fetched live models', () => {
  const block = source.slice(source.indexOf('async function deleteProvider()'));
  assert.ok(block.includes('setCatalogVersion((n) => n + 1)'));
});
