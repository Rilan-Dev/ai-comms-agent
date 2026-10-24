import {ImapSmtpAdapter} from "../../worker/src/email/imap-smtp-adapter";
import {afterEach,describe,expect,it,vi} from 'vitest';
import {GmailAdapter} from '../../worker/src/email/gmail-adapter';
import {paramsFromApprovedEmailSnapshot} from '../../worker/src/email/approved-email-draft';
afterEach(()=>vi.restoreAllMocks());
describe('threaded reply provider drafts and immutable approval',()=>{
 const snapshot={to:['customer@example.test'],subject:'Re: QA thread',bodyText:'Exact reply',inReplyTo:'<source@example.test>',referencesHeader:'<older@example.test> <source@example.test>',providerThreadId:'gmail-thread-123'};
 it('retains approved reply headers and provider thread when reconstructing a send',()=>{
  expect(paramsFromApprovedEmailSnapshot(snapshot)).toMatchObject({reply_to_message_id:snapshot.inReplyTo,references_header:snapshot.referencesHeader,provider_thread_id:snapshot.providerThreadId});
 });
 it('rejects CRLF header injection in approval metadata',()=>{expect(()=>paramsFromApprovedEmailSnapshot({...snapshot,inReplyTo:'<source@example.test>\r\nBcc: victim@example.test'})).toThrow();});
 it('sends Gmail both RFC headers and its explicit original thread ID',async()=>{
  const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({historyId:'test'})).mockResolvedValueOnce(Response.json({id:'remote-draft'}));
  const adapter=new GmailAdapter();await adapter.connect({credential_type:'oauth_token',access_token:'test-only'});
  await adapter.createDraft({...paramsFromApprovedEmailSnapshot(snapshot),reply_to_message_id:snapshot.inReplyTo,references_header:snapshot.referencesHeader,provider_thread_id:snapshot.providerThreadId});
  const payload=JSON.parse(String(request.mock.calls[1]?.[1]?.body));
  expect(payload.message.threadId).toBe(snapshot.providerThreadId);
  const raw=Buffer.from(payload.message.raw,'base64url').toString('utf8');
  expect(raw).toContain('In-Reply-To: <source@example.test>\r\n');expect(raw).toContain('References: <older@example.test> <source@example.test>\r\n');expect(raw).toContain('\r\n\r\nExact reply');
 });
});

describe('IMAP reply References survive draft sync and later SMTP submission',()=>{
 it('puts the complete reference chain in the provider draft MIME',async()=>{
  const adapter=new ImapSmtpAdapter();let mime='';
  const transport=adapter as unknown as {ensureConnected:()=>unknown;appendDraft:(raw:string)=>Promise<unknown>};
  transport.ensureConnected=()=>({credentials:{username:'sender@example.test'}});
  transport.appendDraft=async raw=>{mime=raw;return {draft_id:'test-draft',account_id:'test'};};
  await adapter.createDraft({to:['customer@example.test'],subject:'Re: QA thread',body_text:'Exact reply',reply_to_message_id:'<source@example.test>',references_header:'<older@example.test> <source@example.test>'});
  expect(mime).toContain('References: <older@example.test> <source@example.test>\r\n');expect(mime).toContain('In-Reply-To: <source@example.test>\r\n');
 });
 it('keeps the full chain when sending the reviewed provider draft',async()=>{
  const adapter=new ImapSmtpAdapter();let headers:unknown;
  const transport=adapter as unknown as {getMessage:()=>Promise<unknown>;smtpSend:(params:unknown,extra:unknown)=>Promise<unknown>;deleteDraft:()=>Promise<void>};
  transport.getMessage=async()=>({is_draft:true,to_addresses:['customer@example.test'],subject:'Re: QA thread',text_body:'Exact reply',in_reply_to:'<source@example.test>',references:['<older@example.test>','<source@example.test>']});
  transport.smtpSend=async(_params,extra)=>{headers=extra;return {message_id:'test-id',provider_message_id:'test-id'};};transport.deleteDraft=async()=>{};
  await adapter.sendDraft('test-draft');expect(headers).toEqual({'In-Reply-To':'<source@example.test>',References:'<older@example.test> <source@example.test>'});
 });
 it('rejects header injection before contacting Gmail draft creation',async()=>{
  const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({historyId:'test',id:'unexpected'}));const adapter=new GmailAdapter();await adapter.connect({credential_type:'oauth_token',access_token:'test-only'});
  await expect(adapter.createDraft({to:['customer@example.test'],subject:'Re: QA',body_text:'Exact reply',reply_to_message_id:'<source@example.test>\r\nBcc: victim@example.test',provider_thread_id:'thread'})).rejects.toThrow();expect(request).toHaveBeenCalledTimes(1);
 });
});