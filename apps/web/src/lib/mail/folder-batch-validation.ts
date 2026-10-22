/**
 * Validate an entire mail folder batch before writing any messages. Silent
 * filtering used to turn a malformed/duplicate selection into a partial
 * mutation while the API still reported an error.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 100;

export function isValidFolderId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isValidFolderBatchIds(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  if (!value.every(isValidFolderId)) return false;
  // UUID equality in PostgreSQL is case insensitive. Avoid double-counting the
  // same logical ID due to different UUID letter casing.
  return new Set(value.map((id: string) => id.toLowerCase())).size === value.length;
}
