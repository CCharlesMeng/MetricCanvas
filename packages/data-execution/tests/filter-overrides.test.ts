import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DimensionFilterDeclaration,Page,QueryDataSource,EffectiveQuery} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem,createDqeGateway} from '../src/dqe/dqe';
import {createCandidateValidator} from '../src/candidate-validation';
import {candidateContextKey,filterCandidatesRequest} from '../src/filter-candidates';
import {createFilterState} from '../../engine/runtime/src/filter-state';
import type {FilterValues,FilterValue} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {createKeyOfficePriorityGateway,prepareIocHeaderFilters} from '../../../apps/playground/fixtures/key-office-filter/gateway';

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
  return composeEffectiveQuery({page,dataSource:page.dataSources.offices as QueryDataSource,filters:page.filters},input,0,[],{});
}
const officePredicate={target:'dimension',queryField:'代表处',values:['南京代表处']};
const keyPredicate={target:'dimension',queryField:'重点国代',values:['true']};
function ordinaryOverride(){
  const document=JSON.parse(JSON.stringify(raw).replaceAll('key-office','focus-only'));
  document.filters[1].overridesFilters=['region'];
  return document;
}

describe('key offices always intersect Region; ordinary overrides remain explicit',()=>{
  it.each(['key-office','key-national-only','key-rep-only'])('intersects %s regardless of label and legacy explicit Region override',id=>{
    const document=JSON.parse(JSON.stringify(raw).replaceAll('key-office',id));document.filters[1].label='显示名称';
    const input=values();input.delete('key-office');input.set(id,{type:'boolean',value:true});
    expect(query(load(document),input).filterValues).toEqual([officePredicate,keyPredicate]);
    document.filters[1].overridesFilters=['region'];
    expect(query(load(document),input).filterValues).toEqual([officePredicate,keyPredicate]);
    input.delete(id);expect(query(load(document),input).filterValues).toEqual([officePredicate]);
  });
  it('keeps older pages readable with the unified intersection behavior',()=>{
    const older=structuredClone(raw);older.schemaVersion='6.84';
    expect(query(load(older),values()).filterValues).toEqual([officePredicate,keyPredicate]);
  });
  it('keeps ordinary boolean overrides and their version floor',()=>{
    const document=ordinaryOverride(),input=values();input.delete('key-office');input.set('focus-only',{type:'boolean',value:true});
    expect(query(load(document),input).filterValues).toEqual([keyPredicate]);
    document.schemaVersion='6.83';expect(parsePage(document).ok).toBe(false);
  });
  it('does not implicitly override Region when another dimension is explicitly overridden',()=>{
    const document=structuredClone(raw);document.filters[1].overridesFilters=['customer-category'];
    const input=values();input.set('customer-category',{type:'dimension',dimension:'customer-level',values:['战略']});
    expect(query(load(document),input).filterValues).toEqual([officePredicate,keyPredicate]);
  });
  it.each([
    {ids:['missing'],message:'覆盖筛选必须引用'},
    {ids:['key-office'],message:'覆盖筛选必须引用'},
    {ids:['region','region'],message:'duplicate items'}
  ])('rejects invalid override declarations $ids',({ids,message})=>{
    const copy=structuredClone(raw);copy.filters[1].overridesFilters=ids;
    const result=parsePage(copy);expect(result.ok).toBe(false);
    if(!result.ok)expect(result.errors.some(error=>error.message.includes(message))).toBe(true);
  });
  it('keeps empty override arrays invalid',()=>{
    const copy=structuredClone(raw);copy.filters[1].overridesFilters=[];
    expect(parsePage(copy).ok).toBe(false);
  });
  it('still rejects missing replacement bindings and conflicting candidates for ordinary overrides',()=>{
    const page=load(ordinaryOverride()),input=values();input.set('focus-only',{type:'boolean',value:true});
    delete (page.dataSources.offices as QueryDataSource).source.query.filterBindings!['focus-only'];
    expect(()=>query(page,input)).toThrow('缺少替代查询条件');
    const copy=ordinaryOverride();copy.filters[0].candidateContext={filterIds:['focus-only'],reconcile:'intersection'};
    expect(parsePage(copy).ok).toBe(false);
  });
});

