import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Filter,
  Inbox,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Sparkle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace-shell";
import { messages } from "@/lib/workspace-data";

export const Route = createFileRoute("/mail/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox | Comms Agent" },
      {
        name: "description",
        content:
          "Review your unified inbox, AI summaries, and draft replies before approving communication.",
      },
      { property: "og:title", content: "Inbox | Comms Agent" },
      {
        property: "og:description",
        content:
          "Review your unified inbox, AI summaries, and draft replies before approving communication.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InboxPage,
});

type FilterName = "All messages" | "Needs action" | "Email" | "WhatsApp";
function InboxPage() {
  const [selected, setSelected] = useState(messages[0]?.id ?? "");
  const [filter, setFilter] = useState<FilterName>("All messages");
  const [query, setQuery] = useState("");
  const [draftOpen, setDraftOpen] = useState(true);
  const [approved, setApproved] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const current = messages.find((m) => m.id === selected) ?? messages[0];
  const visible = useMemo(
    () =>
      messages.filter(
        (m) =>
          (filter === "All messages" ||
            (filter === "Needs action" && m.needsAction) ||
            filter === m.channel) &&
          `${m.sender} ${m.subject} ${m.preview}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  );
  if (!current) return null;
  return (
    <WorkspaceShell
      title="Inbox"
      subtitle="Every conversation, with your agent one step ahead."
      actions={
        <span className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" /> Email preview{" "}
          <ChevronDown size={13} />
        </span>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-5">
        {(["All messages", "Needs action", "Email", "WhatsApp"] as FilterName[]).map((name) => (
          <Button
            key={name}
            variant={filter === name ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setFilter(name);
              setMobileDetail(false);
            }}
            className={`text-xs ${filter === name ? "font-semibold" : "text-muted-foreground"}`}
          >
            {name}
            {name === "Needs action" && (
              <span className="ml-1 rounded bg-attention-subtle px-1.5 text-[10px] text-attention">
                1
              </span>
            )}
          </Button>
        ))}
      </div>
      <div className="grid min-h-[650px] overflow-hidden rounded-md border border-border bg-card lg:grid-cols-[minmax(270px,350px)_minmax(0,1fr)] xl:grid-cols-[190px_minmax(280px,350px)_minmax(0,1fr)]">
        <aside className="hidden border-r border-border p-4 xl:block">
          <p className="px-2 pb-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Sources
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between rounded bg-secondary px-3 py-2.5 text-xs font-semibold">
              <span className="flex items-center gap-2">
                <Inbox size={15} /> All inboxes
              </span>
              <span>3</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Mail size={15} /> Email
              </span>
              <span>3</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-2">
                <MessageCircle size={15} /> WhatsApp
              </span>
              <span>—</span>
            </div>
          </div>
          <div className="mt-8 border-t border-border px-2 pt-5">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Sparkle size={15} /> Agent triage
            </span>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Messages are organized by priority and next action.
            </p>
          </div>
        </aside>
        <section
          className={`border-r border-border ${mobileDetail ? "hidden lg:block" : "block"}`}
          aria-label="Conversations"
        >
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Conversations <span className="ml-1 text-muted-foreground">{visible.length}</span>
              </h2>
              <Filter size={15} className="text-muted-foreground" />
            </div>
            <div className="mt-4 flex h-9 items-center gap-2 rounded border border-border bg-background px-3">
              <Search size={14} className="text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inbox"
                aria-label="Search inbox"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </Button>
              )}
            </div>
          </div>
          <div>
            {visible.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Inbox className="mx-auto mb-3 text-muted-foreground" size={24} />
                <p className="text-sm font-medium">No conversations found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another search or filter.</p>
              </div>
            ) : (
              visible.map((m) => (
                <Button
                  key={m.id}
                  variant="ghost"
                  onClick={() => {
                    setSelected(m.id);
                    setMobileDetail(true);
                    setDraftOpen(true);
                  }}
                  className={`h-auto w-full justify-start rounded-none border-b border-border px-4 py-5 text-left whitespace-normal hover:bg-secondary/70 ${selected === m.id ? "bg-secondary/70" : ""}`}
                >
                  <span className="flex w-full items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                      {m.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{m.sender}</span>
                        <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                          {m.time}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium">{m.subject}</span>
                      <span className="mt-1 block truncate text-[11px] font-normal text-muted-foreground">
                        {m.preview}
                      </span>
                      <span className="mt-3 flex gap-1.5">
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          {m.channel}
                        </span>
                        {m.needsAction && (
                          <span className="rounded bg-attention-subtle px-1.5 py-0.5 text-[10px] font-medium text-attention">
                            Needs action
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </Button>
              ))
            )}
          </div>
        </section>
        <section
          className={`${mobileDetail ? "block" : "hidden lg:block"} min-w-0`}
          aria-label="Message detail"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 lg:hidden"
                aria-label="Back to conversations"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft size={16} />
              </Button>
              <span className="text-xs text-muted-foreground">Inbox</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="max-w-[220px] truncate text-xs font-medium">{current.subject}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More message options"
              title="No additional actions in preview"
            >
              <MoreHorizontal size={17} />
            </Button>
          </div>
          <div className="max-w-[780px] px-5 py-7 sm:px-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-secondary px-2 py-1 text-[10px] font-medium">
                {current.channel}
              </span>
              <span
                className={`rounded px-2 py-1 text-[10px] font-medium ${current.priority === "High" ? "bg-attention-subtle text-attention" : "bg-secondary text-muted-foreground"}`}
              >
                {current.priority} priority
              </span>
              {current.needsAction && (
                <span className="rounded bg-attention-subtle px-2 py-1 text-[10px] font-medium text-attention">
                  Action required
                </span>
              )}
            </div>
            <h2 className="mt-5 font-display text-[25px] font-medium leading-tight sm:text-[31px]">
              {current.subject}
            </h2>
            <div className="mt-6 flex items-center gap-3 border-b border-border pb-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {current.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">
                  {current.sender}{" "}
                  <span className="font-normal text-muted-foreground">
                    &lt;{current.address}&gt;
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">To you · Oct 3, 2026</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{current.time}</span>
            </div>
            <div className="whitespace-pre-line py-7 text-[13px] leading-7 text-foreground/85">
              {current.body}
            </div>
            <div className="rounded-md border border-border bg-secondary/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Sparkle size={15} /> Agent insight
              </div>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{current.summary}</p>
            </div>
            {current.draft && (
              <div className="mt-7 overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Sparkle size={14} /> Suggested reply{" "}
                    <span className="ml-1 rounded bg-attention-subtle px-1.5 py-0.5 text-[10px] font-medium text-attention">
                      {approved ? "Preview approved" : "Needs approval"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={draftOpen ? "Collapse draft" : "Expand draft"}
                    onClick={() => setDraftOpen(!draftOpen)}
                  >
                    <ChevronDown size={15} className={draftOpen ? "rotate-180" : ""} />
                  </Button>
                </div>
                {draftOpen && (
                  <div className="p-4">
                    <p className="text-xs leading-6 text-foreground/85">{current.draft}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setApproved(true)} disabled={approved}>
                        <Check size={14} />
                        {approved ? "Approved for preview" : "Approve draft"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDraftOpen(false)}>
                        Close draft
                      </Button>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CircleAlert size={12} /> Preview only — approval does not send a message.
                    </p>
                  </div>
                )}
              </div>
            )}
            {!current.draft && (
              <div className="mt-7 rounded-md border border-dashed border-border p-5 text-center">
                <Send size={17} className="mx-auto text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">
                  No reply suggested. This message does not need action.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
