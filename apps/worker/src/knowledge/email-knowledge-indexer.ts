import { createHash } from "node:crypto";
import { query } from "@ai-comms-agent/db";
import type { EmailMessage } from "@ai-comms-agent/shared";

export type EmailKnowledgeSource = {
  organizationId: string;
  accountId: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  message: EmailMessage;
};

const MAX_CHUNK_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 160;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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
  const digest = sha256(body);
  const metadata = {
    source: "email",
    provider,
    email_account_id: accountId,
    provider_message_id: providerMessageId,
    provider_thread_id: message.thread_id || null,
    from_address: message.from_address || null,
    received_at: message.received_at || null,
    is_outbound: Boolean(message.is_outbound),
  };

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
  for (const [chunkIndex, content] of chunks.entries()) {
    const contentHash = sha256(content);
    await query(
      `INSERT INTO knowledge_chunks
         (document_id, organization_id, chunk_index, content, content_hash, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       ON CONFLICT (document_id, content_hash) DO UPDATE SET
         chunk_index=EXCLUDED.chunk_index, organization_id=EXCLUDED.organization_id,
         content=EXCLUDED.content, metadata=EXCLUDED.metadata`,
      [documentId, organizationId, chunkIndex, content, contentHash, JSON.stringify(metadata)],
    );
  }

  await query(
    `DELETE FROM knowledge_chunks
     WHERE document_id=$1 AND chunk_index >= $2`,
    [documentId, chunks.length],
  );
}
