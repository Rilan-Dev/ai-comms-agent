import { afterEach, describe, expect, it, vi } from "vitest";
import { createClaraEmailVectorAdapter } from "./clara-email-vector-adapter";
import type { EmailKnowledgeVectorSnapshot } from "./email-index-lifecycle";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const snapshot: EmailKnowledgeVectorSnapshot = {
  organizationId: "org-1",
  accountId: "account-1",
  provider: "gmail",
  providerMessageId: "message-1",
  sourceIdentityHash: "source-hash",
  contentHash: "content-hash",
  metadataHash: "metadata-hash",
  metadata: {
    from_address: "sender@example.com",
    received_at: "2026-10-16T10:00:00.000Z",
    folder_id: "INBOX",
  },
  chunks: [{
    index: 0,
    pointId: "12345678-1234-8123-8123-123456789012",
    content: "Invoice content",
    contentHash: "chunk-hash",
    metadata: {},
  }],
};

function response() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Clara email-vector adapter", () => {
  it("sends deterministic chunk/source metadata to the documented upsert operation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    const adapter = createClaraEmailVectorAdapter({
      baseUrl: "https://clara.example",
      apiKey: "test-service-secret-that-is-long-enough-123",
    });

    await adapter.upsertMessageVectors(snapshot);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://clara.example/api/internal/email-vectors");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-service-secret-that-is-long-enough-123");
    const body = JSON.parse(String(init.body));
    expect(body.action).toBe("upsert");
    expect(body.metadata).toMatchObject({
      orgId: "org-1",
      accountId: "account-1",
      messageId: "message-1",
      sourceId: "source-hash",
      sender: "sender@example.com",
      labels: ["INBOX"],
    });
    expect(body.chunks).toEqual([{
      chunkIndex: 0,
      sourceId: "12345678-1234-8123-8123-123456789012",
      text: "Invoice content",
    }]);
  });

  it("maps account and message cleanup to scoped API actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    const adapter = createClaraEmailVectorAdapter({
      baseUrl: "https://clara.example/api/internal/email-vectors",
      apiKey: "test-service-secret-that-is-long-enough-123",
    });

    await adapter.deleteMessageVectors({
      organizationId: "org-1",
      accountId: "account-1",
      provider: "gmail",
      providerMessageId: "message-1",
      sourceIdentityHash: "source-hash",
    });
    await adapter.deleteAccountVectors({
      organizationId: "org-1",
      accountId: "account-1",
      provider: "gmail",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "delete_message",
      orgId: "org-1",
      accountId: "account-1",
      messageId: "message-1",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      action: "purge_account",
      orgId: "org-1",
      accountId: "account-1",
    });
  });

  it("fails closed when service credentials are absent or too short", () => {
    expect(() => createClaraEmailVectorAdapter({ baseUrl: "https://clara.example", apiKey: "" })).toThrow(/CLARA_EMAIL_VECTOR_API_KEY/);
  });

  it("does not mark an HTTP failure as successful", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("not exposed", { status: 502 }));
    const adapter = createClaraEmailVectorAdapter({
      baseUrl: "https://clara.example",
      apiKey: "test-service-secret-that-is-long-enough-123",
    });
    await expect(adapter.deleteAccountVectors({
      organizationId: "org-1",
      accountId: "account-1",
      provider: "gmail",
    })).rejects.toThrow("HTTP 502");
  });
});
