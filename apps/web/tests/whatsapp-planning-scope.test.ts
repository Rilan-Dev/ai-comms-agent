import {describe,expect,it,vi} from 'vitest';
import type {Tool,ToolContext} from '@ai-comms-agent/shared';
import {whatsAppPlanningContext,authorizeWhatsAppOnly} from '../src/lib/chat/whatsapp-planning-scope';
const history=[{role:'user',content:'Old email request'},{role:'assistant',content:'Old failed mail operation'}];
describe('WhatsApp-only requests do not request ambient email retrieval or unrelated tools',()=>{
 it('isolates a complete current message from old mail failures',()=>{
  const message='Create a WhatsApp approval request to +15555550123. Exact message: "Harmless test" Keep pending for human review.';
  expect(whatsAppPlanningContext(history,message)).toEqual({history:[],whatsAppOnly:true});
 });
 it.each(['Summarize my emails and send the result to WhatsApp.','Send a WhatsApp summary of my unread inbox.','Create an email draft. Body: "WhatsApp message"'])('preserves the actual requested multi-channel or email workflow: %s',message=>{expect(whatsAppPlanningContext(history,message)).toEqual({history,whatsAppOnly:false});});
 it('does not treat the word email inside an exact WhatsApp payload as permission to read mail',()=>{expect(whatsAppPlanningContext(history,'Send WhatsApp to +15555550123. Exact message: "I will email you tomorrow."').whatsAppOnly).toBe(true);});
 it('keeps context needed by a WhatsApp follow-up',()=>{expect(whatsAppPlanningContext(history,'Show that WhatsApp conversation.')).toEqual({history,whatsAppOnly:true});});
 it('denies unrelated registered email tools before their saved authorization path',async()=>{
  const authorize=vi.fn(async()=>({allowed:true}));const context={} as ToolContext;
  expect(await authorizeWhatsAppOnly(authorize)({name:'email.search'} as Tool,{},context)).toMatchObject({allowed:false,code:'whatsapp_only_request'});expect(authorize).not.toHaveBeenCalled();
  expect(await authorizeWhatsAppOnly(authorize)({name:'whatsapp.send'} as Tool,{},context)).toEqual({allowed:true});expect(authorize).toHaveBeenCalledTimes(1);
 });
});
