import { createSupabaseServiceClient } from "../client";
import { decryptCredential, encryptCredential } from "../security";
import type {
  CapabilitySet,
  EmailAccount,
  EmailProviderType,
} from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function decodeBytea(value: unknown): Buffer {\n  if (Buffer.isBuffer(value)) return value;\n  if (value instanceof Uint8Array) return Buffer.from(value);\n  if (typeof value !== "string") throw new Error("Encrypted credential payload is not byte data");\n  if (value.startsWith("\\\\x")) return Buffer.from(value.slice(2), "hex");\n  return Buffer.from(value, "base64");\n}\n\nfunction account(row: Row): EmailAccount {
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

export class SupabaseEmailAccountRepository {
  private readonly db = createSupabaseServiceClient();

  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const { data, error } = await this.db
      .from("email_accounts")
      .insert({
        organization_id: input.organizationId,
        provider: input.provider,
        email_address: input.emailAddress,
        display_name: input.displayName ?? null,
        connection_config: input.connectionConfig ?? {},
        capabilities: input.capabilities,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw error;
    return account(data);
  }

  async getById(id: string): Promise<EmailAccount | null> {
    const { data, error } = await this.db
      .from("email_accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? account(data) : null;
  }

  async listForOrganization(organizationId: string): Promise<EmailAccount[]> {
    const { data, error } = await this.db
      .from("email_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(account);
  }

  async updateCapabilities(id: string, capabilities: CapabilitySet): Promise<EmailAccount | null> {
    const { data, error } = await this.db
      .from("email_accounts")
      .update({ capabilities })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? account(data) : null;
  }

  async updateSyncState(id: string, lastSyncAt: string): Promise<EmailAccount | null> {
    const { data, error } = await this.db
      .from("email_accounts")
      .update({ last_sync_at: lastSyncAt, status: "active" })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? account(data) : null;
  }

  async updateStatus(id: string, status: "active" | "expired" | "revoked" | "error"): Promise<EmailAccount | null> {
    const { data, error } = await this.db
      .from("email_accounts")
      .update({ status, last_error_at: status === "error" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? account(data) : null;
  }

  async saveCredentials(
    accountId: string,
    credentialType: "oauth_token" | "password" | "app_password",
    payload: Record<string, unknown>,
    masterKey: Buffer,
  ): Promise<void> {
    const encrypted = encryptCredential(JSON.stringify(payload), masterKey);
    const { error } = await this.db
      .from("email_account_credentials")
      .upsert({
        email_account_id: accountId,
        credential_type: credentialType,
        encrypted_payload: encrypted,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email_account_id" });

    if (error) throw error;
  }

  async loadCredentials(accountId: string, masterKey: Buffer): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from("email_account_credentials")
      .select("encrypted_payload")
      .eq("email_account_id", accountId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.encrypted_payload) return null;

    const raw = decryptCredential(decodeBytea(data.encrypted_payload), masterKey).toString("utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  }
}
