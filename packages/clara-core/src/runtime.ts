/**
 * Clara runtime re-export
 *
 * Re-exports the claraRuntime object from Clara's ai-platform-core module.
 * The actual export is `export const claraRuntime = { ... } as const;` —
 * a const object with methods:
 *   - resolveProvider(ctx, surface)
 *   - resolveVoice(ctx)
 *   - retrieve(ctx, query, options)
 *   - createChatTurn(request)
 *   - startRealtimeSession(ctx)
 *   - tools.list() / tools.invoke(ctx, name, input)
 *
 * The `tools` interface supports `rag_search` — the narrow host-binding
 * runtime tool. ai-comms-agent owns its own application ToolRegistry for
 * email, WhatsApp, scheduling, and approval tools (per TOOL-CONTRACTS.md).
 *
 * Source: vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts
 * (immutable byte-for-byte copy — never modified)
 */

// This re-export relies on the tsconfig paths configuration:
//   "@/modules/*" -> "../../vendor/clara/clara-core/source/src/modules/*"
export {
  claraRuntime,
  type ClaraRuntimeContext,
  type ClaraAgentTurnRequest,
  type ClaraAgentTurn,
} from "../../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime";
