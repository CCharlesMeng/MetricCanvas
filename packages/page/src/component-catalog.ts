import type { Component } from './page';

export interface ComponentCatalogEntry {
  type: Component['type'];
  purpose: string;
  chooseWhen: string[];
  dataShape: string;
  requiredProps: string[];
  defaultSpan: number;
}

/**
 * 领域 DSL 的组件能力目录。它描述“何时选、需要什么数据”，供 Agent 组合页面；
 * 不是运行时组件注册表，也不允许 Agent 越过 Page Schema 发明新组件。
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = [
  {
    type: 'reportHeader',
    purpose: '表达页面标题、说明、时间点与标签',
    chooseWhen: ['任何完整看板页面的开头'],
    dataShape: '不绑定页面数据源',
    requiredProps: ['title'],
    defaultSpan: 12
  },
  {
    type: 'metricCard',
    purpose: '突出一个或少量核心指标的当前值',
    chooseWhen: ['总额、数量、完成率、KPI、核心指标'],
    dataShape: '单行或少量行；至少一个 metric 字段',
    requiredProps: ['rows[].label', 'rows[].valueField'],
    defaultSpan: 3
  },
  {
    type: 'barChart',
    purpose: '比较离散类别之间的大小或展示分类分布',
    chooseWhen: ['区域/渠道/产品对比', '分类分布', '多指标类别比较'],
    dataShape: '一个 dimension 类别字段 + 一个或多个 metric 字段',
    requiredProps: ['categoryField', 'series[].field'],
    defaultSpan: 6
  },
  {
    type: 'lineChart',
    purpose: '展示指标随时间或有序维度的变化趋势',
    chooseWhen: ['趋势、走势、按日/月变化、时间序列'],
    dataShape: '一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段',
    requiredProps: ['xField', 'series[].field'],
    defaultSpan: 8
  },
  {
    type: 'pieChart',
    purpose: '展示少量类别对整体的占比或构成',
    chooseWhen: ['占比、构成、份额，且类别数量较少'],
    dataShape: '一个 dimension 类别字段 + 一个 metric 数值字段',
    requiredProps: ['categoryField', 'valueField'],
    defaultSpan: 4
  },
  {
    type: 'table',
    purpose: '展示需要逐行核对、排序或继续处理的明细',
    chooseWhen: ['明细、列表、字段较多、需要精确值'],
    dataShape: '一个或多个 dimension/metric 字段组成的多行记录',
    requiredProps: ['columns[].field'],
    defaultSpan: 12
  },
  {
    type: 'mapChart',
    purpose: '展示国家或省级地域分布',
    chooseWhen: ['明确要求中国/世界地图，且地域名称能映射到地图'],
    dataShape: '地域名称 dimension 字段 + 一个 metric 数值字段',
    requiredProps: ['nameField', 'valueField', 'map'],
    defaultSpan: 8
  },
  {
    type: 'rankingCard',
    purpose: '突出 Top N 或按指标排序的类别',
    chooseWhen: ['排行、排名、Top N、领先/落后对象'],
    dataShape: '名称 dimension 字段 + 一个 metric 数值字段，查询应声明排序和限制',
    requiredProps: ['nameField', 'valueField'],
    defaultSpan: 4
  },
  {
    type: 'text',
    purpose: '承载说明、口径提示或人工/AI 已确认的分析结论',
    chooseWhen: ['说明、提示、已确认结论；不能代替数据图表'],
    dataShape: '不绑定页面数据源',
    requiredProps: [],
    defaultSpan: 12
  }
] as const;

