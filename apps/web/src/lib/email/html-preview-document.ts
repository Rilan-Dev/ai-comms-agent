/**
 * A conservative display shell for untrusted message HTML.
 *
 * Message bodies remain untrusted after provider ingestion. The frame runs
 * without scripts, same-origin privileges, forms, remote images, CSS imports,
 * web fonts, or outgoing fetches. Sender HTML/CSS can format the isolated
 * message but cannot inherit the application's DOM or session.
 *
 * This is defense in depth, NOT an alternative to server-side email
 * sanitization. Never move source HTML into the top-level React DOM.
 */
export const EMAIL_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "img-src data:",
  "media-src 'none'",
  "font-src data:",
  "style-src 'unsafe-inline'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export function buildEmailPreviewDocument(htmlBody: string): string {
  const html = String(htmlBody ?? "");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="only light">
<meta http-equiv="Content-Security-Policy" content="${EMAIL_PREVIEW_CSP}">
<style>
  html { color-scheme: light; background: #fff; }
  body { margin: 0; padding: 16px; font: 14px/1.6 Arial, sans-serif; color: #242424; overflow-wrap: anywhere; }
  table { max-width: 100%; }
  img, video { max-width: 100%; height: auto; }
  pre { white-space: pre-wrap; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 12px; }
</style></head><body>${html}</body></html>`;
}
