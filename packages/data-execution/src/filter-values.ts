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
  displayInputs?:DisplayInputsSnapshot,filterRevision?:number
): Map<string, FilterValue> {
  const values = new Map<string, FilterValue>();
  for (const decl of declarations) {
    const initial=availabilityInitial(decl,displayInputs,filterRevision);
    if((decl.type==='timeRange'||decl.type==='timePoint')&&decl.availability?.initial&&!initial)continue;
    const prepared:FilterDeclaration=initial&&decl.type==='timePoint'?{...decl,default:initial}:initial&&decl.type==='timeRange'?decl.display==='modes'?{...decl,modes:decl.modes?.map(item=>item.id===decl.defaultMode?{...item,default:item.id==='isoWeek'?isoWeekRange(initial):{from:initial,to:initial}}:item)}:{...decl,default:{from:initial,to:initial}}:decl;
    const value = initialValue(prepared, now);
    if (value && (value.type === 'timePoint' || value.type === 'timeRange')) {
      const issue = timeFilterBoundaryError(decl, value, now);
      if (issue) throw new Error(`筛选器 ${decl.id}: ${issue}`);
    }
    if (value) values.set(decl.id, value);
  }
  return values;
}

function initialValue(decl: FilterDeclaration, now: Date): FilterValue | undefined {
  if (decl.type === 'dimension') {
    if(decl.default && dimensionSelectionIssue(decl,decl.default))throw new Error('筛选初值不符合已声明选择规则');
    if (!decl.default || decl.default.length === 0) return undefined;
    const level = hierarchyLevelOf(decl);
    return {
      type: 'dimension',
      dimension: dimensionOfLevel(decl, level?.id),
      values: [...decl.default],
      ...(level ? { level: level.id } : {})
    };
  }
  if (decl.type === 'timeRange') {
    if(decl.display==='modes')return {type:'timeRange',...initialModeRange(decl,decl.defaultMode!,now)};
    if (!decl.default) return undefined;
    if (isPeriodSelection(decl.default)) return {type:'timeRange',...resolvePeriodSelection(decl.default,now,decl.precision === 'month' ? 'month' : 'date')};
    const precision = decl.precision ?? 'date';
    if (typeof decl.default === 'string') {
      const range = resolvePreset(decl.default, now, precision === "month" ? "date" : precision);
      return { type: 'timeRange', from: precision === 'month' ? range.from.slice(0,7) : range.from, to: precision === 'month' ? range.to.slice(0,7) : range.to };
    }
    if (isRelativeTimeExpression(decl.default)) {
      const range = resolveRelativeTime(decl.default, now, precision);
      return { type: 'timeRange', from: range.from, to: range.to };
    }
    return { type: 'timeRange', from: decl.default.from, to: decl.default.to };
  }
  if (decl.type === 'timePoint') {
    if (!decl.default) return undefined;
    const issue = validateTimePointValue(decl.default, decl.granularity, decl.min, decl.disableFuture !== false, now);
    if (issue) throw new Error(`筛选器 ${decl.id}: ${issue}`);
    return { type: 'timePoint', granularity: decl.granularity, value: decl.default };
  }
  if (decl.type === 'boolean') {
    return decl.default ? { type: 'boolean', value: true } : undefined;
  }
  if (decl.type === 'numberRange') {
    if(decl.default&&numberRangeIssue(decl,decl.default))throw new Error('数值范围默认值不符合声明');
    return numberRangeInitial(decl.default);
  }
  if (!decl.default || decl.default.trim() === '') return undefined;
  return { type: 'search', query: decl.default };
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
