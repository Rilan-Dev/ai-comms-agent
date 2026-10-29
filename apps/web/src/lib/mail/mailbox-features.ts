const features = [
  ['send','Send messages'], ['drafts','Save drafts'], ['reply','Reply to a message'], ['forward','Forward a message'],
  ['folders','Organize with folders'], ['labels','Organize with labels'], ['threads','Group conversations'], ['mark_read','Mark as read or unread'],
  ['archive','Archive messages'], ['move','Move messages'], ['attachments_download','Download attachments'],
  ['attachments_upload','Send attachments'], ['sync_full','Load older mail'],
  ['sync_incremental','Check for new mail'], ['sync_webhook','Instant new-mail notifications'],
  ['sync_idle','Live inbox updates'], ['search_server_side','Search all mailbox mail'], ['search_client_side','Search mail already synced'],
] as const;

const unavailableHelp: Record<string, string> = {
  'gmail:forward': 'Forwarding is paused until original message content and attachments are preserved.',
  'gmail:attachments_download': 'Opening attachments from this mailbox is not available in the workspace yet.',
  'gmail:sync_webhook': 'New mail is checked in the background; instant Google notifications are not connected.',
  'imap_smtp:labels': 'This mailbox organizes messages with folders instead of labels.',
  'imap_smtp:search_server_side': 'Search covers messages already synced to this workspace.',
  'imap_smtp:sync_webhook': 'New mail is checked during background sync; this connection has no instant notification service.',
  'zoho:forward': 'Forwarding is not available for Zoho mailboxes yet.',
  'zoho:attachments_download': 'Downloading attachments is not available for Zoho mailboxes yet.',
  'zoho:attachments_upload': 'Sending attachments is not available for Zoho mailboxes yet.',
};

/** Report only saved discovery results; absent or malformed values are unknown. */
export function summarizeMailboxFeatures(capabilities:Record<string,unknown>|null|undefined,provider?:string) {
  return features.map(([key,label])=>{
    const status=capabilities?.[key]===true?'available' as const:capabilities?.[key]===false?'unavailable' as const:'unknown' as const;
    return {key,label,status,help:status==='unavailable'?(unavailableHelp[`${provider}:${key}`]??'This action is not available for this mailbox connection.'):undefined};
  });
}
