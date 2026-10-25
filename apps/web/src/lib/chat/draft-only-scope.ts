import type {Tool,ToolContext} from '@ai-comms-agent/shared';
import {hasApprovalRequestDirective} from '@ai-comms-agent/shared';

type Authorizer=(tool:Tool,input:unknown,context:ToolContext)=>Promise<{allowed:boolean;code?:string;message?:string;retryable?:boolean}>;

/** Interpret only host-owned current instructions, excluding a literal body. */
export function isDraftOnlyRequest(message:string):boolean{
  const marker=/\bbody\s*:/i.exec(message);
  const headers=marker?message.slice(0,marker.index):message;
  const creation=/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would|will)\s+you\s+(?:(?:please|kindly)\s+)?)?(?:create|save|write|compose|prepare|update|edit|draft)\b/i.exec(headers);
  if(!creation)return false;
  if(!/\b(?:drafts?|e-?mails?)\b/i.test(headers))return false;
  if(/\bdraft(?:[ -]+only)\b/i.test(headers))return true;
  let instructions=headers.replace(/\bsubject\s*:[\s\S]*$/i,'');
  if(marker){
    const tail=message.slice(marker.index+marker[0].length).trimStart();
    const literal=/^"(?:\\.|[^"\\])*"|^```(?:text|plaintext)?\r?\n[\s\S]*?```/.exec(tail)?.[0];
    if(literal)instructions+=' '+tail.slice(literal.length);
  }
  if(/\b(?:do\s+not|don't|never)\s+request\s+(?:(?:send|human|manual|user)\s+)*approval\b/i.test(instructions))return true;
  // Preparing a human review is distinct from dispatching a message. Its
  // host-derived consent flag suppresses autonomous approval separately.
  if(hasApprovalRequestDirective(instructions))return false;
  // Email can be source material for a WhatsApp task, rather than the object
  // being drafted. Do not hide its tools just because that source is named.
  const nonPayload=instructions.replace(/```[\s\S]*?```|"(?:\\.|[^"\\])*"/g,' ');
  const object=nonPayload.slice(creation[0].length).trimStart();
  if(/^(?:(?:a|an|the|new|text)\s+){0,3}whats\s?app\b/i.test(object)
    && !/\bdrafts?\b/i.test(nonPayload))return false;
  if(/\b(?:do\s+not|don't|never)\s+send\b/i.test(instructions))return true;
  if(/\b(?:and|then|also)\s+send\b|\bsend\s+(?:it|this|that|the\s+draft)\b/i.test(instructions))return false;
  // Creating or editing a draft alone never requests an external send.
  return true;
}
export function draftOnlyToolAllowed(tool:Pick<Tool,'name'|'required_permission'|'sensitivity'>):boolean{
  return ['email.draft.create','email.draft.update','email.draft_reply','email.draft_forward'].includes(tool.name)
    || (tool.name.startsWith('email.')&&tool.required_permission==='email.read'&&tool.sensitivity==='safe');
}
/** Restricts this request's runtime only. The shared executor records denial
 * before any handler runs, even for provider-returned out-of-scope tool names. */
export function authorizeDraftOnly(authorize:Authorizer):Authorizer{
  return async(tool,input,context)=>draftOnlyToolAllowed(tool)
    ? authorize(tool,input,context)
    : {allowed:false,code:'draft_only_request',message:'This request is draft-only. Sending, approval requests and other external actions are not allowed.'};
}
