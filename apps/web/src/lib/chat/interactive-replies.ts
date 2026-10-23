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

/** Display hint only; untrusted assistant text does not authorize any email operation. */
export function hasInteractiveEmailActions(answer: string): boolean {
  return /\b(inbox|mailbox|emails?|senders?|threads?|replies|reply|drafts?|follow[- ]?up)\b/i.test(answer.slice(0, 5000));
}

/** Fixed, product-owned options; the model cannot specify executable actions. */
export function suggestedChatNextActions(answer: string): ChatNextAction[] {
  const mail = hasInteractiveEmailActions(answer);
  return mail ? [
    { id: "prioritize", label: "Find important mail", prompt: "Review the recent emails I can access and list those that need my attention, with sender, date and reason. Do not modify messages." },
    { id: "checklist", label: "Make an action checklist", prompt: "Turn your previous answer into a short prioritized checklist for me. Do not modify any emails." },
    { id: "draft", label: "Plan an email reply", prompt: "Help me prepare an editable reply draft for an email we discussed. Ask which email if unclear; do not send anything." },
  ] : [
    { id: "simplify", label: "Explain simply", prompt: "Explain your last response in simpler words and keep important caveats." },
    { id: "checklist", label: "Make a checklist", prompt: "Turn your last response into a clear, practical checklist. Do not take external actions." },
    { id: "clarify", label: "What should I check?", prompt: "What information should I verify or clarify before acting on your last response?" },
  ];
}
