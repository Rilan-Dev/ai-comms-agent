import {describe,expect,it,vi} from 'vitest';
import {getAgentOperationalSummary} from '../src/lib/agents/operational-summary';

describe('agent operational summary access',()=>{
 it('does not query protected approval sources without their permissions',async()=>{
  const query=vi.fn();
  const result=await getAgentOperationalSummary({organizationId:'org',agentId:'agent',permissions:new Set()},query);
  expect(result).toEqual({emailApprovals:null,whatsappApprovals:null});expect(query).not.toHaveBeenCalled();
 });
 it('returns only available counts for the exact organization and agent',async()=>{
  const query=vi.fn(async(_sql:string,_params:string[])=>({rows:[{count:'3'}]}));
  const result=await getAgentOperationalSummary({organizationId:'org',agentId:'agent',permissions:new Set(['organization.update'])},query);
  expect(result).toEqual({emailApprovals:3,whatsappApprovals:null});
  expect(query).toHaveBeenCalledOnce();expect(query.mock.calls[0]?.[1]).toEqual(['org','agent']);
 });
 it('keeps a missing database result unknown rather than claiming zero approvals',async()=>{
  const query=vi.fn(async()=>({rows:[]}));
  const result=await getAgentOperationalSummary({organizationId:'org',agentId:'agent',permissions:new Set(['organization.update'])},query);
  expect(result.emailApprovals).toBeNull();
 });
 it('keeps email counts hidden when only WhatsApp read access is granted',async()=>{
  const query=vi.fn(async(_sql:string,_params:string[])=>({rows:[{count:'2'}]}));
  const result=await getAgentOperationalSummary({organizationId:'org',agentId:'agent',permissions:new Set(['whatsapp.read'])},query);
  expect(result).toEqual({emailApprovals:null,whatsappApprovals:2});expect(query).toHaveBeenCalledOnce();
 });
});
