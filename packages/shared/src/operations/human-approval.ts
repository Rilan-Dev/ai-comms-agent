const NOUN_REQUEST='(?:approval\\s+requests?|requests?\\s+for\\s+(?:(?:human|manual|user|explicit)\\s+)*approval)';
const NOUN_REQUEST_COMMAND='(?:create|prepare|make|submit|save|draft)\\s+(?:(?:a|an|the|new|e-?mail|whats\\s?app|send|sending|reply|forward|human|manual|explicit)\\s+){0,6}'+NOUN_REQUEST;

function currentInstructions(message:string):string{
  return message.replace(/```[\s\S]*?```|"(?:\\.|[^"\\])*"/g,' ')
    .replace(/\bsubject\s*:[^\r\n]*?(?=\bbody\s*:|\r?\n|$)/gi,' ');
}

function affirmativeApprovalRequest(instructions:string):boolean{
  const affirmative=instructions
    .replace(new RegExp("\\b(?:do\\s+not|don['’]t|never)\\s+"+NOUN_REQUEST_COMMAND+'\\b','gi'),' ')
    .replace(/\b(?:do\s+not|don['’]t|never)\s+(?:ask\s+for|request|require|obtain|seek)\s+(?:(?:a|human|manual|user|explicit|send|sending)\s+)*approval\b/gi,' ');
  return new RegExp('\\b'+NOUN_REQUEST_COMMAND+'\\b','i').test(affirmative)
    || /\b(?:request|require|obtain|seek)\s+(?:(?:human|manual|user|explicit|send|sending)\s+)*approval\b/i.test(affirmative);
}

/** An affirmative request to prepare approval is a separate operation from
 * merely saving a draft. Shared by restrictive host routing and consent. */
export function hasApprovalRequestDirective(message:string):boolean{
  return affirmativeApprovalRequest(currentInstructions(message));
}

/** Extra review can only restrict autonomous policy. Literal payloads do not
 * supply execution authority; this flag is constructed by the host per turn. */
export function requiresHumanApproval(message:string):boolean{
  const instructions=currentInstructions(message);
  if(/\b(?:do\s+not|don['’]t|never)\s+(?:send|dispatch)\b/i.test(instructions))return true;
  return affirmativeApprovalRequest(instructions)
    || /\b(?:keep|leave)\s+(?:it\s+)?pending\b|\b(?:pending|awaiting)\s+(?:(?:for|explicit)\s+)*(?:human|manual|user)\s+(?:review|approval)\b|\bwait\s+for\s+(?:my|human|manual|user)\s+approval\b/i.test(instructions);
}
