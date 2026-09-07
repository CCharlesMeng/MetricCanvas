import { filterURLKeys } from '@metriccanvas/page';
import {
  dimensionOfLevel,
  hierarchyLevelOf,
  isRelativeTimeExpression,
  resolveRelativeTime,
  validateCalendarTimeRange,
  validateTimePointValue,
  type FilterDeclaration,
  type NumberRangeValue
} from '@metriccanvas/page';

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
 * 筛选状态 store:页面级共享的筛选条件集合,联动的唯一总线。
 * 筛选器写入它,query 页面数据源声明订阅它,图表点击回写它;组件间不直接连线。
 * subscribe 兼容 svelte store 契约(立即同步推送当前值),subscribe/write 永不 throw。
 */
export interface FilterState {
  subscribe(run: (values: FilterValues) => void): () => void;
  write(filterId: string, value: FilterValue | null): void;
  /** 原子写入多个筛选值，只向订阅方推送一次完整状态。 */
  writeMany(updates: ReadonlyArray<readonly [string, FilterValue | null]>): void;
  /** 序列化为 URL 查询串(不含 '?'),筛选状态可分享 */
  toURL(declarations?: readonly FilterDeclaration[]): string;
  /** 从 URL 查询串整体还原状态;只解析声明的查询键，忽略无关参数与畸形值 */
  fromURL(search: string, declarations: readonly FilterDeclaration[]): void;
}

export function createFilterState(initial?: FilterValues): FilterState {
  let current: Map<string, FilterValue> = new Map(initial ?? []);
  const subscribers = new Set<(values: FilterValues) => void>();

  function replace(next: Map<string, FilterValue>) {
    // 先构造新 Map 再整体替换:已推送出去的实例永不被原地修改,订阅方可安全持有与比较
    current = next;
    for (const run of subscribers) notify(run, current);
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      notify(run, current);
      return () => {
        subscribers.delete(run);
      };
    },

    write(filterId, value) {
      const next = normalize(value);
      // 非法时间范围是无效写入,既不落状态也不清除已有合法值。
      if (next === undefined) return;
      if (sameValue(current.get(filterId), next)) return;
      const map = new Map(current);
      if (next === null) map.delete(filterId);
      else map.set(filterId, next);
      replace(map);
    },

    writeMany(updates) {
      const map = new Map(current);
      let changed = false;
      for (const [filterId, value] of updates) {
        const next = normalize(value);
        if (next === undefined || sameValue(map.get(filterId), next)) continue;
        if (next === null) map.delete(filterId);
        else map.set(filterId, next);
        changed = true;
      }
      if (changed) replace(map);
    },

    toURL(declarations = []) {
      return filterSearch(current, declarations);
    },
    fromURL(search, declarations) {
      replace(new Map(parseFilterSearch(search, declarations)));
    }

  };
}

/** 兑现"subscribe/write 永不 throw":单个订阅方的异常不得中断写入与其余订阅方的通知 */
function notify(run: (values: FilterValues) => void, values: FilterValues): void {
  try {
    run(values);
  } catch (cause) {
    console.error('筛选状态订阅方回调抛出异常(已隔离):', cause);
  }
}

/** 空值集合等同不筛选,归一为清除,保持 URL 与状态干净 */
function normalize(value: FilterValue | null): FilterValue | null | undefined {
  if (value && value.type === 'dimension' && value.values.length === 0) return null;
  if (value?.type === 'timeRange' && validateCalendarTimeRange(value).length > 0) {
    return undefined;
  }
  if (value?.type === 'timePoint') {
    return validateTimePointValue(value.value, value.granularity) ? undefined : value;
  }
  if (value?.type === 'search') return value.query.trim() === '' ? null : value;
  if (value?.type === 'numberRange') {
    if (value.from === undefined && value.to === undefined) return null;
    if (
      value.from !== undefined &&
      value.to !== undefined &&
      (value.from > value.to || !Number.isFinite(value.from) || !Number.isFinite(value.to))
    ) {
      return undefined;
    }
    if (value.from !== undefined && !Number.isFinite(value.from)) return undefined;
    if (value.to !== undefined && !Number.isFinite(value.to)) return undefined;
  }
  return value;
}

