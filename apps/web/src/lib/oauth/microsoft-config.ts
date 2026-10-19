import { decryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";

/** Fetch the active organization's encrypted Microsoft OAuth client at runtime. */
export async function loadMicrosoftOAuthConfiguration(organizationId: string, id: string) {
  const rawMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (!rawMasterKey) throw new Error("Platform credential-encryption key is not configured.");
  const result = await query<Record<string, unknown>>(
    `SELECT id, organization_id, client_id, tenant_id, client_secret_ciphertext
     FROM microsoft_oauth_configs
     WHERE id=$1 AND organization_id=$2 AND enabled=true LIMIT 1`,
    [id, organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const raw = row.client_secret_ciphertext;
  const encrypted = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw).replace(/^\\x/, ""), "hex");
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    tenantId: String(row.tenant_id),
    clientSecret: decryptCredential(encrypted, parseCredentialsMasterKey(rawMasterKey)).toString("utf8"),
  };
}
