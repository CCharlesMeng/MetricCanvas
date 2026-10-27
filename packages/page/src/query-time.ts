import { validateCalendarTimeRange } from './filter';

/** Query period semantics, independent of transport-specific date encodings. */
export type QueryTimeError = 'TIME_GRANULARITY_UNSUPPORTED' | 'TIME_VALUE_PRECISION_INVALID' | 'TIME_VALUE_CALENDAR_INVALID' | 'TIME_RANGE_REVERSED';
export class QueryTimeRangeError extends Error {
  constructor(readonly code: QueryTimeError, readonly field: string) { super(code); }
}
const patterns: Record<string, RegExp> = {
  year: /^[0-9]{4}$/, month: /^[0-9]{4}-?[0-9]{2}$/, day: /^(?:[0-9]{8}|[0-9]{4}-[0-9]{2}-[0-9]{2})$/
};
function endpoint(value: unknown, period: string, field: string): string {
  if (typeof value !== 'string' || !patterns[period].test(value)) throw new QueryTimeRangeError('TIME_VALUE_PRECISION_INVALID', field);
  const digits = value.replaceAll('-', '');
  const normalized = period === 'year' ? digits : period === 'month' ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}` : `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const date = period === 'year' ? normalized + '-01-01' : normalized;
  if (Number(digits.slice(0, 4)) === 0 || validateCalendarTimeRange({from: date, to: date}, period === 'month' ? 'month' : 'date').length) throw new QueryTimeRangeError('TIME_VALUE_CALENDAR_INVALID', field);
  return normalized;
}
export function normalizeQueryTime(value: {period?: unknown; start?: unknown; end?: unknown}): {period: string; start: string; end: string} {
  const period = value.period === 'M' ? 'month' : value.period;
  if (typeof period !== 'string' || !Object.hasOwn(patterns, period)) throw new QueryTimeRangeError('TIME_GRANULARITY_UNSUPPORTED', 'period');
  const start = endpoint(value.start, period, 'start');
  const end = endpoint(value.end, period, 'end');
  if (start > end) throw new QueryTimeRangeError('TIME_RANGE_REVERSED', 'end');
  return {period, start, end};
}
