import * as amqp from "amqplib";
import type { Channel, ConfirmChannel, ConsumeMessage } from "amqplib";
import type { EmailSyncPayload, QueueEnvelope } from "./email-sync-message";
import { createEmailSyncEnvelope } from "./email-sync-message";

const MAIN_QUEUE = "email.sync";
const RETRY_QUEUE = "email.sync.retry";
const DEAD_QUEUE = "email.sync.dlq";
const RETRY_DELAY_MS = 30_000;
const PREFETCH = 1;

function safeRabbitEndpoint(raw: string): Record<string, string> {
  try {
    const endpoint = new URL(raw);
    return {
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port || (endpoint.protocol === "amqps:" ? "5671" : "5672"),
      virtual_host: decodeURIComponent(endpoint.pathname).split("/").filter(Boolean).join("/") || "/",
    };
  } catch {
    return { protocol: "invalid" };
  }
}

function queueOptions() {
  return { durable: true } as const;
}

async function declareTopology(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.assertQueue(MAIN_QUEUE, queueOptions());
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      "x-message-ttl": RETRY_DELAY_MS,
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": MAIN_QUEUE,
    },
  });
  await channel.assertQueue(DEAD_QUEUE, queueOptions());
}

function isEnvelope(value: unknown): value is QueueEnvelope<EmailSyncPayload> {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<QueueEnvelope<EmailSyncPayload>>;
  const payload = envelope.payload;
  return typeof envelope.id === "string"
    && typeof envelope.correlation_id === "string"
    && typeof envelope.idempotency_key === "string"
    && envelope.routing_key === MAIN_QUEUE
    && Number.isInteger(envelope.attempt_count)
    && Number.isInteger(envelope.max_attempts)
    && !!payload && typeof payload.account_id === "string"
    && ["webhook", "poll", "manual", "refresh"].includes(payload.triggered_by);
}

function publishConfirmed(channel: ConfirmChannel, queue: string, envelope: QueueEnvelope<EmailSyncPayload>): Promise<void> {
  const body = Buffer.from(JSON.stringify(envelope));
  const accepted = channel.sendToQueue(queue, body, {
    persistent: true,
    contentType: "application/json",
    messageId: envelope.id,
    correlationId: envelope.correlation_id,
    timestamp: Date.now(),
    headers: {
      "x-idempotency-key": envelope.idempotency_key,
      "x-attempt-count": envelope.attempt_count,
      "x-max-attempts": envelope.max_attempts,
    },
  });
  return channel.waitForConfirms().then(() => {
    if (!accepted) {
      // The write was buffered locally; waitForConfirms still establishes broker confirmation.
    }
  });
}

export async function publishEmailSync(
  payload: EmailSyncPayload,
  options: { correlationId?: string; maxAttempts?: number } = {},
): Promise<QueueEnvelope<EmailSyncPayload>> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) throw new Error("RABBITMQ_URL is required to publish email sync messages.");
  const connection = await amqp.connect(url);
  try {
    const channel = await connection.createConfirmChannel();
    try {
      await declareTopology(channel);
      const envelope = createEmailSyncEnvelope(payload, options);
      await publishConfirmed(channel, MAIN_QUEUE, envelope);
      return envelope;
    } finally {
      await channel.close().catch(() => undefined);
    }
  } finally {
    await connection.close().catch(() => undefined);
  }
}

