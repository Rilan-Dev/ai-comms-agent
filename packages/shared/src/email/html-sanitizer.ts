import { parseFragment } from "parse5";

/**
 * Provider HTML is untrusted. parse5 performs HTML5 tokenization, including
 * malformed-tag recovery and numeric/named character reference decoding.
 * This renderer emits ONLY constant allowlisted elements/attributes; never
 * serializes attacker-controlled tags, CSS, images or embedded resources.
 *
 * This is deliberately a small, no-style subset of email HTML, NOT a browser
 * HTML sanitizer with full CSS support. The email reader stays sandboxed/CSP.
 */
const MAX_HTML_CHARS = 1_000_000;
const MAX_TEXT_CHARS = 100_000;
const MAX_OUTPUT_CHARS = 300_000;
const MAX_NODES = 30_000;
const MAX_DEPTH = 64;

const RICH_OPEN = '<div data-aca-safe-email="rich-v2">';
const RICH_CLOSE = "</div>";
const TEXT_OPEN = '<pre data-aca-safe-email="text-v1">';
const TEXT_CLOSE = "</pre>";

const ALLOWED = new Set([
  "a", "b", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3", "h4",
  "hr", "i", "li", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);
const DROP_SUBTREE = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "fieldset", "form",
  "frame", "frameset", "head", "iframe", "img", "input", "link", "math", "meta",
  "noscript", "object", "option", "picture", "script", "select", "source", "style",
  "svg", "template", "textarea", "title", "track", "video",
]);
const VOID_TAGS = new Set(["br", "hr"]);

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

function escapeText(value: string): string {
  return value.replace(/[&<>"'\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (character) => {
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

function safeHref(value: string): string | null {
  if (!value || value.length > 2_048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return url.href;
    if (url.protocol === "mailto:" && !url.search && !url.hash && /^mailto:[^@?]+@[^@?]+$/i.test(url.href)) return url.href;
  } catch {
    // Relative, malformed and non-URL strings cannot become active links.
  }
  return null;
}

function sanitizedAttributes(node: HtmlNode, tag: string): string {
  const attrs = node.attrs ?? [];
  if (tag === "a") {
    const href = attrs.find((a) => a.name.toLowerCase() === "href")?.value;
    const safe = typeof href === "string" ? safeHref(href) : null;
    return safe === null ? "" : ' href="' + escapeText(safe) + '" target="_blank" rel="noopener noreferrer nofollow"';
  }
  if (tag === "td" || tag === "th") {
    let result = "";
    for (const name of ["colspan", "rowspan"]) {
      const raw = attrs.find((a) => a.name.toLowerCase() === name)?.value ?? "";
      const value = Number(raw);
      if (/^[1-9][0-9]?$/.test(raw) && value <= 20) result += " " + name + '="' + value + '"';
    }
    return result;
  }
  return "";
}

function renderHtml(root: HtmlNode): string | null {
  const chunks: string[] = [];
  let length = 0;
  let count = 0;
  function append(value: string): void {
    length += value.length;
    if (length > MAX_OUTPUT_CHARS) throw new Error("email_html_output_limit");
    chunks.push(value);
  }
  function walk(node: HtmlNode, depth: number): void {
    count++;
    if (count > MAX_NODES || depth > MAX_DEPTH) throw new Error("email_html_complexity_limit");
    if (node.nodeName === "#comment") return;
    if (node.nodeName === "#text") {
      append(escapeText(node.value ?? ""));
      return;
    }
    const tag = node.tagName?.toLowerCase() ?? "";
    if (DROP_SUBTREE.has(tag)) return;
    const allowed = ALLOWED.has(tag);
    if (allowed) append("<" + tag + sanitizedAttributes(node, tag) + ">");
    if (!VOID_TAGS.has(tag)) {
      for (const child of node.childNodes ?? []) walk(child, depth + 1);
      if (allowed) append("</" + tag + ">");
    }
  }
  try {
    for (const child of root.childNodes ?? []) walk(child, 0);
    return chunks.join("");
  } catch {
    return null;
  }
}

/**
 * No remote images, CSS, forms, embedded content, SVG or dynamic attributes.
 * Rich messages lacking text/plain can be displayed after parser sanitation.
 * Oversized/too complex messages fail closed as null, falling back to text.
 */
export function sanitizeEmailHtml(rawHtml: unknown, plainText: unknown): string | null {
  if (typeof rawHtml !== "string" || !rawHtml || rawHtml.length > MAX_HTML_CHARS) return null;
  if (typeof plainText === "string" && plainText.length > MAX_TEXT_CHARS) return null;
  try {
    const fragment = parseFragment(rawHtml) as HtmlNode;
    const safe = renderHtml(fragment);
    return safe === null ? null : RICH_OPEN + safe + RICH_CLOSE;
  } catch {
    return null;
  }
}

/**
 * Previously persisted HTML may be unsanitized. Never trust the column name
 * or a forgeable marker. For rich-v2 rows, canonicalize the inner HTML with
 * the same maintained HTML5 parser and compare byte-for-byte. For historical
 * text-v1 rows, compare to the exact escaped current stored text_body. Any
 * other (including legacy raw HTML) is hidden; no DB rewrite is performed.
 */
export function verifiedEmailHtml(storedHtml: unknown, textBody: unknown): string | null {
  if (typeof storedHtml !== "string" || storedHtml.length > MAX_OUTPUT_CHARS + RICH_OPEN.length + RICH_CLOSE.length) return null;
  if (storedHtml.startsWith(RICH_OPEN) && storedHtml.endsWith(RICH_CLOSE)) {
    const inner = storedHtml.slice(RICH_OPEN.length, -RICH_CLOSE.length);
    const rechecked = sanitizeEmailHtml(inner, textBody);
    return rechecked === storedHtml ? storedHtml : null;
  }
  if (typeof textBody !== "string" || !textBody || textBody.length > MAX_TEXT_CHARS) return null;
  const v1 = TEXT_OPEN + escapeText(textBody) + TEXT_CLOSE;
  return storedHtml === v1 ? storedHtml : null;
}
