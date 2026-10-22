import { expect, it, vi } from 'vitest';
import { parsePage, normalizePageDocument } from '@metriccanvas/page';
import type { EffectiveQuery, DataSnapshot } from '@metriccanvas/page/internal';
import fixture from '../../../page/fixtures/contract-valid/tab-mixed-content.json';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState, initialFilterValues } from '../src/filter-state';
import { createPageDataExecutor } from '@metriccanvas/data-execution';
import type { DataGateway } from '../src/ports';
import { prepareExportSnapshots } from '../src/export-snapshots';

function loaded() { const result = parsePage(fixture); if (!result.ok) throw Error(JSON.stringify(result.errors)); return result.page; }
it('loads active dependency closure, retains inactive results and defers dirty hidden sources', async () => {
  const page = loaded();
  const filters = createFilterState(initialFilterValues(page.filters ?? []), page.filters);
  const requests: EffectiveQuery[] = [];
  const gateway: DataGateway = { async fetchData(query) { requests.push(query); return { rows: [{ category: '类别', value: 10 }], totalCount: 1 }; } };
  const stream = orchestrate(page, gateway, filters);
  let snapshots: PageDataSnapshots = new Map();
  const stop = stream.subscribe(next => snapshots = next);
  try {
    await vi.waitFor(() => expect(snapshots.get('orders-data')?.status).toBe('ready'));
    expect(requests).toHaveLength(1);
    expect(snapshots.get('revenue-data')?.status).toBe('loading');
    stream.setActiveTabs({ analysis: 'details' });
    await vi.waitFor(() => expect(snapshots.get('revenue-data')?.status).toBe('ready'));
    await vi.waitFor(() => expect(snapshots.get('summary-data')?.status).toBe('ready'));
    expect(requests).toHaveLength(3);
    stream.setActiveTabs({ analysis: 'overview' });
    expect(requests).toHaveLength(3);
    filters.write('domestic', { type: 'boolean', value: true });
    await vi.waitFor(() => expect(snapshots.get('orders-data')?.status).toBe('ready'));
    expect(requests).toHaveLength(4);
    expect(snapshots.get('revenue-data')?.status).toBe('loading');
    stream.setActiveTabs({ analysis: 'details' });
    // OVERSEAS AND CN produces empty without invoking the gateway.
    await vi.waitFor(() => expect(snapshots.get('revenue-data')).toEqual({ status: 'empty', totalCount: 0 }));
    expect(filters.toURL()).toContain('revenue-region=OVERSEAS');
  } finally { stop(); }
});
it('shared one-shot execution follows the default Tab; Report complete reads still expand all Tabs', async () => {
  const calls: EffectiveQuery[] = [];
  const gateway: DataGateway = { async fetchData(query) { calls.push(query); return { rows: [{ category: '类别', value: 7 }], totalCount: 1 }; } };
  const metadata = normalizePageDocument(fixture); if (!metadata.ok) throw Error('fixture');
  const result = await createPageDataExecutor({ gateway }).execute(metadata.document);
  expect(calls).toHaveLength(1);
  expect(result.dataSources['revenue-data'].source).not.toHaveProperty('initial');
  calls.length = 0;
  const page = loaded();
  const snapshots = await prepareExportSnapshots(page, gateway, new Map(), initialFilterValues(page.filters ?? []), new AbortController().signal);
  expect(snapshots.get('revenue-data')?.status).toBe('ready');
  expect(snapshots.get('summary-data')?.status).toBe('ready');
  expect(calls).toHaveLength(3);
});
it('an obsolete hidden response cannot overwrite the new filter generation', async () => {
  const page = loaded(), filters = createFilterState(initialFilterValues(page.filters ?? []));
  let release: ((value: { rows: { category: string; value: number }[]; totalCount: number }) => void) | undefined;
  const gateway: DataGateway = { fetchData(query) {
    if (JSON.stringify(query.body.dsl_list[0].output_metrics).includes('chart_demo_revenue')) return new Promise(resolve => release = resolve);
    return Promise.resolve({ rows: [{ category: '类别', value: 7 }], totalCount: 1 });
  } };
  const stream = orchestrate(page, gateway, filters);
  let snapshots: ReadonlyMap<string, DataSnapshot> = new Map();
  const stop = stream.subscribe(next => snapshots = next);
  try {
    stream.setActiveTabs({ analysis: 'details' });
    await vi.waitFor(() => expect(release).toBeDefined());
    stream.setActiveTabs({ analysis: 'overview' });
    filters.write('domestic', { type: 'boolean', value: true });
    release!({ rows: [{ category: '迟到旧数据', value: 999 }], totalCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(snapshots.get('revenue-data')?.status).toBe('loading');
    stream.setActiveTabs({ analysis: 'details' });
    await vi.waitFor(() => expect(snapshots.get('revenue-data')?.status).toBe('empty'));
  } finally { stop(); }
});

it('a contradictory default condition never displays nonempty embedded initial rows', () => {
  const page = loaded();
  const publicFilter = page.filters?.find(filter => filter.id === 'domestic');
  if (publicFilter?.type !== 'boolean') throw Error('fixture');
  publicFilter.default = true;
  const source = page.dataSources['revenue-data'].source;
  if (source.type !== 'query') throw Error('fixture');
  source.initial = { capturedAt: '2026-10-22T00:00:00Z', rows: [{ chart_demo_category: '旧海外结果', chart_demo_revenue: 999 }] };
  const gateway: DataGateway = { async fetchData() { return { rows: [] }; } };
  const stream = orchestrate(page, gateway, undefined, undefined, undefined, undefined, { analysis: 'details' });
  let snapshots: PageDataSnapshots = new Map();
  const stop = stream.subscribe(next => snapshots = next);
  expect(snapshots.get('revenue-data')).toEqual({ status: 'empty', totalCount: 0 });
  stop();
});
