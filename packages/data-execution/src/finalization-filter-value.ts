import {
  calendarDateClock, finalizationDate, finalizationName, isPeriodSelection, localCalendarDate, resolvePeriodSelection,
  type FilterDeclaration
} from '@metriccanvas/page/internal';
import type { FilterValue } from './filter-values';

export function finalizationFilterValue(
  declaration: FilterDeclaration, now: Date, dates?: ReadonlyMap<string, string>
): Extract<FilterValue, {type:'timePoint'|'timeRange'}> | undefined {
  const name = finalizationName(declaration);
  if (!name) return;
  const fallback = localCalendarDate(now);
  const date = finalizationDate(dates?.get(name)) ?? fallback;
  try { return valueAtDate(declaration, date); }
  catch { return valueAtDate(declaration, fallback); }
}

function valueAtDate(declaration: FilterDeclaration, date: string): Extract<FilterValue, {type:'timePoint'|'timeRange'}> | undefined {
  if (declaration.type === 'timePoint') return {
    type: 'timePoint', granularity: declaration.granularity,
    value: declaration.granularity === 'month' ? date.slice(0, 7) : date
  };
  if (declaration.type !== 'timeRange') return;
  if (isPeriodSelection(declaration.default)) return {
    type: 'timeRange', ...resolvePeriodSelection(declaration.default, calendarDateClock(date), declaration.precision === 'month' ? 'month' : 'date')
  };
  const point = declaration.precision === 'month' ? date.slice(0, 7) : date;
  return { type: 'timeRange', from: point, to: point };
}
