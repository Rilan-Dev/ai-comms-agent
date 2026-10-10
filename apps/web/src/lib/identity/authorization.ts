/**
 * Server-side authorization API.
 *
 * Per Phase 3 handoff §12: a small, reusable server-side authorization boundary.
 * Per Phase 3 handoff §13: organization isolation is a critical security boundary.
 * Per SECURITY_MODEL.md §4.3: "authenticated alone is never authorization".
 *
 * Usage:
 *   const subject = await requireOrganizationMember(request, orgId, repo);
 *   requirePermission(subject, "organization.members.read");
 *
 * Or combined:
 *   const subject = await authorize(request, { organizationId, permission: "audit.read" }, repo);
 */

import type {
  User,
  UserId,
  OrganizationId,
  AuthSubject,
  PermissionName,
  MembershipRole,
  IdentityAdapter,
} from "@ai-comms-agent/shared";
import { UnauthorizedError, ForbiddenError } from "@ai-comms-agent/shared";
import type { IdentityRepository } from "@ai-comms-agent/db";

// ============================================================================
// Core authorization functions
// ============================================================================

/**
 * Resolve the authenticated user from a request. Throws UnauthorizedError
 * if not authenticated.
 */
export async function requireAuthenticatedUser(
  request: Request,
  identityAdapter: IdentityAdapter,
): Promise<User> {
  const user = await identityAdapter.resolveUser(request);
  if (!user) {
    throw new UnauthorizedError();
  }
  if (user.status !== "active") {
    throw new UnauthorizedError(`User account is ${user.status}`);
  }
  return user;
}

/**
 * Resolve the organization context and verify the user is an active member.
 * Throws UnauthorizedError if not authenticated.
 * Throws ForbiddenError if the user is not a member or membership is suspended.
 *
 * Per Phase 3 handoff §13: the organizationId is resolved from the URL path,
 * NOT from the request body. This prevents IDOR via body spoofing.
 */
export async function requireOrganizationMember(
  request: Request,
  organizationId: OrganizationId,
  identityAdapter: IdentityAdapter,
  repo: IdentityRepository,
): Promise<AuthSubject> {
  const user = await requireAuthenticatedUser(request, identityAdapter);

  const membership = await repo.getMembership(organizationId, user.id);
  if (!membership) {
    throw new ForbiddenError("not_member", "User is not a member of this organization");
  }
  if (membership.status !== "active") {
    throw new ForbiddenError("suspended", `Membership is ${membership.status}`);
  }

  const permissions = await repo.getPermissionsForRole(organizationId, membership.role);

  return {
    user,
    membership,
    permissions: new Set(permissions),
  };
}

/**
 * Require that the auth subject has a specific permission.
 * Throws ForbiddenError if the permission is missing.
 */
export function requirePermission(subject: AuthSubject, permission: PermissionName): void {
  if (!subject.permissions.has(permission)) {
    throw new ForbiddenError("missing_permission", `Missing permission: ${permission}`);
  }
}

/**
 * Require that the auth subject has at least one of the specified roles.
 * Throws ForbiddenError if none match.
 */
export function requireRole(subject: AuthSubject, ...roles: MembershipRole[]): void {
  if (!subject.membership) {
    throw new ForbiddenError(
      "insufficient_role",
      `Requires one of: ${roles.join(", ")}`,
    );
  }

  // Organization roles are hierarchical for minimum-role guards:
  // owner >= admin >= member. In particular, draft/mail routes requiring
  // "member" must not reject owners or admins.
  const role = subject.membership.role;
  const rank: Record<MembershipRole, number> = { member: 1, admin: 2, owner: 3 };
  const satisfies = roles.some((requiredRole) => rank[role] >= rank[requiredRole]);
  if (!satisfies) {
    throw new ForbiddenError(
      "insufficient_role",
      `Requires one of: ${roles.join(", ")}`,
    );
  }
}

/**
 * Combined authorization: authenticate → resolve org context → check membership → check permission.
 * Returns the AuthSubject on success; throws on failure.
 *
 * This is the recommended entry point for organization-scoped API routes.
 */
export async function authorize(
  request: Request,
  options: {
    organizationId: OrganizationId;
    permission?: PermissionName;
    role?: MembershipRole;
  },
  identityAdapter: IdentityAdapter,
  repo: IdentityRepository,
): Promise<AuthSubject> {
  const subject = await requireOrganizationMember(request, options.organizationId, identityAdapter, repo);

  if (options.permission) {
    requirePermission(subject, options.permission);
  }
  if (options.role) {
    requireRole(subject, options.role);
  }

  return subject;
}

// ============================================================================
// Error → HTTP response helpers
// ============================================================================

import { NextResponse } from "next/server";

export function authorizationErrorToResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: "unauthorized", message: error.message },
      { status: 401 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: "forbidden", reason: error.reason, message: error.message },
      { status: 403 },
    );
  }
  // Unexpected errors: return 500 without leaking internal details.
  // In production, this includes the DevIdentityAdapter production guard
  // throw (which signals a configuration error — dev adapter used in production).
  console.error("[authorization] unexpected error:", error);
  return NextResponse.json(
    { error: "internal_server_error" },
    { status: 500 },
  );
}
