import { isPostgresConfigured, parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { startProviderDraftSyncLoop } from "./email/provider-draft-worker";
import { startGmailWatchRenewalLoop } from "./email/gmail-watch-worker";
import { startImapIdleWorker } from "./email/imap-idle-worker";
import { startMicrosoftGraphSubscriptionWorker } from "./email/microsoft-graph-subscription-worker";
import { processMailboxSyncMessage, startMailboxSyncLoop } from "./email/mailbox-sync-worker";
import { startEmailSyncRabbitMq } from "./queues/email-sync-rabbitmq";
import { processApprovedEmailActions } from "./email/action-worker";
import { processQueuedWhatsAppMessages, verifyPendingWhatsAppAccounts } from "./messaging/whatsapp-worker";
import { processRoutedWhatsAppInbound } from "./messaging/whatsapp-inbound-worker";
import { processScheduledJobs } from "./scheduling/scheduler-worker";
import {processAutomationEventOutbox} from "./automation/event-outbox-worker";
import { startEmailKnowledgeIndexerLoop } from "./knowledge/email-knowledge-indexer-worker";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { processPendingBriefings } from './briefings/dispatch';

const WORKER_NAME = "ai-comms-agent-worker";
const HEALTH_INTERVAL_MS = 60_000;

function log(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), level: "info", service: WORKER_NAME, message, ...meta,
  }));
}

function logError(service: string, message: string, error: unknown) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    service,
    message,
    reason: error instanceof Error ? error.message : "Unknown error",
  }));
}

function healthCheck() {
  const possibleAgentCorePaths = [
    "node_modules/@ai-comms-agent/agent-core",
    "../../node_modules/@ai-comms-agent/agent-core",
  ];
  const agentCorePkg = possibleAgentCorePaths.some((p) => existsSync(resolve(p)));

  let credentialsMasterKeyConfigured = false;
  const rawCredentialsMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (rawCredentialsMasterKey) {
    try {
      parseCredentialsMasterKey(rawCredentialsMasterKey);
      credentialsMasterKeyConfigured = true;
    } catch {
      credentialsMasterKeyConfigured = false;
    }
  }

  const checks = {
    worker: "ok" as const,
    shared_package: "ok" as const,
    db_package: "ok" as const,
    agent_core_package: agentCorePkg ? ("ok" as const) : ("missing" as const),
    postgres_configured: isPostgresConfigured(),
    rabbitmq_configured: Boolean(process.env.RABBITMQ_URL),
    redis_configured: Boolean(process.env.REDIS_URL),
    qdrant_configured: Boolean(process.env.QDRANT_URL),
    credentials_master_key_configured: credentialsMasterKeyConfigured,
  };

  return checks;
}

// Wrap any tick fn so transient DB / broker errors NEVER crash the worker.
// Logs structured error and lets the next interval tick retry. This is
// critical for Prisma Postgres Data Proxy (PgBouncer transaction-mode) and
// for broker hiccups — both are recoverable.
function safeTick(service: string, label: string, fn: () => Promise<unknown>) {
  fn().catch((error) => logError(service, `${label} failed`, error));
}

function main() {
  log("worker starting", { node_version: process.version, environment: process.env.NODE_ENV ?? "development" });
  const checks = healthCheck();
  log("health check", checks);

  if (checks.agent_core_package !== "ok") {
    log("Agent core package not found — exiting", { level: "error" });
    process.exit(1);
  }

  const stopProviderDraftSync = startProviderDraftSyncLoop();
  const stopGmailWatchRenewal = startGmailWatchRenewalLoop();
  const stopImapIdleWorker = startImapIdleWorker();
  const stopMicrosoftGraphSubscriptions = startMicrosoftGraphSubscriptionWorker();
  const stopMailboxSync = startMailboxSyncLoop();
  const stopEmailSyncQueue = startEmailSyncRabbitMq(processMailboxSyncMessage);
  const stopEmailKnowledgeIndexer = startEmailKnowledgeIndexerLoop();
  const actionTimer = setInterval(
    () => safeTick("worker.email-actions", "Approved email actions poll", processApprovedEmailActions),
    5_000,
  );
  const whatsappTimer = checks.credentials_master_key_configured
    ? setInterval(
        () => safeTick("worker.whatsapp-outbound", "WhatsApp queued message poll", processQueuedWhatsAppMessages),
        5_000,
      )
    : undefined;
  const whatsappInboundTimer = setInterval(
    () => safeTick("worker.whatsapp-inbound", "WhatsApp inbound router poll", processRoutedWhatsAppInbound),
    5_000,
  );
  const whatsappVerifyTimer = checks.credentials_master_key_configured
    ? setInterval(
        () => safeTick("worker.whatsapp-verify", "WhatsApp pending verification poll", verifyPendingWhatsAppAccounts),
        10_000,
      )
    : undefined;
  const automationEventTimer = setInterval(() => safeTick("worker.automations","Durable email automation events",processAutomationEventOutbox),10_000);
  const schedulerTimer = setInterval(
    () => safeTick("worker.scheduler", "Scheduled job processing", processScheduledJobs),
    15_000,
  );
  const interval = setInterval(() => { log("health check", healthCheck()); }, HEALTH_INTERVAL_MS);
  const briefingTimer = process.env.BRIEFINGS_ENABLED === 'true'
    ? setInterval(() => safeTick('worker.briefings','Personal catch-up generation',processPendingBriefings),5_000)
    : undefined;

  const shutdown = (signal: string) => {
    log(`received ${signal} — shutting down`);
    clearInterval(interval);
    if (briefingTimer) clearInterval(briefingTimer);
    stopProviderDraftSync();
    stopGmailWatchRenewal();
    stopImapIdleWorker();
    stopMicrosoftGraphSubscriptions();
    stopMailboxSync();
    stopEmailSyncQueue();
    stopEmailKnowledgeIndexer();
    clearInterval(actionTimer); if (whatsappTimer) clearInterval(whatsappTimer); clearInterval(whatsappInboundTimer);
    if (whatsappVerifyTimer) clearInterval(whatsappVerifyTimer); clearInterval(schedulerTimer); clearInterval(automationEventTimer);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  // Defensive: an unhandled rejection MUST NOT crash the worker. The
  // safeTick wrapper covers setInterval ticks; this catches any remaining
  // promise rejection from queued microtasks (e.g. fire-and-forget side
  // effects inside a tick).
  process.on("unhandledRejection", (error) => {
    logError("worker.unhandled-rejection", "Unhandled promise rejection", error);
  });
  process.on("uncaughtException", (error) => {
    logError("worker.uncaught-exception", "Uncaught exception", error);
    // Continue running — operator can decide to restart via health check.
  });
  log("worker ready — multi-provider mailbox sync, Gmail Pub/Sub watch renewal, IMAP IDLE watchers, Microsoft Graph subscription renewal, RabbitMQ email.sync queue when configured, provider draft, WhatsApp inbound/outbound, and durable scheduler loops enabled when PostgreSQL and required credentials are configured");
}

main();
