/**
 * @ai-comms-agent/db — database access layer
 *
 * Phase 2 scope: client factory + configuration.
 * Phase 3 scope: identity repository interface + in-memory implementation.
 *
 * No production migrations applied (per Phase 3 handoff §14-15). The SQL
 * migration (supabase/migrations/0001_identity_rbac.sql) is a schema artifact.
 * PostgreSQL/Supabase remains approved infrastructure (ADR-009).
 */

export { createSupabaseClient, type SupabaseConfig } from "./client";
export { isSupabaseConfigured, getSupabaseConfigFromEnv } from "./client";

// Phase 3: identity repository
export { type IdentityRepository } from "./identity/repository";
export { InMemoryIdentityRepository } from "./identity/in-memory";
