import {describe,expect,it,vi} from 'vitest';
import {AGENT_AI_CONFIGURATION_FIELDS,type AgentAiConfiguration} from '@ai-comms-agent/shared';
import {reviewConfigurationModels,type ConfigurationModelReviewDependencies} from '../src/lib/agents/configuration-model-review';

const settings=()=>Object.fromEntries(AGENT_AI_CONFIGURATION_FIELDS.map(key=>[key,null])) as AgentAiConfiguration;
function dependencies():ConfigurationModelReviewDependencies{return {
 defaults:{chatProvider:'openai',chatModel:'current-default',voiceChatProvider:'sarvam',realtimeVoiceProviderOverride:'elevenlabs',embeddingProvider:'openai'},
 catalog:vi.fn(async()=>({available:true,source:'live' as const,models:['valid-model','current-default']})),
};}
describe('host-owned model validation for exact configuration review',()=>{
 it('keeps unchanged custom models without replacing or validating them',async()=>{
  const before=settings();before.chatModel='saved-unsupported-model';const deps=dependencies();
  expect(await reviewConfigurationModels(before,{...before,temperatureOverride:0.4},[],deps)).toEqual({});
  expect(deps.catalog).not.toHaveBeenCalled();
 });
 it('validates a changed model against its effective inherited provider',async()=>{
  const before=settings(),deps=dependencies();
  const checks=await reviewConfigurationModels(before,{...before,chatModel:'valid-model'},[],deps);
  expect(deps.catalog).toHaveBeenCalledWith('openai','chat');
  expect(checks.chatModel).toMatchObject({value:'valid-model',status:'verified'});
 });
 it('does not accept a client claim that an unknown model is verified',async()=>{
  const before=settings(),deps=dependencies();
  await expect(reviewConfigurationModels(before,{...before,chatModel:'unknown'},[],deps)).rejects.toThrow('custom');
 });
 it('allows an explicitly reviewed custom model without claiming provider verification',async()=>{
  const before=settings(),deps=dependencies();
  expect((await reviewConfigurationModels(before,{...before,chatModel:'unknown'},['chatModel'],deps)).chatModel).toEqual({value:'unknown',status:'custom_accepted'});
 });
 it('rechecks the existing model under a changed provider instead of transferring model availability',async()=>{
  const before=settings();before.chatModel='old-provider-only';const deps=dependencies();
  await expect(reviewConfigurationModels(before,{...before,chatProvider:'gemini'},[],deps)).rejects.toThrow('custom');
  expect(deps.catalog).toHaveBeenCalledWith('gemini','chat');
 });
 it('does not label vendor-documented models as account-verified',async()=>{
  const before=settings(),deps=dependencies();deps.catalog=vi.fn(async()=>({available:true,source:'documented' as const,models:['documented-model']}));
  await expect(reviewConfigurationModels(before,{...before,voiceChatTtsModel:'documented-model'},[],deps)).rejects.toThrow('custom');
  expect((await reviewConfigurationModels(before,{...before,voiceChatTtsModel:'documented-model'},['voiceChatTtsModel'],deps)).voiceChatTtsModel?.status).toBe('custom_accepted');
 });
 it('does not treat custom acceptance as a replacement for saved provider access',async()=>{
  const before=settings(),deps=dependencies();deps.catalog=vi.fn(async()=>({available:false,source:'unavailable' as const,models:[]}));
  await expect(reviewConfigurationModels(before,{...before,chatModel:'unknown'},['chatModel'],deps)).rejects.toThrow('provider');
 });
 it('resetting an override retains null inheritance rather than pinning the resolved default',async()=>{
  const before=settings();before.chatModel='old-custom';const after={...before,chatModel:null};
  const checks=await reviewConfigurationModels(before,after,[],dependencies());
  expect(checks.chatModel?.value).toBeNull();expect(after.chatModel).toBeNull();
 });
 it('groups compatible checks into one provider lookup and rejects unrelated custom acknowledgements',async()=>{
  const before=settings(),deps=dependencies();
  await reviewConfigurationModels(before,{...before,chatProvider:'gemini',chatModel:'valid-model'},[],deps);
  expect(deps.catalog).toHaveBeenCalledTimes(1);
  await expect(reviewConfigurationModels(before,before,['unknown-field'],deps)).rejects.toThrow('acknowledgement');
 });
});
