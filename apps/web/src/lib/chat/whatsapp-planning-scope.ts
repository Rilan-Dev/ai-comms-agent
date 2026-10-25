import type {Tool,ToolContext} from '@ai-comms-agent/shared';
type Authorizer=(tool:Tool,input:unknown,context:ToolContext)=>Promise<{allowed:boolean;code?:string;message?:string;retryable?:boolean}>;
/** Channel scope comes from current instructions, never payload text or old
 * conversation content. Explicit mail-summary-to-WhatsApp requests keep both. */
export function whatsAppPlanningContext<T extends {role:string;content:string}>(history:T[],message:string):{history:T[];whatsAppOnly:boolean}{
  const instructions=message.replace(/```[\s\S]*?```|"(?:\\.|[^"\\])*"/g,' ');
  const whatsAppOnly=/\bwhats\s?app\b/i.test(instructions)&&!/\b(?:e-?mails?|mails?|mailbox(?:es)?|inbox|unread)\b/i.test(instructions);
  const complete=whatsAppOnly&&/\+[1-9]\d{7,14}\b/.test(instructions)&&/\b(?:exact\s+)?(?:message|text|body)\s*:\s*"(?:\\.|[^"\\])*"/i.test(message);
  return {history:complete?[]:history,whatsAppOnly};
}
export function authorizeWhatsAppOnly(authorize:Authorizer):Authorizer{
  return async(tool,input,context)=>tool.name.startsWith('whatsapp.')?authorize(tool,input,context):{allowed:false,code:'whatsapp_only_request',message:'This request is WhatsApp-only. Unrelated email and schedule tools are not allowed.'};
}
