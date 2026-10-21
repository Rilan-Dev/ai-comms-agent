import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { sanitizeEmailHtml, verifiedEmailHtml } from "../../../packages/shared/src/email/html-sanitizer.ts";

test("preserves safe rich markup including tables and safe HTTPS links", () => {
  const safe = sanitizeEmailHtml('<p>Hello <strong>Sam</strong></p><table><tr><td colspan="2">Due &amp; paid</td></tr></table><a href="https://example.com/pay?a=1&amp;b=2">Review</a>', "");
  assert.ok(safe?.startsWith('<div data-aca-safe-email="rich-v2">'));
  assert.match(safe ?? "", /<strong>Sam<\/strong>/);
  assert.match(safe ?? "", /<table>/);
  assert.match(safe ?? "", /<td colspan="2">Due &amp; paid<\/td>/);
  assert.match(safe ?? "", /href="https:\/\/example.com\/pay\?a=1&amp;b=2"/);
  assert.match(safe ?? "", /rel="noopener noreferrer nofollow"/);
  assert.equal(verifiedEmailHtml(safe, ""), safe);
});

test("strips scripts, embedded content, CSS and all images including tracking pixels", () => {
  const unsafe = [
    '<p onclick="x()">Hi<script>steal()</script><img src="https://track.example/pixel"></p>',
    '<svg onload="x()"><a href="javascript:alert(1)">bad</a></svg>',
    '<math href="javascript:alert(1)"><mtext>fail</mtext></math>',
    '<style>@import url(https://track.example)</style><div style="background:url(https://evil.example)">ok</div>',
    '<iframe src="https://evil.example"></iframe><form action="https://evil.example"><input value="token"></form>',
    '<p><scr<script>ipt>bad</p>',
    '<video src="https://track.example/x"></video><object data="data:text/html,evil"></object>',
    '<a href="&#106;avascript&#58;alert(1)">bad</a><a href="data:text/html;base64,YQ==">bad</a>',
  ];
  for(const input of unsafe){
    const output=sanitizeEmailHtml(input,"text")??"";
    assert.doesNotMatch(output, /<script|<svg|<math|<style|<iframe|<form|<img|<input|<object|<video|onclick=|javascript:|data:text|@import|url\(/i);
    assert.equal(verifiedEmailHtml(output,"text"),output);
  }
});

test("treats malformed, encoded tags as data; unwraps unknown markup without trusting attributes", () => {
  const output = sanitizeEmailHtml('<unknown onclick="go()">Hi &lt;img onerror=evil&gt;<b title="x" style="color:red">B</b><!-- comment --></unknown>',"");
  assert.equal(output, '<div data-aca-safe-email="rich-v2">Hi &lt;img onerror=evil&gt;<b>B</b></div>');
});

test("rejects unsafe link protocols and allowlists only bounded table attributes", () => {
  const output=sanitizeEmailHtml('<a href="JaVaScRiPt:alert(1)">bad</a><a href="mailto:friend@example.org">Email</a><td colspan="999" rowspan="2" style="position:fixed">Cell</td>',"");
  assert.ok(output);
  assert.doesNotMatch(output, /javascript:|colspan="999"|style=/);
  assert.match(output, /href="mailto:friend@example.org"/);
  assert.match(output, /rowspan="2"/);
});

test("retains v1 canonical text rows but rejects legacy raw HTML and spoofed v2 markup", () => {
  const text="Stored & plain";
  assert.equal(verifiedEmailHtml('<pre data-aca-safe-email="text-v1">Stored &amp; plain</pre>',text),'<pre data-aca-safe-email="text-v1">Stored &amp; plain</pre>');
  assert.equal(verifiedEmailHtml('<div data-aca-safe-email="rich-v2"><img src=x onerror=evil>trusted</div>',text),null);
  assert.equal(verifiedEmailHtml('<p onclick="evil()">Untrusted</p>',text),null);
  const valid=sanitizeEmailHtml("<p>Safe</p>",text);
  assert.equal(verifiedEmailHtml(valid,text),valid);
});

test("oversize and degenerate HTML fail closed without persisting original markup", () => {
  assert.equal(sanitizeEmailHtml("<p>x</p>".repeat(200_000),"text"),null);
  assert.equal(sanitizeEmailHtml("<p>ok</p>","x".repeat(100_001)),null);
  assert.equal(sanitizeEmailHtml("<p>ok</p>".repeat(50_000),"text"),null);
  assert.equal(sanitizeEmailHtml("", "text"),null);
  assert.equal(sanitizeEmailHtml(null,"text"),null);
});

test("frozen-lock and all-provider ingest wiring are required for rich sanitizer", () => {
  const shared=JSON.parse(readFileSync(new URL("../../../packages/shared/package.json", import.meta.url),"utf8"));
  const lock=readFileSync(new URL("../../../pnpm-lock.yaml", import.meta.url),"utf8");
  const code=readFileSync(new URL("../../../packages/shared/src/email/html-sanitizer.ts", import.meta.url),"utf8");
  const worker=readFileSync(new URL("../src/email/mailbox-sync-worker.ts", import.meta.url),"utf8");
  assert.equal(shared.dependencies?.parse5, "7.3.0");
  assert.match(lock,/packages\/shared:[\s\S]*?parse5:\s*\n\s*specifier: 7\.3\.0\s*\n\s*version: 7\.3\.0/);
  assert.match(lock,/parse5@7\.3\.0:[\s\S]*?sha512-IInvU7fab/);
  assert.match(lock,/entities@6\.0\.1:[\s\S]*?sha512-aN97NXWF/);
  assert.match(code,/import \{ parseFragment \} from "parse5"/);
  assert.match(worker,/sanitizeEmailHtml\(message\.html_body, message\.text_body\)/);
});
