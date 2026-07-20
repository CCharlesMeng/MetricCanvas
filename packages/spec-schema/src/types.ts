/**
 * 领域语言类型。命名与 CONTEXT.md 词汇表一一对应:
 * PageSpec=页面规格 StructuredQuery=结构化查询 EffectiveQuery=生效查询
 * DataSnapshot=数据快照 CatalogSnapshot=元数据快照
 */

/** 页面规格:描述一个看板页面的结构化声明式文档 */
export interface PageSpec {
  specVersion: string;
  id: string;
  title: string;
  description?: string;
  layout: GridLayout;
  widgets: Widget[];
}

/** 12 列网格布局 */
export interface GridLayout {
  type: 'grid';
  columns: 12;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 结构化查询:指标+维度+筛选+粒度,规格中不出现查询语句字符串 */
export interface StructuredQuery {
  metrics: string[];
  dimensions?: string[];
  granularity?: string;
  filters?: { subscribe: string[] };
}

/** 一期组件集之一:指标卡(切片1 唯一组件,后续切片扩展联合类型) */
export interface MetricCardWidget {
  id: string;
  type: 'metricCard';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  display?: MetricCardDisplay;
}

/** 指标卡展示配置(字段范围来自《组件分析.md》§2.1) */
export interface MetricCardDisplay {
  unit?: string;
  prefix?: string;
  thousandsSeparator?: boolean;
}

export type Widget = MetricCardWidget;

/** 生效查询:结构化查询 × 订阅筛选器当前值(切片1 无筛选器,conditions 恒空) */
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

export type Row = Record<string, string | number | null>;

/** 数据快照:查询编排后分发给组件的数据包,含数据行与查询状态 */
export type DataSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; rows: Row[] }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } };

/** 元数据快照:表服务指标/维度目录的版本化副本(语义校验参照,切片3 落地) */
export interface CatalogSnapshot {
  syncedAt: string;
  metrics: Array<{ code: string; name: string }>;
  dimensions: Array<{ code: string; name: string }>;
}

/** 校验错误分型:SCHEMA_ERROR=规格写错;METRIC_GAP=需求信号,走 metric-gap issue */
export type ErrorType = 'SCHEMA_ERROR' | 'METRIC_GAP';

export interface TypedError {
  type: ErrorType;
  /** JSON Pointer 定位,如 "/widgets/0/position" */
  path: string;
  message: string;
}
