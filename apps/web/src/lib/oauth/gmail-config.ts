import { decryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";

function masterKey() {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  return raw ? parseCredentialsMasterKey(raw) : null;
}

export async function loadGmailOAuthConfiguration(organizationId: string, id: string) {
  const key = masterKey();
  if (!key) throw new Error("Platform credential encryption is not configured.");
  const result = await query<Record<string, unknown>>(
    `SELECT id, organization_id, label, client_id, client_secret_ciphertext, redirect_uri, enabled
     FROM gmail_oauth_configs WHERE id=$1 AND organization_id=$2 AND enabled=true LIMIT 1`,
    [id, organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const ciphertext = Buffer.isBuffer(row.client_secret_ciphertext)
    ? row.client_secret_ciphertext
    : Buffer.from(String(row.client_secret_ciphertext).replace(/^\\x/, ""), "hex");
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    label: String(row.label),
    clientId: String(row.client_id),
    clientSecret: decryptCredential(ciphertext, key).toString("utf8"),
    redirectUri: String(row.redirect_uri),
  };
}
