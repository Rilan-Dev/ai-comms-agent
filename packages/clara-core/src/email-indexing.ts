import { createHash } from "node:crypto";
import { query } from "@ai-comms-agent/db";
import type { EmailMessage } from "@ai-comms-agent/shared";

const CHUNK_CHARS = 2_800;
const CHUNK_OVERLAP = 240;
const MAX_CHUNKS_PER_MESSAGE = 200;

type EmailIndexScope = {
  organizationId: string;
  accountId: string;
  provider: "gmail" | "zoho" | "imap_smtp";
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < normalized.length && chunks.length < MAX_CHUNKS_PER_MESSAGE) {
    const end = Math.min(normalized.length, offset + CHUNK_CHARS);
    let boundary = end;
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf("\n\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const space = normalized.lastIndexOf(" ", end);
      const candidate = Math.max(paragraph, sentence, space);
      if (candidate > offset + Math.floor(CHUNK_CHARS * 0.55)) boundary = candidate + 1;
    }
    const chunk = normalized.slice(offset, boundary).trim();
    if (chunk) chunks.push(chunk);
    if (boundary >= normalized.length) break;
    offset = Math.max(offset + 1, boundary - CHUNK_OVERLAP);
  }
  return chunks;
}

/**
 * Host adapter into the local Clara knowledge_documents/knowledge_chunks contract.
 * It intentionally does not write directly to Qdrant or implement a separate vector store.
 * Current Clara retrieval is PostgreSQL-backed lexical grounding, so chunks are stored in
 * that same contract with hashes and source metadata; embedding/vector fields stay unset.
 */
export async function indexEmailForClara(scope: EmailIndexScope, message: EmailMessage): Promise<{ documentId: string; chunks: number }> {
  const providerMessageId = (message.provider_message_id || message.id).trim();
  if (!providerMessageId) throw new Error("Cannot index an email without a provider message ID.");

  const text = [
    message.subject ? `Subject: ${message.subject}` : "",
    message.from_address ? `From: ${message.from_address}` : "",
    message.to_addresses?.length ? `To: ${message.to_addresses.join(", ")}` : "",
    message.cc_addresses?.length ? `Cc: ${message.cc_addresses.join(", ")}` : "",
    message.received_at ? `Received: ${message.received_at}` : "",
    message.text_body || message.snippet || "",
  ].filter(Boolean).join("\n\n").trim();
  if (!text) return { documentId: "", chunks: 0 };

  const digest = sha256(text);
  const storagePath = `email/${scope.accountId}/${encodeURIComponent(providerMessageId)}`;
  const document = await query<{ id: string }>(
    `INSERT INTO knowledge_documents
       (organization_id, agent_id, filename, content_type, storage_bucket, storage_path,
        sha256, size_bytes, status, metadata, updated_at)
     VALUES ($1,NULL,$2,'text/plain','email',$3,$4,$5,'ready',
       $6::jsonb,now())
     ON CONFLICT (organization_id, storage_bucket, storage_path) WHERE storage_path IS NOT NULL
     DO UPDATE SET filename=EXCLUDED.filename, content_type=EXCLUDED.content_type,
       sha256=EXCLUDED.sha256, size_bytes=EXCLUDED.size_bytes, status='ready',
       metadata=EXCLUDED.metadata, updated_at=now()
     RETURNING id`,
    [
      scope.organizationId,
      (message.subject || providerMessageId).slice(0, 240),
      storagePath,
      digest,
      Buffer.byteLength(text, "utf8"),
      JSON.stringify({
        source: "email",
        provider: scope.provider,
        email_account_id: scope.accountId,
        provider_message_id: providerMessageId,
        received_at: message.received_at,
        from_address: message.from_address,
        subject: message.subject || "",
      }),
    ],
  );
  const documentId = document.rows[0]?.id;
  if (!documentId) throw new Error("Clara email index did not return a document ID.");

  // The schema also enforces unique content hashes per document; remove repeated
  // identical chunks while preserving their first occurrence and stable ordering.
  const chunks = [...new Map(splitIntoChunks(text).map((chunk) => [sha256(chunk), chunk])).values()];
  await query("DELETE FROM knowledge_chunks WHERE document_id=$1 AND organization_id=$2", [documentId, scope.organizationId]);
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index]!;
    await query(
      `INSERT INTO knowledge_chunks
         (document_id, organization_id, chunk_index, content, content_hash,
          embedding_provider, embedding_model, vector_reference, metadata)
       VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,$6::jsonb)
       ON CONFLICT (document_id, chunk_index) DO UPDATE SET
         content=EXCLUDED.content, content_hash=EXCLUDED.content_hash,
         embedding_provider=NULL, embedding_model=NULL, vector_reference=NULL,
         metadata=EXCLUDED.metadata`,
      [
        documentId,
        scope.organizationId,
        index,
        content,
        sha256(content),
        JSON.stringify({
          source: "email",
          email_account_id: scope.accountId,
          provider_message_id: providerMessageId,
          provider: scope.provider,
          chunk_index: index,
          chunk_count: chunks.length,
          content_sha256: digest,
        }),
      ],
    );
  }
  return { documentId, chunks: chunks.length };
}
