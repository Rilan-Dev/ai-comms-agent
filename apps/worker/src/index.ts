/**
 * Worker entry point — Phase 2 foundation
 *
 * Per Phase 2 scope: the worker boots, shared packages resolve, Clara
 * integration boundary is verified. No actual queue consumption yet
 * (Phase 9+ for email sync, Phase 11+ for agent execution).
 */

import { isPostgresConfigured } from "@ai-comms-agent/db";
import { startProviderDraftSyncLoop } from "./email/provider-draft-worker";
import { processApprovedEmailActions } from "./email/action-worker";
import { processQueuedWhatsAppMessages } from "./messaging/whatsapp-worker";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const WORKER_NAME = "ai-comms-agent-worker";
const HEALTH_INTERVAL_MS = 60_000;

function log(message: string, meta?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: WORKER_NAME,
      message,
      ...meta,
    }),
  );
}

function healthCheck() {
  // Verify Clara integration boundary exists (structural check)
  // Full import is deferred to Phase 11+ when adapter code is written.
  // Check multiple possible locations (pnpm puts symlinks in consuming package's node_modules)
  const possibleClaraPaths = [
    "node_modules/@ai-comms-agent/clara-core", // local to this package
    "../../node_modules/@ai-comms-agent/clara-core", // root (fallback)
  ];
  const claraCorePkg = possibleClaraPaths.some((p) => existsSync(resolve(p)));

  // Vendored Clara source is at the repo root
  const vendoredClaraPaths = [
    "../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts",
    "../../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts",
  ];
  const vendoredClara = vendoredClaraPaths.some((p) => existsSync(resolve(p)));

  const checks = {
    worker: "ok" as const,
    shared_package: "ok" as const,
    db_package: "ok" as const,
    clara_core_package: claraCorePkg ? ("ok" as const) : ("missing" as const),
    vendored_clara_source: vendoredClara ? ("ok" as const) : ("missing" as const),
    postgres_configured: isPostgresConfigured(),
    rabbitmq_configured: Boolean(process.env.RABBITMQ_URL),
    redis_configured: Boolean(process.env.REDIS_URL),
    qdrant_configured: Boolean(process.env.QDRANT_URL),
  };

  return checks;
}

function main() {
  log("worker starting", {
    node_version: process.version,
    environment: process.env.NODE_ENV ?? "development",
  });

  const checks = healthCheck();
  log("health check", checks);

  if (checks.clara_core_package !== "ok") {
    log("Clara core package not found — exiting", { level: "error" });
    process.exit(1);
  }

  // Phase 2: health-check loop. Real queue consumption is Phase 9+.
  const stopProviderDraftSync = startProviderDraftSyncLoop();
  const actionTimer = setInterval(() => { void processApprovedEmailActions(); }, 5_000);
  const whatsappTimer = setInterval(() => { void processQueuedWhatsAppMessages(); }, 5_000);
  const interval = setInterval(() => {
    const checks = healthCheck();
    log("health check", checks);
  }, HEALTH_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log(`received ${signal} — shutting down`);
    clearInterval(interval);
    stopProviderDraftSync();
    clearInterval(actionTimer);
    clearInterval(whatsappTimer);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  log("worker ready — provider draft synchronization loop enabled when PostgreSQL is configured");
}

main();
