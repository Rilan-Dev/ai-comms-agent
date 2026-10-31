import {describe,expect,it,vi} from 'vitest';
import {ToolRegistry,type ToolContext,type ToolResult} from '@ai-comms-agent/shared';
import {runEmailAgentTurn} from '../../../packages/email-agent-runtime/src/email-agent-loop';
import type {EmailToolRuntime} from '../../../packages/email-agent-runtime/src/email-tool-runtime';
const context:ToolContext={organization_id:'org',agent_id:'agent',user_id:'user',conversation_id:'conversation',turn_id:'turn',correlation_id:'correlation',channel:'voice',auth_subject:{user_id:'user',role:'owner',permissions:['email.read']}};
function setup(){
 const registry=new ToolRegistry(()=>['email.accounts.list','email.messages.list']);
 for(const name of ['email.accounts.list','email.messages.list'])registry.register({name,domain:'email',description:name,input_schema:{type:'object',properties:{}},required_permission:'email.read',sensitivity:'safe',execute:vi.fn()});
 const runtime={registry,authorize:vi.fn(async()=>({allowed:true})),writeAudit:vi.fn(async()=>{})};
 const complete=vi.fn().mockResolvedValueOnce({text:'',toolCalls:[{id:'read',name:'email.accounts.list',arguments:{}}],finishReason:'tool_calls'}).mockResolvedValue({text:'One mailbox',toolCalls:[],finishReason:'stop'});
 const invoke=vi.fn<(runtime:EmailToolRuntime,name:string,input:unknown,context:ToolContext)=>Promise<ToolResult>>(async()=>({ok:true,output:[],audit:{tool_name:'email.accounts.list',input_summary:'read',output_summary:'read',duration_ms:1}}));
 const agentContext={orgId:'org',agentId:'agent',kbId:''};
 const configuration={organizationId:'org',agentId:'agent',revisionId:'revision',revocationGeneration:0,snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['email.accounts.list'],securityPolicy:{}}}} as never;
 return {runtime,complete,invoke,turn:{configuration,agentContext},dependencies:{createRuntime:vi.fn(async()=>runtime),completeWithTools:complete,invoke}};
}
describe('shared email/voice loop configuration integration',()=>{
 it('uses one prepared model context in every round and exposes only the frozen tools',async()=>{
  const s=setup();await runEmailAgentTurn({organizationId:'org',agentId:'agent',messages:[{role:'user',content:'List mailboxes'}],toolContext:context,configurationTurn:s.turn},s.dependencies);
  expect(s.complete).toHaveBeenCalledTimes(2);for(const call of s.complete.mock.calls){expect(call[0]).toBe(s.turn.agentContext);expect(call[2].map((tool:{name:string})=>tool.name)).toEqual(['email.accounts.list']);}
  expect(s.invoke.mock.calls[0]?.[3]).toMatchObject({agent_configuration:{revisionId:'revision'}});
 });
 it('passes the same prepared context to the final read-only response callback',async()=>{
  const s=setup();s.complete.mockResolvedValueOnce({text:'',toolCalls:[],finishReason:'stop'});const final=vi.fn(async()=> 'Final sourced reply');
  await runEmailAgentTurn({organizationId:'org',agentId:'agent',messages:[{role:'user',content:'List mailboxes'}],toolContext:context,configurationTurn:s.turn,onSafeReadOnlyFinal:final},s.dependencies);
  expect(final).toHaveBeenCalledWith(expect.any(Array),s.turn.agentContext);
 });
 it('rejects a prepared model context from a different scope before any provider/tool operation',async()=>{
  const s=setup();s.turn.agentContext.orgId='other';
  await expect(runEmailAgentTurn({organizationId:'org',agentId:'agent',messages:[{role:'user',content:'List mailboxes'}],toolContext:context,configurationTurn:s.turn},s.dependencies)).rejects.toThrow('scope');expect(s.complete).not.toHaveBeenCalled();expect(s.invoke).not.toHaveBeenCalled();
 });
});
