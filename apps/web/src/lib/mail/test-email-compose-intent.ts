/**
 * UI-only shortcut for the bounded demo/test-email phrasing.
 * A match opens a local draft review. No provider calls, policies or approvals
 * can be inferred from the text; those remain at the host tool executor.
 */
export function parseTestEmailComposeRequest(raw: string): string | null {
  if (raw.length > 500) return null;
  const email = "([A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})";
  const expressions = [
    new RegExp("^(?:please\\s+)?(?:send|draft|write|compose)\\s+(?:(?:a|the)\\s+)?test\\s+email\\s+to\\s+" + email + "(?:\\s+for\\s+test\\s+email)?[.!]?$", "i"),
    new RegExp("^(?:please\\s+)?(?:send|draft|write|compose)\\s+(?:(?:a|the)\\s+)?email\\s+to\\s+" + email + "\\s+for\\s+test\\s+email[.!]?$", "i"),
  ];
  for (const expression of expressions) {
    const match = raw.trim().match(expression);
    if (match?.[1]) return match[1];
  }
  return null;
}


/**
 * Identify the ONE exact To address that the user explicitly supplied in a
 * direct outgoing email instruction. This only prefills a review form: no
 * mailbox selection, tool invocation or sending happens here.
 */
export function explicitComposeRecipient(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 900) return null;
  // Standalone for Node strip-types and browser compilation: accept only
  // direct outgoing commands, never informational questions about email.
  if (!/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:send|draft|write|compose|email)\b/i.test(raw.trim())) return null;
  const matches = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  if (matches.length !== 1) return null;
  const exactAddress = matches[0]!;
  const toMatch = raw.match(/\bto\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
  return toMatch?.[1]?.toLowerCase() === exactAddress.toLowerCase() ? exactAddress : null;
}
