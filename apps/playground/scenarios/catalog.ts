import type { PlaygroundComponentType } from './components';

export type ComponentType = PlaygroundComponentType;
export type DataTopic = 'sources' | 'conditions' | 'relationships' | 'interactions' | 'results' | 'output';
export type LayoutTopic = 'dashboard' | 'report' | 'sections' | 'containers';
export interface Scene {
  id: string;
  title: string;
  owner: `components/${ComponentType}` | `data/${DataTopic}` | `layouts/${LayoutTopic}`;
  components: ComponentType[];
  topics: DataTopic[];
  layouts?: LayoutTopic[];
  pages: string[];
  question: string;
  isolateComponents?: boolean;
}

/** Only recommended learning scenarios need an index. Page discovery remains automatic. */
export const scenes: readonly Scene[] = [
  { id: 'table-presentation', title: '表格呈现、表头与序号', owner: 'components/table', components: ['table'], topics: ['results'],
    pages: ['table-tiny-os', 'table-toolbar-demo', 'table-row-number', 'table-missing-cell-actions'],
    question: '怎样组织列、合并表头，并保持排序后的序号与导出一致？' },
  { id: 'table-search', title: '表格搜索与列筛选', owner: 'components/table', components: ['table'], topics: ['results', 'conditions'],
    pages: ['table-search-options-demo', 'table-column-candidates'],
    question: '按哪个字段查找？候选搜索和表格过滤分别影响什么？' },
  { id: 'record-selection', title: '点击记录联动下游数据', owner: 'data/interactions', components: ['table'], topics: ['interactions', 'conditions'],
    pages: ['table-cell-selection'], question: '点击区域写入什么筛选，下游哪些查询重新执行？' },
  { id: 'record-detail', title: '打开记录详情', owner: 'data/interactions', components: ['table', 'metricCard'], topics: ['interactions', 'relationships'],
    pages: ['table-detail-overlay'], question: '详情来自当前快照还是独立查询，空结果怎样呈现？' },
  { id: 'child-records', title: '展开父行关联明细', owner: 'components/table', components: ['table'], topics: ['interactions', 'relationships'],
    pages: ['table-row-expansion-inline', 'table-row-expansion-query', 'table-hierarchy-selection'], question: '父行怎样关联子记录？不同父行的分页和查询是否独立？' },
  { id: 'multiple-sources', title: '多查询组合与全局结果', owner: 'data/relationships', components: ['table'], topics: ['relationships', 'results'],
    pages: ['multi-query-table', 'record-join-demo', 'decision-opinion-details', 'multi-source-table'], question: '按键补列与逐行拼接有什么区别，排序和分页覆盖哪份结果？' },
  { id: 'ioc-header', title: '页面级筛选与 IOC 页头', owner: 'components/iocHeader', components: ['iocHeader'], topics: ['conditions', 'sources'],
    pages: ['ioc-header-demo', 'ioc-header-business', 'ioc-header-models', 'ioc-header-groups', 'ioc-header-incentives', 'ioc-header-currency', 'ioc-header-months', 'ioc-header-unconfigured', 'ioc-header-standard', 'ioc-header-dense', 'ioc-header-detail', 'ioc-header-time', 'ioc-header-inputs', 'ioc-header-selection'],
    question: '页面级条件如何影响业务查询，候选缺失时哪些查询等待？' },
  { id: 'time-conditions', title: '期间、候选与可信数据期', owner: 'data/conditions', components: [], topics: ['conditions'],
    pages: ['ioc-header-overview-demo', 'ioc-header-detail-demo', 'ioc-header-month-set-demo', 'ioc-header-time-modes-demo', 'ioc-header-time-presets-demo', 'ioc-header-availability-demo', 'ioc-header-calendar-window-demo'],
    question: '时间控件、已应用期间、候选与查询口径怎样对应？' },
  { id: 'business-conditions', title: '业务候选、层级与金额', owner: 'data/conditions', components: [], topics: ['conditions'],
    pages: ['ioc-header-business-options-demo', 'ioc-header-business-tree-demo', 'ioc-header-business-detail-demo', 'ioc-header-dense-filter-demo', 'ioc-header-currency-demo'],
    question: '候选、层级代码、币种与金额范围怎样进入查询？' },
  { id: 'report-time', title: '报告页头与时间联动', owner: 'components/reportHeader', components: ['reportHeader'], topics: ['conditions', 'sources'], layouts: ['report'],
    pages: ['report-date-filter-example', 'dashboard-period-filter'], question: '报告标题和查询怎样消费同一份已应用时间？' },
  { id: 'local-filter', title: '局部筛选驱动多个消费者', owner: 'data/conditions', components: ['filterGroup', 'compositeCard', 'lineChart', 'metricCard', 'table'], topics: ['conditions', 'interactions', 'relationships'],
    pages: ['filter-group-page', 'filter-group-parallel-selects', 'filter-group-state-page', 'query-mode-chart-demo'],
    question: '局部条件怎样影响图表和指标，未订阅的来源为什么保持不变？' },
  { id: 'visibility', title: '条件显隐与操作资格', owner: 'data/conditions', components: ['button'], topics: ['conditions', 'interactions'],
    pages: ['page-visibility-region-linkage', 'page-visibility-inputs', 'page-visibility-report'], question: '条件如何控制显示和操作，权限事实未就绪时会发生什么？' },
  { id: 'charts', title: '图表字段与高级呈现', owner: 'components/barChart', components: ['barChart', 'lineChart', 'pieChart', 'mapChart'], topics: ['sources'],
    pages: ['chart-echarts-option-page', 'bar-width-defaults', 'chart-local-filter-page', 'region-map'], question: '类别、时间与度量怎样绑定，呈现设置是否改变数据语义？' },
  { id: 'metric-values', title: '指标格式与构成关系', owner: 'components/metricCard', components: ['metricCard'], topics: ['sources', 'relationships'],
    pages: ['metric-card-equation', 'local-authoring-knowledge-demo'], question: '指标展示格式与数值口径怎样区分，构成关系怎样呈现？' },
  { id: 'containers', title: 'Tab 与组合卡组织内容', owner: 'components/tabContainer', components: ['tabContainer', 'compositeCard'], topics: ['interactions', 'relationships'], layouts: ['containers', 'dashboard', 'report'],
    pages: ['tab-mixed-content', 'tab-mixed-content-report', 'tab-url-initialization'], question: '组件如何组合，切换 Tab 何时查询，访问过的面板怎样保留？' },
  { id: 'export', title: '导出当前条件下的结果', owner: 'data/output', components: ['reportHeader', 'table'], topics: ['output', 'results'], layouts: ['report'],
    pages: ['report-pdf-export', 'report-png-export', 'report-png-long-export', 'report-export-scale-fallback', 'table-toolbar-demo'],
    question: 'Excel 完整匹配结果与报告整页输出分别包含什么？' },
  { id: 'summary', title: '基于关联数据生成 AI 总结', owner: 'components/aiSummary', components: ['aiSummary'], topics: ['output', 'relationships'], layouts: ['report'],
    pages: ['report-ai-summary'], question: '总结使用哪些数据，切换条件后的请求和缓存怎样处理？' },
  { id: 'query-results', title: '查询窗口与结果处理', owner: 'data/results', components: ['table', 'metricCard', 'lineChart'], topics: ['results', 'sources'],
    pages: ['query-result-where-page', 'query-numeric-tolerance'], question: '结果过滤消费当前窗口还是完整行集，非法数值怎样处理？' },
  { id: 'navigation', title: '跨页传值与 URL 初始化', owner: 'data/output', components: ['button', 'text', 'tabContainer'], topics: ['output', 'interactions'],
    pages: ['ioc-header-navigation-source-demo', 'ioc-header-navigation-list-demo', 'ioc-header-navigation-detail-demo', 'ioc-content-navigation', 'tab-url-source', 'tab-url-initialization', 'demo', 'sales-detail'],
    question: '哪些条件被显式传递，目标页怎样恢复，来源状态是否受影响？' },
  { id: 'headings', title: '布局形态与分区标题', owner: 'layouts/sections', components: ['text'], topics: [], layouts: ['dashboard', 'report', 'sections'],
    pages: ['dashboard-title-styles', 'report-title-styles', 'empty-state-showcase'], question: '页面外框、分区容器和组件标题各自控制哪一层？' },
  { id: 'foundations', title: '基础组件与共享内联数据', owner: 'data/sources', components: ['gauge', 'rankingCard', 'rankingDetailCard', 'keyValuePanel', 'categoryBreakdown', 'fieldText'], topics: ['sources', 'relationships'], layouts: ['dashboard', 'sections'], isolateComponents: true,
    pages: ['component-foundations'], question: '同一份内联记录怎样供给排行、分类明细、信息面板与长文本？' }
];

export const pageSearchInputs: Readonly<Record<string, string>> = {
  'ioc-header-navigation-list-demo': 'origin=专题直接入口',
  'ioc-header-navigation-detail-demo': 'project-id=P-001&project-name=示例项目甲&origin=专题直接入口&month=2026-09'
};

export const sceneCompanions: Readonly<Record<string, { title: string; href: string }[]>> = {
  'ioc-header': [{ title: '完整页头专题与能力一览', href: '/ioc-header' }, { title: '候选异常与只读状态', href: '/ioc-header-review' }],
  'time-conditions': [{ title: '时间专题', href: '/ioc-header?topic=time' }],
  'business-conditions': [{ title: '业务筛选专题', href: '/ioc-header?topic=business' }]
};
