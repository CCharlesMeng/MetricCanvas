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

/** 统一运行时交给数据网关的一次确定性 DQE 执行请求。 */
export interface EffectiveQuery {
  language: 'dqe';
  body: DqeRequestBody;
  fieldMappings: Record<string, QueryFieldDefinition>;
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
