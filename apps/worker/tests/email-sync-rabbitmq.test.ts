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

test("worker publishes due mailboxes and consumes account-scoped sync jobs", () => {
  assert.match(worker, /publishEmailSync\(/);
  assert.match(worker, /processMailboxSyncMessage/);
  assert.match(entry, /startEmailSyncRabbitMq\(processMailboxSyncMessage\)/);
});
