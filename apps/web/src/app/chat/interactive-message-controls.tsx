"use client";

import { useState } from "react";
import { buildSelectedChecklistPrompt, hasInteractiveEmailActions, shouldSuggestNextActions, suggestedChatNextActions, type AssistantChecklistItem } from "@/lib/chat/interactive-replies";

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
        <button type="button" disabled={disabled} onClick={onComposeEmail}
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
          Write email draft
        </button>
        <button type="button" disabled={disabled || state === "pending_approval"} onClick={onRequestEmailApproval}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {state === "draft_saved" ? "Request send approval" : "Prepare to send for approval"}
        </button>
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
  const [choice, setChoice] = useState(actions[0]?.id ?? "");
  const selected = actions.find(action => action.id === choice) ?? actions[0];
  // A conversational response, refusal or unrelated WhatsApp turn does not
  // need a generic next-step fieldset (or accidental email buttons).
  if (!actions.length && !emailActions) return null;

  return (
    <>
      {actions.length > 0 ? (
        <fieldset className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3.5" disabled={disabled}>
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Choose a next step</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {actions.map(action => (
              <label key={action.id} className="flex cursor-pointer items-start gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs leading-5 hover:border-primary/40">
                <input type="radio" name={"next-action-" + messageId} value={action.id}
                  checked={selected?.id === action.id} onChange={() => setChoice(action.id)}
                  className="mt-0.5 size-4 shrink-0 accent-primary" />
                <span>{action.label}</span>
              </label>
            ))}
          </div>
          <button type="button" disabled={!selected || disabled}
            onClick={() => { if (selected) onPrepare(selected.prompt); }}
            className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
            Review next action in message
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Review before Send. Email actions still require normal permissions and approval.</p>
        </fieldset>
      ) : null}
      {emailActions ? <InteractiveMailActions state={emailWorkflowState} disabled={disabled}
        onComposeEmail={onComposeEmail} onRequestEmailApproval={onRequestEmailApproval} /> : null}
    </>
  );
}
