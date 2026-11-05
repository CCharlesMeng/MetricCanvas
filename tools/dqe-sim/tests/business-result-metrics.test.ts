import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {parsePage} from '../../../packages/page/src/index';
import type {DataSnapshot,JsonObject} from '../../../packages/page/src/internal';
import {resolvePeriodSelection} from '../../../packages/page/src/internal';
import {createDqeGateway} from '../../../packages/data-execution/src/dqe/dqe';
import {createSourceProgram,initialFilterValues} from '../../../packages/data-execution/src/runtime';
import {businessResultSimDisplayInputs,businessResultSimGateway} from '../../../apps/playground/fixtures/business-result-sim';
import {executeDqeItem} from '../src/execute';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../src/server';

const raw = JSON.parse(readFileSync('pages/temporary/business-result-config-audit-20261105/business-result-metrics-2.json','utf8'));
const parsed = parsePage(raw);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;
const server = createDqeSimServer({logger:false});
let endpoint = '';
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('address');
  endpoint = `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`;
});
afterAll(async () => {await new Promise<void>(resolve => server.close(() => resolve()));});

function setup() {
  const requests: JsonObject[] = [];
  const gateway = businessResultSimGateway(createDqeGateway({endpoint,fetchImpl:async (url,init) => {
    requests.push(...JSON.parse(String(init?.body)).dsl_list);
    const response = await fetch(url,init);
    expect(response.headers.get('x-request-id')).toMatch(/^dqe-sim-/);
    return response;
  }}));
  const now = new Date('2026-11-05T04:00:00Z');
  const conditions = initialFilterValues(page.filters ?? [],now);
  const program = createSourceProgram(page,{gateway,now,displayInputs:businessResultSimDisplayInputs.getSnapshot});
  const snapshots = new Map<string,DataSnapshot>();
  async function read(roots: string[]) {
    for await (const update of program.read({roots,conditions,useInitial:false})) snapshots.set(update.sourceId,update.snapshot);
  }
  function rows(id: string) {
    const snapshot = snapshots.get(id);
    if (snapshot?.status !== 'ready') throw Error(JSON.stringify({id,snapshot}));
    return snapshot.rows;
  }
  return {program,conditions,requests,read,rows};
}

it('uses actual HTTP and page computations for positive, negative and zero YoY, plus independent summaries',async () => {
  const test = setup();
  try {
    await test.read(Object.keys(page.dataSources));
    expect(test.rows('region-dept-metrics')).toHaveLength(3);
    expect(test.rows('rep-office-metrics')).toEqual(expect.arrayContaining([
      expect.objectContaining({'rep-office-name':'北京代表处','net-discount-rate':25,'net-discount-yoy':2}),
      expect.objectContaining({'rep-office-name':'天津代表处','net-discount-rate':35,'net-discount-yoy':-3}),
      expect.objectContaining({'rep-office-name':'上海代表处','net-discount-yoy':0}),
      expect.objectContaining({'rep-office-name':'杭州代表处','net-discount-yoy':5})
    ]));
    expect(test.rows('region-dept-summary')).toEqual([expect.objectContaining({'net-discount-rate':30})]);
    expect(test.rows('rep-office-summary')).toEqual(test.rows('region-dept-summary'));
    expect(test.rows('region-dept-summary-comparison')[0]['net-discount-yoy']).toBeCloseTo(11/12);
    expect(test.rows('rep-office-summary-comparison')[0]['net-discount-yoy']).toBeCloseTo(11/12);
    for (const id of ['region-dept-commercial-summary','region-dept-contract-summary','rep-office-commercial-summary','rep-office-contract-summary']) expect(test.rows(id)).toHaveLength(1);
    expect(test.rows('net-discount-trend')).toEqual(expect.arrayContaining([expect.objectContaining({'rep-office':'北京代表处','net-discount-yoy':2,'net-discount-mom':3})]));
    const summaries = test.requests.filter(item => JSON.stringify(item.output_dims) === '[]');
    // Identical global queries from both tables share the same HTTP request.
    expect(summaries).toHaveLength(5);
    for (const query of summaries) {
      expect(query.order).toEqual({});
      expect((query.filter as JsonObject).time).toMatchObject({is_aggregate:true});
    }
    const historical = test.requests.filter(item => JSON.stringify(item).includes('2025-11-04'));
    expect(historical).toHaveLength(4);
  } finally {test.program.dispose();}
});

