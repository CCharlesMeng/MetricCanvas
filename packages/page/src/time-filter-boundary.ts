import { validateTimePointValue, type FilterDeclaration, type TimeRangePrecision } from './filter';
import type { AppliedPeriodSelection } from './period-filter';

type TimeFilterValue = { type: 'timePoint'; granularity: 'month' | 'date'; value: string }
  | { type: 'timeRange'; from: string; to: string; selection?: AppliedPeriodSelection };

/** Local business time; datetime inputs have minute precision. */
export function currentTimeValue(precision: TimeRangePrecision, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}`;
  if (precision === 'month') return month;
  const date = `${month}-${pad(now.getDate())}`;
  return precision === 'datetime' ? `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}` : date;
}

/** The UI, URL, initial values and external state writes share one boundary. */
export function timeFilterBoundaryError(declaration: FilterDeclaration, value: TimeFilterValue, now = new Date()): string | undefined {
  if (declaration.type === 'timePoint' && value.type === 'timePoint') {
    return validateTimePointValue(value.value, declaration.granularity, declaration.min, declaration.disableFuture !== false, now);
  }
  if (declaration.type !== 'timeRange' || value.type !== 'timeRange') return undefined;
  if (declaration.display === 'period' && value.selection) {
    const selected = value.selection;
    if (selected.mode === 'last12Months') return undefined;
    const month = currentTimeValue('month', now);
    const maximum = selected.mode === 'year' ? month.slice(0, 4)
      : selected.mode === 'quarter' ? `${month.slice(0, 4)}-Q${Math.floor(now.getMonth() / 3) + 1}` : month;
    return selected.value > maximum ? `期间不得晚于 ${maximum}` : undefined;
  }
  const maximum = currentTimeValue(declaration.precision ?? 'date', now);
  return value.to > maximum ? `日期不得晚于 ${maximum}` : undefined;
}
