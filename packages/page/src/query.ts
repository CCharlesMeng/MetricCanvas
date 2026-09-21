import { resolveQueryParamReferences } from './query-param-references';
import type { TimeRangeValue } from './filter';
import type { QueryDataSourceFieldDefinition } from './field';
import { resolveTimeWindow, type TimeWindow } from './time-param';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/**
 * 查询协议闭集的唯一声明(ADR-0034/issue #79)。
 *
 * `language` 是页面查询定义与生效查询的判别符;新增协议(GraphQL/REST)
 * 时在此登记并为 PageQuery/EffectiveQuery 各补一支判别分支,消费方
 * (zod schema、数据网关分发、边界校验)全部从这里派生,不得另列闭集。
 */
export const QUERY_LANGUAGES = ['dqe'] as const;

export type QueryLanguage = (typeof QUERY_LANGUAGES)[number];

export function isQueryLanguage(value: unknown): value is QueryLanguage {
  return (QUERY_LANGUAGES as readonly unknown[]).includes(value);
}

export interface DqeRequestBody {
  /**
   * 一个页面数据源表示一个命名数据集，因此页面内恰好一项；
   * 数据网关可以在传输层合并多个逻辑查询。
   */
  dsl_list: [JsonObject];
}

/**
 * 维度筛选绑定的两支(ADR-0084):
 * - `queryField` 服务扁平维度筛选器,谓词字段恒定;
 * - `levelQueryFields` 服务层级维度筛选器,按当前层级 id 取谓词字段。
 *
 * 层级筛选器的取值在不同层级属于不同维度(全球用地理编码、代表处用代表处
 * 编码),恒定字段会把下层取值下推到上层字段上,产出静默错数据。因此两支
 * 互斥,层级筛选器必须逐级声明,缺级在校验期就拒绝。
 */
export type DqeDimensionFilterBinding =
  | { target: 'dimension'; queryField: string }
  | { target: 'dimension'; levelQueryFields: Record<string, string> };

/**
 * 非维度筛选器的绑定目标(ADR-0085)。三类各自的谓词形状不同,因此各是一支,
 * 不共用 `queryField` 一个字段名就算完:
 * - `timePoint` 是时间点等值,落在维度谓词上;取值格式必须显式声明,
 *   因为筛选状态写的是 `YYYY-MM`,而数据列常是 `YYYYMM`。
 * - `boolean` 勾选与否不对称:勾上加条件,不勾默认无条件;要筛"为假"必须
 *   显式声明 `whenFalse`,不由运行时取反。
 * - `numberRange` 落在 `filter.metrics` 上,两端各自可缺席。
 */
export type DqeTimePointFilterBinding = {
  target: 'timePoint';
  queryField: string;
  /** iso 原样送 YYYY-MM / YYYY-MM-DD(默认);compact 去掉分隔符。 */
  valueFormat?: 'iso' | 'compact';
};

export type DqeBooleanFilterBinding = {
  target: 'boolean';
  queryField: string;
  whenTrue: string[];
  whenFalse?: string[];
};

export type DqeNumberRangeFilterBinding = {
  target: 'numberRange';
  metric: string;
};

export type DqeFilterBinding =
  | DqeDimensionFilterBinding
  | { target: 'time' }
  | DqeTimePointFilterBinding
  | DqeBooleanFilterBinding
  | DqeNumberRangeFilterBinding;

/** 时间点取值按绑定声明的格式落到谓词上;不猜数据列用的是哪种写法。 */
export function timePointPredicateValue(
  value: string,
  format: DqeTimePointFilterBinding['valueFormat']
): string {
  return format === 'compact' ? value.replaceAll('-', '') : value;
}

export function isLevelDimensionBinding(
  binding: DqeFilterBinding
): binding is { target: 'dimension'; levelQueryFields: Record<string, string> } {
  return binding.target === 'dimension' && 'levelQueryFields' in binding;
}

/**
 * 绑定在给定层级上生效的谓词字段。层级绑定缺少当前层级时返回 undefined,
 * 调用方据此整条跳过下推——宁可不筛,也不换个字段冒充。
 */
export function bindingQueryField(
  binding: DqeFilterBinding,
  levelId?: string
): string | undefined {
  if (binding.target !== 'dimension') return undefined;
  if (!isLevelDimensionBinding(binding)) return binding.queryField;
  return levelId === undefined ? undefined : binding.levelQueryFields[levelId];
}

/** 绑定可能下推的全部谓词字段(层级绑定即各级字段),用于与其它绑定查重。 */
export function bindingQueryFields(binding: DqeFilterBinding): string[] {
  if (binding.target !== 'dimension') return [];
  return isLevelDimensionBinding(binding)
    ? Object.values(binding.levelQueryFields)
    : [binding.queryField];
}

