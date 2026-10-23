import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('@ai-comms-agent/db',()=>({loadWhatsAppCredential:async()=>({access_token:'private-test-token'}),parseCredentialsMasterKey:()=>new Uint8Array(32)}));
import {getWhatsAppProviderReadiness} from '../src/lib/whatsapp/provider-readiness';
beforeEach(()=>vi.stubEnv('CREDENTIALS_MASTER_KEY','test-only'));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('reports Meta token rejection instead of trusting a stale connected database status',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{code:190,message:'private provider details'}},{status:401})));
 const result=await getWhatsAppProviderReadiness({id:'rejected',organizationId:'org',phoneNumberId:'phone',revision:'1'});
 expect(result.state).toBe('provider_error');expect(JSON.stringify(result)).not.toContain('private');
});
it('distinguishes unavailable provider verification from a disconnected account',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('network timeout');}));
 expect((await getWhatsAppProviderReadiness({id:'unavailable',organizationId:'org',phoneNumberId:'phone',revision:'1'})).state).toBe('unavailable');
});
it('caches a short successful verification and invalidates it after account revision changes',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'phone'})));
 const account={id:'verified',organizationId:'org',phoneNumberId:'phone',revision:'1'};
 expect((await getWhatsAppProviderReadiness(account)).state).toBe('connected');await getWhatsAppProviderReadiness(account);
 expect(fetch).toHaveBeenCalledTimes(1);await getWhatsAppProviderReadiness({...account,revision:'2'});expect(fetch).toHaveBeenCalledTimes(2);
});
