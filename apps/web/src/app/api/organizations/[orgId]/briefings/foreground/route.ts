import {NextResponse} from 'next/server';
import {recordForegroundActivity} from '@ai-comms-agent/db';
import {asOrganizationId} from '@ai-comms-agent/shared';
import {authorize,authorizationErrorToResponse} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {assertSameOrigin} from '@/lib/identity/local-auth';
import {briefingsEnabled} from '@/lib/briefings/config';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,context:{params:Promise<{orgId:string}>}){
  if(!briefingsEnabled())return NextResponse.json({error:'not_found'},{status:404});
  try{assertSameOrigin(request);}catch{return NextResponse.json({error:'invalid_origin'},{status:403});}
  try{
    const {orgId}=await context.params;const body=await request.json().catch(()=>null);
    if(!uuid.test(orgId)||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='agentId')||typeof body.agentId!=='string'||!uuid.test(body.agentId))return NextResponse.json({error:'validation_error'},{status:422});
    const subject=await authorize(request,{organizationId:asOrganizationId(orgId),permission:'email.read'},getIdentityAdapter(),getIdentityRepository());
    await recordForegroundActivity({organizationId:orgId,userId:subject.user.id,agentId:body.agentId});
    return new Response(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return authorizationErrorToResponse(error);}
}
