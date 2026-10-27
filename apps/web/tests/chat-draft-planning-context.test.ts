import {describe,expect,it} from 'vitest';
import {draftPlanningContext} from '../src/lib/chat/draft-planning-context';
const history=[{role:'user',content:'Old WhatsApp request'},{role:'assistant',content:'No saved draft or send request was confirmed for this turn.'}];
const message='Create a new email draft only from sender@example.test to customer@example.test. Subject: QA new draft. Body: "Exact reviewed body." Do not send.';
describe('self-contained new draft planning is independent of stale conversation context',()=>{
 it.each([
  'Draft a short reply to the latest email from mohammedrilan.ksa@gmail.com in its original thread. This is a QA reply test. Do not send it or request sending.',
  'Reply to the last email from sender@example.test.',
 ])('resolves a self-contained latest-sender request from current tools instead of stale mailboxes: %s',current=>{
  expect(draftPlanningContext(history,current)).toEqual({history:[],independentCompose:true});
 });
 it.each([
  'Reply to the latest email from sender@example.test using the wording above.',
  'Reply to the latest email from sender@example.test using the response we just drafted.',
  'Reply to the latest email from sender@example.test with our agreed wording.',
  'Reply to the last email from sender@example.test with the same answer.',
  'Draft a reply to the latest email from sender@example.test and include those prices.',
  'Summarize the latest email from sender@example.test.',
  'Reply to the latest email from Mohammed.',
 ])('retains history when sender or requested reply depends on prior context: %s',current=>{
  expect(draftPlanningContext(history,current)).toEqual({history,independentCompose:false});
 });
 it('uses the complete current request without replaying old WhatsApp or failed actions',()=>{
  expect(draftPlanningContext(history,message)).toEqual({history:[],independentCompose:true});
  expect(history).toHaveLength(2);
 });
 it.each([
  'Create a reply draft only to the received email titled "AI Comms Agent Test" from sender@example.test in my mailbox@example.test mailbox. Body: "Exact reply." Do not send.',
  'Create a reply draft only for message 40000000-0000-4000-8000-000000000001 in mailbox@example.test. Body: "Exact reply." Do not send.',
 ])('isolates a fully identified current reply request from unrelated old failures',current=>{
  expect(draftPlanningContext(history,current)).toEqual({history:[],independentCompose:true});
 });
 it.each(['Send that draft','Update the previous draft. Body: "Replacement"','Create a draft from sender@example.test to customer@example.test. Subject: The same as above. Body: "Exact"','Reply to that email. Body: "Exact"','Summarize those emails'])('preserves reference-dependent context: %s',current=>{expect(draftPlanningContext(history,current)).toEqual({history,independentCompose:false});});
 it.each([message.replace('from sender@example.test ',''),message.replace('to customer@example.test. ',''),message.replace('Subject: QA new draft. ',''),message.replace('"Exact reviewed body."','Unquoted body')])('keeps history when a current compose field is missing or ambiguous',current=>{expect(draftPlanningContext(history,current).independentCompose).toBe(false);});
 it('does not mistake apparent compose fields inside quoted body text for current instructions',()=>{
  const current='Create a draft. Body: "from sender@example.test to customer@example.test Subject: fake fields"';expect(draftPlanningContext(history,current).independentCompose).toBe(false);
 });
});
