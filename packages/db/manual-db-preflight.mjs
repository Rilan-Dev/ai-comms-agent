import { fileURLToPath } from "node:url";

/**
 * Read-only preflight executed INSIDE the same Compose network/environment as
 * the web and worker. Do not log DATABASE_URL or provider/DB credentials.
 */
export function databaseTargetFromEnvironment(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is missing from the Compose application environment");
  let url;
  try { url = new URL(env.DATABASE_URL); } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      !url.pathname || url.pathname === "/") {
    throw new Error("DATABASE_URL must specify a PostgreSQL hostname and database name");
  }
  return { host: url.hostname, port: url.port || "5432", database: decodeURIComponent(url.pathname.slice(1)) };
}

export function describeDatabaseFailure(error, host) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return [
      `PostgreSQL hostname "${host}" cannot be resolved from the application Docker network.`,
      host === "postgres"
        ? "The Compose postgres service is behind the optional local-infra profile; manual-up uses --no-deps and does not start it."
        : "Confirm that the configured database DNS name is reachable from the Docker network.",
      'For a separately managed host database, set .env DATABASE_URL to the correct host (for host-published services, "host.docker.internal"), published port, credentials and database name.',
      "Do not point the app at the disposable ai_comms_c1_test test database.",
    ].join(" ");
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return `PostgreSQL at "${host}" did not accept a connection. Check DB service status, published port, firewall and PostgreSQL listen addresses.`;
  }
  if (code === "28P01" || code === "28000") {
    return "PostgreSQL authentication failed. Check the username/password in the Compose .env DATABASE_URL; credentials are not printed.";
  }
  if (code === "3D000") {
    return "The requested PostgreSQL database does not exist. Verify the database name in .env.";
  }
  if (code === "42501") {
    return "The configured PostgreSQL user lacks the required permission.";
  }
  if (/certificate|ssl|tls/i.test(String(error?.message ?? ""))) {
    return "PostgreSQL TLS negotiation or certificate verification failed. Check DATABASE_SSL and trusted certificate settings.";
  }
  return `PostgreSQL connection failed (code: ${code || "unavailable"}). Verify the .env database target; credentials are not printed.`;
}

export async function checkManualDatabaseConnection(env = process.env, PoolClass) {
  const target = databaseTargetFromEnvironment(env);
  // Lazy import makes configuration and error-classification unit tests pure.
  const { Pool } = PoolClass ? { Pool: PoolClass } : await import("pg");
  const ssl = env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false;
  const pool = new Pool({
    connectionString: env.DATABASE_URL, ssl, max: 1,
    connectionTimeoutMillis: 7_000,
  });
  try {
    const result = await pool.query("SELECT current_database() AS database_name");
    const live = result.rows[0]?.database_name;
    if (live !== target.database) {
      throw Object.assign(new Error("Database identity differs from configured URL"), { code: "DATABASE_IDENTITY_MISMATCH" });
    }
    return { database: live, host: target.host, port: target.port };
  } catch (error) {
    throw new Error(describeDatabaseFailure(error, target.host), { cause: error });
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const target = await checkManualDatabaseConnection();
    process.stdout.write(`[db-preflight] Read-only connection OK: database=${target.database} host=${target.host} port=${target.port}\n`);
  } catch (error) {
    process.stderr.write(`[db-preflight] ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
