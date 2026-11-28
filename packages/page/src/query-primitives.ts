import type { QueryDataSourceFieldDefinition } from './field';
import type { PeriodComparison, TimeMode, TimeRangeValue } from './filter-types';
import type { PeriodAggregation, PeriodAggregationCase } from './period-aggregation';
import type { Condition } from './schema/condition';
import type { TimeWindow } from './time-param';

export { MAX_QUERY_RESULT_VALUES } from './query-result-limits';

/**
 * Pure leaf type definitions and constants for queries, query periods,
 * filter bindings, and query-result-where predicates.
 * Re-exported by `query.ts`, `query-bindings.ts`, `period-query.ts`,
 * `query-result-where.ts`, and `dqe-object.ts`.
 */

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
 */
export const QUERY_LANGUAGES = ['dqe'] as const;

export type QueryLanguage = (typeof QUERY_LANGUAGES)[number];

export function isQueryLanguage(value: unknown): value is QueryLanguage {
  return (QUERY_LANGUAGES as readonly unknown[]).includes(value);
}

/** Query encodings are independent of the calendar window used by the picker. */
export const QUERY_PERIODS = ['day', 'month', 'quarter', 'year'] as const;
export type QueryPeriod = (typeof QUERY_PERIODS)[number];

export type PeriodQueryPolicy =
  | { kind: 'fixed'; period: QueryPeriod }
  | { kind: 'selection'; supportedPeriods: QueryPeriod[] };

export interface ResolvedPeriodQuery {
  period: QueryPeriod;
  from: string;
  to: string;
  expanded: boolean;
}

export const MAX_QUERY_RESULT_WHERE_DEPTH = 4;
export const MAX_QUERY_RESULT_WHERE_LEAVES = 64;
export const MAX_QUERY_RESULT_WHERE_VALUES = 1000;

export type ObjectTimeFormat = 'iso' | 'compact' | 'datetime';
export interface ObjectTimeTarget {
  queryField?: string;
  valueFormat?: ObjectTimeFormat;
}

export type DqeDimensionFilterBinding = (
  | { target: 'dimension'; queryField: string }
  | { target: 'dimension'; levelQueryFields: Record<string, string> }
) & {
  /** Inclusion by default; != excludes every selected value. */
  operator?: '=' | '!=';
  /** Filter-only condition; suspends this predicate without clearing its stored choice. */
  when?: Condition;
};

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
  metric?: string;
  metricByFilter?: { filterId: string; cases: Record<string, string> };
};

export type DqeFilterBinding =
  | DqeDimensionFilterBinding
  | ({
      target: 'time';
      window?: TimeWindow;
      periodPolicy?: PeriodQueryPolicy;
      periodComparison?: PeriodComparison;
    } & ObjectTimeTarget)
  | DqeTimePointFilterBinding
  | DqeBooleanFilterBinding
  | DqeNumberRangeFilterBinding;

export interface DqeRequestBody {
  /**
   * 一个页面数据源表示一个命名数据集，因此页面内恰好一项；
   * 数据网关可以在传输层合并多个逻辑查询。
   */
  dsl_list: [JsonObject];
}

export type QueryResultWhere =
  | { all: QueryResultWhere[] }
  | { any: QueryResultWhere[] }
  | { field: string; op: 'eq' | 'ne'; value: string | number | boolean }
  | { field: string; op: 'in' | 'notIn'; values: Array<string | number | boolean> }
  | { field: string; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { field: string; op: 'isNull' | 'isNotNull' };

/** Raw normalized query dimensions become bounded downstream predicates. */
export interface QueryResultBinding {
  source: string;
  field: string;
  target: 'dimension';
  queryField: string;
  maxValues: number;
  /** Select rows from this binding's raw upstream result without changing that result. */
  where?: QueryResultWhere;
}

export interface DqeQueryCase {
  body: DqeRequestBody;
  filterBindings: Record<string, DqeFilterBinding>;
}

export interface DqeQueryModeCase extends DqeQueryCase {
  /** 页面字段 id → 本分支的原始响应字段；属于页面元数据，不发送给 DQE。 */
  fieldMappings?: Record<string, string>;
}

export interface DqeQueryDefinition {
  periodAggregation?: PeriodAggregation;
  resultBindings?: QueryResultBinding[];
  language: 'dqe';
  body?: DqeRequestBody;
  timeModes?: {
    filterId: string;
    cases: Partial<Record<TimeMode, DqeQueryCase>>;
  };
  queryModes?: { filterId: string; cases: Record<string, DqeQueryModeCase> };
  filterBindings?: Record<string, DqeFilterBinding>;
  paramBindings?: Record<
    string,
    | { target: 'dimension'; queryField: string }
    | ({ target: 'time'; window: TimeWindow } & ObjectTimeTarget)
  >;
}

/**
 * 页面查询定义:以 `language` 为判别符的判别联合(ADR-0034)。
 */
export type PageQuery = DqeQueryDefinition;

export function isDqeQueryDefinition(query: unknown): query is DqeQueryDefinition {
  return (
    typeof query === 'object' &&
    query !== null &&
    (query as { language?: unknown }).language === 'dqe'
  );
}

/** 统一运行时交给数据网关的一次确定性 DQE 执行请求(生效查询的 dqe 分支)。 */
export interface DqeEffectiveQuery {
  /** Internal whole-period plan; consumed before sending monthly DQE requests. */
  periodAggregation?: PeriodAggregationCase;
  language: 'dqe';
  /** Internal execution proof of an explicitly empty authorized membership, never a cleared control. */
  matchNone?: true;
  /** Internal bounded composition recovery; never part of the DQE wire body. */
  resultPolicy?: 'display';
  body: DqeRequestBody;
  fieldMappings: Record<string, QueryDataSourceFieldDefinition>;
  /** Omitted match preserves literal substring search; equals uses native dimension equality. */
  search?: { queryFields: string[]; query: string; match?: 'equals' };
  pagination?: {
    offset: number;
    limit: number;
  };
  /** 服务端排序(ADR-0086):数组序即优先级。 */
  sort?: Array<{ queryField: string; direction: 'asc' | 'desc' }>;
  /** Business predicates before table-local narrowing; filterValues remains the complete legacy view. */
  bindingValues?: DqeEffectiveQuery['filterValues'];
  /** Additional table predicates narrow the already-bound business query. */
  tableFilters?: DqeEffectiveQuery['filterValues'];
  filterValues: Array<
    | {
        target: 'dimension';
        queryField: string;
        values: Array<string | number>;
        operator?: '=' | '!=';
      }
    | {
        target: 'time';
        queryField?: string;
        valueFormat?: ObjectTimeFormat;
        value: TimeRangeValue;
        period?: QueryPeriod;
      }
    | {
        target: 'metricRange';
        metric: string;
        from?: number;
        to?: number;
      }
    /** 表头筛选:区间端点各自可缺席,`>=` / `<=` 由端点存在与否决定。 */
    | {
        target: 'dimensionRange';
        queryField: string;
        from?: string;
        to?: string;
      }
  >;
}

/**
 * 生效查询:与 PageQuery 同一判别符的判别联合(ADR-0034)。
 */
export type EffectiveQuery = DqeEffectiveQuery;
