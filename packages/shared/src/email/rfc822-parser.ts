/**
 * Minimal RFC822 / MIME message parser.
 *
 * Used by the Zoho adapter (which fetches raw RFC822 source from
 * /api/accounts/{accountId}/messages/{messageId}/originalmessage) and
 * by the IMAP adapter (which fetches raw RFC822 source via FETCH BODY[]).
 *
 * Parses:
 *   - Headers (with multi-line continuation support)
 *   - Subject / From / To / Cc / Bcc / Message-ID / In-Reply-To /
 *     References / Date / Content-Type / Content-Transfer-Encoding
 *   - Body extraction for non-multipart messages
 *   - Multipart boundary detection — finds the first text/plain and
 *     first text/html parts (recursive for nested multipart)
 *   - Quoted-Printable + Base64 decoding for body content
 *
 * NOT supported (not needed for our use case):
 *   - Encrypted parts (PGP, S/MIME)
 *   - Calendar attachments (.ics)
 *   - Winmail.dat TNEF
 *   - RFC 2047 encoded-word headers (=?utf-8?B?...?=) — partially handled
 */

export interface ParsedEmail {
  subject: string;
  from: string;
  from_name: string;
  to: string[];
  cc: string[];
  bcc: string[];
  message_id: string;
  in_reply_to: string;
  references: string[];
  date: string;
  text_body: string;
  html_body: string;
}

/** Parse an RFC822 / MIME message source into structured fields. */
export function parseRfc822(raw: string): ParsedEmail {
  if (!raw) return emptyParsed();
  // Normalize line endings to \r\n for consistent header parsing.
  const normalized = raw.replace(/\r?\n/g, "\r\n");
  const separatorIndex = findFirstEmptyLine(normalized);
  const headerBlock = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized;
  const body = separatorIndex >= 0 ? normalized.slice(separatorIndex + 4) : "";

  const headers = parseHeaders(headerBlock);
  const subject = decodeMimeHeader(headers.get("subject") ?? "");
  const from = decodeMimeHeader(headers.get("from") ?? "");
  const { address: fromAddress, name: fromName } = splitAddress(from);
  const to = splitAddressList(decodeMimeHeader(headers.get("to") ?? ""));
  const cc = splitAddressList(decodeMimeHeader(headers.get("cc") ?? ""));
  const bcc = splitAddressList(decodeMimeHeader(headers.get("bcc") ?? ""));
  const messageId = (headers.get("message-id") ?? "").replace(/[<>]/g, "");
  const inReplyTo = (headers.get("in-reply-to") ?? "").replace(/[<>]/g, "");
  const referencesList = (headers.get("references") ?? "")
    .split(/\s+/)
    .map((r) => r.replace(/[<>]/g, ""))
    .filter(Boolean);
  const dateHeader = headers.get("date") ?? "";

  // Extract text_body + html_body from the body, handling multipart MIME.
  const contentType = headers.get("content-type") ?? "text/plain";
  const cte = (headers.get("content-transfer-encoding") ?? "7bit").toLowerCase();
  const { textBody, htmlBody } = extractBodies(body, contentType, cte);

  return {
    subject: subject || "(No subject)",
    from: fromAddress,
    from_name: fromName,
    to,
    cc,
    bcc,
    message_id: messageId,
    in_reply_to: inReplyTo,
    references: referencesList,
    date: dateHeader,
    text_body: textBody,
    html_body: htmlBody,
  };
}

function emptyParsed(): ParsedEmail {
  return {
    subject: "(No subject)",
    from: "",
    from_name: "",
    to: [],
    cc: [],
    bcc: [],
    message_id: "",
    in_reply_to: "",
    references: [],
    date: "",
    text_body: "",
    html_body: "",
  };
}

/** Find the index of the first \r\n\r\n (header/body separator). */
function findFirstEmptyLine(text: string): number {
  const re = /\r\n\r\n/;
  const m = re.exec(text);
  return m ? m.index : -1;
}

/**
 * Parse RFC822 headers into a lowercase-keyed Map. Handles header folding
 * (continuation lines starting with whitespace are joined to the previous
 * header value).
 */
function parseHeaders(headerBlock: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = headerBlock.split("\r\n");
  let currentKey = "";
  let currentValue = "";
  for (const line of lines) {
    // Continuation line: starts with whitespace → append to previous header.
    if (/^\s/.test(line)) {
      currentValue += " " + line.trim();
      continue;
    }
    // New header: save the previous one, start a new one.
    if (currentKey) result.set(currentKey.toLowerCase(), currentValue.trim());
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) {
      currentKey = "";
      currentValue = "";
      continue;
    }
    currentKey = line.slice(0, colonIdx).trim();
    currentValue = line.slice(colonIdx + 1).trim();
  }
  if (currentKey) result.set(currentKey.toLowerCase(), currentValue.trim());
  return result;
}

/**
 * Decode RFC 2047 encoded-word headers (=?charset?encoding?encoded?=).
 * Example: =?utf-8?B?SGVsbG8=?= → "Hello"
 */
function decodeMimeHeader(value: string): string {
  if (!value) return "";
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g,
    (_match, _charset, encoding, encoded) => {
      try {
        if (encoding.toLowerCase() === "b") {
          // Base64
          const buf = Buffer.from(encoded, "base64");
          return buf.toString("utf-8");
        }
        // Quoted-Printable
        const decoded = encoded
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_match: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        return decoded;
      } catch {
        return encoded;
      }
    },
  );
}

