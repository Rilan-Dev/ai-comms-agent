/** Preserve the exact user-reviewed content of an email body.
 * Trimming, normalizing or silently slicing a draft can change what gets
 * approved and eventually sent. Limits are enforced by the shared tool schema
 * and here as a defensive boundary for non-tool callers.
 */
export function preserveEmailBody(value: unknown, maxLength = 100_000): string {
  if (typeof value !== "string") return "";
  if (value.length > maxLength) {
    throw new RangeError("Email body exceeds the maximum permitted length.");
  }
  return value;
}
