import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ForbiddenError} from '@ai-comms-agent/shared';
const mock=vi.hoisted(()=>({get:vi.fn(),run:vi.fn(),origin:vi.fn()}));
vi.mock('@/lib/agents/configuration-commands',()=>({getAgentConfigurationView:mock.get,runAgentConfigurationCommand:mock.run,ConfigurationCommandInputError:class extends Error{code='invalid_configuration_command'}}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:mock.origin}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{}}));
import {GET,POST} from '../src/app/api/agents/[id]/configuration/route';
const org='10000000-0000-4000-8000-000000000001',agent='20000000-0000-4000-8000-000000000001';
const context={params:Promise.resolve({id:agent})};
const read=()=>new Request(`https://example.test/api/agents/${agent}/configuration?organizationId=${org}`);
const write=(body:unknown)=>new Request(`https://example.test/api/agents/${agent}/configuration?organizationId=${org}`,{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mock.origin.mockReset();vi.stubEnv('DATABASE_URL','test-only');mock.get.mockResolvedValue({active:{id:'active'}});mock.run.mockResolvedValue({draft:{id:'draft'}});});afterEach(()=>vi.unstubAllEnvs());
describe('manual configuration endpoint transport',()=>{
 it('uses URL scope and returns private uncached state',async()=>{const response=await GET(read(),context);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(mock.get).toHaveBeenCalledWith(expect.any(Request),{organizationId:org,agentId:agent});});
 it('checks origin before any mutation',async()=>{mock.origin.mockImplementation(()=>{throw Error('origin');});expect((await POST(write({command:'save'}),context)).status).toBe(403);expect(mock.run).not.toHaveBeenCalled();});
 it('accepts only URL organization scope and does not forward spoofed body scope',async()=>{expect((await POST(write({command:'save',organizationId:'other'}),context)).status).toBe(422);expect(mock.run).not.toHaveBeenCalled();});
 it('rejects malformed identifiers and unavailable database before invoking commands',async()=>{expect((await GET(new Request('https://example.test/configuration?organizationId=invalid'),context)).status).toBe(422);vi.stubEnv('DATABASE_URL','');expect((await POST(write({command:'save'}),context)).status).toBe(503);expect(mock.run).not.toHaveBeenCalled();});
 it('maps current authority failures and conflicts without exposing SQL error text',async()=>{
  mock.run.mockRejectedValueOnce(new ForbiddenError('missing_permission'));expect((await POST(write({command:'save'}),context)).status).toBe(403);
  mock.run.mockRejectedValueOnce(Object.assign(Error('private sql detail'),{code:'configuration_changed'}));const conflict=await POST(write({command:'apply'}),context);expect(conflict.status).toBe(409);expect(JSON.stringify(await conflict.json())).not.toContain('private sql');
  mock.run.mockRejectedValueOnce(Error('private sql detail'));const failure=await POST(write({command:'save'}),context);expect(failure.status).toBe(500);expect(JSON.stringify(await failure.json())).not.toContain('private sql');
 });
});
