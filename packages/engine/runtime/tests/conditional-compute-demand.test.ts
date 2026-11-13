import { expect, it } from 'vitest';
import example from '../../../../pages/capabilities/data/conditional-compute-demand.json';
import { parsePage } from '@metriccanvas/page';
import { resolvePeriodSelection, type DataSnapshot, type EffectiveQuery, type Page } from '@metriccanvas/page/internal';
import { initialFilterValues, presentationQuerySources, createSourceProgram } from '@metriccanvas/data-execution/runtime';
import { createPageDataExecutor } from '@metriccanvas/data-execution';
import { createFilterState } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import { prepareExportSnapshots } from '../src/export-snapshots';

const now = new Date('2026-11-13T04:00:00Z');
const flush = () => new Promise(resolve => setTimeout(resolve, 20));
function fixture(): Page {
  const parsed = parsePage(structuredClone(example));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
function state(page: Page) { return createFilterState(initialFilterValues(page.filters ?? [], now)); }
function period(mode: 'month' | 'quarter' | 'year') {
  return { type: 'timeRange' as const, ...resolvePeriodSelection({ mode, value: { month: '2026-09', quarter: '2026-Q3', year: '2026' }[mode] }, now, 'month') };
}
function gateway(requests: EffectiveQuery[], failure?: string) {
  return { async fetchData(query: EffectiveQuery) {
    requests.push(query);
    const metrics = query.body.dsl_list[0].output_metrics ?? [];
    if (failure && Array.isArray(metrics) && metrics.includes(failure)) throw Object.assign(Error('synthetic failure'), { code: 'DQE_QUERY_REJECTED' });
    const row = Object.fromEntries(Object.entries(query.fieldMappings).filter(([, field]) => 'queryField' in field).map(([id, field]) => [id, field.role === 'dimension' ? '合成组织' : 10]));
    return { rows: [row], totalCount: 1 };
  } };
}
function outputs(requests: EffectiveQuery[]) { return requests.flatMap(query => query.body.dsl_list.flatMap(item => item.output_metrics ?? [])); }

it('switches period-specific joins without rejecting the main source or mutating the page', async () => {
  const page = fixture(), original = structuredClone(page), filters = state(page), requests: EffectiveQuery[] = [];
  let snapshots = new Map<string, DataSnapshot>();
  const stream = orchestrate(page, gateway(requests), filters, undefined, undefined, { now });
  const dispose = stream.subscribe(value => snapshots = new Map(value));
  for (const mode of ['month', 'quarter', 'year'] as const) {
    requests.length = 0;
    filters.write('period', period(mode));
    await flush();
    expect(snapshots.get('trend')).toMatchObject({ status: 'ready', rows: [{ name: '合成组织', amount: 10, average: 10, [`change-${mode}`]: 10 }] });
    expect([...new Set(outputs(requests).filter(metric => typeof metric === 'string' && metric.startsWith('change-')))]).toEqual([`change-${mode}`]);
    expect(stream.captureQueries().has(`change-${mode}`)).toBe(true);
  }
  expect(page).toEqual(original);
  dispose();
});

it('keeps shared consumers and calculations as strict dependencies', async () => {
  const page = fixture(), filters = state(page), requests: EffectiveQuery[] = [];
  const shared = { id: 'shared', type: 'barChart' as const, layout: { span: 12 }, data: { main: 'trend' }, props: { categoryField: 'name', series: [{ field: 'amount' }] } };
  page.sections[1].components.push(shared);
  const context = {declarations:page.filters??[],filters:initialFilterValues(page.filters??[],now)};
  expect(presentationQuerySources(page,context).get('trend')?.compute).not.toEqual(expect.arrayContaining([expect.objectContaining({source:'change-quarter'})]));
  shared.props.series = [{field:'change-quarter'}];
  let latest = new Map<string, DataSnapshot>();
  const dispose = orchestrate(page, gateway(requests), filters, undefined, undefined, { now }).subscribe(value => latest = new Map(value));
  await flush();
  expect(latest.get('trend')).toMatchObject({ status: 'error', error: { code: 'DQE_QUERY_REJECTED' } });
  dispose();
  page.sections[1].components.pop();
  page.dataSources.trend.fields.derived = { type: 'number', role: 'measure' };
  page.dataSources.trend.compute = [...page.dataSources.trend.compute!, { op: 'sumFields', fields: ['change-quarter'], output: 'derived', onMissing: 'null' }];
  const sources = presentationQuerySources(page, { declarations: page.filters ?? [], filters: initialFilterValues(page.filters ?? [], now) });
  expect(sources.get('trend')?.compute).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'change-quarter' })]));
});

it('propagates errors from visible dependencies instead of treating rejections as empty', async () => {
  const page = fixture(), requests: EffectiveQuery[] = [];
  let latest = new Map<string, DataSnapshot>();
  const dispose = orchestrate(page, gateway(requests, 'change-month'), state(page), undefined, undefined, { now }).subscribe(value => latest = new Map(value));
  await flush();
  expect(latest.get('trend')).toMatchObject({ status: 'error', error: { code: 'DQE_QUERY_REJECTED' } });
  dispose();
});

