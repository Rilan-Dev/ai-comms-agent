import {describe,expect,it,vi} from 'vitest';
import type {ActiveAgentConfiguration} from '@ai-comms-agent/db';
vi.mock('@ai-comms-agent/db',()=>({loadActiveAgentConfiguration:vi.fn()}));
vi.mock('@ai-comms-agent/clara-core',()=>({claraRuntime:{prepareTurn:vi.fn()}}));
import {prepareAgentConfigurationTurn} from '../../../packages/email-agent-runtime/src/configuration-turn';
const context={orgId:'org',agentId:'agent',kbId:''};
function configuration(id='revision',fingerprint='a'):ActiveAgentConfiguration{return {organizationId:'org',agentId:'agent',revisionId:id,dependencyFingerprint:fingerprint.repeat(64),revocationGeneration:0,barrier:{tools:[],emailRead:[],emailSend:[],whatsapp:[],paused:false,autonomousSend:false},snapshot:{lifecycle:{status:'active'},ai:{chatModel:'saved-model'}} as never};}
describe('trusted common configuration setup for all host runtimes',()=>{
 it('shares one active revision with its prepared AI context and verifies a stable dependency boundary',async()=>{
  const active=configuration(),load=vi.fn(async()=>active),prepare=vi.fn(async()=>context);
  const result=await prepareAgentConfigurationTurn(context,{load,prepare});
  expect(result.configuration).toBe(active);expect(result.claraContext).toBe(context);expect(load).toHaveBeenCalledTimes(2);
  expect(prepare).toHaveBeenCalledWith(context,active.snapshot.ai);
 });
 it('restarts setup if another revision is applied before tools begin',async()=>{
  const first=configuration(),next=configuration('next'),load=vi.fn().mockResolvedValueOnce(first).mockResolvedValue(next),prepare=vi.fn(async()=>context);
  const result=await prepareAgentConfigurationTurn(context,{load,prepare});expect(result.configuration.revisionId).toBe('next');expect(prepare).toHaveBeenCalledTimes(2);
 });
 it('also restarts setup when inherited defaults change without changing the agent revision',async()=>{
  const first=configuration(),next=configuration('revision','b'),load=vi.fn().mockResolvedValueOnce(first).mockResolvedValue(next),prepare=vi.fn(async()=>context);
  expect((await prepareAgentConfigurationTurn(context,{load,prepare})).configuration.dependencyFingerprint).toBe('b'.repeat(64));expect(prepare).toHaveBeenCalledTimes(2);
 });
 it('does not begin tool execution under continuously changing configuration',async()=>{
  const load=vi.fn().mockResolvedValueOnce(configuration('one')).mockResolvedValueOnce(configuration('two')).mockResolvedValueOnce(configuration('three')).mockResolvedValueOnce(configuration('four')),prepare=vi.fn(async()=>context);
  await expect(prepareAgentConfigurationTurn(context,{load,prepare})).rejects.toThrow('changed');expect(load).toHaveBeenCalledTimes(4);
 });
 it('rejects a different tenant or paused agent before preparing provider settings',async()=>{
  const active=configuration(),load=vi.fn(async()=>({...active,organizationId:'other'})),prepare=vi.fn(async()=>context);
  await expect(prepareAgentConfigurationTurn(context,{load,prepare})).rejects.toThrow();expect(prepare).not.toHaveBeenCalled();
  const paused=configuration();paused.snapshot.lifecycle.status='paused';
  await expect(prepareAgentConfigurationTurn(context,{load:vi.fn(async()=>paused),prepare})).rejects.toThrow();expect(prepare).not.toHaveBeenCalled();
 });
});
