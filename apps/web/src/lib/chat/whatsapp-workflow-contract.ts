import type {WhatsAppReadiness} from '@ai-comms-agent/shared';

export type WorkflowStatus='draft'|'review'|'requesting'|'unknown'|'pending'|'approved'|'queued'|'sent'|'failed'|'expired'|'rejected'|'requires_template';
export type WhatsAppWidget={
 version:1;kind:'whatsapp_workflow';revision:number;ownerId:string;turnId:string;reference:string;
 recipient:string;body:string;status:WorkflowStatus;accountId:string|null;accountLabel:string|null;
 readiness:WhatsAppReadiness|null;actionId:string|null;expiresAt:string;notice:string;
};
const statuses:WorkflowStatus[]=['draft','review','requesting','unknown','pending','approved','queued','sent','failed','expired','rejected','requires_template'];
const actions=['inspect','save','review','request','refresh','approve','reject','renew'] as const;
export type WorkflowCommand={action:typeof actions[number];revision:number;input?:{recipient:string;body:string}};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseWorkflowCommand(value:unknown):WorkflowCommand|null{
 if(!record(value)||Object.keys(value).some(k=>!['action','revision','input'].includes(k))||!actions.includes(value.action as WorkflowCommand['action'])||!Number.isSafeInteger(value.revision)||Number(value.revision)<0)return null;
 if(value.action==='save'){
  const input=value.input;
  if(!record(input)||Object.keys(input).some(k=>!['recipient','body'].includes(k))||typeof input.recipient!=='string'||typeof input.body!=='string'||input.body.length>4096||!(input.recipient===''||/^\+[1-9]\d{7,14}$/.test(input.recipient)))return null;
 }else if(value.input!==undefined)return null;
 return value as WorkflowCommand;
}
export function readWhatsAppWidget(json:unknown):WhatsAppWidget|null{
 if(!record(json)||!record(json.ui))return null;
 const w=json.ui;
 if(w.version!==1||w.kind!=='whatsapp_workflow'||!Number.isSafeInteger(w.revision)||Number(w.revision)<0||!statuses.includes(w.status as WorkflowStatus))return null;
 if(!['ownerId','turnId','reference','recipient','body','expiresAt','notice'].every(key=>typeof w[key]==='string'))return null;
 if(!['accountId','accountLabel','actionId'].every(key=>w[key]===null||typeof w[key]==='string'))return null;
 if(w.readiness!==null&&(!record(w.readiness)||typeof w.readiness.state!=='string'||typeof w.readiness.message!=='string'))return null;
 return w as WhatsAppWidget;
}
export function canEditWorkflow(status:WorkflowStatus){return status==='draft'||status==='review';}
export function canRenewWorkflow(widget:WhatsAppWidget){return ['expired','rejected','requires_template'].includes(widget.status)||(canEditWorkflow(widget.status)&&Date.parse(widget.expiresAt)<=Date.now());}
export function workflowStatusLabel(status:WorkflowStatus):string{
 return ({draft:'Not requested',review:'Ready to review',requesting:'Checking request',unknown:'Status not confirmed',pending:'Approval needed',approved:'Approved',queued:'Queued',sent:'Provider accepted',failed:'Failed',expired:'Approval expired',rejected:'Declined',requires_template:'Template needed'})[status];
}
export function isWhatsAppSetupRequest(text:string){
 const requested=text.replace(/\b(?:do not|don't|don’t|never)\s+send\b/gi,'');
 return /\bwhats\s?app\b/i.test(requested)&&/\b(?:setup|connection|permissions?|connected phones?)\b/i.test(requested)&&/\b(?:check|show|fix|inspect|choose)\b/i.test(requested)&&! /\b(?:send|summari[sz]e|summary)\b/i.test(requested);
}
