import { expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import type { EffectiveQuery, Row } from '@metriccanvas/page/internal';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { effectiveDqeItem, createDqeGateway } from '@metriccanvas/data-execution/dqe';
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const fixture = (): Page => ({ schemaVersion: '6.21', id: 'query-search', dataSources: { records: {
  fields: { name: { type: 'string', role: 'dimension', queryField: '客户' }, value: { type: 'number', role: 'measure', queryField: '金额' } },
  source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['金额'], order: { offset: 0, limit: 10 } }] } } }
} }, sections: [{ id: 'main', components: [{ id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'records' }, props: { pagination: { mode: 'query' }, toolbar: { search: { fields: ['name'] } }, columns: [{ field: 'name' }, { field: 'value' }] } }] }] });
it('searches beyond the current page, resets offset, captures scope and restores paging on clear', async () => {
  const rows: Row[] = Array.from({ length: 35 }, (_, index) => ({ name: `客户${index + 1}`, value: index + 1 }));
  const calls: EffectiveQuery[] = []; let snapshots: PageDataSnapshots = new Map();
  const page = fixture(); const before = JSON.stringify(page);
  const stream = orchestrate(page, { async fetchData(query) {
    calls.push(query);
    const matching = query.search ? rows.filter(row => String(row.name).includes(query.search!.query)) : rows;
    return { rows: matching.slice(query.pagination?.offset ?? 0, (query.pagination?.offset ?? 0) + (query.pagination?.limit ?? 10)), totalCount: matching.length };
  } });
  const dispose = stream.subscribe(value => { snapshots = value; }); await flush();
  stream.setQueryPage('records', 2); await flush();
  stream.setQuerySearch('records', { fields: ['name'], query: ' 客户35 ' }); await flush();
  expect(calls.at(-1)).toMatchObject({ search: { queryFields: ['客户'], query: '客户35' }, pagination: { offset: 0, limit: 10 } });
  expect(snapshots.get('records')).toMatchObject({ status: 'ready', rows: [rows[34]], totalCount: 1 });
  expect(stream.captureQueries().get('records')?.search?.query).toBe('客户35');
  stream.setQuerySearch('records', { fields: ['name'], query: '' }); await flush();
  expect(snapshots.get('records')).toMatchObject({ rows: rows.slice(0, 10), totalCount: 35 });
  expect(JSON.stringify(page)).toBe(before); dispose();
});
it('fails explicitly before transport when the real DQE search encoder is absent', async () => {
  const source = fixture().dataSources.records;
  const query: EffectiveQuery = { language: 'dqe', body: { dsl_list: [{}] }, fieldMappings: source.fields, filterValues: [], search: { queryFields: ['客户'], query: '%_test' } };
  expect(() => effectiveDqeItem(query)).toThrow('全表文本搜索能力');
  let fetched = false;
  const gateway = createDqeGateway({ fetchImpl: async () => { fetched = true; throw new Error('transport must not run'); } });
  await expect(gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' }); expect(fetched).toBe(false);
});
