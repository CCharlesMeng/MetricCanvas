import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import type { EffectiveQuery, TableComponent } from '@metriccanvas/page/internal';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const rows = (offset = 0, count = 20) => Array.from({ length: count }, (_, index) => ({ name: `row-${offset + index}`, value: offset + index }));
function fixture(initial = true): Page {
  return {
    schemaVersion: '6.11', id: 'automatic-tables',
    filters: [{ id: 'region', type: 'dimension', dimension: 'name', label: '区域' }],
    dataSources: { records: {
      fields: { name: { type: 'string', role: 'dimension', queryField: 'name' }, value: { type: 'number', role: 'measure', queryField: 'value' } },
      source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['value'], filter: { dims: [], metrics: [] }, order: { order_by_field: 'value', type: 'desc' } }] }, filterBindings: { region: { target: 'dimension', queryField: 'name' } } },
        ...(initial ? { initial: { capturedAt: '2026-10-12T00:00:00Z', rows: rows(), totalCount: 714 } } : {}) }
    } },
    sections: [{ id: 'main', components: [{ id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'records' }, props: { columns: [{ field: 'name' }, { field: 'value' }] } }] }]
  };
}
const table = (page: Page) => page.sections[0]!.components[0] as TableComponent;

describe('automatic query table pagination', () => {
  it('reuses the first screen, fetches later pages and retains page size on the last page', async () => {
    const received: EffectiveQuery[] = [];
    let snapshots: PageDataSnapshots = new Map();
    const page = fixture();
    const before = JSON.stringify(page);
    const stream = orchestrate(page, { async fetchData(query) {
      received.push(query);
      const offset = query.pagination?.offset ?? 0;
      return { rows: rows(offset, Math.min(20, 714 - offset)), totalCount: 714 };
    } });
    const unsubscribe = stream.subscribe(next => { snapshots = next; });
    expect(received).toHaveLength(0);
    stream.setQueryPage('records', 1);
    await flush();
    expect(received[0]?.pagination).toEqual({ offset: 20, limit: 20 });
    expect(snapshots.get('records')).toMatchObject({ status: 'ready' });
    const secondPage = snapshots.get('records');
    expect(secondPage?.status === 'ready' ? secondPage.rows[0]?.name : undefined).toBe('row-20');
    stream.setQueryPage('records', 35);
    await flush();
    expect(received[1]?.pagination).toEqual({ offset: 700, limit: 20 });
    expect(snapshots.get('records')).toMatchObject({ status: 'ready', totalCount: 714 });
    const lastPage = snapshots.get('records');
    expect(lastPage?.status === 'ready' ? lastPage.rows : []).toHaveLength(14);
    expect(stream.captureQueries().get('records')?.pagination?.limit).toBe(20);
    expect(JSON.stringify(page)).toBe(before);
    unsubscribe();
  });

  it('activates after the first dynamic result without fetching the first page twice', async () => {
    const received: EffectiveQuery[] = [];
    const stream = orchestrate(fixture(false), { async fetchData(query) { received.push(query); return { rows: rows(query.pagination?.offset ?? 0), totalCount: 1000 }; } });
    const unsubscribe = stream.subscribe(() => {});
    await flush();
    expect(received).toHaveLength(1);
    stream.setQueryPage('records', 49);
    await flush();
    expect(received[1]?.pagination).toEqual({ offset: 980, limit: 20 });
    unsubscribe();
  });

  it('resets to the first page on filters and never falls back to initial after a query error', async () => {
    const page = fixture();
    const filters = createFilterState();
    const received: EffectiveQuery[] = [];
    let snapshots: PageDataSnapshots = new Map();
    const stream = orchestrate(page, { async fetchData(query) { received.push(query); if (received.length === 3) throw new Error('page failed'); return { rows: rows(query.pagination?.offset ?? 0), totalCount: 714 }; } }, filters);
    const unsubscribe = stream.subscribe(next => { snapshots = next; });
    stream.setQueryPage('records', 2); await flush();
    filters.write('region', { type: 'dimension', dimension: 'name', values: ['B'] }); await flush();
    expect(received[1]?.pagination).toEqual({ offset: 0, limit: 20 });
    stream.setQueryPage('records', 1); await flush();
    expect(snapshots.get('records')?.status).toBe('error');
    unsubscribe();
  });

  it.each(['none', 'shared', 'dependency', 'missing-total', 'complete', 'computed', 'offset'] as const)('does not infer query pagination for %s', async mode => {
    const page = fixture();
    const source = page.dataSources.records!;
    if (mode === 'none') table(page).props.pagination = { mode: 'none' };
    if (mode === 'shared') page.sections[0]!.components.push({ ...table(page), id: 'second-table' });
    if (mode === 'dependency') page.dataSources.dependent = { fields: { value: { type: 'number', role: 'measure' } }, source: { type: 'inline', rows: [] }, compute: [{ op: 'joinAggregate', source: 'records', keys: [], values: [], onMissing: 'null' }] };
    if (source.source.type !== 'query') throw Error('fixture');
    if (mode === 'missing-total') delete source.source.initial!.totalCount;
    if (mode === 'complete') source.source.initial!.totalCount = 20;
    if (mode === 'computed') source.compute = [{ op: 'grandTotal', measures: ['value'], rowKind: { field: 'kind', value: 'total' }, label: { field: 'name', value: '合计' } }];
    if (mode === 'offset') source.source.query.body!.dsl_list[0]!.order = { offset: 20, limit: 20 };
    const received: EffectiveQuery[] = [];
    const stream = orchestrate(page, { async fetchData(query) { received.push(query); return { rows: rows(), totalCount: 714 }; } });
    const unsubscribe = stream.subscribe(() => {});
    stream.setQueryPage('records', 1); await flush();
    expect(received).toHaveLength(0);
    unsubscribe();
  });
});
