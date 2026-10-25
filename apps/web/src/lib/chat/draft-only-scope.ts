import type {Tool,ToolContext} from '@ai-comms-agent/shared';

type Authorizer=(tool:Tool,input:unknown,context:ToolContext)=>Promise<{allowed:boolean;code?:string;message?:string;retryable?:boolean}>;

/** Interpret only host-owned current instructions, excluding a literal body. */
export function isDraftOnlyRequest(message:string):boolean{
  const marker=/\bbody\s*:/i.exec(message);
  const headers=marker?message.slice(0,marker.index):message;
  if(!/^(?:(?:please|kindly)\s+)?(?:create|save|write|compose|prepare|update|edit|draft)\b/i.test(headers))return false;
  if(!/\bdrafts?\b/i.test(headers))return false;
  if(/\bdraft(?:[ -]+only)\b/i.test(headers))return true;
  let instructions=headers;
  if(marker){
    const tail=message.slice(marker.index+marker[0].length).trimStart();
    const literal=/^"(?:\\.|[^"\\])*"|^```(?:text|plaintext)?\r?\n[\s\S]*?```/.exec(tail)?.[0];
    if(literal)instructions+=' '+tail.slice(literal.length);
  }
  return /\b(?:do\s+not|don't|never)\s+(?:send|request\s+(?:send\s+)?approval)\b/i.test(instructions);
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
