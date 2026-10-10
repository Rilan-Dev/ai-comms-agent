/**
 * Generic PostgreSQL connection factory.
 *
 * The application is PostgreSQL-native and does not require Supabase.
 * DATABASE_URL is the runtime connection; DIRECT_URL may be supplied for
 * migration/session-mode operations.
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

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
  try {
    return await getPostgresPool().query<T>(text, values);
  } catch (error) {
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
