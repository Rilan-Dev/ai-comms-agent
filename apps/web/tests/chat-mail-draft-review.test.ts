import {describe,it,expect} from 'vitest';
import {parseDraft} from '../src/app/chat/chat-mail-result';
const draft={id:'draft',is_draft:true,email_account_id:'account',account_email:'sender@example.test',to_recipients:['recipient@example.test'],cc_recipients:['cc@example.test'],bcc_recipients:[],subject:'Subject',text_body:'Exact\nbody'};
describe('saved draft review',()=>{
 it('shows the exact persisted message and all recipients',()=>{expect(parseDraft(draft,'draft')).toEqual({id:'draft',accountId:'account',sender:'sender@example.test',snapshot:{to:['recipient@example.test'],cc:['cc@example.test'],bcc:[],subject:'Subject',bodyText:'Exact\nbody'}})});
 it('does not offer review for mismatched, sent or incomplete server records',()=>{for(const value of [{...draft,id:'other'},{...draft,is_draft:false},{...draft,text_body:null},{...draft,to_recipients:[]}])expect(parseDraft(value,'draft')).toBeNull();});
 it('preserves the saved recipient casing and subject whitespace in the review',()=>{
  const saved={...draft,to_recipients:['Reader@Example.test'],subject:'  Exact subject  '};
  expect(parseDraft(saved,'draft')?.snapshot).toMatchObject({to:['Reader@Example.test'],subject:'  Exact subject  '});
 });
});
