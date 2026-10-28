export function summarizeAgentOverview(input:{mailboxCount:number;readableMailboxCount:number;whatsappAssigned:boolean;policyExists:boolean;mailReadEnabled:boolean}) {
 return {mailboxes:input.mailboxCount ? `${input.mailboxCount} assigned` : 'Not assigned',whatsapp:input.whatsappAssigned ? 'Assigned' : 'Not assigned',policy:input.policyExists ? 'Saved' : 'Missing',showMailSetup:input.readableMailboxCount===0 || !input.mailReadEnabled};
}
