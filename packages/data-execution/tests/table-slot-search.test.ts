import { describe, expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { conditionSourceIds, tableSearchValue, type DataSnapshot, type Page, type TableComponent } from '@metriccanvas/page/internal';
import { createSourceProgram, defaultSourceView } from '../src/runtime';
import { createDqeGateway } from '../src/dqe';

export function slotSearchPage(): Page {
  const parsed = parsePage({ schemaVersion: '6.109', id: 'slot-search-test', layout: 'dashboard',
    dataSources: {
      main: { fields: { code: { type: 'string', role: 'dimension', queryField: '编号', nullable: false }, amount: { type: 'number', role: 'measure', queryField: '金额' } },
        source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['编号'], output_metrics: ['金额'], order: { offset: 0, limit: 1 } }] } } } },
      basic: { fields: { code: { type: 'string', role: 'dimension', queryField: '编号', nullable: false }, owner: { type: 'string', role: 'dimension', queryField: '责任人' }, customer: { type: 'string', role: 'dimension', queryField: '客户' } },
        source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ query_type: 'object', object_type: 'Test/Basic', output_fields: ['编号', '责任人', '客户'], filter: { fields: [] }, order: { offset: 0, limit: 1000 } }] }, resultBindings: [{ source: 'main', field: 'code', target: 'dimension', queryField: '编号', maxValues: 1000 }] } } }
    }, sections: [{ id: 'body', components: [{ id: 'table', type: 'table', data: { main: 'main', basic: 'basic' }, layout: { span: 12 }, props: {
      rowKey: 'code', pagination: { mode: 'query' }, columns: [{ field: 'code' }, { field: { data: 'basic', field: 'owner' } }, { field: { data: 'basic', field: 'customer' } }],
      toolbar: { search: { options: [{ value: 'owner', label: '责任人', field: { data: 'basic', field: 'owner' } }, { value: 'customer', label: '客户', field: { data: 'basic', field: 'customer' } }] } }
    } }] }] });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

const rows = [
  { code: 'B001', owner: '甲', customer: '客户一', amount: 1 },
  { code: 'B002', owner: '乙', customer: '客户二', amount: 2 },
  { code: 'B003', owner: '甲', customer: '客户二', amount: 3 },
  { code: 'B004', owner: '乙', customer: '客户一', amount: 4 }
];
type QueryRow = Record<string, unknown>;
const fieldIds: Record<string, keyof typeof rows[number]> = { 编号: 'code', 责任人: 'owner', 客户: 'customer', 金额: 'amount' };

function gateway(mode = 'ready') {
  const requests: QueryRow[] = [];
  const dataGateway = createDqeGateway({ fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const results = body.dsl_list.map((item: QueryRow) => {
      requests.push(item);
      const object = item.query_type === 'object';
      const filter = item.filter as { fields?: { field_name: string; value_list: string[] }[]; dims?: { dim_name: string; dim_value_list: string[] }[] } | undefined;
      const conditions = object ? (filter?.fields ?? []).map(f => ({ field: f.field_name, values: f.value_list })) : (filter?.dims ?? []).map(f => ({ field: f.dim_name, values: f.dim_value_list }));
      const matching = rows.filter(row => conditions.every(f => f.values.includes(String(row[fieldIds[f.field]]))));
      const order = item.order as { offset?: number; limit?: number };
      const fields = (object ? item.output_fields : [...item.output_dims as string[], ...item.output_metrics as string[]]) as string[];
      const data = matching.slice(order.offset ?? 0, (order.offset ?? 0) + (order.limit ?? 1000)).map(row => Object.fromEntries(fields.map(field => [field, row[fieldIds[field]]])));
      const lookup = object && conditions.some(f => f.field !== '编号');
      return { code: 'SUCCESS', total_count: lookup && mode === 'overflow' ? 1001 : matching.length, data: lookup && mode === 'truncated' ? [] : data };
    });
    return Response.json({ retCode: 'CBC.0000', results });
  } });
  return { dataGateway, requests };
}

