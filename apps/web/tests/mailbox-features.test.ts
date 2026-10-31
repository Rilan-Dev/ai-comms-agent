import {describe,expect,it} from 'vitest';
import {summarizeMailboxFeatures} from '../src/lib/mail/mailbox-features';
describe('mailbox feature availability',()=>{
 it('distinguishes explicit support, unavailability and unknown discovery',()=>{
  const features=summarizeMailboxFeatures({send:true,drafts:false});
  expect(features.find(f=>f.key==='send')?.status).toBe('available');
  expect(features.find(f=>f.key==='drafts')?.status).toBe('unavailable');
  expect(features.find(f=>f.key==='archive')?.status).toBe('unknown');
 });
 it('does not infer support from a malformed value',()=>{
  expect(summarizeMailboxFeatures({send:'yes'}).find(f=>f.key==='send')?.status).toBe('unknown');
 });
 it('explains provider-specific gaps in plain language',()=>{
  const gmail=summarizeMailboxFeatures({sync_webhook:false},'gmail');
  const zoho=summarizeMailboxFeatures({forward:false},'zoho');
  expect(gmail.find(f=>f.key==='sync_webhook')?.help).toMatch(/background/i);
  expect(zoho.find(f=>f.key==='forward')?.help).toMatch(/Zoho/i);
 });
});
