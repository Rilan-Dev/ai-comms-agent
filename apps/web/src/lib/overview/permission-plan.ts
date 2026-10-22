/**
 * Overview can aggregate multiple protected datasets into one response.
 * Every dataset keeps its own RBAC boundary even when organization.read
 * permits visiting the Overview page.
 */
export function planOverviewRead(permissions: ReadonlySet<string>): {
  agents: boolean;
  mail: boolean;
  approvals: boolean;
  audit: boolean;
} {
  return {
    agents: permissions.has("organization.read"),
    mail: permissions.has("email.read"),
    approvals: permissions.has("organization.update"),
    audit: permissions.has("audit.read"),
  };
}
