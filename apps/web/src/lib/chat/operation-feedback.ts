import type { OperationResult } from '@ai-comms-agent/shared';

const NO_CONFIRMATION='No saved draft or send request was confirmed for this turn. Check Drafts or Approvals before retrying. No message was sent by this request.';

export function isExplicitWhatsAppMutationRequest(text:string):boolean {
  return /\bwhatsapp\b/i.test(text) && ( /^(?:(?:please|kindly)\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:send|message|reply|create|prepare|request)\b/i.test(text.trim())
    || /\b(?:and\s+then|then|also|and|want\s+to|need\s+you\s+to)\s+(?:send|message|reply|create|prepare|request)\b/i.test(text));
}

export function containsUnverifiedOperationClaim(text:string):boolean {
  return /\bverified\s+(?:email|whatsapp|messaging)(?:\s+tool)?\s+results\b/i.test(text)
    || /\b(?:draft|approval request)\s+(?:(?:was|is|has been)\s+)?(?:saved|created|updated|queued|submitted|pending)\b/i.test(text)
    || /\b(?:email|e-mail|whatsapp message|message)\s+(?:(?:was|is|has been)\s+)(?:sent|delivered|queued|submitted)\b/i.test(text)
    || /\b(?:I|we)(?:['’]ve|\s+have)?\s+(?:successfully\s+)?(?:saved|created|updated|sent|delivered|queued|submitted)\b[^.!?\n]{0,100}\b(?:email|e-mail|draft|whatsapp|message|approval)\b/i.test(text);
}

function failureExplanation(code?:string):string {
  switch(code){
    case 'body_review_required':return 'Please review the intended email body and put it in quotes or a fenced text block after Body:. Keep sending and approval instructions outside the body. No draft or approval was saved.';
    case 'recipient_required':return 'Provide or select the exact recipient email address before saving.';
    case 'invalid_account':return 'Choose the connected From mailbox before saving.';
    case 'account_selection_required':return 'Choose one WhatsApp account by its visible label or phone number in Channels.';
    case 'permission_denied':return 'Your current permission does not allow this action.';
    case 'tool_not_allowed':return 'This action is not enabled for the agent.';
    case 'account_not_available':case 'account_not_bound':return 'Choose a connected account available to this agent.';
    case 'approval_required':return 'Separate human approval is required.';
    case 'template_not_approved':case 'requires_template':return 'An approved WhatsApp template or an active customer-service window is required.';
    case 'idempotency_conflict':case 'email_action_conflict':return 'Review the existing request before retrying; no new request was saved.';
    default:return 'The action could not be confirmed. Check the account and review queue before retrying.';
  }
}

/** Input is the server-owned current-turn result list, never model text. */
export function formatOperationFeedback(results:readonly OperationResult[]):string {
  if(!results.length)return '';
  return results.map(result=>{
    const channel=result.channel==='email'?'Email':'WhatsApp';
    if(result.state==='draft_saved')return `Email draft saved. [Review saved drafts](/mail/drafts). No message was sent.${result.auditPending?' Activity logging needs reconciliation; check the saved record before retrying.':''}`;
    if(result.state==='pending_approval')return `${channel} send request is pending human review. ${result.channel==='email'?'[Review approval requests](/mail/approvals)':'[Review WhatsApp requests](/whatsapp)'}. No message was sent.${result.auditPending?' Activity logging needs reconciliation; check the saved record before retrying.':''}`;
    if(result.state==='failed')return `${channel} ${result.operation==='draft'?'draft':'send request'} failed. ${failureExplanation(result.errorCode)}`;
    if(result.state==='outcome_unknown')return `${channel} outcome is unknown. Check the saved record before retrying; delivery is not confirmed.`;
    if(result.state==='provider_accepted')return `${channel} provider accepted the message. Delivery is not confirmed.`;
    if(result.state==='delivered')return 'WhatsApp delivery was confirmed by the provider.';
    return `${channel} request is ${result.state.replaceAll('_',' ')}.`;
  }).join('\n\n');
}

export function currentTurnOperationAnswer(modelText:string,results:readonly OperationResult[],turnId:string,mutationRequested:boolean):string {
  const current=results.filter(result=>result.turnId===turnId && result.callId && result.correlationId);
  const confirmed=formatOperationFeedback(current);
  return confirmed || (mutationRequested || containsUnverifiedOperationClaim(modelText) ? NO_CONFIRMATION : modelText);
}
