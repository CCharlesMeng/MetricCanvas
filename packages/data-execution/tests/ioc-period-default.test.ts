import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type Page,type PeriodSelection,type QueryDataSource} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {initialFilterValues,type FilterValue} from '../src/filter-values';
import {createSourceProgram,defaultSourceView} from '../src/source-program/session';
import {createPageDataExecutor} from '../src/execute';

const now=new Date(2026,9,15);
const raw=JSON.parse(readFileSync('pages/capabilities/filters/quarter-query-period.json','utf8'));
function document(){
  const page=structuredClone(raw),query=page.dataSources['quarter-query'].source.query;
  page.schemaVersion='6.95';page.filters[0].precision='month';
  delete query.filterBindings['statistics-period'].periodPolicy;
  query.body.dsl_list[0].filter.time.period='month';
  return page;
}
function load(input=document()):Page {
  const result=parsePage(input);
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
function compose(page:Page,selection:PeriodSelection={mode:'quarter',value:'2026-Q3'}){
  const conditions=new Map<string,FilterValue>([['statistics-period',{type:'timeRange',...resolvePeriodSelection(selection,now,'month')}]]);
  return composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources['quarter-query'] as QueryDataSource,now},conditions,0,[],{});
}
it.each([
  [{mode:'quarter',value:'2026-Q3'},'quarter','2026-Q3','2026-Q3'],
  [{mode:'year',value:'2026'},'year','2026','2026'],
  [{mode:'month',value:'2026-09'},'month','2026-09','2026-09'],
  [{mode:'last12Months'},'month','2025-10','2026-09']
] as const)('defaults an IOC period to its selected grain: %j',(selection,period,start,end)=>{
  const page=load(),before=structuredClone(page);
  expect(effectiveDqeItem(compose(page,selection))).toMatchObject({filter:{time:{period,start,end,is_aggregate:true}}});
  expect(page).toEqual(before);
});
it('supports legacy headers and filterControl declarations',()=>{
  const input=document(),header=input.sections[0].components.shift().props;
  input.iocHeader=header;
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'quarter'}}});
  delete input.iocHeader;
  delete header.filterIds;
  header.components=[{id:'period-control',type:'filterControl',props:{filterId:'statistics-period'}}];
  input.sections[0].components.unshift({id:'header',type:'iocHeader',layout:{span:12},props:header});
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'quarter'}}});
});
it('accepts a minimal binding without a legacy period or precision declaration',()=>{
  const input=document();delete input.filters[0].precision;
  delete input.dataSources['quarter-query'].source.query.body.dsl_list[0].filter.time.period;
  const page=load(input),conditions=initialFilterValues(page.filters!,now);
  const query=composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources['quarter-query'] as QueryDataSource,now},conditions,0,[],{});
  expect(effectiveDqeItem(query)).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3',is_aggregate:true}}});
});
it.each(['start','end','param','window'])('rejects competing raw time ownership: %s',field=>{
  const input=document();input.dataSources['quarter-query'].source.query.body.dsl_list[0].filter.time[field]='2026-07';
  expect(parsePage(input).ok).toBe(false);
});
it('defaults each selected query branch independently of explicit fixed branches',()=>{
  const input=document(),query=input.dataSources['quarter-query'].source.query;
  input.filters.push({id:'route',type:'dimension',dimension:'route',label:'口径',selection:{mode:'single',required:true},default:['auto'],options:[{value:'auto',label:'自动'},{value:'fixed',label:'逐月'}]});
  const auto={body:query.body,filterBindings:query.filterBindings},fixed=structuredClone(auto);
  fixed.filterBindings['statistics-period'].periodPolicy={kind:'fixed',period:'month'};
  delete fixed.body.dsl_list[0].filter.time.period;
  delete query.body;delete query.filterBindings;
  query.queryModes={filterId:'route',cases:{auto,fixed}};
  const page=load(input),conditions=initialFilterValues(page.filters!,now);
  const composeBranch=()=>effectiveDqeItem(composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources['quarter-query'] as QueryDataSource,now},conditions,0,[],{}));
  expect(composeBranch()).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
  conditions.set('route',{type:'dimension',dimension:'route',values:['fixed']});
  expect(composeBranch()).toMatchObject({filter:{time:{period:'month',start:'2026-07',end:'2026-09'}}});
});
it('keeps explicit fixed and supported-period policies authoritative',()=>{
  const input=document(),binding=input.dataSources['quarter-query'].source.query.filterBindings['statistics-period'];
  delete input.dataSources['quarter-query'].source.query.body.dsl_list[0].filter.time.period;
  binding.periodPolicy={kind:'fixed',period:'month'};
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'month',start:'2026-07',end:'2026-09'}}});
  binding.periodPolicy={kind:'selection',supportedPeriods:['month']};
  expect(()=>compose(load(input))).toThrow('不支持');
});
it('preserves comparison and field-based range bindings',()=>{
  const input=document(),binding=input.dataSources['quarter-query'].source.query.filterBindings['statistics-period'];
  binding.periodComparison={kind:'previousYear'};
  input.dataSources['quarter-query'].source.resultScope='complete';
  input.schemaVersion='6.95';
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'month',start:'2025-07',end:'2025-09'}}});
  delete binding.periodComparison;
  binding.queryField='签约日期';binding.valueFormat='iso';
  expect(compose(load(input)).filterValues).toEqual([{target:'time',queryField:'签约日期',valueFormat:'iso',value:{from:'2026-07',to:'2026-09'}}]);
});
it('uses the selected grain independently of IOC Header placement',()=>{
  const input=document();delete input.sections[0].components[0].props.filterIds;
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
  input.sections[0].components.shift();
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
});
it.each(['6.79','6.90','6.95'])('uses quarter for an unchanged %s legacy toolbar binding',schemaVersion=>{
  const input=document();input.schemaVersion=schemaVersion;
  input.sections[0].components.shift();input.dashboardToolbar={variant:'compact'};
  const before=structuredClone(input);
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3',is_aggregate:true}}});
  expect(input).toEqual(before);
});
it('applies the default when a caller supplies declarations without a full page',()=>{
  const page=load(),conditions=initialFilterValues(page.filters!,now);
  const query=composeEffectiveQuery({filters:page.filters,dataSource:page.dataSources['quarter-query'] as QueryDataSource,now},conditions,0,[],{});
  expect(effectiveDqeItem(query)).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
});
it.each([
  ['iso','2026-07-01','2026-09-30'],
  ['compact','20260701','20260930'],
  ['datetime','2026-07-01 00:00:00','2026-09-30 23:59:59']
] as const)('preserves custom %s field inputs on a legacy toolbar',(valueFormat,from,to)=>{
  const input=document();input.sections[0].components.shift();input.dashboardToolbar={variant:'compact'};
  const binding=input.dataSources['quarter-query'].source.query.filterBindings['statistics-period'];
  binding.queryField='账期';binding.valueFormat=valueFormat;
  expect(effectiveDqeItem(compose(load(input)))).toMatchObject({filter:{
    time:{period:'month',is_aggregate:true},
    dims:[{dim_name:'账期',operator:'>=',dim_value_list:[from]},{dim_name:'账期',operator:'<=',dim_value_list:[to]}]
  }});
});
it('keeps object queries on their explicit date field and range encoding',()=>{
  const input=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/object-query-page.json','utf8'));
  input.schemaVersion='6.95';input.filters[0].display='period';input.filters[0].default={mode:'quarter',value:'2026-Q3'};
  input.sections[0].components.unshift({id:'header',type:'iocHeader',layout:{span:12},props:{identity:{title:'对象时间'},filterIds:['period']}});
  const page=load(input),conditions=initialFilterValues(page.filters!,now);
  const query=composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.approvals as QueryDataSource,now},conditions,0,[],{});
  expect(query.filterValues).toEqual([{target:'time',queryField:'特价审批通过时间',valueFormat:'datetime',value:{from:'2026-07-01',to:'2026-09-30'}}]);
  expect(effectiveDqeItem(query)).toMatchObject({filter:{fields:[{field_name:'特价审批通过时间',value_list:['2026-07-01 00:00:00'],operator:'>='},{field_name:'特价审批通过时间',value_list:['2026-09-30 23:59:59'],operator:'<='}]}});
});
it('rejects missing applied selections before encoding a default period query',()=>{
  const page=load();
  expect(()=>composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources['quarter-query'] as QueryDataSource,now},new Map(),0,[],{})).toThrow('已应用的期间选择');
});
it('does not reuse old monthly initials or captured predicates for screen and complete reads',async()=>{
  const input=document();
  input.dataSources['quarter-query'].source.initial={capturedAt:'2026-09-30T00:00:00Z',rows:[{'区域':'旧月度数据','Tokens消耗量':3}],totalCount:1};
  const page=load(input),queries:unknown[]=[];
  const program=createSourceProgram(page,{now,gateway:{async fetchData(query){queries.push(effectiveDqeItem(query));return {rows:[{region:'新季度数据',amount:30}],totalCount:1};}}});
  const conditions=initialFilterValues(page.filters!,now),captured=compose(page,{mode:'month',value:'2026-09'});
  try{
    expect(program.initialSnapshots({roots:['quarter-query'],conditions}).get('quarter-query')).toEqual({status:'loading'});
    for(const purpose of ['screen','complete'] as const){
      const updates=[];
      for await(const update of program.read({roots:['quarter-query'],conditions,purpose,useInitial:true,seeds:new Map([['quarter-query',{status:'ready',rows:[{region:'旧月度数据',amount:3}],totalCount:1}]]),queries:new Map([['quarter-query',captured]]),freshness:'refresh'}))updates.push(update);
      expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',rows:[{region:'新季度数据',amount:30}]});
    }
    expect(queries).toHaveLength(2);
    for(const query of queries)expect(query).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
  }finally{program.dispose();}
});
it('uses the same selected grain for remote column candidates',async()=>{
  const page=load(),queries:unknown[]=[];
  const program=createSourceProgram(page,{now,gateway:{
    async fetchData(){throw Error('Expected a DISTINCT candidate request');},
    async fetchColumnCandidates(request){queries.push(effectiveDqeItem(request.query));return {kind:'values',candidates:[{value:'合成地区',label:'合成地区'}],totalCount:1};}
  }});
  try{
    expect(await program.readColumnCandidates({sourceId:'quarter-query',field:'region',conditions:initialFilterValues(page.filters!,now),view:defaultSourceView(page,'quarter-query')})).toMatchObject({kind:'values',totalCount:1});
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
  }finally{program.dispose();}
});
it('removes unproven old initials from one-shot output when the new period query fails',async()=>{
  const input=document();input.sections[0].components.shift();input.dashboardToolbar={variant:'compact'};
  const before=structuredClone(input),queries:unknown[]=[];
  input.dataSources['quarter-query'].source.initial={capturedAt:'2026-09-30T00:00:00Z',rows:[{'区域':'旧月度数据','Tokens消耗量':3}],totalCount:1};
  const output=await createPageDataExecutor({now,gateway:{async fetchData(query){queries.push(effectiveDqeItem(query));throw Object.assign(Error('Synthetic unsupported quarter'),{code:'DQE_QUERY_REJECTED'});}}}).execute(input);
  expect(queries).toHaveLength(1);
  expect(queries[0]).toMatchObject({filter:{time:{period:'quarter',start:'2026-Q3',end:'2026-Q3'}}});
  expect(output.dataSources['quarter-query'].source).not.toHaveProperty('initial');
  expect(input.dataSources['quarter-query'].source.initial.rows[0]['区域']).toBe('旧月度数据');
  expect(output.sections).toEqual(before.sections);
});