it('keeps department summaries global and narrows office summaries to the selected department',async () => {
  const test = setup();
  try {
    const roots = ['region-dept-summary','rep-office-parent-summary','region-dept-summary-comparison','rep-office-parent-summary-comparison','rep-office-parent-commercial-summary','rep-office-parent-contract-summary','rep-office-metrics'];
    await test.read(['region-dept-summary','region-dept-summary-comparison']);
    test.conditions.set('region',{type:'dimension',dimension:'region-dept-code',level:'region-dept',values:['CN-NORTH']});
    await test.read(roots);
    expect(test.rows('region-dept-summary')[0]['net-discount-rate']).toBe(30);
    expect(test.rows('rep-office-parent-summary')[0]['net-discount-rate']).toBe(32.5);
    expect(test.rows('rep-office-parent-summary-comparison')[0]['net-discount-yoy']).toBe(-1.75);
    expect(test.rows('region-dept-summary-comparison')[0]['net-discount-yoy']).toBeCloseTo(11/12);
    expect(test.rows('rep-office-metrics')).toHaveLength(2);
    test.conditions.set('region',{type:'dimension',dimension:'rep-office-code',level:'office',values:['BJ-01']});
    await test.read(roots);
    expect(test.rows('rep-office-metrics')).toEqual([expect.objectContaining({'rep-office-name':'北京代表处','net-discount-yoy':2})]);
  } finally {test.program.dispose();}
});

function query(source: string): JsonObject {
  const item = structuredClone(raw.dataSources[source].source.query.body.dsl_list[0]);
  item.filter.time = {...item.filter.time,start:'2026-11',end:'2026-11'};
  return item;
}

it('rejects unsupported predicates even after an empty match and refuses windowed summaries',() => {
  const main = query('region-dept-summary');
  expect(executeDqeItem({...main,order:{limit:1,offset:0}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  const unsupported = {...main,filter:{...(main.filter as JsonObject),dims:[{dim_name:'region_dept_code',dim_value_list:['none']},{dim_name:'未知维度',dim_value_list:['x']}]}};
  expect(executeDqeItem(unsupported).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  const missing = {...main,filter:{...(main.filter as JsonObject),dims:[{dim_name:'region_dept_code',dim_value_list:['none']}]}};
  expect(executeDqeItem(missing)).toMatchObject({code:'SUCCESS',data:[],total_count:0});
  expect(executeDqeItem({...main,output_metrics:['未知指标']}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  expect(executeDqeItem({...main,filter:{...(main.filter as JsonObject),time:{period:'month',start:'2027-01',end:'2027-01'}}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});

it('queries the selected parent department grain independently for all office pinned slots and periods',async () => {
  const test = setup();
  try {
    test.conditions.set('region',{type:'dimension',dimension:'region-dept-code',level:'region-dept',values:['CN-NORTH']});
    const roots = ['rep-office-parent-summary','rep-office-parent-commercial-summary','rep-office-parent-contract-summary','rep-office-parent-summary-comparison'];
    await test.read(roots);
    expect(test.requests).toHaveLength(5);
    for (const item of test.requests) {
      expect(item.output_dims).toEqual(['地区部']);
      expect((item.filter as JsonObject).dims).toContainEqual(expect.objectContaining({dim_name:'region_dept_code',dim_value_list:['CN-NORTH']}));
    }
    expect(test.rows('rep-office-parent-summary')).toHaveLength(1);
    expect(test.rows('rep-office-parent-summary-comparison')[0]['net-discount-yoy']).toBe(-1.75);
    const count = test.requests.length;
    test.conditions.set('mtime',{type:'timeRange',...resolvePeriodSelection({mode:'month',value:'2026-10'},new Date('2026-11-05T04:00:00Z'),'month')});
    await test.read(roots);
    expect(test.requests.slice(count)).toHaveLength(5);
    expect(test.requests.slice(count).map(item => (item.filter as JsonObject).time)).toEqual(expect.arrayContaining([
      expect.objectContaining({start:'2026-10-01',end:'2026-10-31'}),
      expect.objectContaining({start:'2025-10-01',end:'2025-10-31'})
    ]));
  } finally {test.program.dispose();}
});
