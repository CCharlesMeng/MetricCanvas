import { resolvePeriodSelection, type PeriodRange } from './period-filter';

/** Supported encodings are explicit; quarter has no verified DQE encoding yet. */
export const QUERY_PERIODS = ['day', 'month', 'year'] as const;
export type QueryPeriod = typeof QUERY_PERIODS[number];
export type PeriodQueryPolicy =
  | { kind: 'fixed'; period: QueryPeriod }
  | { kind: 'selection'; supportedPeriods: QueryPeriod[] };
export interface ResolvedPeriodQuery {
  period: QueryPeriod;
  from: string;
  to: string;
  expanded: boolean;
}

function rejected(message: string): never {
  throw Object.assign(new Error(message), { code: 'DQE_QUERY_REJECTED' });
}
function selectedPeriod(range: PeriodRange, policy: PeriodQueryPolicy): QueryPeriod {
  if (policy.kind === 'fixed') return policy.period;
  const mode = range.selection.mode;
  const period = mode === 'last12Months' ? 'month' : mode;
  if (period === 'quarter') return rejected('季度查询编码尚未确认；请选择明确的固定粒度');
  if (!policy.supportedPeriods.includes(period)) return rejected('查询不支持所选期间粒度');
  return period;
}
function calendarBounds(range: PeriodRange): { from: string; to: string } {
  const first = resolvePeriodSelection({ mode: 'month', value: range.from.slice(0, 7) }, new Date(2026, 0, 1));
  const last = resolvePeriodSelection({ mode: 'month', value: range.to.slice(0, 7) }, new Date(2026, 0, 1));
  return { from: first.from, to: last.to };
}

/** Consume the applied window, never re-anchor last12Months at request/export time. */
export function resolvePeriodQuery(range: PeriodRange, policy: PeriodQueryPolicy): ResolvedPeriodQuery {
  const bounds = calendarBounds(range);
  const period = selectedPeriod(range, policy);
  if (period === 'day') return { period, ...bounds, expanded: false };
  if (period === 'month') return { period, from: bounds.from.slice(0, 7), to: bounds.to.slice(0, 7), expanded: false };
  const from = bounds.from.slice(0, 4), to = bounds.to.slice(0, 4);
  return { period, from, to, expanded: bounds.from !== from + '-01-01' || bounds.to !== to + '-12-31' };
}
