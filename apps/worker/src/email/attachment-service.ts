import { createHash } from "node:crypto";
import {
  getMailMessageForOrganization,
  PostgresEmailAccountRepository,
  parseCredentialsMasterKey,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { CapabilityNotSupported } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export interface RetrievedEmailAttachment {
  attachmentId: string;
  messageId: string;
  sizeBytes: number;
  sha256: string;
  content: Buffer;
}

/**
 * Retrieve an email attachment using the worker-only provider boundary.
 *
 * The API never receives provider credentials and never invokes a provider
 * adapter directly. The caller must already have resolved the message inside
 * the organization, preventing cross-tenant attachment access.
 */
export async function retrieveEmailAttachment(
  organizationId: string,
  messageId: string,
  attachmentId: string,
): Promise<RetrievedEmailAttachment> {
  const message = await getMailMessageForOrganization(organizationId, messageId);
  if (!message) throw new Error("Message not found");

  const account = await new PostgresEmailAccountRepository().getById(String(message.email_account_id));
  if (!account || account.organization_id !== organizationId) throw new Error("Email account is unavailable");
  if (!account.capabilities.attachments_download) {
    throw new CapabilityNotSupported(account.provider, "attachments_download");
  }

  const masterKey = process.env.CREDENTIALS_MASTER_KEY
    ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
    : null;
  if (!masterKey) throw new Error("Credential encryption is not configured");

  const repository = new PostgresEmailAccountRepository();
  const encrypted = await repository.loadCredentials(account.id, masterKey);
  if (!encrypted) throw new Error("Email account credentials are unavailable");
  const config = await repository.getConnectionConfig(account.id);
  const credentials: EmailCredentials = {
    ...(encrypted as unknown as EmailCredentials),
    ...(config as unknown as Partial<EmailCredentials>),
  };

  const provider = createEmailProviderRegistry().create(account.provider);
  const result = await verifyEmailProviderConnection(
    provider,
    credentials,
    async ({ provider: connected }) => connected.downloadAttachment(attachmentId),
  );
  const content = result.value;
  if (!content) throw new Error("Provider returned no attachment content");
  const maxBytes = Number(process.env.MAX_EMAIL_ATTACHMENT_BYTES ?? DEFAULT_MAX_BYTES);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error("MAX_EMAIL_ATTACHMENT_BYTES must be a positive number");
  if (content.byteLength > maxBytes) throw new Error("Attachment exceeds configured size limit");

  return {
    attachmentId,
    messageId,
    sizeBytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
    content,
  };
}
