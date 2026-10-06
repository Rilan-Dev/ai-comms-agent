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

export async function listChatMessages(organizationId: string, conversationId: string, limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const r = await query<Row>(
    "SELECT m.* FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.organization_id=$1 AND c.id=$2 ORDER BY m.created_at ASC LIMIT $3",
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
    await client.query("UPDATE conversations SET updated_at=now(),last_message_at=now() WHERE id=$1 AND organization_id=$2", [input.conversationId,input.organizationId]);
    if (!m.rows[0]) throw new Error("Conversation message insert returned no row");
    return mapMessage(m.rows[0]);
  });
}
