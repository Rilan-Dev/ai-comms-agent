export function summarizeAgentOverview(input:{mailboxCount:number;readableMailboxCount:number;whatsappAssigned:boolean;policyExists:boolean;mailReadEnabled:boolean}) {
 return {mailboxes:input.mailboxCount ? `${input.mailboxCount} assigned` : 'Not assigned',whatsapp:input.whatsappAssigned ? 'Assigned' : 'Not assigned',policy:input.policyExists ? 'Saved' : 'Missing',showMailSetup:input.readableMailboxCount===0 || !input.mailReadEnabled};
}

export function summarizeDeployment(status:string, deploymentId:string|null):string {
 if (status === "paused") return "Paused";
 if (status === "archived") return "Archived";
 if (!deploymentId) return "Not deployed";
 return status === "active" ? "Deployed" : "Inactive";
}
