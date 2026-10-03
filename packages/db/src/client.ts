/**
 * Supabase client factory
 *
 * Creates a Supabase client from environment variables. In local development,
 * these point to the Docker Compose Postgres. In production (Phase 4+), these
 * point to the provisioned Supabase project.
 *
 * Security:
 * - The service-role key is NEVER exposed to the browser. It is used only by
 *   the worker and server-side API routes.
 * - The anon key is safe for the browser (RLS-enforced).
 * - Both are read from environment variables, never from the repo.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * Get Supabase configuration from environment variables.
 * Returns null if not configured (e.g., during Phase 2 before provisioning).
 */
export function getSupabaseConfigFromEnv(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey, serviceRoleKey };
}

/**
 * Check if Supabase is configured (non-null env vars).
 * Used by the health check to report database readiness.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigFromEnv() !== null;
}

/**
 * Create a Supabase client with the anon key (RLS-enforced).
 * Safe for browser use. Use this in the web app.
 */
export function createSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  const resolved = config ?? getSupabaseConfigFromEnv();
  if (!resolved) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
    );
  }
  return createClient(resolved.url, resolved.anonKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with the service-role key (bypasses RLS).
 * SERVER-ONLY — never expose to the browser. Use this in the worker and
 * server-side API routes that need privileged access.
 */
export function createSupabaseServiceClient(config?: SupabaseConfig): SupabaseClient {
  const resolved = config ?? getSupabaseConfigFromEnv();
  if (!resolved) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }
  if (!resolved.serviceRoleKey) {
    throw new Error(
      "Supabase service-role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable.",
    );
  }
  return createClient(resolved.url, resolved.serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
