import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The operator's read-only plan/preflight/verify script locates these SQL
// files relative to /workspace/packages/db, including inside the web image.
// A Dockerfile that packages only apps/packages silently breaks release checks.
test("web and worker images include the immutable migration chain for operator verification", () => {
  const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");
  const commonBase = dockerfile.split(/\bFROM base AS web\b/)[0];
  assert.ok(commonBase, "base stage exists before application stages");
  assert.match(commonBase, /^COPY supabase\/migrations \.\/supabase\/migrations\s*$/m,
    "migration files must be copied into the common base image, before web and worker builds");

  const dockerignore = readFileSync(new URL("../../.dockerignore", import.meta.url), "utf8");
  assert.doesNotMatch(dockerignore, /^\/?supabase(?:\/|$)/m, "SQL migration files cannot be excluded from Docker context");
  const verifier = readFileSync(new URL("../../packages/db/operator-migration-check.mjs", import.meta.url), "utf8");
  assert.match(verifier, /supabase\/migrations/, "operator verifier needs the SQL migration chain");
});
