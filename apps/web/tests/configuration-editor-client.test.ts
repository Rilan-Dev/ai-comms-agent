import {describe,expect,it,vi} from 'vitest';
import {sendConfigurationCommand,saveConfigurationForm,restoreConfigurationForm,discardConfigurationForm} from '../src/lib/agents/configuration-editor-client';
describe('original form configuration transport',()=>{
 it('starts a restore as a draft using the displayed active revision and never applies it',async()=>{
  const fetcher=vi.fn(async()=>Response.json({draft:{id:'restored'}}));
  await restoreConfigurationForm({organizationId:'org',agentId:'agent'},{activeRevisionId:'active',draftRevisionId:null},'old',fetcher);
  expect(JSON.parse(String((fetcher.mock.calls[0]! as unknown as [string,RequestInit])[1].body))).toEqual({command:'restore',revisionId:'old',activeRevisionId:'active'});
 });
 it('does not replace an existing draft when starting a restore',async()=>{
  const fetcher=vi.fn();
  await expect(restoreConfigurationForm({organizationId:'org',agentId:'agent'},{activeRevisionId:'active',draftRevisionId:'current'},'old',fetcher)).rejects.toThrow('draft');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('discards only the exact displayed draft against its active revision',async()=>{
  const fetcher=vi.fn(async()=>Response.json({discarded:true}));
  await discardConfigurationForm({organizationId:'org',agentId:'agent'},{activeRevisionId:'active',draftRevisionId:'current'},fetcher);
  expect(JSON.parse(String((fetcher.mock.calls[0]! as unknown as [string,RequestInit])[1].body))).toEqual({command:'discard',context:{activeRevisionId:'active',draftRevisionId:'current'}});
 });
 it('sends only the partial edit and the exact displayed revisions, without refreshing its base',async()=>{
  const fetcher=vi.fn(async()=>Response.json({draft:{id:'next'}}));
  await saveConfigurationForm({organizationId:'org',agentId:'agent'},{activeRevisionId:'shown-active',draftRevisionId:'shown-draft'},{ai:{chatModel:null}},fetcher);
  expect(fetcher).toHaveBeenCalledOnce();const [url,options]=fetcher.mock.calls[0]! as unknown as [string,RequestInit];
  expect(url).toBe('/api/agents/agent/configuration?organizationId=org');expect(options.method).toBe('POST');expect(JSON.parse(String(options.body))).toEqual({command:'save',context:{activeRevisionId:'shown-active',draftRevisionId:'shown-draft'},patch:{ai:{chatModel:null}}});
 });
 it('does not manufacture a current base when a form failed to load',async()=>{
  const fetcher=vi.fn();await expect(saveConfigurationForm({organizationId:'org',agentId:'agent'},null,{identity:{name:'Keep this edit'}},fetcher)).rejects.toThrow('load');expect(fetcher).not.toHaveBeenCalled();
 });
 it('retains an actionable conflict and never retries or applies automatically',async()=>{
  const fetcher=vi.fn(async()=>Response.json({error:'configuration_changed',message:'Reload and compare your choices.'},{status:409}));
  await expect(saveConfigurationForm({organizationId:'org',agentId:'agent'},{activeRevisionId:'old',draftRevisionId:null},{identity:{name:'Keep this edit'}},fetcher)).rejects.toMatchObject({code:'configuration_changed',status:409});expect(fetcher).toHaveBeenCalledOnce();
 });
 it('passes exact safe model requirements back to the review interface',async()=>{
  const fetcher=vi.fn(async()=>Response.json({error:'configuration_review_required',reason:'confirm_model',fields:['chatModel'],message:'Confirm your model.'},{status:422}));
  await expect(sendConfigurationCommand({organizationId:'org',agentId:'agent'},{command:'review',revisionId:'draft'},fetcher)).rejects.toMatchObject({code:'configuration_review_required',reason:'confirm_model',fields:['chatModel']});
 });
});
