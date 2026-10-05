import { query } from "../client";
import type { EmailFolder, EmailLabel } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function folder(row: Row): EmailFolder {
  return {
    id: String(row.id),
    email_account_id: String(row.email_account_id),
    provider_folder_id: String(row.provider_folder_id),
    name: String(row.name),
    parent_id: row.parent_folder_id ? String(row.parent_folder_id) : null,
    role: (String(row.folder_type ?? "custom") as EmailFolder["role"]),
    unread_count: Number(row.unread_count ?? 0),
    last_synced_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function label(row: Row): EmailLabel {
  return {
    id: String(row.id),
    email_account_id: String(row.email_account_id),
    provider_label_id: String(row.provider_label_id),
    name: String(row.name),
    color: row.color ? String(row.color) : undefined,
    label_type: "user",
  };
}

export class PostgresEmailFolderLabelRepository {
  async replaceFolders(accountId: string, organizationId: string, folders: EmailFolder[]): Promise<EmailFolder[]> {
    for (const item of folders) {
      await query(
        `INSERT INTO email_folders
          (email_account_id, organization_id, provider_folder_id, name, folder_type, unread_count, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (email_account_id, provider_folder_id)
         DO UPDATE SET name=EXCLUDED.name, folder_type=EXCLUDED.folder_type,
                       unread_count=EXCLUDED.unread_count, updated_at=now()`,
        [accountId, organizationId, item.provider_folder_id, item.name, item.role, item.unread_count],
      );
    }
    return this.listFolders(accountId);
  }

  async replaceLabels(accountId: string, organizationId: string, labels: EmailLabel[]): Promise<EmailLabel[]> {
    for (const item of labels) {
      await query(
        `INSERT INTO email_labels
          (email_account_id, organization_id, provider_label_id, name, color, updated_at)
         VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (email_account_id, provider_label_id)
         DO UPDATE SET name=EXCLUDED.name, color=EXCLUDED.color, updated_at=now()`,
        [accountId, organizationId, item.provider_label_id, item.name, item.color ?? null],
      );
    }
    return this.listLabels(accountId);
  }

  async listFolders(accountId: string): Promise<EmailFolder[]> {
    const result = await query<Row>(
      "SELECT * FROM email_folders WHERE email_account_id = $1 ORDER BY name",
      [accountId],
    );
    return result.rows.map(folder);
  }

  async listLabels(accountId: string): Promise<EmailLabel[]> {
    const result = await query<Row>(
      "SELECT * FROM email_labels WHERE email_account_id = $1 ORDER BY name",
      [accountId],
    );
    return result.rows.map(label);
  }
}
