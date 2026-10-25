import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RoutineTrigger } from "@ai-comms-agent/shared";
import { nextRoutineOccurrences } from "@ai-comms-agent/email-agent-runtime/routines/time";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { describeDigestPreview, parseDigestPreviewPreferences } from "@/lib/routines/digest-preview-preferences";

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
  // Digest preferences are a planning aid, not a mailbox grant or standing
  // consent. Invalid inputs remain visibly invalid; they never activate work.
  let digestPreferences = parseDigestPreviewPreferences({});
  let digestError = "";
  try {
    digestPreferences = parseDigestPreviewPreferences(raw);
  } catch (cause) {
    digestError = cause instanceof Error ? cause.message : "These digest options could not be previewed.";
  }
  const digestDetails = describeDigestPreview(digestPreferences);

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
        <fieldset className="rounded-lg border border-border bg-secondary/30 p-4">
          <legend className="px-2 text-sm font-semibold">What should my digest include?</legend>
          <p className="mb-4 text-xs leading-5 text-muted-foreground">These preferences describe a future source-backed briefing. No mailboxes or recipients are authorized by this form.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Which mail period?
              <select name="window" defaultValue={digestPreferences.window} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="previous_local_day">Previous local calendar day</option>
                <option value="previous_24_hours">Previous 24 elapsed hours</option>
                <option value="since_previous_occurrence">Since last verified occurrence</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Briefing language
              <select name="language" defaultValue={digestPreferences.language} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="en">English</option><option value="ta">Tamil</option>
                <option value="hi">Hindi</option><option value="ar">Arabic</option>
                <option value="fr">French</option><option value="es">Spanish</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Which information?
              <select name="focus" defaultValue={digestPreferences.focus} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="needs_attention">Important items first, with source links</option>
                <option value="all_new">All eligible new mail, grouped by priority</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Where would I want it?
              <select name="delivery" defaultValue={digestPreferences.delivery} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="in_app">Private briefing in the app</option>
                <option value="whatsapp_digest">WhatsApp (future consent required)</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Maximum summary length
              <select name="maxCodePoints" defaultValue={String(digestPreferences.maxCodePoints)} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="300">Very short — 300 characters</option>
                <option value="600">Short — 600 characters</option>
                <option value="1000">Detailed — 1,000 characters</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">If no eligible mail arrives
              <select name="emptyBehavior" defaultValue={digestPreferences.emptyBehavior} className="h-11 rounded-md border border-input bg-background px-3">
                <option value="skip">Skip the notification</option>
                <option value="check_in">Suggest a short check-in</option>
              </select>
            </label>
          </div>
        </fieldset>
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
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="digest-plan-heading" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next: scope and consent</p>
        <h2 id="digest-plan-heading" className="mt-2 font-display text-xl font-semibold">Your proposed email digest</h2>
        <p className="mt-2 text-sm font-medium">Nothing is saved or scheduled from this preview.</p>
        {digestError && <p role="alert" className="mt-3 rounded-md border border-destructive/30 p-3 text-sm text-destructive">{digestError} Choose one of the available options and preview again.</p>}
        {!digestError && <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Mailbox scope</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.scope}</dd></div>
          <div><dt className="font-semibold">Which mail is eligible?</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.window}</dd></div>
          <div><dt className="font-semibold">What matters first?</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.priority}</dd></div>
          <div><dt className="font-semibold">Preferred destination</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.delivery}</dd></div>
          <div><dt className="font-semibold">Summary size</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.limit}</dd></div>
          <div><dt className="font-semibold">No new mail</dt><dd className="mt-1 leading-6 text-muted-foreground">{digestDetails.empty}</dd></div>
        </dl>}
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold">Missing mailbox authorization and delivery consent</p>
          <p className="mt-2 leading-6">{digestDetails.review} Before an actual recurring digest, choose permitted mailboxes, confirm the exact timing and language, and review source-coverage limits. WhatsApp additionally needs a verified number, approved provider template and separately authorized delivery scope.</p>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">This page previews options only. It does not read your emails, generate a summary, create a schedule, run an automation, or send WhatsApp messages.</p>
      </section>
      <nav aria-label="Existing routine management" className="flex flex-wrap gap-4 text-sm">
        <a href="/scheduled" className="underline underline-offset-4">Scheduled AI agent ↗</a>
        <a href="/chat" className="underline underline-offset-4">Ask Clara ↗</a>
      </nav>
    </main>
  );
}
