import { createHash } from 'node:crypto';
import { nextRoutineOccurrences } from './time';
import type { RoutineDraft, RoutineDestination, RoutineTrigger, RoutineProposalPreview } from '@ai-comms-agent/shared';

/** Pure schema validation: never resolves actor identity, mailbox grants or send permission. */
function record(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object`);
  }
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) if (!keys.includes(key)) throw new Error(`${label}: unknown field ${key}`);
  return object;
}
function valueString(value: unknown, label: string, min = 1, max = 120): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new Error(`${label} must be between ${min} and ${max} characters`);
  }
  return value.trim();
}
function oneOf<T extends string>(value: unknown, label: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`${label} is unsupported`);
  return value as T;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value as number;
}
function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID`);
  }
  return value.toLowerCase();
}
function locale(value: unknown, label: string): string {
  const raw = valueString(value, label, 2, 35);
  try { return Intl.getCanonicalLocales(raw)[0] ?? (() => { throw new Error('invalid locale'); })(); }
  catch { throw new Error(`${label} must be a valid language tag`); }
}
function zone(value: unknown): string {
  const raw = valueString(value, 'timeZone', 1, 100);
  try { return new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone; }
  catch { throw new Error('timeZone must be a valid IANA zone'); }
}
function hour(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
    throw new Error(`${label} must be HH:mm in 24-hour time`);
  }
  return value;
}
function instant(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} requires an explicit UTC offset`);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} requires an ISO instant with explicit offset`);
  const y = Number(match[1]); const mo = Number(match[2]); const d = Number(match[3]);
  if (y < 100 || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() ||
    Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] ?? 0) > 59) {
    throw new Error(`${label} contains an invalid calendar date or time`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid instant`);
  return new Date(parsed).toISOString();
}
function trigger(value: unknown): RoutineTrigger {
  const base = record(value, 'trigger', ['kind', 'everyMinutes', 'anchorAt', 'cadence', 'localTime', 'weekday', 'timeZone', 'fireAt', 'eventType', 'conditions', 'debounceMinutes']);
  switch (base.kind) {
    case 'interval': {
      const s = record(value, 'interval trigger', ['kind', 'everyMinutes', 'anchorAt']);
      return { kind: 'interval', everyMinutes: integer(s.everyMinutes, 'everyMinutes', 60, 525600), anchorAt: instant(s.anchorAt, 'anchorAt') };
    }
    case 'calendar': {
      const s = record(value, 'calendar trigger', ['kind', 'cadence', 'localTime', 'weekday', 'timeZone']);
      const cadence = oneOf(s.cadence, 'calendar cadence', ['daily', 'weekly'] as const);
      if (cadence === 'daily' && s.weekday !== null) throw new Error('Daily weekday must be null');
      const weekday = cadence === 'weekly' ? integer(s.weekday, 'weekday', 1, 7) : null;
      return { kind: 'calendar', cadence, localTime: hour(s.localTime, 'localTime'), weekday, timeZone: zone(s.timeZone) };
    }
    case 'once': {
      const s = record(value, 'one-off trigger', ['kind', 'fireAt', 'timeZone']);
      return { kind: 'once', fireAt: instant(s.fireAt, 'fireAt'), timeZone: zone(s.timeZone) };
    }
    case 'event': {
      const s = record(value, 'event trigger', ['kind', 'eventType', 'conditions', 'debounceMinutes']);
      if (s.eventType !== 'email.received') throw new Error('eventType is unsupported');
      const conditions = record(s.conditions, 'event conditions', ['sender', 'subjectContains']);
      const normalized: Record<string, string> = {};
      for (const [key, val] of Object.entries(conditions)) normalized[key] = valueString(val, key, 1, 200);
      if (Object.keys(normalized).length === 0) throw new Error('Event routines require a bounded condition');
      if (s.debounceMinutes !== 15) throw new Error('event debounceMinutes must be 15');
      return {kind:'event',eventType:'email.received',conditions:normalized,debounceMinutes:15};
    }
    default: throw new Error('trigger kind is unsupported');
  }
}
function destination(value: unknown): RoutineDestination {
  const d = record(value, 'destination', ['kind', 'accountId', 'recipientId', 'deliveryPolicy', 'template']);
  if (d.kind === 'in_app') { record(value, 'in_app destination', ['kind']); return {kind:'in_app'}; }
  if (d.kind !== 'whatsapp_digest') throw new Error('destination is unsupported');
  record(value, 'WhatsApp destination', ['kind', 'accountId', 'recipientId', 'deliveryPolicy', 'template']);
  const policy = oneOf(d.deliveryPolicy, 'deliveryPolicy', ['text_in_window_template_outside','template_only'] as const);
  let template: Extract<RoutineDestination, {kind:'whatsapp_digest'}>['template'] = null;
  if (d.template != null) {
    const t = record(d.template, 'template', ['providerId', 'name', 'language', 'contentHash', 'parameterSchemaHash']);
    const hash = (v: unknown, label: string): string => {
      if (typeof v !== 'string' || !/^[0-9a-f]{64}$/i.test(v)) throw new Error(`${label} must be SHA-256`);
      return v.toLowerCase();
    };
    template = {providerId:valueString(t.providerId,'providerId',1,100), name:valueString(t.name,'template name',1,100),
      language:locale(t.language,'template language'),contentHash:hash(t.contentHash,'contentHash'),parameterSchemaHash:hash(t.parameterSchemaHash,'parameterSchemaHash')};
  }
  if (policy === 'template_only' && !template) throw new Error('template_only requires a template');
  return {kind:'whatsapp_digest', accountId:uuid(d.accountId,'sender accountId'), recipientId:uuid(d.recipientId,'recipientId'), deliveryPolicy:policy, template};
}
export function normalizeRoutineDraft(raw: unknown): RoutineDraft {
  const input = record(raw, 'routine draft', ['name', 'mailboxIds', 'trigger', 'task', 'destination', 'limits', 'quietHours']);
  if (!Array.isArray(input.mailboxIds) || input.mailboxIds.length === 0 || input.mailboxIds.length > 20) {
    throw new Error('mailboxIds must contain between 1 and 20 IDs');
  }
  const mailboxIds = (input.mailboxIds as unknown[]).map((item) => uuid(item,'mailboxId'));
  if (new Set(mailboxIds).size !== mailboxIds.length) throw new Error('duplicate mailboxIds are not allowed');
  mailboxIds.sort();
  const t = record(input.task, 'task', ['kind','language','window']);
  if (t.kind !== 'email_digest') throw new Error('task kind is unsupported');
  const task: RoutineDraft['task'] = {kind:'email_digest',language:locale(t.language,'language'),
    window:oneOf(t.window,'digest window',['since_previous_occurrence','previous_24_hours','previous_local_day'] as const)};
  const l = record(input.limits, 'limits', ['maxCodePoints','emptyBehavior','catchUpMinutes']);
  const limits: RoutineDraft['limits'] = {maxCodePoints:integer(l.maxCodePoints,'maxCodePoints',1,1000),
    emptyBehavior:oneOf(l.emptyBehavior,'emptyBehavior',['skip','check_in'] as const),
    catchUpMinutes:integer(l.catchUpMinutes,'catchUpMinutes',1,10080)};
  let quietHours: RoutineDraft['quietHours'] = null;
  if (input.quietHours != null) {
    const q = record(input.quietHours, 'quietHours', ['start','end','timeZone']);
    const start=hour(q.start,'quietHours.start'); const end=hour(q.end,'quietHours.end');
    if (start===end) throw new Error('quietHours start and end cannot be equal');
    quietHours={start,end,timeZone:zone(q.timeZone)};
  }
  return {name:valueString(input.name,'name',1,120),mailboxIds,trigger:trigger(input.trigger),task,destination:destination(input.destination),limits,quietHours};
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable((value as Record<string, unknown>)[key])]));
  return value;
}
export function routineConfigHash(draft: RoutineDraft): string {
  // Normalize again, so a caller cannot hash unauthorized arbitrary keys.
  return createHash('sha256').update(JSON.stringify(stable(normalizeRoutineDraft(draft)))).digest('hex');
}
export function previewRoutineDraft(raw: unknown, after: string | Date): RoutineProposalPreview {
  const normalized = normalizeRoutineDraft(raw);
  const nextOccurrences = normalized.trigger.kind === 'event' ? [] : nextRoutineOccurrences(normalized.trigger, after);
  const warnings: string[] = [];
  if (normalized.trigger.kind === 'event') warnings.push('Event triggers have no fixed scheduled time; event execution is not enabled.');
  if (normalized.destination.kind === 'whatsapp_digest') warnings.push('WhatsApp delivery requires separate verified recipient, policy, consent and provider approval.');
  return {status:'preview_only', normalized, configHash:routineConfigHash(normalized), nextOccurrences, warnings};
}
