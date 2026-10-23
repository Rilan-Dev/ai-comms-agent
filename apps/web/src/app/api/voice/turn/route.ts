import { NextResponse } from "next/server";
import { PostgresAgentRepository, appendConversationMessage, getChatConversation, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { runEmailAgentTurn, createEmailToolRuntime } from "@ai-comms-agent/email-agent-runtime";
import { formatRollingMailSummary, parseRollingMailSummaryRequest, type RollingMailRow } from "@/lib/mail/rolling-summary";
import { composeAssistantGuidance } from "@/lib/mail/compose-identity";
import { claraRuntime } from "@ai-comms-agent/clara-core";
import { deniedEmailWriteExplanation, isExplicitEmailMutationRequest } from "@/lib/mail/action-feedback";
import { userFacingChatAnswer } from "@/lib/chat/user-facing-answer";
import { currentTurnOperationAnswer } from "@/lib/chat/operation-feedback";


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

    // The normal Chat surface already uses a deterministic, scoped local
    // mailbox report for an explicit rolling 24-hour request. Voice must not
    // ask the model to guess mailbox contents for that same supported query.
    // Limit the spoken preview to the newest five, while retaining the exact
    // matching count and an explicit partial-coverage warning.
    const rollingMail = parseRollingMailSummaryRequest(transcript);
    let rollingMailAnswer: string | null = null;
    let rollingMailDenied = false;
    if (rollingMail) {
      const registered = subject.permissions.has("email.read")
        ? (await createEmailToolRuntime(organizationId, agentId)).registry.listForAgent(agentId)
        : [];
      const allowed = subject.permissions.has("email.read") && registered.some(tool =>
        tool.required_permission === "email.read"
        && (tool.name === "email.search" || tool.name === "email.messages.list"));
      if (!allowed) {
        rollingMailDenied = true;
        rollingMailAnswer = "I can't read this workspace's email messages with the current permissions. An administrator must enable email.read for you, enable Search or List Mail in the agent policy, and connect a readable mailbox. No messages were retrieved.";
      } else {
        const toUtc = new Date().toISOString();
        const fromUtc = new Date(new Date(toUtc).getTime() - 24 * 60 * 60 * 1000).toISOString();
        const rows = await query<RollingMailRow>(
          `SELECT m.id, a.email_address AS account_email, m.from_email::text AS from_email,
                  m.from_name, m.subject, m.received_at,
                  LEFT(m.snippet, 260) AS snippet, LEFT(m.text_body, 420) AS text_body,
                  COUNT(*) OVER ()::integer AS total_count
             FROM email_messages m
             JOIN email_accounts a ON a.id=m.email_account_id
              AND a.organization_id=$1 AND a.deleted_at IS NULL
             LEFT JOIN email_folders current_folder ON current_folder.id=m.folder_id
              AND current_folder.email_account_id=m.email_account_id
            WHERE m.organization_id=$1
              AND m.received_at >= $3::timestamptz
              AND m.received_at <= $4::timestamptz
              AND m.is_draft IS FALSE AND m.is_sent IS FALSE
              AND (NOT $7::boolean OR m.is_read IS FALSE)
              AND ($5::text IS NULL OR strpos(lower(coalesce(m.from_email::text, '')), lower($5::text)) > 0
                   OR strpos(lower(coalesce(m.from_name, '')), lower($5::text)) > 0)
              AND ($6::text IS NULL OR strpos(lower(coalesce(m.subject, '')), lower($6::text)) > 0
                   OR strpos(lower(coalesce(m.text_body, '')), lower($6::text)) > 0)
              AND EXISTS (
                SELECT 1 FROM agent_email_accounts b
                JOIN agents bound_agent ON bound_agent.id=b.agent_id AND bound_agent.organization_id=$1
                 WHERE b.email_account_id=a.id AND b.agent_id=$2
                   AND b.role IN ('primary','read_only')
              )
              -- An IMAP Gmail email can have separate UIDs in INBOX and
              -- All Mail. Count one logical Message-ID per account, favoring
              -- INBOX, while retaining archived (All Mail-only) messages.
              AND (a.provider <> 'imap_smtp'
                OR NULLIF(BTRIM(m.internet_message_id), '') IS NULL
                OR NOT EXISTS (
                  SELECT 1 FROM email_messages peer
                  LEFT JOIN email_folders peer_folder ON peer_folder.id=peer.folder_id
                   AND peer_folder.email_account_id=peer.email_account_id
                  WHERE peer.organization_id=m.organization_id
                    AND peer.email_account_id=m.email_account_id
                    AND peer.id<>m.id
                    AND LOWER(BTRIM(peer.internet_message_id))=LOWER(BTRIM(m.internet_message_id))
                    AND (
                      CASE WHEN peer_folder.role='inbox' OR UPPER(peer_folder.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,
                      peer.id
                    ) < (
                      CASE WHEN current_folder.role='inbox' OR UPPER(current_folder.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,
                      m.id
                    )
                ))
            ORDER BY m.received_at DESC, m.id DESC
            LIMIT $8`,
          [organizationId, agentId, fromUtc, toUtc,
            rollingMail.sender ?? null, rollingMail.topic ?? null, rollingMail.unreadOnly, 5],
        );
        rollingMailAnswer = formatRollingMailSummary(
          rows.rows, rollingMail, fromUtc, toUtc, "rolling 24-hour UTC voice overview",
        );
      }
    }

    const executionId = crypto.randomUUID();
    const role = subject.membership.role;
    const permissions = [...subject.permissions];
    const explicitEmailAction = isExplicitEmailMutationRequest(transcript);
    const blockedWriteExplanation = deniedEmailWriteExplanation(transcript, subject.permissions);
    // Keep JSON and SSE on the same host-trusted intent boundary. The JSON
    // fallback previously routed ordinary "hello" turns into email tools.
    const needsAuthorizedTools = explicitEmailAction || /\b(email|mail|inbox|draft|message|messages|sender|recipient|attachment|account|contact|whatsapp|send|reply|forward|archive|trash|delete|move|mark|read|unread|approve|schedule|appointment|thread|folder|those|them)\b/i.test(transcript);
    // A voice answer about actual mailbox contents must be grounded in a
    // successful scoped message/search read. A model's unsupported claim of
    // seeing email subjects is not evidence of host access.
    const requiresEmailContentEvidence = !explicitEmailAction && /\b(emails?|mailbox|inbox|mail)\b/i.test(transcript);
    // Voice clients opt in to progressive text. The existing JSON contract
    // remains compatible for older clients. Conversations without a mailbox
    // or action intent use the same Clara token stream as Chat; tool-sensitive
    // turns continue to use the bounded email tool executor and never skip
    // approval/mailbox controls just to display speculative text.
    if (request.headers.get("accept")?.includes("text/event-stream")) {
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
            if (rollingMailAnswer !== null) {
              emit("status", { phase: rollingMailDenied ? "permission_denied" : "verified_local_mail" });
              emit("delta", { text: rollingMailAnswer });
              await saveAnswer(rollingMailAnswer);
              emit("progress", { phase: "completed" });
              emit("done", {
                executionId, toolCalls: [], pendingApprovals: [],
                finishReason: rollingMailDenied ? "permission_denied" : "completed",
                mode: "verified-local-mail", source: rollingMailDenied ? "permission_gate" : "local_mail_database",
              });
            } else if (blockedWriteExplanation) {
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
                requireEmailContentEvidence: requiresEmailContentEvidence,
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
                  }
                  if (!request.signal.aborted && !generated.trim()) {
                    throw new Error("The provider did not produce a final voice answer after completed read-only tools.");
                  }
                  // Validate the full untrusted model reply before speaking or
                  // displaying any of it. A reasoning leak must not be spoken.
                  const validated = userFacingChatAnswer(generated);
                  if (!validated && !request.signal.aborted) throw new Error("Read-only voice model output was not a user-facing answer.");
                  if (validated && !request.signal.aborted) emit("delta", { text: validated });
                  return validated ?? "";
                },
              });
              if (!request.signal.aborted) {
                // The callback already streamed the provider's final tokens.
                // Writes/approvals/denials retain the canonical host answer.
                const verifiedSummary = currentTurnOperationAnswer(result.text, result.toolCalls.flatMap(call => call.operation ? [call.operation] : []), executionId, explicitEmailAction);
                // A model answer is not evidence of delivery. Display the
                // verified host result instead of unconfirmed send claims.
                if (!result.streamed) emit("delta", { text: verifiedSummary });
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
                // The host must not claim an answered voice turn when the
                // model yielded no spoken-text tokens at all.
                if (!deliveredText.trim()) throw new Error("AI provider returned an empty voice response.");
                await saveAnswer(deliveredText);
                emit("done", {
                  executionId, toolCalls: [], pendingApprovals: [],
                  finishReason: "completed", mode: "model-stream",
                });
              }
            }
          } catch (error) {
            if (!request.signal.aborted) {
              // Do not log message bodies, tool arguments or provider secrets.
              console.error("[voice/turn] authorized voice turn failed", {
                executionId, type: error instanceof Error ? error.name : "UnknownError",
                stage: needsAuthorizedTools ? "authorized_tools" : "model",
              });
              emit("error", { message: needsAuthorizedTools
                ? "Clara could not complete the authorized mail-tool request. No email summary or action was confirmed. Check the connected mailbox, permissions and sync status before retrying."
                : "Clara could not complete the voice answer. No external action was confirmed." });
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

    if (rollingMailAnswer !== null) {
      await saveAnswer(rollingMailAnswer);
      return NextResponse.json({
        executionId, text: rollingMailAnswer, toolCalls: [], pendingApprovals: [],
        finishReason: rollingMailDenied ? "permission_denied" : "completed",
        source: rollingMailDenied ? "permission_gate" : "local_mail_database",
        actions: [],
      });
    }
    if (blockedWriteExplanation) {
      await saveAnswer(blockedWriteExplanation);
      return NextResponse.json({
        executionId, text: blockedWriteExplanation, toolCalls: [], pendingApprovals: [],
        finishReason: "permission_denied", actions: [],
      });
    }

    if (!needsAuthorizedTools) {
      // Older JSON clients require the same normal Clara conversational path
      // as SSE clients. Tool-authorized actions remain in runEmailAgentTurn.
      const generation = await claraRuntime.createChatTurn({
        orgId: organizationId, agentId, kbId, userId: subject.user.id,
        sessionId, surface: "realtime", ragMode: "hybrid",
        messages: [
          { role: "system", content: "This voice response is read-only. Never claim to have sent, approved, deleted, archived, moved or changed mail or other resources. Such actions require an explicit authorized host tool result. Never claim to have sent, approved or completed any side effect without such a result." },
          { role: "user", content: transcript },
        ],
      });
      let modelAnswer = "";
      for await (const token of generation.stream) {
        if (request.signal.aborted) break;
        modelAnswer += token;
      }
      if (request.signal.aborted) {
        return NextResponse.json({ error: "voice_turn_aborted" }, { status: 409 });
      }
      const validated = userFacingChatAnswer(modelAnswer);
      if (!validated) {
        return NextResponse.json({ error: "empty_voice_answer", message: "The AI provider did not return a usable conversational answer." }, { status: 502 });
      }
      await saveAnswer(validated);
      return NextResponse.json({
        executionId, text: validated, toolCalls: [], pendingApprovals: [],
        finishReason: "completed", actions: [],
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
      requireEmailContentEvidence: requiresEmailContentEvidence,
      maxRounds: 4,
      maxToolCalls: 8,
    });

    const voiceAnswer = currentTurnOperationAnswer(turn.text, turn.toolCalls.flatMap(call => call.operation ? [call.operation] : []), executionId, explicitEmailAction);
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
