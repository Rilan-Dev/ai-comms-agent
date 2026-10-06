import {
  PostgresEmailAccountRepository,
  PostgresEmailFolderLabelRepository,
  parseCredentialsMasterKey,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";

export async function discoverEmailAccountStructure(accountId: string): Promise<{
  folders: number;
  labels: number;
}> {
  const masterKey = process.env.CREDENTIALS_MASTER_KEY
    ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
    : null;
  if (!masterKey) throw new Error("Credential encryption is not configured");

  const accounts = new PostgresEmailAccountRepository();
  const account = await accounts.getById(accountId);
  if (!account) throw new Error("Email account not found");

  const encrypted = await accounts.loadCredentials(accountId, masterKey);
  if (!encrypted) throw new Error("Email account credentials are unavailable");

  const connectionConfig = await accounts.getConnectionConfig(accountId);
  const credentials: EmailCredentials = {
    ...(encrypted as unknown as EmailCredentials),
    ...(connectionConfig as unknown as Partial<EmailCredentials>),
  };

  const provider = createEmailProviderRegistry().create(account.provider);
  let capabilities: Awaited<ReturnType<typeof verifyEmailProviderConnection>>["capabilities"];
  try {
    capabilities = (await verifyEmailProviderConnection(provider, credentials)).capabilities;
    // The verification helper disconnects the adapter after capability discovery.
    // Folder/label discovery is therefore performed in a fresh connection below.
    await provider.connect(credentials);
    const folders = capabilities.folders ? await provider.listFolders() : [];
    const labels = capabilities.labels && provider.listLabels ? await provider.listLabels() : [];
    const repository = new PostgresEmailFolderLabelRepository();

    // Discovery is a replacement snapshot, not an append-only cache. Empty
    // provider results intentionally clear stale folders/labels.
    await repository.replaceFolders(account.id, account.organization_id, folders);
    await repository.replaceLabels(account.id, account.organization_id, labels);
    await accounts.updateCapabilities(account.id, capabilities);
    await accounts.updateStatus(account.id, "connected");
    return { folders: folders.length, labels: labels.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox discovery failed";
    await accounts.updateStatus(account.id, "error", message);
    throw error;
  } finally {
    // Safe even when verification failed before connect; provider implementations
    // must tolerate disconnect after a partial connection attempt.
    try { await provider.disconnect(); } catch { /* preserve the original verification/discovery error */ }
  }
}
