import { query, withTransaction } from "../client";
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
    return withTransaction(async (client) => {
      await client.query("DELETE FROM email_folders WHERE email_account_id = $1", [accountId]);
      for (const item of folders) {
        await client.query(
          `INSERT INTO email_folders
            (email_account_id, organization_id, provider_folder_id, name, folder_type, unread_count, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,now())`,
          [accountId, organizationId, item.provider_folder_id, item.name, item.role, item.unread_count],
        );
      }
      const result = await client.query<Row>(
        "SELECT * FROM email_folders WHERE email_account_id = $1 ORDER BY name",
        [accountId],
      );
      return result.rows.map(folder);
    });
  }

  /**
   * Replace the complete mailbox structure in one transaction so folders and
   * labels can never expose a half-refreshed discovery snapshot.
   */
  async replaceStructure(
    accountId: string,
    organizationId: string,
    folders: EmailFolder[],
    labels: EmailLabel[],
  ): Promise<{ folders: EmailFolder[]; labels: EmailLabel[] }> {
    return withTransaction(async (client) => {
      await client.query("DELETE FROM email_folders WHERE email_account_id = $1", [accountId]);
      for (const item of folders) {
        await client.query(
          `INSERT INTO email_folders
            (email_account_id, organization_id, provider_folder_id, name, folder_type, unread_count, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,now())`,
          [accountId, organizationId, item.provider_folder_id, item.name, item.role, item.unread_count],
        );
      }

      await client.query("DELETE FROM email_labels WHERE email_account_id = $1", [accountId]);
      for (const item of labels) {
        await client.query(
          `INSERT INTO email_labels
            (email_account_id, organization_id, provider_label_id, name, color, updated_at)
           VALUES ($1,$2,$3,$4,$5,now())`,
          [accountId, organizationId, item.provider_label_id, item.name, item.color ?? null],
        );
      }

      const [folderResult, labelResult] = await Promise.all([
        client.query<Row>("SELECT * FROM email_folders WHERE email_account_id = $1 ORDER BY name", [accountId]),
        client.query<Row>("SELECT * FROM email_labels WHERE email_account_id = $1 ORDER BY name", [accountId]),
      ]);
      return { folders: folderResult.rows.map(folder), labels: labelResult.rows.map(label) };
    });
  }
  async replaceLabels(accountId: string, organizationId: string, labels: EmailLabel[]): Promise<EmailLabel[]> {
    return withTransaction(async (client) => {
      await client.query("DELETE FROM email_labels WHERE email_account_id = $1", [accountId]);
      for (const item of labels) {
        await client.query(
          `INSERT INTO email_labels
            (email_account_id, organization_id, provider_label_id, name, color, updated_at)
           VALUES ($1,$2,$3,$4,$5,now())`,
          [accountId, organizationId, item.provider_label_id, item.name, item.color ?? null],
        );
      }
      const result = await client.query<Row>(
        "SELECT * FROM email_labels WHERE email_account_id = $1 ORDER BY name",
        [accountId],
      );
      return result.rows.map(label);
    });
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
