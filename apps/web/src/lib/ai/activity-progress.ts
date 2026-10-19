/**
 * Public, truthful agent activity labels. These are operational milestones,
 * never a representation of private model reasoning or raw tool arguments.
 */
export type AgentActivityPhase =
  | "preparing" | "planning_tools" | "reading_email" | "reading_whatsapp"
  | "checking_permissions" | "generating" | "streaming" | "completed"
  | "denied" | "failed";

export function agentActivityLabel(phase: AgentActivityPhase): string {
  switch (phase) {
    case "preparing": return "Preparing your request";
    case "planning_tools": return "Selecting available tools";
    case "reading_email": return "Reading permitted email";
    case "reading_whatsapp": return "Checking permitted WhatsApp messages";
    case "checking_permissions": return "Checking permissions and approvals";
    case "generating": return "Generating the answer";
    case "streaming": return "Writing the answer as it arrives";
    case "completed": return "Response complete";
    case "denied": return "Action needs approval or permission";
    case "failed": return "A step could not complete";
  }
}
export function safeActivityPhase(value: unknown): AgentActivityPhase | null {
  const allowed: AgentActivityPhase[] = [
    "preparing", "planning_tools", "reading_email", "reading_whatsapp",
    "checking_permissions", "generating", "streaming", "completed", "denied", "failed",
  ];
  return typeof value === "string" && allowed.includes(value as AgentActivityPhase)
    ? value as AgentActivityPhase : null;
}
