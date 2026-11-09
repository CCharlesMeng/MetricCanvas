import type { TimeValueFormat } from '@metriccanvas/page/internal';

const UTC8_MS = 8 * 60 * 60 * 1000;
const EPOCH_PATTERN = /^-?(?:0|\d{10}|\d{13})(?:\.\d{1,3})?$/;
const DATE_PATTERN = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(.*)$/;
const BASIC_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})(.*)$/;
const CLOCK_PATTERN = /^(?:[Tt ]+(\d{1,2}):?(\d{2})(?::?(\d{2}))?(?:\.(\d{1,9}))?)?(Z|z|[+-]\d{2}:?\d{2})?$/;

/** Explicit offset wins; backend calendar strings without an offset are UTC. */
export function timeInstant(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  const calendar = calendarInstant(text);
  if (calendar !== undefined) return calendar;
  // An eight-digit value is a compact calendar date, never a guessed Unix timestamp.
  if (/^\d{8}$/.test(text) || !EPOCH_PATTERN.test(text)) return undefined;
  const digits = text.replace(/^-/, '').split('.')[0]!.length;
  const instant = Number(text) * (digits === 13 ? 1 : 1000);
  return validInstant(instant) ? instant : undefined;
}

function validInstant(instant: number): boolean {
  if (!Number.isFinite(instant)) return false;
  const date = new Date(instant + UTC8_MS);
  const year = date.getUTCFullYear();
  return year >= 1 && year <= 9999;
}

function calendarInstant(text: string): number | undefined {
  const normalized = text.replace(/[年月]/g, '-').replace(/日/g, '').replace(/\s+(?:UTC|GMT)$/i, 'Z');
  const separated = DATE_PATTERN.exec(normalized);
  const basic = separated ? undefined : BASIC_DATE_PATTERN.exec(normalized);
  if (separated) return calendarParts(Number(separated[1]), Number(separated[3]), Number(separated[4]), separated[5]!);
  if (basic) return calendarParts(Number(basic[1]), Number(basic[2]), Number(basic[3]), /^\d{4}(?:\d{2})?$/.test(basic[4]!) ? `T${basic[4]}` : basic[4]!);
  return undefined;
}

function calendarParts(year: number, month: number, day: number, clock: string): number | undefined {
  const match = CLOCK_PATTERN.exec(clock);
  if (!match) return undefined;
  const hour = Number(match[1] ?? 0), minute = Number(match[2] ?? 0), second = Number(match[3] ?? 0);
  const ms = Number((match[4] ?? '').padEnd(3, '0').slice(0, 3));
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, ms);
  if (!sameCalendar(calendar, [year, month, day, hour, minute, second])) return undefined;
  const offset = offsetMinutes(match[5]);
  if (offset === undefined) return undefined;
  const instant = calendar.getTime() - offset * 60000;
  return validInstant(instant) ? instant : undefined;
}

function sameCalendar(date: Date, expected: number[]): boolean {
  const actual = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
  return expected[0]! >= 1 && actual.every((part, index) => part === expected[index]);
}

function offsetMinutes(zone: string | undefined): number | undefined {
  if (!zone || zone.toUpperCase() === 'Z') return 0;
  const compact = zone.replace(':', '');
  const hour = Number(compact.slice(1, 3)), minute = Number(compact.slice(3, 5));
  if (hour > 14 || minute > 59 || (hour === 14 && minute !== 0)) return undefined;
  return (hour * 60 + minute) * (compact[0] === '-' ? -1 : 1);
}

/** Fixed UTC+8, never the process/browser timezone; invalid inputs retain their text. */
export function formatTime(value: unknown, format: TimeValueFormat): string {
  const instant = timeInstant(value);
  if (instant === undefined) return String(value);
  const date = new Date(instant + UTC8_MS);
  const parts: Record<string, string> = {
    YYYY: String(date.getUTCFullYear()).padStart(4, '0'),
    MM: pad(date.getUTCMonth() + 1), DD: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()), mm: pad(date.getUTCMinutes()), ss: pad(date.getUTCSeconds())
  };
  return format.pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, token => parts[token]!);
}

function pad(value: number): string { return String(value).padStart(2, '0'); }