export interface DqeQueryDefinition {
  language: 'dqe';
  body: DqeRequestBody;
  filterBindings?: Record<string, DqeFilterBinding>;
  paramBindings?: Record<string,
    | { target: 'dimension'; queryField: string }
    | { target: 'time'; window: TimeWindow }
  >;
}

/**
 * 页面查询定义:以 `language` 为判别符的判别联合(ADR-0034)。
 * 当前闭集仅 dqe 一支;各协议分支自行声明本协议的查询体与筛选绑定形状。
 */
export type PageQuery = DqeQueryDefinition;

export function isDqeQueryDefinition(
  query: unknown
): query is DqeQueryDefinition {
  return (
    typeof query === 'object' &&
    query !== null &&
    (query as { language?: unknown }).language === 'dqe'
  );
}

/** 统一运行时交给数据网关的一次确定性 DQE 执行请求(生效查询的 dqe 分支)。 */
export interface DqeEffectiveQuery {
  language: 'dqe';
  body: DqeRequestBody;
  fieldMappings: Record<string, QueryDataSourceFieldDefinition>;
  pagination?: {
    offset: number;
    limit: number;
  };
  /**
   * 生效查询携带的是**已解析的谓词**,不是绑定声明:timePoint 与 boolean
   * 在编排层就化成维度谓词,因此这里只比页面协议多一支数值区间。
   */
  filterValues: Array<
    | {
        target: 'dimension';
        queryField: string;
        values: Array<string | number>;
      }
    | {
        target: 'time';
        value: TimeRangeValue;
      }
    | {
        target: 'metricRange';
        metric: string;
        from?: number;
        to?: number;
      }
  >;
}

/**
 * 生效查询:与 PageQuery 同一判别符的判别联合(ADR-0034)。
 * 统一运行时按数据源分支透传 language,不感知协议内部结构。
 */
export type EffectiveQuery = DqeEffectiveQuery;

/** 判别联合分支与协议闭集互相覆盖的编译期守护:任一侧漂移即报错。 */
type _BranchLanguage = PageQuery['language'] | EffectiveQuery['language'];
type _ClosedSetMatchesBranches = [_BranchLanguage] extends [QueryLanguage]
  ? [QueryLanguage] extends [_BranchLanguage]
    ? true
    : never
  : never;
const _queryLanguageClosedSetGuard: _ClosedSetMatchesBranches = true;
void _queryLanguageClosedSetGuard;

/**
 * 查询定义自述的分页能力(协议中立,ADR-0034/issue #79):查询定义声明了
 * 合法的每页行数时返回它,否则返回 undefined。统一运行时只经由本能力
 * 读取分页声明,不解析任何协议分支的内部结构。
 */
export function declaredPaginationLimit(query: PageQuery): number | undefined {
  switch (query.language) {
    case 'dqe': {
      const order = query.body.dsl_list[0].order;
      if (
        typeof order !== 'object' ||
        order === null ||
        Array.isArray(order) ||
        !Number.isInteger(order.limit) ||
        Number(order.limit) <= 0
      ) {
        return undefined;
      }
      return Number(order.limit);
    }
  }
  // 未在上方自述分页能力的协议分支落到这里:视为未声明分页(失败安全)。
  return undefined;
}

/** 参数对查询定义的协议内初始化；有筛选绑定的目标由筛选状态接管。 */
export function initializeQueryParams(query: PageQuery, values: ReadonlyMap<string, import('./page-param').PageParamValue>): PageQuery {
  const initialized = structuredClone(query);
  resolveQueryParamReferences(initialized, values);
  for (const [id, binding] of Object.entries(initialized.paramBindings ?? {})) {
    if (binding.target === 'time') {
      const value = values.get(id);
      if (typeof value !== 'string') throw new Error(`时间绑定缺少有效参数:${id}`);
      const item = initialized.body.dsl_list[0];
      const filter = item.filter;
      if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw new Error('时间绑定需要 filter.time');
      const time = filter.time;
      if (!time || typeof time !== 'object' || Array.isArray(time)) throw new Error('时间绑定需要 filter.time');
      filter.time = { ...time, ...resolveTimeWindow(value, binding.window) };
      continue;
    }
    if (Object.values(initialized.filterBindings ?? {}).some(f => bindingQueryFields(f).includes(binding.queryField))) continue;
    const value = values.get(id);
    if (value === undefined) continue;
    const item = initialized.body.dsl_list[0];
    const rawFilter = item.filter;
    const filter = rawFilter && typeof rawFilter === 'object' && !Array.isArray(rawFilter) ? rawFilter : {};
    const dims = Array.isArray(filter.dims) ? filter.dims : [];
    item.filter = { ...filter, dims: [...dims, { dim_name: binding.queryField, dim_value_list: Array.isArray(value) ? [...value] : [String(value)] }] };
  }
  return initialized;
}
