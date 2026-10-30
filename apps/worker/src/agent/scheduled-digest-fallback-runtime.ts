import {query,recordAuditEvent} from "@ai-comms-agent/db";
import type {ToolContext,ToolResult} from "@ai-comms-agent/shared";
import {invokeEmailReadTool} from "./email-tool-runtime";
import type {EmailToolRuntime} from "@ai-comms-agent/email-agent-runtime";
import {invokeWhatsAppTool} from "./whatsapp-tool-runtime";
import type {WhatsAppToolRuntime} from "./whatsapp-tool-runtime";
import type {ScheduledAgentTaskResult,ScheduledAgentToolCall} from "./scheduled-agent-runtime";
import {buildVerifiedDigest} from "./deterministic-scheduled-digest";
import type {DigestFallback,DigestResult} from "./deterministic-scheduled-digest";

export async function runScheduledDigestFallback(args:{
  config:DigestFallback;
  context:ToolContext;
  availableTools:readonly {name:string}[];
  emailRuntime:EmailToolRuntime;
  whatsappRuntime:WhatsAppToolRuntime;
  previousCalls:ScheduledAgentToolCall[];
}):Promise<ScheduledAgentTaskResult>{
  const {config,context,previousCalls}=args;
  const calls=[...previousCalls];
  const decline=(reason:string):ScheduledAgentTaskResult=>({
    status:"configuration_required",output:"",reason,toolCalls:calls,pendingApprovals:[],
  });
  // A fallback can only use tools already enabled for this exact turn.
  const needed=["email.accounts.list","email.search","whatsapp.send"];
  if(needed.some(name=>!args.availableTools.some(tool=>tool.name===name)))
    return decline("The fallback lacks a required currently authorized read/send tool.");
  // A prior WhatsApp attempt may have reached Meta even if its host response
  // was interrupted. Never create another send on an ambiguous outcome.
  const action=await query<{id:string}>(
    "SELECT id FROM whatsapp_send_actions WHERE organization_id=$1 AND correlation_id=$2 LIMIT 1",
    [context.organization_id,context.correlation_id],
  );
  if(action.rows.length||calls.some(call=>call.name==="whatsapp.send"))
    return decline("WhatsApp may already have been requested; fallback blocked to prevent duplicate delivery.");

  const invoke=async(name:string,input:Record<string,unknown>):Promise<ToolResult>=>{
    const result=name==="whatsapp.send"
      ?await invokeWhatsAppTool(args.whatsappRuntime,name,input,context)
      :await invokeEmailReadTool(args.emailRuntime,name,input,context);
    calls.push({name,ok:result.ok,...(result.error?{errorCode:result.error.code}:{}),durationMs:result.audit.duration_ms});
    return result;
  };
  const discovery=await invoke("email.accounts.list",{});
  if(!discovery.ok||!Array.isArray(discovery.output))return decline("Cannot read the agent's bound mailboxes.");
  const accounts=(discovery.output as unknown[]).filter((account):account is {id:string;email_address:string;status:string}=>{
    if(!account||typeof account!=="object")return false;
    const row=account as Record<string,unknown>;
    return typeof row.id==="string"&&typeof row.email_address==="string"&&row.status==="connected";
  });
  if(accounts.length===0)return decline("No connected readable mailbox is assigned to the agent.");
  const cutoff=new Date(Date.now()-config.lookbackHours*3600000).toISOString();
  const results:Array<{mailbox:string;output:DigestResult}>=[];
  for(const account of accounts){
    const search=await invoke("email.search",{account_id:account.id,unread_only:true,date_from:cutoff,limit:100});
    if(!search.ok||!search.output||typeof search.output!=="object")
      return decline("The authorized mailbox search failed; no WhatsApp was attempted.");
    results.push({mailbox:account.email_address,output:search.output as DigestResult});
  }
  let digest:ReturnType<typeof buildVerifiedDigest>;
  try{digest=buildVerifiedDigest(results,config.lookbackHours,new Date());}
  catch{return decline("The email search returned unverifiable data; WhatsApp was not attempted.");}

  const send=await invoke("whatsapp.send",{to:config.recipientPhone,payload_type:"text",body:digest.body});
  const output=send.output&&typeof send.output==="object"?send.output as Record<string,unknown>:{};
  const sentStatus=send.ok?(output.status==="queued"?"queued for Meta dispatch":
    output.approval_required===true?"awaiting authorized human approval":"request accepted"):
    "blocked ("+(send.error?.code??"tool_error")+")";
  const status=send.ok?"completed":"configuration_required";
  const summary="AI provider failed; explicitly configured deterministic digest used. "+
    results.length+" bound mailbox(es), "+digest.total+" unread locally synced emails in the last "+
    config.lookbackHours+" hours; "+digest.highlights.length+" unique subject highlights. "+
    "WhatsApp "+sentStatus+". "+(digest.coverageLimited?"Some pages were not inspected.":"All matching rows were inspected.");
  await recordAuditEvent({
    organizationId:context.organization_id,
    actorUserId:context.user_id,agentId:context.agent_id,
    eventType:"schedule.provider_fallback",targetType:"scheduled_run",
    targetId:context.correlation_id,action:"fallback",decision:send.ok?"allowed":"denied",
    correlationId:context.correlation_id,
    metadata:{mode:config.mode,windowHours:config.lookbackHours,mailboxCount:results.length,
      emailMatchCount:digest.total,coverageLimited:digest.coverageLimited,
      whatsappStatus:sentStatus,recipientSuffix:config.recipientPhone.slice(-4)},
  }).catch(()=>undefined);
  return {
    status,provider:"deterministic_host_fallback",model:"none",
    output:summary,...(!send.ok?{reason:"Fallback WhatsApp send was blocked: "+(send.error?.code??"unknown")}:{}),
    toolCalls:calls,
    pendingApprovals:output.approval_required===true&&typeof output.action_id==="string"
      ?[{actionId:output.action_id,actionType:"whatsapp.send"}]:[],
  };
}
