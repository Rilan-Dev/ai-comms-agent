import type { EmailToolDescriptor } from "@ai-comms-agent/shared";

export type EmailAgentPolicy = { allowedTools: readonly string[] } | null | undefined;

/** Use with a freshly loaded policy on every invocation; null/missing policy denies. */
export function isEmailToolAllowedByPolicy(policy: EmailAgentPolicy, toolName: string): boolean {
  return Boolean(policy?.allowedTools.includes(toolName));
}

export function hasEmailToolCapabilities(
  descriptor: Pick<EmailToolDescriptor, "required_capabilities" | "any_capabilities">,
  capabilities: Record<string, boolean>,
): boolean {
  if (descriptor.required_capabilities.some((capability) => capabilities[capability] !== true)) return false;
  if (descriptor.any_capabilities?.length && !descriptor.any_capabilities.some((capability) => capabilities[capability] === true)) return false;
  return true;
}
