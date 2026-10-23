import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RoutineTrigger } from "@ai-comms-agent/shared";
import { nextRoutineOccurrences } from "@ai-comms-agent/email-agent-runtime/routines/time";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
type Kind = "daily" | "weekly" | "interval" | "once" | "event";

function boundedParam(raw: unknown, maxLength = 80): string {
  return typeof raw === "string" && raw.length <= maxLength ? raw.trim() : "";
}

function offsetText(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

const intervalOptions = { "1": 60, "6": 360, "12": 720, "24": 1440 } as const;

const weekdays = [
  ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"],
  ["5", "Friday"], ["6", "Saturday"], ["7", "Sunday"],
] as const;

export default async function RoutinePreviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  // This private view only previews arithmetic; it never creates an execution
  // grant, durable schedule, automation or outbound provider request.
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context?.organizationId || !context.user?.id) redirect("/login?reason=not_provisioned");

  const raw = await searchParams;
  const requestedKind = boundedParam(raw.kind);
  const kind: Kind = ["daily", "weekly", "interval", "once", "event"].includes(requestedKind)
    ? requestedKind as Kind : "daily";
  const timeZone = boundedParam(raw.timeZone, 90) || "UTC";
  const localTime = boundedParam(raw.localTime, 5) || "09:00";
  const weekday = boundedParam(raw.weekday, 1) || "1";
  const intervalHours = boundedParam(raw.intervalHours, 2) || "24";
  const now = new Date();
  const fireAt = boundedParam(raw.fireAt, 45) || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const hasInputs = Object.keys(raw).length > 0;

  let occurrences: ReturnType<typeof nextRoutineOccurrences> = [];
  let error = "";
  try {
    if (requestedKind && !["daily", "weekly", "interval", "once", "event"].includes(requestedKind)) {
      throw new Error("Choose a supported routine trigger.");
    }
    if (kind === "interval" && !(intervalHours in intervalOptions)) {
      throw new Error("Choose a supported interval between one and 24 hours.");
    }
    if (kind !== "event") {
      const intervalMinutes = intervalOptions[intervalHours as keyof typeof intervalOptions] ?? 1440;
      const trigger: RoutineTrigger = kind === "interval"
        ? { kind: "interval", everyMinutes: intervalMinutes, anchorAt: now.toISOString() }
        : kind === "once"
          ? { kind: "once", fireAt, timeZone }
          : { kind: "calendar", cadence: kind === "weekly" ? "weekly" : "daily",
              localTime, weekday: kind === "weekly" ? Number(weekday) : null, timeZone };
      occurrences = nextRoutineOccurrences(trigger, now, 3);
      if (!occurrences.length) error = "This one-time date has passed. Choose a future instant.";
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "These timing options could not be previewed.";
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-7 sm:px-8">
      <a href="/overview" className="text-sm text-muted-foreground hover:text-foreground">← Back to Overview</a>
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">R1a · Safe planning</p>
        <h1 className="font-display text-3xl font-semibold">Preview when a routine would run</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Choose a timing rule, then inspect its next occurrences. Preview only — nothing saved or sent.
          Your AI will be able to propose these rules; activating a routine remains a separate, explicitly approved step.
        </p>
      </header>
      <form method="get" action="/routines/preview" className="space-y-4 rounded-xl border border-border bg-card p-5" aria-label="Routine timing preview">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">When should it happen?
            <select name="kind" defaultValue={kind} className="h-11 rounded-md border border-input bg-background px-3">
              <option value="daily">Every day at a local time</option>
              <option value="weekly">Every week on a chosen day</option>
              <option value="interval">Every 1, 6, 12 or 24 elapsed hours</option>
              <option value="once">One time at an exact instant</option>
              <option value="event">When an email arrives (event trigger)</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">IANA time zone
            <input name="timeZone" maxLength={90} defaultValue={timeZone} required className="h-11 rounded-md border border-input bg-background px-3" placeholder="Asia/Kolkata" />
            <span className="text-xs font-normal text-muted-foreground">A valid IANA time zone is required, such as UTC, Asia/Kolkata or America/New_York.</span>
          </label>
          <label className="grid gap-2 text-sm font-medium">Calendar local time
            <input name="localTime" type="time" defaultValue={localTime} className="h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">Fixed elapsed interval
            <select name="intervalHours" defaultValue={intervalHours} className="h-11 rounded-md border border-input bg-background px-3">
              <option value="1">Every hour (minimum)</option>
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Weekly day
            <select name="weekday" defaultValue={weekday} className="h-11 rounded-md border border-input bg-background px-3">
              {weekdays.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">One-time exact instant (with UTC offset)
          <input name="fireAt" maxLength={45} defaultValue={fireAt} className="h-11 rounded-md border border-input bg-background px-3" aria-describedby="once-hint" />
          <span id="once-hint" className="text-xs font-normal text-muted-foreground">For one-time previews use ISO 8601 with Z or a numeric offset, for example 2026-11-01T09:00:00+05:30.</span>
        </label>
        <button type="submit" className="min-h-11 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Show next times (no scheduling)
        </button>
      </form>
      <section className="rounded-xl border border-border bg-card p-5" aria-live="polite" aria-label="Routine occurrence preview">
        <h2 className="font-display text-xl font-semibold">Preview only — nothing saved or sent</h2>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>
        : kind === "event" ? <p className="mt-3 text-sm">Event-triggered routines do not have fixed occurrence times. A new email is only a possible trigger; execution and permissions are not configured or activated here.</p>
        : <ol className="mt-4 space-y-3">
          {occurrences.map((occurrence, index) => <li key={occurrence.fireAt} className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-medium text-muted-foreground">Occurrence {index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{occurrence.localTime.replace("T", " ")} · {occurrence.timeZone} ({offsetText(occurrence.offsetMinutes)})</p>
            <p className="mt-1 text-xs text-muted-foreground">Exact UTC instant: <time dateTime={occurrence.fireAt}>{occurrence.fireAt}</time></p>
          </li>)}
        </ol>}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          These times are estimates for planning, not actual scheduled jobs. Fixed elapsed intervals (including every 24 hours) may appear at a different time through daylight-saving changes; a daily local-time rule follows the chosen time zone&apos;s calendar. Missing spring-forward times are skipped and the first duplicated fall-back instant is used.
        </p>
        {hasInputs && <p className="mt-2 text-xs text-muted-foreground">Changing the selection never edits an existing schedule or automation.</p>}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          WhatsApp delivery needs a separate consent and provider approval. Sending email still requires human approval.
        </p>
      </section>
      <nav aria-label="Existing routine management" className="flex flex-wrap gap-4 text-sm">
        <a href="/schedules" className="underline underline-offset-4">Existing Schedules ↗</a>
        <a href="/automations" className="underline underline-offset-4">Existing Automations ↗</a>
        <a href="/chat" className="underline underline-offset-4">Ask Clara ↗</a>
      </nav>
    </main>
  );
}
