/**
 * Only the WhatsApp tools actually registered by the host runtime appear here.
 * Selecting a tool changes local editor state only until an authorized admin
 * reviews and saves policy. It never grants actor RBAC, connects an account,
 * approves a message, or sends anything through Meta.
 */
export const WHATSAPP_POLICY_CHOICES = [
  {
    name: "whatsapp.history",
    label: "Read WhatsApp messages",
    detail: "Read recent messages from this agent's connected WhatsApp account, subject to whatsapp.read.",
    group: "read",
  },
  {
    name: "whatsapp.send",
    label: "Prepare WhatsApp sends",
    detail: "Prepare send requests using the sending mode. Requires your sending permission and an assigned connected phone; Meta rules still apply.",
    group: "approval",
  },
] as const;

export function whatsappPolicyReadiness(input: {
  allowedTools: readonly string[];
  bound: boolean;
  connected: boolean;
}): { canRead: boolean; canRequestSend: boolean; blockers: string[] } {
  const enabled = new Set(input.allowedTools);
  const blockers: string[] = [];
  if (!input.bound) blockers.push("No WhatsApp account bound");
  if (!input.connected) blockers.push("No connected WhatsApp account");
  if (!enabled.has("whatsapp.send")) blockers.push("WhatsApp send approval tool not enabled");
  return {
    canRead: input.bound && input.connected && enabled.has("whatsapp.history"),
    canRequestSend: input.bound && input.connected && enabled.has("whatsapp.send"),
    blockers,
  };
}
