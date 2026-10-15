import type { EmailVectorCandidate, EmailVectorSearch } from "./hybrid-retrieval";

type ClaraSearchResponse = {
  ok?: boolean;
  results?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Server-only adapter for Clara's authenticated email-vector search contract.
 * Account scope must come from createEmailHybridRetriever, never model input.
 */
export function createClaraEmailVectorSearch(config: {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
} = {}): EmailVectorSearch {
  const rawBaseUrl = (config.baseUrl ?? process.env.CLARA_EMAIL_VECTOR_API_URL ?? "").trim();
  const apiKey = (config.apiKey ?? process.env.CLARA_EMAIL_VECTOR_API_KEY ?? "").trim();
  const timeoutMs = config.timeoutMs ?? 8_000;
  if (!rawBaseUrl) throw new Error("CLARA_EMAIL_VECTOR_API_URL is required.");
  if (apiKey.length < 32) throw new Error("CLARA_EMAIL_VECTOR_API_KEY must be at least 32 characters.");

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/api/internal/email-vectors")
    ? baseUrl
    : `${baseUrl}/api/internal/email-vectors`;
  const parsed = new URL(endpoint);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("CLARA_EMAIL_VECTOR_API_URL must use HTTPS in production.");
  }

  return async (input) => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
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
          limit: Math.max(1, Math.min(20, Math.floor(input.limit))),
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "request timed out" : "network request failed";
      throw new Error(`Clara email-vector search ${reason}.`);
    }
    if (!response.ok) throw new Error(`Clara email-vector search returned HTTP ${response.status}.`);

    let body: ClaraSearchResponse;
    try {
      body = await response.json() as ClaraSearchResponse;
    } catch {
      throw new Error("Clara email-vector search returned invalid JSON.");
    }
    if (body.ok !== true || !Array.isArray(body.results)) {
      throw new Error("Clara email-vector search did not confirm a valid result set.");
    }

    const hits: EmailVectorCandidate[] = [];
    for (const value of body.results) {
      if (!isRecord(value) ||
          typeof value.orgId !== "string" ||
          typeof value.accountId !== "string" ||
          typeof value.messageId !== "string" ||
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
        score: value.score,
      });
    }
    return hits;
  };
}
