import { query } from "../client";
import { decryptCredential, encryptCredential } from "../security";
import type { CapabilitySet, EmailAccount, EmailProviderType } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function decodeBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value !== "string") throw new Error("Encrypted credential payload is not byte data");
  if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
  return Buffer.from(value, "base64");
}

function requiredRow(row: Row | undefined, entity: string): Row {
  if (!row) throw new Error(`${entity} query returned no row`);
  return row;
}

function account(row: Row): EmailAccount {
  const status = String(row.status);
  const mappedStatus =
    status === "connected" ? "connected" :
    status === "pending" ? "pending" :
    status === "revoked" ? "revoked" :
    status === "disconnected" ? "disconnected" :
    "error";

  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    provider: row.provider as EmailProviderType,
    email_address: String(row.email_address),
    display_name: (row.display_name as string | null) ?? undefined,
    capabilities: (row.capabilities ?? {}) as CapabilitySet,
    status: mappedStatus,
    last_sync_at: (row.last_synced_at as string | null) ?? undefined,
    last_error: (row.last_error as string | null) ?? undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export interface CreateEmailAccountInput {
  organizationId: string;
  provider: EmailProviderType;
  emailAddress: string;
  displayName?: string | null;
  connectionConfig?: Record<string, unknown>;
  capabilities: CapabilitySet;
  status?: "pending" | "connected";
}

export class PostgresEmailAccountRepository {
  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const r = await query<Row>(
      `INSERT INTO email_accounts
       (organization_id, provider, email_address, display_name, connection_config, capabilities, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING *`,
      [
        input.organizationId,
        input.provider,
        input.emailAddress,
        input.displayName ?? null,
        JSON.stringify(input.connectionConfig ?? {}),
        JSON.stringify(input.capabilities),
        input.status ?? "connected",
      ],
    );
    return account(requiredRow(r.rows[0], "email account"));
  }

  async findByOrganizationProviderAddress(
    organizationId: string,
    provider: EmailProviderType,
    emailAddress: string,
  ): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "SELECT * FROM email_accounts WHERE organization_id = $1 AND provider = $2 AND email_address = $3 AND deleted_at IS NULL LIMIT 1",
      [organizationId, provider, emailAddress],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateConnection(
    id: string,
    input: {
      emailAddress: string;
      displayName?: string | null;
      connectionConfig: Record<string, unknown>;
      capabilities: CapabilitySet;
      status: "pending" | "connected" | "error" | "disconnected" | "revoked";
    },
  ): Promise<EmailAccount | null> {
    const r = await query<Row>(
      `UPDATE email_accounts
       SET email_address = $1, display_name = $2, connection_config = $3::jsonb,
           capabilities = $4::jsonb, status = $5,
           last_error = NULL, connected_at = CASE WHEN $5 = 'connected' THEN now() ELSE connected_at END,
           updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [
        input.emailAddress,
        input.displayName ?? null,
        JSON.stringify(input.connectionConfig),
        JSON.stringify(input.capabilities),
        input.status,
        id,
      ],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async getById(id: string): Promise<EmailAccount | null> {
    const r = await query<Row>("SELECT * FROM email_accounts WHERE id = $1 AND deleted_at IS NULL", [id]);
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async listForOrganization(organizationId: string): Promise<EmailAccount[]> {
    const r = await query<Row>(
      "SELECT * FROM email_accounts WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId],
    );
    return r.rows.map(account);
  }

  async getConnectionConfig(id: string): Promise<Record<string, unknown>> {
    const r = await query<Row>("SELECT connection_config FROM email_accounts WHERE id = $1 AND deleted_at IS NULL", [id]);
    return (r.rows[0]?.connection_config ?? {}) as Record<string, unknown>;
  }

  async updateCapabilities(id: string, capabilities: CapabilitySet): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET capabilities = $1::jsonb WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [JSON.stringify(capabilities), id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateSyncState(id: string, lastSyncAt: string): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET last_synced_at = $1, status = 'connected', last_error = NULL, connected_at = COALESCE(connected_at, now()) WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [lastSyncAt, id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const r = await query<Row>("DELETE FROM email_accounts WHERE id = $1 RETURNING id", [id]);
    return r.rows.length > 0;
  }

  async updateStatus(
    id: string,
    status: "pending" | "connected" | "error" | "disconnected" | "revoked",
    lastError?: string | null,
  ): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET status = $1, last_error = CASE WHEN $1 = 'error' THEN $2 ELSE NULL END, connected_at = CASE WHEN $1 = 'connected' THEN COALESCE(connected_at, now()) ELSE connected_at END WHERE id = $3 AND deleted_at IS NULL RETURNING *",
      [status, lastError ?? null, id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async saveCredentials(
    accountId: string,
    credentialType: "oauth_token" | "password" | "app_password",
    payload: Record<string, unknown>,
    masterKey: Buffer,
  ): Promise<void> {
    const encrypted = encryptCredential(JSON.stringify(payload), masterKey);
    await query(
      `INSERT INTO email_account_credentials
       (email_account_id, organization_id, ciphertext, key_reference, updated_at)
       VALUES ($1, (SELECT organization_id FROM email_accounts WHERE id = $1), $2, $3, now())
       ON CONFLICT (email_account_id)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                     key_reference = EXCLUDED.key_reference,
                     updated_at = now()`,
      [accountId, encrypted, "credentials-master-key-v1"],
    );
  }

  async loadCredentials(accountId: string, masterKey: Buffer): Promise<Record<string, unknown> | null> {
    const r = await query<Row>(
      "SELECT ciphertext FROM email_account_credentials WHERE email_account_id = $1",
      [accountId],
    );
    if (!r.rows[0]?.ciphertext) return null;
    const raw = decryptCredential(
      decodeBytea(r.rows[0].ciphertext),
      masterKey,
    ).toString("utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  }
}

export { PostgresEmailAccountRepository as SupabaseEmailAccountRepository };
