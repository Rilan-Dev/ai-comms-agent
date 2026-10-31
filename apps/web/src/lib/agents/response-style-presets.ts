/** Editable examples, not hidden policy. Agent owners must review and save changes.
 * Permissions, tool results and source evidence always take precedence. */
export const responseStylePresets = {
  executive: {
    label: "Executive briefing",
    description: "Business-first, actionable and easy to scan",
    instructions: [
      "PRESENTATION: Executive business briefing. Lead with the verified outcome, followed by a short business-impact or action summary.",
      "CHAT: Use Markdown with short headings, **bold key numbers and actions**, and at most 3-5 short bullets. A brief > note is useful for caveats. Use a few meaningful emojis such as ⚠️ for documented failures, 📌 for review items, ✅ for confirmed success, and 📊 for counts. Do not add an emoji to every sentence.",
      "WHATSAPP: Use WhatsApp-native markers: *bold* (single asterisk), _italic_, ~strikethrough~, short lines, numbered items and occasional meaningful emoji. Do not use Markdown **double asterisks**, pipe tables, HTML, CSS or imagined font colors. Keep it under 4096 characters.",
      "EVIDENCE: Only highlight actual messages/verified tool findings. Never fabricate urgency, deadlines, amounts, counts, send or delivery success. Distinguish requested action from inferred priority and respect the available mailbox coverage.",
    ].join("\n"),
  },
  concise: {
    label: "Concise operations",
    description: "Short factual updates for busy staff",
    instructions: [
      "PRESENTATION: Concise operational update. First the verified status, then the 1-3 highest-value facts and the next supported action.",
      "CHAT: Use short Markdown paragraphs and **bold confirmed status or numbers**. Keep headings and bullet lists brief.",
      "WHATSAPP: Prefer 3-6 compact lines with one *bold* heading, an accurate count, and up to 3 brief numbered items. Emoji only when they communicate a real status.",
      "EVIDENCE: Do not invent details, urgency, actions, provider status or completeness.",
    ].join("\n"),
  },
  plain: {
    label: "Minimal / formal",
    description: "No emojis, neutral professional text",
    instructions: [
      "PRESENTATION: Minimal formal business writing. State the verified result and only essential supporting facts.",
      "CHAT: Use simple paragraphs and Markdown bold sparingly. Do not use emojis or decorative cards.",
      "WHATSAPP: Use short plain text, without emojis or decorative headings.",
      "EVIDENCE: Do not invent numbers, commitments, urgency, send or delivery status.",
    ].join("\n"),
  },
} as const;

export type ResponseStylePreset = keyof typeof responseStylePresets;

const opener = "\n\n[RESPONSE PRESENTATION — EDITABLE]\n";
const closer = "\n[/RESPONSE PRESENTATION]";
/** Replace only our visible editable presentation section; preserve custom policy. */
export function applyResponseStylePreset(current:string, preset:ResponseStylePreset):string{
  const before=current.trim();
  const start=before.indexOf(opener.trimStart());
  const end=start>=0?before.indexOf(closer,start):-1;
  const preserved=start>=0&&end>start
    ?(before.slice(0,start)+before.slice(end+closer.length)).trim()
    :before;
  return (preserved+opener+responseStylePresets[preset].instructions+closer).trim();
}
