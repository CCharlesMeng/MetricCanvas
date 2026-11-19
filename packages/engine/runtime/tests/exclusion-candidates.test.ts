import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {Page} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues,parseFilterSearch} from '../src/filter-state';
import {filterInputIssue} from '../src/navigation-inputs';
import {orchestrate} from '../src/orchestrator';
import type {RuntimeDataGateway} from '../src/ports';

function page(version='6.125',operator:'!='|'='='!='):Page {
  const raw=JSON.parse(readFileSync('pages/capabilities/filters/filter-source-query-pagination.json','utf8'));
  const parsed=parsePage(raw);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const result=parsed.page;
  result.schemaVersion=version;
  const source=result.dataSources['chart-data'];
  if(source.source.type!=='query')throw Error('fixture');
  source.source.query.filterBindings={
    service:{target:'dimension',queryField:'云服务',operator},
    'service-scope':{target:'dimension',queryField:'范围'}
  };
  return result;
}
function stateFor(document:Page,selected=false) {
  const values=initialFilterValues(document.filters??[]);
  if(selected)values.set('service',{type:'dimension',dimension:'service',values:['甲云服务01']});
  return createFilterState(values,document.filters,new Map(),{schemaVersion:document.schemaVersion,candidates:true});
}
function pendingGateway() {
  const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[{org:'北区',amount:70}],totalCount:1}));
  const fetchFilterCandidates=vi.fn<NonNullable<RuntimeDataGateway['fetchFilterCandidates']>>((_request,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
  return {fetchData,fetchFilterCandidates};
}

it.each([false,true])('runs the exclusion query while its candidate request is pending; selected=%s',async selected=>{
  const document=page(),state=stateFor(document,selected),gateway=pendingGateway();
  const stop=orchestrate(document,gateway,state).subscribe(()=>{});
  try{
    await vi.waitFor(()=>expect(gateway.fetchData).toHaveBeenCalledTimes(1),{timeout:800});
    expect(state.blocked()).not.toContain('service');
    expect(gateway.fetchFilterCandidates).not.toHaveBeenCalled();
    if(selected)expect(gateway.fetchData.mock.calls[0][0].filterValues).toContainEqual(expect.objectContaining({queryField:'云服务',operator:'!=',values:['甲云服务01']}));
  }finally{stop();}
});

it('retains an exclusion through scope changes, absent candidates and candidate failures',async()=>{
  const document=page(),state=stateFor(document,true),gateway=pendingGateway();
  const stop=orchestrate(document,gateway,state).subscribe(()=>{});
  try{
    state.candidate('service','ready',['甲云服务01']);
    state.write('service-scope',{type:'dimension',dimension:'scope',values:['乙']});
    expect(new URLSearchParams(state.toURL()).get('service')).toBe('甲云服务01');
    expect(state.confirmation()).not.toContain('service');
    for(const status of ['loading','empty','denied','error','unconfigured'] as const){
      state.candidate('service',status);
      expect(state.blocked()).not.toContain('service');
    }
    state.candidate('service','ready',['乙云服务01']);
    await vi.waitFor(()=>expect(gateway.fetchData.mock.calls.some(([query])=>query.filterValues.some(item=>item.target==='dimension'&&item.queryField==='范围'&&item.values.includes('乙')))).toBe(true));
    const query=gateway.fetchData.mock.calls.at(-1)![0];
    expect(query.filterValues).toContainEqual(expect.objectContaining({queryField:'云服务',operator:'!=',values:['甲云服务01']}));
    state.write('service',null);
    await vi.waitFor(()=>expect(gateway.fetchData.mock.calls.at(-1)![0].filterValues.some(item=>item.target==='dimension'&&item.queryField==='云服务')).toBe(false));
  }finally{stop();}
});

it.each(['6.124','include'])('keeps the existing candidate gate for %s',version=>{
  const document=page(version==='include'?'6.125':version,version==='include'?'=':'!='),state=stateFor(document,true);
  const stop=orchestrate(document,pendingGateway(),state).subscribe(()=>{});
  try{
    expect(state.blocked()).toContain('service');
    state.write('service-scope',{type:'dimension',dimension:'scope',values:['乙']});
    expect(state.confirmation()).toContain('service');
  }finally{stop();}
});

function conditionalFilters() {
  const raw=JSON.parse(readFileSync('pages/capabilities/filters/filter-conditional-exclusion-default.json','utf8'));
  const parsed=parsePage(raw);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page.filters!;
}

it.each([
  ['', ['甲云服务01','预设专属服务']],
  ['service-scope=丙', undefined],
  ['service-scope=乙&service=手工添加', ['手工添加']],
  ['service=', []],
] as const)('initializes conditional exclusions with explicit input precedence (%s)',(search,expected)=>{
  const filters=conditionalFilters();
  expect(filterInputIssue(search,filters)).toBeUndefined();
  const explicit=parseFilterSearch(search,filters);
  const defaults=initialFilterValues(filters,new Date(),undefined,undefined,undefined,explicit);
  const applied=new Map([...defaults,...explicit]).get('service');
  expect(applied?.type==='dimension'?applied.values:undefined).toEqual(expected);
});

it('publishes the controller and conditional exclusion together and preserves manual edits for a repeated choice',()=>{
  const filters=conditionalFilters();
  const state=createFilterState(initialFilterValues(filters),filters);
  const snapshots=vi.fn();
  const stop=state.subscribe(snapshots);
  try{
    state.write('service',null);
    expect(new URLSearchParams(state.toURL()).getAll('service')).toEqual(['']);
    state.write('service-scope',{type:'dimension',dimension:'scope',values:['甲']});
    expect(snapshots).toHaveBeenCalledTimes(2);
    state.write('service-scope',{type:'dimension',dimension:'scope',values:['乙']});
    expect(snapshots).toHaveBeenCalledTimes(3);
    expect(snapshots.mock.lastCall?.[0]).toEqual(new Map([
      ['service-scope',{type:'dimension',dimension:'scope',values:['乙']}],
      ['service',{type:'dimension',dimension:'service',values:['甲云服务01','预设专属服务']}],
    ]));
    state.write('service-scope',{type:'dimension',dimension:'scope',values:['丙']});
    expect(snapshots).toHaveBeenCalledTimes(4);
    expect(snapshots.mock.lastCall?.[0].has('service')).toBe(false);
    state.commit({type:'reset',baseline:'initial'});
    expect(snapshots.mock.lastCall?.[0]).toEqual(snapshots.mock.calls[0]?.[0]);
  }finally{stop();}
});
