import { randomUUID } from "node:crypto";

export type EmailSyncTrigger = "webhook" | "poll" | "manual" | "refresh";

export type EmailSyncPayload = {
  account_id: string;
  history_id?: string;
  refresh?: boolean;
  triggered_by: EmailSyncTrigger;
};

export type QueueEnvelope<T> = {
  id: string;
  correlation_id: string;
  idempotency_key: string;
  routing_key: string;
  producer: string;
  consumer: string;
  attempt_count: number;
  max_attempts: number;
  enqueued_at: string;
  available_at: string;
  payload: T;
};

export function createEmailSyncEnvelope(
  payload: EmailSyncPayload,
  options: {
    correlationId?: string;
    producer?: string;
    now?: Date;
    messageId?: string;
    maxAttempts?: number;
  } = {},
): QueueEnvelope<EmailSyncPayload> {
  if (!isUuid(payload.account_id)) throw new Error("email.sync account_id must be a UUID");
  if (payload.history_id !== undefined && !payload.history_id.trim()) {
    throw new Error("email.sync history_id must be non-empty when provided");
  }
  if (!["webhook", "poll", "manual", "refresh"].includes(payload.triggered_by)) {
    throw new Error("email.sync triggered_by is invalid");
  }

  const now = options.now ?? new Date();
  const stamp = now.toISOString();
  const historyKey = payload.history_id?.trim() || "full";
  return {
    id: options.messageId ?? randomUUID(),
    correlation_id: options.correlationId ?? randomUUID(),
    idempotency_key: `${payload.account_id}:${historyKey}`,
    routing_key: "email.sync",
    producer: options.producer ?? `worker.email-sync-producer.${payload.triggered_by}`,
    consumer: "worker.email-sync",
    attempt_count: 1,
    max_attempts: Math.max(1, Math.min(10, Math.trunc(options.maxAttempts ?? 5))),
    enqueued_at: stamp,
    available_at: stamp,
    payload: { ...payload, history_id: payload.history_id?.trim() || undefined },
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
