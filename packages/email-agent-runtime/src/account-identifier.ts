import { query } from "@ai-comms-agent/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a model-supplied account identifier to the internal account UUID.
 *
 * Models frequently pass the mailbox address (e.g. "user@gmail.com") instead
 * of the UUID returned by email.accounts.list — the user's prompt names the
 * mailbox by address, so the model echoes it into account_id. A raw
 * PostgreSQL uuid-column comparison with a non-UUID string throws
 * "invalid input syntax for type uuid" inside the authorization query, which
 * the tool executor's generic catch surfaces as the cryptic
 * "authorization_unavailable" error. The user then sees "the system returned
 * an authorization error" and is told to reconnect a mailbox that is already
 * connected.
 *
 * Resolution rules (evaluated BEFORE any uuid-typed query runs):
 *   - Valid UUID            → passed through (normalized lowercase).
 *   - Email address / label → resolved through the org + agent binding scope
 *                             by exact (case-insensitive) email_address match.
 *                             An address that is not bound to this agent
 *                             returns null — it must NOT resolve, because
 *                             account bindings are the authorization boundary.
 *   - Anything else         → null; callers turn that into a clean
 *                             account_not_available denial instead of an
 *                             exception.
 */
export async function resolveAccountIdentifier(
  organizationId: string,
  agentId: string,
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  // Email address (or any non-UUID label): resolve via the agent's bound
  // mailboxes only. Matching is exact on the stored email_address so a
  // partial string can never widen the match to another mailbox.
  const result = await query<{ id: string }>(
    `SELECT a.id
       FROM email_accounts a
       JOIN agent_email_accounts b ON b.email_account_id = a.id
       JOIN agents g ON g.id = b.agent_id
      WHERE g.id = $1 AND g.organization_id = $2 AND a.organization_id = $2
        AND a.deleted_at IS NULL
        AND a.status = 'connected'
        AND lower(a.email_address) = lower($3)
      LIMIT 2`,
    [agentId, organizationId, trimmed],
  );
  return result.rows.length === 1 && result.rows[0]?.id ? String(result.rows[0].id) : null;
}
