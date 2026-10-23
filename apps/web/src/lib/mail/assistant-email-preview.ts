/** Only reuse explicit user-facing assistant draft fields as an editable preview.
 * This is not authorization, a persisted draft, or permission to send. */
export function assistantEmailPreview(raw: string): { subject: string; body: string } | null {
  if (typeof raw !== "string" || raw.length > 16000 || !raw.trim()) return null;
  // Host denials and private planning must never become recipient-visible mail.
  if (/Security check|No email draft or send-approval request|No email was sent|I should not hallucinate|<\/?think/i.test(raw)) return null;
  const subjectMatch = raw.match(/^\s*(?:\*\*)?Subject:(?:\*\*)?\s*(.+)\s*$/im);
  const bodyMatch = raw.match(/^\s*(?:\*\*)?Body:(?:\*\*)?[ \t]*\r?\n([\s\S]+)$/im);
  if (!subjectMatch || !bodyMatch || bodyMatch.index === undefined
      || subjectMatch.index === undefined || subjectMatch.index >= bodyMatch.index) return null;
  const subject = subjectMatch[1]?.trim().replace(/\*\*$/, "").trim() ?? "";
  const body = bodyMatch[1]?.trim() ?? "";
  if (!subject || subject.length > 998 || !body || body.length > 15000) return null;
  return { subject, body };
}
