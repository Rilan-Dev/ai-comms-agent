/**
 * Prompt context must respect the same two independent read boundaries as a
 * host tool: the signed-in actor's permission and the agent's saved allowlist.
 * Both inputs are derived by the host, never from an email or model response.
 */
export type AmbientContextChannel = "email" | "whatsapp";
type RegisteredReadTool = { name: string; required_permission: string };

export function canSupplyAmbientContext(
  channel: AmbientContextChannel,
  actorPermissions: ReadonlySet<string>,
  availableTools: readonly RegisteredReadTool[],
): boolean {
  const permission = channel === "email" ? "email.read" : "whatsapp.read";
  if (!actorPermissions.has(permission)) return false;

  return availableTools.some((tool) => (
    tool.required_permission === permission
    && (channel === "email"
      ? tool.name === "email.search" || tool.name === "email.messages.list"
      : tool.name === "whatsapp.history")
  ));
}
