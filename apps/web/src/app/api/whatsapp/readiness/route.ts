import {NextResponse} from 'next/server';
import {PostgresAgentRepository,query} from '@ai-comms-agent/db';
import {asOrganizationId,deriveWhatsAppReadiness} from '@ai-comms-agent/shared';
import {authorize,authorizationErrorToResponse} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {getWhatsAppProviderReadiness} from '@/lib/whatsapp/provider-readiness';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  if(!process.env.DATABASE_URL)return NextResponse.json({error:'database_not_configured',message:'PostgreSQL is required for WhatsApp.'},{status:503});
  const url=new URL(request.url),organizationId=url.searchParams.get('organizationId')??'',agentId=url.searchParams.get('agentId'),accountId=url.searchParams.get('accountId'),recipient=url.searchParams.get('recipient');
  if(!organizationId || (!agentId&&!accountId) || (recipient&&!/^\+[1-9]\d{7,14}$/.test(recipient)))return NextResponse.json({error:'validation_error',message:'Choose an agent or account and a valid international recipient number.'},{status:422});
  const actor=await authorize(request,{organizationId:asOrganizationId(organizationId),permission:'organization.read'},getIdentityAdapter(),getIdentityRepository());
  const policy=agentId?await new PostgresAgentRepository().policy(organizationId,agentId):null;
  const accounts=await query<{id:string;display_name:string|null;phone_number:string|null;phone_number_id:string;status:string;updated_at:string|Date}>(`SELECT w.id,w.display_name,w.phone_number,w.phone_number_id,w.status,w.updated_at FROM whatsapp_accounts w
    WHERE w.organization_id=$1 AND w.deleted_at IS NULL AND w.phone_number_id<>'__webhook_config__'
      AND ($3::text IS NULL OR w.id::text=$3)
      AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM agent_whatsapp_accounts b JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1 WHERE b.whatsapp_account_id=w.id AND b.agent_id::text=$2))
    ORDER BY w.id LIMIT 2`,[organizationId,agentId,accountId]);
  const selected=accounts.rows.length===1?accounts.rows[0]!:null;
  let windowOpen:boolean|null=null;
  let approvedTemplateCount=0;
  let providerUnavailable=false;
  if(selected?.status==='connected'){
    const provider=await getWhatsAppProviderReadiness({id:selected.id,organizationId,phoneNumberId:selected.phone_number_id,revision:String(selected.updated_at)});
    providerUnavailable=provider.state==='unavailable';
    if(provider.state==='provider_error')selected.status='error';
    const templates=await query<{count:number}>(`SELECT COUNT(*)::integer AS count FROM whatsapp_templates WHERE organization_id=$1 AND whatsapp_account_id=$2 AND status='approved'`,[organizationId,selected.id]);
    approvedTemplateCount=Number(templates.rows[0]?.count??0);
    if(recipient){
      const inbound=await query<{id:string}>(`SELECT m.id FROM whatsapp_messages m JOIN whatsapp_contacts c ON c.id=m.contact_id AND c.whatsapp_account_id=m.whatsapp_account_id
        WHERE m.organization_id=$1 AND m.whatsapp_account_id=$2 AND c.phone_number=$3 AND m.direction='inbound'
          AND COALESCE(m.provider_timestamp,m.created_at)>=now()-interval '24 hours' AND COALESCE(m.provider_timestamp,m.created_at)<=now() LIMIT 1`,[organizationId,selected.id,recipient]);
      windowOpen=inbound.rows.length>0;
    }
  }
  const readiness=deriveWhatsAppReadiness({loaded:true,error:providerUnavailable,account:selected?{id:selected.id,label:selected.display_name||selected.phone_number||'WhatsApp account',status:selected.status}:null,
    canSend:actor.permissions.has('whatsapp.send'),toolEnabled:agentId?policy?.allowedTools.includes('whatsapp.send')===true:true,windowOpen});
  return NextResponse.json({...readiness,approvedTemplateCount},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return authorizationErrorToResponse(error);}
}
