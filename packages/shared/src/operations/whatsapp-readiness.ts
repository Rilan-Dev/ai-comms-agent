export type WhatsAppReadiness={
  state:'loading'|'unavailable'|'disconnected'|'provider_error'|'bound_without_permission'|'template_required'|'ready';
  connected:boolean;canRequestSend:boolean;message:string;accountId?:string;accountLabel?:string;windowOpen:boolean|null;
};

/** Explanatory state only. Request, approval and worker boundaries recheck
 * authorization, account binding, templates and Meta's window independently. */
export function deriveWhatsAppReadiness(input:{loaded:boolean;error?:boolean;account:{id:string;label:string;status:string}|null;canSend:boolean;toolEnabled:boolean;windowOpen:boolean|null}):WhatsAppReadiness{
  const base={connected:input.account?.status==='connected',canRequestSend:false,windowOpen:input.windowOpen,
    ...(input.account?{accountId:input.account.id,accountLabel:input.account.label}:{})};
  if(!input.loaded)return {...base,state:'loading',message:'Checking WhatsApp connection and saved permissions…'};
  if(input.error)return {...base,state:'unavailable',message:'WhatsApp readiness could not be checked. Retry the check.'};
  if(input.account?.status==='error')return {...base,state:'provider_error',message:'Meta connection needs attention. Refresh the account verification in WhatsApp.'};
  if(!base.connected)return {...base,state:'disconnected',message:'Bind and verify a connected WhatsApp account in Channels.'};
  if(!input.canSend)return {...base,state:'bound_without_permission',message:'WhatsApp is connected. Your current permission does not allow send requests.'};
  if(!input.toolEnabled)return {...base,state:'bound_without_permission',message:'WhatsApp is connected. Enable the send approval tool in the saved agent policy.'};
  if(input.windowOpen===false)return {...base,state:'template_required',canRequestSend:true,message:'Use an approved template, or ask the recipient to start an inbound conversation. Free-form text is unavailable outside the 24-hour window. Human approval is still required.'};
  return {...base,state:'ready',canRequestSend:true,message:'Ready to request human approval. Provider delivery still requires approval and a valid customer-service window or approved template.'};
}
