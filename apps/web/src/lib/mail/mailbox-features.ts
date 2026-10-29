const features = [
  ['send','Send messages'], ['drafts','Save drafts'], ['reply','Reply'], ['forward','Forward'],
  ['folders','Folders'], ['labels','Labels'], ['threads','Conversations'], ['mark_read','Mark as read'],
  ['archive','Archive'], ['move','Move messages'], ['attachments_download','Download attachments'],
  ['attachments_upload','Send attachments'], ['sync_full','Full synchronization'],
  ['sync_incremental','Incremental synchronization'], ['sync_webhook','Push notification support'],
  ['sync_idle','Live update support'], ['search_server_side','Provider search'], ['search_client_side','Local search'],
] as const;

/** Report only saved discovery results; absent or malformed values are unknown. */
export function summarizeMailboxFeatures(capabilities:Record<string,unknown>|null|undefined) {
  return features.map(([key,label])=>({key,label,status:capabilities?.[key]===true?'available' as const:capabilities?.[key]===false?'unavailable' as const:'unknown' as const}));
}
