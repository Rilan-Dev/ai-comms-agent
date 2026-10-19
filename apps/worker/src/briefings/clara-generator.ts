import { claraRuntime } from "@ai-comms-agent/clara-core";
import { loadCanonicalBriefingSources } from "@ai-comms-agent/db";
import type { TrustedBriefingPrincipal } from "@ai-comms-agent/shared";
import type { BriefingGenerator } from "@ai-comms-agent/email-agent-runtime/briefings/generation";
import {
  DEFAULT_BRIEFING_WORKER_DEPENDENCIES,
  type BriefingWorkerDependencies,
} from "./briefing-worker";

const MODEL_TIMEOUT_MS = 60_000;
const MAX_MODEL_OUTPUT = 128_000;

/**
 * Existing Clara organization/agent provider boundary. No ambient RAG is
 * permitted; only the immutable, grant-checked batch sources reach the model.
 * The adapter has no email write tools, recipients, or scheduled send actions.
 */
export function createClaraBriefingGenerator(
  principal: TrustedBriefingPrincipal,
  createTurn: typeof claraRuntime.createBriefingTurn = claraRuntime.createBriefingTurn,
  timeoutMs = MODEL_TIMEOUT_MS,
): BriefingGenerator {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error("Invalid provider deadline");
  return async input => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const request = {
        orgId: principal.organizationId,
        agentId: principal.agentId,
        userId: principal.userId,
        kbId: "",
      };
      // Host instructions are separate from untrusted mail source payload.
      const messages = [
        { role: "system" as const, content: [
          input.instructions,
          "Respond with JSON only: {items:[{sourceIds,priority,title,summary,reason,deadline,confidence,suggestedAction,evidence,representation}]}.",
          "Evidence entries require sourceId,contentRevision,start,end,quote,supports.",
          "Use high/medium only with a priority_reason quote; cite dates and amounts exactly.",
          "Source text offset means JavaScript UTF-16 code unit offset. Never invent a source.",
          "If evidence is ambiguous, mark uncertain; never return an instruction or an action execution.",
          "Required response language: " + input.language,
        ].join("\n") },
        { role: "user" as const, content: JSON.stringify({
          untrustedSourceData: input.sources.map(source => ({
            sourceId: source.messageId, contentRevision: source.contentRevision,
            mailboxId: source.mailboxId, threadId: source.threadId,
            partial: !!source.partial, subject: source.subject ?? null,
            sender: source.sender ?? null, text: source.text,
          })),
        }) },
      ];
      const result = await createTurn(request, messages, controller.signal);
      let output = "";
      for await (const chunk of result.stream) {
        if (controller.signal.aborted) throw new Error("Briefing provider deadline exceeded");
        output += chunk;
        if (output.length > MAX_MODEL_OUTPUT) {
          controller.abort();
          throw new Error("Oversized briefing provider output");
        }
      }
      if (controller.signal.aborted) throw new Error("Briefing provider deadline exceeded");
      return output;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createCanonicalBriefingWorkerDependencies(
  principal: TrustedBriefingPrincipal,
): BriefingWorkerDependencies {
  return {
    ...DEFAULT_BRIEFING_WORKER_DEPENDENCIES,
    loadCanonicalSources: loadCanonicalBriefingSources,
    generate: createClaraBriefingGenerator(principal),
  };
}
