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

/**
 * Stable UUID-shaped vector point ID. Identity is derived from the source hash
 * and chunk index, never body text alone, so identical content in two accounts
 * cannot collide. Adapters must delete surplus old chunk IDs on reindex.
 */
export function createEmailVectorPointId(sourceIdentityHash: string, chunkIndex: number): string {
  if (!sourceIdentityHash || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("Vector point IDs require a source identity hash and non-negative chunk index.");
  }
  const hex = sha256(`${sourceIdentityHash}:${chunkIndex}`).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
