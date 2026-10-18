/**
 * Untrusted email HTML for an opaque-origin sandboxed iframe.
 *
 * Pattern informed by Mailflow's emailFrameDoc: keep the sender's layout in an
 * isolated document, set a restrictive CSP before user HTML and block tracking
 * resources. This does NOT replace the required server-side allowlist at ingest
 * (FIX-01 issue #36). Never render this markup in the parent React DOM.
 */
export const EMAIL_PREVIEW_MAX_HTML = 250_000;

export const EMAIL_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
].join("; ");

export function buildEmailPreviewDocument(htmlBody: string): string {
  // Bound malicious/huge documents so one thread does not freeze the browser.
  // We deliberately do not try to regex-sanitize HTML; only a real HTML parser
  // with an allowlist is sufficient, owned by FIX-01 at ingest.
  const bounded = String(htmlBody ?? "").slice(0, EMAIL_PREVIEW_MAX_HTML);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="only light">
<meta http-equiv="Content-Security-Policy" content="${EMAIL_PREVIEW_CSP}">
<base target="_blank">
<style>
  html,body{margin:0;min-height:0;box-sizing:border-box;background:#fff;color:#1d2430;font:14px/1.6 Arial,Helvetica,sans-serif}
  body{padding:20px;overflow-wrap:anywhere}
  *,*::before,*::after{box-sizing:border-box}
  table{max-width:100%;border-collapse:collapse}
  img,svg,video,canvas{max-width:100%;height:auto}
  pre{overflow:auto;white-space:pre-wrap;word-break:break-word}
  blockquote{border-left:3px solid #d4d4d8;padding-left:12px;margin-left:0}
  a{color:#1d4ed8;overflow-wrap:anywhere}
  @media(max-width:520px){body{padding:12px}}
</style>
</head><body><div class="email-content">${bounded}</div></body></html>`;
}
