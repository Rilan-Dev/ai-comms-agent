/**
 * Human-readable, preview-only digest choices. These are deliberately NOT a
 * RoutineDraft: no mailbox grant, sender, recipient, execution identity or
 * standing delivery consent can be derived from browser query parameters.
 */
export type DigestPreviewPreferences = {
  window: "previous_local_day" | "previous_24_hours" | "since_previous_occurrence";
  language: "en" | "ta" | "hi" | "ar" | "fr" | "es";
  delivery: "in_app" | "whatsapp_digest";
  focus: "needs_attention" | "all_new";
  maxCodePoints: 300 | 600 | 1000;
  emptyBehavior: "skip" | "check_in";
};

type Controls = Record<string, string | string[] | undefined>;

function choice<T extends string>(raw: unknown, values: readonly T[], fallback: T, label: string): T {
  if (raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string" || !values.includes(raw as T)) {
    throw new Error(`Choose a supported ${label}.`);
  }
  return raw as T;
}

export function parseDigestPreviewPreferences(input: Controls): DigestPreviewPreferences {
  const limit = choice(input.maxCodePoints, ["300", "600", "1000"] as const, "600", "summary length");
  return {
    window: choice(input.window,
      ["previous_local_day", "previous_24_hours", "since_previous_occurrence"] as const,
      "previous_local_day", "summary window"),
    language: choice(input.language, ["en", "ta", "hi", "ar", "fr", "es"] as const, "en", "language"),
    delivery: choice(input.delivery, ["in_app", "whatsapp_digest"] as const, "in_app", "destination"),
    focus: choice(input.focus, ["needs_attention", "all_new"] as const, "needs_attention", "priority focus"),
    maxCodePoints: Number(limit) as DigestPreviewPreferences["maxCodePoints"],
    emptyBehavior: choice(input.emptyBehavior, ["skip", "check_in"] as const, "skip", "empty-result behavior"),
  };
}

export function describeDigestPreview(preferences: DigestPreviewPreferences): {
  scope: string;
  window: string;
  priority: string;
  delivery: string;
  limit: string;
  empty: string;
  review: string;
} {
  const window = {
    previous_local_day: "The previous local calendar day in your selected IANA time zone, not the last 24 elapsed hours.",
    previous_24_hours: "The previous 24 elapsed hours at each run, even across daylight-saving changes.",
    since_previous_occurrence: "Only eligible mail since the previous verified routine occurrence, with uncovered periods reported separately.",
  }[preferences.window];
  const delivery = preferences.delivery === "in_app"
    ? "Proposed result: a private briefing inside this platform. This preview does not create one."
    : "Proposed WhatsApp digest (not activated): a verified recipient, authorized sender, approved provider template and separate consent are required before any external delivery.";
  return {
    scope: "Only the mailboxes you are permitted to read and explicitly select at confirmation; never an entire organization's inbox.",
    window,
    priority: preferences.focus === "needs_attention"
      ? "Organize source-backed messages as Needs attention, Worth reviewing and For reference. Show a reason and link to the original message; uncertainty stays visible."
      : "Include eligible new mail grouped into Needs attention, Worth reviewing and For reference, with reasons and an original message link.",
    delivery,
    limit: `Target at most ${preferences.maxCodePoints} Unicode code points. Never include full email bodies, passwords, attachments or one-time codes in an external digest.`,
    empty: preferences.emptyBehavior === "skip"
      ? "If no eligible new mail exists, skip a message rather than inventing one."
      : "If no eligible mail exists, propose a short check-in; actual delivery still requires authorization.",
    review: "Not saved or scheduled. Missing mailbox authorization, final consent, recipient verification, provider configuration and execution acceptance must be resolved separately.",
  };
}
