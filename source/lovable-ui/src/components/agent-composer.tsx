import { useState } from "react";
import { ArrowUp, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgentComposer() {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState("");
  const [listening, setListening] = useState(false);
  function submit() {
    if (!value.trim()) return;
    setReply(
      `“${value.trim()}” — This workspace is a visual preview. Connect your communication accounts and agent to run this request.`,
    );
    setValue("");
  }
  return (
    <div className="w-full">
      <div className="rounded-md border border-border bg-card p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/25">
        <textarea
          aria-label="Ask your agent"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask your agent anything about your communications..."
          className="min-h-[68px] w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[11px] text-muted-foreground">
            Your agent works across every channel
          </span>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant={listening ? "secondary" : "ghost"}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              title={listening ? "Stop listening" : "Voice input preview"}
              onClick={() => setListening(!listening)}
            >
              <Mic size={17} />
            </Button>
            <Button
              size="icon"
              aria-label="Send request"
              title="Send request"
              disabled={!value.trim()}
              onClick={submit}
            >
              <ArrowUp size={17} />
            </Button>
          </div>
        </div>
      </div>
      {listening && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
          <span>Voice input is a preview. No microphone is connected.</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={() => setListening(false)}
            aria-label="Dismiss voice preview"
          >
            <X size={13} />
          </Button>
        </div>
      )}
      {reply && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3 text-xs leading-5">
          <span>{reply}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={() => setReply("")}
            aria-label="Dismiss agent response"
          >
            <X size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}
