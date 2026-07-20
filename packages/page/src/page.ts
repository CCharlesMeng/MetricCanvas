import type { StructuredQuery } from './query';

/**
 * 看板页面 (Dashboard Page):平台的聚合根与核心资产,
 * 以严格声明式文档形式存在,同一性由 id 承载(ADR-0007)。
 * 加载得到的是不可信文档(unknown),通过 validate 后才可视为 Page。
 */
export interface Page {
  formatVersion: string;
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
