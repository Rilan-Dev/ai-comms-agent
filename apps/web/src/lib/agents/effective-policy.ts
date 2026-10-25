import {emailPermissionPresetSelection,type EmailPermissionPreset} from './email-permission-presets';

type Access={actorAllowed?:boolean;accountReady?:boolean};
export type EffectivePolicyInput={allowedTools:readonly string[];autonomousSend:boolean;requireHumanApproval?:boolean;email?:Access;whatsapp?:Access};
type SendingSummary={enabled:boolean;mode:'off'|'review'|'automatic';canRequest:boolean|null};
export type EffectivePolicySummary={emailPreset:EmailPermissionPreset|'custom';email:SendingSummary;whatsapp:SendingSummary};

/** Presentation only. Derived from the one saved/edited allowlist and mode;
 * never a replacement for registered-tool, actor, binding or provider checks. */
export function describeEffectiveAgentPolicy(input:EffectivePolicyInput):EffectivePolicySummary{
 const emailTools=[...new Set(input.allowedTools.filter(tool=>tool.startsWith('email.')))];
 const emailPreset=(['read','draft','approval','off'] as const).find(preset=>{
  const expected=emailPermissionPresetSelection([],preset);
  return expected.length===emailTools.length&&expected.every(tool=>emailTools.includes(tool));
 })??'custom';
 function sending(tools:readonly string[],access?:Access):SendingSummary{
  const enabled=tools.some(tool=>input.allowedTools.includes(tool));
  return {enabled,mode:!enabled?'off':input.autonomousSend&&!input.requireHumanApproval?'automatic':'review',
   canRequest:!enabled||access?.actorAllowed===false||access?.accountReady===false?false:access?.actorAllowed===true&&access.accountReady===true?true:null};
 }
 return {emailPreset,email:sending(['email.send.request','email.reply.request','email.forward.request'],input.email),whatsapp:sending(['whatsapp.send'],input.whatsapp)};
}
