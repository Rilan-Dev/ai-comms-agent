"use client";

import { useState } from "react";
import { buildSelectedChecklistPrompt, hasInteractiveEmailActions, suggestedChatNextActions, type AssistantChecklistItem } from "@/lib/chat/interactive-replies";

export type EmailWorkflowState = "not_saved" | "draft_saved" | "pending_approval";

type PrepareDraft = (prompt: string) => void;

/** Local selections only; no mailbox mutations or network requests. */
export function AssistantChecklist({ items, disabled, onPrepare }: {
  items: readonly AssistantChecklistItem[]; disabled: boolean; onPrepare: PrepareDraft;
}) {
  const [selected, setSelected] = useState<boolean[]>(() => items.map(item => item.checked));
  // Streaming can append checklist rows after first mount; keep all rows selectable.
  const effectiveSelection = items.map((item, index) => selected[index] ?? item.checked);
  const prompt = buildSelectedChecklistPrompt(items, effectiveSelection);
  return (
    <section aria-label="Select items from assistant checklist" className="rounded-xl border bg-card p-3.5">
      <p className="text-xs font-semibold">Choose items to discuss</p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <label key={index} className="flex cursor-pointer items-start gap-2 text-sm leading-6">
            <input type="checkbox" checked={effectiveSelection[index] ?? false} disabled={disabled}
              onChange={event => {
                const checked = event.currentTarget.checked;
                setSelected(current => items.map((entry, position) => position === index ? checked : (current[position] ?? entry.checked)));
              }}
              className="mt-1.5 size-4 shrink-0 accent-primary" />
            <span className="min-w-0 break-words">{item.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled || !prompt}
          onClick={() => { if (prompt) onPrepare(prompt); }}
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
          Add selected to message
        </button>
        <span className="text-xs text-muted-foreground">{effectiveSelection.filter(Boolean).length} selected</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Selections are local. Nothing is sent or marked complete.</p>
    </section>
  );
}

/** Explicit human commands reuse Chat's existing reviewed mail-compose state. */
export function InteractiveMailActions({ disabled, state, onComposeEmail, onRequestEmailApproval }: {
  disabled: boolean;
  state: EmailWorkflowState;
  onComposeEmail: () => void;
  onRequestEmailApproval: () => void;
}) {
  return (
    <section aria-label="Email drafting and sending actions" className="mt-3 rounded-xl border border-primary/20 bg-card p-3.5">
      <h3 className="text-xs font-semibold">Email actions</h3>
      <p role="status" className="mt-1 text-xs text-muted-foreground">
        {state === "pending_approval" ? "Approval request created. Check the current decision and delivery status in Mail." :
          state === "draft_saved" ? "Draft saved and ready for review. No email has been sent yet." :
          "Compose and review before saving. No email has been sent."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "not_saved" ? <button type="button" disabled={disabled} onClick={onComposeEmail}
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
          Write email draft
        </button> : null}
        {state === "draft_saved" ? <button type="button" disabled={disabled} onClick={onRequestEmailApproval}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Request send approval
        </button> : null}
        {state === "pending_approval" ? <a className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"
          href="/mail/approvals">Check approval status</a> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Save the draft first, then explicitly request approval. An authorized reviewer must approve before a worker can send it.</p>
    </section>
  );
}

/** User-selected suggestions; never model-defined executable tool calls. */
export function SuggestedNextActions({ answer, userRequest, messageId, disabled, onPrepare, emailWorkflowState, onComposeEmail, onRequestEmailApproval }: {
  answer: string; userRequest: string; messageId: string; disabled: boolean; onPrepare: PrepareDraft;
  emailWorkflowState: EmailWorkflowState;
  onComposeEmail: () => void;
  onRequestEmailApproval: () => void;
}) {
  const actions = suggestedChatNextActions(answer, userRequest);
  const emailActions = hasInteractiveEmailActions(answer, userRequest);
  const selected = actions[0];
  // A conversational response, refusal or unrelated WhatsApp turn does not
  // need a generic next-step fieldset (or accidental email buttons).
  if (!actions.length && !emailActions) return null;

  return (
    <>
      {actions.length > 0 ? (
        <div className="mt-4">
          <button type="button" disabled={!selected || disabled}
            onClick={() => { if (selected) onPrepare(selected.prompt); }}
            className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">
            {selected?.label}
          </button>
        </div>      ) : null}
      {emailActions ? <InteractiveMailActions state={emailWorkflowState} disabled={disabled}
        onComposeEmail={onComposeEmail} onRequestEmailApproval={onRequestEmailApproval} /> : null}
    </>
  );
}
