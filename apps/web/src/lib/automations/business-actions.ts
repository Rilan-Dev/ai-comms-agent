export type RulePreset="generate_summary"|"create_draft"|"send_whatsapp"|"opportunity"|"service_ticket"|"opportunity_draft"|"service_ticket_draft";
export function buildBusinessRuleActions(input:{action:RulePreset;priority:"normal"|"high"|"urgent";assigneeId:string;whatsappTo:string}){
 const {action}=input;
 if(action==="send_whatsapp")return [{type:"send_whatsapp",to:input.whatsappTo.trim()}];
 if(action==="generate_summary"||action==="create_draft")return [{type:action}];
 const kind=action.startsWith("opportunity")?"opportunity":"service_ticket";
 return [{type:"generate_summary"},{type:"create_work_item",kind,priority:input.priority,...(input.assigneeId?{assigneeId:input.assigneeId}:{})},
  ...(action.endsWith("_draft")?[{type:"create_draft"}]:[])];
}
