import type { OperationResult } from '@ai-comms-agent/shared';
import {isInternalChatPlanning} from './internal-planning';

const NO_CONFIRMATION='No saved draft or send request was confirmed for this turn. Check Drafts or Approvals before retrying. No message was sent by this request.';

/** Schedule-tool failure codes that are rejected before any write persists
 * (schema validation, authorization, lookup or plan validation). When the
 * agent self-corrects and a later call of the same operation completes within
 * the same turn, these stale rejections must not be echoed next to the final
 * outcome — they produced contradictory "deleted failed ... deleted" replies. */
const SUPERSEDED_SCHEDULE_FAILURE_CODES=new Set([
  'invalid_input','unknown_tool','tool_not_allowed','permission_denied','context_mismatch',
  'not_found','agent_mismatch','ambiguous_name','invalid_schedule','agent_not_found','authorization_unavailable',
]);

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

function scheduleFailureExplanation(code?:string):string {
  switch(code){
    case 'invalid_input':return 'The schedule reference or timing rule was not usable. Ask the agent to list scheduled tasks and retry with the exact UUID or task name.';
    case 'not_found':return 'No scheduled task matched that reference. Ask the agent to list scheduled tasks and retry with the exact UUID or task name.';
    case 'ambiguous_name':return 'More than one scheduled task has that name; ask the agent to use the exact UUID instead.';
    case 'agent_mismatch':return 'That scheduled task belongs to a different agent.';
    case 'invalid_schedule':return 'The timing rule was invalid; fix the recurrence or one-time fire time and retry.';
    case 'agent_not_found':return 'The agent for this scheduled task no longer exists in this organization.';
    case 'permission_denied':return 'Your current permission does not allow this action.';
    case 'tool_not_allowed':return 'This action is not enabled for the agent.';
    default:return 'The scheduled-task action could not be confirmed. Check [scheduled tasks](/scheduled) before retrying.';
  }
}

function failureExplanation(code?:string,channel?:OperationResult['channel']):string {
  if(channel==='schedule')return scheduleFailureExplanation(code);
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

/** Within one chat turn the agent may first misform a schedule tool call and
 * then self-correct (observed live: delete-by-name rejected as invalid_input,
 * schedules.list, delete-by-UUID). Every attempt yields an OperationResult, but
 * only the final outcome of each logical operation may be reported. A failed
 * schedule attempt is dropped only when (a) a later call of the same operation
 * completed in this turn and (b) its error code proves no mutation was
 * persisted. Business failures (idempotency conflicts, provider errors) and
 * every email/WhatsApp result are never dropped. */
function collapseSupersededScheduleFailures(results:readonly OperationResult[]):readonly OperationResult[] {
  const lastCompleted=new Map<string,number>();
  results.forEach((result,index)=>{
    if(result.channel==='schedule'&&result.state==='completed')lastCompleted.set(result.operation,index);
  });
  if(lastCompleted.size===0)return results;
  return results.filter((result,index)=>{
    if(result.channel!=='schedule'||result.state!=='failed')return true;
    const supersededAt=lastCompleted.get(result.operation);
    if(supersededAt===undefined||supersededAt<index)return true;
    return !SUPERSEDED_SCHEDULE_FAILURE_CODES.has(result.errorCode??'');
  });
}

/** Input is the server-owned current-turn result list, never model text. */
export function formatOperationFeedback(results:readonly OperationResult[]):string {
  if(!results.length)return '';
  return collapseSupersededScheduleFailures(results).map(result=>{
    if(result.channel==='schedule'){
      const what=result.operation==='create'?'Scheduled AI task created':result.operation==='update'?'Scheduled AI task updated':'Scheduled AI task deleted';
      if(result.state==='completed')return `${what}. [Review scheduled tasks](/scheduled). The agent executes the task with its real tools at every fire time; sends follow the agent's approval policy.${result.auditPending?' Activity logging needs reconciliation; check the saved record before retrying.':''}`;
      if(result.state==='failed')return `${what} failed. ${scheduleFailureExplanation(result.errorCode)}`;
      return `Scheduled AI task outcome is ${result.state.replaceAll('_',' ')}. Check [scheduled tasks](/scheduled) before retrying.`;
    }
    const channel=result.channel==='email'?'Email':'WhatsApp';
    if(result.state==='draft_saved')return `Email draft saved. [Review saved drafts](/mail/drafts). No message was sent.${result.auditPending?' Activity logging needs reconciliation; check the saved record before retrying.':''}`;
    if(result.state==='pending_approval')return `${channel} send request is pending human review. ${result.channel==='email'?'[Review approval requests](/mail/approvals)':'[Review WhatsApp requests](/whatsapp)'}. No message was sent.${result.auditPending?' Activity logging needs reconciliation; check the saved record before retrying.':''}`;
    if(result.state==='queued')return `${channel} send ${result.approvalSource==='agent_policy'?"was auto-approved by this agent's autonomous-send policy and is":'is'} queued for delivery. Delivery confirmation follows from the provider; nothing further is required from you.`;
    if(result.state==='failed')return `${channel} ${result.operation==='draft'?'draft':'send request'} failed. ${failureExplanation(result.errorCode,result.channel)}`;
    if(result.state==='outcome_unknown')return `${channel} outcome is unknown. Check the saved record before retrying; delivery is not confirmed.`;
    if(result.state==='provider_accepted')return `${channel} provider accepted the message. Delivery is not confirmed.`;
    if(result.state==='delivered')return 'WhatsApp delivery was confirmed by the provider.';
    return `${channel} request is ${result.state.replaceAll('_',' ')}.`;
  }).join('\n\n');
}

export function currentTurnOperationAnswer(modelText:string,results:readonly OperationResult[],turnId:string,mutationRequested:boolean):string {
  const current=results.filter(result=>result.turnId===turnId && result.callId && result.correlationId);
  const confirmed=formatOperationFeedback(current);
  // A missing-detail question is not a claim that a mutation happened.
  // Preserve bounded, public questions while continuing to reject forged
  // confirmations, private planning and resource IDs from earlier turns.
  const clarification=mutationRequested&&!current.length&&modelText.length<=3000
    &&!containsUnverifiedOperationClaim(modelText)&&!isInternalChatPlanning(modelText)
    &&/\b(?:which|what|could you|can you)\b[^?]{0,400}\?/i.test(modelText)
    &&/\b(?:account|mailbox|sender|recipient|message|e-?mail|repl(?:y|ies)|body|wording)\b/i.test(modelText);
  if(clarification)return `${modelText.trim()}\n\nNo change has been saved and no message has been sent by this request.`;
  return confirmed || (mutationRequested || containsUnverifiedOperationClaim(modelText) ? NO_CONFIRMATION : modelText);
}
