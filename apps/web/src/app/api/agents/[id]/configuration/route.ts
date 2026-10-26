import {NextResponse} from 'next/server';
import {ForbiddenError,UnauthorizedError} from '@ai-comms-agent/shared';
import {ConfigurationCommandInputError,getAgentConfigurationView,runAgentConfigurationCommand} from '@/lib/agents/configuration-commands';
import {ConfigurationModelReviewRequiredError} from '@/lib/agents/configuration-model-review';
import {assertSameOrigin} from '@/lib/identity/local-auth';
import {ensureDevSeed} from '@/lib/identity/repository';

export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={'cache-control':'private, no-store'};
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers});}
function failure(error:unknown){
 if(error instanceof UnauthorizedError)return response({error:'unauthorized',message:'Sign in to continue.'},401);
 if(error instanceof ForbiddenError)return response({error:'forbidden',message:'Your current access does not allow this configuration change.'},403);
 if(error instanceof ConfigurationCommandInputError)return response({error:'validation_error',message:error.message},422);
 if(error instanceof ConfigurationModelReviewRequiredError)return response({error:error.code,reason:error.reason,fields:error.fields,message:error.message},422);
 if(error&&typeof error==='object'&&'code' in error&&error.code==='configuration_changed')return response({error:'configuration_changed',message:'Settings changed. Reload and review your choices again.'},409);
 // Provider, JSON validation and SQL diagnostics can contain private details.
 // No raw exception crosses this endpoint.
 return response({error:'configuration_unavailable',message:'The configuration could not be confirmed. Reload the saved settings before retrying.'},500);
}
async function target(request:Request,context:Context){const {id}=await context.params;const organizationId=new URL(request.url).searchParams.get('organizationId')??'';return uuid.test(id)&&uuid.test(organizationId)?{organizationId,agentId:id}:null;}

export async function GET(request:Request,context:Context){
 if(process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED!=='true')return response({error:'not_found'},404);
 if(!process.env.DATABASE_URL)return response({error:'database_not_configured'},503);
 const scope=await target(request,context);if(!scope)return response({error:'validation_error',message:'Choose an organization and agent.'},422);
 try{await ensureDevSeed();return response(await getAgentConfigurationView(request,scope));}catch(error){return failure(error);}
}
export async function POST(request:Request,context:Context){
 if(process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED!=='true')return response({error:'not_found'},404);
 try{assertSameOrigin(request);}catch{return response({error:'invalid_origin'},403);}
 if(!process.env.DATABASE_URL)return response({error:'database_not_configured'},503);
 const scope=await target(request,context);if(!scope)return response({error:'validation_error',message:'Choose an organization and agent.'},422);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.hasOwn(body,'organizationId')||Object.hasOwn(body,'agentId'))return response({error:'validation_error',message:'Use the selected organization and agent.'},422);
 try{await ensureDevSeed();return response(await runAgentConfigurationCommand(request,scope,body));}catch(error){return failure(error);}
}
