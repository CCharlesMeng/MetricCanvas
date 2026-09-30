import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { JoinAggregateOperator, QueryDataSource, Row } from '@metriccanvas/page/internal';
import { applyComputation } from '../src/compute';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';
import type { DataGateway, DataGatewayResult } from '../src/ports';
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const fixture = (): Page => {
  const parsed = parsePage(JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/cross-source-page.json', import.meta.url), 'utf8')));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
};
const op: JoinAggregateOperator = { op: 'joinAggregate', source: 'aux', keys: [{ local: 'a', foreign: 'a' }, { local: 'b', foreign: 'b' }],
  values: [{ field: 'amount', output: 'income', aggregate: 'unique' }], onMissing: 'null' };

describe('IOC F2 跨源计算与批次', () => {
  it('组合键无分隔符碰撞、成功缺行保留主行、负数保留、不修改输入', () => {
    const rows = [{ a: 'x|y', b: 'z' }, { a: 'x', b: 'y|z' }];
    expect(applyComputation([op], rows, new Map([['aux', [{ a: 'x|y', b: 'z', amount: -1200 }]]])))
      .toEqual([{ ...rows[0], income: -1200 }, { ...rows[1], income: null }]);
    expect(rows[0]).not.toHaveProperty('income');
  });
  it('重复键必须显式求和，全部缺失不当 0，缺键不做关联', () => {
    const rows = [{ a: 'A', b: 'B' }];
    const deps = new Map([['aux', [{ a: 'A', b: 'B', amount: 100 }, { a: 'A', b: 'B', amount: 200 }]]]);
    expect(() => applyComputation([op], rows, deps)).toThrow('重复组合键');
    const sum: JoinAggregateOperator = { ...op, values: [{ ...op.values[0], aggregate: 'sum' }] };
    expect(applyComputation([sum], rows, deps)[0].income).toBe(300);
    expect(applyComputation([sum], rows, new Map([['aux', [{ a: 'A', b: 'B', amount: null }]]]))[0].income).toBeNull();
    expect(() => applyComputation([sum], [{ a: 'A' }], deps)).toThrow('关联键缺失');
  });
  it('无组件直连的依赖也进入调度，inline 同步算出快照', () => {
    let state: PageDataSnapshots = new Map();
    const stop = orchestrate(fixture(), { async fetchData() { throw Error('不应查询'); } }).subscribe(next => state = next);
    expect(state.get('customers')).toMatchObject({ status: 'ready', rows: [{ customerId: 'A', revenue: 80 }, { customerId: 'B', revenue: null }] });
    stop();
  });
  it('新旧筛选不混批、过期请求取消且迟到不覆盖；依赖失败不伪装缺行', async () => {
    const page = fixture();
    page.filters = [{ id: 'region', type: 'dimension', dimension: 'region' }];
    for (const [id, source] of Object.entries(page.dataSources)) {
      const fields = Object.fromEntries(Object.entries(source.fields).map(([name, field]) => [name, name === 'revenue' ? field : { ...field, queryField: name }]));
      const querySource: QueryDataSource = { ...source, fields, source: { type: 'query', resultScope: 'complete', query: {
        language: 'dqe', body: { dsl_list: [{ output_dims: [id === 'customers' ? 'customerId' : 'partyNumber'], output_metrics: id === 'customers' ? [] : ['amount'], filter: { dims: [], metrics: [] }, order: {} }] },
        filterBindings: { region: { target: 'dimension', queryField: 'region' } }
      } } };
      page.dataSources[id] = querySource;
    }
    const calls: Array<{ id: string; signal?: AbortSignal; resolve(value: DataGatewayResult): void; reject(error: unknown): void }> = [];
    const gateway: DataGateway = { fetchData(_query, context, signal) { return new Promise((resolve, reject) => calls.push({ id: context!.dataSourceIds![0], signal, resolve, reject })); } };
    const filters = createFilterState(new Map());
    let state: PageDataSnapshots = new Map();
    const stop = orchestrate(page, gateway, filters).subscribe(next => state = next);
    calls.find(c => c.id === 'customers')!.resolve({ rows: [{ customerId: 'A' }] });
    await flush();
    expect(state.get('customers')?.status).toBe('loading');
    filters.write('region', { type: 'dimension', dimension: 'region', values: ['new'] });
    expect(calls[1].signal?.aborted).toBe(true);
    calls[1].resolve({ rows: [{ partyNumber: 'A', amount: 999 }] });
    calls[2].resolve({ rows: [{ customerId: 'A' }] });
    await flush();
    expect(state.get('customers')?.status).toBe('loading');
    calls[3].resolve({ rows: [{ partyNumber: 'A', amount: 20 }], totalCount: 1 });
    await flush();
    expect(state.get('customers')).toMatchObject({ status: 'ready', rows: [{ customerId: 'A', revenue: 20 }] });
    filters.write('region', { type: 'dimension', dimension: 'region', values: ['failed'] });
    calls[4].resolve({ rows: [{ customerId: 'A' }] });
    calls[5].reject(Object.assign(Error('private input'), { code: 'DQE_TIMEOUT' }));
    await flush();
    expect(state.get('customers')).toMatchObject({ status: 'error', error: { code: 'DQE_TIMEOUT' } });
    expect(JSON.stringify(state.get('customers'))).not.toContain('private input');
    stop();
  });
});

it('声明完整结果的辅助查询被截断时，目标进入错误态而不是计算部分合计', async () => {
  const page = fixture();
  page.dataSources.revenue = {
    fields: { partyNumber: { type: 'string', role: 'dimension', queryField: 'partyNumber' }, amount: { type: 'number', role: 'measure', unit: '元', collapsible: true, queryField: 'amount' } },
    source: { type: 'query', resultScope: 'complete', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['partyNumber'], output_metrics: ['amount'], filter: { dims: [], metrics: [] }, order: {} }] } } }
  };
  let state: PageDataSnapshots = new Map();
  const stop = orchestrate(page, { async fetchData() { return { rows: [{ partyNumber: 'A', amount: 100 }], totalCount: 2 }; } }).subscribe(next => state = next);
  await flush();
  expect(state.get('customers')?.status).toBe('error');
  stop();
});

