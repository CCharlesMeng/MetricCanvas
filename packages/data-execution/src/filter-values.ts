import {finalizationFilterValue} from './finalization-filter-value';
import {isFinalizationDefault} from '@metriccanvas/page/internal';
import {isoWeekRange} from '@metriccanvas/page/internal';
import {initialModeRange,availabilityInitial,type DisplayInputsSnapshot,type TimeMode} from '@metriccanvas/page/internal';
import { numberRangeIssue, dimensionSelectionIssue } from '@metriccanvas/page/internal';
import { timeFilterBoundaryError, isPeriodSelection, resolvePeriodSelection, type AppliedPeriodSelection, validateTimePointValue, dimensionOfLevel, hierarchyLevelOf, isRelativeTimeExpression, resolveRelativeTime, type FilterDeclaration, type NumberRangeValue } from '@metriccanvas/page/internal';

/**
 * 筛选状态 (Filter State) 中单个筛选器的当前值。
 * 值自带类型与维度信息，供生效查询合成使用；URL 接收与自定义键名映射依赖筛选声明。
 *
 * URL 使用普通参数；接收时必须有筛选声明，范围/层级的参数名可显式指定。
 */
export type FilterValue =
  | DimensionFilterValue
  | TimeRangeFilterValue
  | TimePointFilterValue
  | BooleanFilterValue
  | NumberRangeFilterValue
  | SearchFilterValue;

export interface DimensionFilterValue {
  type: 'dimension';
  /** 约束的维度 code;层级筛选器上这是当前层级的维度。 */
  dimension: string;
  /** 选中的维度值集合;空集合等同不筛选 */
  values: string[];
  /** 层级维度筛选器的当前层级 id;扁平维度缺席。 */
  level?: string;
}

export interface TimeRangeFilterValue {
  type: 'timeRange';
  selection?: AppliedPeriodSelection;
  mode?:TimeMode;
  from: string;
  to: string;
}

export interface TimePointFilterValue {
  type: 'timePoint';
  granularity: 'month' | 'date';
  value: string;
}

export interface BooleanFilterValue {
  type: 'boolean';
  value: boolean;
}

export interface NumberRangeFilterValue {
  type: 'numberRange';
  from?: number;
  to?: number;
}

export interface SearchFilterValue {
  type: 'search';
  query: string;
}

export type FilterValues = ReadonlyMap<string, FilterValue>;

/**
 * 页面生命周期④:按页面 filters 声明计算筛选状态初值(相对时间预设按打开时刻解析)。
 * 无 default 的筛选器不占位——缺席即不筛选。
 */
export function initialFilterValues(
  declarations: FilterDeclaration[],
  now: Date = new Date(),
  displayInputs?:DisplayInputsSnapshot,filterRevision?:number,finalizationDates?:ReadonlyMap<string,string>
): Map<string, FilterValue> {
  const values = new Map<string, FilterValue>();
  for (const decl of declarations) {
    const prepared = availabilityDeclaration(decl, displayInputs, filterRevision);
    if (!prepared) continue;
    let value = finalizationFilterValue(prepared, now, finalizationDates) ?? initialValue(prepared, now);
    if (value && (value.type === 'timePoint' || value.type === 'timeRange')) {
      if (timeFilterBoundaryError(decl, value, now) && isFinalizationDefault(decl.default)) value = finalizationFilterValue(decl, now) ?? value;
      const issue = timeFilterBoundaryError(decl, value, now);
      if (issue) throw new Error(`筛选器 ${decl.id}: ${issue}`);
    }
    if (value) values.set(decl.id, value);
  }
  return values;
}

function availabilityDeclaration(decl: FilterDeclaration, displayInputs?: DisplayInputsSnapshot, revision?: number): FilterDeclaration | undefined {
  const initial = availabilityInitial(decl, displayInputs, revision);
  if (decl.type !== 'timeRange' && decl.type !== 'timePoint') return decl;
  if (decl.availability?.initial && !initial) return;
  if (!initial) return decl;
  if (decl.type === 'timePoint') return {...decl, default: initial};
  if (decl.display !== 'modes') return {...decl, default: {from: initial, to: initial}};
  const modes = decl.modes?.map(item => item.id === decl.defaultMode ? {...item, default: item.id === 'isoWeek' ? isoWeekRange(initial) : {from: initial, to: initial}} : item);
  return {...decl, modes};
}

