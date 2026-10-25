/** Extra review can only restrict autonomous policy. Literal payloads do not
 * supply execution authority; this flag is constructed by the host per turn. */
export function requiresHumanApproval(message:string):boolean{
  const instructions=message.replace(/```[\s\S]*?```|"(?:\\.|[^"\\])*"/g,' ');
  if(/\b(?:do\s+not|don't|never)\s+(?:send|dispatch)\b/i.test(instructions))return true;
  const affirmative=instructions.replace(/\b(?:do\s+not|don't|never)\s+(?:ask\s+for|request|require)\s+(?:(?:a|human|manual|user|explicit)\s+)*approval\b/gi,' ');
  return /\b(?:keep|leave)\s+(?:it\s+)?pending\b|\b(?:pending|awaiting)\s+(?:(?:for|explicit)\s+)*(?:human|manual|user)\s+(?:review|approval)\b|\b(?:request|require|obtain|seek)\s+(?:(?:human|manual|user|explicit)\s+)*approval\b|\bwait\s+for\s+(?:my|human|manual|user)\s+approval\b/i.test(affirmative);
}
