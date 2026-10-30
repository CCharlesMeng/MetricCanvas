import type {AddressInfo} from 'node:net';
import {afterAll, beforeAll, expect, it, vi} from 'vitest';
import {parsePage} from '../packages/page/src';
import {createDqeGateway} from '../packages/data-execution/src/dqe/dqe';
import {createSourceProgram, initialFilterValues, type SourceUpdate} from '../packages/data-execution/src/runtime';
import {createDqeSimServer, DQE_EXECUTE_PATH} from '../tools/dqe-sim/src/server';
import document from '../pages/temporary/partner-health.json';
import type {JsonObject} from '../packages/page/src/query';
import {flattenPageComponents, resolveDataSourceFields} from '../packages/page/src/internal';
import {orchestrate, type PageDataSnapshots} from '../packages/engine/runtime/src/orchestrator';
import {barOption} from '../packages/engine/widgets/src/components/bar-chart/options';
import {createFilterState} from '../packages/engine/runtime/src/filter-state';
import type {RuntimeDataGateway} from '../packages/data-execution/src/ports';
import {organizationDimensionValues} from '../apps/playground/fixtures/organization-union/organizations';

const parsed = parsePage(document);
if (!parsed.ok) throw Error('Invalid fixture page');
const page = parsed.page;
function httpGateway(config: Parameters<typeof createDqeGateway>[0]): RuntimeDataGateway {
  return {...createDqeGateway(config), async fetchDimensionValues(dimension, options) {
    options?.signal?.throwIfAborted();
    return organizationDimensionValues(dimension);
  }};
}
function isOverviewItem(item: JsonObject): boolean {
  const fields = item.output_fields ?? item.output_dims;
  return Array.isArray(fields) && fields.includes('国内或海外') && !fields.includes('地区部') && !fields.includes('代表处');
}
const server = createDqeSimServer({logger: false});
let endpoint = '';
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}${DQE_EXECUTE_PATH}`;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(async () => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it.each(['ready', 'zeroTotal'])('%s：真实 HTTP 回执经过查询运行时得到15行并集', async state => {
  const gateway = createDqeGateway({endpoint: `${endpoint}?fixture=partner-health&state=${state}`});
  const program = createSourceProgram(page, {gateway});
  const updates = new Map<string, SourceUpdate>();
  try {
    for await (const update of program.read({roots: ['health-scores-region', 'health-scores-representative', 'health-overview'], conditions: initialFilterValues(page.filters ?? [])})) {
      updates.set(update.sourceId, update);
    }
    for (const grain of ['region', 'representative']) {
      const prefix = grain === 'representative' ? 'REP' : 'ORG';
      const snapshot = updates.get(`health-scores-${grain}`)?.snapshot;
      expect(snapshot).toMatchObject({status: 'ready', totalCount: 15});
      if (snapshot?.status !== 'ready') throw Error(JSON.stringify(snapshot));
      expect(snapshot.rows.find(row => row.region === `${prefix}-01`)).toMatchObject({'perception-feedback': 0});
      expect(snapshot.rows.find(row => row.region === `${prefix}-03`)).toMatchObject({'satisfaction-evaluation': null, 'total-score': 0});
      expect(snapshot.rows.find(row => row.region === `${prefix}-15`)).toMatchObject({'total-score': grain === 'representative' ? 5 : 10});
    }
    expect(updates.get('health-overview')?.snapshot).toMatchObject({status: 'ready', rows: [expect.objectContaining({'total-score': 35})]});
    const counts = ['voice-closure-score', 'customer-eval-score', 'perception-willingness-score'].map(id => updates.get(`${id}-region`)?.raw);
    expect(counts.map(snapshot => snapshot && 'rows' in snapshot ? snapshot.rows?.length : undefined)).toEqual([1, 10, 13]);
    if (state === 'zeroTotal') for (const snapshot of counts) expect(snapshot).toMatchObject({totalCount: 0});
  } finally { program.dispose(); }
});

it('未知查询不会由 HTTP Mock 冒充成功', async () => {
  const response = await fetch(`${endpoint}?fixture=partner-health`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({dsl_list: [{output_metrics: ['unknown']}]})});
  expect(await response.json()).toMatchObject({results: [{code: 'DQE_SIM_UNSUPPORTED_QUERY'}]});
});

it('三种粒度统一合批、查询不重复，顶部对象只投影得分和国内或海外', async () => {
  const batches: JsonObject[][] = [];
  const gateway = httpGateway({endpoint: `${endpoint}?fixture=partner-health`, fetchImpl: async (input, init) => {
    batches.push(JSON.parse(String(init?.body)).dsl_list);
    return fetch(input, init);
  }});
  const program = createSourceProgram(page, {gateway});
  try {
    for await (const _update of program.read({roots: ['health-overview', 'health-scores-region', 'health-scores-representative'], conditions: initialFilterValues(page.filters ?? [])})) { /* Drain the shared execution. */ }
    const items = batches.flat();
    expect(items).toHaveLength(33);
    expect(new Set(items.map(item => JSON.stringify(item))).size).toBe(33);
    expect(batches.length).toBeLessThan(33);
    const overview = items.filter(isOverviewItem);
    expect(overview).toHaveLength(11);
    expect(JSON.stringify(overview)).not.toContain('data_site_type');
    const objects = overview.filter(item => item.query_type === 'object');
    expect(objects).toHaveLength(4);
    expect(objects).toContainEqual({query_type: 'object', object_type: 'Partner Health/Custormer Partner Evaluation Score',
      output_fields: ['客户对伙伴的评价得分', '国内或海外'],
      filter: {fields: [{field_name: '国内或海外', value_list: ['国内', '海外'], operator: '='}]}, order: {}});
    for (const object of objects) expect(object.filter).toEqual({fields: [{field_name: '国内或海外', value_list: ['国内', '海外'], operator: '='}]});
  } finally { program.dispose(); }
});

it('顶部中国区与海外切换复用两组整体结果，不重发顶部请求', async () => {
  const items: JsonObject[] = [];
  const gateway = httpGateway({endpoint: `${endpoint}?fixture=partner-health&state=zeroTotal`, fetchImpl: async (input, init) => {
    items.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(input, init);
  }});
  const filters = createFilterState(initialFilterValues(page.filters ?? []));
  const stream = orchestrate(page, gateway, filters);
  let snapshots: PageDataSnapshots = new Map();
  const stop = stream.subscribe(next => snapshots = next);
  try {
    await vi.waitFor(() => expect(snapshots.get('health-overview')).toMatchObject({status: 'ready', rows: [expect.objectContaining({'total-score': 35})]}));
    await vi.waitFor(() => expect(snapshots.get('health-scores-region')?.status).toBe('ready'));
    await vi.waitFor(() => expect(snapshots.get('health-scores-representative')?.status).toBe('ready'));
    expect(items.filter(isOverviewItem)).toHaveLength(11);
    const originalCalls = items.length;
    const originalRegion = snapshots.get('health-scores-region');
    const originalRepresentative = snapshots.get('health-scores-representative');
    filters.write('china-overseas', {type: 'dimension', dimension: 'china-overseas', values: ['海外']});
    await vi.waitFor(() => expect(snapshots.get('health-overview')).toMatchObject({status: 'ready', rows: [expect.objectContaining({'total-score': 30})]}));
    expect(items.filter(isOverviewItem)).toHaveLength(11);
    expect(items).toHaveLength(originalCalls);
    expect(snapshots.get('health-scores-region')).toEqual(originalRegion);
    expect(snapshots.get('health-scores-representative')).toEqual(originalRepresentative);
    filters.write('china-overseas', {type: 'dimension', dimension: 'china-overseas', values: ['中国区']});
    await vi.waitFor(() => expect(snapshots.get('health-overview')).toMatchObject({status: 'ready', rows: [expect.objectContaining({'total-score': 35})]}));
    expect(items.filter(isOverviewItem)).toHaveLength(11);
  } finally { stop(); }
});

it.each([
  {level: 'region-dept', value: 'ORG-06', field: '地区部', regions: ['ORG-06'], representatives: ['REP-04', 'REP-05', 'REP-06']},
  {level: 'representative', value: 'REP-06', field: '代表处', regions: ['ORG-06'], representatives: ['REP-06']}
])('$field 节点通过真实HTTP下推对应组织谓词', async scope => {
  const items: JsonObject[] = [];
  const gateway = httpGateway({endpoint: `${endpoint}?fixture=partner-health&state=zeroTotal`, fetchImpl: async (input, init) => {
    items.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(input, init);
  }});
  const conditions = initialFilterValues(page.filters ?? []);
  conditions.set('region', {type: 'dimension', dimension: scope.level, level: scope.level, values: [scope.value]});
  const program = createSourceProgram(page, {gateway});
  const updates = new Map<string, SourceUpdate>();
  try {
    for await (const update of program.read({roots: ['health-scores-region', 'health-scores-representative'], conditions})) updates.set(update.sourceId, update);
    const region = updates.get('health-scores-region')?.snapshot;
    const representative = updates.get('health-scores-representative')?.snapshot;
    if (region?.status !== 'ready' || representative?.status !== 'ready') throw Error(JSON.stringify([region, representative]));
    expect(region.rows.map(row => row.region)).toEqual(scope.regions);
    expect(representative.rows.map(row => row.region)).toEqual(scope.representatives);
    expect(items).toHaveLength(22);
    for (const item of items) {
      expect(JSON.stringify(item.filter)).toContain(scope.field);
      expect(JSON.stringify(item.filter)).toContain(scope.value);
      expect(JSON.stringify(item.filter)).not.toContain('国内或海外');
    }
  } finally { program.dispose(); }
});

it('图表和表格页签切换复用已加载的同一份代表处结果', async () => {
  const components = flattenPageComponents(page);
  const chart = components.find(component => component.id === 'representative-chart');
  const table = components.find(component => component.id === 'representative-table');
  if (chart?.type !== 'barChart' || table?.type !== 'table') throw Error('缺少正式页面组件');
  expect(chart.data.main).toBe('health-scores-representative');
  expect(table.data.main).toBe(chart.data.main);
  const bodies: string[] = [];
  const gateway = httpGateway({endpoint: `${endpoint}?fixture=partner-health&state=zeroTotal`, fetchImpl: async (input, init) => {
    bodies.push(String(init?.body));
    return fetch(input, init);
  }});
  const stream = orchestrate(page, gateway);
  let snapshots: PageDataSnapshots = new Map();
  const stop = stream.subscribe(next => snapshots = next);
  try {
    await vi.waitFor(() => expect(snapshots.get('health-scores-region')?.status).toBe('ready'));
    await vi.waitFor(() => expect(snapshots.get('health-scores-representative')?.status).toBe('ready'));
    const initialCalls = bodies.length;
    stream.setActiveTabs({'regional-comparison-tabs': 'representative', 'detail-tabs': 'region'});
    await vi.waitFor(() => expect(snapshots.get(chart.data.main)?.status).toBe('ready'));
    expect(bodies.join('')).toContain('代表处');
    expect(bodies).toHaveLength(initialCalls);
    const shared = snapshots.get(chart.data.main);
    if (shared?.status !== 'ready') throw Error('代表处结果未就绪');
    const data = {main: {fields: resolveDataSourceFields(page.dataSources[chart.data.main]), snapshot: shared}};
    const option = barOption(data, chart.props);
    expect(option.xAxis).toMatchObject({data: shared.rows.map(row => row.region)});
    expect(option.series).toMatchObject([
      {data: shared.rows.map(row => row['perception-score'] ?? undefined)},
      {data: shared.rows.map(row => row['satisfaction-score'] ?? undefined)},
      {data: shared.rows.map(row => row['contribution-score'] ?? undefined)},
      {data: shared.rows.map(row => row['risk-score'] ?? undefined)}
    ]);
    expect(shared.rows).toContainEqual(expect.objectContaining({region: 'REP-12', 'perception-score': 9}));
    const calls = bodies.length;
    stream.setActiveTabs({'regional-comparison-tabs': 'representative', 'detail-tabs': 'representative'});
    expect(snapshots.get(table.data.main)).toBe(shared);
    expect(bodies).toHaveLength(calls);
    stream.setActiveTabs({'regional-comparison-tabs': 'region', 'detail-tabs': 'representative'});
    expect(snapshots.get('health-scores-region')).toMatchObject({status: 'ready', totalCount: 15});
    stream.setActiveTabs({'regional-comparison-tabs': 'representative', 'detail-tabs': 'representative'});
    expect(snapshots.get(chart.data.main)).toBe(shared);
    expect(bodies).toHaveLength(calls);
  } finally { stop(); }
});

it.each(['中国区', '海外'])('%s：下方对象查询保留组织粒度且不消费顶部范围', async scope => {
  const items: JsonObject[] = [];
  const gateway = httpGateway({endpoint: `${endpoint}?fixture=partner-health`, fetchImpl: async (input, init) => {
    items.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(input, init);
  }});
  const conditions = initialFilterValues(page.filters ?? []);
  conditions.set('china-overseas', {type: 'dimension', dimension: 'china-overseas', values: [scope]});
  const program = createSourceProgram(page, {gateway});
  const snapshots = new Map<string, SourceUpdate>();
  try {
    for await (const update of program.read({roots: ['health-scores-region', 'health-scores-representative'], conditions})) snapshots.set(update.sourceId, update);
    const objects = items.filter(item => item.query_type === 'object');
    expect(objects).toHaveLength(8);
    for (const item of objects) {
      expect(item.output_fields).toContain('国内或海外');
      expect(item.output_fields).not.toContain('data_site_type');
      expect(item.filter).toEqual({fields: []});
    }
    const customer = objects.find(item => item.object_type === 'Partner Health/Custormer Partner Evaluation Score' && Array.isArray(item.output_fields) && item.output_fields.includes('地区部'));
    expect(customer?.output_fields).toEqual(['地区部', '客户对伙伴的评价得分', '国内或海外']);
    expect(snapshots.get('health-scores-region')?.snapshot).toMatchObject({status: 'ready', totalCount: 15});
    expect(snapshots.get('health-scores-representative')?.snapshot).toMatchObject({status: 'ready', totalCount: 15});
  } finally { program.dispose(); }
});
