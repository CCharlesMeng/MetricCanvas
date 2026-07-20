import type { FilterDeclaration } from './filter';
import type { WidgetInteraction } from './interaction';
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
  /** 页面级筛选器声明,共同构成筛选状态(联动唯一总线) */
  filters?: FilterDeclaration[];
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

/** 一期组件集之一:指标卡 */
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

/**
 * 一期组件集之一:柱状图。本切片(#5)引入最简形态以贯通页内下钻
 * (点击柱条经 interactions 回写筛选状态);ECharts 化与完整展示配置面归切片5(#6)。
 */
export interface BarChartWidget {
  id: string;
  type: 'barChart';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  /** 交互声明:事件如何作用于筛选状态,由运行时执行(组件纯渲染) */
  interactions?: WidgetInteraction[];
}

export type Widget = MetricCardWidget | BarChartWidget;
