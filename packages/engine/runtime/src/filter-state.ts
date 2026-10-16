import { resolvePeriodSelection, isPeriodSelection } from '@metriccanvas/page/internal';
import { filterURLKeys } from '@metriccanvas/page/internal';
import {
  timeFilterBoundaryError,
  dimensionOfLevel,
  validateCalendarTimeRange,
  validateTimePointValue,
  type FilterDeclaration
} from '@metriccanvas/page/internal';

import { initialFilterValues } from '@metriccanvas/data-execution/runtime';
import type { FilterValue, FilterValues } from '@metriccanvas/data-execution/runtime';
export { initialFilterValues };
export type { FilterValue, FilterValues, DimensionFilterValue, TimeRangeFilterValue, TimePointFilterValue, BooleanFilterValue, NumberRangeFilterValue, SearchFilterValue } from '@metriccanvas/data-execution/runtime';

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

export function createFilterState(initial?: FilterValues, declarations: readonly FilterDeclaration[] = [], dimensionOptions: ReadonlyMap<string, readonly string[]> = new Map()): FilterState {
  function accepted(id: string, value: FilterValue | null | undefined): boolean {
    const options = dimensionOptions.get(id);
    return !options || !!value && value.type === 'dimension' && value.values.length === 1 && options.includes(value.values[0]!);
  }
  const byId = new Map(declarations.map(declaration => [declaration.id, declaration]));
  let current: Map<string, FilterValue> = new Map();
  for (const [id, value] of initial ?? []) {
    const declaration = byId.get(id);
    const timed = declaration?.type === 'timeRange' || declaration?.type === 'timePoint';
    const valid = timed ? normalize(value, declaration) : value;
    if (timed && !valid) throw new Error(`筛选器 ${id} 初值不符合时间边界`);
    if (!accepted(id, valid)) throw new Error(`图表筛选器 ${id} 初值不在候选项中`);
    if (valid) current.set(id, valid);
  }
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
      const next = normalize(value, byId.get(filterId));
      // 非法时间范围是无效写入,既不落状态也不清除已有合法值。
      if (next === undefined || !accepted(filterId, next)) return;
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
        const next = normalize(value, byId.get(filterId));
        if (next === undefined || !accepted(filterId, next) || sameValue(map.get(filterId), next)) continue;
        if (next === null) map.delete(filterId);
        else map.set(filterId, next);
        changed = true;
      }
      if (changed) replace(map);
    },

    toURL(explicitDeclarations = declarations) {
      return filterSearch(current, explicitDeclarations);
    },
    fromURL(search, declarations) {
      for (const declaration of declarations) byId.set(declaration.id, declaration);
      const next = new Map(parseFilterSearch(search, declarations));
      for (const declaration of declarations) {
        if (next.has(declaration.id) || !(declaration.type === 'timeRange' && (declaration.display === 'period' || declaration.required)) && !(declaration.type === 'timePoint' && (declaration.min !== undefined || declaration.disableFuture !== false) && declaration.required)) continue;
        const fallback = current.get(declaration.id) ?? initialFilterValues([declaration]).get(declaration.id);
        if (fallback) next.set(declaration.id, fallback);
      }
      for (const id of dimensionOptions.keys()) {
        if (accepted(id, next.get(id))) continue;
        const declaration = byId.get(id);
        const fallback = current.get(id) ?? (declaration ? initialFilterValues([declaration]).get(id) : undefined);
        if (fallback) next.set(id, fallback);
      }
      replace(next);
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
function normalize(value: FilterValue | null, declaration?: FilterDeclaration): FilterValue | null | undefined {
  if (declaration?.type === 'timeRange' && declaration.display === 'period') {
    if (value?.type !== 'timeRange' || !isPeriodSelection(value.selection)) return undefined;
    if (timeFilterBoundaryError(declaration, value)) return undefined;
    try {
      const resolved = resolvePeriodSelection(value.selection,new Date(),declaration.precision === 'month' ? 'month' : 'date');
      if (value.selection.mode !== 'last12Months' && (resolved.from !== value.from || resolved.to !== value.to)) return undefined;
      return {type:'timeRange',...resolved};
    } catch { return undefined; }
  }
  if (declaration?.type === 'timePoint' && (declaration.min !== undefined || declaration.disableFuture !== false)) {
    if (!value) return declaration.required ? undefined : null;
    if (value.type !== 'timePoint' || value.granularity !== declaration.granularity) return undefined;
    if (validateTimePointValue(value.value, declaration.granularity, declaration.min, declaration.disableFuture !== false)) return undefined;
  }
  if (declaration?.type === 'timeRange') {
    if (!value) return declaration.required ? undefined : null;
    if (value.type !== 'timeRange' || validateCalendarTimeRange(value, declaration.precision).length || timeFilterBoundaryError(declaration, value)) return undefined;
  }
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
    return a.from === b.from && a.to === b.to && JSON.stringify(a.selection) === JSON.stringify(b.selection);
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
      if (declaration.display === 'period') {
        const raw = read('value'); if (!raw) continue;
        const split = raw.indexOf(':');
        const selection = split < 0 ? {mode:raw} : {mode:raw.slice(0,split),value:raw.slice(split+1)};
        if (!isPeriodSelection(selection)) continue;
        if (selection.mode !== 'last12Months' && selection.value === undefined) continue;
        try {
          const value = {type:'timeRange' as const,...resolvePeriodSelection(selection,new Date(),declaration.precision === 'month' ? 'month' : 'date')};
          if (!timeFilterBoundaryError(declaration, value)) result.set(declaration.id,value);
        } catch {}
        continue;
      }
      const from = read('from'), to = read('to');
      if (!from || !to || validateCalendarTimeRange({from,to}, declaration.precision).length) continue;
      value = {type:'timeRange', from, to};
    } else if (declaration.type === 'numberRange') {
      const fromText = read('from'), toText = read('to');
      value = {type:'numberRange', ...(fromText?.trim() ? {from:Number(fromText)} : {}), ...(toText?.trim() ? {to:Number(toText)} : {})};
    } else if (declaration.type === 'timePoint') {
      const raw = read('value');
      if (!raw || validateTimePointValue(raw, declaration.granularity, declaration.min, declaration.disableFuture !== false)) continue;
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
    const valid = normalize(value, declaration);
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
    } else if (value.type === 'timeRange' && value.selection && declaration?.type === 'timeRange' && declaration.display === 'period') {
      put('value',value.selection.mode === 'last12Months' ? 'last12Months' : `${value.selection.mode}:${value.selection.value}`);
    } else if (value.type === 'timeRange' || value.type === 'numberRange') {
      put('from',value.from); put('to',value.to);
    } else if (value.type === 'search') put('value',value.query);
    else put('value',value.value);
  }
  return query.toString();
}
