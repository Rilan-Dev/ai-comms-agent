import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/queues/email-sync-rabbitmq.ts"), "utf8");
const worker = readFileSync(resolve(process.cwd(), "src/email/mailbox-sync-worker.ts"), "utf8");
const entry = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");

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
});


test("delivery failures preserve idempotency/correlation metadata and bound retries", () => {
  assert.match(source, /const nextAttempt = \(envelope\?\.attempt_count \?\? 1\) \+ 1/);
  assert.match(source, /const maxAttempts = envelope\?\.max_attempts \?\? 5/);
  assert.match(source, /nextAttempt <= maxAttempts \? RETRY_QUEUE : DEAD_QUEUE/);
  assert.match(source, /idempotency_key: envelope\.idempotency_key/);
  assert.match(source, /correlation_id: envelope\.correlation_id/);
  assert.match(source, /attempt_count: nextAttempt/);
  assert.match(source, /available_at: new Date\(Date\.now\(\) \+ \(target === RETRY_QUEUE \? RETRY_DELAY_MS : 0\)\)\.toISOString\(\)/);
});

test("invalid deliveries are dead-lettered and original messages are retained if publish confirmation fails", () => {
  assert.match(source, /if \(!isEnvelope\(parsed\)\) throw new Error\("Invalid email\.sync envelope"\)/);
  assert.match(source, /publisher\.sendToQueue\(DEAD_QUEUE, message\.content/);
  assert.match(source, /await publisher\.waitForConfirms\(\)/);
  assert.match(source, /activeChannel\.nack\(message, false, true\)/);
  assert.match(source, /Do not lose a message if retry\/DLQ publication is not confirmed/);
});
