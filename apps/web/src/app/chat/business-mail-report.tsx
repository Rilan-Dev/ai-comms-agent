"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Inbox, MailOpen, ExternalLink } from "lucide-react";
import type { BusinessMailReport as Report } from "@/lib/chat/business-report-display";

function formatReceivedUtc(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(timestamp) + " UTC";
}

/** Only previously verified source data; presentation never changes mail state. */
export function BusinessMailReport({ report }: { report: Report }) {
  const [visible, setVisible] = useState(5);
  const shown = report.messages.slice(0, visible);
  const remaining = Math.max(0, report.messages.length - shown.length);
  const subjectFlags = report.messages.filter(message => message.attention).length;

  return (
    <section aria-label="Verified mailbox briefing" className="w-full min-w-0 space-y-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Inbox size={18} /></span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Your mailbox briefing</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              {report.kind === "unread-count" ? "Unread mail from the synchronized store" : "Verified messages from the synchronized store"}
            </p>
          </div>
        </div>
        <span className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Local sync</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border bg-background px-3 py-3">
          <p className="text-[11px] text-muted-foreground">{report.kind === "unread-count" ? "Unread messages" : "Matched"}</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{report.matched.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-background px-3 py-3">
          <p className="text-[11px] text-muted-foreground">{report.kind === "unread-count" ? "Mailboxes" : "Included"}</p>
          <p className="text-2xl font-bold tabular-nums">{(report.kind === "unread-count" ? report.mailboxes.length : report.included).toLocaleString()}</p>
        </div>
        <div className="col-span-2 rounded-xl border bg-background px-3 py-3 sm:col-span-1">
          <p className="text-[11px] text-muted-foreground">Flagged in subject</p>
          <p className="text-2xl font-bold tabular-nums">{subjectFlags.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Only explicit subject wording</p>
        </div>
      </div>

      {report.mailboxes.length > 0 ? (
        <div className="rounded-xl border bg-background p-3">
          <h4 className="mb-2 text-xs font-semibold">By mailbox</h4>
          <div className="space-y-2">
            {report.mailboxes.map(mailbox => (
              <div key={mailbox.email} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                <span className="min-w-0 break-all text-muted-foreground">{mailbox.email}</span>
                <strong className="shrink-0 tabular-nums">{mailbox.unread.toLocaleString()} unread</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{report.kind === "unread-count" ? "Newest unread messages" : "Messages"}</h4>
        <p className="break-words text-xs leading-5 text-muted-foreground">{report.period}</p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          <MailOpen size={17} className="mb-2" />
          No matching messages were found in the locally synchronized data.
        </div>
      ) : (
        <ol className="space-y-2">
          {shown.map((mail, index) => (
            <li key={index} className={"min-w-0 rounded-xl border bg-background p-3 sm:p-4 " +
              (mail.attention ? "border-amber-500/50" : "border-border")}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {mail.attention ? <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={13} /> Action wording in subject
                  </p> : null}
                  <p className="break-words text-sm font-semibold leading-6">{mail.subject}</p>
                  <p className="break-all text-xs text-muted-foreground"><strong className="font-medium text-foreground">From:</strong> {mail.sender}</p>
                  <p className="break-all text-xs text-muted-foreground"><strong className="font-medium text-foreground">Inbox:</strong> {mail.mailbox}</p>
                  <p className="text-xs text-muted-foreground">{formatReceivedUtc(mail.receivedUtc)}</p>
                  {mail.excerpt ? (
                    <details className="group rounded-lg bg-muted/30 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-foreground">Read synchronized excerpt</summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{mail.excerpt}</p>
                    </details>
                  ) : null}
                  {mail.source ? (
                    <a href={mail.source} className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                      Open original thread <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {remaining > 0 ? (
        <button type="button" onClick={() => setVisible(value => Math.min(report.messages.length, value + 10))}
          className="flex w-full items-center justify-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-xs font-semibold text-primary hover:bg-muted">
          Show next {Math.min(10, remaining)} of {remaining.toLocaleString()} messages <ChevronDown size={14} />
        </button>
      ) : null}

      {report.moreCount > 0 ? <p className="text-xs text-muted-foreground">
        {report.moreCount.toLocaleString()} other unread messages exist in the synchronized count. Ask for a full report to see more.
      </p> : null}
      {report.coverage ? <p className="text-xs leading-5 text-muted-foreground">{report.coverage}</p> : null}
      <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
        <strong>Data freshness:</strong> {report.notice}\n        {report.lastSyncUtc ? <span className="mt-1 block">Oldest connected mailbox synchronization: {formatReceivedUtc(report.lastSyncUtc)}.</span> : null}\n        <span className="mt-1 block">No newer provider mail is guaranteed by local sync.</span>
      </p>
    </section>
  );
}
