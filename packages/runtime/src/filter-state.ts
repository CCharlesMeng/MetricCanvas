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
 * 值自带类型与维度信息:生效查询合成与 URL 序列化都只依赖值本身,
 * 不需要回查页面声明(orchestrate 的签名因此无需携带 filters 声明)。
 *
 * URL 前缀一次定完,与页面参数 `p:` 并列、互不识别:
 *   d:  扁平维度
 *   h:  层级维度(携带当前层级)
 *   t:  时间范围
 *   m:  时间点
 *   b:  布尔(仅勾选时占位)
 *   n:  数值区间
 *   s:  搜索
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
  value: true;
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
  toURL(): string;
  /** 从 URL 查询串整体还原状态;只识别带类型标记的参数,忽略无关参数与畸形值 */
  fromURL(search: string): void;
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

    toURL() {
      const params = new URLSearchParams();
      for (const [id, value] of current) {
        params.set(id, serializeValue(value));
      }
      return params.toString();
    },

    fromURL(search) {
      const next = new Map<string, FilterValue>();
      for (const [id, raw] of new URLSearchParams(stripQuestionMark(search))) {
        const value = parseValue(raw);
        if (value) next.set(id, value);
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
function normalize(value: FilterValue | null): FilterValue | null | undefined {
  if (value && value.type === 'dimension' && value.values.length === 0) return null;
  if (value?.type === 'timeRange' && validateCalendarTimeRange(value).length > 0) {
    return undefined;
  }
  if (value?.type === 'timePoint') {
    return validateTimePointValue(value.value, value.granularity) ? undefined : value;
  }
  if (value?.type === 'boolean') return value.value ? value : null;
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

/**
 * 值的自描述序列化(还原时无需页面声明)。
 * URL 转义分两层:外层整值交给 URLSearchParams(容忍浏览器规范化),
 * 内层各分量只转义会与分隔符 : , ~ 冲突的字符。
 */
function serializeValue(value: FilterValue): string {
  if (value.type === 'dimension') {
    const values = value.values.map(escapeComponent).join(',');
    if (value.level) {
      return `h:${escapeComponent(value.dimension)}:${escapeComponent(value.level)}:${values}`;
    }
    return `d:${escapeComponent(value.dimension)}:${values}`;
  }
  if (value.type === 'timeRange') {
    return `t:${escapeComponent(value.from)}~${escapeComponent(value.to)}`;
  }
  if (value.type === 'timePoint') {
    return `m:${value.granularity}:${escapeComponent(value.value)}`;
  }
  if (value.type === 'boolean') return 'b:1';
  if (value.type === 'search') return `s:${escapeComponent(value.query)}`;
  const from = value.from === undefined ? '' : escapeComponent(String(value.from));
  const to = value.to === undefined ? '' : escapeComponent(String(value.to));
  return `n:${from}~${to}`;
}

function parseValue(raw: string): FilterValue | null {
  try {
    if (raw.startsWith('d:')) return parseDimension(raw.slice(2));
    if (raw.startsWith('h:')) return parseHierarchical(raw.slice(2));
    if (raw.startsWith('t:')) return parseTimeRange(raw.slice(2));
    if (raw.startsWith('m:')) return parseTimePoint(raw.slice(2));
    if (raw.startsWith('b:')) return raw === 'b:1' ? { type: 'boolean', value: true } : null;
    if (raw.startsWith('s:')) {
      const query = decodeURIComponent(raw.slice(2));
      return query.trim() === '' ? null : { type: 'search', query };
    }
    if (raw.startsWith('n:')) return parseNumberRange(raw.slice(2));
  } catch {
    // 畸形百分号序列:按不可识别处理(fromURL 永不 throw)
  }
  return null;
}

function parseDimension(rest: string): FilterValue | null {
  const colon = rest.indexOf(':');
  if (colon <= 0 || colon === rest.length - 1) return null;
  return {
    type: 'dimension',
    dimension: decodeURIComponent(rest.slice(0, colon)),
    values: rest
      .slice(colon + 1)
      .split(',')
      .map(decodeURIComponent)
  };
}

function parseHierarchical(rest: string): FilterValue | null {
  const first = rest.indexOf(':');
  if (first <= 0) return null;
  const second = rest.indexOf(':', first + 1);
  if (second <= first + 1 || second === rest.length - 1) return null;
  return {
    type: 'dimension',
    dimension: decodeURIComponent(rest.slice(0, first)),
    level: decodeURIComponent(rest.slice(first + 1, second)),
    values: rest
      .slice(second + 1)
      .split(',')
      .map(decodeURIComponent)
  };
}

function parseTimeRange(rest: string): FilterValue | null {
  const tilde = rest.indexOf('~');
  if (tilde <= 0 || tilde === rest.length - 1) return null;
  const value: TimeRangeFilterValue = {
    type: 'timeRange',
    from: decodeURIComponent(rest.slice(0, tilde)),
    to: decodeURIComponent(rest.slice(tilde + 1))
  };
  return validateCalendarTimeRange(value).length === 0 ? value : null;
}

function parseTimePoint(rest: string): FilterValue | null {
  const colon = rest.indexOf(':');
  if (colon <= 0 || colon === rest.length - 1) return null;
  const granularity = rest.slice(0, colon);
  if (granularity !== 'month' && granularity !== 'date') return null;
  const value = decodeURIComponent(rest.slice(colon + 1));
  if (validateTimePointValue(value, granularity)) return null;
  return { type: 'timePoint', granularity, value };
}

function parseNumberRange(rest: string): FilterValue | null {
  const tilde = rest.indexOf('~');
  if (tilde < 0) return null;
  const fromText = rest.slice(0, tilde);
  const toText = rest.slice(tilde + 1);
  const from = fromText === '' ? undefined : Number(decodeURIComponent(fromText));
  const to = toText === '' ? undefined : Number(decodeURIComponent(toText));
  if (from !== undefined && !Number.isFinite(from)) return null;
  if (to !== undefined && !Number.isFinite(to)) return null;
  if (from === undefined && to === undefined) return null;
  if (from !== undefined && to !== undefined && from > to) return null;
  return { type: 'numberRange', from, to };
}

function escapeComponent(component: string): string {
  return component
    .replace(/%/g, '%25')
    .replace(/,/g, '%2C')
    .replace(/:/g, '%3A')
    .replace(/~/g, '%7E');
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
