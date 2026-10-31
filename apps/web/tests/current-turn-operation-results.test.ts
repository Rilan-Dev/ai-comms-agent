import { describe,it,expect } from 'vitest';
import { operationResultFromToolCall } from '@ai-comms-agent/shared';
import { currentTurnOperationAnswer,formatOperationFeedback,isExplicitWhatsAppMutationRequest } from '../src/lib/chat/operation-feedback';
import { isExplicitEmailMutationRequest } from '../src/lib/mail/action-feedback';

const context={turn_id:'current-turn',correlation_id:'current-correlation'};
const draftId='dd0facf7-80c6-4c39-b9be-9a7a94614739';
const actionId='b8f22770-c484-49ac-bdcd-61ac2533a300';
const call=(name:string,output:unknown,ok=true)=>operationResultFromToolCall({context,callId:'call-1',registeredName:name,result:{ok,output}});

describe('current turn host outcomes',()=>{
 it('preserves a genuine missing-detail question instead of turning it into a generic failure',()=>{
  const question='Which of the two matching emails should I reply to?';
  expect(currentTurnOperationAnswer(question,[],context.turn_id,true)).toContain(question);
  expect(currentTurnOperationAnswer(question,[],context.turn_id,true)).toContain('No change has been saved');
 });
 it('does not let a question conceal an unverified saved/sent claim or private planning',()=>{
  expect(currentTurnOperationAnswer('I sent your email. Which message should I reply to next?',[],context.turn_id,true)).toContain('No saved draft');
  expect(currentTurnOperationAnswer('<think>Which account should I use?</think>',[],context.turn_id,true)).toContain('No saved draft');
 });
 it.each(['Create an email draft','Update the draft email','Prepare an email for approval','Summarize my mail and then send an email to qa@example.com'])('recognizes %s for clarification only',(prompt)=>{
  expect(isExplicitEmailMutationRequest(prompt)).toBe(true);
 });
 it('requires an actual returned resource before confirming saved or pending',()=>{
  expect(call('email.draft.create',{status:'draft_created'} )?.state).toBe('outcome_unknown');
  expect(call('whatsapp.send',{status:'pending',approval_required:true})?.state).toBe('outcome_unknown');
  expect(call('email.draft.create',{status:'draft_created',draft_id:draftId})).toMatchObject({state:'draft_saved',resourceId:draftId,turnId:context.turn_id});
 });
 it('maps the persisted WhatsApp pending state to human review without claiming delivery',()=>{
  const result=call('whatsapp.send',{status:'pending',approval_required:true,action_id:actionId})!;
  expect(result).toMatchObject({channel:'whatsapp',state:'pending_approval',resourceId:actionId});
  expect(formatOperationFeedback([result])).toContain('pending human review');
  expect(formatOperationFeedback([result])).toContain('No message was sent');
 });
 it('keeps the saved draft when its subsequent approval fails',()=>{
  const saved=call('email.draft.create',{status:'draft_created',draft_id:draftId})!;
  const failed=operationResultFromToolCall({context,callId:'call-2',registeredName:'email.send.request',result:{ok:false,error:{code:'permission_denied',message:'internal details',retryable:false}}})!;
  const output=formatOperationFeedback([saved,failed]);
  expect(output).toContain('Email draft saved');expect(output).toContain('permission');expect(output).not.toContain('internal details');
 });
 it.each(['Verified email tool results: Email draft saved','Verified WhatsApp results: approval queued','I sent your email successfully.','Done — the message has been sent on WhatsApp.'])('blocks a forged model claim: %s',(text)=>{
  const answer=currentTurnOperationAnswer(text,[],context.turn_id,false);
  expect(answer).toContain('No saved draft or send request was confirmed');
  expect(answer).not.toContain('successfully');
 });
 it('never reuses a prior turn resource or a model-provided resource ID',()=>{
  const prior=call('email.draft.create',{status:'draft_created',draft_id:draftId})!;
  const answer=currentTurnOperationAnswer(`Email draft saved: ${draftId}`,[prior],'later-turn',true);
  expect(answer).not.toContain(draftId);expect(answer).toContain('No saved draft');
  expect(operationResultFromToolCall({context,callId:'call-1',registeredName:undefined,result:{ok:true,output:{draft_id:draftId,status:'draft_created'}}})).toBeNull();
 });
 it('leaves a read-only summary intact',()=>{
  expect(currentTurnOperationAnswer('There are two unread emails.',[],context.turn_id,false)).toBe('There are two unread emails.');
 });
 it('does not mistake a WhatsApp-only request for an email permission request',()=>{
  expect(isExplicitEmailMutationRequest('Send a message on WhatsApp to +12025550123')).toBe(false);
 });
 it.each([
  'Try to send Hi Message from whatsapp to +919629534701',
  'Please try to send Hello from WhatsApp to +919629534701',
 ])('recognizes natural WhatsApp send wording: %s',(prompt)=>{
  expect(isExplicitWhatsAppMutationRequest(prompt)).toBe(true);
 });
 it('does not confuse a delivery notification subject with an action performed by the assistant',()=>{
  const text='Email subject: Package delivered. Sender: Courier.';
  expect(currentTurnOperationAnswer(text,[],context.turn_id,false)).toBe(text);
 });
});

