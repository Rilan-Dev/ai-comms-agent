/** UI-only convenience choices. Never persist or grant tools until an admin
 * confirms and the existing authorized policy endpoint accepts the update. */
export const EMAIL_PERMISSION_PRESETS = [
  { id: "read", label: "Read mail", description: "Search, list and inspect assigned mailboxes." },
  { id: "draft", label: "Draft mail", description: "Read mail and create or edit drafts; no send approval request." },
  { id: "approval", label: "Request sending", description: "Draft mail and request explicit human send approval; never auto-send." },
  { id: "off", label: "No mail tools", description: "Disable registered email tools, preserving unrelated permissions." },
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
  const extras = current.filter((name) => !known.has(name));
  const selected = preset === "off" ? [] : preset === "read" ? READ
    : preset === "draft" ? [...READ, ...DRAFT] : [...READ, ...DRAFT, ...APPROVAL];
  return [...new Set([...extras, ...selected])];
}