/** Parse RFC5322 address-list into an array of bare email addresses. */
function splitAddressList(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const angleMatch = part.match(/<([^>]+)>/);
      if (angleMatch && angleMatch[1]) return angleMatch[1].trim();
      return part;
    })
    .filter(Boolean);
}

/** Split a single RFC5322 address into display name + bare email. */
function splitAddress(value: string): { address: string; name: string } {
  if (!value) return { address: "", name: "" };
  const angleMatch = value.match(/<([^>]+)>/);
  const address = angleMatch && angleMatch[1] ? angleMatch[1].trim() : value.trim();
  const name = angleMatch && angleMatch[1] && angleMatch.index !== undefined
    ? value.slice(0, angleMatch.index).replace(/^["']|["']$/g, "").trim()
    : "";
  return { address, name };
}

/**
 * Extract text/plain and text/html bodies from the message body. For
 * multipart messages, recursively descend to find the first part of
 * each type. For non-multipart, decode based on Content-Transfer-Encoding.
 */
function extractBodies(
  body: string,
  contentType: string,
  cte: string,
): { textBody: string; htmlBody: string } {
  if (!body) return { textBody: "", htmlBody: "" };
  // Parse the top-level Content-Type for boundary or charset.
  const ctParts = contentType.toLowerCase();
  const isMultipart = ctParts.startsWith("multipart/");
  if (!isMultipart) {
    const decoded = decodeBody(body, cte, contentType);
    if (ctParts.includes("text/html")) {
      return { textBody: htmlToText(decoded), htmlBody: decoded };
    }
    // Default: treat as text/plain
    return { textBody: decoded, htmlBody: "" };
  }
  // Multipart — find the boundary and recurse.
  // MIME boundaries are case-sensitive; lowercasing Content-Type corrupts them.
  const boundaryMatch = contentType.match(/boundary\s*=\s*"?([^";\s]+)"?/i);
  if (!boundaryMatch) {
    return { textBody: "", htmlBody: "" };
  }
  const boundary = boundaryMatch[1] ?? "";
  const parts = splitMultipart(body, boundary);
  let textBody = "";
  let htmlBody = "";
  for (const part of parts) {
    const sepIdx = findFirstEmptyLine(part);
    if (sepIdx < 0) continue;
    const partHeaders = parseHeaders(part.slice(0, sepIdx));
    const partBody = part.slice(sepIdx + 4);
    const partCt = partHeaders.get("content-type") ?? "text/plain";
    const partCte = (partHeaders.get("content-transfer-encoding") ?? "7bit").toLowerCase();
    const subResult = extractBodies(partBody, partCt, partCte);
    if (!textBody && subResult.textBody) textBody = subResult.textBody;
    if (!htmlBody && subResult.htmlBody) htmlBody = subResult.htmlBody;
  }
  return { textBody, htmlBody };
}

/** Split a multipart body on the boundary delimiter. */
function splitMultipart(body: string, boundary: string): string[] {
  const parts: string[] = [];
  const delim = "--" + boundary;
  const startIdx = body.indexOf(delim);
  if (startIdx < 0) return parts;
  const rest = body.slice(startIdx + delim.length);
  const segments = rest.split(delim);
  for (const seg of segments) {
    // Skip the closing boundary (starts with --)
    if (seg.startsWith("--")) break;
    // Each segment starts with \r\n (or \n) and ends at the next delim
    const trimmed = seg.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    if (trimmed) parts.push(trimmed);
  }
  return parts;
}

/** Decode transfer-encoded body octets using the declared MIME charset. */
function decodeBody(body: string, cte: string, contentType: string): string {
  if (!body) return "";
  const charset = contentType.match(/charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.[1]
    ?? contentType.match(/charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.[2]
    ?? "utf-8";
  const decode = (bytes: Uint8Array): string => {
    try { return new TextDecoder(charset).decode(bytes); }
    catch { return new TextDecoder("utf-8").decode(bytes); }
  };
  switch (cte.trim().toLowerCase()) {
    case "base64": {
      return decode(Buffer.from(body.replace(/\s+/g, ""), "base64"));
    }
    case "quoted-printable":
    case "quotedprintable": {
      // QP =XX is a BYTE, not a Unicode character. Decoding each =E2, =80,
      // =87 separately as Latin-1 produced mojibake; leaving part headers
      // undecoded displayed the literal =E2=80=87 in the mail reader.
      const unfolded = body.replace(/=\r?\n/g, "");
      const bytes: number[] = [];
      for (let i = 0; i < unfolded.length; i++) {
        const pair = unfolded.slice(i + 1, i + 3);
        if (unfolded[i] === "=" && /^[0-9a-fA-F]{2}$/.test(pair)) {
          bytes.push(parseInt(pair, 16));
          i += 2;
          continue;
        }
        const cp = unfolded.codePointAt(i)!;
        for (const octet of Buffer.from(String.fromCodePoint(cp), "utf8")) bytes.push(octet);
        if (cp > 0xffff) i++;
      }
      return decode(Uint8Array.from(bytes));
    }
    default:
      return body;
  }
}

/** Minimal HTML-to-text conversion for snippet + fallback text_body. */
function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(script|style|head|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
