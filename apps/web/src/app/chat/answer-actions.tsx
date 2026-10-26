"use client";

import { useState } from "react";
import { Check, Clipboard, Download } from "lucide-react";
import { cleanAnswerForText } from "@/lib/chat/business-report-display";

/** Explicit client actions on one answer; never uploads mailbox content. */
export function AnswerActions({ content, messageId }: { content: string; messageId: string }) {
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const ready = content.trim().length > 0;

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(content);
      setNotice("Copied answer");
    } catch {
      setNotice("Clipboard unavailable. Use Download instead.");
    }
  }

  function downloadAnswer(format: "md" | "txt") {
    const body = format === "md" ? content : cleanAnswerForText(content);
    const filenameId = messageId.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "answer";
    const data = new Blob([body], { type: format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "assistant-answer-" + filenameId + "." + format;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setExportOpen(false);
    setNotice(format === "md" ? "Markdown export prepared" : "Text export prepared");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2" aria-label="Answer actions">
      <button type="button" disabled={!ready} onClick={() => void copyAnswer()}
        aria-label="Copy full assistant answer" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
        {notice === "Copied answer" ? <Check size={14} /> : <Clipboard size={14} />} Copy
      </button>
      <div className="relative flex flex-wrap items-center gap-1">
        <button type="button" disabled={!ready} aria-expanded={exportOpen} aria-label="Export this answer"
          onClick={() => setExportOpen(value => !value)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
          <Download size={14} /> Export
        </button>
        {exportOpen ? (
          <span className="inline-flex flex-wrap gap-1">
            <button type="button" onClick={() => downloadAnswer("md")}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted">Markdown (.md)</button>
            <button type="button" onClick={() => downloadAnswer("txt")}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted">Plain text (.txt)</button>
          </span>
        ) : null}
      </div>
      <span role="status" aria-live="polite" className="text-[11px] text-muted-foreground">{notice}</span>
    </div>
  );
}
