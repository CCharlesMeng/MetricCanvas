import { expect, it } from 'vitest';
import example from '../../../../pages/capabilities/navigation/missing-url-inputs.json';
import account from '../../../../pages/business/dashboard/ioc/approval/rep-business-result-account-detail.json';
import { parsePage, resolvePageParams as resolveExecutionInputs } from '@metriccanvas/page';
import { type Page, type EffectiveQuery, type DataSnapshot, type TableComponent } from '@metriccanvas/page/internal';
import { resolvePageParams } from '../../runtime/src/page-params';
import { initializeRenderablePage, missingInputSources } from '../src/page-inputs';
import { orchestrate } from '../../runtime/src/orchestrator';
import { createFilterState, initialFilterValues } from '../../runtime/src/filter-state';
import { createSourceProgram, defaultSourceView } from '@metriccanvas/data-execution/runtime';
import { prepareTableExport } from '../src/table/export/prepare';

function load(raw: unknown = example, search = ''): Page {
  const declared = parsePage(raw);
  if (!declared.ok) throw Error(JSON.stringify(declared.errors));
  const params = resolvePageParams(search, declared.page.params ?? [], {strict:true});
  const parsed = parsePage(raw, {textValues:{values:params.values,missingParams:new Set(params.missing)}});
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  return initializeRenderablePage(parsed.page,params.values,params.missing);
}
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
function gateway(calls: EffectiveQuery[]) {
  return {async fetchData(query: EffectiveQuery) { calls.push(query); return {rows:[{name:'合成新数据',amount:1}],totalCount:1}; }};
}

it('renders incomplete inputs with empty data, placeholder text and no mutation or stale initial', async () => {
  const before = structuredClone(example), page = load(), calls: EffectiveQuery[] = [];
  expect(page.sections[0].components[2].props.title).toBe('—：相关明细');
  expect(page.dataSources.detail.source).toEqual({type:'inline',rows:[]});
  expect(page.dataSources.static).toEqual(example.dataSources.static);
  const stream = orchestrate(page,gateway(calls),createFilterState(initialFilterValues(page.filters ?? [])));
  let latest = new Map<string,DataSnapshot>();
  const stop = stream.subscribe(next => latest = new Map(next));
  await flush();
  expect(latest.get('detail')?.status).toBe('empty');
  stream.setQueryPage('detail',1);
  stream.setQuerySort('detail',[{field:'amount',direction:'desc'}]);
  await flush();
  expect(calls).toEqual([]);
  expect(example).toEqual(before);
  stop();
});

it('restores bound queries when URL parameters are supplied and keeps execution validation strict', async () => {
  const page = load(example,'entity=example'), calls: EffectiveQuery[] = [];
  expect(page.dataSources.detail.source.type).toBe('query');
  const stream = orchestrate(page,gateway(calls),createFilterState(initialFilterValues(page.filters ?? [])));
  const stop = stream.subscribe(() => {});
  await flush();
  expect(calls).toHaveLength(1);
  expect(calls[0].body.dsl_list[0].filter).toMatchObject({dims:[{dim_name:'对象',dim_value_list:['example']}]});
  expect(resolveExecutionInputs(example).ok).toBe(false);
  stop();
});

it('suppresses every dependent pagedJoin member in the actual account page', () => {
  const page = load(account,'rep-office=example');
  expect(Object.values(page.dataSources).every(source => source.source.type === 'inline')).toBe(true);
  const ready = load(account,'rep-office=example&customer-name=customer');
  expect(ready.dataSources['account-detail'].source.type).toBe('pagedJoin');
});

it('uses the same empty projection for candidates and complete exports', async () => {
  const page = load(), calls: EffectiveQuery[] = [], port = gateway(calls);
  const program = createSourceProgram(page,{gateway:port});
  const conditions = initialFilterValues(page.filters ?? []);
  expect(await program.readColumnCandidates({sourceId:'detail',field:'name',conditions,view:defaultSourceView(page,'detail')}))
    .toMatchObject({kind:'values',candidates:[]});
  const table = page.sections[0].components[2] as TableComponent;
  const exported = await prepareTableExport({page,component:table,queries:new Map(),gateway:port,controller:new AbortController(),
    state:{filters:conditions,tables:{},headerFilters:{},currentYear:2026}});
  expect(exported.main?.snapshot.rows).toEqual([]);
  expect(calls).toEqual([]);
  program.dispose();
});

