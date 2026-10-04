import type { CapabilitySet, EmailProviderCapability } from "./provider";

export const EMAIL_CAPABILITIES: readonly EmailProviderCapability[] = [
  "folders","labels","sync_incremental","sync_full","sync_webhook","sync_idle",
  "search_server_side","search_client_side","drafts","reply","forward","mark_read",
  "archive","move","threads","attachments_download","attachments_upload","send",
] as const;

export function emptyCapabilitySet(): CapabilitySet {
  return Object.fromEntries(EMAIL_CAPABILITIES.map((name) => [name, false])) as CapabilitySet;
}

export function normalizeCapabilitySet(input: Partial<CapabilitySet>): CapabilitySet {
  return Object.fromEntries(
    EMAIL_CAPABILITIES.map((name) => [name, input[name] === true]),
  ) as CapabilitySet;
}

export function assertCapability(capabilities: CapabilitySet, capability: EmailProviderCapability): void {
  if (!capabilities[capability]) {
    throw new Error(`Email capability not supported: ${capability}`);
  }
}
