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

/** 一期组件集之一:地图(单指标,按第一个维度的值给区域着色,可叠加散点) */
export interface MapChartWidget {
  id: string;
  type: 'mapChart';
  title?: string;
  position: WidgetPosition;
  query: StructuredQuery;
  display: MapChartDisplay;
  interactions?: WidgetInteraction[];
}

export interface MapChartDisplay {
  /** 底图:china=中国省级 | world=世界国家(geojson 静态资产随组件入库,无运行时网络依赖) */
  map: 'china' | 'world';
  /** 散点叠加:point=普通散点 | effect=涟漪散点;缺省不叠加。散点坐标取底图资产的区域中心点 */
  scatter?: 'point' | 'effect';
  /**
   * 维度值 → 底图区域名的声明式映射(如 "华东" → "上海市"),构造地图数据与点击索引时应用;
   * 未列出的维度值按原名匹配底图区域。纯数据映射,不是表达式(ADR-0003)
   */
  nameMap?: Record<string, string>;
}

/** 一期组件集之一:文本(标题/说明/带参跳转链接;无查询,不产生数据快照) */
export interface TextWidget {
  id: string;
  type: 'text';
  position: WidgetPosition;
  /** 标题文案 */
  heading?: string;
  /** 说明文案(静态纯文本,不允许表达式,ADR-0003) */
  body?: string;
  /** 带参跳转链接:与 navigate 声明同形态,链接参数经同一 URL 序列化机制携带筛选器当前值 */
  links?: TextLink[];
}

/**
 * 文本带参链接:形态与 navigate 声明对齐(page + carryFilters)。
 * 不支持 setFilters——文本无点击行上下文,取值占位无从解析。
 */
export interface TextLink {
  /** 链接文案 */
  label: string;
  /** 目标看板页面 id;存在性由 validate CLI 跨文档校验 */
  page: string;
  /** 携带的本页筛选器 id 列表,取其当前值写入目标页同名筛选器 */
  carryFilters?: string[];
}

/** 声明结构化查询、经查询编排产生数据快照的 widget(文本组件不在其中) */
export type DataWidget =
  | MetricCardWidget
  | BarChartWidget
  | LineChartWidget
  | PieChartWidget
  | TableWidget
  | MapChartWidget;

export type Widget = DataWidget | TextWidget;

/** 带交互声明的图表类 widget(校验器与壳对 interactions 的处理共用此判别) */
export type ChartWidget = BarChartWidget | LineChartWidget | PieChartWidget | MapChartWidget;

export function isChartWidget(widget: Widget): widget is ChartWidget {
  return (
    widget.type === 'barChart' ||
    widget.type === 'lineChart' ||
    widget.type === 'pieChart' ||
    widget.type === 'mapChart'
  );
}

/**
 * 文本组件无查询:编排取数与语义校验只面向数据 widget,分发处共用此判别。
 * "数据 widget"是代码层判别,不是领域概念,不入 CONTEXT.md 词汇表。
 */
export function isDataWidget(widget: Widget): widget is DataWidget {
  return widget.type !== 'text';
}
