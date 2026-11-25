import { validateTimePointValue, type FilterDeclaration } from './filter';
import type { AppliedPeriodSelection } from './period-filter';

/** Business lookup name; the resolved date belongs to the page instance. */
export interface FinalizationDefault { finalizationName: string }
export type FinalizationName = string | string[];

function isFinalizationNameText(value: unknown): value is string {
  return typeof value === 'string' && /\S/.test(value);
}

function isFinalizationName(value: unknown): value is FinalizationName {
  if (!Array.isArray(value)) return isFinalizationNameText(value);
  return value.length > 0 && value.every(isFinalizationNameText);
}

export function isFinalizationDefault(value: unknown): value is { finalizationName: FinalizationName } {
  return !!value && typeof value === 'object' && 'finalizationName' in value && isFinalizationName(value.finalizationName);
}

export function finalizationName(filter: FilterDeclaration): FinalizationName | undefined {
  if (filter.type !== 'timeRange' && filter.type !== 'timePoint') return;
  const value: unknown = filter.default;
  if (!isFinalizationDefault(value)) return;
  const name = value.finalizationName;
  return typeof name === 'string' ? name.trim() : name.map(item => item.trim());
}

export function rollingFinalizationName(filter: FilterDeclaration): FinalizationName | undefined {
  if (filter.type !== 'timeRange' || filter.display !== 'period') return;
  if (filter.periodModes && !filter.periodModes.includes('last12Months')) return;
  return finalizationName(filter);
}

export function monthFinalizationName(filter: FilterDeclaration): FinalizationName | undefined {
  if (filter.type !== 'timeRange' || filter.display !== 'period') return;
  if (filter.periodModes && !filter.periodModes.includes('month')) return;
  return finalizationName(filter);
}

export function resolvedFinalizationDate(name: FinalizationName | undefined, dates: ReadonlyMap<string, string> | undefined, now = new Date()): string | undefined {
  if (!name || !dates) return;
  if (typeof name === 'string') return finalizationDate(dates.get(name));
  const year = localCalendarDate(now).slice(0, 4);
  let earliest: string | undefined;
  for (const item of name) {
    const date = finalizationDate(dates.get(item));
    if (!date?.startsWith(year + '-')) continue;
    if (earliest === undefined || date < earliest) earliest = date;
  }
  return earliest;
}

export function finalizationMonthLimit(name: FinalizationName | undefined, dates: ReadonlyMap<string, string> | undefined, now = new Date()): string | undefined {
  const month = resolvedFinalizationDate(name, dates, now)?.slice(0, 7);
  const current = localCalendarDate(now).slice(0, 7);
  return month && month > current ? current : month;
}

export function finalizationMonthIssue(
  filter: FilterDeclaration | undefined, selection: AppliedPeriodSelection | undefined,
  dates: ReadonlyMap<string, string> | undefined, now?: Date
): string | undefined {
  if (!filter || selection?.mode !== 'month') return;
  const name = monthFinalizationName(filter);
  if (!name) return;
  if (!dates) return '等待定稿日期';
  const limit = finalizationMonthLimit(name, dates, now);
  if (limit && selection.value > limit) return `月份不得晚于 ${limit}`;
}

/** Calendar dates are never interpreted as UTC instants. */
export function finalizationDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || validateTimePointValue(value, 'date')) return;
  return value;
}

export function localCalendarDate(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function calendarDateClock(date: string): Date {
  const result = new Date(0);
  const [year, month, day] = date.split('-').map(Number);
  result.setFullYear(year!, month! - 1, day!);
  result.setHours(12, 0, 0, 0);
  return result;
}
