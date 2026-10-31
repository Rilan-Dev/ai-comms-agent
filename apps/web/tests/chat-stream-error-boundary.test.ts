import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/lib/identity/authorization.ts", import.meta.url), "utf8");
const post = source.slice(source.indexOf("export async function POST(request: Request)"));
const streamCatch = post.slice(post.lastIndexOf("} catch (error) {", post.lastIndexOf("return new Response(stream,")));
const outerCatch = post.slice(post.lastIndexOf("} catch (error) {"));

describe("chat streaming errors never disclose server/provider exception details", () => {
  it("keeps explicit origin, validation, tenant and conversation protections", () => {
    expect(post).toContain("assertSameOrigin(request)");
    expect(post).toContain('error: "invalid_origin"');
    expect(post).toContain('error: "validation_error"');
    expect(post).toContain("authorize(request, {");
    expect(post).toContain("getChatConversation(organizationId, requestedConversationId, agentId)");
    expect(post).toContain('status: 404');
  });
  it("reuses the shared authorization-to-HTTP mapping for 401, 403 and opaque 500", () => {
    expect(outerCatch).toContain("return authorizationErrorToResponse(error)");
    expect(outerCatch).not.toContain("console.error");
    expect(outerCatch).toContain('error instanceof MailReportScopeError');
    expect(outerCatch).toContain('return authorizationErrorToResponse(error)');
    expect(outerCatch).not.toContain("message, code");
    expect(auth).toContain("if (error instanceof UnauthorizedError)");
    expect(auth).toContain("if (error instanceof ForbiddenError)");
    expect(auth).toContain('error: "internal_server_error"');
    expect(auth).toContain("rawCode");
    expect(auth).toContain("sqlstate");
  });
  it("keeps provider and SQL exception contents out of event-stream error frames", () => {
    expect(streamCatch).toContain('const failureMessage = safeChatFailure(error).category===\'output_limit\'');
    expect(streamCatch).toContain('emit("delta", { text: failureMessage });');
    expect(streamCatch).toContain('saveWhatsAppCard(failureMessage)');
    expect(streamCatch).toContain('The AI reached its response limit.');
    expect(streamCatch).toContain(': explicitMessagingAction');
    expect(streamCatch).not.toContain("error instanceof Error ? error.message");
    expect(streamCatch).not.toContain("JSON.stringify(error)");
    expect(streamCatch).toContain("controller.close()");
    expect(post).toContain('emit("done", { conversationId: conversation.id');
    expect(post).toContain('content-type": "text/event-stream; charset=utf-8"');
  });
});
