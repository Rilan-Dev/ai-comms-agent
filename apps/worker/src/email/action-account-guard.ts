/**
 * Revalidate an email account at the approved action's execution boundary.
 * Approval authorizes a request, not use of a mailbox whose connection was
 * revoked or disconnected after approval. The repository getById separately
 * filters soft-deleted accounts.
 */
export function isApprovedEmailActionAccountUsable<T extends { organization_id: string; status: string }>(
  account: T | null | undefined,
  organizationId: string,
): account is T {
  return account?.organization_id === organizationId && account.status === "connected";
}