function sameValue(a: FilterValue | undefined, b: FilterValue | null): boolean {
  if (!a || !b) return !a && !b;
  if (a.type !== b.type) return false;
  if (a.type === 'dimension' && b.type === 'dimension') {
    return (
      a.dimension === b.dimension &&
      a.level === b.level &&
      a.values.length === b.values.length &&
      a.values.every((v, i) => v === b.values[i])
    );
  }
  if (a.type === 'timeRange' && b.type === 'timeRange') {
    return a.from === b.from && a.to === b.to;
  }
  if (a.type === 'timePoint' && b.type === 'timePoint') {
    return a.granularity === b.granularity && a.value === b.value;
  }
  if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
  if (a.type === 'search' && b.type === 'search') return a.query === b.query;
  if (a.type === 'numberRange' && b.type === 'numberRange') {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

function stripQuestionMark(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

/** 类型只来自接收页面声明，不从字符串前缀或参数内容猜测。 */
export function parseFilterSearch(search: string, declarations: readonly FilterDeclaration[]): FilterValues {
  const query = new URLSearchParams(stripQuestionMark(search));
  const result = new Map<string, FilterValue>();
  for (const declaration of declarations) {
    const keys = filterURLKeys(declaration);
    const read = (part: string) => keys[part] ? query.get(keys[part]!) : null;
    let value: FilterValue | null | undefined;
    if (declaration.type === 'dimension') {
      const values = query.getAll(keys.value!).filter(v => v !== '');
      if (!values.length) continue;
      const level = read('level') ?? declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id;
      if (level && declaration.hierarchy && !declaration.hierarchy.some(l => l.id === level)) continue;
      value = { type: 'dimension', values, dimension: dimensionOfLevel(declaration, level), ...(level ? { level } : {}) };
    } else if (declaration.type === 'timeRange') {
      const from = read('from'), to = read('to');
      if (!from || !to || validateCalendarTimeRange({from,to}, declaration.precision).length) continue;
      value = {type:'timeRange', from, to};
    } else if (declaration.type === 'numberRange') {
      const fromText = read('from'), toText = read('to');
      value = {type:'numberRange', ...(fromText?.trim() ? {from:Number(fromText)} : {}), ...(toText?.trim() ? {to:Number(toText)} : {})};
    } else if (declaration.type === 'timePoint') {
      const raw = read('value');
      if (!raw || validateTimePointValue(raw, declaration.granularity)) continue;
      value = {type:'timePoint', granularity:declaration.granularity, value:raw};
    } else if (declaration.type === 'boolean') {
      const raw = read('value');
      if (raw !== 'true' && raw !== 'false') continue;
      // false 明确覆盖默认 true，仍保留在 URL 中以便恢复。
      value = {type:'boolean', value:raw === 'true'};
    } else {
      const raw = read('value');
      if (!raw?.trim()) continue;
      value = {type:'search', query:raw};
    }
    const valid = normalize(value);
    if (valid) result.set(declaration.id, valid);
  }
  return result;
}

export function filterSearch(values: FilterValues, declarations: readonly FilterDeclaration[] = []): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    const declaration = declarations.find(d => d.id === id);
    const keys = declaration ? filterURLKeys(declaration) : {
      value:id, from:`${id}.from`, to:`${id}.to`, level:`${id}.level`
    };
    const put = (part: string, item: string | number | boolean | undefined) => {
      if (item !== undefined && keys[part]) query.append(keys[part]!, String(item));
    };
    if (value.type === 'dimension') {
      value.values.forEach(item => put('value',item));
      put('level',value.level);
    } else if (value.type === 'timeRange' || value.type === 'numberRange') {
      put('from',value.from); put('to',value.to);
    } else if (value.type === 'search') put('value',value.query);
    else put('value',value.value);
  }
  return query.toString();
}

/**
 * 页面生命周期④:按页面 filters 声明计算筛选状态初值(相对时间预设按打开时刻解析)。
 * 无 default 的筛选器不占位——缺席即不筛选。
 */
export function initialFilterValues(
  declarations: FilterDeclaration[],
  now: Date = new Date()
): Map<string, FilterValue> {
  const values = new Map<string, FilterValue>();
  for (const decl of declarations) {
    const value = initialValue(decl, now);
    if (value) values.set(decl.id, value);
  }
  return values;
}

function initialValue(decl: FilterDeclaration, now: Date): FilterValue | undefined {
  if (decl.type === 'dimension') {
    if (!decl.default || decl.default.length === 0) return undefined;
    const level = hierarchyLevelOf(decl);
    return {
      type: 'dimension',
      dimension: dimensionOfLevel(decl, level?.id),
      values: decl.default,
      ...(level ? { level: level.id } : {})
    };
  }
  if (decl.type === 'timeRange') {
    if (!decl.default) return undefined;
    const precision = decl.precision ?? 'date';
    if (typeof decl.default === 'string') {
      const range = resolvePreset(decl.default, now, precision);
      return { type: 'timeRange', from: range.from, to: range.to };
    }
    if (isRelativeTimeExpression(decl.default)) {
      const range = resolveRelativeTime(decl.default, now, precision);
      return { type: 'timeRange', from: range.from, to: range.to };
    }
    return { type: 'timeRange', from: decl.default.from, to: decl.default.to };
  }
  if (decl.type === 'timePoint') {
    if (!decl.default) return undefined;
    return { type: 'timePoint', granularity: decl.granularity, value: decl.default };
  }
  if (decl.type === 'boolean') {
    return decl.default ? { type: 'boolean', value: true } : undefined;
  }
  if (decl.type === 'numberRange') {
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
