import {describe,it,expect} from 'vitest';
import {deriveWhatsAppReadiness} from '@ai-comms-agent/shared';

const account={id:'bound-account',label:'Test phone',status:'connected'};
describe('shared WhatsApp readiness',()=>{
 it('does not label loading or failed lookups as disconnected',()=>{
  expect(deriveWhatsAppReadiness({loaded:false,account:null,canSend:true,toolEnabled:true,windowOpen:null}).state).toBe('loading');
  expect(deriveWhatsAppReadiness({loaded:true,error:true,account:null,canSend:true,toolEnabled:true,windowOpen:null}).state).toBe('unavailable');
 });
 it('preserves connection status when the saved send tool is disabled',()=>{
  const readiness=deriveWhatsAppReadiness({loaded:true,account,canSend:true,toolEnabled:false,windowOpen:null});
  expect(readiness.state).toBe('bound_without_permission');expect(readiness.connected).toBe(true);expect(readiness.message).toContain('saved agent policy');
 });
 it('distinguishes missing actor permission from disconnected service',()=>{
  const readiness=deriveWhatsAppReadiness({loaded:true,account,canSend:false,toolEnabled:true,windowOpen:null});
  expect(readiness.state).toBe('bound_without_permission');expect(readiness.connected).toBe(true);expect(readiness.canRequestSend).toBe(false);
 });
 it('explains the closed-window prerequisite without claiming delivery readiness',()=>{
  const readiness=deriveWhatsAppReadiness({loaded:true,account,canSend:true,toolEnabled:true,windowOpen:false});
  expect(readiness.state).toBe('template_required');expect(readiness.message).toMatch(/approved template|inbound/i);
 });
 it('ready means ready to request human approval',()=>{
  const readiness=deriveWhatsAppReadiness({loaded:true,account,canSend:true,toolEnabled:true,windowOpen:true});
  expect(readiness.state).toBe('ready');expect(readiness.message).toContain('human approval');
 });
});
