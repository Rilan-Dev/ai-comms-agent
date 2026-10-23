/**
 * Generic PostgreSQL connection factory.
 *
 * The application is PostgreSQL-native and does not require Supabase.
 * DATABASE_URL is the runtime connection; DIRECT_URL may be supplied for
 * migration/session-mode operations.
 */

import { Pool, Client, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

// Prisma Postgres Data Proxy (and PgBouncer transaction-mode pooling in
// general) reuses backend connections across statements. The `pg` library
// can cache unnamed server-side prepared statements on the client, but when
// PgBouncer hands the same client a different backend connection, the Bind
// message mismatches with `bind message supplies N parameters, but prepared
// statement requires M`. The fix is to disable the extended-query Parse step
// entirely on every query the workspace issues. We monkey-patch the Pool's
// and Client's query methods to inject `prepare: false` into every QueryConfig
// they see. PoolClient inherits from Client, so the Client patch covers
// withTransaction callbacks too.
/* eslint-disable @typescript-eslint/no-explicit-any */
const patchQueryProto = (proto: any, label: string) => {
  const original = proto?.query;
  if (!original || original.__acaPatched) return;
  const patched = function (this: any, ...args: any[]): any {
    // Case 1: query(textString, valuesArray, callback)
    // Case 2: query({ text, values, ... })
    // In both cases, we need to ensure `prepare: false` so pg does not
    // issue a server-side Parse message. PgBouncer transaction-mode pooling
    // can route Parse and Bind to different backends, causing
    // "bind message supplies N parameters, but prepared statement requires M".
    if (typeof args[0] === "string") {
      const text = args[0];
      const values = Array.isArray(args[1]) ? args[1] : [];
      const callback = typeof args[1] === "function" ? args[1] : (typeof args[2] === "function" ? args[2] : undefined);
      const cfg: any = { text, values, prepare: false };
      if (callback) cfg.callback = callback;
      args = [cfg];
    } else if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
      if (args[0].prepare === undefined) args[0].prepare = false;
    }
    return original.apply(this, args);
  };
  (patched as any).__acaPatched = true;
  (patched as any).__acaLabel = label;
  proto.query = patched;
};
patchQueryProto(Pool.prototype, "Pool");
patchQueryProto(Client.prototype, "Client");
/* eslint-enable @typescript-eslint/no-explicit-any */

// Also patch pg's Query.prototype.requiresPreparation to force simple
// protocol when the query has NO values. For queries WITH values, we still
// need extended protocol (because Postgres simple protocol can't bind params),
// so we wrap them in BEGIN/COMMIT in the `query()` helper below to ensure
// Parse+Bind go to the same PgBouncer backend.
/* eslint-disable @typescript-eslint/no-explicit-any */
// (debug hooks removed — kept for future use; the audit fix lives in
// packages/db/src/audit/repository.ts where $${n} now produces $N correctly)
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface PostgresConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  options?: string;
}

let pool: Pool | undefined;

export function getPostgresConfigFromEnv(): PostgresConfig | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
    ssl: process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
      : false,
    options: "-c search_path=aca,public",
  };
}

/** Only an allowlisted SQLSTATE can be sent to shared server logs.
 * Never log database errors, SQL text or bound values: PostgreSQL may include
 * private WhatsApp recipients, message bodies and whole failing rows in detail.
 */
export function safePostgresDiagnostic(error: unknown): { sqlstate: string } | { kind: "server_error" } {
  const rawCode = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code : null;
  return typeof rawCode === "string" && /^[A-Z0-9]{5}$/.test(rawCode)
    ? { sqlstate: rawCode }
    : { kind: "server_error" };
}

function configurePool(next: Pool): Pool {
  next.on("error", (error) => {
    console.error("[db] PostgreSQL pool error", safePostgresDiagnostic(error));
  });
  return next;
}

export function getPostgresPool(config?: PostgresConfig): Pool {
  if (config) return configurePool(new Pool(config));
  if (pool) return pool;

  const resolved = getPostgresConfigFromEnv();
  if (!resolved) {
    throw new Error("PostgreSQL is not configured. Set DATABASE_URL.");
  }

  pool = configurePool(new Pool(resolved));
  return pool;
}

export function isPostgresConfigured(): boolean {
  return getPostgresConfigFromEnv() !== null;
}

// Detect whether DATABASE_URL uses session-mode (port 5432) or
// transaction-mode (port 6543) pooling. Session-mode holds the same
// backend for the connection's lifetime, so:
//   - search_path set via startup `options` packet PERSISTS
//   - No need for per-query BEGIN/COMMIT (no PgBouncer routing issue)
//   - No need for per-query SET LOCAL search_path
// Transaction-mode routes each transaction to a different backend, so
// we MUST wrap each query in BEGIN/COMMIT + SET LOCAL search_path.
//
// Performance impact (200ms latency to remote Supabase):
//   Session-mode: 1 round trip/query × 5 queries = 1.0s per API
//   Transaction-mode: 3 round trips/query × 5 queries = 3.0s per API
//   Old code (3 round trips always): 3 × 5 = 3.0s per API
function isSessionModePooling(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    const port = parsed.port || "5432";
    return port !== "6543"; // 5432 = session-mode, 6543 = transaction-mode
  } catch {
    return false; // If URL parsing fails, assume transaction-mode (safe).
  }
}

let _sessionModeCached: boolean | undefined;
function isSessionMode(): boolean {
  if (_sessionModeCached === undefined) _sessionModeCached = isSessionModePooling();
  return _sessionModeCached;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  const client = await getPostgresPool().connect();
  try {
    if (isSessionMode()) {
      // Session-mode: search_path persists via startup `options` packet.
      // No BEGIN/COMMIT needed (no PgBouncer routing issue). 1 round trip.
      return await client.query<T>({ text, values, prepare: false } as never);
    }
    // Transaction-mode: wrap in BEGIN/COMMIT + SET LOCAL so Parse+Bind
    // go to the same backend. Combine BEGIN+SET_LOCAL into 1 round trip.
    await client.query("BEGIN; SET LOCAL search_path = aca,public");
    const result = await client.query<T>({ text, values, prepare: false } as never);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (!isSessionMode()) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
    }
    console.error("[db] PostgreSQL query failed", safePostgresDiagnostic(error));
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPostgresPool().connect();
  try {
    if (isSessionMode()) {
      // Session-mode: search_path already set. Keep BEGIN/COMMIT for
      // transaction semantics (atomic multi-statement).
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    }
    // Transaction-mode: BEGIN + SET LOCAL combined into 1 round trip.
    await client.query("BEGIN; SET LOCAL search_path = aca,public");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
