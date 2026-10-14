import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/queues/email-sync-rabbitmq.ts"), "utf8");
const worker = readFileSync(resolve(process.cwd(), "src/email/mailbox-sync-worker.ts"), "utf8");
const entry = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
const knowledgeIndexer = readFileSync(resolve(process.cwd(), "src/knowledge/email-knowledge-indexer.ts"), "utf8");
const claraRuntime = readFileSync(resolve(process.cwd(), "../../packages/clara-core/src/runtime.ts"), "utf8");

test("RabbitMQ declares durable main, retry, and dead-letter queues", () => {
  assert.match(source, /assertQueue\(MAIN_QUEUE, queueOptions\(\)\)/);
  assert.match(source, /assertQueue\(RETRY_QUEUE/);
  assert.match(source, /assertQueue\(DEAD_QUEUE, queueOptions\(\)\)/);
  assert.match(source, /x-dead-letter-routing-key": MAIN_QUEUE/);
  assert.match(source, /x-message-ttl": RETRY_DELAY_MS/);
});

test("publisher uses persistent messages and waits for broker confirms", () => {
  assert.match(source, /persistent: true/);
  assert.match(source, /createConfirmChannel\(\)/);
  assert.match(source, /waitForConfirms\(\)/);
});

test("consumer uses prefetch and manual ack; failures are confirmed before ack", () => {
  assert.match(source, /prefetch\(PREFETCH\)/);
  assert.match(source, /activeChannel\.ack\(message\)/);
  assert.match(source, /activeChannel\.nack\(message, false, true\)/);
  assert.match(source, /publishConfirmed\(publisher, target, retryEnvelope\)/);
  assert.ok(source.indexOf("channel = nextChannel;") < source.indexOf("await nextChannel.consume(MAIN_QUEUE"));
});

test("consumer validates RabbitMQ URL as a definite string before reconnectable boot", () => {
  assert.match(source, /const url = process\.env\.RABBITMQ_URL\?\.trim\(\) \?\? ""/);
  assert.match(source, /if \(!url\) return \(\) => undefined/);
});

test("consumer reconnects with a bounded exponential delay after connection loss", () => {
  assert.match(source, /scheduleReconnect/);
  assert.match(source, /Math\.min\(30_000, reconnectDelayMs \* 2\)/);
  assert.match(source, /newConnection\.on\("close"/);
});

test("worker publishes due mailboxes and consumes account-scoped sync jobs", () => {
  assert.match(worker, /publishEmailSync\(/);
  assert.match(worker, /processMailboxSyncMessage/);
  assert.match(entry, /startEmailSyncRabbitMq\(processMailboxSyncMessage\)/);
  assert.doesNotMatch(worker, /s\.cursor IS NOT NULL OR s\.last_success_at/);
  assert.match(worker, /s\.last_success_at < now\(\)-interval '15 minutes'/);
});


test("delivery failures preserve idempotency/correlation metadata and bound retries", () => {
  assert.match(source, /const nextAttempt = \(envelope\?\.attempt_count \?\? 1\) \+ 1/);
  assert.match(source, /const maxAttempts = envelope\?\.max_attempts \?\? 5/);
  assert.match(source, /nextAttempt <= maxAttempts \? RETRY_QUEUE : DEAD_QUEUE/);
  // Retry envelopes spread the original envelope, preserving idempotency and correlation fields.
  assert.match(source, /const retryEnvelope:[\s\S]*?\.{3}envelope/);
  assert.match(source, /available_at: new Date\(Date\.now\(\) \+ \(target === RETRY_QUEUE \? RETRY_DELAY_MS : 0\)\)\.toISOString\(\)/);
});

test("invalid deliveries are dead-lettered and original messages are retained if publish confirmation fails", () => {
  assert.match(source, /if \(!isEnvelope\(parsed\)\) throw new Error\("Invalid email\.sync envelope"\)/);
  assert.match(source, /publisher\.sendToQueue\(DEAD_QUEUE, message\.content/);
  assert.match(source, /await publisher\.waitForConfirms\(\)/);
  assert.match(source, /activeChannel\.nack\(message, false, true\)/);
  assert.match(source, /Do not lose a message if retry\/DLQ publication is not confirmed/);
});

test("synced email is indexed idempotently through the Clara PostgreSQL knowledge contract", () => {
  // The mailbox-sync-worker imports deleteEmailKnowledge for the removeDeletedMessages
  // path. The indexEmailKnowledge call was intentionally decoupled from the sync loop
  // (commit dcc1c3a5) — it now lives in a separate worker tick at
  // apps/worker/src/knowledge/email-knowledge-indexer-worker.ts which selects
  // messages WHERE indexed_at IS NULL and calls indexEmailKnowledge in batched fashion.
  assert.match(worker, /import \{ deleteEmailKnowledge \} from "\.\.\/knowledge\/email-knowledge-indexer"/);
  assert.match(knowledgeIndexer, /INSERT INTO knowledge_documents/);
  assert.match(knowledgeIndexer, /ON CONFLICT \(organization_id, storage_bucket, storage_path\)/);
  assert.match(knowledgeIndexer, /INSERT INTO knowledge_chunks/);
  assert.match(knowledgeIndexer, /ON CONFLICT \(document_id, chunk_index\) DO UPDATE/);
  // Mentioning the forbidden backend in documentation is harmless; actual client imports/calls are not.
  assert.doesNotMatch(knowledgeIndexer, /(?:from\s+["'][^"']*(?:qdrant|vector-store)|\bqdrant\.(?:upsert|search|delete)\b)/i);
});

test("Clara retrieval isolates shared knowledge from other agents", () => {
  assert.match(claraRuntime, /\(\$2::text IS NULL AND kd\.agent_id IS NULL\)/);
  assert.match(claraRuntime, /kd\.agent_id IS NULL OR kd\.agent_id::text = \$2/);
  assert.match(claraRuntime, /\[ctx\.orgId, ctx\.agentId, queryText/);
});
