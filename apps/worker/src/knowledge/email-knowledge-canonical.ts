/**
 * A Gmail IMAP message can have separate provider folder UIDs in INBOX and
 * [Gmail]/All Mail. These must remain separate email_messages rows for folder
 * operations, but only one should own derived knowledge and vector points.
 *
 * This SQL fragment is used ONLY with fixed internal aliases:
 *   m = email_messages, a = email_accounts, f = current email_folders.
 * Missing/blank internet Message-IDs are deliberately never collapsed.
 */
export const IMAP_SHADOW_COPY_SQL = `
  a.provider='imap_smtp'
  AND NULLIF(BTRIM(m.internet_message_id), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM email_messages peer
      LEFT JOIN email_folders peer_folder
        ON peer_folder.id=peer.folder_id
       AND peer_folder.email_account_id=peer.email_account_id
     WHERE peer.email_account_id=m.email_account_id
       AND peer.organization_id=m.organization_id
       AND NULLIF(BTRIM(peer.internet_message_id), '') IS NOT NULL
       AND LOWER(BTRIM(peer.internet_message_id))=LOWER(BTRIM(m.internet_message_id))
       AND peer.id<>m.id
       AND (
         CASE WHEN peer_folder.role='inbox' OR UPPER(peer_folder.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,
         peer.id
       ) < (
         CASE WHEN f.role='inbox' OR UPPER(f.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,
         m.id
       )
  )
`;
