import assert from "node:assert/strict";
import test from "node:test";
import { chunkEmailKnowledgeBody } from "../src/knowledge/email-knowledge-indexer";

test("empty email bodies do not produce retrieval chunks", () => {
  assert.deepEqual(chunkEmailKnowledgeBody(" \r\n \t "), []);
});

test("short email bodies remain a single normalized chunk", () => {
  assert.deepEqual(chunkEmailKnowledgeBody("hello\r\nworld"), ["hello\nworld"]);
});

test("long email bodies are split into bounded chunks with overlap", () => {
  const paragraph = Array.from({ length: 80 }, (_, index) => `Sentence ${index} contains unique mailbox information.`).join(" ");
  const chunks = chunkEmailKnowledgeBody(paragraph);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1_200));
  assert.ok(chunks.some((chunk, index) => index > 0 && paragraph.includes(chunk.slice(0, 30))));
});

test("repeated identical chunk text is deduplicated for the schema's unique content hash", () => {
  const repeated = "Repeated sentence with the same content. ".repeat(100);
  const chunks = chunkEmailKnowledgeBody(repeated);
  assert.equal(new Set(chunks).size, chunks.length);
});
