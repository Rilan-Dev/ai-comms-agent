/** Presentation only. A provider's accepted state is not recipient delivery. */
export function operationStateLabel(state:string,error?:string|null):string{
 if(error&&/outcome is unknown|manual verification required/i.test(error))return 'Needs verification';
 return ({pending:'Awaiting approval',pending_approval:'Awaiting approval',approved:'Approved',rejected:'Rejected',queued:'Queued',executing:'Sending',sent:'Provider accepted',delivered:'Delivered',read:'Read',received:'Received',requires_template:'Choose an approved template',expired:'Expired',failed:'Failed'} as Record<string,string>)[state]??'Needs verification';
}
