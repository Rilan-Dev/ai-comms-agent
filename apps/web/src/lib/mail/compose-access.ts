/** Display of assigned mailbox addresses is itself privileged information.
 * General organization.read access is not enough to discover mailboxes.
 * These are independent of agent tool allowlists, connection and provider
 * capabilities, all of which remain checked at the host execution boundary.
 */
export function mayDiscoverComposeMailboxes(permissions: ReadonlySet<string>): boolean {
  return permissions.has("email.read") || permissions.has("email.write");
}

/** A draft or send-approval request is a write even though neither sends mail. */
export function mayWriteComposeDraft(permissions: ReadonlySet<string>): boolean {
  return permissions.has("email.write");
}
