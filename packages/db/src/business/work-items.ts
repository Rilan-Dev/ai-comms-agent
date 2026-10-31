import {query} from "../client";

export type BusinessWorkItem={
 id:string;organization_id:string;kind:"opportunity"|"service_ticket";
 source_event_type:string;source_event_key:string;title:string;description:string;ai_summary:string;
 source_contact:string|null;priority:"normal"|"high"|"urgent";
 status:"new"|"in_progress"|"completed";review_status:"pending"|"approved"|"rejected";
 assigned_user_id:string|null;reviewed_by:string|null;reviewed_at:string|null;
 closed_at:string|null;created_at:string;updated_at:string;
};
export async function listBusinessWorkItems(orgId:string){
 const r=await query<BusinessWorkItem>("SELECT * FROM business_work_items WHERE organization_id=$1 ORDER BY (status='completed'),created_at DESC LIMIT 150",[orgId]);
 return r.rows;
}
export async function listBusinessAssignees(orgId:string){
 const r=await query<{id:string;name:string|null;email:string;role:string}>(
 "SELECT u.id::text,u.name,u.email::text,m.role::text FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.status='active' AND u.status='active' AND u.deleted_at IS NULL ORDER BY u.name NULLS LAST,u.email LIMIT 150",[orgId]);
 return r.rows;
}
export type CreateBusinessWorkItem={
 organizationId:string;agentId:string;runId:string;kind:"opportunity"|"service_ticket";
 eventType:"email.received"|"email.action_required"|"whatsapp.received";
 sourceKey:string;title:string;description:string;summary:string;
 contact:string|null;priority:"normal"|"high"|"urgent";assigneeId:string|null;
};
export async function createBusinessWorkItem(input:CreateBusinessWorkItem):Promise<BusinessWorkItem|null>{
 if(!input.sourceKey.trim()||input.sourceKey.length>180)throw Error("Source event identity is required.");
 const sql=[
 "INSERT INTO business_work_items",
 "(organization_id,automation_run_id,agent_id,kind,source_event_type,source_event_key,title,description,ai_summary,source_contact,priority,assigned_user_id)",
 "SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12",
 "WHERE EXISTS(SELECT 1 FROM agents a WHERE a.id=$3 AND a.organization_id=$1 AND a.status='active')",
 "AND ($12::uuid IS NULL OR EXISTS(SELECT 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id",
 "WHERE m.organization_id=$1 AND m.user_id=$12 AND m.status='active' AND u.status='active' AND u.deleted_at IS NULL))",
 "ON CONFLICT(organization_id,kind,source_event_type,source_event_key)",
 "DO UPDATE SET source_event_key=business_work_items.source_event_key",
 "WHERE business_work_items.agent_id IS NOT DISTINCT FROM EXCLUDED.agent_id RETURNING *"
 ].join(" ");
 const r=await query<BusinessWorkItem>(sql,[input.organizationId,input.runId,input.agentId,input.kind,input.eventType,input.sourceKey,
  input.title.slice(0,250),input.description.slice(0,2000),input.summary.slice(0,10000),
  input.contact?.slice(0,240)??null,input.priority,input.assigneeId]);
 return r.rows[0]??null;
}
export async function changeBusinessWorkItem(input:{
 organizationId:string;id:string;actorId:string;assignedUserId?:string|null;
 status?:"new"|"in_progress"|"completed";reviewStatus?:"approved"|"rejected"|"pending";
}){
 const sql=[
 "UPDATE business_work_items w SET",
 "assigned_user_id=CASE WHEN $4::boolean THEN $5::uuid ELSE w.assigned_user_id END,",
 "status=COALESCE($6::text,w.status),review_status=COALESCE($7::text,w.review_status),",
 "reviewed_by=CASE WHEN $7::text IS NULL THEN w.reviewed_by WHEN $7::text='pending' THEN NULL ELSE $3::uuid END,",
 "reviewed_at=CASE WHEN $7::text IS NULL THEN w.reviewed_at WHEN $7::text='pending' THEN NULL ELSE now() END,",
 "closed_at=CASE WHEN $6::text='completed' THEN now() WHEN $6::text IN ('new','in_progress') THEN NULL ELSE w.closed_at END,",
 "updated_at=now() WHERE w.organization_id=$1 AND w.id=$2",
 "AND EXISTS(SELECT 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id",
 "WHERE m.organization_id=$1 AND m.user_id=$3 AND m.status='active' AND u.status='active' AND u.deleted_at IS NULL)",
 "AND ($4::boolean=false OR $5::uuid IS NULL OR EXISTS(SELECT 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id",
 "WHERE m.organization_id=$1 AND m.user_id=$5 AND m.status='active' AND u.status='active' AND u.deleted_at IS NULL))",
 "AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=$1 AND m.user_id=$3",
 "AND m.status='active' AND m.role IN ('owner','admin')))",
 "AND ($6::text IS DISTINCT FROM 'completed' OR COALESCE($7::text,w.review_status)='approved') RETURNING w.*"
 ].join(" ");
 const r=await query<BusinessWorkItem>(sql,[input.organizationId,input.id,input.actorId,
  input.assignedUserId!==undefined,input.assignedUserId??null,input.status??null,input.reviewStatus??null]);
 return r.rows[0]??null;
}
