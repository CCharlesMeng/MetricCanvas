import { daysInGregorianMonth, validateCalendarTimeRange, type TimeRangeValue } from './filter';
import { calendarEndpoint, periodFact, type DisplayInputsSnapshot } from './period-facts';
import { resolvePeriodSelection, type PeriodRange } from './period-filter';
import { queryLeaves } from './query-selection';
import type { DqeQueryDefinition } from './query';
import type { Page } from './page';

export interface PeriodComparison {
  kind: 'current' | 'previousPeriod' | 'previousYear';
  /** Trusted host period fact; never an editable date or the client clock. */
  fact: string;
}
function rejected(message: string): never {
  throw Object.assign(new Error(message), {code:'DQE_QUERY_REJECTED'});
}
function shiftMonth(value: string, offset: number, endOfMonth = false): string {
  const [year, month, day] = value.split('-').map(Number);
  const index = year * 12 + month - 1 + offset;
  const targetYear = Math.floor(index / 12), targetMonth = index % 12 + 1;
  if (targetYear < 1 || targetYear > 9999) return rejected('比较期超出公历范围，请调整时间选择');
  const last = daysInGregorianMonth(targetYear, targetMonth);
  const targetDay = endOfMonth ? last : Math.min(day, last);
  return `${String(targetYear).padStart(4,'0')}-${String(targetMonth).padStart(2,'0')}-${String(targetDay).padStart(2,'0')}`;
}
/** Freeze and clip the current window first, then shift its calendar progress. */
export function resolvePeriodComparison(range: PeriodRange, comparison: PeriodComparison, inputs?: DisplayInputsSnapshot, revision?: number): TimeRangeValue {
  const fact = periodFact(inputs, comparison.fact, revision);
  if (fact.status !== 'ready') return rejected('统计截止时间不可用，无法计算同比环比；请刷新数据后重试');
  const from = calendarEndpoint(range.from), end = calendarEndpoint(range.to, true);
  if (validateCalendarTimeRange({from,to:end},'date').length) return rejected('比较期时间范围不合法');
  assertAppliedRange(range, from, end);
  const cutoff = calendarEndpoint(fact.latest, true);
  if (cutoff < from) return rejected('所选期间尚无已统计数据，请选择更早的期间');
  const to = cutoff < end ? cutoff : end;
  const offset = comparison.kind === 'current' ? 0 : comparison.kind === 'previousYear' ? -12 : previousOffset(range);
  return {from:shiftMonth(from,offset),to:shiftMonth(to,offset,to === end)};
}
function previousOffset(range: PeriodRange): number {
  switch (range.selection.mode) {
    case 'month': return -1;
    case 'quarter': return -3;
    default: return -12;
  }
}
export function hasPeriodComparison(query: DqeQueryDefinition): boolean {
  return queryLeaves(query).some(leaf => Object.values(leaf.filterBindings ?? {}).some(binding => binding.target === 'time' && !!binding.periodComparison));
}
export function comparisonFilterIds(page: Page): string[] {
  return Object.values(page.dataSources).flatMap(source => source.source.type === 'query' ? queryLeaves(source.source.query).flatMap(query =>
    Object.entries(query.filterBindings ?? {}).flatMap(([id,binding]) => binding.target === 'time' && binding.periodComparison ? [id] : [])) : []);
}

function assertAppliedRange(range: PeriodRange, from: string, to: string): void {
  if (range.selection.mode === 'last12Months') {
    const expectedEnd = shiftMonth(from, 11, true);
    if (!from.endsWith('-01') || to !== expectedEnd) rejected('近一年必须为已应用的十二个完整自然月');
    return;
  }
  const expected = resolvePeriodSelection(range.selection, new Date(2026,0,1));
  if (from !== expected.from || to !== expected.to) rejected('期间选择与时间范围不一致，请重新选择期间');
}
