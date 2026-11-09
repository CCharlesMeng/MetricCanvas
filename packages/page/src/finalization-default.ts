import { validateTimePointValue, type FilterDeclaration } from './filter';

/** Business lookup name; the resolved date belongs to the page instance. */
export interface FinalizationDefault { finalizationName: string }

export function isFinalizationDefault(value: unknown): value is FinalizationDefault {
  return !!value && typeof value === 'object' && 'finalizationName' in value && typeof value.finalizationName === 'string';
}

export function finalizationName(filter: FilterDeclaration): string | undefined {
  if (filter.type !== 'timeRange' && filter.type !== 'timePoint') return;
  return isFinalizationDefault(filter.default) ? filter.default.finalizationName.trim() : undefined;
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
