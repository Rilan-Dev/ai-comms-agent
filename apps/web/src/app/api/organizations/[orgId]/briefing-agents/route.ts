import {NextResponse} from 'next/server';
import {PostgresAgentRepository,listGrantedBriefingMailboxes,query} from '@ai-comms-agent/db';
import {asOrganizationId,ForbiddenError} from '@ai-comms-agent/shared';
import {authorize,authorizationErrorToResponse} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {briefingsEnabled} from '@/lib/briefings/config';
export const dynamic='force-dynamic';
type Choice={agentId:string;name:string;mailboxes:Array<{id:string;emailAddress:string}>};
export async function GET(request:Request,context:{params:Promise<{orgId:string}>}){
  if(!briefingsEnabled())return NextResponse.json({error:'not_found'},{status:404});
  try{
    const {orgId}=await context.params;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId))return NextResponse.json({error:'validation_error'},{status:400});
    const subject=await authorize(request,{organizationId:asOrganizationId(orgId),permission:'email.read'},getIdentityAdapter(),getIdentityRepository());
    const agents:Choice[]=[];const setup:Choice[]=[];
    for(const agent of await new PostgresAgentRepository().list(orgId)){
      if(agent.status!=='active')continue;
      let mailboxes:Choice['mailboxes'];
      try{mailboxes=await listGrantedBriefingMailboxes({organizationId:orgId,userId:subject.user.id,agentId:agent.id});}
      catch(error){if(error instanceof ForbiddenError)continue;throw error;}
      if(mailboxes.length)agents.push({agentId:agent.id,name:agent.name,mailboxes});
      else if(subject.permissions.has('briefing.access.manage')){
        const result=await query<{id:string;emailAddress:string}>(`SELECT e.id,e.email_address AS "emailAddress"
          FROM agent_email_accounts b JOIN email_accounts e ON e.id=b.email_account_id
          WHERE b.agent_id=$2 AND e.organization_id=$1 AND e.deleted_at IS NULL AND e.status='connected'
            AND b.role IN ('primary','read_only') ORDER BY e.email_address,e.id`,[orgId,agent.id]);
        if(result.rows.length)setup.push({agentId:agent.id,name:agent.name,mailboxes:result.rows});
      }
    }
    return NextResponse.json({agents,setup,userId:subject.user.id,defaultAgentId:agents.length===1?agents[0]!.agentId:null},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return authorizationErrorToResponse(error);}
}
