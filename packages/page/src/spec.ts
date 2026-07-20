import type { StructuredQuery } from './query';

/**
 * 页面规格 (Page Spec):描述一个看板页面的结构化声明式文档,平台的核心资产。
 * 页面是聚合根,规格是它的唯一真源;校验规则(schema + validate)是它的不变式。
 */
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
