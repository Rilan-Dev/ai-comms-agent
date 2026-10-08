import { query, withTransaction } from "../client";

export interface AuthCredentialRecord {
  userId: string;
  passwordHash: string;
  passwordChangedAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export class PostgresAuthRepository {
  async getCredentialByUserId(userId: string): Promise<AuthCredentialRecord | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT user_id, password_hash, password_changed_at, failed_attempts, locked_until
       FROM aca.auth_credentials WHERE user_id = $1`, [userId]);
    const row = result.rows[0];
    return row ? this.toCredential(row) : null;
  }

  async getCredentialByEmail(email: string): Promise<(AuthCredentialRecord & { userId: string }) | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT c.user_id, c.password_hash, c.password_changed_at, c.failed_attempts, c.locked_until
       FROM aca.auth_credentials c
       JOIN aca.users u ON u.id = c.user_id
       WHERE u.email = $1 AND u.deleted_at IS NULL`, [email]);
    const row = result.rows[0];
    return row ? this.toCredential(row) : null;
  }

  async countCredentials(): Promise<number> {\n    const result = await query<{ count: string }>(`SELECT count(*)::text AS count FROM aca.auth_credentials`);\n    return Number(result.rows[0]?.count ?? 0);\n  }\n\n  async upsertPassword(userId: string, passwordHash: string): Promise<void> {
    await query(
      `INSERT INTO aca.auth_credentials (user_id, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
         password_changed_at = now(), failed_attempts = 0, locked_until = NULL, updated_at = now()`,
      [userId, passwordHash],
    );
  }

  async recordLoginAttempt(input: { subjectKey: string; succeeded: boolean; ipAddress: string | null; userAgent: string | null }): Promise<void> {
    await query(
      `INSERT INTO aca.auth_login_attempts (subject_key, succeeded, ip_address, user_agent)
       VALUES ($1, $2, $3::inet, $4)`,
      [input.subjectKey, input.succeeded, input.ipAddress, input.userAgent],
    );
  }

  async countRecentFailures(subjectKey: string, since: Date): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM aca.auth_login_attempts
       WHERE subject_key = $1 AND succeeded = false AND attempted_at >= $2`,
      [subjectKey, since],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async setCredentialLock(userId: string, failedAttempts: number, lockedUntil: Date | null): Promise<void> {
    await query(
      `UPDATE aca.auth_credentials SET failed_attempts = $2, locked_until = $3, updated_at = now()
       WHERE user_id = $1`, [userId, failedAttempts, lockedUntil]);
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date; ipAddress: string | null; userAgent: string | null }): Promise<void> {
    await query(
      `INSERT INTO aca.auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4::inet, $5)`,
      [input.userId, input.tokenHash, input.expiresAt, input.ipAddress, input.userAgent],
    );
  }

  async getActiveSession(tokenHash: string): Promise<AuthSessionRecord | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at
       FROM aca.auth_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`, [tokenHash]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id), userId: String(row.user_id), tokenHash: String(row.token_hash),
      createdAt: String(row.created_at), lastSeenAt: String(row.last_seen_at),
      expiresAt: String(row.expires_at), revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    };
  }

  async touchSession(id: string): Promise<void> {
    await query(
      `UPDATE aca.auth_sessions SET last_seen_at = now()
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`, [id]);
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await query(
      `UPDATE aca.auth_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await query(
      `UPDATE aca.auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  }

  async purgeExpiredSessions(): Promise<void> {
    await query(`DELETE FROM aca.auth_sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`);
  }

  private toCredential(row: Record<string, unknown>): AuthCredentialRecord {
    return {
      userId: String(row.user_id), passwordHash: String(row.password_hash),
      passwordChangedAt: String(row.password_changed_at), failedAttempts: Number(row.failed_attempts ?? 0),
      lockedUntil: row.locked_until ? String(row.locked_until) : null,
    };
  }
}
