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
  // pnpm 12 saves its own pinned executable in a separate YAML document.
  // A single application document lacks packageManagerDependencies and fails
  // --frozen-lockfile. Reject extra/ambiguous documents and unpinned managers.
  const documents = lock.split(/^---[ \t]*$/gm).map(part => part.trim()).filter(Boolean);
  if (documents.length !== 2) {
    issues.push("expected one pnpm 12 package-manager document and one workspace lockfile document");
    return issues;
  }
  const [manager, workspaceLock] = documents;
  const expectedVersion = manifests["."].packageManager?.match(/^pnpm@([0-9]+\.[0-9]+\.[0-9]+)$/)?.[1];
  if (!expectedVersion ||
      (manager.match(/^lockfileVersion:/gm) ?? []).length !== 1 ||
      (manager.match(/^importers:/gm) ?? []).length !== 1 ||
      !manager.includes("  .:\n    configDependencies: {}\n    packageManagerDependencies:\n      pnpm:\n") ||
      !manager.includes(\`specifier: \${expectedVersion}\n        version: \${expectedVersion}\`) ||
      !manager.includes(\`  pnpm@\${expectedVersion}:\n    resolution: {integrity: sha512-\`) ||
      !manager.includes(\`  '@pnpm/exe.linux-x64@\${expectedVersion}':\n    resolution: {integrity: sha512-\`) ||
      !manager.includes("\nsnapshots:\n")) {
    issues.push("missing or unpinned pnpm package-manager executable integrity");
  }
  if ((workspaceLock.match(/^lockfileVersion:/gm) ?? []).length !== 1 ||
      (workspaceLock.match(/^importers:/gm) ?? []).length !== 1 ||
      workspaceLock.includes("packageManagerDependencies:")) {
    issues.push("invalid or duplicate application dependency lockfile");
  }
  const start = workspaceLock.indexOf("\nimporters:\n");
  const end = workspaceLock.indexOf("\npackages:\n");
  const snapshot = workspaceLock.indexOf("\nsnapshots:\n");
  if (start < 0 || end <= start || snapshot <= end) {
    issues.push("missing pnpm lockfile importer/package/snapshot sections");
    return issues;
  }
  const importers = workspaceLock.slice(start + "\nimporters:\n".length, end);
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
  if (!/^\s{2}next@15\.[^\n]*:\n\s+resolution: \{integrity: sha512-/m.test(workspaceLock)) {
    issues.push("missing resolved Next.js package integrity");
  }
  return issues;
}

test("pnpm 12 pins its executable and every workspace dependency in distinct documents", () => {
  const manifests = Object.fromEntries(workspaces.map(([key, path]) => [key, JSON.parse(read(path))]));
  assert.deepEqual(lockViolations(read("pnpm-lock.yaml"), manifests), []);
});

test("reject missing manager pin, forged manager integrity and duplicate workspace documents", () => {
  const manifests = Object.fromEntries(workspaces.map(([key, path]) => [key, JSON.parse(read(path))]));
  const current = read("pnpm-lock.yaml");
  const docs = current.split(/^---[ \t]*$/gm).map(part => part.trim()).filter(Boolean);
  assert.equal(docs.length, 2, "pnpm manager pin and application dependency graph are distinct");
  const applicationOnly = "---\n" + docs[1] + "\n";
  assert.ok(lockViolations(applicationOnly, manifests).some(issue => issue.includes("package-manager document")));
  const forgedManager = "---\n" + docs[0].replace(
    "  pnpm@12.8.1:\n    resolution: {integrity: sha512-",
    "  pnpm@12.8.1:\n    resolution: {integrity: missing-",
  ) + "\n---\n" + docs[1] + "\n";
  assert.ok(lockViolations(forgedManager, manifests).some(issue => issue.includes("package-manager executable integrity")));
  const duplicated = current + "\n---\n" + docs[1] + "\n";
  assert.ok(lockViolations(duplicated, manifests).some(issue => issue.includes("package-manager document")));
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
