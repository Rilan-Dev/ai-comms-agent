import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildEmailPreviewDocument, EMAIL_PREVIEW_CSP } from "../src/lib/email/html-preview-document";

describe("isolated HTML email preview", () => {
  it("preserves sender HTML and inline formatting in an email document", () => {
    const html = '<table style="width:100%"><tr><td><strong>Invoice</strong></td></tr></table>';
    const frame = buildEmailPreviewDocument(html);
    expect(frame).toContain(html);
    expect(frame).toContain("<!doctype html>");
    expect(frame).toContain("overflow-wrap: anywhere");
    expect(frame).toContain("max-width: 100%");
  });

  it("blocks remote images, scripts, external styles, embeds and outgoing requests", () => {
    for (const policy of [
      "default-src 'none'", "script-src 'none'", "connect-src 'none'",
      "img-src data:", "style-src 'unsafe-inline'", "frame-src 'none'",
      "object-src 'none'", "form-action 'none'", "base-uri 'none'",
    ]) expect(EMAIL_PREVIEW_CSP).toContain(policy);
    expect(EMAIL_PREVIEW_CSP).not.toMatch(/img-src[^;]*https?:/);
    const doc = buildEmailPreviewDocument("<p>Hello</p>");
    expect(doc.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(doc.indexOf("<p>Hello</p>"));
  });

  it("uses an opaque-origin iframe, no same-origin or script capabilities", () => {
    const page = readFileSync(resolve(__dirname, "../src/app/mail/thread/[threadId]/thread-client.tsx"), "utf8");
    expect(page).toContain('sandbox=""');
    expect(page).not.toContain('sandbox="allow-same-origin"');
    expect(page).not.toContain('sandbox="allow-scripts"');
    expect(page).toContain('referrerPolicy="no-referrer"');
    expect(page).toContain("buildEmailPreviewDocument(htmlBody)");
    expect(page).toContain("Expand preview");
    expect(page).toContain("remote images blocked for privacy");
  });

  it("does not make email HTML authoritative React markup", () => {
    const page = readFileSync(resolve(__dirname, "../src/app/mail/thread/[threadId]/thread-client.tsx"), "utf8");
    expect(page).not.toContain("dangerouslySetInnerHTML");
    expect(page).toContain('srcDoc={buildEmailPreviewDocument(htmlBody)}');
  });
});
