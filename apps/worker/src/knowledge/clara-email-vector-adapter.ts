import type {
  EmailKnowledgeVectorAdapter,
  EmailKnowledgeVectorSnapshot,
} from "./email-index-lifecycle";

type ClaraVectorApiResponse = { ok?: boolean; error?: string };

type AdapterConfig = {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
};

function sourceDate(metadata: Record<string, unknown>): string | null {
  const value = metadata.received_at ?? metadata.receivedAt;
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function stringField(metadata: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function labelsField(metadata: Record<string, unknown>): string[] | undefined {
  const value = metadata.labels;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  const folder = stringField(metadata, "folder_id", "folderId");
  if (folder) return [folder];
  // An explicit null/empty folder means clear a previously indexed label.
  if ("folder_id" in metadata || "folderId" in metadata) return [];
  return undefined;
}

/** Reject malformed source identities before sending a privileged API request. */
function requireSourceIdentity(value: unknown, label: string, maxLength = 256): void {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Clara email-vector API requires a valid ${label}.`);
  }
}

/**
 * Creates the trusted worker adapter for Clara's documented internal API.
 * It is deliberately not wired into worker startup: ISS-026 must close before
 * user-facing retrieval is exposed, and callers must authorize mailbox grants
 * at execution time before using search operations.
 */
export function createClaraEmailVectorAdapter(config: AdapterConfig = {}): EmailKnowledgeVectorAdapter {
  const rawBaseUrl = (config.baseUrl ?? process.env.CLARA_EMAIL_VECTOR_API_URL ?? "").trim();
  const apiKey = (config.apiKey ?? process.env.CLARA_EMAIL_VECTOR_API_KEY ?? "").trim();
  const timeoutMs = config.timeoutMs ?? 15_000;

  if (!rawBaseUrl) throw new Error("CLARA_EMAIL_VECTOR_API_URL is required.");
  if (apiKey.length < 32) throw new Error("CLARA_EMAIL_VECTOR_API_KEY must be at least 32 characters.");

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/api/internal/email-vectors")
    ? baseUrl
    : `${baseUrl}/api/internal/email-vectors`;
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CLARA_EMAIL_VECTOR_API_URL must use HTTP or HTTPS.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("CLARA_EMAIL_VECTOR_API_URL must use HTTPS in production.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("CLARA_EMAIL_VECTOR_API_URL must not contain credentials, query, or fragment.");
  }

  async function send(payload: Record<string, unknown>): Promise<void> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Do not include URL, credential, message content, or response body in errors.
      const reason = error instanceof Error && error.name === "TimeoutError" ? "request timed out" : "network request failed";
      throw new Error(`Clara email-vector API ${reason}.`);
    }

    if (!response.ok) {
      throw new Error(`Clara email-vector API returned HTTP ${response.status}.`);
    }
    let result: ClaraVectorApiResponse;
    try {
      result = await response.json() as ClaraVectorApiResponse;
    } catch {
      throw new Error("Clara email-vector API returned an invalid response.");
    }
    if (result.ok !== true) throw new Error("Clara email-vector API did not confirm the operation.");
  }

  return {
    async upsertMessageVectors(snapshot: EmailKnowledgeVectorSnapshot): Promise<void> {
      requireSourceIdentity(snapshot.organizationId, "organization ID", 128);
      requireSourceIdentity(snapshot.accountId, "account ID");
      requireSourceIdentity(snapshot.providerMessageId, "message ID", 512);
      requireSourceIdentity(snapshot.sourceIdentityHash, "source identity hash");
      if (!/^[a-f0-9]{64}$/i.test(snapshot.contentHash) || !/^[a-f0-9]{64}$/i.test(snapshot.metadataHash)) {
        throw new Error("Clara email-vector API requires valid content and metadata hashes.");
      }
      const metadata: Record<string, unknown> = {
        orgId: snapshot.organizationId,
        accountId: snapshot.accountId,
        messageId: snapshot.providerMessageId,
        sourceId: snapshot.sourceIdentityHash,
        receivedAt: sourceDate(snapshot.metadata),
        contentHash: snapshot.contentHash,
        metadataHash: snapshot.metadataHash,
      };
      const sender = stringField(snapshot.metadata, "from_address", "sender");
      const subject = stringField(snapshot.metadata, "subject");
      const labels = labelsField(snapshot.metadata);
      if ("from_address" in snapshot.metadata || "sender" in snapshot.metadata) metadata.sender = sender ?? null;
      if ("subject" in snapshot.metadata) metadata.subject = subject ?? null;
      if (labels !== undefined) metadata.labels = labels;

      await send({
        action: "upsert",
        metadata,
        chunks: snapshot.chunks.map((chunk) => ({
          chunkIndex: chunk.index,
          sourceId: chunk.pointId,
          text: chunk.content,
          contentHash: chunk.contentHash,
        })),
      });
    },

    async deleteMessageVectors(input): Promise<void> {
      requireSourceIdentity(input.organizationId, "organization ID", 128);
      requireSourceIdentity(input.accountId, "account ID");
      requireSourceIdentity(input.providerMessageId, "message ID", 512);
      // The Clara contract scopes message identity by organization + account +
      // provider message ID. Provider is already represented by the account's
      // owning source system and does not replace the account boundary.
      void input.provider;
      await send({
        action: "delete_message",
        orgId: input.organizationId,
        accountId: input.accountId,
        messageId: input.providerMessageId,
      });
    },

    async deleteAccountVectors(input): Promise<void> {
      requireSourceIdentity(input.organizationId, "organization ID", 128);
      requireSourceIdentity(input.accountId, "account ID");
      void input.provider;
      await send({
        action: "purge_account",
        orgId: input.organizationId,
        accountId: input.accountId,
      });
    },
  };
}
