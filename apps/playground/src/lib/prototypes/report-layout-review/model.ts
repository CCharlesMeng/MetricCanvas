// THROWAWAY: five layout families, twelve alternatives, one PC review page.
// Same synthetic fixtures as the previous demonstration. No production styles changed.
import type { FieldDefinition, Row, MetricCardProps, TableProps, RankingDetailCardProps, CategoryBreakdownProps } from '@metriccanvas/page/internal';
import source from '../../../../../../pages/temporary/report-layout-patterns-20261026/report-layout-patterns-1026.json';
import userReview from './user-review.json';
import userReviewSupplement from './user-review-supplement.json';

export interface Candidate { id: string; title: string; use: string; change: string; draft?: boolean }
export const groups = [
  { id: 'objects', number: '01', title: '对象与指标', question: '先看一个对象，还是逐项比较多个对象？', options: [
    { id: 'C1-A', title: '按对象聚合', use: '少量对象，各自包含几个核心指标。', change: '同一对象放在一张卡中，变化留在所属主值旁。' },
    { id: 'C1-B', title: '按指标对照', use: '需要逐项核对多个对象的差异。', change: '仅变化值用红绿：时长下降绿、上升红；工单量增加绿、减少红。本期值保持默认颜色。' }
  ] },
  { id: 'ranking', number: '02', title: '重点对象与解释', question: '更关注两组差异，还是逐行处理原因？', options: [
    { id: 'C2-A', title: '双组并列', use: '两组对象较少，原因简短，需要同时对照。', change: '保留现有详细排行；解释跟随每个对象。' },
    { id: 'C2-B', title: '原因随行的明细表', use: '逐个核对或处理对象，说明需要更多宽度。', change: '两组在同一表中，增加组别列，解释不脱离对象。' }
  ] },
  { id: 'detail', number: '03', title: '阶段与明细', question: '按对象横向核对，还是按阶段分别阅读？', options: [
    { id: 'C3-A', title: '一张分组表头表', use: '同一个对象的全部阶段需要同时核对。', change: '总量前置，阶段分组，叶子列有独立宽度。' },
    { id: 'C3-B', title: '阶段拆成相邻小表', use: '用户已决定不采用，仅保留原展示留档。', change: '不进入本轮采用清单，不作为默认推荐。' }
  ] },
  { id: 'composition', number: '04', title: '构成与精确值', question: '这一组重点审核密度、图文距离和颜色对应。', options: [
    { id: 'C4-A', title: '紧凑环图 + 右侧明细', use: '已有多个需要展示的构成主题，放在同一行比较。', change: '每张卡占部分行宽。本例沿用增长／下降两组样本收入；不为凑行新增业务主题。', draft: true },
    { id: 'C4-B', title: '窄卡环图 + 下方明细', use: '作为一张较窄的摘要卡，与其他主题并排。', change: '图表与明细上下组织，不把小数据拉成整行大卡。', draft: true },
    { id: 'C4-C', title: '横向条形图 + 精确值', use: '主要比较类别大小，类别名较长。', change: '图形负责比较大小；数量与占比在邻近明细中核对。' },
    { id: 'C4-D', title: '仅保留分类明细', use: '只有几行，读者主要核对精确值。', change: '去掉图形，直接给数量、占比和合计。' }
  ] },
  { id: 'reading', number: '05', title: '概览与明细', question: '按需切换，还是在正文中连续阅读？', options: [
    { id: 'C5-A', title: '概览 / 明细页签', use: '读者主动切换任务，不需要两者同时出现。', change: '概览默认可见；精确值通过页签打开。' },
    { id: 'C5-B', title: '趋势与明细连续展开', use: '用于连续阅读，趋势与数值需要同时核对。', change: '同主题上下相邻，明细始终可见。' }
  ] }
];
export const candidates: Candidate[] = groups.flatMap(group => group.options);
export const decisions = ['保留', '调整', '不采用'] as const;
export type Decision = typeof decisions[number];
export interface Review { decision?: Decision; note?: string }
export function initialReviews(): Record<string, Review> {
  return Object.fromEntries([...userReview, ...userReviewSupplement].map(entry => [entry.id, {
    decision: decisions.find(decision => decision === entry.decision), note: entry.note
  }]));
}
export function reviewLabel(decision: Decision | undefined): string {
  if (decision === '调整') return '已调整 · 待复核';
  if (decision === '不采用') return '不采用 · 留档';
  return decision ?? '待审核';
}

