import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtime = readFileSync(resolve(process.cwd(), "../../packages/clara-core/src/runtime.ts"), "utf8");
const indexer = readFileSync(resolve(process.cwd(), "src/knowledge/email-knowledge-indexer.ts"), "utf8");

test("Clara email retrieval stays tenant-scoped and respects shared/agent document scope", () => {
  assert.match(runtime, /kc\.organization_id = \$1/);
  assert.match(runtime, /kd\.organization_id = kc\.organization_id/);
  assert.match(runtime, /kd\.agent_id IS NULL OR kd\.agent_id::text = \$2/);
});

test("Clara retrieval searches email chunks by query terms without requiring an exact full phrase", () => {
  assert.match(runtime, /to_tsvector\('simple', kc\.content\) @@ to_tsquery\('simple', \$4\)/);
  assert.match(runtime, /const textQuery = terms\.join\(" \| "\)/);
  assert.match(runtime, /terms\.length === 0/);
});

test("email indexer writes bounded chunks through Clara's PostgreSQL knowledge contract", () => {
  assert.match(indexer, /MAX_CHUNK_CHARS = 1_200/);
  assert.match(indexer, /INSERT INTO knowledge_documents/);
  assert.match(indexer, /INSERT INTO knowledge_chunks/);
  assert.match(indexer, /email-account/);
  const executableIndexer = indexer.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(executableIndexer, /qdrant|vector_reference\s*=/i);
});
