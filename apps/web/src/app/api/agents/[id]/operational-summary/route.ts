import {NextResponse} from 'next/server';
import {PostgresAgentRepository,query} from '@ai-comms-agent/db';
import {asOrganizationId} from '@ai-comms-agent/shared';
import {authorize,authorizationErrorToResponse} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {getAgentOperationalSummary} from '@/lib/agents/operational-summary';

export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  if(!process.env.DATABASE_URL)return NextResponse.json({error:'database_not_configured'},{status:503});
  const organizationId=new URL(request.url).searchParams.get('organizationId')?.trim();
  if(!organizationId)return NextResponse.json({error:'organization_required'},{status:400});
  const subject=await authorize(request,{organizationId:asOrganizationId(organizationId),permission:'organization.read'},getIdentityAdapter(),getIdentityRepository());
  const {id}=await params;
  if(!await new PostgresAgentRepository().get(organizationId,id))return NextResponse.json({error:'not_found'},{status:404});
  const summary=await getAgentOperationalSummary({organizationId,agentId:id,permissions:subject.permissions},(sql,values)=>query<{count:string}>(sql,values));
  return NextResponse.json(summary,{headers:{'cache-control':'private, no-store'}});
 }catch(error){return authorizationErrorToResponse(error);}
}
