import { query } from "@ai-comms-agent/db";
import { createEmailIndexHashes, sha256 } from "./email-index-identity";
import type { EmailMessage } from "@ai-comms-agent/shared";

export type EmailKnowledgeSource = {
  organizationId: string;
  accountId: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  message: EmailMessage;
};

const MAX_CHUNK_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 160;

/**
 * Split email content into bounded, overlapping retrieval chunks. Prefer
 * paragraph boundaries, then sentence/space boundaries, and finally a hard
 * character boundary for long unbroken content.
 */
export function chunkEmailKnowledgeBody(body: string): string[] {
  const normalized = body.replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > MAX_CHUNK_CHARS) {
    const window = remaining.slice(0, MAX_CHUNK_CHARS + 1);
    const minimumBreak = Math.floor(MAX_CHUNK_CHARS * 0.55);
    const candidates = [
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf(" "),
    ];
    const breakAt = candidates.find((candidate) => candidate >= minimumBreak) ?? MAX_CHUNK_CHARS;
    const chunk = remaining.slice(0, breakAt).trim();
    if (chunk) chunks.push(chunk);
    const nextStart = Math.max(1, breakAt - CHUNK_OVERLAP_CHARS);
    remaining = remaining.slice(nextStart).trimStart();
  }
  if (remaining) chunks.push(remaining);

  // The schema also has a unique(document_id, content_hash) constraint.
  // Avoid duplicate identical chunks in a single document.
  return [...new Set(chunks)];
}

/**
 * Host adapter for Clara's existing knowledge_documents / knowledge_chunks
 * contract. Writes tenant-scoped PostgreSQL knowledge records only; it never
 * writes directly to Qdrant or changes the immutable Clara reference sources.
 */
