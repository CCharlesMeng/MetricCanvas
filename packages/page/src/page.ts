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

/** 一期组件集之一:柱状图(展示配置面来自《组件分析.md》§2,PRD 定死) */
export interface BarChartWidget {
  id: string;
  type: 'barChart';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  display?: BarChartDisplay;
  /** 交互声明:事件如何作用于筛选状态,由运行时执行(组件纯渲染) */
  interactions?: WidgetInteraction[];
}

export interface BarChartDisplay {
  /** 多指标堆叠 */
  stacked?: boolean;
  /** 圆角柱 */
  rounded?: boolean;
  /** 横向条形(覆盖存量两个自定义水平条形组件的场景) */
  horizontal?: boolean;
  /** 双轴:第二个及之后的指标走右轴 */
  dualAxis?: boolean;
}

/** 一期组件集之一:折线图 */
export interface LineChartWidget {
  id: string;
  type: 'lineChart';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  display?: LineChartDisplay;
  interactions?: WidgetInteraction[];
}

export interface LineChartDisplay {
  /** 平滑曲线 */
  smooth?: boolean;
  /** 面积渐变 */
  areaGradient?: boolean;
  /** 多指标堆叠 */
  stacked?: boolean;
  /** 双轴:第二个及之后的指标走右轴 */
  dualAxis?: boolean;
}

/** 一期组件集之一:饼图(单指标,按第一个维度切分占比) */
export interface PieChartWidget {
  id: string;
  type: 'pieChart';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  display?: PieChartDisplay;
  interactions?: WidgetInteraction[];
}

export interface PieChartDisplay {
  /** 环形:内半径百分比(如 '55%');缺省为实心饼 */
  ring?: string;
  /** 引导线开关,缺省开 */
  labelLine?: boolean;
}

/** 一期组件集之一:表格(存量使用频率最高的重交互组件,《组件分析.md》§1.1) */
export interface TableWidget {
  id: string;
  type: 'table';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  /** 列定义清单,列序即展示序 */
  columns: TableColumn[];
  /** 每页行数,缺省 20;分页经运行时映射 @limit/@offset,盲翻设计(响应不返回总条数) */
  pageSize?: number;
}

/** 表格列定义:field 引用查询的维度或指标,展示与交互能力显式建模 */
export interface TableColumn {
  /** 数据快照中的行字段,须为本组件查询的维度或指标 code */
  field: string;
  /** 列头文案,缺省显示 field */
  title?: string;
  /** 列宽(px);缺省按内容自适应 */
  width?: number;
  /** 固定列:横向滚动时钉在左/右侧 */
  fixed?: 'left' | 'right';
  /** 可排序列:排序经运行时映射 @order(多列优先级) */
  sortable?: boolean;
  /** 表头筛选(widget 局部视图状态,不进页面筛选状态);列须为查询维度 */
  filterable?: TableHeaderFilter;
}

/** 表头筛选声明:对应存量 ti-head-filter 的两种真实用法 */
export interface TableHeaderFilter {
  /** select=下拉多选(候选项经数据网关实时查询)| dateRange=日期范围 */
  mode: 'select' | 'dateRange';
}

export type Widget = MetricCardWidget | BarChartWidget | LineChartWidget | PieChartWidget | TableWidget;

/** 带交互声明的图表类 widget(校验器与壳对 interactions 的处理共用此判别) */
export type ChartWidget = BarChartWidget | LineChartWidget | PieChartWidget;

export function isChartWidget(widget: Widget): widget is ChartWidget {
  return widget.type === 'barChart' || widget.type === 'lineChart' || widget.type === 'pieChart';
}
