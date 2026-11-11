import { describe, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { type EffectiveQuery, type DataSnapshot, type TableQueryView, type Row } from '@metriccanvas/page/internal';
import { createSourceProgram, defaultSourceView } from '../src/runtime';
import { SLOT_SEARCH_TIMEOUT_MS } from '../src/source-program/slot-search-batches';

function fixture(count = 1205, maxValues = 1000) {
  const parsed = parsePage({ schemaVersion: '6.110', id: 'batch-search', layout: 'dashboard', dataSources: {
    main: { fields: { code: { type: 'string', role: 'dimension', queryField: 'code', nullable: false }, amount: { type: 'number', role: 'measure', queryField: 'amount' } },
      source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['code'], output_metrics: ['amount'], order: { offset: 0, limit: 10 } }] } } } },
    basic: { fields: { code: { type: 'string', role: 'dimension', queryField: 'code', nullable: false }, owner: { type: 'string', role: 'dimension', queryField: 'owner' } },
      source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ query_type: 'object', object_type: 'Basic', output_fields: ['code', 'owner'], order: { offset: 0, limit: 1000 } }] },
        resultBindings: [{ source: 'main', field: 'code', target: 'dimension', queryField: 'code', maxValues }] } } }
  }, sections: [{ id: 'body', components: [{ id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'main', basic: 'basic' }, props: {
    rowKey: 'code', pagination: { mode: 'query' }, columns: [{ field: 'code' }, { field: 'amount', sortable: true }, { field: { data: 'basic', field: 'owner' } }],
    toolbar: { search: { options: [{ value: 'owner', label: 'Owner', field: { data: 'basic', field: 'owner' } }] }, export: { format: 'xlsx' } }
  } }] }] });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const basic = Array.from({ length: count }, (_, i) => ({ code: `K${String(i).padStart(5, '0')}`, owner: 'target' }));
  const main = basic.flatMap((row, i) => [{ code: row.code, amount: i * 2 }, { code: row.code, amount: i * 2 + 1 }]);
  return { page: parsed.page, basic, main };
}

function matching(rows: Row[], query: EffectiveQuery) {
  return rows.filter(row => query.filterValues.every(filter => filter.target !== 'dimension' || filter.values.includes(row[filter.queryField] as string)) &&
    (!query.search || query.search.queryFields.some(field => row[field] === query.search!.query)));
}

function transport(data: ReturnType<typeof fixture>) {
  const requests: EffectiveQuery[] = [];
  return { requests, gateway: { async fetchData(query: EffectiveQuery) {
    requests.push(structuredClone(query));
    const all = matching(query.body.dsl_list[0].query_type === 'object' ? data.basic : data.main, query);
    const offset = query.pagination?.offset ?? 0, limit = query.pagination?.limit ?? all.length;
    return { rows: all.slice(offset, offset + limit), totalCount: all.length };
  } } };
}

function view(page: ReturnType<typeof fixture>['page']): TableQueryView {
  return { ...defaultSourceView(page, 'main'), search: { data: 'basic', fields: ['owner'], query: 'target', match: 'equals' } };
}
async function read(program: ReturnType<typeof createSourceProgram>, applied: TableQueryView, complete = false, freshness?: 'refresh') {
  const snapshots = new Map<string, DataSnapshot>();
  for await (const update of program.read({ roots: ['main', 'basic'], conditions: new Map(), views: new Map([['main', applied]]), freshness,
    ...(complete ? { purpose: 'complete', completeSources: ['main', 'basic'] } : {}) })) snapshots.set(update.sourceId, update.snapshot);
  return snapshots;
}

