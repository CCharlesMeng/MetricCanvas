import { expect, it, vi } from 'vitest';
import document from '../../../../pages/capabilities/table/paged-join-search.json';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, EffectiveQuery } from '@metriccanvas/page/internal';
import { createContractPreviewGateway } from '../../../../apps/playground/fixtures/contract-closure-search';
import { initialFilterValues } from '../../../../packages/data-execution/src/runtime';
import { orchestrate } from '../../runtime/src/orchestrator';
import { createTableController } from '../src/table/controller';

it('pauses B ordering during A search, paginates the search, and atomically restores B default on clear', async () => {
  const parsed = parsePage(document); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, table = page.sections[0].components.find(component => component.type === 'table');
  if (table?.type !== 'table') throw Error('table');
  const calls: EffectiveQuery[] = [], base = createContractPreviewGateway();
  const stream = orchestrate(page, { fetchColumnCandidates: base.fetchColumnCandidates, async fetchData(query, context, signal) {
    calls.push(structuredClone(query)); return base.fetchData(query, context, signal);
  } });
  const stop = stream.subscribe(() => {}), controller = createTableController(page, () => stream, () => {}, () => initialFilterValues(page.filters ?? []));
  const root = table.data.main;
  function snapshot(): DataSnapshot | undefined { return stream.captureRawSnapshots().get(root); }
  try {
    await vi.waitFor(() => expect(snapshot()).toMatchObject({ status: 'ready', totalCount: 36 }));
    controller.candidateBinding(table).oncandidateopen('owner-name', true);
    await vi.waitFor(() => expect(controller.candidateBinding(table).columnCandidates['owner-name'].status).toBe('ready'));
    controller.page(table, 1);
    await vi.waitFor(() => expect(snapshot()).toMatchObject({ status: 'ready', rows: [{ 'contract-code': 'HT-202611-0026' }, ...Array.from({length:9},()=>expect.anything())] }));
    const beforeSearch = calls.length;
    controller.search(table, '00');
    expect(() => controller.syncCandidates()).not.toThrow();
    expect(stream.getQueryView(root)).toMatchObject({ pageIndex: 0, sort: [], search: { query: '00' } });
    expect(controller.render(table).pausedFields).toContain('eflow-create-time');
    await vi.waitFor(() => expect(calls).toHaveLength(beforeSearch + 2));
    expect(calls[beforeSearch].search?.queryFields).toEqual(['合同编码']);
    controller.sort(table, [{ field: 'eflow-create-time', direction: 'asc' }]);
    expect(controller.render(table).operationNotice).toContain('搜索期间');
    expect(stream.getQueryView(root)?.sort).toEqual([]);
    controller.page(table, 1);
    await vi.waitFor(() => expect(calls).toHaveLength(beforeSearch + 4));
    expect(stream.getQueryView(root)).toMatchObject({ pageIndex: 1, search: { query: '00' } });
    const beforeClear = calls.length;
    controller.search(table, '');
    expect(stream.getQueryView(root)).toMatchObject({ pageIndex: 0, sort: [{ field: 'eflow-create-time', direction: 'desc' }] });
    expect(controller.render(table).pausedFields).toEqual([]);
    await vi.waitFor(() => {
      const restored = snapshot();
      expect(restored?.status).toBe('ready');
      if (restored?.status === 'ready') expect(restored.rows[0]['contract-code']).toBe('HT-202611-0036');
    });
    expect(calls.length - beforeClear).toBeLessThanOrEqual(2);
    expect(calls.slice(beforeClear).every(query => query.search === undefined)).toBe(true);
    expect(controller.render(table).operationNotice).toBeUndefined();
  } finally { controller.dispose(); stop(); }
});
