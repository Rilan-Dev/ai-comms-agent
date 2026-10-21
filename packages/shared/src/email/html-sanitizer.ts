/**
 * Fail-closed HTML email ingestion boundary.
 *
 * This is intentionally a ZERO untrusted-tag allowlist. We do not parse or
 * attempt to preserve sender HTML/CSS until a reviewed maintained HTML parser
 * can be pinned in the frozen dependency graph. Only the provider's text/plain
 * representation is escaped into our own constant <pre> tag. The original HTML
 * is NEVER persisted. This loses rich formatting but prevents script, CSS,
 * tracking pixels, frames, forms, malformed markup and external fetches.
 *
 * The canonical output is recomputable from stored text_body, so readers can
 * quarantine old unsanitized html_body_sanitized rows without relying on an
 * attacker-forgeable prefix or a risky data rewrite.
 */
const MAX_HTML_CHARS = 1_000_000;
const MAX_TEXT_CHARS = 100_000;
const SAFE_OPEN = '<pre data-aca-safe-email="text-v1">';
const SAFE_CLOSE = '</pre>';

function escapeText(value: string): string {
  return value.replace(/[&<>"'\u0000]/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return "\uFFFD";
    }
  });
}

/**
 * For HTML-only messages with no text/plain body, return null instead of
 * guessing safe text via a hand-written HTML regex/parser.
 * Callers retain the plain-text/snippet reader fallback.
 */
export function sanitizeEmailHtml(rawHtml: unknown, plainText: unknown): string | null {
  if (typeof rawHtml !== "string" || rawHtml.length === 0 || rawHtml.length > MAX_HTML_CHARS) return null;
  if (typeof plainText !== "string" || plainText.length === 0 || plainText.length > MAX_TEXT_CHARS) return null;
  return SAFE_OPEN + escapeText(plainText) + SAFE_CLOSE;
}

/**
 * Do not trust column names or a content marker. Accept only byte-for-byte
 * canonical output for this row's current stored text body; a legacy value
 * resembling the marker but containing executable markup is still rejected.
 */
export function verifiedEmailHtml(storedHtml: unknown, textBody: unknown): string | null {
  if (typeof storedHtml !== "string") return null;
  const canonical = sanitizeEmailHtml("present", textBody);
  return canonical !== null && storedHtml === canonical ? canonical : null;
}
