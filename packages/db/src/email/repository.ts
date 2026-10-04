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
    status === "active" ? "connected" :
    status === "expired" ? "pending" :
    status === "revoked" ? "revoked" :
    "error";

  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    provider: row.provider as EmailProviderType,
    email_address: String(row.email_address),
    display_name: (row.display_name as string | null) ?? undefined,
    capabilities: (row.capabilities ?? {}) as CapabilitySet,
    status: mappedStatus,
    last_sync_at: (row.last_sync_at as string | null) ?? undefined,
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
}

export class PostgresEmailAccountRepository {
  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const r = await query<Row>(
      `INSERT INTO email_accounts
       (organization_id, provider, email_address, display_name, connection_config, capabilities, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'active')
       RETURNING *`,
      [
        input.organizationId,
        input.provider,
        input.emailAddress,
        input.displayName ?? null,
        JSON.stringify(input.connectionConfig ?? {}),
        JSON.stringify(input.capabilities),
      ],
    );
    return account(requiredRow(r.rows[0], "email account"));
  }

  async getById(id: string): Promise<EmailAccount | null> {
    const r = await query<Row>("SELECT * FROM email_accounts WHERE id = $1", [id]);
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async listForOrganization(organizationId: string): Promise<EmailAccount[]> {
    const r = await query<Row>(
      "SELECT * FROM email_accounts WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId],
    );
    return r.rows.map(account);
  }

  async updateCapabilities(id: string, capabilities: CapabilitySet): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET capabilities = $1::jsonb WHERE id = $2 RETURNING *",
      [JSON.stringify(capabilities), id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateSyncState(id: string, lastSyncAt: string): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET last_sync_at = $1, status = 'active' WHERE id = $2 RETURNING *",
      [lastSyncAt, id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateStatus(id: string, status: "active" | "expired" | "revoked" | "error"): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET status = $1, last_error_at = CASE WHEN $1 = 'error' THEN now() ELSE NULL END WHERE id = $2 RETURNING *",
      [status, id],
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
       (email_account_id, credential_type, encrypted_payload, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (email_account_id)
       DO UPDATE SET credential_type = EXCLUDED.credential_type,
                     encrypted_payload = EXCLUDED.encrypted_payload,
                     updated_at = now()`,
      [accountId, credentialType, encrypted],
    );
  }

  async loadCredentials(accountId: string, masterKey: Buffer): Promise<Record<string, unknown> | null> {
    const r = await query<Row>(
      "SELECT encrypted_payload FROM email_account_credentials WHERE email_account_id = $1",
      [accountId],
    );
    if (!r.rows[0]?.encrypted_payload) return null;
    const raw = decryptCredential(
      decodeBytea(r.rows[0].encrypted_payload),
      masterKey,
    ).toString("utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  }
}

export { PostgresEmailAccountRepository as SupabaseEmailAccountRepository };
