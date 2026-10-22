import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const repository = read("../../../packages/db/src/conversation/repository.ts");
const exportsFile = read("../../../packages/db/src/index.ts");
const api = read("../src/app/api/chat/conversation/route.ts");
const page = read("../src/app/chat/page.tsx");
const client = read("../src/app/chat/chat-client.tsx");
const stream = read("../src/app/api/chat/stream/route.ts");

describe("Independent chat sessions with resumable agent-scoped history", () => {
  it("creates a new persisted conversation without reusing or clearing another session", () => {
    const create = repository.slice(repository.indexOf("export async function createChatConversation("),
      repository.indexOf("export async function listChatConversations("));
    expect(create).toContain("INSERT INTO conversations");
    expect(create).toContain("'chat','New chat'");
    expect(create).toContain("WHERE a.organization_id=$1 AND a.id=$2");
    expect(create).toContain("RETURNING *");
    expect(create).not.toContain("getOrCreateChatConversation(");
    expect(create).not.toMatch(/DELETE FROM conversations|DELETE FROM conversation_messages/);
    expect(exportsFile).toContain("createChatConversation");
  });

  it("lists recent sessions in the selected organization and agent only", () => {
    const list = repository.slice(repository.indexOf("export async function listChatConversations("),
      repository.indexOf("export async function getChatConversation("));
    expect(list).toContain("c.organization_id=$1 AND c.agent_id=$2");
    expect(list).toContain("c.channel='chat' AND c.status='active'");
    expect(list).toContain("JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id");
    expect(list).toContain("COALESCE(c.last_message_at,c.updated_at) DESC");
    expect(list).toContain("Math.trunc(limit)");
    expect(list).toContain("LIMIT $3");
  });

  it("loads the newest 100 messages chronologically to maintain a continued chat's context", () => {
    const messages = repository.slice(repository.indexOf("export async function listChatMessages("),
      repository.indexOf("export async function appendConversationMessage("));
    expect(messages).toContain("c.organization_id=$1 AND c.id=$2 AND c.channel='chat'");
    expect(messages).toContain("ORDER BY m.created_at DESC,m.id DESC LIMIT $3");
    expect(messages).toContain("ORDER BY recent.created_at ASC,recent.id ASC");
    expect(repository).toContain("subject='New chat'");
    expect(repository).toContain("LEFT($4,80)");
    expect(stream).toContain("getChatConversation(organizationId, requestedConversationId, agentId)");
    expect(stream).toContain("const history = await listChatMessages(organizationId, conversation.id, 40)");
    expect(stream).toContain("...filteredHistory");
  });

  it("requires authentication and existing agent before creating or resuming a session", () => {
    expect(api).toContain("export async function GET(request: Request)");
    expect(api).toContain("export async function POST(request: Request)");
    expect(api).toContain('permission: "organization.read"');
    expect(api).toContain("new PostgresAgentRepository().get(organizationId, agentId)");
    expect(api).toContain("getChatConversation(organizationId, requestedConversationId, agentId)");
    expect(api).toContain("createChatConversation(organizationId, agentId)");
    expect(api).toContain("listChatConversations(organizationId, agentId, 40)");
    expect(api).toContain('status: 404');
    expect(api).toContain('status: 201');
    expect(api).not.toMatch(/DELETE FROM conversations|UPDATE conversations SET agent_id/);
  });

  it("supports direct links to the original conversation without silently selecting another agent", () => {
    expect(page).toContain("params.conversationId");
    expect(page).toContain("getChatConversation(organizationId, params.conversationId, agent.id)");
    expect(page).toContain('title="Chat not found"');
    expect(page).toContain("initialConversations={conversations}");
    expect(client).toContain('aria-label="Chat history"');
    expect(client).toContain('aria-label="Recent conversations"');
    expect(client).toContain('aria-current={session.id === conversationId ? "page" : undefined}');
    expect(client).toContain("new URLSearchParams({ agentId, conversationId: session.id })");
    expect(client).toContain("window.history.replaceState");
  });

  it("starts a fresh session by deliberate action and preserves history and drafts on failed creation", () => {
    const start = client.slice(client.indexOf("async function startNewChat()"),
      client.indexOf("async function returnFromVoice()"));
    expect(start).toContain("if (draft.trim() && !window.confirm");
    expect(start).toContain('method: "POST"');
    expect(start).toContain("payload.conversation.id");
    expect(start).toContain("window.location.assign(");
    expect(start).toContain("setChatHistoryNotice(");
    expect(start).not.toContain("setMessages([])");
    expect(start).not.toContain("setDraft(");
    expect(client).toContain("disabled={busy || newChatBusy || agentSwitchBusy || composeBusy || mailPermissionBusy || voiceOpen}");
    expect(client).toContain("Open this chat and discard your unsent message?");
  });

  it("returns from voice to the exact selected chat rather than jumping to the newest chat", () => {
    const voice = client.slice(client.indexOf("async function returnFromVoice()"),
      client.indexOf("async function openMailComposer("));
    expect(voice).toContain("new URLSearchParams({ organizationId, agentId, conversationId })");
    expect(voice).toContain("data.conversation?.id === conversationId");
    expect(voice).toContain("message.conversationId === data.conversation?.id");
    expect(voice).toContain("if (epoch !== agentContextEpochRef.current) return");
  });
});