it('不同采集时刻的初始行不组合，统一重新请求当前批次', async () => {
  const page = fixture();
  for (const [id, source] of Object.entries(page.dataSources)) {
    const initialRows: Row[] = id === 'customers' ? [{ customerId: 'A' }] : [{ partyNumber: 'A', amount: 999 }];
    page.dataSources[id] = {
      ...source,
      fields: Object.fromEntries(Object.entries(source.fields).map(([name, field]) => [name, name === 'revenue' ? field : { ...field, queryField: name }])),
      source: { type: 'query', resultScope: 'complete', initial: { capturedAt: id === 'customers' ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z', rows: initialRows },
        query: { language: 'dqe', body: { dsl_list: [{ output_dims: [id === 'customers' ? 'customerId' : 'partyNumber'], output_metrics: id === 'customers' ? [] : ['amount'], filter: { dims: [], metrics: [] }, order: {} }] } }
      }
    };
  }
  const ids: string[] = [];
  let state: PageDataSnapshots = new Map();
  const stop = orchestrate(page, { async fetchData(_query, context) {
    const id = context!.dataSourceIds![0]; ids.push(id);
    return { rows: id === 'customers' ? [{ customerId: 'A' }] : [{ partyNumber: 'A', amount: 20 }] };
  } }).subscribe(next => state = next);
  expect(state.get('customers')?.status).toBe('loading');
  await flush();
  expect(ids.sort()).toEqual(['customers', 'revenue']);
  expect(state.get('customers')).toMatchObject({ status: 'ready', rows: [{ customerId: 'A', revenue: 20 }] });
  stop();
});
