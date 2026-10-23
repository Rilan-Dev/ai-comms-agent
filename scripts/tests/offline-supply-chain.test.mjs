import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const workspaces = [
  [".", "package.json"],
  ["apps/web", "apps/web/package.json"],
  ["apps/worker", "apps/worker/package.json"],
  ["packages/clara-core", "packages/clara-core/package.json"],
  ["packages/db", "packages/db/package.json"],
  ["packages/email-agent-runtime", "packages/email-agent-runtime/package.json"],
  ["packages/shared", "packages/shared/package.json"],
];

const literal = (value) => value.replace(/[^a-zA-Z0-9]/g, (ch) => "\\" + ch);
function lockViolations(lock, manifests) {
  const issues = [];
  if ((lock.match(/^---\s*$/gm) ?? []).length > 1) {
    issues.push("concatenated lockfile documents");
  }
  const start = lock.indexOf("\nimporters:\n");
  const end = lock.indexOf("\npackages:\n");
  const snapshot = lock.indexOf("\nsnapshots:\n");
  if (start < 0 || end <= start || snapshot <= end) {
    issues.push("missing pnpm lockfile importer/package/snapshot sections");
    return issues;
  }
  const importers = lock.slice(start + "\nimporters:\n".length, end);
  const names = [...importers.matchAll(/^  ([^\s][^\n]*):\n/gm)]
    .map((match) => ({ key: match[1], index: match.index }));
  if (names.length !== workspaces.length) {
    issues.push("lockfile has missing or unexpected workspace importers");
  }
  for (const [workspace] of workspaces) {
    const index = names.findIndex((entry) => entry.key === workspace);
    if (index === -1) {
      issues.push("missing lockfile importer: " + workspace);
      continue;
    }
    const block = importers.slice(names[index].index,
      index + 1 < names.length ? names[index + 1].index : undefined);
    const manifest = manifests[workspace];
    for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [name, specifier] of Object.entries(manifest[group] ?? {})) {
        const quoted = name.startsWith("@") ? "'" + name + "'" : name;
        const pattern = new RegExp("^      " + literal(quoted) + ":\\n        specifier: " +
          literal(specifier) + "\\n        version: ([^\\n]+)", "m");
        const match = block.match(pattern);
        if (!match) {
          issues.push("unlocked dependency: " + workspace + "/" + name);
        } else if (specifier.startsWith("workspace:") && !match[1].startsWith("link:")) {
          issues.push("non-local workspace link: " + workspace + "/" + name);
        }
      }
    }
  }
  if (!/^\s{2}next@15\.[^\n]*:\n\s+resolution: \{integrity: sha512-/m.test(lock)) {
    issues.push("missing resolved Next.js package integrity");
  }
  return issues;
}

test("single valid lockfile document pins every workspace dependency", () => {
  const manifests = Object.fromEntries(workspaces.map(([key, path]) => [key, JSON.parse(read(path))]));
  assert.deepEqual(lockViolations(read("pnpm-lock.yaml"), manifests), []);
});

test("reject the historical concatenated pnpm-manager header without evaluating code", () => {
  const manifests = Object.fromEntries(workspaces.map(([key, path]) => [key, JSON.parse(read(path))]));
  const duplicate = "---\nlockfileVersion: '9.0'\n\nimporters:\n  .:\n    configDependencies: {}\n\npackages:\n  pnpm@12.8.1: {}\n\nsnapshots:\n  pnpm@12.8.1: {}\n" +
    read("pnpm-lock.yaml");
  assert.ok(lockViolations(duplicate, manifests).includes("concatenated lockfile documents"));
});

test("Docker build must install only from the committed lockfile", () => {
  const docker = read("Dockerfile");
  assert.match(docker, /RUN pnpm install --frozen-lockfile(?:\s|$)/);
  assert.doesNotMatch(docker, /pnpm install --no-frozen-lockfile/);
  assert.doesNotMatch(docker, /pnpm install [^\n]*--lockfile=false/);
});

test("dependency lifecycle execution requires explicit version-scoped approval", () => {
  const workspace = read("pnpm-workspace.yaml");
  assert.doesNotMatch(workspace, /dangerouslyAllowAllBuilds:\s*true/);
  assert.match(workspace, /^allowBuilds:\s*$/m);
  assert.match(workspace, /^\s{2}['"]?esbuild@0\.21\.5['"]?:\s*true$/m);
  assert.match(workspace, /^\s{2}['"]?esbuild@0\.28\.2['"]?:\s*true$/m);
  assert.doesNotMatch(workspace, /allowBuilds:\s*\{\s*\}/);
});

test("operator stops on source and dependency integrity before Docker build", () => {
  const operator = read("scripts/operator-one-shot.sh");
  const check = operator.indexOf("node --test scripts/tests/build-entrypoint-integrity.test.mjs");
  const docker = operator.indexOf(" build web");
  assert.ok(check >= 0 && docker > check, "supply-chain preflight must run before building images");
  assert.match(operator, /scripts\/tests\/offline-supply-chain\.test\.mjs/);
  assert.match(operator, /docker run --rm --network none/);
});