it('keeps unrelated query sources live while missing inputs stay empty', async () => {
  const raw = structuredClone(example);
  const independent = structuredClone(raw.dataSources.detail);
  delete (independent.source.query as {paramBindings?:unknown}).paramBindings;
  delete (independent.source as {initial?:unknown}).initial;
  Object.assign(raw.dataSources,{independent});
  const table = structuredClone(raw.sections[0].components[2]);
  Object.assign(table,{id:'independent-table',data:{main:'independent'},props:{...table.props,title:'无关查询'}});
  raw.sections[0].components.push(table);
  const page = load(raw), calls: EffectiveQuery[] = [];
  const stream = orchestrate(page,gateway(calls),createFilterState(initialFilterValues(page.filters ?? [])));
  const stop = stream.subscribe(() => {});
  await flush();
  expect(calls).toHaveLength(1);
  expect(page.dataSources.detail.source.type).toBe('inline');
  stop();
});

it('recognizes inline query references and propagates compute and result dependencies', () => {
  const raw = structuredClone(example);
  delete (raw.dataSources.detail.source.query as {paramBindings?:unknown}).paramBindings;
  Object.assign(raw.dataSources.detail.source.query.body.dsl_list[0].filter,{
    dims:[{dim_name:'对象',dim_value_list:{param:'entity'}}]
  });
  expect(load(raw).dataSources.detail.source.type).toBe('inline');
  expect(load(raw,'entity=E').dataSources.detail.source.type).toBe('query');
  const page = load(example,'entity=E');
  page.dataSources.computed = {fields:page.dataSources.static.fields,source:{type:'inline',rows:[{name:'old',amount:999}]},
    compute:[{op:'joinAggregate',source:'detail',keys:[{local:'name',foreign:'name'}],values:[{field:'amount',output:'amount',aggregate:'sum'}],onMissing:'null'}]};
  expect(missingInputSources(page,new Set(['entity']))).toEqual(new Set(['detail','computed']));
  expect(initializeRenderablePage(page,new Map(),['entity']).dataSources.computed.source).toEqual({type:'inline',rows:[]});
});

it('gates missing time inputs including queries initialized through filters', () => {
  const page = load(example,'entity=E');
  page.params!.push({id:'month',type:'timeRange',required:true,granularity:'month',path:'/params/query/times/0'});
  const filter = page.filters![0];
  if (filter.type !== 'timeRange') throw Error('timeRange expected');
  filter.initialParam = 'month';
  delete filter.default;
  const projected = initializeRenderablePage(page,new Map([['entity',['E']]]),['month']);
  expect(projected.dataSources.detail.source.type).toBe('inline');
  expect(projected.dataSources.static.source.type).toBe('inline');
});

it('does not widen queries when their filter candidate source depends on a missing input', () => {
  const page = load(example,'entity=E');
  const source = structuredClone(page.dataSources.detail);
  if (source.source.type !== 'query') throw Error('query expected');
  delete source.source.query.paramBindings;
  source.source.query.filterBindings = {choice:{target:'dimension',queryField:'对象名称'}};
  page.dataSources.scoped = source;
  page.filters!.push({id:'choice',type:'dimension',dimension:'choice',candidates:{dataSource:'detail',valueField:'name'}});
  expect(missingInputSources(page,new Set(['entity']))).toEqual(new Set(['detail','scoped']));
});

it('formats empty and repeated dimension URL values without inventing query inputs', () => {
  expect(load(example,'entity=').sections[0].components[2].props.title).toBe('—：相关明细');
  const page = load(example,'entity=one&entity=two');
  expect(page.sections[0].components[2].props.title).toBe('one、two：相关明细');
});
