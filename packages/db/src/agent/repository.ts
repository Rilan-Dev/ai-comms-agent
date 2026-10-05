import { query, withTransaction } from "../client";
import type { Agent, AgentDeployment, AgentEmailBinding, AgentPolicy, AgentVersion, AgentEmailAccountRole, DeploymentEnvironment } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;
const obj=(v:unknown):Record<string,unknown> => v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : {};
const agent=(r:Row):Agent=>({id:String(r.id),organizationId:String(r.organization_id),name:String(r.name),slug:String(r.slug),description:(r.description as string|null)??null,status:r.status as Agent["status"],currentVersionId:(r.current_version_id as string|null)??null,currentDeploymentId:(r.current_deployment_id as string|null)??null,createdBy:(r.created_by as string|null)??null,createdAt:String(r.created_at),updatedAt:String(r.updated_at)});
const version=(r:Row):AgentVersion=>({id:String(r.id),agentId:String(r.agent_id),versionNumber:Number(r.version_number),config:obj(r.config),createdBy:(r.created_by as string|null)??null,createdAt:String(r.created_at),diffFromPrevious:r.diff_from_previous?obj(r.diff_from_previous):null});
const deployment=(r:Row):AgentDeployment=>({id:String(r.id),agentId:String(r.agent_id),versionId:String(r.version_id),environment:r.environment as DeploymentEnvironment,deployedBy:(r.deployed_by as string|null)??null,deployedAt:String(r.deployed_at),retiredAt:(r.retired_at as string|null)??null});
const policy=(r:Row):AgentPolicy=>({id:String(r.id),agentId:String(r.agent_id),securityPolicy:obj(r.security_policy),allowedTools:Array.isArray(r.allowed_tools)?r.allowed_tools.map(String):[],allowedSenders:Array.isArray(r.allowed_senders)?r.allowed_senders.map(String):[],blockedSenders:Array.isArray(r.blocked_senders)?r.blocked_senders.map(String):[],rateLimits:obj(r.rate_limits),createdAt:String(r.created_at),updatedAt:String(r.updated_at)});
const emailBinding=(r:Row):AgentEmailBinding=>({id:String(r.id),agentId:String(r.agent_id),emailAccountId:String(r.email_account_id),role:r.role as AgentEmailAccountRole,createdAt:String(r.created_at)});
const whatsappBinding=(r:Row)=>({id:String(r.id),agentId:String(r.agent_id),whatsappAccountId:String(r.whatsapp_account_id),createdAt:String(r.created_at)});

