import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const incidentCommit = 'c99252a49afa9b1044a03e8e4e504c0ef9b66bb5';
// Intentionally pin this small executable config, rather than trying to detect
// every possible obfuscation. Review legitimate changes alongside this fixture.
const approvedPostcss = `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
`;
function violations(packageText, postcssText, hasRootPayload) {
  const issues = [];
  const scripts = JSON.parse(packageText).scripts ?? {};
  if (scripts.build !== 'pnpm -r build' || scripts.dev !== 'pnpm -r --parallel dev') issues.push('root build/dev entrypoints changed');
  if (['prebuild', 'postbuild', 'predev', 'postdev'].some(key => Object.hasOwn(scripts, key))) issues.push('root build/dev lifecycle hook added');
  if (postcssText.replaceAll('\r\n', '\n') !== approvedPostcss) issues.push('PostCSS differs from reviewed declarative configuration');
  if (hasRootPayload) issues.push('unexpected root api.js');
  return issues;
}

test('current build entrypoints contain only reviewed commands and PostCSS configuration', () => {
  assert.deepEqual(violations(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    readFileSync(new URL('../../apps/web/postcss.config.mjs', import.meta.url), 'utf8'),
    existsSync(new URL('../../api.js', import.meta.url)),
  ), []);
});

test('integrity checks reject the introducing commit without executing its blobs', t => {
  const available = spawnSync('git', ['cat-file', '-e', `${incidentCommit}^{commit}`], { cwd: root, stdio: 'ignore' });
  if (available.status !== 0) {
    t.skip('Historical negative fixture unavailable in shallow checkout; current-tree checks still run');
    return;
  }
  // git cat-file returns inert text. Never import, eval, or run a historical file.
  const blob = path => execFileSync('git', ['cat-file', 'blob', `${incidentCommit}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const rootPayload = blob('api.js');
  assert.ok(rootPayload.length > 0, 'historical payload fixture exists');
  assert.deepEqual(violations(blob('package.json'), blob('apps/web/postcss.config.mjs'), rootPayload.length > 0), [
    'root build/dev entrypoints changed',
    'PostCSS differs from reviewed declarative configuration',
    'unexpected root api.js',
  ]);
});

test('a new lifecycle hook cannot bypass the entrypoint allowlist', () => {
  const pkg = { scripts: { build: 'pnpm -r build', dev: 'pnpm -r --parallel dev', prebuild: 'node unexpected.js' } };
  assert.deepEqual(violations(JSON.stringify(pkg), approvedPostcss, false), ['root build/dev lifecycle hook added']);
});
