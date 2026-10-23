/**
 * A host reply/forward request must refer to a locally persisted source row.
 * The approved action's messageId is the tenant-scoped PostgreSQL UUID;
 * provider_message_id is only used by the worker after resolving that row.
 *
 * Missing/unsynchronized/local-draft/cross-mailbox rows cannot be used as
 * provider reply/forward sources. This is a pure validation helper, not an
 * authorization grant: caller and worker independently check RBAC and tenant.
 */
/** PostgreSQL email_messages.id is a UUID, not a provider_message_id.
 * Validate the boundary before issuing a UUID-typed SQL comparison. */
export function isLocalEmailMessageId(id: unknown): id is string {
  return typeof id === "string"
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}

export function eligibleReplyForwardSourceId(source: unknown, accountId: string): string | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const row = source as Record<string, unknown>;
  if (row.email_account_id !== accountId || row.is_draft !== false) return null;
  const id = row.id;
  const providerId = row.provider_message_id;
  if (!isLocalEmailMessageId(id)) return null;
  if (typeof providerId !== "string" || !providerId.trim()
      || providerId.startsWith("local-draft:")) return null;
  return id;
}
