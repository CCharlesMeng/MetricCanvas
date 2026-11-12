import { describe, expect, it } from 'vitest';
import document from '../../../pages/capabilities/table/paged-join-search.json';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, EffectiveQuery, TableQueryView } from '@metriccanvas/page/internal';
import { createContractPreviewGateway } from '../../../apps/playground/fixtures/contract-closure-search';
import { createSourceProgram, defaultSourceView, initialFilterValues } from '../src/runtime';

const root = 'contract-closure-joined', now = new Date('2026-11-11T00:00:00+08:00');
async function read(patch: Partial<TableQueryView> = {}, complete = false) {
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, calls: EffectiveQuery[] = [], base = createContractPreviewGateway();
  const program = createSourceProgram(page, { now, gateway: { async fetchData(query, context, signal) {
    calls.push(structuredClone(query)); return base.fetchData(query, context, signal);
  } } });
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({ roots: [root], conditions: initialFilterValues(page.filters ?? [], now),
      views: new Map([[root, { ...defaultSourceView(page, root), ...patch }]]), purpose: complete ? 'complete' : 'screen' })) {
      if (update.sourceId === root) snapshot = update.snapshot;
    }
  } finally { program.dispose(); }
  return { snapshot, calls };
}

describe('query pagedJoin member-owned search', () => {
  it('selects the default B page without a search', async () => {
    const { snapshot, calls } = await read();
    expect(snapshot).toMatchObject({ status: 'ready', totalCount: 36 });
    if (snapshot?.status !== 'ready') throw Error('ready');
    expect(snapshot.rows[0]['contract-code']).toBe('HT-202611-0036');
    expect(calls[0].fieldMappings).toHaveProperty('eflow-create-time');
    expect(calls).toHaveLength(2);
  });
  it('searches the complete A scope while reading only one ten-row page and its B supplement', async () => {
    const { snapshot, calls } = await read({ search: { fields: ['contract-code'], query: '00' }, pageIndex: 1 });
    expect(snapshot).toMatchObject({ status: 'ready', totalCount: 36 });
    if (snapshot?.status !== 'ready') throw Error('ready');
    expect(snapshot.rows.map(row => row['contract-code'])).toEqual(Array.from({ length: 10 }, (_, index) => `HT-202611-00${index + 11}`));
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ search: { queryFields: ['合同编码'], query: '00' }, pagination: { offset: 10, limit: 10 } });
    expect(calls[0].sort).toEqual([{ queryField: '合同ID', direction: 'asc' }]);
    expect(calls[1].search).toBeUndefined();
    expect(calls[1].pagination?.limit).toBe(10);
    expect(calls.every(query => query.filterValues.some(filter => filter.target === 'time'))).toBe(true);
  });
  it('finds an off-page contract, preserves equals matching and skips B for no matches', async () => {
    const found = await read({ search: { fields: ['contract-code'], query: '0012' } });
    expect(found.snapshot).toMatchObject({ status: 'ready', totalCount: 1, rows: [{ 'contract-code': 'HT-202611-0012' }] });
    const exact = await read({ search: { fields: ['contract-code'], query: 'HT-202611-0012', match: 'equals' } });
    expect(exact.snapshot).toMatchObject({ status: 'ready', totalCount: 1 });
    expect(exact.calls[0].search?.match).toBe('equals');
    const missing = await read({ search: { fields: ['contract-code'], query: 'missing' } });
    expect(missing.snapshot).toMatchObject({ status: 'empty', totalCount: 0 });
    expect(missing.calls).toHaveLength(1);
  });
  it('exports all matching A pages with the same search and without B ordering', async () => {
    const { snapshot, calls } = await read({ search: { fields: ['contract-code'], query: '00' } }, true);
    expect(snapshot).toMatchObject({ status: 'ready', totalCount: 36 });
    if (snapshot?.status !== 'ready') throw Error('ready');
    expect(snapshot.rows).toHaveLength(36);
    expect(calls.filter(query => query.search).map(query => query.pagination?.offset)).toEqual([0, 10, 20, 30]);
    expect(calls).toHaveLength(8);
  });
  it('keeps A candidates inside the search scope and refuses B candidates during the search', async () => {
    const parsed = parsePage(document); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const queries: EffectiveQuery[] = [], base = createContractPreviewGateway();
    const program = createSourceProgram(parsed.page, { now, gateway: {
      fetchData: base.fetchData,
      async fetchColumnCandidates(request, context, signal) {
        queries.push(request.query); return base.fetchColumnCandidates!(request, context, signal);
      }
    } });
    const request = { sourceId: root, conditions: initialFilterValues(parsed.page.filters ?? [], now),
      view: { ...defaultSourceView(parsed.page, root), search: { fields: ['contract-code'], query: '0012' } } };
    try {
      expect(await program.readColumnCandidates({ ...request, field: 'contract-type' })).toMatchObject({ kind: 'values', totalCount: 1 });
      expect(queries[0].search).toEqual({ queryFields: ['合同编码'], query: '0012' });
      await expect(program.readColumnCandidates({ ...request, field: 'owner-name' })).rejects.toThrow('搜索期间');
      expect(queries).toHaveLength(1);
    } finally { program.dispose(); }
  });
});
