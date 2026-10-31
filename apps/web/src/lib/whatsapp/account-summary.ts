export function whatsappAccountSummary(actions:ReadonlyArray<{whatsapp_account_id:string;status:string}>,accountId:string){
 const selected=actions.filter(action=>action.whatsapp_account_id===accountId);
 return {pending:selected.filter(action=>action.status==='pending').length,needsAttention:selected.filter(action=>action.status==='requires_template').length};
}
