import { describe,it,expect } from 'vitest';
import { operationResultFromToolCall } from '@ai-comms-agent/shared';
import { currentTurnOperationAnswer,formatOperationFeedback } from '../src/lib/chat/operation-feedback';
import { isExplicitEmailMutationRequest } from '../src/lib/mail/action-feedback';

const context={turn_id:'current-turn',correlation_id:'current-correlation'};
const draftId='dd0facf7-80c6-4c39-b9be-9a7a94614739';
const actionId='b8f22770-c484-49ac-bdcd-61ac2533a300';
const call=(name:string,output:unknown,ok=true)=>operationResultFromToolCall({context,callId:'call-1',registeredName:name,result:{ok,output}});

describe('current turn host outcomes',()=>{
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
 it('does not confuse a delivery notification subject with an action performed by the assistant',()=>{
  const text='Email subject: Package delivered. Sender: Courier.';
  expect(currentTurnOperationAnswer(text,[],context.turn_id,false)).toBe(text);
 });
});
