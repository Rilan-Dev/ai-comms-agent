import {NextResponse} from "next/server";
import {asOrganizationId} from "@ai-comms-agent/shared";
import {authorize,authorizationErrorToResponse} from "@/lib/identity/authorization";
import {assertSameOrigin} from "@/lib/identity/local-auth";
import {ensureDevSeed,getIdentityAdapter,getIdentityRepository} from "@/lib/identity/repository";
import {listBusinessWorkItems,listBusinessAssignees,changeBusinessWorkItem,recordAuditEvent} from "@ai-comms-agent/db";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function GET(request:Request,{params}:{params:Promise<{orgId:string}>}){
 try{
  await ensureDevSeed();const {orgId}=await params;
  await authorize(request,{organizationId:asOrganizationId(orgId),permission:"organization.read"},getIdentityAdapter(),getIdentityRepository());
  const [items,assignees]=await Promise.all([listBusinessWorkItems(orgId),listBusinessAssignees(orgId)]);
  return NextResponse.json({items,assignees},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return authorizationErrorToResponse(e);}
}
export async function PATCH(request:Request,{params}:{params:Promise<{orgId:string}>}){
 try{assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
 try{
  await ensureDevSeed();const {orgId}=await params, subject=await authorize(request,{organizationId:asOrganizationId((await params).orgId),role:"member"},getIdentityAdapter(),getIdentityRepository());
  const data=await request.json().catch(()=>null);
  const id=typeof data?.id==="string"?data.id:"";
  if(!uuid.test(id))return NextResponse.json({error:"validation_error",message:"Valid work item ID required."},{status:422});
  const assignedUserId=data?.assignedUserId;
  const status=data?.status;
  const reviewStatus=data?.reviewStatus;
  if(assignedUserId!==undefined && assignedUserId!==null && !uuid.test(assignedUserId))
   return NextResponse.json({error:"validation_error",message:"Select an active organization member."},{status:422});
  if(status!==undefined && !["new","in_progress","completed"].includes(status))
   return NextResponse.json({error:"validation_error",message:"Invalid work status."},{status:422});
  if(reviewStatus!==undefined && !["pending","approved","rejected"].includes(reviewStatus))
   return NextResponse.json({error:"validation_error",message:"Invalid review decision."},{status:422});
  if(assignedUserId===undefined&&status===undefined&&reviewStatus===undefined)
   return NextResponse.json({error:"validation_error",message:"No changes requested."},{status:422});
  if(reviewStatus!==undefined)
    await authorize(request,{organizationId:asOrganizationId(orgId),role:"admin"},getIdentityAdapter(),getIdentityRepository());
  const row=await changeBusinessWorkItem({organizationId:orgId,id,actorId:subject.user.id,
   ...(assignedUserId!==undefined?{assignedUserId}:{}),...(status!==undefined?{status}:{}),
   ...(reviewStatus!==undefined?{reviewStatus}:{})});
  if(!row)return NextResponse.json({error:"conflict",message:"Work item unavailable, assignee not active, review not approved, or permission denied."},{status:409});
  await recordAuditEvent({organizationId:orgId,actorUserId:subject.user.id,eventType:"business.work_item.updated",
   targetType:"business_work_item",targetId:id,action:"update",decision:"allowed",
   metadata:{...(status?{status}:{}),...(reviewStatus?{reviewStatus}:{})}});
  return NextResponse.json({item:row},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return authorizationErrorToResponse(e);}
}