export function slot(rows: Row[], dimensions: string[], measures: string[]) {
  const fields: Record<string, FieldDefinition> = {};
  for (const field of dimensions) fields[field] = { type: 'string', role: 'dimension' };
  for (const field of measures) fields[field] = { type: 'number', role: 'measure' };
  return { main: { fields, snapshot: { status: 'ready' as const, rows } } };
}
export const history = slot(source.dataSources.history.source.rows, ['month'], ['tickets']);
export const stageData = slot(source.dataSources['stage-records'].source.rows, ['name'], ['total', 'in-count', 'in-hours', 'out-count', 'out-hours', 'return-count', 'return-hours']);
export const categoryRows = source.dataSources.categories.source.rows.map(row => ({ ...row, share: row.count / 60 * 100 }));
export const categoryData = slot(categoryRows, ['category'], ['count', 'share']);
export const growthData = slot(source.dataSources.growth.source.rows, ['name', 'note'], ['amount', 'change']);
export const declineData = slot(source.dataSources.decline.source.rows, ['name', 'note'], ['amount', 'change']);
export const rankingData = slot([
  ...source.dataSources.growth.source.rows.map(row => ({ ...row, group: '增长组' })),
  ...source.dataSources.decline.source.rows.map(row => ({ ...row, group: '下降组' }))
], ['name', 'note', 'group'], ['amount', 'change']);
export const objectData = [
  { title: '城市服务组', main: slot(source.dataSources['response-a'].source.rows, [], ['hours', 'delta']).main, compare: slot(source.dataSources['volume-a'].source.rows, [], ['tickets', 'delta']).main },
  { title: '企业服务组', main: slot(source.dataSources['response-b'].source.rows, [], ['hours', 'delta']).main, compare: slot(source.dataSources['volume-b'].source.rows, [], ['tickets', 'delta']).main }
];
export function objectProps(title: string): MetricCardProps {
  return { title, variant: 'compactSummary', rows: [
    { label: '平均响应时长', unit: '小时', valueField: { data: 'main', field: 'hours', format: 'number-1' }, changes: [{ label: '较上期', field: { data: 'main', field: 'delta', format: 'number-1-signed' }, unit: '小时', colorRule: { mode: 'sign', positive: 'red', negative: 'green' } }] },
    { label: '工单量', unit: '件', valueField: { data: 'compare', field: 'tickets', format: 'number-grouped' }, changes: [{ label: '较上期', field: { data: 'compare', field: 'delta', format: 'number-signed' }, unit: '件', tone: 'neutral' }] }
  ] };
}
export const matrixData = slot([
  { metric: '平均响应时长（小时）', city: '3.2', cityChange: '−0.4', company: '4.1', companyChange: '+0.2' },
  { metric: '工单量（件）', city: '1,200', cityChange: '+100', company: '800', companyChange: '−50' }
], ['metric', 'city', 'cityChange', 'company', 'companyChange'], []);
export const matrixProps: TableProps = { variant: 'reportCompact', fit: 'container', columns: [
  { field: 'metric', title: '指标', width: 220 },
  { kind: 'group', id: 'city', title: '城市服务组', children: [{ field: 'city', title: '本期', align: 'right' }, { field: 'cityChange', title: '较上期', align: 'right' }] },
  { kind: 'group', id: 'company', title: '企业服务组', children: [{ field: 'company', title: '本期', align: 'right' }, { field: 'companyChange', title: '较上期', align: 'right' }] }
] };
export function rankingProps(tone: 'positive' | 'negative'): RankingDetailCardProps {
  return { title: tone === 'positive' ? '重点增长对象' : '重点下降对象', variant: 'report', tone, nameField: 'name', valueField: 'amount', changeField: { data: 'main', field: 'change', format: 'percent-1' }, descriptionField: 'note', metricLabel: '本月收入（万元）' };
}
export const rankingTable: TableProps = { variant: 'reportCompact', fit: 'container', columns: [
  { field: 'group', title: '组别', width: 90 }, { field: 'name', title: '对象', width: 130 },
  { field: 'amount', title: '收入（万元）', width: 125, align: 'right' },
  { field: { data: 'main', field: 'change', format: 'percent-1' }, title: '环比', width: 95, align: 'right' },
  { field: 'note', title: '原因与跟进信息', width: 360 }
] };
export const stages = [{ id: 'in', name: '入库复核' }, { id: 'out', name: '出库复核' }, { id: 'return', name: '退货复核' }];
export function stageTable(id: string): TableProps {
  return { variant: 'reportCompact', fit: 'container', columns: [
    { field: 'name', title: '作业批次', width: 115 },
    { field: `${id}-count`, title: '参与人次', width: 80, align: 'right' },
    { field: { data: 'main', field: `${id}-hours`, format: 'number-1' }, title: '时长（小时）', width: 100, align: 'right' }
  ] };
}
export const groupedTable: TableProps = { variant: 'reportCompact', fit: 'container', columns: [
  { field: 'name', title: '作业批次', width: 130 },
  { field: { data: 'main', field: 'total', format: 'number-1' }, title: '累计时长（小时）', width: 140, align: 'right' },
  ...stages.map(stage => ({ kind: 'group' as const, id: stage.id, title: stage.name, children: stageTable(stage.id).columns.slice(1) }))
] };
export const breakdownProps: CategoryBreakdownProps = { categoryField: 'category', categoryLabel: '业务类型', swatches: true, columns: [
  { label: '数量（件）', field: 'count' }, { label: '占比', field: { data: 'main', field: 'share', format: 'percent-1' } }
] };
export function revenueComposition(title: string, rows: { name: string; amount: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const data = slot(rows.map(row => ({ category: row.name, count: row.amount, share: row.amount / total * 100 })), ['category'], ['count', 'share']);
  return { title, total, data };
}
export const revenueCompositions = [
  revenueComposition('增长组样本收入构成', source.dataSources.growth.source.rows),
  revenueComposition('下降组样本收入构成', source.dataSources.decline.source.rows)
];
export const revenueBreakdownProps: CategoryBreakdownProps = { ...breakdownProps, categoryLabel: '客户', columns: [
  { label: '收入（万元）', field: 'count' },
  { label: '占比', field: { data: 'main', field: 'share', format: 'percent-1' } }
] };
export const categoryTable: TableProps = { variant: 'reportCompact', fit: 'container', columns: [
  { field: 'category', title: '业务类型' }, { field: 'count', title: '数量（件）', align: 'right' },
  { field: { data: 'main', field: 'share', format: 'percent-1' }, title: '占比', align: 'right' }
] };
export const historyTable: TableProps = { variant: 'reportCompact', fit: 'container', columns: [
  { field: 'month', title: '月份' }, { field: 'tickets', title: '工单量（件）', align: 'right' }
] };
export const tableView = { pageIndex: 0, sort: [], headerFilters: {} };
