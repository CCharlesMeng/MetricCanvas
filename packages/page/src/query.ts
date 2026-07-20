/**
 * 结构化查询 (Structured Query):看板页面中声明数据需求的形态,
 * 指标+维度+筛选+粒度组成的对象,页面文档中不出现查询语句字符串。
 */
export interface StructuredQuery {
  metrics: string[];
  dimensions?: string[];
  granularity?: string;
  filters?: { subscribe: string[] };
}

/**
 * 生效查询 (Effective Query):结构化查询 × 订阅筛选器当前值合成后的最终查询,
 * 是真正发往数据服务的查询。切片1 尚无筛选状态,conditions 恒空。
 */
export interface EffectiveQuery {
  metrics: string[];
  dimensions?: string[];
  granularity?: string;
  conditions: FilterCondition[];
}

export interface FilterCondition {
  dimension: string;
  operator: 'eq' | 'in' | 'between';
  value: string | number | Array<string | number>;
}
