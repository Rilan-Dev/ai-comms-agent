import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({accounts:vi.fn(),messages:vi.fn(),allowed:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({listInboxMessages:m.messages,PostgresEmailAccountRepository:class{listForOrganization=m.accounts;}}));
vi.mock('@/lib/identity/repository',()=>({getAuthenticatedAppContext:async()=>({organizationId:'org',membership:{role:'owner'}})}));
vi.mock('@/lib/mail/mail-read-access',()=>({canReadOrganizationMail:m.allowed}));
vi.mock('next/headers',()=>({headers:async()=>new Headers()}));
vi.mock('../src/app/mail/inbox/inbox-client',()=>({InboxClient:()=>null}));
import MailInboxPage from '../src/app/mail/inbox/page';
import {mergeInboxMailboxes} from '../src/lib/mail/inbox-mailbox-options';
beforeEach(()=>{vi.stubEnv('DATABASE_URL','test-only');vi.clearAllMocks();m.allowed.mockResolvedValue(true);m.messages.mockResolvedValue([]);m.accounts.mockResolvedValue([{id:'first',email_address:'first@example.test'},{id:'empty',email_address:'empty@example.test'}]);});
describe('inbox mailbox choices',()=>{
 it('includes authorized mailboxes even when no messages are visible',async()=>{
  const page=await MailInboxPage();
  expect(page.props.initialAccounts).toEqual([{id:'first',label:'first@example.test'},{id:'empty',label:'empty@example.test'}]);
  expect(m.accounts).toHaveBeenCalledWith('org');
 });
 it('does not load account data when mail read access is denied',async()=>{
  m.allowed.mockResolvedValueOnce(false);await MailInboxPage();expect(m.accounts).not.toHaveBeenCalled();
 });
 it('keeps the inbox available and reports an unavailable mailbox list',async()=>{
  m.accounts.mockRejectedValueOnce(Error('unavailable'));const page=await MailInboxPage();
  expect(page.props.initialMessages).toEqual([]);expect(page.props.initialAccounts).toEqual([]);expect(page.props.accountsUnavailable).toBe(true);
 });
 it('keeps saved choices through an empty filter and adds a newly seen mailbox',()=>{
  const saved=[{id:'first',label:'first@example.test'}];
  expect(mergeInboxMailboxes(saved,[])).toEqual(saved);
  const discovered=mergeInboxMailboxes(saved,[{email_account_id:'second',account_email:'second@example.test'}]);
  expect(discovered).toEqual([...saved,{id:'second',label:'second@example.test'}]);expect(mergeInboxMailboxes(discovered,[])).toEqual(discovered);
 });
});
