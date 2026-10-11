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

function configurePool(next: Pool): Pool {
  next.on("error", (error) => {
    console.error("[db] PostgreSQL pool error", error);
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  // Wrap each standalone query in an explicit BEGIN/COMMIT so the
  // Parse+Bind+Execute+Sync wire messages all go to the SAME PgBouncer
  // backend connection. Without this, PgBouncer transaction-mode pooling
  // can route Parse to backend A and Bind to backend B, which fails with
  // "bind message supplies N parameters, but prepared statement requires M".
  // The transaction wrap is a no-op for SELECT (read-only) and matches the
  // semantics app code already expects (single statement = single txn).
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<T>({ text, values, prepare: false } as never);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original transaction error */ }

    const postgresError = error && typeof error === "object"
      ? error as { message?: unknown; code?: unknown; position?: unknown; routine?: unknown }
      : {};

    // Log the SQL template, never bound values: values may contain email content,
    // tenant identifiers, or other sensitive data. Keep the original error intact.
    console.error(JSON.stringify({
      level: "error",
      service: "db.query",
      message: typeof postgresError.message === "string"
        ? postgresError.message
        : "PostgreSQL query failed",
      code: typeof postgresError.code === "string" ? postgresError.code : undefined,
      position: typeof postgresError.position === "string" ? postgresError.position : undefined,
      routine: typeof postgresError.routine === "string" ? postgresError.routine : undefined,
      sql: text,
      parameter_count: values.length,
    }));

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
    await client.query("BEGIN");
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
