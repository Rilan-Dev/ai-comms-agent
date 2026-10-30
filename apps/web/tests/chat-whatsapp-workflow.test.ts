import {describe,it,expect} from 'vitest';
import {parseWorkflowCommand,readWhatsAppWidget,workflowStatusLabel,canEditWorkflow,isWhatsAppSetupRequest} from '../src/lib/chat/whatsapp-workflow-contract';

describe('WhatsApp conversation workflow contract',()=>{
 it('rejects model-defined commands and extra authority fields',()=>{
  expect(parseWorkflowCommand({action:'execute_tool',revision:1,input:{tool:'whatsapp.send'}})).toBeNull();
  expect(parseWorkflowCommand({action:'request',revision:1,userId:'another-user'})).toBeNull();
  expect(parseWorkflowCommand({action:'save',revision:1,input:{recipient:'+919629534701',body:'Hi',accountId:'other'}})).toBeNull();
 });
 it('accepts bounded editor fields but never recipient lists or invalid numbers',()=>{
  expect(parseWorkflowCommand({action:'save',revision:2,input:{recipient:'+919629534701',body:'Hello'}})?.action).toBe('save');
  for(const recipient of ['bad','+919629534701,+15551234567'])expect(parseWorkflowCommand({action:'save',revision:1,input:{recipient,body:'Hi'}})).toBeNull();
  expect(parseWorkflowCommand({action:'save',revision:1,input:{recipient:'',body:'x'.repeat(4097)}})).toBeNull();
 });
 it('rejects unknown or malformed saved UI versions',()=>{
  expect(readWhatsAppWidget({ui:{version:2,kind:'whatsapp_workflow'}})).toBeNull();
  expect(readWhatsAppWidget({ui:{version:1,kind:'whatsapp_workflow',revision:-1}})).toBeNull();
 });
 it('never calls a queued or uncertain request sent and locks its editor',()=>{
  expect(workflowStatusLabel('queued')).toBe('Queued');
  expect(workflowStatusLabel('unknown')).toBe('Status not confirmed');
  expect(workflowStatusLabel('sent')).toBe('Provider accepted');
  for(const status of ['requesting','pending','queued','unknown','sent'] as const)expect(canEditWorkflow(status)).toBe(false);
  expect(canEditWorkflow('draft')).toBe(true);
 });
 it('routes explicit setup checks without treating ordinary sends as setup checks',()=>{
  expect(isWhatsAppSetupRequest('check my WhatsApp setup')).toBe(true);
  expect(isWhatsAppSetupRequest('Check my WhatsApp setup. Do not send a message or change any settings.')).toBe(true);
  expect(isWhatsAppSetupRequest('Check my WhatsApp setup and send Hi')).toBe(false);
  expect(isWhatsAppSetupRequest('Send Hi using WhatsApp')).toBe(false);
  expect(isWhatsAppSetupRequest('check my email setup')).toBe(false);
 });
});
