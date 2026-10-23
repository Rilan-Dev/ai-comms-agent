import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

test("unrs-resolver 1.12.2 postinstall is explicitly denied rather than globally allowed", () => {
  const policy = read("../../../pnpm-workspace.yaml");
  const lock = read("../../../pnpm-lock.yaml");
  assert.match(lock, /unrs-resolver@1\.12\.2/);
  assert.match(policy, /^strictDepBuilds: true$/m);
  assert.match(policy, /^\s*'unrs-resolver@1\.12\.2': false$/m);
  assert.doesNotMatch(policy, /dangerouslyAllowAllBuilds:\s*true/);
  assert.doesNotMatch(policy, /strictDepBuilds:\s*false/);
  assert.doesNotMatch(policy, /'unrs-resolver@1\.12\.2': true/);
});

test("previously reviewed native build approvals remain narrow and pinned", () => {
  const policy = read("../../../pnpm-workspace.yaml");
  for (const pinned of [
    "'esbuild@0.21.5': true",
    "'esbuild@0.28.2': true",
    "'sharp@0.35.5': true",
    "'@tailwindcss/oxide@4.3.3': true",
  ]) assert.ok(policy.includes(pinned), pinned);
});