function initialValue(decl: FilterDeclaration, now: Date): FilterValue | undefined {
  switch (decl.type) {
    case 'dimension': return dimensionInitial(decl);
    case 'timeRange': return rangeInitial(decl, now);
    case 'timePoint': return pointInitial(decl, now);
    case 'boolean': return decl.default ? {type: 'boolean', value: true} : undefined;
    case 'numberRange': return checkedNumberInitial(decl);
    case 'search': return decl.default?.trim() ? {type: 'search', query: decl.default} : undefined;
  }
}

function dimensionInitial(decl: Extract<FilterDeclaration, {type: 'dimension'}>): FilterValue | undefined {
  if (decl.default && dimensionSelectionIssue(decl, decl.default)) throw new Error('筛选初值不符合已声明选择规则');
  if (!decl.default?.length) return;
  const level = hierarchyLevelOf(decl);
  return {type: 'dimension', dimension: dimensionOfLevel(decl, level?.id), values: [...decl.default], ...(level ? {level: level.id} : {})};
}

function rangeInitial(decl: Extract<FilterDeclaration, {type: 'timeRange'}>, now: Date): FilterValue | undefined {
  if (decl.display === 'modes') return {type: 'timeRange', ...initialModeRange(decl, decl.defaultMode!, now)};
  if (!decl.default || isFinalizationDefault(decl.default)) return;
  if (isPeriodSelection(decl.default)) return {type: 'timeRange', ...resolvePeriodSelection(decl.default, now, decl.precision === 'month' ? 'month' : 'date')};
  return {type: 'timeRange', ...defaultRange(decl.default, decl.precision ?? 'date', now)};
}

function defaultRange(value: import('@metriccanvas/page/internal').TimeRangePreset | import('@metriccanvas/page/internal').TimeRangeValue | import('@metriccanvas/page/internal').RelativeTimeExpression, precision: import('@metriccanvas/page/internal').TimeRangePrecision, now: Date) {
  if (typeof value === 'string') {
    const range = resolvePreset(value, now, precision === 'month' ? 'date' : precision);
    return precision === 'month' ? {from: range.from.slice(0, 7), to: range.to.slice(0, 7)} : range;
  }
  if (isRelativeTimeExpression(value)) return resolveRelativeTime(value, now, precision);
  return {from: value.from, to: value.to};
}

function pointInitial(decl: Extract<FilterDeclaration, {type: 'timePoint'}>, now: Date): FilterValue | undefined {
  if (typeof decl.default !== 'string') return;
  const issue = validateTimePointValue(decl.default, decl.granularity, decl.min, decl.disableFuture !== false, now);
  if (issue) throw new Error(`筛选器 ${decl.id}: ${issue}`);
  return {type: 'timePoint', granularity: decl.granularity, value: decl.default};
}

function checkedNumberInitial(decl: Extract<FilterDeclaration, {type: 'numberRange'}>): FilterValue | undefined {
  if (decl.default && numberRangeIssue(decl, decl.default)) throw new Error('数值范围默认值不符合声明');
  return numberRangeInitial(decl.default);
}

function numberRangeInitial(value: NumberRangeValue | undefined): NumberRangeFilterValue | undefined {
  if (!value || (value.from === undefined && value.to === undefined)) return undefined;
  return { type: 'numberRange', from: value.from, to: value.to };
}

const PRESET_DAYS = { today: 1, last7d: 7, last30d: 30, last90d: 90 } as const;

/**
 * 预设解析的值格式跟随筛选器精度:date 为 YYYY-MM-DD;
 * datetime 为 YYYY-MM-DDTHH:mm(起点取当日 00:00、终点取解析时刻,datetime-local 可直接回显)。
 */
function resolvePreset(
  preset: keyof typeof PRESET_DAYS,
  now: Date,
  precision: 'date' | 'datetime'
): { from: string; to: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - (PRESET_DAYS[preset] - 1));
  if (precision === 'datetime') {
    return {
      from: `${toLocalDate(from)}T00:00`,
      to: `${toLocalDate(now)}T${toLocalTime(now)}`
    };
  }
  return { from: toLocalDate(from), to: toLocalDate(now) };
}

function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
