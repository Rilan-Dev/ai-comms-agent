import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/email/mailbox-sync-worker.ts", import.meta.url), "utf8");
const frame = readFileSync(new URL("../../web/src/lib/email/html-preview-document.ts", import.meta.url), "utf8");
const sanitizer = readFileSync(new URL("../../../packages/shared/src/email/html-sanitizer.ts", import.meta.url), "utf8");

function functionBlock(start, stop) {
  const a = repository.indexOf("export async function " + start + "(");
  const b = repository.indexOf("export async function " + stop + "(", a);
  assert.ok(a >= 0 && b > a, "scoped query functions must remain identifiable");
  return repository.slice(a, b);
}

test("single-message access checks BOTH message and account organization, then quarantines legacy HTML", () => {
  const block = functionBlock("getMailMessageForOrganization", "getMailAttachmentForOrganization");
  assert.match(block, /m\.organization_id\s*=\s*\$2/);
  assert.match(block, /a\.organization_id\s*=\s*\$2/);
  assert.match(block, /a\.deleted_at IS NULL/);
  assert.match(block, /a\.id = m\.email_account_id/);
  assert.match(block, /quarantineMailHtmlRow\(r\.rows\[0\]\)/);
  assert.ok(block.indexOf("quarantineMailHtmlRow") > block.indexOf("WHERE"));
});

test("thread reads preserve physical-copy dedupe and BOTH tenant boundaries before legacy validation", () => {
  const block = functionBlock("getMailThreadForOrganization", "updateMailReadStateForOrganization");
  assert.match(block, /m\.organization_id\s*=\s*\$2/);
  assert.match(block, /a\.organization_id\s*=\s*\$2/);
  assert.match(block, /a\.id\s*=\s*m\.email_account_id/);
  assert.match(block, /duplicate_rank = 1/);
  assert.match(block, /r\.rows\.map\(\(row\) => quarantineMailHtmlRow\(row\)\)/);
});

test("read projection overwrites BOTH raw and aliased HTML; no legacy raw preview survives", () => {
  assert.match(repository, /verifiedEmailHtml\(row\.html_body_sanitized, row\.text_body\)/);
  assert.match(repository, /return \{ \.\.\.row, html_body_sanitized: safeHtml, html_body: safeHtml \}/);
  assert.match(sanitizer, /rechecked === storedHtml/);
  assert.match(sanitizer, /storedHtml === v1/);
});

test("every provider uses one sanitizing write, opaque preview and CSP remain intact", () => {
  for (const provider of ["gmail", "zoho", "imap_smtp", "microsoft_graph"]) {
    assert.ok(worker.includes('candidate.provider === "' + provider + '"'));
  }
  assert.match(worker, /sanitizeEmailHtml\(message\.html_body, message\.text_body\)/);
  assert.doesNotMatch(worker, /message\.html_body \|\| null/);
  assert.match(frame, /script-src 'none'/);
});
