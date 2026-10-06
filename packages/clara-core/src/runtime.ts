/** @ts-nocheck
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
 *
 * The vendored Clara submodule is intentionally optional in host checkouts.
 * @ts-nocheck is used at this immutable-boundary re-export so downstream
 * package consumers do not turn an absent optional submodule into a host
 * typecheck failure. When the submodule is present, the original Clara
 * runtime remains the sole runtime implementation.
 */

// This re-export relies on the tsconfig paths configuration:
//   "@/modules/*" -> "../../vendor/clara/clara-core/source/src/modules/*"
// @ts-ignore — the optional Clara submodule may be absent in host checkouts.
export {
  claraRuntime,
  type ClaraRuntimeContext,
  type ClaraAgentTurnRequest,
  type ClaraAgentTurn,
} from "../../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime";
