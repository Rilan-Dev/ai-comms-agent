import {NextResponse} from "next/server";
import {recordForegroundActivity} from "@ai-comms-agent/db";
import {asOrganizationId} from "@ai-comms-agent/shared";
import {authorize,authorizationErrorToResponse} from "@/lib/identity/authorization";
import {getIdentityAdapter,getIdentityRepository} from "@/lib/identity/repository";
import {assertSameOrigin} from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"private, no-store"};

/** Foreground visit only; this never reviews, reads, sends or generates mail.
 * The canonical database helper rechecks user/agent grants before writing. */
export async function POST(request:Request){
  try {assertSameOrigin(request);}
  catch {return NextResponse.json({error:"invalid_origin"},{status:403,headers});}
  try {
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=="object"||Array.isArray(body)
      || Object.keys(body).some(key=>!["organizationId","agentId"].includes(key))
      || typeof body.organizationId!=="string"||!uuid.test(body.organizationId)
      || typeof body.agentId!=="string"||!uuid.test(body.agentId))
      return NextResponse.json({error:"validation_error"},{status:422,headers});
    const subject=await authorize(request,{organizationId:asOrganizationId(body.organizationId),permission:"email.read"},getIdentityAdapter(),getIdentityRepository());
    await recordForegroundActivity({organizationId:body.organizationId,userId:subject.user.id,agentId:body.agentId});
    return new Response(null,{status:204,headers});
  }catch(error){return authorizationErrorToResponse(error);}
}
