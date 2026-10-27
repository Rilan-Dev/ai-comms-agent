/**
 * Workspace display-name resolution.
 *
 * The web shell (navigation bar, top bar, browser tab) must never fall back to
 * a hard-coded product brand. The displayed name is resolved as:
 *
 *   product_name (when set) -> organization name -> "Workspace"
 */

export const FALLBACK_WORKSPACE_NAME = "Workspace";

export interface WorkspaceBrandingInput {
  productName?: string | null;
  name?: string | null;
}

export function resolveWorkspaceDisplayName(
  organization: WorkspaceBrandingInput | null | undefined,
): string {
  const product = organization?.productName?.trim();
  if (product) return product;
  const name = organization?.name?.trim();
  if (name) return name;
  return FALLBACK_WORKSPACE_NAME;
}

export function workspaceInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "W";
}
