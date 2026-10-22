/** Read-only diagnostics for four independent email gates.
 * Agent tool selections never grant the authenticated actor email.write.
 * This function only describes eligibility; real provider capability,
 * account binding, policy and user rights are rechecked by the tool executor.
 */
export type MailComposeBlockerCode =
  | "missing_email_write"
  | "draft_tool_disabled"
  | "send_request_tool_disabled"
  | "no_bound_primary_mailbox"
  | "provider_drafts_unsupported"
  | "provider_send_unsupported";

export type MailComposeBlocker = {
  code: MailComposeBlockerCode;
  message: string;
};

export function mailComposeReadiness(input: {
  actorCanWrite: boolean;
  draftToolEnabled: boolean;
  sendRequestToolEnabled: boolean;
  hasBoundPrimaryMailbox: boolean;
  providerCanDraft: boolean;
  providerCanSend: boolean;
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
  if (input.hasBoundPrimaryMailbox && !input.providerCanDraft) blockers.push({
    code: "provider_drafts_unsupported",
    message: "This connected mailbox cannot save provider-backed drafts. Check the provider's discovered drafts capability.",
  });
  if (input.hasBoundPrimaryMailbox && !input.providerCanSend) blockers.push({
    code: "provider_send_unsupported",
    message: "This connected mailbox does not support sending. Send approval is unavailable for this mailbox.",
  });
  const canDraft = input.actorCanWrite && input.draftToolEnabled && input.hasBoundPrimaryMailbox && input.providerCanDraft;
  const canRequestApproval = input.actorCanWrite && input.sendRequestToolEnabled && input.hasBoundPrimaryMailbox
    && input.providerCanDraft && input.providerCanSend;
  return { canDraft, canRequestApproval, blockers };
}


/** When several assigned accounts are connected, start with the one able to
 * complete the whole reviewed draft -> approval-request workflow. An earlier
 * drafts-only account must not hide a later fully capable mailbox.
 * This is only a UI/default choice; the host reauthorizes every operation. */
export function selectPreferredComposeMailbox<T extends {
  canDraft: boolean;
  canRequestApproval: boolean;
}>(choices: readonly T[]): T | undefined {
  return choices.find(choice => choice.canDraft && choice.canRequestApproval)
    ?? choices.find(choice => choice.canDraft)
    ?? choices[0];
}
