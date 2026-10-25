import {describe,expect,it,vi} from 'vitest';
import {ToolRegistry} from '@ai-comms-agent/shared';
import type {Tool,ToolContext} from '@ai-comms-agent/shared';
import {executeRegisteredTool} from '../../worker/src/agent/tool-executor';
import {isDraftOnlyRequest,authorizeDraftOnly,draftOnlyToolAllowed} from '../src/lib/chat/draft-only-scope';
const context:ToolContext={agent_id:'agent',organization_id:'org',user_id:'user',turn_id:'turn',correlation_id:'correlation',conversation_id:'conversation',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['email.write','whatsapp.send','schedules.manage']}};
describe('draft-only chat scope remains authoritative with autonomous sending enabled',()=>{
 it.each(['Create a new email draft only. Body: "Exact"','Create a reply draft only. Body: "Exact"','Save a reply draft. Body: "Exact" Do not send.','Update this draft only. Body: "Exact"','Create an email draft. Body: "Exact"','Create a draft. Subject: Send it. Body: "Exact"'])('recognizes explicit draft-only instruction: %s',message=>expect(isDraftOnlyRequest(message)).toBe(true));
 it.each(['Send an email. Body: "Do not send advertisements"','Create a draft and send it. Body: "Exact"','Create a draft and request approval. Body: "Exact"','Create a draft. Body: "Exact" Request human approval. Do not send.','Schedule a daily email task.','Summarize my inbox'])('does not invent a draft-only restriction: %s',message=>expect(isDraftOnlyRequest(message)).toBe(false));
 it.each(['email.send.request','email.reply.request','email.forward.request','whatsapp.send','schedules.create'])('denies even a registered authorized %s before its handler or auto-approval',async name=>{
  const execute=vi.fn(async()=>({ok:true,output:{status:'auto_approved'},audit:{tool_name:name,input_summary:name,output_summary:'queued',duration_ms:0}}));
  const tool:Tool={name,domain:'email',description:'test',input_schema:{type:'object',properties:{}},sensitivity:'safe',required_permission:name.startsWith('whatsapp')?'whatsapp.send':name.startsWith('schedules')?'schedules.manage':'email.write',execute};
  const registry=new ToolRegistry(()=>[name]);registry.register(tool);const savedPolicy=vi.fn(async()=>({allowed:true}));const audit=vi.fn(async()=>{});
  const result=await executeRegisteredTool(registry,name,{},context,authorizeDraftOnly(savedPolicy),audit);
  expect(result.error?.code).toBe('draft_only_request');expect(execute).not.toHaveBeenCalled();expect(savedPolicy).not.toHaveBeenCalled();expect(audit).toHaveBeenCalledTimes(1);
 });
 it('retains the original authorization check for allowed draft saves',async()=>{
  const authorize=vi.fn(async()=>({allowed:false,code:'revoked'}));const tool={name:'email.draft.create',required_permission:'email.write',sensitivity:'safe'} as Tool;
  expect(draftOnlyToolAllowed(tool)).toBe(true);expect(await authorizeDraftOnly(authorize)(tool,{},context)).toEqual({allowed:false,code:'revoked'});expect(authorize).toHaveBeenCalledTimes(1);
 });
});
