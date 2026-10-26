import {describe,expect,it} from 'vitest';
import {assignConfigurationChannels,planConfigurationChannelRemoval} from '../src/lib/agents/configuration-channel-edits';
const active={email:[{accountId:'first',role:'primary' as const},{accountId:'second',role:'primary' as const}],whatsappAccountId:'active-phone'};
describe('channel controls match active and staged access',()=>{
 it('updates exactly one mailbox role without dropping other primary accounts or the phone',()=>{
  const next=assignConfigurationChannels(active,{emailAccountId:'second',emailRole:'read_only',whatsappAccountId:''});
  expect(next).toEqual({email:[{accountId:'first',role:'primary'},{accountId:'second',role:'read_only'}],whatsappAccountId:'active-phone'});expect(active.email[1]?.role).toBe('primary');
 });
 it('removes a new staged mailbox from its draft without pretending to revoke live access',()=>{
  const candidate=assignConfigurationChannels(active,{emailAccountId:'new',emailRole:'send_only'});
  expect(planConfigurationChannelRemoval(active,candidate,{emailAccountId:'new'})).toEqual({kind:'draft',channels:active});
 });
 it('revokes an actively assigned mailbox even if its role was edited in a draft',()=>{
  const candidate=assignConfigurationChannels(active,{emailAccountId:'first',emailRole:'read_only'});
  expect(planConfigurationChannelRemoval(active,candidate,{emailAccountId:'first'})).toEqual({kind:'revoke',changes:{email:[{accountId:'first',access:'all'}]}});
 });
 it('removes only a staged replacement phone and never revokes the old live phone by mistake',()=>{
  const candidate=assignConfigurationChannels(active,{whatsappAccountId:'new-phone'});
  expect(planConfigurationChannelRemoval(active,candidate,{whatsappAccountId:'new-phone'})).toEqual({kind:'draft',channels:active});
  expect(planConfigurationChannelRemoval(active,active,{whatsappAccountId:'active-phone'})).toEqual({kind:'revoke',changes:{whatsappAccountId:'active-phone'}});
 });
});
