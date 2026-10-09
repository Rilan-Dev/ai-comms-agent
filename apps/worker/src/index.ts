import { isPostgresConfigured, parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { startProviderDraftSyncLoop } from "./email/provider-draft-worker";
import { startMailboxSyncLoop } from "./email/mailbox-sync-worker";
import { processApprovedEmailActions } from "./email/action-worker";
import { processQueuedWhatsAppMessages, verifyPendingWhatsAppAccounts } from "./messaging/whatsapp-worker";
import { processRoutedWhatsAppInbound } from "./messaging/whatsapp-inbound-worker";
import { processScheduledJobs } from "./scheduling/scheduler-worker";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const WORKER_NAME = "ai-comms-agent-worker";
const HEALTH_INTERVAL_MS = 60_000;

function log(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), level: "info", service: WORKER_NAME, message, ...meta,
  }));
}

function healthCheck() {
  const possibleClaraPaths = [
    "node_modules/@ai-comms-agent/clara-core",
    "../../node_modules/@ai-comms-agent/clara-core",
  ];
  const claraCorePkg = possibleClaraPaths.some((p) => existsSync(resolve(p)));

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
    clara_core_package: claraCorePkg ? ("ok" as const) : ("missing" as const),
    postgres_configured: isPostgresConfigured(),
    rabbitmq_configured: Boolean(process.env.RABBITMQ_URL),
    redis_configured: Boolean(process.env.REDIS_URL),
    qdrant_configured: Boolean(process.env.QDRANT_URL),
    credentials_master_key_configured: credentialsMasterKeyConfigured,
  };

  return checks;
}

function main() {
  log("worker starting", { node_version: process.version, environment: process.env.NODE_ENV ?? "development" });
  const checks = healthCheck();
  log("health check", checks);

  if (checks.clara_core_package !== "ok") {
    log("Clara core package not found — exiting", { level: "error" });
    process.exit(1);
  }

  const stopProviderDraftSync = startProviderDraftSyncLoop();
  const stopMailboxSync = startMailboxSyncLoop();
  const actionTimer = setInterval(() => { void processApprovedEmailActions(); }, 5_000);
  const whatsappTimer = checks.credentials_master_key_configured
    ? setInterval(() => { void processQueuedWhatsAppMessages(); }, 5_000)
    : undefined;
  const whatsappInboundTimer = setInterval(() => { void processRoutedWhatsAppInbound(); }, 5_000);
  const whatsappVerifyTimer = checks.credentials_master_key_configured
    ? setInterval(() => { void verifyPendingWhatsAppAccounts(); }, 10_000)
    : undefined;
  const schedulerTimer = setInterval(() => { void processScheduledJobs(); }, 15_000);
  const interval = setInterval(() => { log("health check", healthCheck()); }, HEALTH_INTERVAL_MS);

  const shutdown = (signal: string) => {
    log(`received ${signal} — shutting down`);
    clearInterval(interval);
    stopProviderDraftSync();
    stopMailboxSync();
    clearInterval(actionTimer); if (whatsappTimer) clearInterval(whatsappTimer); clearInterval(whatsappInboundTimer);
    if (whatsappVerifyTimer) clearInterval(whatsappVerifyTimer); clearInterval(schedulerTimer);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  log("worker ready — multi-provider mailbox sync, provider draft, WhatsApp inbound/outbound, and durable scheduler loops enabled when PostgreSQL and required credentials are configured");
}

main();
