/** Fail-closed validation shared by manual draft POST and PATCH.
 * No recipient may be silently dropped or coerced: the stored recipient list is
 * later copied into a human-reviewed approval snapshot.
 */
export type DraftWriteFields = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyText?: string;
};
export type DraftWriteValidation =
  | { ok: true; fields: DraftWriteFields }
  | { ok: false; message: string };

const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function addresses(value: unknown, label: string, nonempty: boolean): string[] | string {
  if (!Array.isArray(value) || value.length > 100 || (nonempty && value.length === 0)) {
    return label + " must be an array of " + (nonempty ? "1–100" : "0–100") + " valid email addresses.";
  }
  const normalized: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return label + " contains an invalid email address.";
    const address = raw.trim().toLowerCase();
    if (address.length > 320 || !ADDRESS.test(address)) return label + " contains an invalid email address.";
    normalized.push(address);
  }
  return normalized;
}
export function validateDraftWrite(body: unknown, mode: "create" | "patch"): DraftWriteValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "A draft payload with editable fields is required." };
  }
  const input = body as Record<string, unknown>;
  const fields: DraftWriteFields = {};
  for (const key of ["to", "cc", "bcc"] as const) {
    if (Object.prototype.hasOwnProperty.call(input, key) || (mode === "create" && key === "to")) {
      const result = addresses(input[key], key, key === "to");
      if (typeof result === "string") return { ok: false, message: result };
      fields[key] = result;
    } else if (mode === "create") {
      fields[key] = [];
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "subject")) {
    if (typeof input.subject !== "string" || input.subject.length > 998) {
      return { ok: false, message: "Subject must be text of at most 998 characters." };
    }
    fields.subject = input.subject;
  }
  if (Object.prototype.hasOwnProperty.call(input, "bodyText")) {
    if (typeof input.bodyText !== "string" || input.bodyText.length > 100_000) {
      return { ok: false, message: "Draft body must be text of at most 100000 characters." };
    }
    // Preserve exact whitespace and user content for the subsequent review.
    fields.bodyText = input.bodyText;
  }
  if (Object.keys(fields).length === 0) {
    return { ok: false, message: "Choose at least one editable draft field." };
  }
  return { ok: true, fields };
}
