import { expect, it } from 'vitest';
import example from '../../../../pages/capabilities/data/conditional-query-demand.json';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, DisplaySnapshot, EffectiveQuery, Page, TableComponent } from '@metriccanvas/page/internal';
import { activeSourceIds, presentationQuerySources, createSourceProgram } from '@metriccanvas/data-execution/runtime';
import { createPageDataExecutor } from '../../../../packages/data-execution/src/execute';
import { compilePresentation } from '../src/presentation';
import { createFilterState, type FilterValue } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import { prepareExportSnapshots } from '../src/export-snapshots';
import { prepareTableExport } from '../../runtime-ui/src/table/export/prepare';

const flush = () => new Promise(resolve => setTimeout(resolve, 10));
function fixture() {
  const parsed = parsePage(structuredClone(example));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
function state(shown = true) {
  return createFilterState(new Map<string, FilterValue>([
    ['show-detail', { type: 'boolean', value: shown }], ['scope', { type: 'dimension', dimension: 'scope', values: ['A'] }]
  ]));
}
function context(filters: ReturnType<typeof state>, page: Page) {
  let values = new Map<string, FilterValue>();
  filters.subscribe(next => values = new Map(next))();
  return { declarations: page.filters ?? [], filters: values };
}
function rows(query: EffectiveQuery) {
  return [{ name: '合成对象', ...Object.fromEntries(Object.entries(query.fieldMappings).filter(([id]) => id !== 'name').map(([id]) => [id, 10])) }];
}
function gateway(requests: EffectiveQuery[]) {
  return { async fetchData(query: EffectiveQuery) { requests.push(structuredClone(query)); return { rows: rows(query), totalCount: 1 }; } };
}

it('stops hidden-only slots, narrows shared metrics and restores current filters without mutating declarations', async () => {
  const page = fixture(), before = structuredClone(page), requests: EffectiveQuery[] = [], filters = state(false);
  const stream = orchestrate(page, gateway(requests), filters), dispose = stream.subscribe(() => {});
  await flush();
  expect(requests).toHaveLength(2);
  expect(requests.every(query => !('score' in query.fieldMappings) && !('rate' in query.fieldMappings))).toBe(true);
  const rendered = compilePresentation(page).evaluate(context(filters,page)).sections[0].components[0] as TableComponent;
  expect(rendered.data).toEqual({ main: 'records' });
  filters.write('scope', { type: 'dimension', dimension: 'scope', values: ['B'] });
  await flush();
  expect(requests).toHaveLength(4);
  filters.write('show-detail', { type: 'boolean', value: true });
  await flush();
  expect(requests).toHaveLength(6);
  for (const query of requests.slice(4)) expect(query.filterValues).toEqual(expect.arrayContaining([expect.objectContaining({ values: ['B'] })]));
  expect(requests.slice(4).some(query => 'score' in query.fieldMappings)).toBe(true);
  expect(requests.slice(4).some(query => 'rate' in query.fieldMappings)).toBe(true);
  expect(page).toEqual(before);
  dispose();
});

it('unions shared consumers and keeps business ordering and calculation dependencies', () => {
  const page = fixture(), filters = state(false), input = context(filters,page);
  const chart = page.sections[0].components[1];
  page.sections[0].components.push({ ...chart, id: 'shared-chart', props: { ...chart.props } } as typeof chart);
  const shared = page.sections[0].components[2];
  if (shared.type !== 'barChart') throw Error('chart expected');
  shared.props.series = [{ field: 'rate' }];
  expect(presentationQuerySources(page,input).get('trend')).toEqual(page.dataSources.trend);
  page.sections[0].components.pop();
  const trend = page.dataSources.trend;
  if (trend.source.type !== 'query') throw Error('query expected');
  trend.source.query.body!.dsl_list[0].order = { order_by_field: 'rate', type: 'desc' };
  expect(presentationQuerySources(page,input).get('trend')).toEqual(trend);
  page.dataSources.records.compute = [{ op: 'joinAggregate', source: 'details', keys: [{local:'name',foreign:'name'}], values: [{field:'score',output:'computed',aggregate:'unique'}], onMissing: 'null' }];
  expect(activeSourceIds(page,{},input).has('details')).toBe(true);
});

it('stops an all-hidden table but preserves chart category queries and visible constants', async () => {
  const page = fixture(), filters = state(false), requests: EffectiveQuery[] = [];
  const table = page.sections[0].components[0];
  if (table.type !== 'table') throw Error('table expected');
  table.props.columns.forEach(column => column.visibleWhen = {filter:'show-detail',part:'value',op:'eq',value:true});
  const chart = page.sections[0].components[1];
  if (chart.type !== 'barChart') throw Error('chart expected');
  chart.props.series.forEach(series => series.visibleWhen = {filter:'show-detail',part:'value',op:'eq',value:true});
  const stream = orchestrate(page,gateway(requests),filters), dispose = stream.subscribe(() => {});
  await flush();
  expect(requests).toHaveLength(1);
  expect(requests[0].body.dsl_list[0]).toMatchObject({output_dims:['name'],output_metrics:[]});
  expect(Object.keys(requests[0].fieldMappings)).toEqual(['name']);
  filters.write('show-detail',{type:'boolean',value:true});
  await flush();
  expect(requests).toHaveLength(4);
  dispose();
});

it('cancels hidden-only in-flight reads and ignores late receipts when showing again', async () => {
  const page = fixture(), filters = state(), requests: EffectiveQuery[] = [];
  let finish: ((value: {rows: {name:string;score:number}[];totalCount:number}) => void) | undefined;
  let oldSignal: AbortSignal | undefined, latest = new Map<string,DataSnapshot>();
  const port = { async fetchData(query: EffectiveQuery, _diagnostics?: unknown, signal?: AbortSignal) {
    requests.push(query);
    if ('score' in query.fieldMappings && !finish) { oldSignal = signal; return new Promise<{rows:{name:string;score:number}[];totalCount:number}>(resolve => finish = resolve); }
    return {rows:rows(query),totalCount:1};
  } };
  const stream = orchestrate(page,port,filters), dispose = stream.subscribe(value => latest = new Map(value));
  await flush();
  filters.write('show-detail',{type:'boolean',value:false});
  await flush();
  expect(oldSignal?.aborted).toBe(true);
  finish!({rows:[{name:'迟到旧值',score:999}],totalCount:1});
  await flush();
  filters.write('show-detail',{type:'boolean',value:true});
  await flush();
  expect(latest.get('details')).toMatchObject({status:'ready',rows:[{name:'合成对象',score:10}]});
  dispose();
});

it('handles fact-only visibility changes, repeated synchronization and pending/error facts', async () => {
  const page = fixture(), filters = state(), requests: EffectiveQuery[] = [];
  const table = page.sections[0].components[0];
  if (table.type !== 'table') throw Error('table expected');
  table.props.columns[2].visibleWhen = {fact:'detail',op:'eq',value:true};
  let display: DisplaySnapshot = {permissionRevision:'same',permissions:{},values:{detail:{status:'pending'}}};
  const stream = orchestrate(page,gateway(requests),filters,undefined,undefined,{displayInputs:()=>display}), dispose = stream.subscribe(() => {});
  await flush();
  expect(requests).toHaveLength(2);
  display = {...display,values:{detail:{status:'ready',value:true}}};
  stream.syncPresentation?.();
  await flush();
  expect(requests).toHaveLength(3);
  stream.syncPresentation?.();
  await flush();
  expect(requests).toHaveLength(3);
  display = {...display,values:{detail:{status:'error'}}};
  stream.syncPresentation?.();
  await flush();
  expect(requests).toHaveLength(3);
  dispose();
});

it('exports the frozen visible metric set even when captured queries contain hidden fields', async () => {
  const page = fixture(), filters = state(false), requests: EffectiveQuery[] = [];
  const program = createSourceProgram(page,{gateway:gateway(requests)}), input = context(filters,page);
  const captured = program.captureQueries(input.filters,new Map(),new Map());
  await prepareExportSnapshots(page,gateway(requests),captured,input.filters,new AbortController().signal);
  expect(requests).toHaveLength(2);
  expect(requests.every(query => !('score' in query.fieldMappings) && !('rate' in query.fieldMappings))).toBe(true);
  program.dispose();
});

it('one-shot execution skips hidden-only sources and never persists a partial initial', async () => {
  const page = fixture(), requests: EffectiveQuery[] = [];
  page.filters!.find(filter => filter.id === 'show-detail')!.default = false;
  const output = await createPageDataExecutor({gateway:gateway(requests)}).execute(page);
  expect(requests).toHaveLength(2);
  expect(output.dataSources.trend.source).not.toHaveProperty('initial');
  expect(parsePage(output).ok).toBe(true);
});

it('retains shared raw aliases and filter-bound metrics while pruning independent hidden outputs', () => {
  const page = fixture(), filters = state(false), source = page.dataSources.trend;
  if (source.source.type !== 'query') throw Error('query expected');
  source.fields.alias = {...source.fields.rate};
  const chart = page.sections[0].components[1];
  if (chart.type !== 'barChart') throw Error('chart expected');
  chart.props.series.push({field:'alias'});
  expect(presentationQuerySources(page,context(filters,page)).get('trend')).toEqual(source);
  chart.props.series.pop();
  source.source.query.filterBindings!['metric-range'] = {target:'numberRange',metric:'rate'};
  expect(presentationQuerySources(page,context(filters,page)).get('trend')).toEqual(source);
});

it('does not reset pagination for a visibility-only metric projection change', async () => {
  const page = fixture(), filters = state(), requests: EffectiveQuery[] = [], table = page.sections[0].components[0];
  if (table.type !== 'table') throw Error('table expected');
  table.props.columns[1].visibleWhen = {filter:'show-detail',part:'value',op:'eq',value:true};
  table.props.pagination = {mode:'query'};
  const source = page.dataSources.records;
  if (source.source.type !== 'query') throw Error('query expected');
  source.source.query.body!.dsl_list[0].order = {limit:1};
  const port = { async fetchData(query: EffectiveQuery) {requests.push(query);return {rows:rows(query),totalCount:3};} };
  const stream = orchestrate(page,port,filters), dispose = stream.subscribe(() => {});
  await flush();
  stream.setQueryPage('records',1);
  await flush();
  filters.write('show-detail',{type:'boolean',value:false});
  await flush();
  expect(stream.getQueryView('records')?.pageIndex).toBe(1);
  expect(requests.filter(query => query.pagination).at(-1)?.pagination).toMatchObject({offset:1,limit:1});
  dispose();
});

it('table export retains the declaration when its rendered columns already lost hidden conditions', async () => {
  const page = fixture(), filters = state(false), requests: EffectiveQuery[] = [], table = page.sections[0].components[0];
  if (table.type !== 'table') throw Error('table expected');
  table.props.columns[1].visibleWhen = {filter:'show-detail',part:'value',op:'eq',value:true};
  const input = context(filters,page), projected = compilePresentation(page).evaluate(input).sections[0].components[0];
  if (projected.type !== 'table') throw Error('table expected');
  const data = await prepareTableExport({page,component:projected,queries:new Map(),gateway:gateway(requests),controller:new AbortController(),
    state:{filters:input.filters,tables:{},headerFilters:{},currentYear:2026}});
  expect(requests).toHaveLength(1);
  expect(requests[0].body.dsl_list[0].output_metrics).toEqual([]);
  expect(data.main?.snapshot.rows).toEqual([{name:'合成对象'}]);
});

it('does not abort a deduplicated request still owned by a visible consumer', async () => {
  const page = fixture(), filters = state(), table = page.sections[0].components[0];
  if (table.type !== 'table') throw Error('table expected');
  table.data = {main:'records'};
  table.props.columns = table.props.columns.slice(0,2);
  const hidden = structuredClone(table);
  hidden.id = 'hidden-table';
  hidden.data = {main:'hidden-records'};
  hidden.props.columns.forEach(column => column.visibleWhen = {filter:'show-detail',part:'value',op:'eq',value:true});
  page.dataSources['hidden-records'] = structuredClone(page.dataSources.records);
  page.sections[0].components = [table,hidden];
  let signal: AbortSignal | undefined, finish: ((value:{rows:{name:string;amount:number}[];totalCount:number})=>void) | undefined, calls = 0;
  const stream = orchestrate(page,{async fetchData(_query,_diagnostics,nextSignal) {calls++;signal=nextSignal;return new Promise<{rows:{name:string;amount:number}[];totalCount:number}>(resolve=>finish=resolve);}},filters);
  const dispose = stream.subscribe(() => {});
  await flush();
  expect(calls).toBe(1);
  filters.write('show-detail',{type:'boolean',value:false});
  expect(signal?.aborted).toBe(false);
  finish!({rows:[{name:'合成对象',amount:10}],totalCount:1});
  await flush();
  expect(stream.captureRawSnapshots().get('records')).toMatchObject({status:'ready'});
  dispose();
});

it('preserves complex metric expressions and period comparison strategies', () => {
  const page = fixture(), filters = state(false), source = page.dataSources.trend;
  if (source.source.type !== 'query') throw Error('query expected');
  const metrics = source.source.query.body!.dsl_list[0].output_metrics;
  source.source.query.body!.dsl_list[0].output_metrics = ['sales',{metric_name:'rate',formula:'sales / target'}];
  expect(presentationQuerySources(page,context(filters,page)).get('trend')).toEqual(source);
  source.source.query.body!.dsl_list[0].output_metrics = metrics;
  source.source.query.filterBindings!['period'] = {target:'time',periodComparison:{kind:'previousYear'}};
  expect(presentationQuerySources(page,context(filters,page)).get('trend')).toEqual(source);
});

it('line charts keep the category domain for visible constants while hidden field series stop querying', async () => {
  const page = fixture(), filters = state(false), requests: EffectiveQuery[] = [];
  page.sections[0].components = [{id:'line-demand',type:'lineChart',layout:{span:12},data:{main:'trend'},props:{xField:'name',series:[
    {value:2,label:'固定基线'}, {field:'rate',visibleWhen:{filter:'show-detail',part:'value',op:'eq',value:true}}
  ]}}];
  const stream = orchestrate(page,gateway(requests),filters), dispose = stream.subscribe(() => {});
  await flush();
  expect(requests).toHaveLength(1);
  expect(requests[0].body.dsl_list[0]).toMatchObject({output_dims:['name'],output_metrics:[]});
  filters.write('show-detail',{type:'boolean',value:true});
  await flush();
  expect(requests.at(-1)?.body.dsl_list[0].output_metrics).toEqual(['rate']);
  dispose();
});
