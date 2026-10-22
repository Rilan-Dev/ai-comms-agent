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
