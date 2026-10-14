import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, resolvePageParams, type PageDocument } from '@metriccanvas/page';
import type { DataRow, EffectiveQuery } from '@metriccanvas/page/internal';
import { createPageDataExecutor, type DataGateway } from '../src';
import { orchestrate } from '../../engine/runtime/src/orchestrator';
import { createFilterState } from '../../engine/runtime/src/filter-state';

const main = 'project-efficiency-bottom5';
const detail = `${main}-stages`;
const fixture = (): PageDocument => JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/query-cascade-page.json', import.meta.url), 'utf8'));
const projects = (id = 'A'): DataRow[] => [{ 'commerce-id': id, 'customer-name': '客户', 'project-name': '项目', 'decision-time': 2 }];
const stages = (id = 'A'): DataRow[] => [{ 'commerce-id': id, 'stage-name': '代表处SDT', 'decision-time': 0, 'decision-count': 3 }];

function withParams(): PageDocument {
  const page = fixture();
  page.params = { query: { times: [{ id: 'period', granularity: 'month', start: '2026-09', end: '2026-09' }] } };
  for (const id of [main, detail]) {
    const source = page.dataSources[id].source;
    if (source.type === 'query') source.query.body.dsl_list[0].filter = {
      time: { period: 'month', param: 'period' }, dims: [], metrics: []
    };
  }
  return page;
}

function initial(page: PageDocument, id: string, rows: DataRow[], capturedAt = '2026-09-01T00:00:00Z') {
  const source = page.dataSources[id].source;
  if (source.type !== 'query') throw new Error('fixture source');
  source.initial = { capturedAt, rows, totalCount: rows.length };
}

