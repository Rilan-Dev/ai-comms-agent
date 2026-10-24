import {describe,expect,it} from 'vitest';
import {safeChatFailure} from '../src/lib/chat/safe-failure';

describe('safe chat failure diagnostics',()=>{
 it('reports provider HTTP status without request, token or response text',()=>{
  const details=safeChatFailure(new Error('Sarvam tool request failed (400): secret-token private mailbox content invalid role'));
  expect(details).toEqual({category:'provider_http',provider:'sarvam',httpStatus:400,type:'Error'});
  expect(JSON.stringify(details)).not.toMatch(/secret|mailbox|content|role/);
 });
 it('keeps unknown SQL and arbitrary error names opaque',()=>{
  const error=new Error('postgresql://secret@example.test/private body');error.name='private-subject';
  expect(safeChatFailure(error)).toEqual({category:'unknown',type:'Error'});
 });
 it('distinguishes network, timeout and empty completion failures without raw exception text',()=>{
  expect(safeChatFailure(new TypeError('fetch failed'))).toEqual({category:'network',type:'TypeError'});
  const timeout=new Error('secret');timeout.name='AbortError';
  expect(safeChatFailure(timeout)).toEqual({category:'timeout',type:'AbortError'});
  expect(safeChatFailure(new Error('AI provider returned an empty chat response.'))).toEqual({category:'empty_completion',type:'Error'});
 });
});
