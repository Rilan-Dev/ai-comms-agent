# Multiple AI chat sessions and resumable history — DEV-01 plan

Date: 2026-10-23  
Branch: `Development`  
Owner: DEV-01 / Forge  
Status: Phase 1 source implemented; runtime, database and browser acceptance pending

## Product request

An authenticated user can start a new AI chat to ask unrelated questions without carrying the previous chat's answers into the new model context. The user can browse previous conversations, open one and continue the same questions and answers. The selected chat must be stable across page reloads, agent switches, and voice-to-chat returns.

## Architecture recovered

- PostgreSQL `conversations` contains organization, agent, channel, subject, status and last-message timestamps; `conversation_messages` stores messages keyed by `conversation_id`. No new schema is necessary for multiple conversations **within the existing organization/agent access model**.
- `getOrCreateChatConversation()` originally always reused the newest active conversation for the selected agent; `/chat` rendered that one conversation. There was no create, list, or specific-chat selection UI.
- `/api/chat/stream` already accepts an explicit conversation ID, validates organization+agent, and uses only that conversation's recent persisted messages for the model prompt. Authoritative tool/user/email permissions remain server-side; conversation history must never become an authorization source.
- The embedded voice workspace shares a conversation ID with Chat. The return-from-voice path previously refetched the newest chat for an agent; with multiple chats it must request the exact prior ID.
- FIX-01 recently protected agent-switch race handling in `chat-client.tsx`; preserve those epoch/in-flight safeguards.

## Phase 1 — implemented in this Development session

1. `createChatConversation(org, agent)` inserts a distinct `chat` conversation with subject `New chat`; it never resets or deletes an older conversation.
2. `listChatConversations(org, agent)` returns most recent active sessions in a bounded, tenant/agent-scoped query.
3. `listChatMessages` now loads the **most recent** bounded messages, then returns them chronologically, so resumed conversations retain the latest relevant context rather than the oldest 100.
4. On the first stored user turn, a new session's label becomes the first 80 characters of that request; it is not an AI-generated claim, and existing labels are not overwritten.
5. `GET /api/chat/conversation` accepts an optional validated-by-query selected conversation ID; returns messages and the session list after organization-read authorization and agent existence checks. A wrong-org/wrong-agent session cannot be loaded.
6. `POST /api/chat/conversation` creates a new chat only after a signed-in authorized organization member chooses **New chat**, returning 201 and the new session ID.
7. `/chat?agentId=...&conversationId=...` deep links to the exact session, or shows a not-found message (no silent fallback to another agent's history). The UI includes New chat and scrollable recent-session links; it prompts before discarding an unsent message.
8. New chat navigates to a fresh server-rendered session, ensuring zero history from the prior chat is mounted in the new window. Selecting an old session loads only its stored messages; agent switch updates its URL; returning from voice refreshes the exact selected chat.
9. No role grant, send approval, provider connection, migration, CI job or live action is changed.

## Privacy and scope decision (not silently resolved)

The existing data model is **organization + agent scoped**, not creator/user scoped. This Phase 1 deliberately preserves that access contract; it must not be advertised as private-to-user ChatGPT memory. Other signed-in members with `organization.read` who can access the agent may see its organization's chat history. Before offering private personal histories, the product owner must decide whether chats are collaborative or private by default, then authorize an owner/membership schema migration, a secure plan for already-shared legacy conversations, and per-user list/read/stream/voice enforcement. Never guess the author of a legacy row or silently claim it as private.

## Next phases — not included

- **Phase 2 (after privacy/product review):** Explicitly chosen personal versus shared chats; owner-scoped records and legacy preservation, migration/permission negatives, safe team sharing, possibly user-selectable visibility.
- **Phase 3:** Pagination/search for chats older than the newest 40, rename/archive/delete with confirmation, retention policy, and accessible sidebar behavior. These require a separate explicit UX/data-deletion design; do not delete old chats to simulate a fresh session.
- **Phase 4:** Real provider context-window policy (recent turns versus explicit conversation summaries) with privacy-safe summary storage, truncation notices, and grounding tests. A new chat must not import unrelated conversation history into the model system messages.

## Test and acceptance matrix

- Create two chats under one agent: unique IDs, empty history in the second, old user/assistant messages still in the first.
- Switch between both and reload their deep links: correct conversation and chronological last 100 persisted messages, no cross-chat model context.
- After a new chat's first question, saved title is drawn from that question; active conversation appears in recent history.
- Wrong organization/agent or invalid selected ID never silently returns someone else's history; unauthenticated requests are rejected.
- Switch agents during load: no stale agent messages or outgoing tool/mail draft leak. Return from Voice reloads exact active session ID.
- New chat and history navigation are disabled during an in-flight message, voice session or mail-review; unsent prompts need explicit discard confirmation.
- Real PostgreSQL tests for concurrent creation, ordering, last-100 message truncation, database grants and legacy row compatibility; real Next.js/Vitest/browser tests.
- Deploy, migration and runtime acceptance are OPS-01 tasks only; substantial unrelated source bugs to FIX-01.

## Current verification and exact next action

Current GitHub-source checks verify the repository/API/page/client/stream contract. **No native Vitest, database-backed integration, Next build, user-browser acceptance or deployment has been run on this commit.** Execute on an equipped `Development` checkout:

```bash
pnpm --filter @ai-comms-agent/web exec vitest run \
  tests/chat-conversation-history.test.ts \
  tests/chat-agent-context-race.test.ts \
  tests/chat-authorization.test.ts \
  tests/streaming-conversations.test.ts
pnpm --filter @ai-comms-agent/web typecheck
pnpm --filter @ai-comms-agent/db typecheck
```

Then use an authorized disposable DB with two sessions in the same org/agent and verify persisted separation, late-message retrieval and browser navigation. Record tested SHA and exact failure evidence. Continue unrelated DEV-01 C3/R1b work independently without waiting for CI/Vercel, but do not activate gated routine dispatch.
