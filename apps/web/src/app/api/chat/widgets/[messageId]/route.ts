import {NextResponse} from 'next/server';
import {PostgresAgentRepository,loadActiveAgentConfiguration} from '@ai-comms-agent/db';
import {asOrganizationId,type ToolContext,type WhatsAppReadiness} from '@ai-comms-agent/shared';
import {authorize,authorizationErrorToResponse} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {assertSameOrigin} from '@/lib/identity/local-auth';
import {loadWorkflow,replaceWorkflow,reconcileWorkflow} from '@/lib/chat/whatsapp-workflow-store';
import {parseWorkflowCommand,canEditWorkflow,canRenewWorkflow,type WhatsAppWidget} from '@/lib/chat/whatsapp-workflow-contract';
import {GET as readinessGET} from '../../../whatsapp/readiness/route';
import {POST as decisionPOST} from '../../../whatsapp/send-actions/decision/route';
import {createWhatsAppToolRuntime,invokeWhatsAppTool} from '../../../../../../../../apps/worker/src/agent/whatsapp-tool-runtime';

export const dynamic='force-dynamic';
type RouteContext={params:Promise<{messageId:string}>};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function access(request:Request,context:RouteContext){
 const url=new URL(request.url),organizationId=url.searchParams.get('organizationId')??'',agentId=url.searchParams.get('agentId')??'',conversationId=url.searchParams.get('conversationId')??'';
 const {messageId}=await context.params;
 if(!organizationId||!agentId||!conversationId||!messageId)return null;
 const actor=await authorize(request,{organizationId:asOrganizationId(organizationId),permission:'organization.read'},getIdentityAdapter(),getIdentityRepository());
 const scope={organizationId,agentId,conversationId,userId:actor.user.id};
 const widget=await loadWorkflow(scope,messageId);
 return widget?{actor,scope,widget,messageId}:null;
}
export async function GET(request:Request,context:RouteContext){
 try{const found=await access(request,context);return found?json({widget:found.widget}):json({error:'not_found'},404);}
 catch(error){return authorizationErrorToResponse(error);}
}
export async function POST(request:Request,context:RouteContext){
 try{assertSameOrigin(request);}catch{return json({error:'invalid_origin'},403);}
 try{
  const command=parseWorkflowCommand(await request.json().catch(()=>null));
  if(!command)return json({error:'invalid_action',message:'Choose an available action and check the entered details.'},422);
  const found=await access(request,context);
  if(!found)return json({error:'not_found'},404);
  const {actor,scope,messageId,widget}=found;
  if(widget.revision!==command.revision)return json({error:'stale_state',widget,message:'This card changed in another tab. Review its latest state.'},409);
  const agent=await new PostgresAgentRepository().get(scope.organizationId,scope.agentId);
  if(!agent||agent.status!=='active')return json({error:'agent_unavailable',message:'This assistant is paused or unavailable. Resume it before continuing.'},409);
  const reconciled=await reconcileWorkflow(scope,widget);
  const save=async(next:WhatsAppWidget)=>{
   const saved=await replaceWorkflow(scope,messageId,widget,next);
   return saved?json({widget:saved}):json({error:'stale_state',message:'Another action changed this card. Refresh its status.'},409);
  };
  if(command.action==='refresh')return save(reconciled);
  if(reconciled.actionId!==widget.actionId||reconciled.status!==widget.status)return save(reconciled);
  if(command.action==='renew'){
   if(!canRenewWorkflow(widget))return json({error:'renewal_unavailable',message:'Check the saved result first. An uncertain or queued request cannot be repeated.'},409);
   // The old send action remains in the audit history. Renewal only opens
   // an editor; fresh permission checks, review and approval are still required.
   return save({...widget,turnId:crypto.randomUUID(),reference:crypto.randomUUID(),actionId:null,status:'draft',readiness:null,accountId:null,accountLabel:null,expiresAt:new Date(Date.now()+86400000).toISOString(),notice:'Review these details again. No new send request has been created.'});
  }
  if(['approve','reject'].includes(command.action)){
   if(!actor.permissions.has('whatsapp.send'))return json({error:'permission_denied',message:'Your current role cannot approve WhatsApp messages.'},403);
   if(!widget.actionId||!(widget.status==='pending'||(widget.status==='approved'&&command.action==='approve')))return json({error:'not_pending',widget},409);
   // Reuse the exact production approval boundary. The client never supplies
   // an arbitrary action ID, recipient, tool name or approval payload.
   const claimed=await replaceWorkflow(scope,messageId,widget,{...widget,status:'requesting'});
   if(!claimed)return json({error:'stale_state'},409);
   let notice='';
   try{
    const response=await decisionPOST(new Request(new URL('/api/whatsapp/send-actions/decision',request.url),{method:'POST',headers:request.headers,body:JSON.stringify({organizationId:scope.organizationId,actionId:widget.actionId,decision:command.action})}));
    if(!response.ok){const data=await response.json();notice=typeof data.message==='string'?data.message:'Approval was not accepted. Check the current connection and request status.';}
   }catch{notice='Approval status could not be confirmed. Refresh status before trying again.';}
   const current=await reconcileWorkflow(scope,claimed);
   const saved=await replaceWorkflow(scope,messageId,claimed,{...current,notice});
   return json({widget:saved??current});
  }
  if(!canEditWorkflow(widget.status))return json({error:'locked',widget,message:'This request already has an outcome. Refresh its status before creating another.'},409);
  if(Date.parse(widget.expiresAt)<=Date.now())return json({error:'workflow_expired',widget,message:'This editor expired. Choose Start a fresh review to continue here.'},409);
  if(command.action==='save')return save({...widget,...command.input!,status:'draft',readiness:null,notice:''});

  const url=new URL('/api/whatsapp/readiness',request.url);
  url.searchParams.set('organizationId',scope.organizationId);url.searchParams.set('agentId',scope.agentId);
  if(widget.recipient)url.searchParams.set('recipient',widget.recipient);
  const response=await readinessGET(new Request(url,{headers:request.headers}));
  if(!response.ok)return json({error:'check_unavailable',message:'The setup check could not complete. Your entries are saved; try the check again.'},response.status);
  const readiness=await response.json() as WhatsAppReadiness;
  const checked={...widget,readiness,accountId:readiness.accountId??null,accountLabel:readiness.accountLabel??null};
  if(command.action==='inspect')return save({...checked,status:'draft'});
  if(!actor.permissions.has('whatsapp.send'))return json({error:'permission_denied',message:'Your current role cannot request WhatsApp sending.'},403);
  if(!widget.recipient||!widget.body.trim())return json({error:'missing_details',message:'Add the recipient and message before review.'},422);
  if(!readiness.canRequestSend||readiness.state!=='ready'||readiness.windowOpen!==true)return save({...checked,status:'draft',notice:'Free-form messaging is not ready. Check the setup details below before proceeding.'});
  if(command.action==='review')return save({...checked,status:'review',notice:''});
  if(widget.status!=='review'||!widget.accountId||widget.accountId!==readiness.accountId)return json({error:'review_required',message:'The sending phone or message needs a fresh review.'},409);
  const configuration=process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED==='true'?await loadActiveAgentConfiguration({organizationId:scope.organizationId,agentId:scope.agentId}):undefined;
  if(configuration?.snapshot.lifecycle.status&&configuration.snapshot.lifecycle.status!=='active')return json({error:'agent_unavailable'},409);
  const trusted:ToolContext={organization_id:scope.organizationId,agent_id:scope.agentId,user_id:scope.userId,conversation_id:scope.conversationId,turn_id:widget.turnId,correlation_id:widget.reference,channel:'chat',require_human_approval:true,
   auth_subject:{user_id:scope.userId,role:actor.membership!.role,permissions:[...actor.permissions]},...(configuration?{agent_configuration:configuration}:{})};
  const claimed=await replaceWorkflow(scope,messageId,widget,{...checked,status:'requesting'});
  if(!claimed)return json({error:'stale_state'},409);
  let notice='';
  try{
   const runtime=await createWhatsAppToolRuntime(scope.organizationId,scope.agentId);
   const result=await invokeWhatsAppTool(runtime,'whatsapp.send',{account_id:widget.accountId,to:widget.recipient,payload_type:'text',body:widget.body},trusted);
   if(!result.ok)notice='The request was not accepted. Recheck this assistant’s phone and send permission.';
  }catch{notice='The request outcome is not confirmed. Refresh status before trying again.';}
  const current=await reconcileWorkflow(scope,claimed);
  const saved=await replaceWorkflow(scope,messageId,claimed,{...current,notice});
  return json({widget:saved??current});
 }catch(error){return authorizationErrorToResponse(error);}
}
