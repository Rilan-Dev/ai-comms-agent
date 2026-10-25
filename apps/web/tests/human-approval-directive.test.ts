import {describe,expect,it} from 'vitest';
import {requiresHumanApproval} from '../../../packages/shared/src/operations/human-approval';
describe('current-user human approval directives',()=>{
 it.each(['Keep it pending for human review.','Do not send until I approve.','Request human approval before sending.','Wait for my approval.'])('requires review for %s',message=>expect(requiresHumanApproval(message)).toBe(true));
 it.each(['Send without human approval.','Do not request human approval; send it.','Send an email. Body: "Do not send until I approve."','Summarize my inbox.'])('does not infer review from payload or a negated request: %s',message=>expect(requiresHumanApproval(message)).toBe(false));
});
