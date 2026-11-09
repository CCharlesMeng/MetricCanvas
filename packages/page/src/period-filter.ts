import { resolveRelativeTime, validateCalendarTimeRange, type TimeRangeValue } from './filter';

export type PeriodMode = 'year' | 'quarter' | 'month' | 'last12Months';
export type PeriodSelection = { mode: 'year' | 'quarter' | 'month'; value?: string; finalizationName?: string } | { mode: 'last12Months'; finalizationName?: string; anchor?: string };
export type AppliedPeriodSelection = { mode: 'year' | 'quarter' | 'month'; value: string } | { mode: 'last12Months'; anchor?: string };
export type PeriodRange = TimeRangeValue & { selection: AppliedPeriodSelection };
const pad = (n: number) => String(n).padStart(2, '0');
const yearText = (n: number) => String(n).padStart(4, '0');

export function isPeriodSelection(value: unknown): value is PeriodSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return ['year','quarter','month','last12Months'].includes(String(v.mode)) && Object.keys(v).every(k => ['mode','value','finalizationName','anchor'].includes(k)) &&
    (v.mode === 'last12Months' ? v.value === undefined : v.value === undefined || typeof v.value === 'string') && validPeriodAnchor(v);
}

/** One clock and one canonical selection produce both display and query boundaries. */
export function resolvePeriodSelection(input: PeriodSelection, now: Date, precision: 'month' | 'date' = 'date'): PeriodRange {
  if (!isPeriodSelection(input) || !Number.isFinite(now.getTime())) throw new Error('期间选择不合法');
  if (input.mode === 'last12Months') return resolveLast12Months(input, now, precision);
  const value = input.value ?? currentPeriodValue(input.mode, now);
  return resolveNaturalPeriod(input.mode, value, precision);
}

function resolveLast12Months(input: Extract<PeriodSelection, {mode: 'last12Months'}>, now: Date, precision: 'month' | 'date'): PeriodRange {
  if (input.anchor || input.finalizationName) return anchoredLast12Months(input.anchor ?? currentPeriodValue('month', now), precision);
  const range = resolveRelativeTime({unit: 'month', range: {kind: 'lastN', n: 12}, includeCurrent: false}, now);
  const result = precision === 'month' ? {from: range.from.slice(0, 7), to: range.to.slice(0, 7)} : range;
  if (validateCalendarTimeRange(result, precision).length) throw new Error('期间超出公历范围');
  return {...result, selection: {mode: 'last12Months'}};
}

function anchoredLast12Months(anchor: string, precision: 'month' | 'date'): PeriodRange {
  const [year, month] = anchor.split('-').map(Number);
  const start = year! * 12 + month! - 12;
  const first = resolveNaturalPeriod('month', `${yearText(Math.floor(start / 12))}-${pad(start % 12 + 1)}`, precision);
  const last = resolveNaturalPeriod('month', anchor, precision);
  return {from: first.from, to: last.to, selection: {mode: 'last12Months', anchor}};
}

function currentPeriodValue(mode: 'year' | 'quarter' | 'month', now: Date): string {
  if (mode === 'year') return yearText(now.getFullYear());
  if (mode === 'quarter') return `${yearText(now.getFullYear())}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  return `${yearText(now.getFullYear())}-${pad(now.getMonth() + 1)}`;
}

function resolveNaturalPeriod(mode: 'year' | 'quarter' | 'month', value: string, precision: 'month' | 'date'): PeriodRange {
  const patterns = {year: /^(\d{4})$/, quarter: /^(\d{4})-Q([1-4])$/, month: /^(\d{4})-(0[1-9]|1[0-2])$/};
  const match = patterns[mode].exec(value);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 9999) throw new Error('期间选择不合法');
  const year = Number(match[1]);
  const start = mode === 'year' ? 1 : mode === 'quarter' ? (Number(match[2]) - 1) * 3 + 1 : Number(match[2]);
  const end = mode === 'year' ? 12 : mode === 'quarter' ? start + 2 : start;
  const from = `${yearText(year)}-${pad(start)}`, to = `${yearText(year)}-${pad(end)}`;
  return {from: precision === 'month' ? from : `${from}-01`, to: precision === 'month' ? to : `${to}-${monthLastDay(year, end)}`, selection: {mode, value}};
}

function monthLastDay(year: number, month: number): number {
  if (month !== 2) return [4, 6, 9, 11].includes(month) ? 30 : 31;
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
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

function validPeriodAnchor(value: Record<string, unknown>): boolean {
  if (value.finalizationName !== undefined && (typeof value.finalizationName !== 'string' || !value.finalizationName.trim() || value.value !== undefined)) return false;
  if (value.anchor === undefined) return true;
  return value.mode === 'last12Months' && typeof value.anchor === 'string' && validateCalendarTimeRange({from:value.anchor,to:value.anchor}, 'month').length === 0;
}