describe('complete metadata execution', () => {
  it('materializes params, cascades once, keeps raw fields and feeds the engine without another query', async () => {
    const input = withParams(), before = structuredClone(input);
    const queries: Array<{ id: string; query: EffectiveQuery }> = [];
    const gateway: DataGateway = { async fetchData(query, context) {
      const id = context!.dataSourceIds![0]; queries.push({ id, query });
      return id === main ? { rows: projects(), totalCount: 99 } : { rows: stages(), totalCount: 1 };
    } };
    const result = await createPageDataExecutor({ gateway }).execute(input);
    expect(input).toEqual(before);
    expect(queries.map(call => call.id)).toEqual([main, detail]);
    expect(queries[0].query.body.dsl_list[0].filter).toMatchObject({ time: { start: '2026-09', end: '2026-09' } });
    expect(queries[1].query.filterValues).toEqual([{ target: 'dimension', queryField: '商务编号', values: ['A'] }]);
    expect(result.params).toEqual(input.params);
    const source = result.dataSources[main].source;
    expect(source).toMatchObject({ initial: { totalCount: 99, rows: [{ '商务编号': 'A', 'SDT成员决策时长': 2 }] } });
    expect(source).toMatchObject({ query: { body: { dsl_list: [{ filter: { time: { param: 'period' } } }] } } });
    expect(result.sections).toEqual(input.sections);
    expect(result.dataSources[main].compute).toEqual(input.dataSources[main].compute);
    const parsed = resolvePageParams(result);
    if (!parsed.ok) throw new Error('returned document');
    let snapshots: import('../../engine/runtime/src').PageDataSnapshots = new Map();
    const noFetch: DataGateway = { fetchData: () => { throw new Error('unexpected browser query'); } };
    const stop = orchestrate(parsed.resolvedPage, noFetch).subscribe(value => snapshots = value);
    expect(snapshots.get(main)).toMatchObject({ status: 'ready', rows: [{ 'commerce-id': 'A', 'rep-office-time': 0, 'rep-office-count': 3 }] });
    stop();
  });

  it('always fetches fresh results and replaces successful initial without losing the total', async () => {
    const page = fixture();
    initial(page, main, [{ '客户名称': '旧客户', '项目名称': '旧项目', '商务编号': 'OLD', 'SDT成员决策时长': 9 }]);
    const ids: string[] = [];
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      const id = context!.dataSourceIds![0]; ids.push(id);
      return id === main ? { rows: projects('NEW'), totalCount: 30 } : { rows: stages('NEW'), totalCount: 1 };
    } } }).execute(page);
    expect(ids).toEqual([main, detail]);
    expect(result.dataSources[main].source).toMatchObject({ initial: { totalCount: 30, rows: [{ '商务编号': 'NEW' }] } });
  });

  it('preserves failed old initial and never uses failed upstream old rows for downstream requests', async () => {
    const page = fixture();
    initial(page, main, [{ '客户名称': '旧客户', '项目名称': '旧项目', '商务编号': 'OLD', 'SDT成员决策时长': 9 }]);
    initial(page, detail, [{ '商务编号': 'OLD', '阶段名称': '代表处SDT', 'SDT成员决策时长': 8, 'SDT成员决策次数': 1 }]);
    const ids: string[] = [];
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      ids.push(context!.dataSourceIds![0]); throw new Error('failed');
    } } }).execute(page);
    expect(ids).toEqual([main]);
    expect(result).toEqual(page);
  });

  it('fills independent and unused sources even when one cascade fails', async () => {
    const page = fixture();
    page.dataSources.unused = structuredClone(page.dataSources[main]);
    delete page.dataSources.unused.compute;
    page.dataSources.unused.fields = Object.fromEntries(Object.entries(page.dataSources.unused.fields).filter(([, field]) => 'queryField' in field));
    const ids: string[] = [];
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      const id = context!.dataSourceIds![0]; ids.push(id);
      if (id === main) throw new Error('failed');
      return { rows: projects(), totalCount: 1 };
    } } }).execute(page);
    expect(ids.sort()).toEqual([main, 'unused'].sort());
    expect(result.dataSources[main].source).not.toHaveProperty('initial');
    expect(result.dataSources[detail].source).not.toHaveProperty('initial');
    expect(result.dataSources.unused.source).toHaveProperty('initial');
  });

  it('writes empty upstream and dependent initial without an unfiltered detail request', async () => {
    let calls = 0;
    const result = await createPageDataExecutor({ gateway: { async fetchData() { calls++; return { rows: [], totalCount: 0 }; } } }).execute(fixture());
    expect(calls).toBe(1);
    for (const id of [main, detail]) expect(result.dataSources[id].source).toMatchObject({ initial: { rows: [], totalCount: 0 } });
  });

  it('keeps old detail after failure, including a different capture time, and permits the engine to display it', async () => {
    const page = fixture();
    initial(page, detail, [{ '商务编号': 'A', '阶段名称': '代表处SDT', 'SDT成员决策时长': 8, 'SDT成员决策次数': 1 }]);
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      if (context!.dataSourceIds![0] === detail) throw new Error('failed');
      return { rows: projects(), totalCount: 1 };
    } } }).execute(page);
    expect(result.dataSources[detail]).toEqual(page.dataSources[detail]);
    const parsed = parsePage(result); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const fetchData = () => { throw new Error('unexpected query'); };
    const stream = orchestrate(parsed.page, { fetchData });
    let snapshots: import('../../engine/runtime/src').PageDataSnapshots = new Map();
    const stop = stream.subscribe(value => snapshots = value);
    expect(snapshots.get(main)).toMatchObject({ status: 'ready', rows: [{ 'rep-office-time': 8 }] });
    stop();
  });

  it('retries missing details using retained main initial, then refreshes the cascade on filter changes', async () => {
    const page = fixture();
    initial(page, main, [{ '客户名称': '客户', '项目名称': '项目', '商务编号': 'A', 'SDT成员决策时长': 2 }]);
    page.filters = [{ id: 'region', type: 'dimension', dimension: 'customer' }];
    const source = page.dataSources[main].source;
    if (source.type !== 'query') throw new Error('fixture');
    source.query.filterBindings = { region: { target: 'dimension', queryField: '客户名称' } };
    const parsed = parsePage(page); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const queries: Array<{ id: string; query: EffectiveQuery }> = [];
    const filters = createFilterState();
    const gateway: DataGateway = { async fetchData(query, context) {
      const id = context!.dataSourceIds![0]; queries.push({ id, query });
      return id === main ? { rows: projects('B'), totalCount: 1 } : { rows: stages(queries.length === 1 ? 'A' : 'B'), totalCount: 1 };
    } };
    const stop = orchestrate(parsed.page, gateway, filters).subscribe(() => {});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(queries.map(call => call.id)).toEqual([detail]);
    expect(queries[0].query.filterValues).toEqual([{ target: 'dimension', queryField: '商务编号', values: ['A'] }]);
    filters.write('region', { type: 'dimension', dimension: 'customer', values: ['西区'] });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(queries.map(call => call.id)).toEqual([detail, main, detail]);
    expect(queries[2].query.filterValues).toEqual([{ target: 'dimension', queryField: '商务编号', values: ['B'] }]);
    stop();
  });

  it('does not replace old initial when the gateway violates the row contract or complete scope', async () => {
    const page = fixture();
    initial(page, detail, [{ '商务编号': 'A', '阶段名称': '代表处SDT', 'SDT成员决策时长': 8, 'SDT成员决策次数': 1 }]);
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      return context!.dataSourceIds![0] === main ? { rows: projects(), totalCount: 1 } : { rows: stages(), totalCount: 2 };
    } } }).execute(page);
    expect(result.dataSources[detail]).toEqual(page.dataSources[detail]);
  });

  it('clears affected initial before a condition change and preserves data for a display-only change', async () => {
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      return context!.dataSourceIds![0] === main ? { rows: projects(), totalCount: 1 } : { rows: stages(), totalCount: 1 };
    } } }).execute(withParams());
    const changed = resolvePageParams(result, { period: { start: '2026-10', end: '2026-10' } });
    if (!changed.ok) throw new Error(JSON.stringify(changed.issues));
    for (const id of [main, detail]) expect(changed.document.dataSources[id].source).not.toHaveProperty('initial');
    const gateway: DataGateway = { async fetchData() { throw new Error('unavailable'); } };
    const failed = await createPageDataExecutor({ gateway }).execute(changed.document);
    for (const id of [main, detail]) expect(failed.dataSources[id].source).not.toHaveProperty('initial');
    if (!result.params || Array.isArray(result.params)) throw new Error('grouped fixture');
    result.params.display = [{ id: 'heading', type: 'string', value: 'Old title' }];
    const displayDocument = { ...result, sections: [...result.sections, { id: 'heading-section', components: [{ id: 'heading-text', type: 'text', layout: { span: 12 }, props: { body: { param: 'heading' } } }] }] };
    const display = resolvePageParams(displayDocument, { heading: 'New title' });
    if (!display.ok) throw new Error(JSON.stringify(display.issues));
    for (const id of [main, detail]) expect(display.document.dataSources[id].source).toHaveProperty('initial');
  });

  it('keeps click-time query detail unchanged, while executing snapshot details and unused sources', async () => {
    const page: PageDocument = JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));
    const ids: string[] = [];
    const result = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      ids.push(context!.dataSourceIds![0]); return { rows: [], totalCount: 0 };
    } } }).execute(page);
    expect(ids).toEqual([]);
    expect(result).toEqual(page);
    const source = page.dataSources.detail.source;
    if (source.type !== 'query') throw new Error('fixture');
    page.dataSources.unused = structuredClone(page.dataSources.detail);
    const unused = page.dataSources.unused.source;
    if (unused.type !== 'query') throw new Error('fixture');
    delete unused.query.filterBindings;
    const filled = await createPageDataExecutor({ gateway: { async fetchData(_q, context) {
      ids.push(context!.dataSourceIds![0]); return { rows: [], totalCount: 0 };
    } } }).execute(page);
    expect(ids).toEqual(['unused']);
    expect(filled.dataSources.detail).toEqual(page.dataSources.detail);
    expect(filled.dataSources.unused.source).toHaveProperty('initial');
  });

  it('deduplicates identical effective queries within one call without reusing data across calls', async () => {
    const page = fixture();
    page.dataSources.twin = structuredClone(page.dataSources[main]);
    delete page.dataSources.twin.compute;
    page.dataSources.twin.fields = Object.fromEntries(Object.entries(page.dataSources.twin.fields).filter(([, field]) => 'queryField' in field));
    page.dataSources['twin-two'] = structuredClone(page.dataSources.twin);
    const calls: string[] = [];
    const executor = createPageDataExecutor({ gateway: { async fetchData(_query, context) {
      const id = context!.dataSourceIds![0]; calls.push(id);
      return id === detail ? { rows: stages(), totalCount: 1 } : { rows: projects(), totalCount: 1 };
    } } });
    const first = await executor.execute(page);
    expect(calls).toEqual([main, 'twin', detail]);
    expect(first.dataSources.twin.source).toHaveProperty('initial');
    await executor.execute(first);
    expect(calls).toEqual([main, 'twin', detail, main, 'twin', detail]);
  });
});
