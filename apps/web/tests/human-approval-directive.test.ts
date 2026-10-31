import {describe,expect,it} from 'vitest';
import {requiresHumanApproval} from '../../../packages/shared/src/operations/human-approval';
describe('current-user human approval directives',()=>{
 it.each(['Keep it pending for human review.','Do not send until I approve.','Request human approval before sending.','Wait for my approval.'])('requires review for %s',message=>expect(requiresHumanApproval(message)).toBe(true));
 it.each([
  'Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails',
  'Prepare a WhatsApp approval request with my unread email summary.',
  'Summarize my unread emails and create an approval request for WhatsApp.',
  'Create an email approval request for this draft.',
  'Please prepare a request for human approval.',
  'Submit a new send approval request.',
  'Request send approval for this email.',
 ])('recognizes a natural approval-request noun phrase: %s',message=>expect(requiresHumanApproval(message)).toBe(true));
 it.each(['Send without human approval.','Do not request human approval; send it.','Send an email. Body: "Do not send until I approve."','Summarize my inbox.'])('does not infer review from payload or a negated request: %s',message=>expect(requiresHumanApproval(message)).toBe(false));
 it.each([
  'Do not create a WhatsApp approval request; send the message.',
  "Don't prepare an approval request.",
  'Never submit a request for human approval.',
  'Summarize the approval requests in my inbox.',
  'Create an email draft. Body: "Create a WhatsApp approval request."',
  'Create an email draft. Subject: Create a WhatsApp approval request. Body: "Exact"',
  'Send an email. Body: ```text\nPrepare an approval request.\n```',
 ])('keeps noun phrases in payload or negation out of authority: %s',message=>expect(requiresHumanApproval(message)).toBe(false));
});
