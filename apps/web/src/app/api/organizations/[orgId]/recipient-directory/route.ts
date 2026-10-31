import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { query, recordAuditEvent } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";
type Recipient = {id:string; display_name:string; phone_e164:string; recipient_role:"primary"|"secondary"|"contact"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function check(body:unknown) {
 const x=body && typeof body==="object" ? body as Record<string,unknown> : {};
 const name=typeof x.name==="string"?x.name.trim():"";
 const phone=typeof x.phone==="string"?x.phone.replace(/[\s()-]/g,""):"";
 const role=typeof x.role==="string"?x.role:"";
 if(!name||name.length>120)return {error:"Name must be 1–120 characters."};
 if(!/^\+[1-9]\d{7,14}$/.test(phone))return {error:"Use a valid E.164 number, e.g. +919876543210."};
 if(!["primary","secondary","contact"].includes(role))return {error:"Choose primary, secondary, or contact."};
 return {value:{name,phone,role}};
}
function conflict(e:unknown) {
 if((e as {code?:string})?.code==="23505")return NextResponse.json({error:"conflict",message:"This number already exists, or the primary/secondary role is already assigned. Edit the existing entry first."},{status:409});
 return authorizationErrorToResponse(e);
}
function mentionsForRecipient(r:Recipient) {
 return {id:"recipient:"+r.id,category:"recipient",label:r.display_name,detail:r.recipient_role+" · "+r.phone_e164,insertText:"@whatsapp-to:"+r.phone_e164};
}
async function scoped(request:Request,orgId:string) {
 await ensureDevSeed();
 return authorize(request,{organizationId:asOrganizationId(orgId),role:"member"},getIdentityAdapter(),getIdentityRepository());
}
async function list(orgId:string,userId:string) {
 const r=await query<Recipient>("SELECT id::text,display_name,phone_e164,recipient_role FROM personal_whatsapp_recipients WHERE organization_id=$1 AND owner_user_id=$2 AND deleted_at IS NULL ORDER BY CASE recipient_role WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END,display_name",[orgId,userId]);
 return r.rows;
}
export async function GET(request:Request,{params}:{params:Promise<{orgId:string}>}) {
 try {
  const {orgId}=await params; const subject=await scoped(request,orgId);
  const recipients=await list(orgId,subject.user.id);
  const mentions:Array<{id:string;category:string;label:string;detail:string;insertText:string}>=recipients.map(mentionsForRecipient);
  const adapter=getIdentityAdapter(), repository=getIdentityRepository();
  try {
   await authorize(request,{organizationId:asOrganizationId(orgId),permission:"email.read"},adapter,repository);
   const r=await query<{id:string;address:string;label:string|null}>(
     "SELECT id::text,email_address::text AS address,display_name AS label FROM email_accounts WHERE organization_id=$1 AND deleted_at IS NULL ORDER BY email_address LIMIT 100",[orgId]);
   for(const a of r.rows) mentions.push({id:"email:"+a.id,category:"email",label:a.label||a.address,detail:"Email account · "+a.address,insertText:"@email:"+a.address});
  }catch { /* No email grant or configured mailbox; do not expose addresses. */ }
  try {
   await authorize(request,{organizationId:asOrganizationId(orgId),permission:"whatsapp.read"},adapter,repository);
   const r=await query<{id:string;phone:string|null;label:string|null}>(
     "SELECT id::text,phone_number::text AS phone,display_name AS label FROM whatsapp_accounts WHERE organization_id=$1 AND deleted_at IS NULL AND status='connected' AND phone_number_id <> '__webhook_config__' ORDER BY display_name NULLS LAST LIMIT 100",[orgId]);
   for(const a of r.rows) mentions.push({id:"sender:"+a.id,category:"sender",label:a.label||a.phone||"WhatsApp account",detail:"Connected WhatsApp sender · "+(a.phone||"no published number"),insertText:"@whatsapp-from:"+a.id});
  }catch { /* Not authorized to list sender accounts. */ }
  return NextResponse.json({recipients,mentions},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return conflict(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{orgId:string}>}) {
 try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
 try {
  const {orgId}=await params, subject=await scoped(request,orgId);
  const parsed=check(await request.json().catch(()=>null));
  if("error" in parsed)return NextResponse.json({error:"validation_error",message:parsed.error},{status:422});
  const {name,phone,role}=parsed.value;
  const r=await query<Recipient>("INSERT INTO personal_whatsapp_recipients(organization_id,owner_user_id,display_name,phone_e164,recipient_role) VALUES($1,$2,$3,$4,$5) RETURNING id::text,display_name,phone_e164,recipient_role",[orgId,subject.user.id,name,phone,role]);
  const recipient=r.rows[0];
  if(!recipient)throw new Error("Recipient insert returned no row.");
  await recordAuditEvent({organizationId:orgId,actorUserId:subject.user.id,eventType:"recipient.created",targetType:"personal_whatsapp_recipient",targetId:recipient.id,action:"create",decision:"allowed",metadata:{role}});
  return NextResponse.json({recipient},{status:201});
 }catch(e){return conflict(e);}
}
export async function PATCH(request:Request,{params}:{params:Promise<{orgId:string}>}) {
 try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
 try {
  const {orgId}=await params,subject=await scoped(request,orgId);
  const body=await request.json().catch(()=>null);
  const id=typeof body?.id==="string"?body.id:"";
  if(!uuid.test(id))return NextResponse.json({error:"validation_error",message:"Valid contact ID required."},{status:422});
  const parsed=check(body);
  if("error" in parsed)return NextResponse.json({error:"validation_error",message:parsed.error},{status:422});
  const {name,phone,role}=parsed.value;
  const r=await query<Recipient>("UPDATE personal_whatsapp_recipients SET display_name=$4,phone_e164=$5,recipient_role=$6,updated_at=now() WHERE id=$3 AND organization_id=$1 AND owner_user_id=$2 AND deleted_at IS NULL RETURNING id::text,display_name,phone_e164,recipient_role",[orgId,subject.user.id,id,name,phone,role]);
  if(!r.rows[0])return NextResponse.json({error:"not_found"},{status:404});
  await recordAuditEvent({organizationId:orgId,actorUserId:subject.user.id,eventType:"recipient.updated",targetType:"personal_whatsapp_recipient",targetId:id,action:"update",decision:"allowed",metadata:{role}});
  return NextResponse.json({recipient:r.rows[0]});
 }catch(e){return conflict(e);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{orgId:string}>}) {
 try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
 try {
  const {orgId}=await params,subject=await scoped(request,orgId),id=new URL(request.url).searchParams.get("id")||"";
  if(!uuid.test(id))return NextResponse.json({error:"validation_error",message:"Valid contact ID required."},{status:422});
  const r=await query<{id:string}>("UPDATE personal_whatsapp_recipients SET deleted_at=now(),updated_at=now() WHERE id=$3 AND organization_id=$1 AND owner_user_id=$2 AND deleted_at IS NULL RETURNING id",[orgId,subject.user.id,id]);
  if(!r.rows[0])return NextResponse.json({error:"not_found"},{status:404});
  await recordAuditEvent({organizationId:orgId,actorUserId:subject.user.id,eventType:"recipient.deleted",targetType:"personal_whatsapp_recipient",targetId:id,action:"archive",decision:"allowed"});
  return NextResponse.json({ok:true});
 }catch(e){return conflict(e);}
}
