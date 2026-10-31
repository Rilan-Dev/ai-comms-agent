import { NextResponse } from "next/server";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { createAutomationRule, deleteAutomationRule, listAutomationRules, listAutomationRuns, updateAutomationRule, recordAuditEvent } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

function validate(input: any) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  const trigger = input?.trigger && typeof input.trigger === "object" && !Array.isArray(input.trigger) ? input.trigger : null;
  const actions = Array.isArray(input?.actions) ? input.actions : null;
  if (!name || !agentId || !trigger || !actions || actions.length === 0) return { error: "name, agentId, trigger and at least one action are required" };
  if(actions.length>3)return {error:"Maximum three sequential actions per rule."};
  const event=typeof trigger.event==="string"?trigger.event:trigger.type;
  if(!["email.received","email.action_required","whatsapp.received"].includes(String(event)))return {error:"Unsupported event trigger."};
  const types=new Set<string>();
  for(const raw of actions){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"Invalid action."};
    const action=raw as Record<string,unknown>,type=String(action.type);
    if(!["create_draft","generate_summary","send_whatsapp","create_work_item"].includes(type))return {error:"Unsupported automation action."};
    if(types.has(type))return {error:"Each action can only appear once in a workflow."};
    types.add(type);
    if(type==="create_draft"&&!String(event).startsWith("email."))return {error:"Reply drafts require an email trigger."};
    if(type==="send_whatsapp"&&(typeof action.to!=="string"||!/^\+[1-9]\d{7,14}$/.test(action.to)))return {error:"WhatsApp actions require an E.164 recipient and human approval."};
    if(type==="create_work_item"){
      if(!["opportunity","service_ticket"].includes(String(action.kind)))return {error:"Select a sales opportunity or service ticket."};
      if(action.priority!=null&&!["normal","high","urgent"].includes(String(action.priority)))return {error:"Invalid business priority."};
      if(action.assigneeId!=null&&(typeof action.assigneeId!=="string"||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(action.assigneeId)))return {error:"Invalid assignee ID."};
    }
  }
  if(types.has("create_work_item")){
    const filters=input?.conditions?.textContainsAny;
    if(!Array.isArray(filters)||filters.length===0||filters.length>8||
       filters.some((value:unknown)=>typeof value!=="string"||value.trim().length<2||value.trim().length>60))
      return {error:"Business automations require 1–8 specific message keywords or phrases (2–60 characters each)."};
  }
  if(types.has("send_whatsapp")&&actions.length!==1)return {error:"WhatsApp approval must remain a standalone action."};
  if(actions[0]?.type==="create_draft"&&actions.length>1)return {error:"Draft creation must follow summary and work item creation."};
  return { value: { name, agentId, trigger, actions, conditions: input?.conditions && typeof input.conditions === "object" ? input.conditions : {} } };
}

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const ruleId=new URL(request.url).searchParams.get("ruleId");
    if(ruleId)return NextResponse.json({runs:await listAutomationRuns(orgId,ruleId)},{headers:{"Cache-Control":"private, no-store"}});
    return NextResponse.json({ automations: await listAutomationRules(orgId) },{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const parsed = validate(await request.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: "validation_error", message: parsed.error }, { status: 400 });
    const rule = await createAutomationRule({ organizationId: orgId, userId: subject.user.id, ...parsed.value });
    if (!rule) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.created", targetType: "automation_rule", targetId: rule.id, action: "create", decision: "allowed" });
    return NextResponse.json({ automation: rule }, { status: 201 });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const body = await request.json().catch(() => null);
    const parsed = validate(body);
    if ("error" in parsed) return NextResponse.json({ error: "validation_error", message: parsed.error }, { status: 400 });
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "validation_error", message: "id is required" }, { status: 400 });
    const status = ["active","paused","archived","error"].includes(body?.status) ? body.status : "active";
    const rule = await updateAutomationRule({ organizationId: orgId, id, status, ...parsed.value });
    if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.updated", targetType: "automation_rule", targetId: id, action: "update", decision: "allowed" });
    return NextResponse.json({ automation: rule });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {assertSameOrigin(request);}catch{return NextResponse.json({error:"invalid_origin"},{status:403});}
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const ok = await deleteAutomationRule(orgId, id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.archived", targetType: "automation_rule", targetId: id, action: "archive", decision: "allowed" });
    return NextResponse.json({ ok: true });
  } catch (error) { return authorizationErrorToResponse(error); }
}
