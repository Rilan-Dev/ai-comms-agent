/** UI-only convenience choices. Never persist or grant tools until an admin
 * confirms and the existing authorized policy endpoint accepts the update. */
export const EMAIL_PERMISSION_PRESETS = [
  { id: "read", label: "Read mail", description: "Search, list and inspect assigned mailboxes." },
  { id: "draft", label: "Draft mail", description: "Read mail and create or edit drafts; no send approval request." },
  { id: "approval", label: "Request sending", description: "Draft mail and request explicit human send approval; never auto-send." },
  { id: "off", label: "No mail tools", description: "Disable every email permission; preserve non-email permissions." },
] as const;
export type EmailPermissionPreset = typeof EMAIL_PERMISSION_PRESETS[number]["id"];

const READ = ["email.search", "email.messages.list", "email.message.get", "email.thread.get",
  "email.accounts.list", "email.folders.list", "email.labels.list", "email.capabilities.get", "email.sync.status"];
const DRAFT = ["email.draft.create", "email.draft.update", "email.draft_reply", "email.draft_forward"];
const APPROVAL = ["email.send.request", "email.reply.request", "email.forward.request"];
export const REGISTERED_EMAIL_POLICY_NAMES = [...READ, ...DRAFT, ...APPROVAL] as const;

/** Replace ONLY selectable email grants; preserve all existing custom and
 * unimplemented permissions for individual administrative review. */
export function emailPermissionPresetSelection(current: readonly string[], preset: EmailPermissionPreset): string[] {
  const known = new Set<string>(REGISTERED_EMAIL_POLICY_NAMES);
  // "No mail tools" also disables legacy/unrecognized email.* grants.
  // A broad deny must not silently preserve a future email permission.
  const extras = current.filter((name) => !known.has(name)
    && (preset !== "off" || !name.startsWith("email.")));
  const selected = preset === "off" ? [] : preset === "read" ? READ
    : preset === "draft" ? [...READ, ...DRAFT] : [...READ, ...DRAFT, ...APPROVAL];
  return [...new Set([...extras, ...selected])];
}

/** Friendly names in chat confirmations; unknown/custom permissions retain
 * their literal name rather than appearing as an unreviewed bundled grant. */
export const EMAIL_PERMISSION_LABELS: Record<string, string> = {
  "email.search": "Search mailbox",
  "email.messages.list": "List messages",
  "email.message.get": "Read a message",
  "email.thread.get": "Read a thread",
  "email.accounts.list": "List connected mailboxes",
  "email.folders.list": "List folders",
  "email.labels.list": "List labels",
  "email.capabilities.get": "Check mailbox capabilities",
  "email.sync.status": "Check synchronization",
  "email.draft.create": "Create drafts",
  "email.draft.update": "Edit drafts",
  "email.draft_reply": "Draft replies",
  "email.draft_forward": "Draft forwards",
  "email.send.request": "Request send approval",
  "email.reply.request": "Request reply approval",
  "email.forward.request": "Request forward approval",
  "whatsapp.history": "Read bound WhatsApp conversation history",
  "whatsapp.send": "Request WhatsApp send approval (human review required)",
};

export function summarizeEmailPermissionChanges(previous: readonly string[], selected: readonly string[]): {
  added: string[];
  removed: string[];
  confirmation: string;
} {
  const before = new Set(previous);
  const after = new Set(selected);
  const added = [...after].filter(name => !before.has(name));
  const removed = [...before].filter(name => !after.has(name));
  const label = (name: string) => EMAIL_PERMISSION_LABELS[name] ?? name;
  const confirmation = [
    "Update this agent's permissions?",
    added.length ? "Enable:\n" + added.map(name => "• " + label(name)).join("\n") : "Enable: none",
    removed.length ? "Disable:\n" + removed.map(name => "• " + label(name)).join("\n") : "Disable: none",
    "Changes affect future chat and voice turns. Mailboxes and user permissions are separate; sending still requires human approval.",
  ].join("\n\n");
  return { added, removed, confirmation };
}
