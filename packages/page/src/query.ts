/**
 * 结构化查询 (Structured Query):看板页面中声明数据需求的形态,
 * 指标+维度+筛选+粒度组成的对象,页面文档中不出现查询语句字符串。
 */
export interface StructuredQuery {
  metrics: string[];
  dimensions?: string[];
  /** 聚合方式(如 sum/avg/count),作用于本查询全部指标;合法性依元数据快照按指标校验 */
  aggregation?: string;
  granularity?: string;
  filters?: { subscribe: string[] };
  /** 报告时间语义:以页面时间范围筛选器为锚点选取当前点或回看窗口 */
  time?: QueryTime;
  /** 静态排序规则,数组顺序即排序优先级 */
  orderBy?: OrderByRule[];
  /** 查询返回行数上限 */
  limit?: number;
}

/** 外部 DQE 请求项保持开放对象，数据网关只处理最外层 dsl_list 信封。 */
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
   * 页面数据源表示一个命名数据集，因此页面内恰好一项；
   * 数据网关可把多个逻辑查询透明合并为外部协议的多项 dsl_list。
   */
  dsl_list: [JsonObject];
}

export type DqeFilterBinding =
  | { target: 'dimension'; queryField: string }
  | { target: 'time' };

export interface DqeQueryDefinition {
  language: 'dqe';
  body: DqeRequestBody;
  /** 页面筛选器 id 到外部 DQE 语义位置的显式映射。 */
  filterBindings?: Record<string, DqeFilterBinding>;
}

export type PageQuery = StructuredQuery | DqeQueryDefinition;

export function isDqeQueryDefinition(query: PageQuery): query is DqeQueryDefinition {
  return 'language' in query && query.language === 'dqe';
}

import type { TimeRangeValue } from './filter';

export interface QueryTime {
  /** 须引用已声明且被本查询订阅的 timeRange 筛选器 */
  filter: string;
  window: TimeWindow;
}

/** 报告时间窗口:selected=所选范围 | point=所选范围终点 | lookback=从终点向前回看 */
export type TimeWindow =
  | { kind: 'selected' }
  | { kind: 'point'; anchor: 'to' }
  | {
      kind: 'lookback';
      anchor: 'to';
      previous: number;
      unit: 'day' | 'week' | 'month';
    };

/**
 * 生效查询 (Effective Query):结构化查询 × 订阅筛选器当前值 × 组件局部视图
 * 合成后的最终查询,是真正发往数据服务的查询。conditions 来自订阅的维度筛选器与
 * 表头筛选(后者是组件局部视图,不进页面筛选状态),timeRange 来自订阅的
 * 时间范围筛选器(时间是数据服务的特殊轴:粒度在服务定义时固定,
 * 故不混入 conditions,由适配层单独翻译为时间字段约束)。
 * limit/offset/orderBy 来自表格组件的局部视图(分页/排序),
 * 由适配层翻译为 @limit/@offset/@order。
 */
export interface EffectiveQuery {
  metrics: string[];
  dimensions?: string[];
  aggregation?: string;
  granularity?: string;
  conditions: FilterCondition[];
  timeRange?: TimeRangeValue;
  /** 每页行数;缺省不分页 */
  limit?: number;
  /** 跳过的行数;缺省 0 */
  offset?: number;
  /** 多列排序,数组序即优先级(第 1 项最先比较,映射 @order priority) */
  orderBy?: OrderByRule[];
  /** raw DQE 执行所需的外部协议与显式映射；旧结构化查询不含此字段。 */
  dqe?: EffectiveDqeQuery;
}

export interface EffectiveDqeQuery {
  body: DqeRequestBody;
  fieldMappings: Record<
    string,
    { queryField: string; type: import('./field').FieldType; role: import('./field').FieldRole }
  >;
  filterValues: Array<
    | { target: 'dimension'; queryField: string; values: Array<string | number> }
    | { target: 'time'; value: TimeRangeValue }
  >;
}

/** 单列排序规则;多列优先级由所在数组的顺序表达 */
export interface OrderByRule {
  /** 排序字段:查询的维度或指标 code */
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterCondition {
  dimension: string;
  operator: 'eq' | 'in' | 'between';
  value: string | number | Array<string | number>;
}
