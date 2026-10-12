import {
  PostgresAgentRepository,
  PostgresEmailAccountRepository,
  PostgresEmailFolderLabelRepository,
  getMailMessageForOrganization,
  getMailThreadForOrganization,
  listMailFoldersForOrganization,
  query,
} from "@ai-comms-agent/db";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { EMAIL_TOOL_CATALOG } from "@ai-comms-agent/shared";

type Input = Record<string, unknown>;
type Row = Record<string, unknown>;
type ReadOutput = unknown;

class EmailToolFailure extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) { super(message); }
}

function objectInput(input: unknown): Input {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Input : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function boundedInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}
function summary(tool: string, count?: number): string {
  return count === undefined ? tool : `${tool}: ${count} result(s)`;
}
function result(toolName: string, startedAt: number, output?: ReadOutput, error?: { code: string; message: string; retryable: boolean }): ToolResult {
  return {
    ok: !error,
    ...(output === undefined ? {} : { output }),
    ...(error ? { error } : {}),
    audit: {
      tool_name: toolName,
      input_summary: toolName,
      output_summary: error ? error.code : summary(toolName, Array.isArray(output) ? output.length : undefined),
      duration_ms: Math.max(0, Date.now() - startedAt),
    },
  };
}

export interface EmailReadToolDependencies {
  accounts?: PostgresEmailAccountRepository;
  agents?: PostgresAgentRepository;
  folders?: PostgresEmailFolderLabelRepository;
}

/**
 * Build safe, read-only email tools. These handlers still require registration
 * in the shared runtime, which must persist audit results and enforce its policy
 * boundary. Account/org/agent binding is rechecked inside every account handler.
 */