describe('intersection across queries, candidates and execution',()=>{
  it('sends Region, key offices and customer together without changing the selection',()=>{
    const page=load(),input=values();input.set('customer-category',{type:'dimension',dimension:'customer-level',values:['战略']});
    const q=query(page,input);
    expect(q.filterValues).toEqual([officePredicate,keyPredicate,{target:'dimension',queryField:'客户级别',values:['战略']}]);
    expect(effectiveDqeItem(q).filter).toMatchObject({dims:[{dim_name:'代表处',dim_value_list:['南京代表处']},{dim_name:'重点国代',dim_value_list:['true']},{dim_name:'客户级别',dim_value_list:['战略']}]});
    expect(input.get('region')).toMatchObject({values:['南京代表处']});
    expect(query(page,values(false)).filterValues).toEqual([officePredicate]);
  });
  it('preserves fixed query restrictions alongside both page filters',()=>{
    const page=load(),source=page.dataSources.offices as QueryDataSource;
    source.source.query.body!.dsl_list[0]!.filter={dims:[{dim_name:'权限域',dim_value_list:['授权域']}],metrics:[]};
    expect(effectiveDqeItem(query(page,values())).filter).toMatchObject({dims:[{dim_name:'权限域',dim_value_list:['授权域']},{dim_name:'代表处',dim_value_list:['南京代表处']},{dim_name:'重点国代',dim_value_list:['true']}]});
  });
  it('keeps a failed Region receipt blocking while the checkbox is checked',async()=>{
    const page=load(),state=createFilterState(values(),page.filters,new Map(),{candidates:true});
    state.candidate('region','denied');expect(state.blocked().has('region')).toBe(true);
    expect(state.toURL()).toContain(encodeURIComponent('南京代表处'));
    const validator=createCandidateValidator(page,{async fetchData(){return {rows:[]};},async fetchFilterCandidates(){return {kind:'denied'};}});
    await expect(validator.verify('offices',values(),new AbortController().signal)).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});
  });
  it('keeps Region in dependent candidate requests and cache identities',()=>{
    const page=load(),filter:DimensionFilterDeclaration={id:'customer',type:'dimension',dimension:'customer-level',candidateContext:{filterIds:['region'],reconcile:'intersection'}};
    expect(filterCandidatesRequest(filter,page.filters!,values()).constraints.dimensions).toEqual({'demo_office':['南京代表处']});
    const changed=values();changed.set('region',{type:'dimension',dimension:'demo_region',level:'region-dept',values:['华东地区部']});
    expect(candidateContextKey(filter,page.filters!,values())).not.toBe(candidateContextKey(filter,page.filters!,changed));
  });
  it('applies Region immediately to screen and complete export, including an empty intersection',async()=>{
    const page=load(),program=createSourceProgram(page,{gateway:createKeyOfficePriorityGateway()});
    for(const purpose of ['screen','complete'] as const){
      for await(const result of program.read({roots:['offices'],conditions:values(),purpose,useInitial:false}))expect(result.snapshot).toMatchObject({status:'empty',totalCount:0});
      const input=values();input.set('region',{type:'dimension',dimension:'demo_region',level:'region-dept',values:['华东地区部']});
      for await(const result of program.read({roots:['offices'],conditions:input,purpose,useInitial:false}))expect(result.snapshot).toMatchObject({status:'ready',rows:[{office:'上海代表处'}]});
    }
    for await(const result of program.read({roots:['offices'],conditions:values(false),useInitial:false}))expect(result.snapshot).toMatchObject({status:'ready',rows:[{office:'南京代表处'}]});
    program.dispose();
  });
  it('intersects same-field membership before HTTP, including table-header candidate queries',async()=>{
    const prepared=await prepareIocHeaderFilters(raw,createKeyOfficePriorityGateway(),{signal:new AbortController().signal}),page=load(prepared);
    const input=values();input.set('region',{type:'dimension',dimension:'demo_office',level:'office',values:['上海代表处']});
    const q=query(page,input);
    expect(effectiveDqeItem(q).filter).toMatchObject({dims:[{dim_name:'代表处',dim_value_list:['上海代表处']}]});
    const withHeader=composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},input,0,[],{office:{mode:'select',values:['上海代表处']}});
    expect(effectiveDqeItem(withHeader).filter).toMatchObject({dims:[{dim_name:'代表处',dim_value_list:['上海代表处']}]});
    const gateway=createDqeGateway({fetchImpl:async()=>{throw Error('Empty intersection must not call HTTP');}});
    expect(await gateway.fetchData(query(page,values()))).toEqual({rows:[],totalCount:0});
  });
});
