import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeEmailHtml, verifiedEmailHtml } from "../../../packages/shared/src/email/html-sanitizer.ts";

const worker = readFileSync(new URL("../src/email/mailbox-sync-worker.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const preview = readFileSync(new URL("../../web/src/lib/email/html-preview-document.ts", import.meta.url), "utf8");

test("ingest quarantines scriptable or tracking HTML to inert text-only markup", () => {
  const samples = [
    '<script>alert(1)</script><p onclick="steal()">Hello</p>',
    '<img src="https://tracker.example/pixel?email=secret">',
    '<svg onload="alert(1)"><animate attributeName="href" /></svg>',
    '<iframe src="https://example.test/"></iframe><form action="https://example.test/"></form>',
    '<a href="javascript:alert(1)">click</a><a href="data:text/html;base64,eA==">x</a>',
    '<div style="background-image:url(https://example.test/tracker)">Hi</div>',
    '<style>@import url(https://example.test/a.css)</style>',
    '<p>&lt;script&gt;&#x3c;img src=x onerror=alert(1)&#x3e;</p>',
    '<math href="javascript:alert(1)"><mtext>X</mtext></math>',
    '<p><scr<script>ipt>malformed',
  ];
  for (const value of samples) {
    const html = sanitizeEmailHtml(value, '<unsafe & "quoted" and \'single\'');
    assert.equal(html, '<pre data-aca-safe-email="text-v1">&lt;unsafe &amp; &quot;quoted&quot; and &#39;single&#39;</pre>');
    assert.equal(verifiedEmailHtml(html, '<unsafe & "quoted" and \'single\''), html);
    assert.doesNotMatch(html, /<script|<svg|<img|<iframe|<form|<style|javascript:|data:/i);
  }
});

test("does not store raw rich HTML without a safe text counterpart", () => {
  assert.equal(sanitizeEmailHtml("<b>only rich</b>", ""), null);
  assert.equal(sanitizeEmailHtml(null, "text"), null);
  assert.equal(sanitizeEmailHtml("<p>ok</p>", null), null);
  assert.equal(sanitizeEmailHtml("x".repeat(1_000_001), "Safe text"), null);
  assert.equal(sanitizeEmailHtml("<b>x</b>", "y".repeat(100_001)), null);
  assert.equal(sanitizeEmailHtml("<b>x</b>", ""), null);
});

test("legacy HTML is quarantined, even if it mimics the marker but contains executable content", () => {
  assert.equal(verifiedEmailHtml('<img src=x onerror=alert(1)>', "fallback"), null);
  assert.equal(verifiedEmailHtml('<pre data-aca-safe-email="text-v1"><img src=x onerror=alert(1)></pre>', "fallback"), null);
  assert.equal(verifiedEmailHtml('<pre data-aca-safe-email="text-v1">different</pre>', "fallback"), null);
  assert.equal(verifiedEmailHtml(null, "fallback"), null);
  assert.equal(verifiedEmailHtml("<script>evil</script>", null), null);
  const safe = sanitizeEmailHtml("<b>Original</b>", "Bounded text");
  assert.equal(verifiedEmailHtml(safe, "Bounded text"), safe);
  assert.equal(verifiedEmailHtml(safe, "Changed"), null);
});

test("all mailbox sync providers use the one safe HTML write boundary", () => {
  for (const provider of ["gmail", "zoho", "imap_smtp", "microsoft_graph"]) {
    assert.ok(worker.includes('candidate.provider === "'+provider+'"') || worker.includes('candidate.provider === "'+provider+'"'));
  }
  assert.match(worker, /sanitizeEmailHtml\(message\.html_body, message\.text_body\)/);
  assert.doesNotMatch(worker, /message\.html_body \|\| null/);
  assert.match(worker, /html_body_sanitized=EXCLUDED\.html_body_sanitized/);
});

test("tenant scoped message and thread reads quarantine legacy before delivering HTML", () => {
  assert.match(repository, /verifiedEmailHtml\(row\.html_body_sanitized, row\.text_body\)/);
  assert.match(repository, /html_body_sanitized: safeHtml/);
  assert.match(repository, /html_body: safeHtml/);
  assert.match(repository, /m\.organization_id = \$2 AND a\.organization_id = \$2/);
  assert.match(repository, /a\.organization_id = \$2 AND a\.deleted_at IS NULL/);
  assert.match(preview, /script-src 'none'/);
});
