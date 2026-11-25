import {
  finalizationMonthLimit, monthFinalizationName, resolvePeriodSelection, resolvedFinalizationDate,
  rollingFinalizationName, type FilterDeclaration, type PeriodMode
} from '@metriccanvas/page/internal';
import type { FilterValue } from '../../../runtime/src/filter-state';

export type PendingPeriodChoice = { mode: 'month'; value: string } | { mode: 'last12Months' };

/** Only the presentation receives a mode while dates are still being prepared. */
export function visiblePendingPeriodModes(
  pending: readonly string[], initial: ReadonlyMap<string, PeriodMode>, chosen: ReadonlyMap<string, PendingPeriodChoice>
): Map<string, PeriodMode> {
  const modes = new Map<string, PeriodMode>();
  for (const id of pending) {
    const mode = chosen.get(id)?.mode ?? initial.get(id);
    if (mode) modes.set(id, mode);
  }
  return modes;
}

export function resolvePendingPeriodChoice(
  filter: Extract<FilterDeclaration, { type: 'timeRange' }>, choice: PendingPeriodChoice,
  dates: ReadonlyMap<string, string>, now: Date
): FilterValue {
  const selection = choice.mode === 'month'
    ? { mode: 'month' as const, value: withinFinalizedMonth(choice.value, filter, dates, now) }
    : { mode: 'last12Months' as const, anchor: resolvedFinalizationDate(rollingFinalizationName(filter), dates, now)?.slice(0, 7) };
  return { type: 'timeRange', ...resolvePeriodSelection(selection, now, filter.precision === 'month' ? 'month' : 'date') };
}

function withinFinalizedMonth(
  value: string, filter: FilterDeclaration, dates: ReadonlyMap<string, string>, now: Date
): string {
  const max = finalizationMonthLimit(monthFinalizationName(filter), dates, now);
  return max && value > max ? max : value;
}
