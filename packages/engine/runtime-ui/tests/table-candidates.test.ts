import { expect, it, vi } from 'vitest';
import fixture from '../../../../pages/table-column-candidates.json';
import { parsePage } from '@metriccanvas/page';
import { orchestrate } from '../../runtime/src/orchestrator';
import type { FilterValue } from '@metriccanvas/data-execution/runtime';
import { createTableController } from '../src/table-controller';

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
