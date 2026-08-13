import type { TimeRangeValue } from './filter';
import type { QueryFieldDefinition } from './field';

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

export type DqeFilterBinding =
  | { target: 'dimension'; queryField: string }
  | { target: 'time' };

export interface DqeQueryDefinition {
  language: 'dqe';
  body: DqeRequestBody;
  filterBindings?: Record<string, DqeFilterBinding>;
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
  fieldMappings: Record<string, QueryFieldDefinition>;
  pagination?: {
    offset: number;
    limit: number;
  };
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
