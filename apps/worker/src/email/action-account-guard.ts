/**
 * Revalidate an email account at the approved action's execution boundary.
 * Approval authorizes a request, not use of a mailbox whose connection was
 * revoked or disconnected after approval. The repository getById separately
 * filters soft-deleted accounts.
 */
export function isApprovedEmailActionAccountUsable(
  account: { organization_id: string; status: string } | null | undefined,
  organizationId: string,
): boolean {
  return account?.organization_id === organizationId && account.status === "connected";
}
