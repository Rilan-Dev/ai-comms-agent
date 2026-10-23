import {describe,it,expect} from 'vitest';
import {operationStateLabel} from '../src/lib/operation-state-label';
import {suggestedChatNextActions} from '../src/lib/chat/interactive-replies';
describe('relevant follow-up actions',()=>{
 it('offers only one relevant next step for a grounded summary',()=>{
  expect(suggestedChatNextActions('Sender: qa@example.com. Subject: Meeting request.','Summarize my inbox')).toHaveLength(1);
 });
 it.each(['Failed to load. Sender: unknown.','No messages found. Subject: unavailable.','Needs verification. Sender: unknown.'])('offers no action after %s',answer=>{
  expect(suggestedChatNextActions(answer,'Summarize my inbox')).toEqual([]);
 });
});

describe('evidence-based status labels',()=>{
 it('distinguishes provider acceptance, recipient delivery and uncertain execution',()=>{
  expect(operationStateLabel('sent')).toBe('Provider accepted');
  expect(operationStateLabel('delivered')).toBe('Delivered');
  expect(operationStateLabel('failed','Worker execution interrupted; provider outcome is unknown. Manual verification required.')).toBe('Needs verification');
  expect(operationStateLabel('unexpected')).toBe('Needs verification');
 });
});