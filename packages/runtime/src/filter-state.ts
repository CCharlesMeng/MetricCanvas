import type { FilterDeclaration } from '@metriccanvas/page';

/**
 * 筛选状态 (Filter State) 中单个筛选器的当前值。
 * 值自带类型与维度信息:生效查询合成与 URL 序列化都只依赖值本身,
 * 不需要回查页面声明(orchestrate 的签名因此无需携带 filters 声明)。
 */
export type FilterValue = DimensionFilterValue | TimeRangeFilterValue;

export interface DimensionFilterValue {
  type: 'dimension';
  /** 约束的维度 code */
  dimension: string;
  /** 选中的维度值集合;空集合等同不筛选 */
  values: string[];
}

export interface TimeRangeFilterValue {
  type: 'timeRange';
  from: string;
  to: string;
}

export type FilterValues = ReadonlyMap<string, FilterValue>;

/**
 * 筛选状态 store:页面级共享的筛选条件集合,联动的唯一总线。
 * 筛选器写入它,widget 声明订阅它,图表点击回写它;组件间不直接连线。
 * subscribe 兼容 svelte store 契约(立即同步推送当前值),subscribe/write 永不 throw。
 */
export interface FilterState {
  subscribe(run: (values: FilterValues) => void): () => void;
  write(filterId: string, value: FilterValue | null): void;
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
    for (const run of subscribers) run(current);
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      run(current);
      return () => {
        subscribers.delete(run);
      };
    },

    write(filterId, value) {
      const next = normalize(value);
      if (sameValue(current.get(filterId), next)) return;
      const map = new Map(current);
      if (next === null) map.delete(filterId);
      else map.set(filterId, next);
      replace(map);
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

/** 空维度值集合等同不筛选,归一为清除,保持 URL 与状态干净 */
function normalize(value: FilterValue | null): FilterValue | null {
  if (value && value.type === 'dimension' && value.values.length === 0) return null;
  return value;
}

function sameValue(a: FilterValue | undefined, b: FilterValue | null): boolean {
  if (!a || !b) return !a && !b;
  if (a.type === 'dimension' && b.type === 'dimension') {
    return (
      a.dimension === b.dimension &&
      a.values.length === b.values.length &&
      a.values.every((v, i) => v === b.values[i])
    );
  }
  if (a.type === 'timeRange' && b.type === 'timeRange') {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

function stripQuestionMark(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

/**
 * 值的自描述序列化(还原时无需页面声明):
 * 维度 `d:<dimension>:<v1>,<v2>`,时间范围 `t:<from>~<to>`。
 * URL 转义分两层:外层整值交给 URLSearchParams(容忍浏览器规范化),
 * 内层各分量只转义会与分隔符 : , ~ 冲突的字符。
 */
function serializeValue(value: FilterValue): string {
  if (value.type === 'dimension') {
    const values = value.values.map(escapeComponent).join(',');
    return `d:${escapeComponent(value.dimension)}:${values}`;
  }
  return `t:${escapeComponent(value.from)}~${escapeComponent(value.to)}`;
}

function parseValue(raw: string): FilterValue | null {
  try {
    if (raw.startsWith('d:')) {
      const rest = raw.slice(2);
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
    if (raw.startsWith('t:')) {
      const rest = raw.slice(2);
      const tilde = rest.indexOf('~');
      if (tilde <= 0 || tilde === rest.length - 1) return null;
      return {
        type: 'timeRange',
        from: decodeURIComponent(rest.slice(0, tilde)),
        to: decodeURIComponent(rest.slice(tilde + 1))
      };
    }
  } catch {
    // 畸形百分号序列:按不可识别处理(fromURL 永不 throw)
  }
  return null;
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
    if (decl.type === 'dimension') {
      if (decl.default && decl.default.length > 0) {
        values.set(decl.id, { type: 'dimension', dimension: decl.dimension, values: decl.default });
      }
    } else if (decl.default) {
      const range =
        typeof decl.default === 'string' ? resolvePreset(decl.default, now) : decl.default;
      values.set(decl.id, { type: 'timeRange', from: range.from, to: range.to });
    }
  }
  return values;
}

const PRESET_DAYS = { today: 1, last7d: 7, last30d: 30, last90d: 90 } as const;

function resolvePreset(preset: keyof typeof PRESET_DAYS, now: Date): { from: string; to: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - (PRESET_DAYS[preset] - 1));
  return { from: toLocalDate(from), to: toLocalDate(now) };
}

/** 本地时区的 YYYY-MM-DD(toISOString 是 UTC,跨时区会漂移日期) */
function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