export function startEmailSyncRabbitMq(
  handle: (payload: EmailSyncPayload) => Promise<void>,
): () => void {
  const url = process.env.RABBITMQ_URL?.trim() ?? "";
  if (!url) return () => undefined;

  let stopped = false;
  let booting = false;
  let reconnectDelayMs = 1_000;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
  let channel: Channel | undefined;
  let confirmChannel: ConfirmChannel | undefined;
  let consumerTag: string | undefined;

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(30_000, reconnectDelayMs * 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void boot();
    }, delay);
    reconnectTimer.unref?.();
    console.error(JSON.stringify({
      level: "warn",
      service: "worker.email-sync-queue",
      message: "RabbitMQ reconnect scheduled",
      delay_ms: delay,
    }));
  };

  const processMessage = async (message: ConsumeMessage) => {
    const activeChannel = channel;
    const publisher = confirmChannel;
    if (!activeChannel || !publisher) return;
    let envelope: QueueEnvelope<EmailSyncPayload> | undefined;
    try {
      const parsed: unknown = JSON.parse(message.content.toString("utf8"));
      if (!isEnvelope(parsed)) throw new Error("Invalid email.sync envelope");
      envelope = parsed;
      await handle(envelope.payload);
      activeChannel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 400) : "Email sync handler failed";
      const nextAttempt = (envelope?.attempt_count ?? 1) + 1;
      const maxAttempts = envelope?.max_attempts ?? 5;
      const target = envelope && nextAttempt <= maxAttempts ? RETRY_QUEUE : DEAD_QUEUE;
      try {
        if (envelope) {
          const retryEnvelope: QueueEnvelope<EmailSyncPayload> = {
            ...envelope,
            attempt_count: nextAttempt,
            available_at: new Date(Date.now() + (target === RETRY_QUEUE ? RETRY_DELAY_MS : 0)).toISOString(),
          };
          await publishConfirmed(publisher, target, retryEnvelope);
        } else {
          publisher.sendToQueue(DEAD_QUEUE, message.content, {
            persistent: true,
            contentType: message.properties.contentType ?? "application/octet-stream",
            headers: { "x-dead-letter-reason": reason },
          });
          await publisher.waitForConfirms();
        }
        activeChannel.ack(message);
        console.error(JSON.stringify({ level: "error", service: "worker.email-sync-queue", message: "Email sync delivery failed", queue: target, attempt: nextAttempt, reason }));
      } catch (publishError) {
        // Do not lose a message if retry/DLQ publication is not confirmed.
        activeChannel.nack(message, false, true);
        console.error(JSON.stringify({ level: "error", service: "worker.email-sync-queue", message: "Could not confirm retry/DLQ publish; original message requeued", reason: publishError instanceof Error ? publishError.message : "publish failed" }));
      }
    }
  };

  async function boot(): Promise<void> {
    if (stopped || booting) return;
    booting = true;
    let newConnection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
    try {
      newConnection = await amqp.connect(url);
      if (stopped) {
        await newConnection.close().catch(() => undefined);
        return;
      }
      connection = newConnection;
      newConnection.on("error", (error) => {
        console.error(JSON.stringify({ level: "error", service: "worker.email-sync-queue", message: "RabbitMQ connection error", reason: error.message }));
      });
      newConnection.on("close", () => {
        if (stopped) return;
        channel = undefined;
        confirmChannel = undefined;
        consumerTag = undefined;
        connection = undefined;
        scheduleReconnect();
      });

      const nextChannel = await newConnection.createChannel();
      const nextConfirmChannel = await newConnection.createConfirmChannel();
      await declareTopology(nextChannel);
      await declareTopology(nextConfirmChannel);
      await nextChannel.prefetch(PREFETCH);
      // Publish the active channels before registering the consumer callback;
      // RabbitMQ may deliver a queued message immediately after consume resolves.
      channel = nextChannel;
      confirmChannel = nextConfirmChannel;
      const result = await nextChannel.consume(MAIN_QUEUE, (message) => {
        if (message) void processMessage(message);
      }, { noAck: false });
      if (stopped) {
        await nextChannel.cancel(result.consumerTag).catch(() => undefined);
        await nextChannel.close().catch(() => undefined);
        await nextConfirmChannel.close().catch(() => undefined);
        await newConnection.close().catch(() => undefined);
        channel = undefined;
        confirmChannel = undefined;
        return;
      }
      consumerTag = result.consumerTag;
      reconnectDelayMs = 1_000;
      console.log(JSON.stringify({ level: "info", service: "worker.email-sync-queue", message: "Durable email.sync consumer ready", queue: MAIN_QUEUE, prefetch: PREFETCH }));
    } catch (error) {
      if (connection === newConnection) connection = undefined;
      channel = undefined;
      confirmChannel = undefined;
      consumerTag = undefined;
      await newConnection?.close().catch(() => undefined);
      const details = error && typeof error === "object"
        ? error as { code?: unknown; replyCode?: unknown; replyText?: unknown }
        : {};
      console.error(JSON.stringify({
        level: "error",
        service: "worker.email-sync-queue",
        message: "RabbitMQ consumer startup failed",
        reason: error instanceof Error ? error.message : "connection failed",
        error_code: typeof details.code === "string" ? details.code : undefined,
        reply_code: typeof details.replyCode === "number" ? details.replyCode : undefined,
        reply_text: typeof details.replyText === "string" ? details.replyText.slice(0, 300) : undefined,
        endpoint: safeRabbitEndpoint(url),
      }));
      scheduleReconnect();
    } finally {
      booting = false;
    }
  }

  void boot();
  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    void (async () => {
      if (consumerTag && channel) await channel.cancel(consumerTag).catch(() => undefined);
      await channel?.close().catch(() => undefined);
      await confirmChannel?.close().catch(() => undefined);
      await connection?.close().catch(() => undefined);
      channel = undefined;
      confirmChannel = undefined;
      connection = undefined;
      consumerTag = undefined;
    })();
  };
}
