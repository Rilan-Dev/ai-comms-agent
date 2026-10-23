import { NextResponse } from "next/server";
import { PostgresAgentRepository, appendConversationMessage, getChatConversation, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { runEmailAgentTurn } from "@ai-comms-agent/email-agent-runtime";
import { composeAssistantGuidance } from "@/lib/mail/compose-identity";
import { claraRuntime } from "@ai-comms-agent/clara-core";
import { deniedEmailWriteExplanation, isExplicitEmailMutationRequest, unverifiedEmailActionExplanation, verifiedEmailToolSummary } from "@/lib/mail/action-feedback";


export const dynamic = "force-dynamic";

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for voice turns." }, { status: 503 });
    }

    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = text(body?.organizationId, 100);
    const agentId = text(body?.agentId, 100);
    const sessionId = text(body?.sessionId, 100);
    const transcript = text(body?.transcript);

    if (!organizationId || !agentId || !sessionId || !transcript) {
      return NextResponse.json(
        { error: "validation_error", message: "organizationId, agentId, sessionId and transcript are required." },
        { status: 422 },
      );
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    if (!subject.membership) {
      return NextResponse.json({ error: "forbidden", message: "An active organization membership is required." }, { status: 403 });
    }

    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent was not found in this organization." }, { status: 404 });

    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    const transcriptBridgeOnly =
      session.status === "starting" &&
      (session.metadata as Record<string, unknown> | null)?.transportMode === "transcript_bridge";
    if ((session.status !== "active" && !transcriptBridgeOnly) || session.ended_at) {
      return NextResponse.json({ error: "session_not_active", message: "Voice turns require a connected session or an explicitly initialized transcript bridge." }, { status: 409 });
    }

    const runtimeSettings = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id = $1", [organizationId]);
    // KB ID is OPTIONAL for voice turns. RAG features are skipped when no KB is configured.
    const kbId = runtimeSettings.rows[0]?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim() || "default";

    const turnRecorded = await incrementVoiceSessionTurnForOrganization(organizationId, sessionId, transcriptBridgeOnly);
    if (!turnRecorded) {
      return NextResponse.json({ error: "session_not_active", message: "Voice session ended before the turn could be recorded." }, { status: 409 });
    }

    // Only host-mediated, validated voice turns are archived. Provider-native
    // audio-only turns need a separately verified transcript contract before
    // claiming persistent replay. Never trust a client conversation ID here.
    const linkedConversation = typeof session.conversation_id === "string"
      ? await getChatConversation(organizationId, session.conversation_id, agentId)
      : null;
    if (linkedConversation) {
      await appendConversationMessage({
        organizationId, conversationId: linkedConversation.id, role: "user",
        content: `[Voice transcript] ${transcript}`,
      });
    }
    const saveAnswer = async (answer: string): Promise<void> => {
      if (linkedConversation && answer.trim()) {
        await appendConversationMessage({
          organizationId, conversationId: linkedConversation.id, role: "assistant",
          content: answer,
        });
      }
    };

    const executionId = crypto.randomUUID();
    const role = subject.membership.role;
    const permissions = [...subject.permissions];
    const explicitEmailAction = isExplicitEmailMutationRequest(transcript);
    const blockedWriteExplanation = deniedEmailWriteExplanation(transcript, subject.permissions);
    // Voice clients opt in to progressive text. The existing JSON contract
    // remains compatible for older clients. Conversations without a mailbox
    // or action intent use the same Clara token stream as Chat; tool-sensitive
    // turns continue to use the bounded email tool executor and never skip
    // approval/mailbox controls just to display speculative text.
    if (request.headers.get("accept")?.includes("text/event-stream")) {
      const needsAuthorizedTools = explicitEmailAction || /\b(email|mail|inbox|draft|message|messages|sender|recipient|attachment|account|contact|whatsapp|send|reply|forward|archive|trash|delete|move|mark|read|unread|approve|schedule|appointment|thread|folder|those|them)\b/i.test(transcript);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let deliveredText = "";
          const emit = (event: string, payload: Record<string, unknown>) => {
            if (event === "delta" && typeof payload.text === "string") deliveredText += payload.text;
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
          };
          try {
            emit("status", { phase: needsAuthorizedTools ? "tools" : "generating" });
            emit("progress", { phase: needsAuthorizedTools ? "checking_permissions" : "generating" });
            if (blockedWriteExplanation) {
              emit("delta", { text: blockedWriteExplanation });
              await saveAnswer(blockedWriteExplanation);
              emit("progress", { phase: "completed" });
              emit("done", { executionId, toolCalls: [], pendingApprovals: [], finishReason: "permission_denied", mode: "host-authorized-tools" });
            } else if (needsAuthorizedTools) {
              const result = await runEmailAgentTurn({
                organizationId, agentId, messages: [{ role: "system", content: composeAssistantGuidance({
                  name: subject.user.name, email: subject.user.email,
                }) }, { role: "user", content: transcript }], kbId,
                toolContext: {
                  organization_id: organizationId,
                  agent_id: agentId,
                  user_id: subject.user.id,
                  conversation_id: typeof session.conversation_id === "string" && session.conversation_id.trim() ? session.conversation_id : sessionId,
                  turn_id: executionId,
                  correlation_id: executionId,
                  channel: "voice",
                  auth_subject: { user_id: subject.user.id, role, permissions },
                },
                maxRounds: 4, maxToolCalls: 8,
                onProgress: (phase) => emit("progress", { phase }),
                onSafeReadOnlyFinal: explicitEmailAction ? undefined : async (completedHistory) => {
                  emit("status", { phase: "generating" });
                  const finalStream = await claraRuntime.streamAuthorizedReadOnlyToolAnswer(
                    { orgId: organizationId, agentId, kbId },
                    completedHistory,
                    request.signal,
                  );
                  let generated = "";
                  for await (const token of finalStream) {
                    if (request.signal.aborted) break;
                    generated += token;
                    emit("delta", { text: token });
                  }
                  if (!request.signal.aborted && !generated.trim()) {
                    throw new Error("The provider did not produce a final voice answer after completed read-only tools.");
                  }
                  return generated;
                },
              });
              if (!request.signal.aborted) {
                // The callback already streamed the provider's final tokens.
                // Writes/approvals/denials retain the canonical host answer.
                const verifiedSummary = verifiedEmailToolSummary(result.toolCalls);
                // A model answer is not evidence of delivery. Display the
                // verified host result instead of unconfirmed send claims.
                if (!result.streamed) emit("delta", { text: verifiedSummary || (explicitEmailAction ? unverifiedEmailActionExplanation() : result.text) });
                await saveAnswer(deliveredText);
                emit("progress", { phase: "completed" });
                emit("done", {
                  executionId, toolCalls: result.toolCalls, pendingApprovals: result.pendingApprovals,
                  finishReason: result.finishReason, mode: "host-authorized-tools",
                  deliveryMode: result.streamed ? "direct-provider-final" : "canonical-tool-answer",
                });
              }
            } else {
              // Actual model-generated tokens arrive incrementally here.
              const generation = await claraRuntime.createChatTurn({
                orgId: organizationId, agentId, kbId, userId: subject.user.id,
                sessionId, surface: "realtime", ragMode: "hybrid",
                messages: [
                  { role: "system", content: "This streamed voice text is read-only. Never claim to have sent, approved, deleted, archived, moved or changed mail or other resources. Such actions require the host-authorized tool path." },
                  { role: "user", content: transcript },
                ],
              });
              for await (const token of generation.stream) {
                if (request.signal.aborted) break;
                emit("delta", { text: token });
              }
              if (!request.signal.aborted) {
                await saveAnswer(deliveredText);
                emit("done", {
                  executionId, toolCalls: [], pendingApprovals: [],
                  finishReason: "completed", mode: "model-stream",
                });
              }
            }
          } catch (error) {
            if (!request.signal.aborted) {
              emit("error", { message: "Voice turn failed. No further action was confirmed. Review saved drafts and pending approvals before retrying." });
            }
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
        },
      });
    }

    if (blockedWriteExplanation) {
      await saveAnswer(blockedWriteExplanation);
      return NextResponse.json({
        executionId, text: blockedWriteExplanation, toolCalls: [], pendingApprovals: [],
        finishReason: "permission_denied", actions: [],
      });
    }

    const turn = await runEmailAgentTurn({
      organizationId,
      agentId,
      messages: [{ role: "system", content: composeAssistantGuidance({
                  name: subject.user.name, email: subject.user.email,
                }) }, { role: "user", content: transcript }],
      kbId,
      toolContext: {
        organization_id: organizationId,
        agent_id: agentId,
        user_id: subject.user.id,
        conversation_id: typeof session.conversation_id === "string" && session.conversation_id.trim() ? session.conversation_id : sessionId,
        turn_id: executionId,
        correlation_id: executionId,
        channel: "voice",
        auth_subject: {
          user_id: subject.user.id,
          role,
          permissions,
        },
      },
      maxRounds: 4,
      maxToolCalls: 8,
    });

    const verifiedSummary = verifiedEmailToolSummary(turn.toolCalls);
    const voiceAnswer = verifiedSummary || (explicitEmailAction ? unverifiedEmailActionExplanation() : turn.text);
    await saveAnswer(voiceAnswer);
    return NextResponse.json({
      executionId,
      text: voiceAnswer,
      toolCalls: turn.toolCalls,
      pendingApprovals: turn.pendingApprovals,
      finishReason: turn.finishReason,
      actions: turn.toolCalls,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
