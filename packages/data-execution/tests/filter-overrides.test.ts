import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DimensionFilterDeclaration,Page,QueryDataSource,EffectiveQuery} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {createCandidateValidator} from '../src/candidate-validation';
import {candidateContextKey,filterCandidatesRequest} from '../src/filter-candidates';
import {createFilterState} from '../../engine/runtime/src/filter-state';
import type {FilterValues,FilterValue} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {createKeyOfficePriorityGateway} from '../../../apps/playground/fixtures/key-office-filter/gateway';

const raw=JSON.parse(readFileSync('pages/capabilities/filters/key-office-priority-demo.json','utf8'));
function load(document:unknown=raw):Page {
  const result=parsePage(document);
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
function values(selected=true):Map<string,FilterValue> {
  return new Map<string,FilterValue>([
    ['region',{type:'dimension',dimension:'demo_office',level:'office',values:['南京代表处']}],
    ['key-office',{type:'boolean',value:selected}]
  ]);
}
function query(page:Page,input:FilterValues):EffectiveQuery {
  return composeEffectiveQuery({dataSource:page.dataSources.offices as QueryDataSource,filters:page.filters},input,0,[],{});
}

describe('explicit boolean override contract',()=>{
  it('accepts the full page and rejects the capability before 6.84',()=>{
    expect(parsePage(raw).ok).toBe(true);
    expect(parsePage({...raw,schemaVersion:'6.80'}).ok).toBe(false);
  });
  it.each([
    {ids:['missing'],message:'覆盖筛选必须引用'},
    {ids:['key-office'],message:'覆盖筛选必须引用'},
    {ids:['region','region'],message:'duplicate items'}
  ])('rejects invalid override references $ids',({ids,message})=>{
    const copy=structuredClone(raw);copy.filters[1].overridesFilters=ids;
    const result=parsePage(copy);expect(result.ok).toBe(false);
    if(!result.ok)expect(result.errors.some(error=>error.message.includes(message))).toBe(true);
  });
  it('rejects a query missing the replacement binding before Region can be dropped',()=>{
    const copy=structuredClone(raw);delete copy.dataSources.offices.source.query.filterBindings['key-office'];
    expect(parsePage(copy).ok).toBe(true);
    const page=load();delete (page.dataSources.offices as QueryDataSource).source.query.filterBindings!['key-office'];
    expect(()=>query(page,values())).toThrow('缺少替代查询条件');
  });
  it('rejects candidate narrowing that would erase the Region selection on check',()=>{
    const copy=structuredClone(raw);copy.filters[0].candidateContext={filterIds:['key-office'],reconcile:'intersection'};
    expect(parsePage(copy).ok).toBe(false);
  });
});

describe('query, candidate and execution projections',()=>{
  it('keeps stored Region while transmitting only the replacement and 客户级别',()=>{
    const page=load(),input=values();input.set('customer-category',{type:'dimension',dimension:'customer-level',values:['战略']});
    const q=query(page,input);
    expect(q.filterValues).toEqual([
      {target:'dimension',queryField:'重点国代',values:['true']},
      {target:'dimension',queryField:'客户级别',values:['战略']}
    ]);
    expect(effectiveDqeItem(q).filter).toMatchObject({dims:[{dim_name:'重点国代',dim_value_list:['true']},{dim_name:'客户级别',dim_value_list:['战略']}]});
    expect(input.get('region')).toMatchObject({values:['南京代表处']});
    expect(query(page,values(false)).filterValues).toEqual([{target:'dimension',queryField:'代表处',values:['南京代表处']}]);
    input.set('region',{type:'dimension',dimension:'demo_region',level:'region-dept',values:['华东地区部']});input.set('key-office',{type:'boolean',value:false});
    expect(query(page,input).filterValues[0]).toEqual({target:'dimension',queryField:'地区部',values:['华东地区部']});
  });
  it('preserves fixed query restrictions when dropping a page filter',()=>{
    const page=load(),source=page.dataSources.offices as QueryDataSource;
    source.source.query.body!.dsl_list[0]!.filter={dims:[{dim_name:'权限域',dim_value_list:['授权域']}],metrics:[]};
    expect(effectiveDqeItem(query(page,values())).filter).toMatchObject({dims:[{dim_name:'权限域',dim_value_list:['授权域']},{dim_name:'重点国代',dim_value_list:['true']}]});
  });
  it('ignores a failed Region receipt only while true, restoring the gate on false',async()=>{
    const page=load(),state=createFilterState(values(),page.filters,new Map(),{candidates:true});
    state.candidate('region','denied');expect(state.blocked().has('region')).toBe(false);
    expect(state.toURL()).toContain(encodeURIComponent('南京代表处'));
    state.write('key-office',{type:'boolean',value:false});expect(state.blocked().has('region')).toBe(true);
    const validator=createCandidateValidator(page,{async fetchData(){return {rows:[]};},async fetchFilterCandidates(){return {kind:'denied'};}});
    await expect(validator.verify('offices',values(),new AbortController().signal)).resolves.toBeUndefined();
    await expect(validator.verify('offices',values(false),new AbortController().signal)).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});
  });
  it('removes the overridden dimension from dependent candidate requests and cache identities',()=>{
    const page=load(),filter:DimensionFilterDeclaration={id:'customer',type:'dimension',dimension:'customer-level',candidateContext:{filterIds:['region'],reconcile:'intersection'}};
    expect(filterCandidatesRequest(filter,page.filters!,values()).constraints.dimensions).toEqual({});
    expect(filterCandidatesRequest(filter,page.filters!,values(false)).constraints.dimensions).toEqual({'demo_office':['南京代表处']});
    expect(candidateContextKey(filter,page.filters!,values())).not.toBe(candidateContextKey(filter,page.filters!,values(false)));
  });
  it('executes screen and complete export over all authorized key offices and restores Region on cancel',async()=>{
    const page=load(),requests:EffectiveQuery[]=[];
    const gateway=createKeyOfficePriorityGateway((kind,request)=>{if(kind==='query')requests.push(request as EffectiveQuery);});
    const program=createSourceProgram(page,{gateway});
    for(const purpose of ['screen','complete'] as const){
      for await(const result of program.read({roots:['offices'],conditions:values(),purpose,useInitial:false}))expect(result.snapshot).toMatchObject({status:'ready',rows:[{office:'上海代表处'},{office:'深圳代表处'}]});
    }
    for await(const result of program.read({roots:['offices'],conditions:values(false),useInitial:false}))expect(result.snapshot).toMatchObject({status:'ready',rows:[{office:'南京代表处'}]});
    expect(requests[0].filterValues.some(p=>p.target==='dimension'&&p.queryField==='代表处')).toBe(false);
    program.dispose();
  });
});
