import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Inbox,
  Mail,
  MessageCircle,
  MoreHorizontal,
  ShieldCheck,
  Sparkle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentComposer } from "@/components/agent-composer";
import { WorkspaceShell } from "@/components/workspace-shell";
import { activity, messages } from "@/lib/workspace-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview | Comms Agent" },
      {
        name: "description",
        content:
          "Your AI communications workspace for email, messaging, decisions, and agent activity.",
      },
      { property: "og:title", content: "Overview | Comms Agent" },
      {
        property: "og:description",
        content:
          "Your AI communications workspace for email, messaging, decisions, and agent activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const [reviewed, setReviewed] = useState(false);
  return (
    <WorkspaceShell
      title="Overview"
      subtitle="A clear view of what matters across your communications."
      actions={
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" /> Agent is ready{" "}
          <span className="mx-1 text-border">·</span> Preview workspace
        </span>
      }
    >
      <section className="grid gap-8 border-b border-border pb-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)] xl:gap-16">
        <div>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <Sparkle size={14} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your daily briefing
            </span>
          </div>
          <h2 className="max-w-[780px] font-display text-[36px] font-medium leading-[1.1] sm:text-[46px] lg:text-[52px]">
            Good morning, Rilan<span className="text-tertiary">.</span>
            <br />
            <span className="text-muted-foreground">You’re all caught up, almost.</span>
          </h2>
          <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-muted-foreground">
            Your agent reviewed the inbox. One important conversation needs your decision;
            everything else can wait.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/mail/inbox"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85"
            >
              Review priority inbox <ArrowUpRight size={16} />
            </Link>
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-xs text-muted-foreground">
              <ShieldCheck size={15} /> Nothing sends without your approval
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-end">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
            <span className="flex size-6 items-center justify-center rounded bg-accent text-accent-foreground">
              <Zap size={13} />
            </span>{" "}
            Ask your agent
          </div>
          <AgentComposer />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Try “Summarize my important emails today”
          </p>
        </div>
      </section>
      <section
        className="grid grid-cols-2 gap-5 border-b border-border py-8 md:grid-cols-4 md:gap-8"
        aria-label="Workspace status"
      >
        {[
          {
            label: "Needs your attention",
            value: reviewed ? "0" : "01",
            note: reviewed ? "All reviewed" : "Draft awaiting review",
            icon: Inbox,
          },
          {
            label: "Messages analyzed",
            value: "03",
            note: "Across connected previews",
            icon: Mail,
          },
          { label: "Agent actions", value: "03", note: "In today’s activity", icon: Sparkle },
          { label: "Channels", value: "01", note: "Email preview active", icon: MessageCircle },
        ].map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Icon size={15} />
              {label}
            </div>
            <div className="font-display text-[34px] font-medium leading-none sm:text-[40px]">
              {value}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)] xl:gap-14">
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Priority inbox</h2>
                <span className="rounded bg-attention-subtle px-2 py-0.5 text-[10px] font-semibold text-attention">
                  1 needs action
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The conversations worth your time right now
              </p>
            </div>
            <Link
              to="/mail/inbox"
              className="flex items-center gap-1 text-xs font-semibold hover:underline"
            >
              View inbox <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {messages.map((message, i) => (
              <Link
                to="/mail/inbox"
                key={message.id}
                className={`group flex gap-3 p-4 transition-colors hover:bg-secondary/70 sm:gap-4 sm:p-5 ${i !== messages.length - 1 ? "border-b border-border" : ""}`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  {message.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{message.sender}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {message.time}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium">{message.subject}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{message.preview}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                      {message.channel}
                    </span>
                    {message.needsAction && (
                      <span className="rounded bg-attention-subtle px-2 py-1 text-[10px] font-medium text-attention">
                        Action needed
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="mt-7 hidden shrink-0 text-muted-foreground group-hover:text-foreground sm:block"
                />
              </Link>
            ))}
          </div>
        </section>
        <div className="space-y-10">
          <section>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your approval</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  You stay in control of every send
                </p>
              </div>
              <MoreHorizontal size={18} className="text-muted-foreground" />
            </div>
            <div className="rounded-md border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <span className="flex size-7 items-center justify-center rounded bg-attention-subtle text-attention">
                    <Mail size={14} />
                  </span>{" "}
                  Reply draft
                </span>
                <span
                  className={`rounded px-2 py-1 text-[10px] font-medium ${reviewed ? "bg-success-subtle text-success" : "bg-attention-subtle text-attention"}`}
                >
                  {reviewed ? "Reviewed" : "Awaiting review"}
                </span>
              </div>
              <p className="mt-5 text-sm font-semibold">Re: Project update — Q4 roadmap</p>
              <p className="mt-1 text-xs text-muted-foreground">
                To Alice Morgan · Drafted by your agent
              </p>
              <p className="mt-4 border-l-2 border-border pl-3 text-xs leading-6 text-muted-foreground">
                Hi Alice, thanks for sharing the updated roadmap. The proposed timeline looks good
                from my side...
              </p>
              <div className="mt-5 flex gap-2">
                <Link
                  to="/mail/inbox"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                >
                  Review draft <ArrowUpRight size={13} />
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewed(!reviewed)}
                  title="Mark this preview as reviewed"
                >
                  {reviewed ? <Check size={14} /> : "Mark reviewed"}
                </Button>
              </div>
            </div>
          </section>
          <section>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Agent activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A transparent view of what your agent has done
              </p>
            </div>
            <div className="border-l border-border pl-5">
              {activity.map((item, i) => (
                <div key={item.id} className={`relative ${i < activity.length - 1 ? "pb-6" : ""}`}>
                  <span
                    className={`absolute -left-[25px] top-1 size-2 rounded-full border-2 border-background ${i === 0 ? "bg-attention" : "bg-tertiary"}`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold leading-5">{item.title}</p>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Clock3 size={15} /> Scheduled work
              </div>
              <span className="text-[11px] text-muted-foreground">No schedules yet</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Recurring briefings will appear here once schedules are configured.
            </p>
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