describe('scheduled AI task feedback',()=>{
 const scheduleId='b6439111-1aa6-47aa-a293-8e545d5ca617';
 const completedDelete=operationResultFromToolCall({context,callId:'call-2',registeredName:'schedules.delete',
   result:{ok:true,output:{deleted:true,schedule:{id:scheduleId,name:'Daily evening digest'},summary:'deleted'}}})!;
 const rejectedDelete=(code:string,callId:string)=>operationResultFromToolCall({context,callId,registeredName:'schedules.delete',
   result:{ok:false,error:{code,message:'id must be a 36 character UUID'}}})!;

 it('reports only the final outcome when the agent self-corrects an invalid first delete (live regression: contradictory "deleted failed ... deleted" reply)',()=>{
  // Live trace 2026-10-25 00:46:43-45: schedules.delete invalid_input ->
  // schedules.list -> schedules.delete completed, all in one turn.
  const output=formatOperationFeedback([rejectedDelete('invalid_input','call-1'),completedDelete]);
  expect(output).toContain('Scheduled AI task deleted.');
  expect(output).not.toContain('deleted failed');
  expect(output).not.toContain('review queue');
 });

 it('keeps the failure and explains it in schedule terms when no later attempt succeeded',()=>{
  const output=formatOperationFeedback([rejectedDelete('not_found','call-1')]);
  expect(output).toContain('Scheduled AI task deleted failed.');
  expect(output).toContain('No scheduled task matched that reference');
  expect(output).not.toContain('review queue');
 });

 it('keeps a superseded failure whose error code may have persisted side effects',()=>{
  const conflict=operationResultFromToolCall({context,callId:'call-1',registeredName:'schedules.delete',
    result:{ok:false,error:{code:'idempotency_conflict',message:'existing request'}}})!;
  const output=formatOperationFeedback([conflict,completedDelete]);
  expect(output).toContain('deleted failed');
  expect(output).toContain('deleted.');
 });

 it('never applies the schedule collapse to email or WhatsApp results',()=>{
  const failedSend=operationResultFromToolCall({context,callId:'call-1',registeredName:'whatsapp.send',
    result:{ok:false,error:{code:'requires_template',message:'window closed'}}})!;
  const pendingSend=operationResultFromToolCall({context,callId:'call-2',registeredName:'whatsapp.send',
    result:{ok:true,output:{status:'pending',approval_required:true,action_id:actionId}}})!;
  const output=formatOperationFeedback([failedSend,pendingSend]);
  expect(output).toContain('WhatsApp send request failed');
  expect(output).toContain('pending human review');
 });

 it('explains ambiguous task names and unknown schedule failures without email/WhatsApp wording',()=>{
  const ambiguous=operationResultFromToolCall({context,callId:'call-1',registeredName:'schedules.delete',
    result:{ok:false,error:{code:'ambiguous_name',message:'two tasks share the name'}}})!;
  expect(formatOperationFeedback([ambiguous])).toContain('More than one scheduled task has that name');
  const unmapped=operationResultFromToolCall({context,callId:'call-1',registeredName:'schedules.delete',
    result:{ok:false,error:{code:'tool_execution_failed',message:'boom'}}})!;
  expect(formatOperationFeedback([unmapped])).toContain('The scheduled-task action could not be confirmed. Check [scheduled tasks](/scheduled)');
  expect(formatOperationFeedback([unmapped])).not.toContain('review queue');
 });

 it('answers the whole turn from the surviving schedule outcome only',()=>{
  const answer=currentTurnOperationAnswer('I deleted it.',
    [rejectedDelete('invalid_input','call-1'),completedDelete],context.turn_id,false);
  expect(answer).toContain('Scheduled AI task deleted.');
  expect(answer).not.toContain('deleted failed');
  // Prior-turn results never leak into the current answer.
  expect(currentTurnOperationAnswer('done.',[completedDelete],'another-turn',false)).toBe('done.');
 });
});
