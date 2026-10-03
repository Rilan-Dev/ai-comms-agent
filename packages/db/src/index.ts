/**
 * @ai-comms-agent/db — database access layer
 *
 * Phase 2 scope: client factory + configuration. No production migrations
 * (per Phase 2 scope limits). Migrations are Phase 4.
 *
 * PostgreSQL/Supabase remains approved infrastructure (ADR-009).
 * Local development uses Docker Compose Postgres (infra/docker-compose.yml).
 */

export { createSupabaseClient, type SupabaseConfig } from "./client";
export { isSupabaseConfigured, getSupabaseConfigFromEnv } from "./client";
