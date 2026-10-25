type Identity = { turnId: string; callId: string; correlationId: string; auditPending?: boolean };
type PersistedState = { state: "pending_approval" | "rejected" | "expired" | "queued" | "provider_accepted"; resourceId: string };
type UnconfirmedState = { state: "failed" | "outcome_unknown"; resourceId?: string; errorCode?: string };
export type OperationResult = Identity & (
  | ({ channel: "email"; operation: "draft" | "send" | "reply" | "forward" } &
    (PersistedState | UnconfirmedState | {state:"draft_saved";resourceId:string}))
  | ({ channel: "whatsapp"; operation: "send" } &
    (PersistedState | UnconfirmedState | {state:"delivered";resourceId:string}))
  | ({ channel: "schedule"; operation: "create" | "update" | "delete" } &
    ({state:"completed";resourceId?:string} | UnconfirmedState))
);

const EMAIL_OPERATIONS = {
  "email.draft.create":"draft", "email.draft.update":"draft",
  "email.draft_reply":"draft", "email.draft_forward":"draft",
  "email.send.request":"send", "email.reply.request":"reply", "email.forward.request":"forward",
} as const;

const SCHEDULE_OPERATIONS = {
  "schedules.create":"create", "schedules.update":"update", "schedules.delete":"delete",
} as const;

/** Called only after the host executor returns, with the name from its saved
 * registry. Model arguments/text and previous turns are never inputs here.
 * The mutation handlers return IDs only after organization-scoped persistence.
 * These tools propose actions; they cannot attest to provider delivery. */
export function operationResultFromToolCall(args: {
  context: {turn_id:string;correlation_id:string};callId:string;registeredName:string|undefined;
  result:{ok:boolean;output?:unknown;error?:{code:string;message?:string;retryable?:boolean}};
}): OperationResult | null {
  const name=args.registeredName;
  if (!name || !args.callId || !args.context.turn_id || !args.context.correlation_id) return null;
  const scheduleOperation=SCHEDULE_OPERATIONS[name as keyof typeof SCHEDULE_OPERATIONS];
  const operation=EMAIL_OPERATIONS[name as keyof typeof EMAIL_OPERATIONS];
  if (!operation && name!=="whatsapp.send" && !scheduleOperation) return null;
  const identity={turnId:args.context.turn_id,callId:args.callId,correlationId:args.context.correlation_id,
    ...(args.result.error?.code==='audit_persistence_failed'?{auditPending:true}:{})};
  if (scheduleOperation) {
    const base={...identity,channel:'schedule' as const,operation:scheduleOperation};
    if (!args.result.ok && args.result.error?.code!=='audit_persistence_failed') {
      return {...base,state:'failed',errorCode:args.result.error?.code};
    }
    const output=args.result.output && typeof args.result.output==='object' && !Array.isArray(args.result.output)
      ? args.result.output as Record<string,unknown> : {};
    const schedule=output.schedule as Record<string,unknown>|undefined;
    const id=typeof schedule?.id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schedule.id) ? schedule.id : undefined;
    return {...base,state:'completed',...(id?{resourceId:id}:{})};
  }
  const base=name==='whatsapp.send'
    ? {...identity,channel:'whatsapp' as const,operation:'send' as const}
    : {...identity,channel:'email' as const,operation:operation!};
  if (!args.result.ok && args.result.error?.code!=='audit_persistence_failed') return {...base,state:'failed',errorCode:args.result.error?.code};
  const output=args.result.output && typeof args.result.output==='object' && !Array.isArray(args.result.output)
    ? args.result.output as Record<string,unknown> : {};
  const isDraft=base.channel==='email' && operation==='draft';
  const id=isDraft ? output.draft_id : output.action_id;
  if (typeof id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return {...base,state:'outcome_unknown'};
  }
  if (base.channel==='email' && isDraft && ['draft_created','draft_updated','reply_draft_created','forward_draft_created'].includes(String(output.status))) {
    return {...base,state:'draft_saved',resourceId:id};
  }
  if (output.status==='pending_approval' || (base.channel==='whatsapp' && output.status==='pending' && output.approval_required===true)) {
    return {...base,state:'pending_approval',resourceId:id};
  }
  // Autonomous-send policy: the agent administrator waived the human approval
  // step for this agent, so the tool approved the request itself. The persisted
  // action/queue rows exist exactly like a human-approved send; only the
  // approval source differs. Delivery is still provider-confirmed separately.
  if (output.auto_approved===true && (output.status==='auto_approved' || output.status==='approved' || output.status==='queued')) {
    return {...base,state:'queued',resourceId:id};
  }
  return {...base,state:'outcome_unknown',resourceId:id};
}
