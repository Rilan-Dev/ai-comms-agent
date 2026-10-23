/**
 * Validate *every* email recipient, including CC/BCC and imported draft
 * addresses, before a draft or send-approval request can be persisted.
 *
 * This is intentionally pure: no provider, tenant, UI, or permission bypass.
 * Null means invalid; [] is valid only for optional CC/BCC fields.
 */
export function normalizeEmailRecipients(value: unknown, required: boolean): string[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const addresses: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const address = item.trim();
    // One bare mailbox only: reject list separators, display names, quoted
    // header syntax, backslashes and control/whitespace characters.
    if (!address || address.length > 320 || !/^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]+$/.test(address)) {
      return null;
    }
    addresses.push(address);
  }
  return required && addresses.length === 0 ? null : addresses;
}
