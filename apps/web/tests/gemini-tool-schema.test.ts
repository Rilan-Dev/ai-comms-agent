import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({query:mock.query,decryptCredential:()=>Buffer.from('fixture-key'),parseCredentialsMasterKey:()=>new Uint8Array(32)}));
import {claraRuntime} from '../../../packages/clara-core/src/runtime';
beforeEach(()=>{
  vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('CREDENTIALS_MASTER_KEY','test-only');
  mock.query.mockImplementation(async(sql:string)=>({rows:sql.includes('organization_ai_runtime_settings')?[{default_provider:'gemini',temperature:0.2,max_tokens:1500,system_prompt:'Use registered tools.'}]:sql.includes('ai_provider_configs')?[{model:'gemini-2.5-flash',encrypted_api_key:Buffer.from('fixture'),config:{},enabled:true}]:[]}));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it('sends full JSON Schema through Gemini parametersJsonSchema, preserving nested constraints',async()=>{
  const parameters={type:'object',additionalProperties:false,properties:{account_id:{type:'string'},filter:{type:'object',additionalProperties:false,properties:{unread:{type:'boolean'}}}},required:['account_id']};
  const fetch=vi.fn(async(_url:unknown,options?:RequestInit)=>{
    const payload=JSON.parse(String(options?.body));
    const declaration=payload.tools[0].functionDeclarations[0];
    if(declaration.parameters)return new Response(JSON.stringify({error:{message:'Unknown name additionalProperties in parameters'}}),{status:400});
    expect(declaration.parametersJsonSchema).toEqual(parameters);
    expect(declaration).not.toHaveProperty('parameters');
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{functionCall:{name:'email.search',args:{account_id:'mailbox'}}}]}}]});
  });
  vi.stubGlobal('fetch',fetch);
  const result=await claraRuntime.completeWithTools({orgId:'org',agentId:'agent',kbId:'',skipGrounding:true},[{role:'user',content:'Search mail'}],[{name:'email.search',description:'Search authorized mail',parameters}]);
  expect(result.toolCalls).toEqual([expect.objectContaining({name:'email.search',arguments:{account_id:'mailbox'}})]);
  expect(fetch).toHaveBeenCalledTimes(1);
});
