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
}

import type { TimeRangeValue } from './filter';

/**
 * 生效查询 (Effective Query):结构化查询 × 订阅筛选器当前值合成后的最终查询,
 * 是真正发往数据服务的查询。conditions 来自订阅的维度筛选器,timeRange 来自
 * 订阅的时间范围筛选器(时间是数据服务的特殊轴:粒度在服务定义时固定,
 * 故不混入 conditions,由适配层单独翻译为时间字段约束)。
 */
export interface EffectiveQuery {
  metrics: string[];
  dimensions?: string[];
  aggregation?: string;
  granularity?: string;
  conditions: FilterCondition[];
  timeRange?: TimeRangeValue;
}

export interface FilterCondition {
  dimension: string;
  operator: 'eq' | 'in' | 'between';
  value: string | number | Array<string | number>;
}
