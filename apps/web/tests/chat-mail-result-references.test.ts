import {describe,it,expect} from 'vitest';
import {chatMailReferences} from '../src/lib/chat/mail-result-references';
const id='50000000-0000-4000-8000-000000000001';
const op=(state:string,resourceId:unknown=id,channel='email')=>({operation:{channel,state,resourceId,turnId:'turn',callId:'call',correlationId:'correlation'}});
describe('chat mail result references',()=>{
 it('keeps only confirmed email draft and approval identifiers, deduplicated',()=>{
  expect(chatMailReferences([op('draft_saved'),op('draft_saved'),op('pending_approval'),op('failed'),op('queued'),op('pending_approval',id,'whatsapp'),op('draft_saved','bad'),{operation:{channel:'email',state:'draft_saved',resourceId:id}}])).toEqual([{kind:'draft',id},{kind:'approval',id}]);
 });
 it('treats missing or malformed event data as no references',()=>{for(const value of [null,{},'text',[null,{},'x']])expect(chatMailReferences(value)).toEqual([]);});
});
