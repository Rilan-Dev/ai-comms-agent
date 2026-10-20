import type { RoutineOccurrencePreview, RoutineScheduleTrigger, RoutineTrigger } from "@ai-comms-agent/shared";

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

const MINUTE_MS = 60_000;
const INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function validDay(year: number, month: number, day: number): boolean {
  return Number.isInteger(year) && year >= 100 && year <= 9999 &&
    Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(day) && day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function instant(value: string | Date, label: string): number {
  if (typeof value === "string") {
    const match = INSTANT_PATTERN.exec(value);
    if (!match) throw new Error(`${label} must be an ISO instant with an explicit UTC offset`);
    if (!validDay(Number(match[1]), Number(match[2]), Number(match[3]))) {
      throw new Error(`${label} has an invalid calendar date`);
    }
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${label} is not a valid instant`);
  return time;
}

function validatedZone(value: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("A valid IANA time zone is required");
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    throw new Error("A valid IANA time zone is required");
  }
}

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone, calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function wallClock(formatter: Intl.DateTimeFormat, at: number): WallClock {
  const fields = formatter.formatToParts(new Date(at));
  const get = (type: string): number => {
    const value = fields.find((field) => field.type === type)?.value;
    if (!value) throw new Error("Cannot resolve local schedule time");
    return Number(value);
  };
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function offsetAt(formatter: Intl.DateTimeFormat, atMinute: number): number {
  const p = wallClock(formatter, atMinute);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - atMinute) / MINUTE_MS);
}

function localText(p: WallClock): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(p.year).padStart(4, "0")}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function preview(at: number, timeZone: string, formatter: Intl.DateTimeFormat): RoutineOccurrencePreview {
  return {
    fireAt: new Date(at).toISOString(),
    localTime: localText(wallClock(formatter, at)),
    timeZone,
    offsetMinutes: offsetAt(formatter, Math.floor(at / MINUTE_MS) * MINUTE_MS),
  };
}

/**
 * Resolve a wall-clock time without assuming the server's locale or current
 * UTC offset. For DST fall-back choose the first matching instant; for
 * nonexistent spring-forward times return null so that day is skipped.
 */
function firstWallInstant(p: WallClock, formatter: Intl.DateTimeFormat): number | null {
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offsets = new Set<number>();
  for (const deltaDays of [-2, -1, 0, 1, 2]) {
    const sample = asUtc + deltaDays * 24 * 60 * MINUTE_MS;
    offsets.add(offsetAt(formatter, sample));
  }
  const matches: number[] = [];
  for (const offset of offsets) {
    const candidate = asUtc - offset * MINUTE_MS;
    const candidateClock = wallClock(formatter, candidate);
    if (candidateClock.year === p.year && candidateClock.month === p.month &&
        candidateClock.day === p.day && candidateClock.hour === p.hour &&
        candidateClock.minute === p.minute) matches.push(candidate);
  }
  return matches.length ? Math.min(...matches) : null;
}

/**
 * Side-effect-free preview only. Does not persist a routine, authorize an
 * agent, or schedule any work. The worker must consume persisted occurrences
 * and preserve their intended instants across retries.
 */
export function nextRoutineOccurrences(
  trigger: RoutineTrigger,
  after: string | Date,
  count = 3,
): RoutineOccurrencePreview[] {
  const afterMs = instant(after, "after");
  if (!Number.isInteger(count) || count < 1 || count > 3) {
    throw new Error("Routine preview count must be between 1 and 3");
  }
  if (trigger.kind === "event") throw new Error("Event routines have no scheduled time preview");

  if (trigger.kind === "interval") {
    if (!Number.isSafeInteger(trigger.everyMinutes) || trigger.everyMinutes < 60 ||
        trigger.everyMinutes > 525_600) {
      throw new Error("Routine interval must be an integer between 60 and 525600 minutes");
    }
    const anchor = instant(trigger.anchorAt, "anchorAt");
    const step = trigger.everyMinutes * MINUTE_MS;
    const firstIndex = Math.max(0, Math.floor((afterMs - anchor) / step) + 1);
    const formatter = clockFormatter("UTC");
    return Array.from({ length: count }, (_, index) =>
      preview(anchor + (firstIndex + index) * step, "UTC", formatter));
  }

  const zone = validatedZone(trigger.timeZone);
  const formatter = clockFormatter(zone);
  if (trigger.kind === "once") {
    const fire = instant(trigger.fireAt, "fireAt");
    return fire > afterMs ? [preview(fire, zone, formatter)] : [];
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(trigger.localTime);
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
    throw new Error("Routine calendar time must be HH:mm in 24-hour time");
  }
  if (trigger.cadence === "weekly") {
    if (!Number.isInteger(trigger.weekday) || (trigger.weekday ?? 0) < 1 || (trigger.weekday ?? 0) > 7) {
      throw new Error("Weekly routines require an ISO weekday from 1 to 7");
    }
  } else if (trigger.cadence !== "daily" || trigger.weekday !== null) {
    throw new Error("Daily routines must have a null weekday");
  }

  const current = wallClock(formatter, afterMs);
  const start = Date.UTC(current.year, current.month - 1, current.day);
  const matches: RoutineOccurrencePreview[] = [];
  // A bounded scan covers at least three weekly occurrences, including a
  // missing spring-forward weekly occurrence, without minute-by-minute scans.
  for (let dayOffset = 0; dayOffset < 60 && matches.length < count; dayOffset++) {
    const date = new Date(start + dayOffset * 24 * 60 * MINUTE_MS);
    if (trigger.cadence === "weekly" && (date.getUTCDay() || 7) !== trigger.weekday) continue;
    const wall: WallClock = {
      year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
      hour: Number(timeMatch[1]), minute: Number(timeMatch[2]),
    };
    const fire = firstWallInstant(wall, formatter);
    if (fire !== null && fire > afterMs) matches.push(preview(fire, zone, formatter));
  }
  if (matches.length < count) throw new Error("Unable to preview the next occurrences within 60 days");
  return matches;
}

export type { RoutineScheduleTrigger };