export class PostgresAgentRepository {
  async list(orgId:string):Promise<Agent[]> { const r=await query<Row>("SELECT * FROM agents WHERE organization_id=$1 ORDER BY created_at DESC",[orgId]); return r.rows.map(agent); }
  async get(orgId:string,id:string):Promise<Agent|null> { const r=await query<Row>("SELECT * FROM agents WHERE organization_id=$1 AND id=$2",[orgId,id]); return r.rows[0]?agent(r.rows[0]):null; }
  async create(i:{organizationId:string;userId:string;name:string;slug:string;description:string}):Promise<Agent>{
    return withTransaction(async c=>{
      const a=await c.query<Row>("INSERT INTO agents (organization_id,name,slug,description,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *",[i.organizationId,i.name,i.slug,i.description||null,i.userId]);
      if(!a.rows[0]) throw new Error("Agent insert returned no row");
      await c.query("INSERT INTO agent_versions (agent_id,version_number,config,created_by) VALUES ($1,1,$2::jsonb,$3)",[a.rows[0].id,JSON.stringify({}),i.userId]);
      await c.query("INSERT INTO agent_policies (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING",[a.rows[0].id]);
      return agent(a.rows[0]);
    });
  }
  async update(orgId:string,id:string,i:{name:string;slug:string;description:string}):Promise<Agent|null>{
    const r=await query<Row>("UPDATE agents SET name=$3,slug=$4,description=$5 WHERE organization_id=$1 AND id=$2 RETURNING *",[orgId,id,i.name,i.slug,i.description||null]); return r.rows[0]?agent(r.rows[0]):null;
  }
  async versions(orgId:string,id:string):Promise<AgentVersion[]> { const r=await query<Row>("SELECT v.* FROM agent_versions v JOIN agents a ON a.id=v.agent_id WHERE a.organization_id=$1 AND a.id=$2 ORDER BY v.version_number DESC",[orgId,id]); return r.rows.map(version); }
  async createVersion(orgId:string,id:string,userId:string,config:Record<string,unknown>):Promise<AgentVersion>{
    return withTransaction(async c=>{
      const lockedAgent=await c.query<Row>("SELECT id FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE",[orgId,id]);
      if (!lockedAgent.rows[0]) throw new Error("Agent not found");
      const current=await c.query<Row>("SELECT COALESCE(MAX(version_number),0) max_version FROM agent_versions WHERE agent_id=$1",[id]);
      const next=Number(current.rows[0]?.max_version??0)+1;
      const r=await c.query<Row>("INSERT INTO agent_versions (agent_id,version_number,config,created_by) VALUES ($1,$2,$3::jsonb,$4) RETURNING *",[id,next,JSON.stringify(config),userId]);
      if(!r.rows[0]) throw new Error("Agent version insert returned no row"); return version(r.rows[0]);
    });
  }
  async deploy(orgId:string,id:string,userId:string,versionId:string,environment:DeploymentEnvironment):Promise<AgentDeployment>{
    return withTransaction(async c=>{
      const v=await c.query<Row>("SELECT v.* FROM agent_versions v JOIN agents a ON a.id=v.agent_id WHERE a.organization_id=$1 AND a.id=$2 AND v.id=$3 FOR UPDATE",[orgId,id,versionId]);
      if(!v.rows[0]) throw new Error("Version not found for this agent");
      await c.query("UPDATE agent_deployments SET retired_at=now() WHERE agent_id=$1 AND environment=$2 AND retired_at IS NULL",[id,environment]);
      const d=await c.query<Row>("INSERT INTO agent_deployments (agent_id,version_id,environment,deployed_by) VALUES ($1,$2,$3,$4) RETURNING *",[id,versionId,environment,userId]);
      if(!d.rows[0]) throw new Error("Deployment insert returned no row");
      await c.query("UPDATE agents SET current_version_id=$1,current_deployment_id=$2,status='active' WHERE id=$3 AND organization_id=$4",[versionId,d.rows[0].id,id,orgId]);
      return deployment(d.rows[0]);
    });
  }
  async retire(orgId:string,id:string):Promise<Agent|null>{ const r=await query<Row>("UPDATE agents SET status='paused' WHERE organization_id=$1 AND id=$2 RETURNING *",[orgId,id]); return r.rows[0]?agent(r.rows[0]):null; }
  async policy(orgId:string,id:string):Promise<AgentPolicy|null>{ const r=await query<Row>("SELECT p.* FROM agent_policies p JOIN agents a ON a.id=p.agent_id WHERE a.organization_id=$1 AND a.id=$2",[orgId,id]); return r.rows[0]?policy(r.rows[0]):null; }
  async updatePolicy(orgId:string,id:string,i:Pick<AgentPolicy,"securityPolicy"|"allowedTools"|"allowedSenders"|"blockedSenders"|"rateLimits">):Promise<AgentPolicy|null>{
    const r=await query<Row>("INSERT INTO agent_policies (agent_id,security_policy,allowed_tools,allowed_senders,blocked_senders,rate_limits) SELECT a.id,$3::jsonb,$4::text[],$5::text[],$6::text[],$7::jsonb FROM agents a WHERE a.organization_id=$1 AND a.id=$2 ON CONFLICT(agent_id) DO UPDATE SET security_policy=EXCLUDED.security_policy,allowed_tools=EXCLUDED.allowed_tools,allowed_senders=EXCLUDED.allowed_senders,blocked_senders=EXCLUDED.blocked_senders,rate_limits=EXCLUDED.rate_limits RETURNING *",[orgId,id,JSON.stringify(i.securityPolicy),i.allowedTools,i.allowedSenders,i.blockedSenders,JSON.stringify(i.rateLimits)]); return r.rows[0]?policy(r.rows[0]):null;
  }
  async emailBindings(orgId:string,id:string):Promise<AgentEmailBinding[]>{ const r=await query<Row>("SELECT b.* FROM agent_email_accounts b JOIN agents a ON a.id=b.agent_id WHERE a.organization_id=$1 AND a.id=$2 ORDER BY b.created_at ASC",[orgId,id]); return r.rows.map(emailBinding); }
  async bindEmail(orgId:string,id:string,emailAccountId:string,role:AgentEmailAccountRole):Promise<AgentEmailBinding>{
    const r=await query<Row>("INSERT INTO agent_email_accounts(agent_id,email_account_id,role) SELECT a.id,$3,$4 FROM agents a JOIN email_accounts ea ON ea.id=$3 AND ea.organization_id=a.organization_id WHERE a.organization_id=$1 AND a.id=$2 ON CONFLICT(agent_id,email_account_id) DO UPDATE SET role=EXCLUDED.role RETURNING *",[orgId,id,emailAccountId,role]);
    if(!r.rows[0]) throw new Error("Agent or email account not found in this organization"); return emailBinding(r.rows[0]);
  }
  async unbindEmail(orgId:string,id:string,emailAccountId:string):Promise<void>{ await query("DELETE FROM agent_email_accounts b USING agents a JOIN email_accounts ea ON ea.id=b.email_account_id WHERE b.agent_id=a.id AND a.organization_id=$1 AND a.id=$2 AND ea.organization_id=$1 AND b.email_account_id=$3",[orgId,id,emailAccountId]); }
  async whatsappAccounts(orgId:string):Promise<Array<{id:string;displayName:string|null;phoneNumberId:string;status:string}>>{ const r=await query<Row>("SELECT id,display_name,phone_number_id,status FROM whatsapp_accounts WHERE organization_id=$1 ORDER BY created_at ASC",[orgId]); return r.rows.map(row=>({id:String(row.id),displayName:(row.display_name as string|null)??null,phoneNumberId:String(row.phone_number_id),status:String(row.status)})); }\n  async whatsappBinding(orgId:string,id:string):Promise<{id:string;agentId:string;whatsappAccountId:string;createdAt:string}|null>{ const r=await query<Row>("SELECT b.* FROM agent_whatsapp_accounts b JOIN agents a ON a.id=b.agent_id WHERE a.organization_id=$1 AND a.id=$2",[orgId,id]); return r.rows[0]?whatsappBinding(r.rows[0]):null; }
  async bindWhatsApp(orgId:string,id:string,whatsappAccountId:string):Promise<{id:string;agentId:string;whatsappAccountId:string;createdAt:string}>{ const r=await query<Row>("INSERT INTO agent_whatsapp_accounts(agent_id,whatsapp_account_id) SELECT a.id,$3 FROM agents a JOIN whatsapp_accounts wa ON wa.id=$3 AND wa.organization_id=a.organization_id WHERE a.organization_id=$1 AND a.id=$2 ON CONFLICT(agent_id) DO UPDATE SET whatsapp_account_id=EXCLUDED.whatsapp_account_id RETURNING *",[orgId,id,whatsappAccountId]); if(!r.rows[0]) throw new Error("Agent or WhatsApp account not found in this organization"); return whatsappBinding(r.rows[0]); }
  async unbindWhatsApp(orgId:string,id:string):Promise<void>{ await query("DELETE FROM agent_whatsapp_accounts b USING agents a WHERE b.agent_id=a.id AND a.organization_id=$1 AND a.id=$2",[orgId,id]); }
}
