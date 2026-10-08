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
  };
}

function configurePool(next: Pool): Pool {
  next.on("connect", (client) => {
    void client.query("SET search_path TO aca, public").catch((error) => {
      console.error("[db] failed to set application search_path", error);
    });
  });
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
  return getPostgresPool().query<T>(text, values);
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
      // Preserve the original transaction error.
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
