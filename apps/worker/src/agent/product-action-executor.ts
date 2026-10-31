import { createBusinessWorkItem, createEmailAction, createLocalDraft, getWhatsAppAccountForAgent, PostgresEmailAccountRepository, query, recordAuditEvent,loadActiveAgentConfiguration,type ActiveAgentConfiguration } from "@ai-comms-agent/db";
import type { ProductActionResult } from "@ai-comms-agent/shared";
import {draftReplySourceFromEvent} from "../automation/draft-reply-source";
import {deriveBusinessEvent} from "../automation/business-source";

type Action = Record<string, unknown>;
type Context = { organizationId: string; agentId: string; executionId: string; output: string;source?:string;configuration?:ActiveAgentConfiguration };

async function configurationPermits(context:Context,tool:string):Promise<boolean>{
  const frozen=context.configuration;if(!frozen)return true;
  if(frozen.organizationId!==context.organizationId||frozen.agentId!==context.agentId||frozen.snapshot.lifecycle.status!=='active'||!frozen.snapshot.policy?.allowedTools.includes(tool))return false;
  const current=await loadActiveAgentConfiguration({organizationId:context.organizationId,agentId:context.agentId});
  return current.revocationGeneration===frozen.revocationGeneration&&current.snapshot.lifecycle.status==='active'&&current.snapshot.policy?.allowedTools.includes(tool)===true;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function actionsFromParams(params: Record<string, unknown>): Action[] {
  const raw = params.actions ?? params.action;
  if (Array.isArray(raw)) return raw.filter((value): value is Action => !!value && typeof value === "object" && !Array.isArray(value));
  return raw && typeof raw === "object" && !Array.isArray(raw) ? [raw as Action] : [];
}

export async function executeProductActions(context: Context, params: Record<string, unknown>) {
  const actions = actionsFromParams(params);
  const emailAccounts = new PostgresEmailAccountRepository();
  const results: ProductActionResult[] = [];
  for (const action of actions) {
    // Ordered workflows are fail-stop: a denied summary, invalid assignee,
    // or failed draft must not silently continue to later side effects.
    if(results.some(r=>r.status==="configuration_required"||r.status==="failed"||r.status==="unsupported"))break;
    const type = stringValue(action.type);

    if(type==="generate_summary"){
      if(!context.output.trim()){results.push({type,status:"configuration_required",reason:"Agent generated no summary."});continue;}
      results.push({type,status:"completed"});continue;
    }
    if(type==="create_work_item"){
      // No business record may be created from chat text or untrusted scheduled
      // params. Only the event worker supplies authenticated provider source data.
      const event=params.event&&typeof params.event==="object"&&!Array.isArray(params.event)?params.event as Record<string,unknown>:{};
      const source=context.source==="automation"?deriveBusinessEvent(event):null;
      const kind=stringValue(action.kind);
      const priority=stringValue(action.priority)??"normal";
      const assigneeId=stringValue(action.assigneeId);
      if(!source||!["opportunity","service_ticket"].includes(kind??"")||!["normal","high","urgent"].includes(priority)){
        results.push({type,status:"configuration_required",reason:"Business work items require a trusted provider event, kind and priority."});continue;
      }
      if(assigneeId&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(assigneeId)){
        results.push({type,status:"configuration_required",reason:"Invalid assignee ID."});continue;
      }
      const item=await createBusinessWorkItem({
        organizationId:context.organizationId,agentId:context.agentId,runId:context.executionId,
        kind:kind as "opportunity"|"service_ticket",eventType:source.eventType,
        sourceKey:source.sourceKey,title:source.title,description:source.description,
        contact:source.contact,summary:context.output,priority:priority as "normal"|"high"|"urgent",assigneeId
      });
      if(!item){results.push({type,status:"configuration_required",reason:"Agent or assignee is not an active member of this organization, or an idempotency conflict occurred."});continue;}
      results.push({type,status:"completed",actionId:item.id});continue;
    }
    if(type==="create_draft"){
      if(!await configurationPermits(context,"email.draft.create")){
       results.push({type,status:"configuration_required",reason:"Agent is not permitted to create drafts."});continue;
      }
      const event=params.event && typeof params.event==="object" && !Array.isArray(params.event)?params.event as Record<string,unknown>:{};
      const emailAccountId=stringValue(action.emailAccountId)??stringValue(event.emailAccountId);
      // The actual incoming sender takes precedence over any optional rule recipient.
      // Never silently address an inbound reply draft to an unrelated configured contact.
      const replySource=draftReplySourceFromEvent(event);
      const recipient=replySource?.recipient??stringValue(action.to);
      if(!emailAccountId||!recipient||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)){
       results.push({type,status:"configuration_required",reason:"Draft requires a connected email account and a valid recipient."});continue;
      }
      const policy=await query<{status:string;allowed_tools:string[]}>(
        "SELECT a.status,p.allowed_tools FROM agents a JOIN agent_policies p ON p.agent_id=a.id WHERE a.organization_id=$1 AND a.id=$2",
        [context.organizationId,context.agentId],
      );
      if(policy.rows[0]?.status!=="active"||!policy.rows[0].allowed_tools.includes("email.draft.create")){
       results.push({type,status:"configuration_required",reason:"Agent draft tool is disabled or the agent is not active."});continue;
      }
      const bound=await emailAccounts.getForAgent(context.organizationId,context.agentId,emailAccountId);
      if(!bound){results.push({type,status:"configuration_required",reason:"Email account is not bound to the selected agent."});continue;}
      if(context.configuration&&!context.configuration.snapshot.channels.email.some(c=>c.accountId===emailAccountId)){
       results.push({type,status:"configuration_required",reason:"Email account is not in this agent's active channels."});continue;
      }
      if(bound.capabilities?.drafts!==true){
       results.push({type,status:"configuration_required",reason:"Selected mailbox does not support saving drafts."});continue;
      }
      if(!context.output.trim()){
       results.push({type,status:"configuration_required",reason:"No generated content to save as a draft."});continue;
      }
      const subject=stringValue(action.subject)??("Re: "+(stringValue(event.subject)??"Message requiring attention"));
      const draft=await createLocalDraft({organizationId:context.organizationId,emailAccountId,to:[recipient],subject:subject.slice(0,240),bodyText:context.output.slice(0,100000),...(replySource?.replyToMessageId?{replyToMessageId:replySource.replyToMessageId}:{})});
      results.push({type,status:"completed",actionId:String(draft.id)});continue;
    }

    if (type === "send_whatsapp") {
      if(!await configurationPermits(context,'whatsapp.send')){results.push({type,status:'configuration_required',reason:'Agent access changed. Review the current setup before preparing another message.'});continue;}
      const account = await getWhatsAppAccountForAgent(context.organizationId, context.agentId);
      if(context.configuration&&account?.id!==context.configuration.snapshot.channels.whatsappAccountId){results.push({type,status:'configuration_required',reason:'The assigned WhatsApp phone changed. Prepare a new reply under the current configuration.'});continue;}
      const to = stringValue(action.to);
      if (!account || account.status !== "connected" || !to || !/^\+[1-9]\d{7,14}$/.test(to)) {
        results.push({
          type,
          status: "configuration_required",
          reason: !account ? "No WhatsApp account is bound to the agent" : account.status !== "connected" ? "WhatsApp account is not connected" : "A valid E.164 WhatsApp recipient is required",
        });
        continue;
      }
      const template = stringValue(action.body);
      const body = (template ? template.replaceAll("{{output}}", context.output) : context.output).trim();
      if (!body || body.length > 4096) {
        results.push({ type, status: "configuration_required", reason: "Generated WhatsApp text must contain 1–4096 characters" });
        continue;
      }
      const idempotencyKey = "agent:" + context.agentId + ":execution:" + context.executionId + ":whatsapp:" + to;
      const correlationId = context.executionId;
      // Repeated scheduled/product attempts must not represent an approved,
      // rejected or already-queued WhatsApp action as a fresh human review.
      // The unique-key row lock also binds the original agent and payload.
      const inserted = await query<{ id: string; status: string }>(
        `INSERT INTO whatsapp_send_actions
           (organization_id, whatsapp_account_id, agent_id, agent_binding_required,
            requested_by, recipient_phone, message_body, payload_type,
            status, idempotency_key, correlation_id)
         VALUES ($1,$2,$3,true,NULL,$4,$5,'text','pending',$6,$7)
         ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         WHERE whatsapp_send_actions.status = 'pending'
           AND whatsapp_send_actions.expires_at > now()
           AND whatsapp_send_actions.requested_by IS NOT DISTINCT FROM EXCLUDED.requested_by
           AND whatsapp_send_actions.agent_id IS NOT DISTINCT FROM EXCLUDED.agent_id
           AND whatsapp_send_actions.agent_binding_required IS NOT DISTINCT FROM EXCLUDED.agent_binding_required
           AND whatsapp_send_actions.whatsapp_account_id IS NOT DISTINCT FROM EXCLUDED.whatsapp_account_id
           AND whatsapp_send_actions.recipient_phone IS NOT DISTINCT FROM EXCLUDED.recipient_phone
           AND whatsapp_send_actions.message_body IS NOT DISTINCT FROM EXCLUDED.message_body
           AND whatsapp_send_actions.payload_type IS NOT DISTINCT FROM EXCLUDED.payload_type
           AND whatsapp_send_actions.template_name IS NOT DISTINCT FROM EXCLUDED.template_name
           AND whatsapp_send_actions.template_language IS NOT DISTINCT FROM EXCLUDED.template_language
           AND whatsapp_send_actions.template_parameters IS NOT DISTINCT FROM EXCLUDED.template_parameters
         RETURNING id,status`,
        [context.organizationId, account.id, context.agentId, to, body, idempotencyKey, correlationId],
      );
      const approval = inserted.rows[0];
      if (!approval) {
        results.push({ type, status: "failed", reason: "WhatsApp approval idempotency conflict: another actor or payload used this key, or the approval is no longer pending." });
        continue;
      }
      await recordAuditEvent({ organizationId: context.organizationId, actorUserId: null, agentId: context.agentId, eventType: "whatsapp.send_approval.requested", targetType: "whatsapp_send_action", targetId: approval.id, action: "send_whatsapp", decision: "pending_approval", correlationId, metadata: { executionId: context.executionId, recipientSuffix: to.slice(-4), accountId: account.id } });
      results.push({ type, status: "pending_approval", actionId: String(approval.id), reason: "Human approval is required; no WhatsApp message has been queued or sent." });
      continue;
    }

    if (type === "create_email_approval") {
      const emailAccountId = stringValue(action.emailAccountId);
      const actionType = stringValue(action.actionType) as "send_email" | "reply_email" | "forward_email" | null;
      if (!emailAccountId || !actionType || !["send_email", "reply_email", "forward_email"].includes(actionType)) {
        results.push({ type, status: "configuration_required", reason: "Email account and supported actionType are required" });
        continue;
      }
      const tool=({send_email:'email.send.request',reply_email:'email.reply.request',forward_email:'email.forward.request'} as const)[actionType];
      const frozenRole=context.configuration?.snapshot.channels.email.find(binding=>binding.accountId===emailAccountId)?.role;
      if(!await configurationPermits(context,tool)||context.configuration&&frozenRole!=='primary'&&frozenRole!=='send_only'){results.push({type,status:'configuration_required',reason:'This mailbox or operation was not available for this execution. Review the current setup.'});continue;}
      const boundAccount = await emailAccounts.getForAgent(context.organizationId, context.agentId, emailAccountId);
      if (!boundAccount) {
        results.push({ type, status: "configuration_required", reason: "Email account is not owned by the organization or bound to this agent" });
        continue;
      }
      const recipientSnapshot = action.recipientSnapshot && typeof action.recipientSnapshot === "object" && !Array.isArray(action.recipientSnapshot)
        ? action.recipientSnapshot as Record<string, unknown>
        : { body: context.output };
      const approval = await createEmailAction({
        organizationId: context.organizationId,
        agentId: context.agentId,
        emailAccountId,
        actionType,
        draftId: stringValue(action.draftId),
        recipientSnapshot: { ...recipientSnapshot, generatedOutput: context.output },
        requestedBy: null,
        correlationId: context.executionId,
      });
      await recordAuditEvent({ organizationId: context.organizationId, actorUserId: null, agentId: context.agentId, eventType: "email.action.requested", targetType: "email_action", targetId: approval.id, action: actionType, decision: "pending_approval", correlationId: context.executionId, metadata: { executionId: context.executionId, emailAccountId } });
      results.push({ type, status: "pending_approval", actionId: approval.id });
      continue;
    }

    results.push({ type: type ?? "unknown", status: "configuration_required", reason: "Action type is not enabled by the host runtime" });
  }
  return results;
}
