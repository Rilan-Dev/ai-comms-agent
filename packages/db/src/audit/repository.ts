import { query } from "../client";

export type AuditEventInput = { organizationId:string; actorUserId:string|null; agentId?:string|null; eventType:string; targetType?:string|null; targetId?:string|null; action?:string|null; decision?:string|null; metadata?:Record<string,unknown>; };
export type AuditEvent = { id:string; organizationId:string; actorUserId:string|null; agentId:string|null; eventType:string; targetType:string|null; targetId:string|null; action:string|null; decision:string|null; metadata:Record<string,unknown>; createdAt:string; };

export async function recordAuditEvent(input:AuditEventInput):Promise<void>{
 await query("INSERT INTO audit_events (organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",[input.organizationId,input.actorUserId,input.agentId??null,input.eventType,input.targetType??null,input.targetId??null,input.action??null,input.decision??null,JSON.stringify(input.metadata??{})]);
}

export async function listAuditEvents(organizationId:string,agentId:string,limit=50):Promise<AuditEvent[]>{
 const safeLimit=Math.min(Math.max(Math.floor(limit),1),100);
 const r=await query<Record<string,unknown>>("SELECT id,organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,metadata,created_at FROM audit_events WHERE organization_id=$1 AND agent_id=$2 ORDER BY created_at DESC LIMIT $3",[organizationId,agentId,safeLimit]);
 return r.rows.map((row)=>({id:String(row.id),organizationId:String(row.organization_id),actorUserId:(row.actor_user_id as string|null)??null,agentId:(row.agent_id as string|null)??null,eventType:String(row.event_type??"unknown"),targetType:(row.target_type as string|null)??null,targetId:(row.target_id as string|null)??null,action:(row.action as string|null)??null,decision:(row.decision as string|null)??null,metadata:row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{},createdAt:String(row.created_at)}));
}

export async function listOrganizationAuditEvents(organizationId:string,limit=100):Promise<AuditEvent[]>{
 const safeLimit=Math.min(Math.max(Math.floor(limit),1),100);
 const r=await query<Record<string,unknown>>("SELECT id,organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,metadata,created_at FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2",[organizationId,safeLimit]);
 return r.rows.map((row)=>({id:String(row.id),organizationId:String(row.organization_id),actorUserId:(row.actor_user_id as string|null)??null,agentId:(row.agent_id as string|null)??null,eventType:String(row.event_type??"unknown"),targetType:(row.target_type as string|null)??null,targetId:(row.target_id as string|null)??null,action:(row.action as string|null)??null,decision:(row.decision as string|null)??null,metadata:row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{},createdAt:String(row.created_at)}));
}
