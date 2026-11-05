import { expect, it, vi } from 'vitest';
import fixture from '../../../../pages/capabilities/table/table-column-candidates.json';
import { parsePage } from '@metriccanvas/page';
import { orchestrate } from '../../runtime/src/orchestrator';
import type { FilterValue } from '@metriccanvas/data-execution/runtime';
import { createTableController } from '../src/table/controller';
import comparisonFixture from '../../../../pages/capabilities/data/period-comparison/period-comparison-query-page.json';
import { createQueryComparisonPreview } from '../../../../apps/playground/fixtures/query-comparison-gateway';
import { initialFilterValues } from '../../runtime/src/filter-state';

it('reads candidates from the owning member despite a failed comparison supplement', async () => {
  const parsed = parsePage(comparisonFixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections.flatMap(section => section.components).find(component => component.type === 'table');
  if (!table || table.type !== 'table') throw Error('table');
  const preview = createQueryComparisonPreview('error');
  const context = { displayInputs: () => preview.displayInputs.getSnapshot(), now: new Date('2026-10-30T12:00:00+08:00') };
  const conditions = initialFilterValues(parsed.page.filters ?? [], context.now, context.displayInputs());
  const stream = orchestrate(parsed.page, preview.dataGateway, undefined, undefined, undefined, context);
  const stop = stream.subscribe(() => {}), controller = createTableController(parsed.page, () => stream, () => {}, () => conditions,
    () => ({ now: context.now, displayInputs: context.displayInputs() }));
  try {
    await vi.waitFor(() => expect(stream.captureRawSnapshots().get(table.data.main)?.status).toBe('error'));
    controller.candidateBinding(table).oncandidateopen('customer', true);
    await vi.waitFor(() => expect(controller.candidateBinding(table).columnCandidates.customer?.totalCount).toBe(23));
    expect(controller.candidateBinding(table).columnCandidates.customer.status).toBe('ready');
    expect(stream.captureRawSnapshots().get(table.data.main)?.status).toBe('error');
  } finally { controller.dispose(); stop(); }
});

it('preloads actual main-field IDs, including explicit bindings, without opening a filter', async () => {
  const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections.flatMap(section => section.components).find(component => component.type === 'table'); if (!table || table.type !== 'table') throw Error('table');
  const column = table.props.columns.find(value => 'field' in value && value.field === 'office');
  if (!column || !('field' in column)) throw Error('office');
  column.field = { data: 'main', field: 'office' };
  const stream = orchestrate(parsed.page, { fetchData: async () => { throw Error('inline must not query'); } });
  const stop = stream.subscribe(() => {}), controller = createTableController(parsed.page, () => stream, () => {});
  try {
    controller.candidateBinding(table).oncandidatepreloadvisible(true);
    await vi.waitFor(() => expect(controller.candidateBinding(table).columnCandidates.office?.totalCount).toBe(64));
    expect(controller.candidateBinding(table).columnCandidates.office.status).toBe('ready');
  } finally { controller.dispose(); stop(); }
});

it('refreshes only affected candidates and isolates same-source table state', async () => {
  const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, tables = page.sections.flatMap(section => section.components).filter(component => component.type === 'table');
  const first = tables[0], second = tables[1];
  if (first.type !== 'table' || second.type !== 'table') throw Error('expected tables');
  const stream = orchestrate(page, { fetchData: async () => { throw Error('inline must not query'); } });
  const stop = stream.subscribe(() => {});
  const conditions = new Map<string, FilterValue>();
  const controller = createTableController(page, () => stream, () => {}, () => conditions);
  try {
    controller.candidateBinding(first).oncandidateopen('office', true);
    const snapshot = () => controller.candidateBinding(first).columnCandidates.office;
    await vi.waitFor(() => expect(snapshot()?.totalCount).toBe(64));
    const before = snapshot();
    controller.header(first, 'office', { mode: 'select', values: ['办事处64'] });
    controller.page(first, 3); controller.sort(first, [{ field: 'office', direction: 'desc' }]);
    conditions.set('unrelated', { type: 'dimension', dimension: 'unrelated', values: ['X'] });
    controller.syncCandidates(); expect(snapshot()).toBe(before);
    controller.header(first, 'region', { mode: 'select', values: ['华北'] });
    controller.syncCandidates();
    await vi.waitFor(() => expect(snapshot()?.totalCount).toBe(32));
    expect(controller.headers(first).office).toEqual({ mode: 'select', values: ['办事处64'] });
    expect(controller.headers(second)).toEqual({});
    expect(snapshot().candidates.every(value => Number(String(value.value).slice(-2)) % 2 === 1)).toBe(true);
  } finally { controller.dispose(); stop(); }
});

it('opens union candidates when ordinary member snapshots are intentionally absent', async () => {
  const { default: document } = await import('../../../page/fixtures/contract-valid/paged-union-page.json');
  const { createUnionPreview } = await import('../../../../apps/playground/fixtures/decision-opinion/union-gateway');
  const parsed = parsePage(document); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, table = page.sections[0].components[0]; if (table.type !== 'table') throw Error('table');
  const stream = orchestrate(page, createUnionPreview({ generatedCount: 0 }).dataGateway);
  const stop = stream.subscribe(() => {});
  const controller = createTableController(page, () => stream, () => {});
  try {
    controller.candidateBinding(table).oncandidateopen('businessType', true);
    await vi.waitFor(() => expect(controller.candidateBinding(table).columnCandidates.businessType?.totalCount).toBe(2));
    expect(stream.captureRawSnapshots().has('contract')).toBe(false);
    expect(stream.captureRawSnapshots().has('commercial')).toBe(false);
  } finally { controller.dispose(); stop(); }
});

it('shows the existing notice area for union failures while retaining ordinary empty-state behavior', async () => {
  const { default: document } = await import('../../../page/fixtures/contract-valid/paged-union-page.json');
  const { componentDataNotices } = await import('../src/component-render');
  const parsed = parsePage(document); if (!parsed.ok) throw Error('fixture');
  const table = parsed.page.sections[0].components[0]; if (table.type !== 'table') throw Error('table');
  const controller = createTableController(parsed.page, () => null, () => {});
  const binding = controller.binding(table, { filterOptions: {}, oncellselect() {} });
  try {
    expect(componentDataNotices(table, { status: 'error', error: { code: 'DQE_TIMEOUT', message: 'failed' } }, new Map(), binding)).toEqual(['多来源数据加载失败，请刷新重试。']);
    expect(componentDataNotices(table, { status: 'empty', totalCount: 0 }, new Map(), binding)).toEqual([]);
    expect(componentDataNotices(table, { status: 'error', error: { code: 'DQE_TIMEOUT', message: 'failed' } }, new Map())).toEqual([]);
  } finally { controller.dispose(); }
});