export function createEmailReadTools(deps: EmailReadToolDependencies = {}): Tool[] {
  const accounts = deps.accounts ?? new PostgresEmailAccountRepository();
  const agents = deps.agents ?? new PostgresAgentRepository();
  const folders = deps.folders ?? new PostgresEmailFolderLabelRepository();

  async function requireRead(context: ToolContext): Promise<void> {
    if (!context.auth_subject.permissions.includes("email.read")) {
      throw new EmailToolFailure("permission_denied", "The current actor is not authorized to read email.");
    }
  }
  async function resolveAccount(accountId: string, context: ToolContext) {
    if (!accountId) throw new EmailToolFailure("invalid_account", "A connected email account is required.");
    const binding = await query<{ role: string }>(
      `SELECT b.role FROM agent_email_accounts b
       JOIN agents g ON g.id = b.agent_id
       JOIN email_accounts a ON a.id = b.email_account_id
       WHERE g.id = $1 AND g.organization_id = $2 AND a.id = $3
         AND a.organization_id = $2 AND a.deleted_at IS NULL
       LIMIT 1`,
      [context.agent_id, context.organization_id, accountId],
    );
    const role = binding.rows[0]?.role;
    if (!role || role === "send_only") throw new EmailToolFailure("account_not_available", "This agent is not allowed to read that mailbox.");
    const account = await accounts.getForAgent(context.organization_id, context.agent_id, accountId);
    if (!account) throw new EmailToolFailure("account_not_available", "This mailbox is not bound to this agent in the active organization.");
    if (account.status !== "connected") throw new EmailToolFailure("account_not_connected", "This mailbox is not connected.");
    return account;
  }
  function definition(name: string) {
    const descriptor = EMAIL_TOOL_CATALOG.find((item) => item.name === name);
    if (!descriptor) throw new Error(`Missing email tool contract: ${name}`);
    return descriptor;
  }
  function readTool(name: string, handler: (input: Input, context: ToolContext) => Promise<ReadOutput>): Tool {
    const descriptor = definition(name);
    return {
      name: descriptor.name,
      domain: "email",
      description: descriptor.description,
      input_schema: descriptor.input_schema,
      sensitivity: "safe",
      required_permission: descriptor.required_permission,
      ...(descriptor.required_capabilities[0] ? { required_capability: descriptor.required_capabilities[0] } : {}),
      retryable: true,
      idempotent: true,
      execute: async (rawInput, context) => {
        const startedAt = Date.now();
        try {
          await requireRead(context);
          const output = await handler(objectInput(rawInput), context);
          return result(name, startedAt, output);
        } catch (error) {
          const known = error instanceof EmailToolFailure ? error : null;
          return result(name, startedAt, undefined, {
            code: known?.code ?? "email_tool_failed",
            message: known?.message ?? "The email operation could not be completed.",
            retryable: known?.retryable ?? false,
          });
        }
      },
    };
  }

  const listAccounts = readTool("email.accounts.list", async (_input, context) => {
    const bindings = await agents.emailBindings(context.organization_id, context.agent_id);
    const visible = [];
    for (const binding of bindings) {
      if (binding.role === "send_only") continue;
      const account = await accounts.getForAgent(context.organization_id, context.agent_id, binding.emailAccountId);
      if (!account || account.status !== "connected") continue;
      visible.push({
        id: account.id, provider: account.provider, email_address: account.email_address,
        display_name: account.display_name, status: account.status, capabilities: account.capabilities,
        last_sync_at: account.last_sync_at,
      });
    }
    return visible;
  });

  const capabilities = readTool("email.capabilities.get", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    return { account_id: account.id, provider: account.provider, capabilities: account.capabilities };
  });

  const listFolders = readTool("email.folders.list", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (!account.capabilities.folders) throw new EmailToolFailure("capability_not_supported", "This provider does not support folder listing.");
    return listMailFoldersForOrganization(context.organization_id, account.id);
  });

  const listLabels = readTool("email.labels.list", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (!account.capabilities.labels) throw new EmailToolFailure("capability_not_supported", "This provider does not support labels.");
    return folders.listLabels(account.id);
  });

  async function listMessages(input: Input, context: ToolContext, searchMode: boolean): Promise<ReadOutput> {
    const account = await resolveAccount(text(input.account_id), context);
    const values: unknown[] = [context.organization_id, account.id];
    const conditions = ["m.organization_id = $1", "m.email_account_id = $2", "a.organization_id = $1", "a.deleted_at IS NULL"];
    const add = (condition: (index: number) => string, value: unknown) => {
      values.push(value); conditions.push(condition(values.length));
    };
    const folderId = text(input.folder_id) || text(input.folder);
    if (folderId) add((n) => `(m.folder_id::text = ${n} OR EXISTS (SELECT 1 FROM email_folders f WHERE f.email_account_id = m.email_account_id AND f.organization_id = $1 AND (f.id::text = ${n} OR f.provider_folder_id = ${n} OR f.name ILIKE ${n})))`, folderId);
    const queryText = text(input.query);
    if (queryText) add((n) => `(m.subject ILIKE $${n} OR m.from_email ILIKE $${n} OR m.from_name ILIKE $${n} OR m.text_body ILIKE $${n} OR m.snippet ILIKE $${n})`, `%${queryText.slice(0, 300)}%`);
    const from = text(input.from);
    if (from) add((n) => `m.from_email ILIKE $${n}`, `%${from.slice(0, 320)}%`);
    const subject = text(input.subject);
    if (subject) add((n) => `m.subject ILIKE $${n}`, `%${subject.slice(0, 300)}%`);
    if (input.unread_only === true) conditions.push("m.is_read = false");
    if (input.starred_only === true) conditions.push("m.is_starred = true");
    const label = text(input.label);
    if (label) add((n) => `m.labels @> jsonb_build_array(${n}::text)`, label);
    const dateFrom = text(input.date_from);
    if (dateFrom && Number.isFinite(Date.parse(dateFrom))) add((n) => `m.received_at >= $${n}::timestamptz`, dateFrom);
    const dateTo = text(input.date_to);
    if (dateTo && Number.isFinite(Date.parse(dateTo))) add((n) => `m.received_at <= $${n}::timestamptz`, dateTo);
    const limit = boundedInt(input.limit, 25, 100) || 25;
    const cursor = text(input.cursor);
    const offset = cursor && /^\d+$/.test(cursor) ? boundedInt(Number(cursor), 0, 1000000) : 0;
    values.push(limit, offset);
    const rows = await query<Row>(
      `SELECT m.id, m.email_account_id, m.thread_id, m.folder_id,
              COALESCE(m.from_email, m.from_name, '') AS from_address,
              m.to_recipients AS to_addresses, m.subject, m.snippet, m.received_at,
              m.is_read, m.is_starred, m.is_draft, m.is_sent AS is_outbound,
              m.importance_score, m.action_required,
              EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.message_id=m.id) AS has_attachments,
              a.email_address AS account_email, a.display_name AS account_name
       FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.received_at DESC NULLS LAST
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      messages: rows.rows,
      next_cursor: rows.rows.length === limit ? String(offset + rows.rows.length) : null,
      mode: searchMode ? "local_search" : "mailbox",
    };
  }

  const messages = readTool("email.messages.list", (input, context) => listMessages(input, context, false));
  const search = readTool("email.search", (input, context) => listMessages(input, context, true));

  const getMessage = readTool("email.message.get", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const message = await getMailMessageForOrganization(context.organization_id, text(input.message_id));
    if (!message || String(message.email_account_id) !== account.id) throw new EmailToolFailure("message_not_found", "Message not found in this mailbox.");
    const body = typeof message.text_body === "string" ? message.text_body.slice(0, 12000) : "";
    return { ...message, text_body: body, html_body: undefined };
  });

  const thread = readTool("email.thread.get", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    if (!account.capabilities.threads) throw new EmailToolFailure("capability_not_supported", "This provider does not support thread reads.");
    const rows = await getMailThreadForOrganization(context.organization_id, text(input.thread_id));
    const visible = rows.filter((row) => String(row.email_account_id) === account.id).slice(0, 50);
    if (!visible.length) throw new EmailToolFailure("thread_not_found", "Thread not found in this mailbox.");
    return visible.map((row) => ({ ...row, text_body: typeof row.text_body === "string" ? row.text_body.slice(0, 6000) : "", html_body: undefined }));
  });

  const syncStatus = readTool("email.sync.status", async (input, context) => {
    const account = await resolveAccount(text(input.account_id), context);
    const state = await query<Row>(
      `SELECT status, last_attempt_at, last_success_at, next_attempt_at, error_count
       FROM email_sync_states WHERE email_account_id=$1 AND organization_id=$2 LIMIT 1`,
      [account.id, context.organization_id],
    );
    return { account_id: account.id, status: state.rows[0]?.status ?? "not_started", last_attempt_at: state.rows[0]?.last_attempt_at ?? null, last_success_at: state.rows[0]?.last_success_at ?? null, next_attempt_at: state.rows[0]?.next_attempt_at ?? null, error_count: Number(state.rows[0]?.error_count ?? 0) };
  });

  return [listAccounts, capabilities, listFolders, listLabels, messages, getMessage, thread, search, syncStatus];
}