export async function indexEmailKnowledge(source: EmailKnowledgeSource): Promise<void> {
  const { organizationId, accountId, provider, message } = source;
  const providerMessageId = (message.provider_message_id || message.id).trim();
  if (!organizationId || !accountId || !providerMessageId) {
    throw new Error("Email knowledge indexing requires organization, account, and provider message IDs.");
  }
  if (message.is_draft) return;

  const body = [
    message.subject ? `Subject: ${message.subject}` : "",
    message.from_address ? `From: ${message.from_address}` : "",
    message.to_addresses?.length ? `To: ${message.to_addresses.join(", ")}` : "",
    message.received_at ? `Received: ${message.received_at}` : "",
    message.text_body || message.snippet || "",
  ].filter(Boolean).join("\n\n").trim();
  if (!body) return;

  const storagePath = `${accountId}/${encodeURIComponent(providerMessageId)}`;
  const retrievalMetadata = {
    source: "email",
    provider,
    email_account_id: accountId,
    provider_message_id: providerMessageId,
    provider_thread_id: message.thread_id || null,
    folder_id: message.folder_id || null,
    from_address: message.from_address || null,
    to_addresses: message.to_addresses ?? [],
    cc_addresses: message.cc_addresses ?? [],
    bcc_addresses: message.bcc_addresses ?? [],
    received_at: message.received_at || null,
    is_read: Boolean(message.is_read),
    is_starred: Boolean(message.is_starred),
    is_draft: Boolean(message.is_draft),
    is_outbound: Boolean(message.is_outbound),
    has_attachments: Boolean(message.has_attachments),
  };
  const hashes = createEmailIndexHashes(
    { organizationId, provider, accountId, providerMessageId },
    body,
    retrievalMetadata,
  );
  const digest = hashes.contentHash;
  const metadata = {
    ...retrievalMetadata,
    source_identity_hash: hashes.sourceIdentityHash,
    content_hash: hashes.contentHash,
    metadata_hash: hashes.metadataHash,
  };

  const existing = await query<{ id: string; sha256: string; metadata: Record<string, unknown> | string }>(
    `SELECT id, sha256, metadata
       FROM knowledge_documents
      WHERE organization_id=$1 AND storage_bucket='email-account' AND storage_path=$2
      LIMIT 1`,
    [organizationId, storagePath],
  );
  const existingDocument = existing.rows[0];
  const existingMetadata = typeof existingDocument?.metadata === "string"
    ? (() => { try { return JSON.parse(existingDocument.metadata) as Record<string, unknown>; } catch { return {}; } })()
    : (existingDocument?.metadata ?? {});
  if (existingDocument && existingDocument.sha256 === digest) {
    if (existingMetadata.metadata_hash !== hashes.metadataHash ||
        existingMetadata.source_identity_hash !== hashes.sourceIdentityHash) {
      await query(
        `UPDATE knowledge_documents
            SET filename=$1, metadata=$2::jsonb, updated_at=now()
          WHERE id=$3 AND organization_id=$4 AND storage_bucket='email-account'`,
        [(message.subject || providerMessageId).slice(0, 500), JSON.stringify(metadata), existingDocument.id, organizationId],
      );
      await query(
        "UPDATE knowledge_chunks SET metadata=$1::jsonb WHERE document_id=$2 AND organization_id=$3",
        [JSON.stringify(metadata), existingDocument.id, organizationId],
      );
    }
    // Content is unchanged: metadata-only changes do not rebuild chunks or re-embed.
    return;
  }

  const document = await query<{ id: string }>(
    `INSERT INTO knowledge_documents
       (organization_id, agent_id, filename, content_type, storage_bucket, storage_path,
        sha256, size_bytes, status, metadata, updated_at)
     VALUES ($1, NULL, $2, 'message/rfc822', 'email-account', $3, $4, $5, 'ready', $6::jsonb, now())
     ON CONFLICT (organization_id, storage_bucket, storage_path) WHERE storage_path IS NOT NULL
     DO UPDATE SET filename=EXCLUDED.filename, content_type=EXCLUDED.content_type,
       sha256=EXCLUDED.sha256, size_bytes=EXCLUDED.size_bytes, status='ready',
       metadata=EXCLUDED.metadata, updated_at=now()
     RETURNING id`,
    [
      organizationId,
      (message.subject || providerMessageId).slice(0, 500),
      storagePath,
      digest,
      Buffer.byteLength(body, "utf8"),
      JSON.stringify(metadata),
    ],
  );
  const documentId = document.rows[0]?.id;
  if (!documentId) throw new Error("Clara email knowledge document could not be persisted.");

  const chunks = chunkEmailKnowledgeBody(body);
  // Rebuild this document's chunk set before inserting to avoid transient
  // conflicts between the unique (document_id, chunk_index) and
  // (document_id, content_hash) constraints when chunk boundaries shift.
  await query("DELETE FROM knowledge_chunks WHERE document_id=$1", [documentId]);
  for (const [chunkIndex, content] of chunks.entries()) {
    const contentHash = sha256(content);
    await query(
      `INSERT INTO knowledge_chunks
         (document_id, organization_id, chunk_index, content, content_hash, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       ON CONFLICT (document_id, chunk_index) DO UPDATE SET
         organization_id=EXCLUDED.organization_id, content=EXCLUDED.content,
         content_hash=EXCLUDED.content_hash, metadata=EXCLUDED.metadata`,
      [documentId, organizationId, chunkIndex, content, contentHash, JSON.stringify(metadata)],
    );
  }
}

/**
 * Remove the derived Clara document for a provider message that no longer
 * exists remotely. PostgreSQL remains authoritative; this deletes only the
 * email-specific knowledge document/chunks and never touches user-uploaded KBs.
 * Replays are safe when the document was already removed.
 */
export async function deleteEmailKnowledge(
  organizationId: string,
  accountId: string,
  providerMessageId: string,
): Promise<void> {
  if (!organizationId || !accountId || !providerMessageId) {
    throw new Error("Email knowledge deletion requires organization, account, and provider message IDs.");
  }
  const storagePath = `${accountId}/${encodeURIComponent(providerMessageId.trim())}`;
  await query(
    `DELETE FROM knowledge_documents
     WHERE organization_id = $1
       AND storage_bucket = 'email-account'
       AND storage_path = $2`,
    [organizationId, storagePath],
  );
}


/**
 * Purge every email-derived Clara document for one removed connected account.
 * This is deliberately limited to the email-account bucket and organization.
 * The repository has no direct Qdrant client; vector deletion must be performed
 * by the configured Clara knowledge/RAG lifecycle integration before purge is
 * reported complete.
 */
export async function deleteEmailKnowledgeForAccount(
  organizationId: string,
  accountId: string,
): Promise<void> {
  if (!organizationId || !accountId) {
    throw new Error("Email account knowledge purge requires organization and account IDs.");
  }
  await query(
    `DELETE FROM knowledge_documents
      WHERE organization_id=$1
        AND storage_bucket='email-account'
        AND metadata->>'email_account_id'=$2`,
    [organizationId, accountId],
  );
}
