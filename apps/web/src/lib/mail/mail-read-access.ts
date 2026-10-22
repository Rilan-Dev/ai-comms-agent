import { asOrganizationId } from "@ai-comms-agent/shared";
import type { MembershipRole } from "@ai-comms-agent/shared";
import { getIdentityRepository } from "@/lib/identity/repository";

/**
 * Mail page SSR reads bypass the JSON API routes. Resolve the effective
 * persisted role permissions before querying or rendering mailbox content.
 * A viewer's organization.read grant is NOT a grant to read private email.
 */
export async function canReadOrganizationMail(
  organizationId: string,
  role: MembershipRole,
): Promise<boolean> {
  const permissions = await getIdentityRepository().getPermissionsForRole(
    asOrganizationId(organizationId),
    role,
  );
  return permissions.includes("email.read");
}
