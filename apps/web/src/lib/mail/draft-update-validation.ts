/**
 * A draft PATCH must contain an actual editable field. Otherwise the database
 * repository used to return an arbitrary organization-scoped message for a
 * zero-column update, exposing read data to an email.write-only caller.
 *
 * Check field types rather than key presence; a wrong-typed field is ignored
 * by the legacy write shape and therefore cannot count as an update.
 */
export function hasDraftChanges(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return Array.isArray(value.to)
    || Array.isArray(value.cc)
    || Array.isArray(value.bcc)
    || typeof value.subject === "string"
    || typeof value.bodyText === "string";
}
