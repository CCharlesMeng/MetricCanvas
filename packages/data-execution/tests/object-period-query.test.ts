import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type Page,type PeriodSelection,type QueryDataSource} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {initialFilterValues,type FilterValue} from '../src/filter-values';
import {createSourceProgram,defaultSourceView} from '../src/source-program/session';
import {createObjectPeriodPreview} from '../../../apps/playground/fixtures/object-period-query';

const raw=JSON.parse(readFileSync('pages/capabilities/query/object-period-query.json','utf8'));
const now=new Date(2026,10,9);
const field=(name:string,value:string,operator='=')=>({field_name:name,value_list:[value],operator});
function load(input=structuredClone(raw)):Page {
  const result=parsePage(input);
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
function conditions(selection:PeriodSelection) {
  return new Map<string,FilterValue>([['period',{type:'timeRange',...resolvePeriodSelection(selection,now)}]]);
}
function compose(page:Page,selection:PeriodSelection,id='auto') {
  return composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources[id] as QueryDataSource,now},conditions(selection),0,[],{});
}
it.each([
  [{mode:'month',value:'2026-10'},'monthly','202610'],
  [{mode:'year',value:'2026'},'yearly','2026'],
  [{mode:'quarter',value:'2026-Q4'},'quarterly','2026Q4']
] as const)('encodes the exact single-ledger contract for %j',(selection,kind,ledger)=>{
  const page=load(),before=structuredClone(page);
  expect(effectiveDqeItem(compose(page,selection)).filter).toEqual({fields:[field('业务状态','有效'),field('周期类型',kind),field('账期',ledger)]});
  expect(page).toEqual(before);
});
it.each([
  [{mode:'last12Months'},'auto','202511','202610'],
  [{mode:'year',value:'2026'},'fixed','202601','202612'],
  [{mode:'quarter',value:'2026-Q4'},'fixed','202610','202612']
] as const)('encodes multiple monthly ledgers using closed bounds: %j',(selection,id,from,to)=>{
  expect(effectiveDqeItem(compose(load(),selection,id)).filter).toEqual({fields:[field('业务状态','有效'),field('周期类型','monthly'),field('账期',from,'>='),field('账期',to,'<=')]});
});
it('replaces both bound ledger defaults while preserving unrelated conditions',()=>{
  const input=structuredClone(raw);
  input.dataSources.auto.source.query.body.dsl_list[0].filter.fields.push(field('周期类型','monthly'),field('账期','202501','>='),field('账期','202502','<='));
  expect(effectiveDqeItem(compose(load(input),{mode:'quarter',value:'2026-Q4'})).filter).toEqual({fields:[field('业务状态','有效'),field('周期类型','quarterly'),field('账期','2026Q4')]});
});
it('preserves explicit date fields and fully hand-written conditions',()=>{
  const page=load(),selection={mode:'quarter',value:'2026-Q4'} as const;
  expect(effectiveDqeItem(compose(page,selection,'custom')).filter).toEqual({fields:[field('业务状态','有效'),field('审批完成时间','2026-10-01 00:00:00','>='),field('审批完成时间','2026-12-31 23:59:59','<=')]});
  expect(effectiveDqeItem(compose(page,selection,'manual')).filter).toEqual(raw.dataSources.manual.source.query.body.dsl_list[0].filter);
});
it('rejects an unsupported selected grain and missing selection before requesting data',()=>{
  const input=structuredClone(raw);
  input.dataSources.auto.source.query.filterBindings.period.periodPolicy={kind:'selection',supportedPeriods:['month']};
  const page=load(input);
  expect(()=>compose(page,{mode:'year',value:'2026'})).toThrow('不支持');
  expect(()=>composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.auto as QueryDataSource},new Map(),0,[],{})).toThrow('已应用的期间选择');
});
it.each([
  ['old-version',/6\.101/],['day-policy',/对象账期策略/],['plain-range',/display=period/],
  ['partial-field',/queryField.*valueFormat/],['competing-field',/已拥有/],['window',/object 时间绑定/],['comparison',/object 时间绑定/]
])('rejects ambiguous or incompatible %s declarations',(kind,message)=>{
  const input=structuredClone(raw),binding=input.dataSources.auto.source.query.filterBindings.period;
  if(kind==='old-version')input.schemaVersion='6.100';
  if(kind==='day-policy')binding.periodPolicy={kind:'fixed',period:'day'};
  if(kind==='plain-range'){delete input.filters[0].display;input.filters[0].default={from:'2026-10-01',to:'2026-10-31'};}
  if(kind==='partial-field')binding.queryField='日期';
  if(kind==='competing-field')input.dataSources.auto.source.query.filterBindings.other={target:'dimension',queryField:'周期类型'};
  if(kind==='window')binding.window={kind:'period',unit:'month'};
  if(kind==='comparison')binding.periodComparison={kind:'previousYear'};
  const result=parsePage(input);
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.errors.some(error=>message.test(error.message))).toBe(true);
});
it('prevents result bindings from replacing the standard ledger fields',()=>{
  const input=structuredClone(raw);
  input.dataSources.manual.source.resultScope='complete';
  input.dataSources.auto.source.query.resultBindings=[{source:'manual',field:'request',target:'dimension',queryField:'账期',maxValues:10}];
  const result=parsePage(input);
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.errors.some(error=>error.message.includes('结果输入与已有维度条件重复'))).toBe(true);
});
it('selects object period and hand-written queryModes branches independently',()=>{
  const input=structuredClone(raw),query=input.dataSources.auto.source.query;
  input.filters.push({id:'route',type:'dimension',dimension:'route',selection:{mode:'single',required:true},default:['auto'],options:[{value:'auto',label:'自动'},{value:'manual',label:'自定义'}]});
  query.queryModes={filterId:'route',cases:{auto:{body:query.body,filterBindings:query.filterBindings},manual:{body:input.dataSources.manual.source.query.body,filterBindings:{}}}};
  delete query.body;delete query.filterBindings;
  const page=load(input),values=initialFilterValues(page.filters!,now);
  const selected=()=>effectiveDqeItem(composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.auto as QueryDataSource},values,0,[],{}));
  expect(selected().filter).toMatchObject({fields:expect.arrayContaining([field('周期类型','monthly'),field('账期','202610')])});
  values.set('route',{type:'dimension',dimension:'route',values:['manual']});
  expect(selected().filter).toEqual(raw.dataSources.manual.source.query.body.dsl_list[0].filter);
});
it.each(['auto','fixed'])('uses the same frozen ledger for screen, complete reads and candidates of %s, ignoring old initials',async id=>{
  const input=structuredClone(raw);
  input.dataSources[id].source.initial={capturedAt:'2026-10-01T00:00:00Z',rows:[{'请求条件':'旧日期范围'}],totalCount:1};
  const page=load(input),requests:unknown[]=[],values=conditions({mode:'quarter',value:'2026-Q4'});
  const program=createSourceProgram(page,{now,gateway:{
    async fetchData(query){requests.push(effectiveDqeItem(query));return {rows:[{request:'新账期'}],totalCount:1};},
    async fetchColumnCandidates(request){requests.push(effectiveDqeItem(request.query));return {kind:'values',candidates:[{value:'候选',label:'候选'}],totalCount:1};}
  }});
  try {
    expect(program.initialSnapshots({roots:[id],conditions:values}).get(id)).toEqual({status:'loading'});
    for(const purpose of ['screen','complete'] as const) {
      for await(const update of program.read({roots:[id],conditions:values,purpose,useInitial:true,freshness:'refresh'})) {
        expect(update.snapshot).not.toMatchObject({rows:[{request:'旧日期范围'}]});
      }
    }
    await program.readColumnCandidates({sourceId:id,field:'request',conditions:values,view:defaultSourceView(page,id)});
    expect(requests).toHaveLength(3);
    const fields=id==='auto'?[field('周期类型','quarterly'),field('账期','2026Q4')]:[field('周期类型','monthly'),field('账期','202610','>='),field('账期','202612','<=')];
    for(const request of requests)expect(request).toMatchObject({filter:{fields:expect.arrayContaining(fields)}});
  } finally {program.dispose();}
});
it('executes the actual Playground page through the synthetic request echo',async()=>{
  const page=load(),preview=createObjectPeriodPreview(),program=createSourceProgram(page,{gateway:preview.dataGateway,now});
  try {
    const updates=[];
    for await(const update of program.read({roots:['auto'],conditions:initialFilterValues(page.filters!,now),purpose:'screen'}))updates.push(update);
    expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',rows:[{request:JSON.stringify({fields:[field('业务状态','有效'),field('周期类型','monthly'),field('账期','202610')]})}]});
  } finally {program.dispose();}
});
it.each([
  ['rep-office-approval-detail','approval-detail'],
  ['rep-office-execution-efficiency','zb1111'],
  ['rep-office-execution-efficiency','contract-closure-main']
])('migrates the existing %s/%s ledger query without changing custom fields',(name,id)=>{
  const input=JSON.parse(readFileSync(`pages/business/dashboard/ioc/approval/${name}.json`,'utf8'));
  const page=load(input),values=initialFilterValues(page.filters!,now);
  values.set('period',{type:'timeRange',...resolvePeriodSelection({mode:'quarter',value:'2026-Q4'},now)});
  const query=composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources[id] as QueryDataSource,now},values,0,[],{});
  expect(effectiveDqeItem(query)).toMatchObject({filter:{fields:expect.arrayContaining([field('周期类型','quarterly'),field('账期','2026Q4')])}});
});
