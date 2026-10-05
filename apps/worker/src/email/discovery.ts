import {
  PostgresEmailAccountRepository,
  PostgresEmailFolderLabelRepository,
  parseCredentialsMasterKey,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";

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
  await provider.connect(credentials);

  try {
    const capabilities = await provider.discoverCapabilities();
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
    await provider.disconnect();
  }
}
