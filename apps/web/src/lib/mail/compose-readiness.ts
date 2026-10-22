/** Read-only diagnostics for four independent email gates.
 * Agent tool selections never grant the authenticated actor email.write.
 * This function only describes eligibility; real provider capability,
 * account binding, policy and user rights are rechecked by the tool executor.
 */
export type MailComposeBlockerCode =
  | "missing_email_write"
  | "draft_tool_disabled"
  | "send_request_tool_disabled"
  | "no_bound_primary_mailbox";

export type MailComposeBlocker = {
  code: MailComposeBlockerCode;
  message: string;
};

export function mailComposeReadiness(input: {
  actorCanWrite: boolean;
  draftToolEnabled: boolean;
  sendRequestToolEnabled: boolean;
  hasBoundPrimaryMailbox: boolean;
}): { canDraft: boolean; canRequestApproval: boolean; blockers: MailComposeBlocker[] } {
  const blockers: MailComposeBlocker[] = [];
  if (!input.actorCanWrite) blockers.push({
    code: "missing_email_write",
    message: "Your signed-in organization role does not grant email.write. Selecting agent tool permissions cannot grant this user permission; a separately authorized role-permission change is required.",
  });
  if (!input.draftToolEnabled) blockers.push({
    code: "draft_tool_disabled",
    message: "This agent's saved policy does not enable Create drafts. An organization administrator must enable and save the Draft mail permission.",
  });
  if (!input.sendRequestToolEnabled) blockers.push({
    code: "send_request_tool_disabled",
    message: "This agent's saved policy does not enable Request sending approval. An organization administrator must enable and save it.",
  });
  if (!input.hasBoundPrimaryMailbox) blockers.push({
    code: "no_bound_primary_mailbox",
    message: "No connected primary mailbox is assigned to this agent. Assign a connected mailbox under Agent Channels.",
  });
  const canDraft = input.actorCanWrite && input.draftToolEnabled && input.hasBoundPrimaryMailbox;
  const canRequestApproval = input.actorCanWrite && input.sendRequestToolEnabled && input.hasBoundPrimaryMailbox;
  return { canDraft, canRequestApproval, blockers };
}
