import type { EmailVectorCandidate, EmailVectorSearch } from "./hybrid-retrieval";

type VectorSearchResponse = {
  ok?: boolean;
  results?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Server-only adapter for the authenticated email-vector search contract.
 * Account scope must come from createEmailHybridRetriever, never model input.
 */
export function createEmailVectorSearch(config: {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
} = {}): EmailVectorSearch {
  const rawBaseUrl = (config.baseUrl ?? process.env.AGENT_EMAIL_VECTOR_API_URL ?? "").trim();
  const apiKey = (config.apiKey ?? process.env.AGENT_EMAIL_VECTOR_API_KEY ?? "").trim();
  const timeoutMs = config.timeoutMs ?? 8_000;
  if (!rawBaseUrl) throw new Error("AGENT_EMAIL_VECTOR_API_URL is required.");
  if (apiKey.length < 32) throw new Error("AGENT_EMAIL_VECTOR_API_KEY must be at least 32 characters.");

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/api/internal/email-vectors")
    ? baseUrl
    : `${baseUrl}/api/internal/email-vectors`;
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("AGENT_EMAIL_VECTOR_API_URL must use HTTP or HTTPS.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("AGENT_EMAIL_VECTOR_API_URL must use HTTPS in production.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("AGENT_EMAIL_VECTOR_API_URL must not contain credentials, query, or fragment.");
  }

  return async (input) => {
    // Reject invalid scope before contacting a privileged service. A service
    // token is never a substitute for the caller's agent-to-account grants.
    if (typeof input.orgId !== "string" || !input.orgId.trim() || input.orgId !== input.orgId.trim() || input.orgId.length > 128 ||
        !Array.isArray(input.allowedAccountIds) ||
        input.allowedAccountIds.length < 1 || input.allowedAccountIds.length > 100 ||
        input.allowedAccountIds.some((id) =>
          typeof id !== "string" || !id.trim() || id.length > 256 || id !== id.trim()
        ) ||
        new Set(input.allowedAccountIds).size !== input.allowedAccountIds.length) {
      throw new Error("Email-vector search requires a trusted organization and unique allowed accounts.");
    }
    if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 2000) {
      throw new Error("Email-vector search requires a non-empty, bounded query.");
    }
    if (!Number.isFinite(input.limit) || !Number.isInteger(input.limit) || input.limit < 1) {
      throw new Error("Email-vector search requires a positive integer limit.");
    }
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
        body: JSON.stringify({
          action: "search",
          orgId: input.orgId,
          allowedAccountIds: input.allowedAccountIds,
          query: input.query,
          limit: Math.min(20, input.limit),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "request timed out" : "network request failed";
      throw new Error(`Email-vector search ${reason}.`);
    }
    if (!response.ok) throw new Error(`Email-vector search returned HTTP ${response.status}.`);

    let body: VectorSearchResponse;
    try {
      body = await response.json() as VectorSearchResponse;
    } catch {
      throw new Error("Email-vector search returned invalid JSON.");
    }
    if (body.ok !== true || !Array.isArray(body.results)) {
      throw new Error("Email-vector search did not confirm a valid result set.");
    }

    const hits: EmailVectorCandidate[] = [];
    for (const value of body.results) {
      if (!isRecord(value) ||
          typeof value.orgId !== "string" ||
          typeof value.accountId !== "string" ||
          typeof value.messageId !== "string" ||
          typeof value.contentHash !== "string" ||
          !/^[a-f0-9]{64}$/i.test(value.contentHash) ||
          typeof value.score !== "number" ||
          !Number.isFinite(value.score)) continue;
      // Defense in depth: do not return cross-scope hits even if the upstream
      // service ever returns a malformed payload.
      if (value.orgId !== input.orgId || !input.allowedAccountIds.includes(value.accountId)) continue;
      hits.push({
        orgId: value.orgId,
        accountId: value.accountId,
        messageId: value.messageId,
        ...(typeof value.sourceId === "string" ? { sourceId: value.sourceId } : {}),
        contentHash: value.contentHash,
        score: value.score,
      });
    }
    return hits;
  };
}
