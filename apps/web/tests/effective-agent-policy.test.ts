import {describe,expect,it} from 'vitest';
import {describeEffectiveAgentPolicy} from '../src/lib/agents/effective-policy';
import {EMAIL_PERMISSION_PRESETS,emailPermissionPresetSelection,summarizeEmailPermissionChanges} from '../src/lib/agents/email-permission-presets';
import {WHATSAPP_POLICY_CHOICES} from '../src/lib/agents/whatsapp-permission-choices';
import {collectSenderEntries,splitSenderEntries} from '../src/lib/agents/sender-entries';
describe('one allowlist and independent approval mode',()=>{
 it.each([false,true])('automatic=%s cannot grant a missing email or WhatsApp tool',automatic=>{
  const summary=describeEffectiveAgentPolicy({allowedTools:[],autonomousSend:automatic});
  expect(summary.email.mode).toBe('off');expect(summary.whatsapp.mode).toBe('off');
 });
 it.each([false,true])('enabled tools follow saved automatic=%s without changing the allowlist',automatic=>{
  const allowedTools=['email.send.request','whatsapp.send','custom.unknown'];const before=[...allowedTools];
  const summary=describeEffectiveAgentPolicy({allowedTools,autonomousSend:automatic});
  expect(summary.email.mode).toBe(automatic?'automatic':'review');expect(summary.whatsapp.mode).toBe(automatic?'automatic':'review');expect(allowedTools).toEqual(before);
  expect(summary.email.canRequest).toBeNull();
 });
 it.each([false,true])('explicit human review restricts automatic=%s',automatic=>{
  const summary=describeEffectiveAgentPolicy({allowedTools:['email.send.request','whatsapp.send'],autonomousSend:automatic,requireHumanApproval:true});
  expect(summary.email.mode).toBe('review');expect(summary.whatsapp.mode).toBe('review');
 });
 it.each(['email','whatsapp'] as const)('does not confuse %s tool selection with current actor or account access',channel=>{
  const input={allowedTools:['email.send.request','whatsapp.send'],autonomousSend:true};
  expect(describeEffectiveAgentPolicy({...input,[channel]:{actorAllowed:false,accountReady:true}})[channel].canRequest).toBe(false);
  expect(describeEffectiveAgentPolicy({...input,[channel]:{actorAllowed:true,accountReady:false}})[channel].canRequest).toBe(false);
  expect(describeEffectiveAgentPolicy({...input,[channel]:{actorAllowed:true,accountReady:true}})[channel].canRequest).toBe(true);
 });
 it.each(['read','draft','approval','off'] as const)('derives %s from the actual tools instead of storing a second flag',preset=>{
  const tools=emailPermissionPresetSelection(['custom.unknown'],preset);
  expect(describeEffectiveAgentPolicy({allowedTools:tools,autonomousSend:false}).emailPreset).toBe(preset);expect(tools).toContain('custom.unknown');
 });
 it('reports individual or unknown email grants as Custom',()=>{
  expect(describeEffectiveAgentPolicy({allowedTools:['email.search'],autonomousSend:false}).emailPreset).toBe('custom');
  expect(describeEffectiveAgentPolicy({allowedTools:[...emailPermissionPresetSelection([],'read'),'email.future'],autonomousSend:false}).emailPreset).toBe('custom');
 });
 it('retains broad-off semantics for future email permissions',()=>expect(emailPermissionPresetSelection(['email.future','whatsapp.send'],'off')).toEqual(['whatsapp.send']));
 it('does not promise mandatory human approval when the independent sending mode may be automatic',()=>{
  expect(EMAIL_PERMISSION_PRESETS.find(preset=>preset.id==='approval')!.description).not.toMatch(/never auto-send/);
  expect(WHATSAPP_POLICY_CHOICES.find(tool=>tool.name==='whatsapp.send')!.detail).not.toMatch(/Never send automatically/);
  expect(summarizeEmailPermissionChanges([],['email.send.request']).confirmation).toContain('sending mode');
 });
});
describe('entry-aware sender lists retain the existing string-array contract',()=>{
 it('accepts comma and newline paste without inventing wildcard or address validation',()=>expect(splitSenderEntries('  *@example.test, legacy value\nthird@example.test\r\n')).toEqual(['*@example.test','legacy value','third@example.test']));
 it('round-trips all100 existing entries and literal commas in an individual saved entry',()=>{
  const entries=Array.from({length:100},(_,i)=>i===0?'Legacy, literal comma':`sender-${i}`);const form=new FormData();for(const entry of entries)form.append('allowedSenders',entry);form.append('allowedSenders','  ');
  expect(collectSenderEntries(form,'allowedSenders')).toEqual(entries);
 });
 it('includes the not-yet-added typed entry when saving the form',()=>{const form=new FormData();form.append('blockedSenders','saved');form.append('blockedSenders',' still typing ');expect(collectSenderEntries(form,'blockedSenders')).toEqual(['saved','still typing']);});
});
