import { query, withTransaction } from "../client";

type Row = Record<string, unknown>;

function mapConversation(row: Row) {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    organizationId: String(row.organization_id),
    channel: String(row.channel),
    subject: row.subject ? String(row.subject) : null,
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
  };
}

function mapMessage(row: Row) {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: String(row.role),
    content: row.content ? String(row.content) : "",
    contentJson: row.content_json ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getOrCreateChatConversation(organizationId: string, agentId: string) {
  return withTransaction(async (client) => {
    // Serialize first-load session creation with explicit New Chat requests.
    // A SELECT followed by INSERT with no row lock can produce two sessions
    // when browser tabs or Chat and Voice open the same agent concurrently.
    // Locking the specific tenant-scoped agent row avoids a global lock or a
    // unique constraint that would incorrectly prevent multiple saved chats.
    const lockedAgent = await client.query<Row>(
      "SELECT id FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [organizationId, agentId],
    );
    if (!lockedAgent.rows[0]) throw new Error("Agent not found in this organization");
    const existing = await client.query<Row>(
      "SELECT * FROM conversations WHERE organization_id=$1 AND agent_id=$2 AND channel='chat' AND status='active' ORDER BY updated_at DESC LIMIT 1",
      [organizationId, agentId],
    );
    if (existing.rows[0]) return mapConversation(existing.rows[0]);
    const created = await client.query<Row>(
      "INSERT INTO conversations (organization_id, agent_id, channel, subject) SELECT a.organization_id,a.id,'chat','Chat with ' || a.name FROM agents a WHERE a.organization_id=$1 AND a.id=$2 RETURNING *",
      [organizationId, agentId],
    );
    if (!created.rows[0]) throw new Error("Agent not found in this organization");
    return mapConversation(created.rows[0]);
  });
}

/** A new session never reuses the currently active chat or its model history. */
export async function createChatConversation(organizationId: string, agentId: string) {
  return withTransaction(async (client) => {
    // Coordinate with getOrCreateChatConversation to avoid an automatic
    // first-load INSERT racing a user-requested fresh chat.
    const lockedAgent = await client.query<Row>(
      "SELECT id FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [organizationId, agentId],
    );
    if (!lockedAgent.rows[0]) throw new Error("Agent not found in this organization");
    const result = await client.query<Row>(
      "INSERT INTO conversations (organization_id, agent_id, channel, subject) SELECT a.organization_id,a.id,'chat','New chat' FROM agents a WHERE a.organization_id=$1 AND a.id=$2 RETURNING *",
      [organizationId, agentId],
    );
    if (!result.rows[0]) throw new Error("Agent not found in this organization");
    return mapConversation(result.rows[0]);
  });
}

/** History entries are strictly scoped to one organization and one agent. */
export async function listChatConversations(organizationId: string, agentId: string, limit = 40) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = await query<Row>(
    "SELECT c.* FROM conversations c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id WHERE c.organization_id=$1 AND c.agent_id=$2 AND c.channel='chat' AND c.status='active' ORDER BY COALESCE(c.last_message_at,c.updated_at) DESC, c.id DESC LIMIT $3",
    [organizationId, agentId, safeLimit],
  );
  return result.rows.map(mapConversation);
}

export async function getChatConversation(organizationId: string, conversationId: string, agentId?: string) {
  const r = await query<Row>(
    "SELECT * FROM conversations WHERE organization_id=$1 AND id=$2 AND channel='chat'" + (agentId ? " AND agent_id=$3" : "") + " LIMIT 1",
    agentId ? [organizationId, conversationId, agentId] : [organizationId, conversationId],
  );
  return r.rows[0] ? mapConversation(r.rows[0]) : null;
}

export async function listChatMessages(organizationId: string, conversationId: string, limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const r = await query<Row>(
    "SELECT recent.* FROM (SELECT m.* FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.organization_id=$1 AND c.id=$2 AND c.channel='chat' ORDER BY m.created_at DESC,m.id DESC LIMIT $3) recent ORDER BY recent.created_at ASC,recent.id ASC",
    [organizationId, conversationId, safeLimit],
  );
  return r.rows.map(mapMessage);
}

export async function appendConversationMessage(input: {
  organizationId: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}) {
  return withTransaction(async (client) => {
    const c = await client.query<Row>(
      "SELECT id FROM conversations WHERE id=$1 AND organization_id=$2 LIMIT 1",
      [input.conversationId, input.organizationId],
    );
    if (!c.rows[0]) throw new Error("Conversation not found");
    const m = await client.query<Row>(
      "INSERT INTO conversation_messages (conversation_id,role,content) VALUES ($1,$2,$3) RETURNING *",
      [input.conversationId, input.role, input.content],
    );
    await client.query(
      "UPDATE conversations SET updated_at=now(),last_message_at=now(),subject=CASE WHEN $3='user' AND subject='New chat' THEN LEFT($4,80) ELSE subject END WHERE id=$1 AND organization_id=$2",
      [input.conversationId, input.organizationId, input.role, input.content],
    );
    if (!m.rows[0]) throw new Error("Conversation message insert returned no row");
    return mapMessage(m.rows[0]);
  });
}
