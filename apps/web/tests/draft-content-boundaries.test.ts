import {describe,it,expect,vi,beforeEach} from 'vitest';
import {reviewExplicitEmailBody} from '@ai-comms-agent/shared';
import {preserveEmailBody} from '../../../packages/email-agent-runtime/src/email-body';
import {createEmailWriteTools} from '../../../packages/email-agent-runtime/src/email-write-tools';
import type {ToolContext} from '@ai-comms-agent/shared';
import type {PostgresEmailAccountRepository} from '@ai-comms-agent/db';
const persisted=vi.hoisted(()=>({create:vi.fn(),update:vi.fn(),get:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({
 PostgresEmailAccountRepository:class{},EmailActionIdempotencyConflictError:class extends Error{},
 query:async()=>({rows:[{role:'primary'}]}),createLocalDraft:persisted.create,updateLocalDraftForOrganization:persisted.update,getLocalDraftForOrganization:persisted.get,
 getMailMessageForOrganization:vi.fn(),createEmailAction:vi.fn(),
}));
const account={id:'33333333-3333-3333-3333-333333333333',status:'connected',capabilities:{drafts:true}};
const context:ToolContext={organization_id:'org',agent_id:'agent',user_id:'user',conversation_id:'conversation',turn_id:'turn',correlation_id:'correlation',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['email.write']}};
const getAccount=vi.fn();
const tools=createEmailWriteTools({accounts:{getForAgent:getAccount} as unknown as PostgresEmailAccountRepository});
beforeEach(()=>{vi.clearAllMocks();getAccount.mockResolvedValue(account);persisted.create.mockResolvedValue({id:'draft'});persisted.update.mockResolvedValue({id:'draft'});persisted.get.mockResolvedValue({email_account_id:account.id});});

describe('explicit body versus operating instructions',()=>{
 it('requires review instead of guessing where an unquoted body ends',()=>{
  expect(reviewExplicitEmailBody('Create email. Subject: QA. Body: Test message. Do not send; request human approval.')).toMatchObject({kind:'review_required'});
 });
 it('preserves a quoted body exactly and excludes following instructions',()=>{
  const body='  Hello 👋\n\nDo not send this sentence separately.  ';
  expect(reviewExplicitEmailBody(`Create email. Body: ${JSON.stringify(body)} Request send approval; do not send.`)).toEqual({kind:'exact',body});
 });
 it('preserves fenced Unicode and whitespace',()=>{
  const body='  नमस्ते\nمرحبا\n\n';
  expect(reviewExplicitEmailBody('Body:\n```text\n'+body+'```\nRequest approval.')).toEqual({kind:'exact',body});
  expect(preserveEmailBody(body)).toBe(body);
 });
 it('does not treat ordinary natural email-writing requests as literal supplied body',()=>{
  expect(reviewExplicitEmailBody('Draft a polite email asking for an update.')).toBeUndefined();
 });
 it('refuses conflicting body sections instead of selecting one silently',()=>{
  expect(reviewExplicitEmailBody('Body: "first"\nBody: "second"')).toMatchObject({kind:'review_required'});
 });
 it.each(['email.draft.create','email.draft.update'])('%s persists the quoted current user body without model-added instructions',async(name)=>{
  const body='  Exact 👋\n\n';
  const result=await tools.find(tool=>tool.name===name)!.execute({account_id:account.id,draft_id:'draft',to:['qa@example.com'],subject:'QA',body_text:'Wrong body. Request approval; do not send.'},{...context,email_body_review:{kind:'exact',body}});
  expect(result.ok).toBe(true);
  if(name==='email.draft.create')expect(persisted.create).toHaveBeenCalledWith(expect.objectContaining({bodyText:body,to:['qa@example.com'],subject:'QA'}));
  else expect(persisted.update).toHaveBeenCalledWith('org','draft',expect.objectContaining({bodyText:body}));
 });
 it('requires clarification before persisting ambiguous body plus approval instructions',async()=>{
  const result=await tools.find(tool=>tool.name==='email.draft.create')!.execute({account_id:account.id,to:['qa@example.com'],subject:'QA',body_text:'Test message. Do not send; request approval.'},{...context,email_body_review:{kind:'review_required',proposedBody:'Test message. Do not send; request approval.'}});
  expect(result.ok).toBe(false);expect(result.error?.code).toBe('body_review_required');
  expect(persisted.create).not.toHaveBeenCalled();
 });
 it.each([null,{...account,status:'disconnected'},{...account,status:'revoked'}])('refuses a missing, foreign or unavailable sender',async(available)=>{
  getAccount.mockResolvedValueOnce(available);
  const result=await tools.find(tool=>tool.name==='email.draft.create')!.execute({account_id:account.id,to:['qa@example.com'],subject:'QA',body_text:'Test'},context);
  expect(result.ok).toBe(false);expect(persisted.create).not.toHaveBeenCalled();
  expect(getAccount).toHaveBeenCalledWith(context.organization_id,context.agent_id,account.id);
 });
 it('allows the word Body: inside the explicit quoted content',()=>{
  expect(reviewExplicitEmailBody('Body: "Body: is the field name" Request approval.')).toEqual({kind:'exact',body:'Body: is the field name'});
 });
});
