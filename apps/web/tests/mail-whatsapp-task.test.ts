import {describe,expect,it,vi} from 'vitest';
import {parseMailWhatsAppTask,prepareMailWhatsAppTask,completeMailWhatsAppTask} from '../src/lib/chat/mail-whatsapp-task';

const prompt='Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails';
const evidence={rows:[{id:'source-1',account_email:'owner@example.test',from_email:'client@example.test',from_name:'Client',subject:'Meeting',received_at:'2026-10-26T07:00:00Z',snippet:'Meet tomorrow at ten.',text_body:'Meet tomorrow at ten.',total_count:1}],matchedCount:1,lastSyncAt:'2026-10-26T07:01:00Z'};
describe('host-owned mail summary to WhatsApp review',()=>{
 it('captures the exact owner request as latest three total and mandatory human review',()=>{
  expect(parseMailWhatsAppTask(prompt)).toEqual({count:3,recipient:'+919629534701',account:'Meta Test Phone',requireHumanApproval:true});
 });
 it.each([
  'Summarize my last 3 unread emails',
  'Draft an email about WhatsApp approval requests',
  'Send the last 3 unread emails to +919629534701 on WhatsApp',
  'Do not create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails',
  'Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails from Alice',
  'Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails with attachments',
  prompt+' and delete them',
  prompt.replace('last 3','last 30'),
  'Subject: "'+prompt+'"',
 ])('does not reinterpret unsupported or literal instructions: %s',input=>expect(parseMailWhatsAppTask(input)).toBeNull());
 it('selects three total using explicit unread scope and fixed as-of without marking read',async()=>{
  const read=vi.fn(async()=>evidence);
  const result=await prepareMailWhatsAppTask(parseMailWhatsAppTask(prompt)!,read,'2026-10-26T08:00:00Z');
  expect(read).toHaveBeenCalledOnce();expect(read).toHaveBeenCalledWith({scope:{unreadOnly:true},limit:3,fromUtc:'0001-01-01T00:00:00.000Z',toUtc:'2026-10-26T08:00:00Z'});
  expect(result).toMatchObject({sources:[{messageId:'source-1',mailbox:'owner@example.test'}],asOf:'2026-10-26T08:00:00Z'});
  expect(result.body).toContain('1 of 3 requested');expect(result.body).toContain('Meeting');expect(result.body).toContain('locally synchronized');
 });
 it('does not prepare an empty review when there are no matching unread messages',async()=>{
  const result=await prepareMailWhatsAppTask(parseMailWhatsAppTask(prompt)!,async()=>({...evidence,rows:[],matchedCount:0}),'2026-10-26T08:00:00Z');
  expect(result.body).toBe('');expect(result.message).toContain('No unread');
 });
 it('rejects an incomplete source selection rather than silently sending a partial report',async()=>{
  await expect(prepareMailWhatsAppTask(parseMailWhatsAppTask(prompt)!,async()=>({...evidence,matchedCount:9}),'2026-10-26T08:00:00Z')).rejects.toThrow('selection');
 });
 it('saves the exact summary before one registered send request and retains its actual receipt',async()=>{
  const save=vi.fn(async()=> 'checkpoint');const send=vi.fn(async()=>({state:'pending_approval' as const,resourceId:'action'}));
  const prepared=await prepareMailWhatsAppTask(parseMailWhatsAppTask(prompt)!,async()=>evidence,'2026-10-26T08:00:00Z');
  const result=await completeMailWhatsAppTask(prepared,{save,send});
  expect(save).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledWith('checkpoint');
  expect(save.mock.invocationCallOrder[0]!).toBeLessThan(send.mock.invocationCallOrder[0]!);
  expect(result).toMatchObject({checkpointRef:'checkpoint',operation:{state:'pending_approval',resourceId:'action'}});
 });
 it('retains partial progress on a stopped send without retrying or suggesting email drafts',async()=>{
  const send=vi.fn(async()=>{throw Error('provider stopped');});
  const prepared=await prepareMailWhatsAppTask(parseMailWhatsAppTask(prompt)!,async()=>evidence,'2026-10-26T08:00:00Z');
  const result=await completeMailWhatsAppTask(prepared,{save:async()=> 'checkpoint',send});
  expect(send).toHaveBeenCalledOnce();expect(result.checkpointRef).toBe('checkpoint');expect(result.message).toContain('WhatsApp');expect(result.message).not.toContain('Drafts');
 });
});

