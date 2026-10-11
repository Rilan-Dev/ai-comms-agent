import { NextResponse } from "next/server";
import { listAuditEvents } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  if(!process.env.DATABASE_URL)return NextResponse.json({error:"database_not_configured",message:"PostgreSQL is required for audit history."},{status:503});
  await ensureDevSeed(); const {id}=await params; const url=new URL(request.url); const organizationId=url.searchParams.get("organizationId")??"";
  if(!organizationId)return NextResponse.json({error:"validation_error",fieldErrors:{organizationId:"Organization is required."}},{status:400});
  await authorize(request,{organizationId:asOrganizationId(organizationId),permission:"audit.read"},getIdentityAdapter(),getIdentityRepository());
  const limit=Number(url.searchParams.get("limit")??"50");
  return NextResponse.json({events:await listAuditEvents(organizationId,id,Number.isFinite(limit)?limit:50)});
 }catch(error){return authorizationErrorToResponse(error);}
}