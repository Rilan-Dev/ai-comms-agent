type Mailbox={id:string;label:string};
type VisibleMessage={email_account_id:string;account_email:string};

/** Saved choices stay available when message filters return no rows. */
export function mergeInboxMailboxes(saved:readonly Mailbox[],messages:readonly VisibleMessage[]):Mailbox[]{
 const choices=new Map(saved.map(account=>[account.id,account]));
 for(const message of messages)if(!choices.has(message.email_account_id))choices.set(message.email_account_id,{id:message.email_account_id,label:message.account_email});
 return [...choices.values()];
}
