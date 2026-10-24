import {describe,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApprovalsClient} from '../src/app/mail/approvals/approvals-client';
import WhatsAppClient from '../src/app/whatsapp/whatsapp-client';
import {authorizationErrorToResponse} from '../src/lib/identity/authorization';
import {ForbiddenError} from '@ai-comms-agent/shared';

describe('frontend initial loading and safe failures',()=>{
 it('shows approval loading before the first request rather than an empty queue',()=>{
  const html=renderToStaticMarkup(createElement(ApprovalsClient,{organizationId:'org'}));
  expect(html).toContain('Loading approvals');expect(html).not.toContain('Nothing waiting for approval');
 });
 it('does not report an empty WhatsApp history while the account request is pending',()=>{
  const html=renderToStaticMarkup(createElement(WhatsAppClient,{organizationId:'org'}));
  expect(html).toContain('Loading WhatsApp accounts');expect(html).not.toContain('No persisted messages yet');
 });
 it('returns a safe traceable server error without recommending broader permissions',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{
   const response=authorizationErrorToResponse(Object.assign(new Error('secret database row'),{code:'42703',detail:'private credentials'}));
   expect(response.status).toBe(500);const body=await response.json();
   expect(body.reference).toMatch(/^[a-f0-9-]{36}$/);expect(body.message).toMatch(/check.*status/i);
   expect(JSON.stringify(body)).not.toMatch(/secret|credentials|permission/i);
   expect(log).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({reference:body.reference,sqlstate:'42703'}));
  }finally{log.mockRestore();}
 });
 it('preserves a real permission denial status',()=>{
  expect(authorizationErrorToResponse(new ForbiddenError('missing_permission','Missing permission')).status).toBe(403);
 });
});
