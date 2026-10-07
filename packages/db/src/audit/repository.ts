import { query } from "../client";

export type AuditEventInput = { organizationId:string; actorUserId:string|null; agentId?:string|null; eventType:string; targetType?:string|null; targetId?:string|null; action?:string|null; decision?:string|null; correlationId?:string|null; metadata?:Record<string,unknown>; };
export type AuditEvent = { id:string; organizationId:string; actorUserId:string|null; agentId:string|null; eventType:string; targetType:string|null; targetId:string|null; action:string|null; decision:string|null; correlationId:string|null; metadata:Record<string,unknown>; createdAt:string; };

export async function recordAuditEvent(input:AuditEventInput):Promise<void>{
 await query("INSERT INTO audit_events (organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,correlation_id,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)",[input.organizationId,input.actorUserId,input.agentId??null,input.eventType,input.targetType??null,input.targetId??null,input.action??null,input.decision??null,input.correlationId??null,JSON.stringify(input.metadata??{})]);
}

export async function listAuditEvents(organizationId:string,agentId:string,limit=50):Promise<AuditEvent[]>{
 const safeLimit=Math.min(Math.max(Math.floor(limit),1),100);
 const r=await query<Record<string,unknown>>("SELECT id,organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,correlation_id,metadata,created_at FROM audit_events WHERE organization_id=$1 AND agent_id=$2 ORDER BY created_at DESC LIMIT $3",[organizationId,agentId,safeLimit]);
 return r.rows.map((row)=>({id:String(row.id),organizationId:String(row.organization_id),actorUserId:(row.actor_user_id as string|null)??null,agentId:(row.agent_id as string|null)??null,eventType:String(row.event_type??"unknown"),targetType:(row.target_type as string|null)??null,targetId:(row.target_id as string|null)??null,action:(row.action as string|null)??null,decision:(row.decision as string|null)??null,correlationId:(row.correlation_id as string|null)??null,metadata:row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{},createdAt:String(row.created_at)}));
}

export type AuditEventFilters = {
 eventType?: string;
 decision?: string;
 actorUserId?: string;
 search?: string;
 from?: string;
 to?: string;
};

function mapAuditRows(rows:Record<string,unknown>[]):AuditEvent[]{
 return rows.map((row)=>({id:String(row.id),organizationId:String(row.organization_id),actorUserId:(row.actor_user_id as string|null)??null,agentId:(row.agent_id as string|null)??null,eventType:String(row.event_type??"unknown"),targetType:(row.target_type as string|null)??null,targetId:(row.target_id as string|null)??null,action:(row.action as string|null)??null,decision:(row.decision as string|null)??null,metadata:row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{},createdAt:String(row.created_at)}));
}

export async function listOrganizationAuditEvents(organizationId:string,limit=100,filters:AuditEventFilters={}):Promise<AuditEvent[]>{
 const safeLimit=Math.min(Math.max(Math.floor(limit),1),100);
 const clauses=["organization_id=$1"]; const params:unknown[]=[organizationId]; let n=2;
 if(filters.eventType){clauses.push(`event_type=${n++}`);params.push(filters.eventType);}
 if(filters.decision){clauses.push(`decision=${n++}`);params.push(filters.decision);}
 if(filters.actorUserId){clauses.push(`actor_user_id=${n++}`);params.push(filters.actorUserId);}
 if(filters.search){clauses.push(`(event_type ILIKE ${n} OR action ILIKE ${n} OR target_type ILIKE ${n} OR target_id::text ILIKE ${n})`);params.push(`%${filters.search}%`);n++;}
 if(filters.from){clauses.push(`created_at >= ${n++}`);params.push(filters.from);}
 if(filters.to){clauses.push(`created_at < ${n++}`);params.push(filters.to);}
 params.push(safeLimit);
 const r=await query<Record<string,unknown>>(`SELECT id,organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,correlation_id,metadata,created_at FROM audit_events WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ${n}`,params);
 return mapAuditRows(r.rows);
}

export async function listOrganizationAuditEventsForExport(organizationId:string,filters:AuditEventFilters={}):Promise<AuditEvent[]>{
 return listOrganizationAuditEvents(organizationId,10000,filters);
}
