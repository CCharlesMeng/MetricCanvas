import { resolveRelativeTime, validateCalendarTimeRange, type TimeRangeValue } from './filter';

export type PeriodMode = 'year' | 'quarter' | 'month' | 'last12Months';
export type PeriodSelection = { mode: 'year' | 'quarter' | 'month'; value?: string } | { mode: 'last12Months' };
export type AppliedPeriodSelection = { mode: 'year' | 'quarter' | 'month'; value: string } | { mode: 'last12Months' };
export type PeriodRange = TimeRangeValue & { selection: AppliedPeriodSelection };
const pad = (n: number) => String(n).padStart(2, '0');
const yearText = (n: number) => String(n).padStart(4, '0');

export function isPeriodSelection(value: unknown): value is PeriodSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return ['year','quarter','month','last12Months'].includes(String(v.mode)) && Object.keys(v).every(k => k === 'mode' || k === 'value') &&
    (v.mode === 'last12Months' ? v.value === undefined : v.value === undefined || typeof v.value === 'string');
}

/** One clock and one canonical selection produce both display and query boundaries. */
export function resolvePeriodSelection(input: PeriodSelection, now: Date, precision: 'month' | 'date' = 'date'): PeriodRange {
  if (!isPeriodSelection(input) || !Number.isFinite(now.getTime())) throw new Error('期间选择不合法');
  if (input.mode === 'last12Months') {
    const range = resolveRelativeTime({ unit:'month', range:{kind:'lastN',n:12}, includeCurrent:false }, now);
    const result = precision === 'month' ? {from:range.from.slice(0,7),to:range.to.slice(0,7)} : range;
    if (validateCalendarTimeRange(result, precision).length) throw new Error('期间超出公历范围');
    return {...result,selection:{mode:'last12Months'}};
  }
  const value = input.value ?? (input.mode === 'year' ? yearText(now.getFullYear()) : input.mode === 'quarter' ? `${yearText(now.getFullYear())}-Q${Math.floor(now.getMonth()/3)+1}` : `${yearText(now.getFullYear())}-${pad(now.getMonth()+1)}`);
  const match = (input.mode === 'year' ? /^(\d{4})$/ : input.mode === 'quarter' ? /^(\d{4})-Q([1-4])$/ : /^(\d{4})-(0[1-9]|1[0-2])$/).exec(value);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 9999) throw new Error('期间选择不合法');
  const year = Number(match[1]);
  const start = input.mode === 'year' ? 1 : input.mode === 'quarter' ? (Number(match[2])-1)*3+1 : Number(match[2]);
  const end = input.mode === 'year' ? 12 : input.mode === 'quarter' ? start+2 : start;
  const leap = year%4 === 0 && (year%100 !== 0 || year%400 === 0);
  const lastDay = end === 2 ? leap ? 29 : 28 : [4,6,9,11].includes(end) ? 30 : 31;
  const from = `${yearText(year)}-${pad(start)}`, to = `${yearText(year)}-${pad(end)}`;
  return {from:precision === 'month' ? from : `${from}-01`,to:precision === 'month' ? to : `${to}-${pad(lastDay)}`,selection:{mode:input.mode,value}};
}

/** Parameters and external range writes must exactly match the explicitly selected mode. */
export function periodSelectionFromRange(range: TimeRangeValue, mode: Exclude<PeriodMode,'last12Months'>, precision: 'month'|'date'): AppliedPeriodSelection | undefined {
  if (validateCalendarTimeRange(range,precision).length) return undefined;
  const year = range.from.slice(0,4), month = Number(range.from.slice(5,7));
  const value = mode === 'year' ? year : mode === 'quarter' ? `${year}-Q${Math.ceil(month/3)}` : range.from.slice(0,7);
  const resolved = resolvePeriodSelection({mode,value},new Date(2026,0,1),precision);
  return resolved.from === range.from && resolved.to === range.to ? resolved.selection : undefined;
}

export function periodRangeLabel(range: TimeRangeValue): string {
  const month = (value: string) => `${value.slice(2,4)}年${Number(value.slice(5,7))}月`;
  return `${month(range.from)}~${month(range.to)}`;
}