it('uses the same projected dependencies for frozen exports and one-shot execution', async () => {
  const page = fixture(), conditions = initialFilterValues(page.filters ?? [], now), requests: EffectiveQuery[] = [];
  const port = gateway(requests), program = createSourceProgram(page, { gateway: port, now });
  const captured = program.captureQueries(conditions, new Map(), new Map());
  const snapshots = await prepareExportSnapshots(page, port, captured, conditions, new AbortController().signal, undefined, 2026);
  expect(snapshots.get('trend')).toMatchObject({ status: 'ready' });
  expect(outputs(requests)).not.toContain('change-quarter');
  expect(outputs(requests)).not.toContain('change-year');
  program.dispose();
  requests.length = 0;
  const result = await createPageDataExecutor({ gateway: port, now }).execute(page);
  expect(parsePage(result).ok).toBe(true);
  expect(result.dataSources.trend.source).not.toHaveProperty('initial');
  expect(outputs(requests)).not.toContain('change-quarter');
  expect(outputs(requests)).not.toContain('change-year');
});

it('protects view fields and exports only frozen consumers even with a shared program', async () => {
  const page = fixture(), conditions = initialFilterValues(page.filters ?? [], now), requests: EffectiveQuery[] = [];
  const view = { pageIndex: 0, pageSize: 20, sort: [{field:'change-quarter',direction:'desc' as const}], predicates: [] };
  const protectedSources = presentationQuerySources(page, { declarations: page.filters ?? [], filters: conditions }, { views: new Map([['trend', view]]) });
  expect(protectedSources.get('trend')?.compute).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'change-quarter' })]));
  const tablePage = structuredClone(page);
  tablePage.sections[1].components.shift();
  page.sections[1].components.push({ id: 'shared', type: 'barChart', layout: { span: 12 }, data: { main: 'trend' }, props: { categoryField: 'name', series: [{ field: 'change-quarter' }] } });
  const port = gateway(requests), program = createSourceProgram(page, { gateway: port, now });
  const snapshots = await prepareExportSnapshots(tablePage, port, new Map(), conditions, new AbortController().signal, undefined, 2026, [], undefined, program);
  expect(snapshots.get('trend')).toMatchObject({ status: 'ready' });
  expect(outputs(requests)).not.toContain('change-quarter');
  program.dispose();
});

it('cancels a no-longer-consumed join and ignores its late receipt when switching periods', async () => {
  const page = fixture(), filters = state(page), requests: EffectiveQuery[] = [];
  const port = gateway(requests);
  let oldSignal: AbortSignal | undefined;
  let finish: ((value: {rows:{name:string;value:number}[];totalCount:number}) => void) | undefined;
  let latest = new Map<string, DataSnapshot>();
  const stream = orchestrate(page, { async fetchData(query, diagnostics, signal) {
    if (diagnostics?.dataSourceIds?.includes('change-month') && !finish) {
      oldSignal = signal;
      return new Promise<{rows:{name:string;value:number}[];totalCount:number}>(resolve => finish = resolve);
    }
    return port.fetchData(query);
  } }, filters, undefined, undefined, { now });
  const dispose = stream.subscribe(value => latest = new Map(value));
  await flush();
  filters.write('period', period('quarter'));
  await flush();
  expect(oldSignal?.aborted).toBe(true);
  finish!({rows:[{name:'迟到旧组织',value:999}],totalCount:1});
  await flush();
  expect(latest.get('trend')).toMatchObject({status:'ready',rows:[{name:'合成组织','change-quarter':10}]});
  expect(latest.get('trend')).not.toHaveProperty('rows.0.change-month');
  filters.write('period', period('month'));
  await flush();
  expect(latest.get('trend')).toMatchObject({status:'ready',rows:[{name:'合成组织','change-month':10}]});
  dispose();
});

it('prunes nested unused joins even when a read explicitly includes its active dependency closure', async () => {
  const page = fixture(), conditions = initialFilterValues(page.filters ?? [], now), requests: EffectiveQuery[] = [];
  const monthly = page.dataSources['change-month'];
  monthly.fields.unused = {type:'number',role:'measure',nullable:true};
  monthly.compute = [{op:'joinAggregate',source:'change-quarter',keys:[{local:'name',foreign:'name'}],values:[{field:'value',output:'unused',aggregate:'unique'}],onMissing:'null'}];
  const program = createSourceProgram(page, {gateway:gateway(requests),now});
  let snapshot: DataSnapshot | undefined;
  for await (const update of program.read({roots:['trend','baseline','change-month'],conditions})) if (update.sourceId === 'trend') snapshot = update.snapshot;
  expect(snapshot).toMatchObject({status:'ready'});
  expect(outputs(requests)).not.toContain('change-quarter');
  expect(page.dataSources['change-month'].compute).toHaveLength(1);
  program.dispose();
});

it('keeps the category domain when all computed series are hidden', async () => {
  const page = fixture(), requests: EffectiveQuery[] = [];
  page.sections[1].components.pop();
  const chart = page.sections[1].components[0];
  if (chart.type !== 'barChart') throw Error('chart fixture');
  for (const series of chart.props.series) series.visibleWhen = {filter:'scope',part:'values',op:'containsAny',values:['B']};
  let latest = new Map<string, DataSnapshot>();
  const dispose = orchestrate(page,gateway(requests),state(page),undefined,undefined,{now}).subscribe(value => latest = new Map(value));
  await flush();
  expect(requests).toHaveLength(1);
  expect(requests[0].body.dsl_list[0].output_metrics).toEqual([]);
  expect(latest.get('trend')).toMatchObject({status:'ready',rows:[{name:'合成组织'}]});
  dispose();
});
