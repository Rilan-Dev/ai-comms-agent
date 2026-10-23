import { PostgresIdentityRepository } from "@ai-comms-agent/db";
import { asOrganizationId, asUserId } from "@ai-comms-agent/shared";

/** Recheck grants immediately before credential access. A past approval
 * cannot retain authority after the requester or approver is revoked. */
export async function assertCurrentEmailActionAuthorization(action: {
  organizationId: string; requestedBy: string | null; approvedBy: string | null;
}) {
  if (!action.requestedBy || !action.approvedBy) throw new Error("Email action authorization is no longer valid");
  const repository = new PostgresIdentityRepository();
  const organizationId = asOrganizationId(action.organizationId);
  for (const [actor, permission] of [
    [action.requestedBy, "email.write"], [action.approvedBy, "organization.update"],
  ] as const) {
    const membership = await repository.getMembership(organizationId, asUserId(actor));
    if (!membership || membership.status !== "active") throw new Error("Email action authorization is no longer valid");
    const permissions = await repository.getPermissionsForRole(organizationId, membership.role);
    if (!permissions.includes(permission)) throw new Error("Email action authorization is no longer valid");
  }
}