describe('materialized supplementary search', () => {
  it('reads >1000 keys in bounded batches and sorts duplicate main records globally before paging and exporting', async () => {
    const data = fixture(), network = transport(data), program = createSourceProgram(data.page, { gateway: network.gateway });
    const applied = { ...view(data.page), sort: [{ field: 'amount', direction: 'desc' as const }] };
    try {
      const first = (await read(program, applied)).get('main');
      expect(first).toMatchObject({ status: 'ready', totalCount: 2410 });
      if (first?.status !== 'ready') throw new Error('Expected first page');
      expect(first.rows.slice(0, 2)).toMatchObject([{ amount: 2409 }, { amount: 2408 }]);
      const beforePage = network.requests.length;
      const second = (await read(program, { ...applied, pageIndex: 1 })).get('main');
      if (second?.status !== 'ready') throw new Error('Expected second page');
      expect(second.rows[0]).toMatchObject({ amount: 2399 });
      expect(network.requests).toHaveLength(beforePage);
      const exported = await read(program, applied, true);
      expect(exported.get('main')).toMatchObject({ totalCount: 2410 });
      expect(exported.get('basic')).toMatchObject({ totalCount: 1205 });
      const result = exported.get('main');
      if (result?.status !== 'ready') throw new Error('Expected complete main');
      expect(result.rows).toHaveLength(2410);
      expect(result.rows.at(-1)).toMatchObject({ amount: 0 });
      expect(network.requests).toHaveLength(beforePage);
      const sizes = network.requests.flatMap(query => query.filterValues.flatMap(filter => filter.target === 'dimension' && filter.queryField === 'code' ? [filter.values.length] : []));
      expect(sizes).toContain(1000); expect(sizes).toContain(205); expect(Math.max(...sizes)).toBe(1000);
    } finally { program.dispose(); }
  });

  it('applies predicates and candidate ranges to the complete cached result, refreshes explicitly, and respects smaller batches', async () => {
    const data = fixture(1005, 71), network = transport(data), program = createSourceProgram(data.page, { gateway: network.gateway });
    const applied = { ...view(data.page), predicates: [{ field: 'amount', op: 'gte' as const, value: 2000 }] };
    try {
      expect((await read(program, applied)).get('main')).toMatchObject({ totalCount: 10 });
      const size = network.requests.length;
      expect(await program.readColumnCandidates({ sourceId: 'main', field: 'code', conditions: new Map(), view: applied })).toMatchObject({ totalCount: 5 });
      expect(network.requests).toHaveLength(size);
      await read(program, applied, false, 'refresh'); expect(network.requests.length).toBeGreaterThan(size);
      expect(network.requests.every(query => query.filterValues.every(filter => filter.target !== 'dimension' || filter.values.length <= 71))).toBe(true);
    } finally { program.dispose(); }
  });

  it.each([false, true])('fills additional same-key slots for >1000-key exports, cleared=%s', async cleared => {
    const data = fixture(), network = transport(data);
    data.page.dataSources.extra = structuredClone(data.page.dataSources.basic);
    const table = data.page.sections[0].components[0];
    if (table.type !== 'table') throw new Error('Expected table');
    table.data.extra = 'extra';
    const program = createSourceProgram(data.page, { gateway: network.gateway });
    try {
      const snapshots = new Map<string, DataSnapshot>();
      for await (const update of program.read({ roots: ['main', 'basic', 'extra'], conditions: new Map(), views: new Map([['main', cleared ? { ...view(data.page), search: undefined } : view(data.page)]]),
        purpose: 'complete', completeSources: ['main', 'basic', 'extra'] })) snapshots.set(update.sourceId, update.snapshot);
      expect(snapshots.get('extra')).toMatchObject({ status: 'ready', totalCount: 1205 });
      expect(snapshots.get('main')).toMatchObject({ totalCount: 2410 });
    } finally { program.dispose(); }
  });

  it('exports >1000 contracts after clearing search while ordinary query bindings remain bounded', async () => {
    const data = fixture(), network = transport(data), program = createSourceProgram(data.page, { gateway: network.gateway });
    try {
      const snapshots = await read(program, { ...view(data.page), search: undefined }, true);
      expect(snapshots.get('main')).toMatchObject({ status: 'ready', totalCount: 2410 });
      expect(snapshots.get('basic')).toMatchObject({ status: 'ready', totalCount: 1205 });
      const bound = network.requests.filter(query => query.body.dsl_list[0].query_type === 'object');
      expect(bound.length).toBeGreaterThan(1);
      expect(bound.every(query => query.filterValues.every(filter => filter.target !== 'dimension' || filter.values.length <= 1000))).toBe(true);
    } finally { program.dispose(); }
  });

  it('never publishes partial rows when a later main batch fails', async () => {
    const data = fixture(), network = transport(data);
    const program = createSourceProgram(data.page, { gateway: { async fetchData(query) {
      if (query.filterValues.some(filter => filter.target === 'dimension' && filter.values.includes('K01000'))) throw Object.assign(new Error('later batch failed'), { code: 'DQE_UPSTREAM_ERROR' });
      return network.gateway.fetchData(query);
    } } });
    try { expect((await read(program, view(data.page))).get('main')).toMatchObject({ status: 'error' }); }
    finally { program.dispose(); }
  });

  it('retains the separate export row limit after a successful large screen search', async () => {
    const data = fixture(5001), network = transport(data), program = createSourceProgram(data.page, { gateway: network.gateway });
    try {
      expect((await read(program, view(data.page))).get('main')).toMatchObject({ totalCount: 10002 });
      await expect(read(program, view(data.page), true)).rejects.toMatchObject({ code: 'EXPORT_ROW_LIMIT' });
    } finally { program.dispose(); }
  });

  it('uses one 180-second deadline and does not cache timed-out reads', async () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController(); setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms); return controller.signal;
    });
    let stalled = true;
    const data = fixture(1), program = createSourceProgram(data.page, { gateway: { async fetchData(query, _context, signal) {
      if (!stalled) { const rows = query.body.dsl_list[0].query_type === 'object' ? data.basic : data.main; return { rows, totalCount: rows.length }; }
      if (!signal) throw new Error('Expected cancellation signal');
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    } } });
    try {
      const pending = read(program, view(data.page));
      await vi.advanceTimersByTimeAsync(SLOT_SEARCH_TIMEOUT_MS);
      expect((await pending).get('main')).toMatchObject({ status: 'error', error: { code: 'DQE_TIMEOUT' } });
      expect(timeout).toHaveBeenCalledWith(180000);
      stalled = false;
      expect((await read(program, view(data.page))).get('main')).toMatchObject({ status: 'ready', totalCount: 2 });
    } finally { program.dispose(); timeout.mockRestore(); vi.useRealTimers(); }
  });
});