async function read(page: Page, option: string, query: string, pageIndex = 0, mode = 'ready', complete = false) {
  const transport = gateway(mode), program = createSourceProgram(page, { gateway: transport.dataGateway });
  const table = page.sections[0].components[0] as TableComponent;
  const view = { ...defaultSourceView(page, 'main'), pageIndex, search: tableSearchValue(table.props.toolbar?.search, query, option) };
  const snapshots = new Map<string, DataSnapshot>();
  const views = new Map([['main', view]]);
  const captured = complete ? program.captureQueries(new Map(), views, snapshots) : undefined;
  try {
    for await (const update of program.read({ roots: ['main', 'basic'], conditions: new Map(), views, queries: captured, ...(complete ? { purpose: 'complete', completeSources: ['main', 'basic'] } : {}) })) snapshots.set(update.sourceId, update.snapshot);
    return { snapshots, requests: transport.requests };
  } finally { program.dispose(); }
}

describe('table supplementary-slot exact search', () => {
  it.each(['old-version', 'missing-slot', 'missing-key-binding', 'numeric-field'])('rejects invalid %s metadata before querying', kind => {
    const page = slotSearchPage(), table = page.sections[0].components[0] as TableComponent;
    const search = table.props.toolbar!.search!;
    if (!('options' in search)) throw new Error('Expected options');
    if (kind === 'old-version') page.schemaVersion = '6.103';
    if (kind === 'missing-slot') delete table.data.basic;
    if (kind === 'numeric-field') page.dataSources.basic.fields.owner.type = 'number';
    const source = page.dataSources.basic;
    if (kind === 'missing-key-binding' && source.source.type === 'query') source.source.query.resultBindings = [];
    expect(parsePage(page).ok).toBe(false);
  });
  it('includes supplementary conditions without introducing a result dependency cycle', () => {
    expect([...conditionSourceIds(slotSearchPage(), 'main')]).toEqual(['main', 'basic']);
  });
  it('rejects a supplementary fixed TopN instead of broadening its business scope', () => {
    const page = slotSearchPage(), source = page.dataSources.basic;
    if (source.source.type !== 'query' || !source.source.query.body) throw new Error('Expected query');
    const order = source.source.query.body.dsl_list[0].order;
    if (!order || typeof order !== 'object' || Array.isArray(order)) throw new Error('Expected order');
    delete order.offset;
    expect(parsePage(page).ok).toBe(false);
  });
  it('finds owner matches beyond the original first page before main pagination', async () => {
    const { snapshots, requests } = await read(slotSearchPage(), 'owner', '乙');
    expect(snapshots.get('main')).toMatchObject({ status: 'ready', rows: [{ code: 'B002', amount: 2 }], totalCount: 2 });
    expect(snapshots.get('basic')).toMatchObject({ status: 'ready', rows: [{ code: 'B002', owner: '乙', customer: '客户二' }] });
    expect(requests[0]).toMatchObject({ query_type: 'object', filter: { fields: [{ field_name: '责任人', value_list: ['乙'], operator: '=' }] } });
    expect(requests[1]).toMatchObject({ filter: { dims: [{ dim_name: '编号', dim_value_list: ['B002', 'B004'] }] }, order: { offset: 0, limit: 1 } });
  });
  it('pages the matching main rows and only fills the requested page', async () => {
    const { snapshots } = await read(slotSearchPage(), 'owner', '乙', 1);
    expect(snapshots.get('main')).toMatchObject({ rows: [{ code: 'B004' }], totalCount: 2 });
    expect(snapshots.get('basic')).toMatchObject({ rows: [{ code: 'B004' }] });
  });
  it('switches to customer matching and clears back to the original scope', async () => {
    expect((await read(slotSearchPage(), 'customer', '客户二')).snapshots.get('main')).toMatchObject({ rows: [{ code: 'B002' }], totalCount: 2 });
    expect((await read(slotSearchPage(), 'customer', '')).snapshots.get('main')).toMatchObject({ rows: [{ code: 'B001' }], totalCount: 4 });
  });
  it('empty lookup skips main and dependent HTTP requests', async () => {
    const { snapshots, requests } = await read(slotSearchPage(), 'owner', '不存在');
    expect(snapshots.get('main')).toMatchObject({ status: 'empty', totalCount: 0 });
    expect(requests).toHaveLength(1);
  });
  it('intersects matching keys with the main query constraints', async () => {
    const page = slotSearchPage(), source = page.dataSources.main;
    if (source.source.type !== 'query' || !source.source.query.body) throw new Error('Expected query');
    source.source.query.body.dsl_list[0].filter = { dims: [{ dim_name: '编号', dim_value_list: ['B001'] }] };
    const { snapshots, requests } = await read(page, 'owner', '乙');
    expect(snapshots.get('main')).toMatchObject({ status: 'empty', totalCount: 0 });
    expect(requests).toHaveLength(1);
  });
  it('cancels a pending lookup without issuing a main request', async () => {
    const page = slotSearchPage(), abort = new AbortController();
    let entered!: () => void, finish!: (value: { rows: []; totalCount: number }) => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    let calls = 0;
    const program = createSourceProgram(page, { gateway: { fetchData() {
      calls++; entered(); return new Promise(resolve => { finish = resolve; });
    } } });
    const view = { ...defaultSourceView(page, 'main'), search: { fields: ['owner'], data: 'basic', query: '甲', match: 'equals' as const } };
    const reading = (async () => { for await (const _ of program.read({ roots: ['main'], conditions: new Map(), views: new Map([['main', view]]), signal: abort.signal })) {} })();
    const rejected = expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    await started; abort.abort(); finish({ rows: [], totalCount: 0 });
    await rejected; expect(calls).toBe(1); program.dispose();
  });
  it.each(['overflow', 'truncated'])('rejects %s lookup receipts without sending a main query', async mode => {
    const { snapshots, requests } = await read(slotSearchPage(), 'owner', '乙', 0, mode);
    expect(snapshots.get('main')).toMatchObject({ status: 'error', error: { code: mode === 'overflow' ? 'DQE_QUERY_REJECTED' : 'DQE_ROW_CONTRACT_ERROR' } });
    expect(requests.every(item => item.query_type === 'object')).toBe(true);
  });
  it('complete reads include all matching main and supplementary rows', async () => {
    const { snapshots } = await read(slotSearchPage(), 'owner', '乙', 0, 'ready', true);
    expect(snapshots.get('main')).toMatchObject({ rows: [{ code: 'B002' }, { code: 'B004' }], totalCount: 2 });
    expect(snapshots.get('basic')).toMatchObject({ rows: [{ code: 'B002' }, { code: 'B004' }] });
  });
  it('scopes main-column candidates to the same supplementary search', async () => {
    const page = slotSearchPage(), transport = gateway();
    let queried: import('@metriccanvas/page/internal').EffectiveQuery | undefined;
    const program = createSourceProgram(page, { gateway: { ...transport.dataGateway, async fetchColumnCandidates(request) {
      queried = request.query;
      return { kind: 'values' as const, candidates: [{ value: 'B002', label: 'B002' }, { value: 'B004', label: 'B004' }], totalCount: 2 };
    } } });
    const view = { ...defaultSourceView(page, 'main'), search: { data: 'basic', fields: ['owner'], query: '乙', match: 'equals' as const } };
    try {
      const result = await program.readColumnCandidates({ sourceId: 'main', field: 'code', conditions: new Map(), view });
      expect(result).toMatchObject({ kind: 'values', totalCount: 2 });
      expect(queried?.filterValues).toContainEqual({ target: 'dimension', queryField: '编号', values: ['B002', 'B004'] });
      expect(queried?.search).toBeUndefined();
    } finally { program.dispose(); }
  });
});
