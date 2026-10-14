import test from "node:test";
import assert from "node:assert/strict";
import { createEmailIndexHashes, createEmailVectorPointId } from "../src/knowledge/email-index-identity";

const identity = {
  organizationId: "org-1",
  provider: "gmail" as const,
  accountId: "account-1",
  providerMessageId: "opaque/Message-ID:ABC",
};

test("source identity is account- and provider-scoped, not content-scoped", () => {
  const first = createEmailIndexHashes(identity, "same body", { is_read: false });
  const anotherAccount = createEmailIndexHashes({ ...identity, accountId: "account-2" }, "same body", { is_read: false });
  const anotherProvider = createEmailIndexHashes({ ...identity, provider: "zoho" }, "same body", { is_read: false });
  assert.notEqual(first.sourceIdentityHash, anotherAccount.sourceIdentityHash);
  assert.notEqual(first.sourceIdentityHash, anotherProvider.sourceIdentityHash);
});

test("content and metadata hashes change independently", () => {
  const original = createEmailIndexHashes(identity, "subject\n\nbody", { is_read: false, labels: ["INBOX"] });
  const changedBody = createEmailIndexHashes(identity, "subject\n\nupdated body", { is_read: false, labels: ["INBOX"] });
  const changedMetadata = createEmailIndexHashes(identity, "subject\n\nbody", { is_read: true, labels: ["INBOX"] });
  assert.notEqual(original.contentHash, changedBody.contentHash);
  assert.equal(original.metadataHash, changedBody.metadataHash);
  assert.equal(original.contentHash, changedMetadata.contentHash);
  assert.notEqual(original.metadataHash, changedMetadata.metadataHash);
});

test("canonical hashes normalize line endings and stable object-key order", () => {
  const first = createEmailIndexHashes(identity, "body\r\ntext", { labels: ["INBOX"], is_read: false });
  const second = createEmailIndexHashes(identity, "body\ntext", { is_read: false, labels: ["INBOX"] });
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.metadataHash, second.metadataHash);
  assert.equal(first.sourceIdentityHash, second.sourceIdentityHash);
});

test("vector point IDs are deterministic and unique across account identities and chunks", () => {
  const first = createEmailIndexHashes(identity, "identical body", {});
  const otherAccount = createEmailIndexHashes({ ...identity, accountId: "account-2" }, "identical body", {});
  const pointA = createEmailVectorPointId(first.sourceIdentityHash, 0);
  assert.equal(pointA, createEmailVectorPointId(first.sourceIdentityHash, 0));
  assert.notEqual(pointA, createEmailVectorPointId(first.sourceIdentityHash, 1));
  assert.notEqual(pointA, createEmailVectorPointId(otherAccount.sourceIdentityHash, 0));
  assert.match(pointA, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
