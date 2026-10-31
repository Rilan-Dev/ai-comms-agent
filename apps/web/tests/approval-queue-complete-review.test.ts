import {beforeEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({sender:'sender@example.com' as string|null,status:'connected'}));
vi.mock('react',async()=>{
 const actual=await vi.importActual<typeof import('react')>('react');
 return {...actual,useState:(initial:unknown)=>{
  if(Array.isArray(initial))return [[{id:'action',actionType:'send_email',emailAccountId:'account',draftId:'draft',requestedAt:'2026-10-24T00:00:00Z',senderAddress:m.sender,senderStatus:m.status,recipientSnapshot:{to:['to@example.com'],cc:['copy@example.com'],bcc:['hidden@example.com'],subject:'Reviewed subject',bodyText:'Exact body\n<script>inert</script>'}}],()=>{}];
  if(initial===true)return [false,()=>{}];
  return actual.useState(initial);
 }};
});
import {ApprovalsClient} from '../src/app/mail/approvals/approvals-client';
const render=()=>renderToStaticMarkup(createElement(ApprovalsClient,{organizationId:'org'}));
beforeEach(()=>{m.sender='sender@example.com';m.status='connected';});
it('shows the actual sender, every recipient and exact inert body before approval',()=>{
 const html=render();
 for(const value of ['sender@example.com','to@example.com','copy@example.com','hidden@example.com','Reviewed subject','Exact body\n&lt;script&gt;inert&lt;/script&gt;'])expect(html).toContain(value);
 expect(html).not.toContain('<script>');
});
it.each(['missing','disconnected'])('cannot approve when sender is %s but still allows rejection',state=>{
 if(state==='missing')m.sender=null;else m.status='disconnected';
 const html=render();expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
 expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Reject<\/button>/);
});
