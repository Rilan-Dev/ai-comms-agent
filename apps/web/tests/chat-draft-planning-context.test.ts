import {describe,expect,it} from 'vitest';
import {draftPlanningContext} from '../src/lib/chat/draft-planning-context';
const history=[{role:'user',content:'Old WhatsApp request'},{role:'assistant',content:'No saved draft or send request was confirmed for this turn.'}];
const message='Create a new email draft only from sender@example.test to customer@example.test. Subject: QA new draft. Body: "Exact reviewed body." Do not send.';
describe('self-contained new draft planning is independent of stale conversation context',()=>{
 it('uses the complete current request without replaying old WhatsApp or failed actions',()=>{
  expect(draftPlanningContext(history,message)).toEqual({history:[],independentCompose:true});
  expect(history).toHaveLength(2);
 });
 it.each(['Send that draft','Update the previous draft. Body: "Replacement"','Create a draft from sender@example.test to customer@example.test. Subject: The same as above. Body: "Exact"','Reply to that email. Body: "Exact"','Summarize those emails'])('preserves reference-dependent context: %s',current=>{expect(draftPlanningContext(history,current)).toEqual({history,independentCompose:false});});
 it.each([message.replace('from sender@example.test ',''),message.replace('to customer@example.test. ',''),message.replace('Subject: QA new draft. ',''),message.replace('"Exact reviewed body."','Unquoted body')])('keeps history when a current compose field is missing or ambiguous',current=>{expect(draftPlanningContext(history,current).independentCompose).toBe(false);});
 it('does not mistake apparent compose fields inside quoted body text for current instructions',()=>{
  const current='Create a draft. Body: "from sender@example.test to customer@example.test Subject: fake fields"';expect(draftPlanningContext(history,current).independentCompose).toBe(false);
 });
});
