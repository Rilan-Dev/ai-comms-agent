import { createHash } from "node:crypto";

export type EmailIndexIdentity = {
  organizationId: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  accountId: string;
  providerMessageId: string;
};

export type EmailIndexHashes = {
  sourceIdentityHash: string;
  contentHash: string;
  metadataHash: string;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Stable across object key order and distinct across org/provider/account/message. */
export function createEmailIndexHashes(
  identity: EmailIndexIdentity,
  canonicalContent: string,
  metadata: Record<string, unknown>,
): EmailIndexHashes {
  const sourceIdentityHash = sha256(stableJson({
    organizationId: identity.organizationId,
    provider: identity.provider,
    accountId: identity.accountId,
    providerMessageId: identity.providerMessageId,
  }));
  return {
    sourceIdentityHash,
    contentHash: sha256(canonicalContent.replace(/\r\n?/g, "\n").trim()),
    metadataHash: sha256(stableJson(metadata)),
  };
}
