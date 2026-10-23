/**
 * Safe, presentation-only chat affordances. Assistant output is untrusted:
 * it is never interpreted as a tool call, URL, or permission.
 */
export type AssistantChecklistItem = { label: string; checked: boolean };
export type ChatNextAction = { id: string; label: string; prompt: string };

export function parseAssistantChecklistLine(raw: string): AssistantChecklistItem | null {
  if (raw.length > 256) return null;
  const match = raw.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
  if (!match) return null;
  const label = (match[2] ?? "").replace(/\s+/g, " ").trim();
  if (!label || label.length > 160) return null;
  return { label, checked: (match[1] ?? "").toLowerCase() === "x" };
}

/** Only creates editable draft text. Does not mutate a mailbox or send. */
export function buildSelectedChecklistPrompt(
  items: readonly AssistantChecklistItem[],
  selection: readonly boolean[],
): string | null {
  const labels = items.slice(0, 10)
    .filter((_, index) => selection[index] === true)
    .map(item => item.label.replace(/\s+/g, " ").trim().slice(0, 160))
    .filter(Boolean);
  return labels.length
    ? "Help me work through these selected items from your previous answer. Ask before any external action:\n" +
      labels.map(label => "- " + label).join("\n")
    : null;
}

/**
 * UI hints are opt-in by context. A model mentioning "email" in a WhatsApp
 * refusal is not a user request to draft mail, and a generic assistant reply
 * must never generate an unsolicited choice panel.
 */
function isUnrelatedMessagingRequest(request: string): boolean {
  return /\b(?:whats\s?app|sms|text\s+message)\b/i.test(request);
}

function isFailedOrDeniedAnswer(answer: string): boolean {
  return /\b(?:can't|cannot|couldn't|unable to|don't have access|do not have access|not authorized|permission denied|no matching|no new unread|not found|didn't find)\b/i.test(answer);
}

/** Only show the reviewed email workflow for an explicitly requested draft
 * and genuinely prepared Subject/Body; this does not send or authorize mail. */
export function hasInteractiveEmailActions(answer: string, userRequest: string): boolean {
  if (isUnrelatedMessagingRequest(userRequest) || isFailedOrDeniedAnswer(answer)) return false;
  if (!/\b(?:draft|write|compose|prepare|reply|forward|send)\b/i.test(userRequest)
    || !/\b(?:e-?mails?|drafts?|replies?)\b/i.test(userRequest)) return false;
  return /^\s*(?:\*\*)?Subject(?:\*\*)?\s*:/im.test(answer)
    && /^\s*(?:\*\*)?Body(?:\*\*)?\s*:/im.test(answer);
}

/** Deliberately no generic fallback. Follow-up cards are useful after
 * substantive requested mail summaries, but intrusive after greetings,
 * missing data, denied actions, tool failures, or unrelated WhatsApp turns.
 * This never derives executable actions from untrusted assistant text. */
export function suggestedChatNextActions(answer: string, userRequest: string): ChatNextAction[] {
  if (isUnrelatedMessagingRequest(userRequest) || isFailedOrDeniedAnswer(answer)) return [];
  const requestedSummary = /\b(?:summari[sz]e|summary|list|find|show|review|prioriti[sz]e|check|how many)\b/i.test(userRequest)
    && /\b(?:e-?mails?|mailbox|inbox|messages?|threads?)\b/i.test(userRequest);
  const hasMailEvidence = /\b(?:sender|subject|from|received)\s*:/i.test(answer)
    || /\b\d+\s+(?:new\s+|unread\s+)?(?:e-?mails?|messages?)\s+(?:were\s+)?(?:received|found|matched)\b/i.test(answer);
  if (!requestedSummary || !hasMailEvidence) return [];
  return [
    { id: "prioritize", label: "Find important mail", prompt: "Review the recent emails I can access and list those that need my attention, with sender, date and reason. Do not modify messages." },
    { id: "checklist", label: "Make an action checklist", prompt: "Turn your previous answer into a short prioritized checklist for me. Do not modify any emails." },
    { id: "draft", label: "Plan an email reply", prompt: "Help me prepare an editable reply draft for an email we discussed. Ask which email if unclear; do not send anything." },
  ];
}
