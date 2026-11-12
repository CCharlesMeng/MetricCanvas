import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {EffectiveQuery,QueryDataSource} from '@metriccanvas/page/internal';
import {composeEffectiveQuery,executeQuery} from '../src/effective-query';
import {initialFilterValues} from '../src/filter-values';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {intersectQueryFilters} from '../src/intersect-filters';
import {restrictKeys} from '../src/paged-join/member-query';
import {createQueryRunner} from '../src/query-runner';
import {createSourceProgram} from '../src/source-program/session';
import {createDimensionOperatorPreview} from '../../../apps/playground/fixtures/dimension-binding-operator';
function setup(){
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/dimension-binding-operator.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,values=initialFilterValues(page.filters!);
  const query=(id='excluded',headers:Parameters<typeof composeEffectiveQuery>[4]={})=>composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources[id] as QueryDataSource},values,0,[],headers);
  return {page,values,query};
}
it('encodes object exclusion and metric exclusion, preserving default and explicit inclusion',()=>{
  const test=setup(),saved=structuredClone(test.page);
  expect(effectiveDqeItem(test.query()).filter).toEqual({fields:[{field_name:'区域',value_list:['北区'],operator:'!='}]});
  expect(effectiveDqeItem(test.query('hierarchy')).filter).toEqual({dims:[{dim_name:'区域',dim_value_list:['北区'],is_exclude:true}],metrics:[]});
  expect(effectiveDqeItem(test.query('included'))).toEqual(effectiveDqeItem(test.query('explicit')));
  expect(test.page).toEqual(saved);
});
it('clears exclusion, excludes multiple choices and switches hierarchical target fields',()=>{
  const test=setup();test.values.set('area',{type:'dimension',dimension:'区域',values:['北区','南区']});
  expect(effectiveDqeItem(test.query()).filter).toEqual({fields:[{field_name:'区域',value_list:['北区','南区'],operator:'!='}]});
  test.values.set('area',{type:'dimension',dimension:'区域',values:[]});
  expect(effectiveDqeItem(test.query()).filter).toEqual({fields:[]});
  test.values.set('organization',{type:'dimension',dimension:'组织代表处',level:'office',values:['北京']});
  expect(effectiveDqeItem(test.query('hierarchy')).filter).toEqual({dims:[{dim_name:'代表处',dim_value_list:['北京'],is_exclude:true}],metrics:[]});
});
it('owns static comparison on explicit bindings and removes inactive hierarchy defaults',()=>{
  const test=setup(),source=test.page.dataSources.hierarchy as QueryDataSource;
  source.source.query.body!.dsl_list[0].filter={dims:[{dim_name:'区域',dim_value_list:['北区'],operator:'=',is_exclude:false},{dim_name:'代表处',dim_value_list:['天津']}],metrics:[]};
  test.values.set('organization',{type:'dimension',dimension:'组织代表处',level:'office',values:['北京']});
  expect(effectiveDqeItem(test.query('hierarchy')).filter).toEqual({dims:[{dim_name:'代表处',dim_value_list:['北京'],is_exclude:true}],metrics:[]});
  test.values.set('organization',{type:'dimension',dimension:'组织代表处',level:'office',values:[]});
  expect(effectiveDqeItem(test.query('hierarchy')).filter).toEqual({dims:[],metrics:[]});
});
it('combines exclusions and header selections without broadening either scope',async()=>{
  const test=setup(),gateway=createDimensionOperatorPreview().dataGateway;
  const denied=test.query('hierarchy',{area:{mode:'select',values:['北区']}});
  expect(intersectQueryFilters(denied)).toBeUndefined();
  expect(await executeQuery(denied,gateway,{})).toMatchObject({status:'empty',totalCount:0});
  const allowed=test.query('hierarchy',{area:{mode:'select',values:['北区','南区']}});
  expect(effectiveDqeItem(allowed).filter).toEqual({dims:[{dim_name:'区域',dim_value_list:['南区']}],metrics:[]});
  expect(await executeQuery(allowed,gateway,{})).toMatchObject({status:'ready',rows:[{office:'广州'}],totalCount:1});
});
it('honors when suspension without turning exclusion into an unrequested inclusion',()=>{
  const test=setup(),source=test.page.dataSources.excluded as QueryDataSource;
  const binding=source.source.query.filterBindings!.area;
  if(binding.target!=='dimension')throw Error('dimension');
  binding.when={filter:'organization',part:'level',op:'eq',value:'office'};
  expect(effectiveDqeItem(test.query()).filter).toEqual({fields:[]});
  test.values.set('organization',{type:'dimension',dimension:'组织代表处',level:'office',values:['北京']});
  expect(effectiveDqeItem(test.query()).filter).toEqual({fields:[{field_name:'区域',value_list:['北区'],operator:'!='}]});
});
function predicate(values:Array<string|number>,operator:'='|'!='='='):EffectiveQuery['filterValues'][number]{return {target:'dimension',queryField:'code',values,operator};}
function bare(filterValues:EffectiveQuery['filterValues']):EffectiveQuery{return {language:'dqe',body:{dsl_list:[{}]},fieldMappings:{},filterValues};}
it('intersects include/exclude in either order with strict scalar matching and unions exclusions',()=>{
  for(const predicates of [[predicate(['A','B',1]),predicate(['A','1'],'!=')],[predicate(['A','1'],'!='),predicate(['A','B',1])]])expect(intersectQueryFilters(bare(predicates))?.filterValues).toEqual([predicate(['B',1])]);
  expect(intersectQueryFilters(bare([predicate(['A'],'!='),predicate(['B'],'!=')]))?.filterValues).toEqual([predicate(['A','B'],'!=')]);
  expect(intersectQueryFilters(bare([predicate(['A']),predicate(['A'],'!=')]))).toBeUndefined();
  const withRange=bare([predicate(['A'],'!='),{target:'dimensionRange',queryField:'code',from:'B',to:'Z'}]);
  expect(intersectQueryFilters(withRange)?.filterValues).toEqual(withRange.filterValues);
});
it('subtracts excluded join keys before replacing them with a finite lookup set',()=>{
  const query=bare([predicate(['A'],'!=')]);
  expect(restrictKeys(query,'code',['A','B'])).toEqual(['B']);expect(query.filterValues).toEqual([{target:'dimension',queryField:'code',values:['B']}]);
  expect(restrictKeys(bare([predicate(['A'],'!=')]),'code',['A'])).toEqual([]);
});
it('keeps inclusion/exclusion cache identities separate and reuses repeated exclusion',async()=>{
  const test=setup(),fetchData=vi.fn(createDimensionOperatorPreview().dataGateway.fetchData),runner=createQueryRunner({gateway:{fetchData}});
  const included=test.query('included'),excluded=structuredClone(included);excluded.filterValues[0]= {...excluded.filterValues[0],operator:'!='} as Extract<EffectiveQuery['filterValues'][number],{target:'dimension'}>;
  try{
    expect(await runner.run(included,{},'demo')).toMatchObject({totalCount:2});
    expect(await runner.run(excluded,{},'demo')).toMatchObject({totalCount:1});
    await runner.run(excluded,{},'demo');expect(fetchData).toHaveBeenCalledTimes(2);
  }finally{runner.dispose();}
});
it('uses the same exclusion for ordinary reads, candidates and complete export snapshots',async()=>{
  const test=setup(),program=createSourceProgram(test.page,{gateway:createDimensionOperatorPreview().dataGateway});
  try{
    for await(const update of program.read({roots:['excluded','hierarchy'],conditions:test.values,purpose:'complete'}))expect(update.snapshot).toMatchObject({status:'ready',totalCount:1,rows:[{office:'广州'}]});
    expect(await program.readColumnCandidates({sourceId:'excluded',field:'office',conditions:test.values,view:{pageIndex:0,pageSize:10,sort:[],predicates:[]}})).toMatchObject({kind:'values',candidates:[{value:'广州'}]});
  }finally{program.dispose();}
});
it('supports flat metric exclusion and hierarchical object exclusion using the same operator',()=>{
  const test=setup(),flat=test.page.dataSources.included as QueryDataSource;
  const binding=flat.source.query.filterBindings!.area;if(binding.target!=='dimension')throw Error('dimension');binding.operator='!=';
  expect(effectiveDqeItem(test.query('included')).filter).toEqual({dims:[{dim_name:'区域',dim_value_list:['北区'],is_exclude:true}],metrics:[]});
  const hierarchical=test.page.dataSources.hierarchy as QueryDataSource;
  hierarchical.source.query.body=structuredClone((test.page.dataSources.excluded as QueryDataSource).source.query.body);
  test.values.set('organization',{type:'dimension',dimension:'demo_org_office',level:'office',values:['北京']});
  expect(effectiveDqeItem(test.query('hierarchy')).filter).toEqual({fields:[{field_name:'代表处',value_list:['北京'],operator:'!='}]});
});

it('merges multiple business exclusions before applying a same-field table selection',async()=>{
  const business=[predicate(['A'],'!='),predicate(['B'],'!=')],header=predicate(['A','B','C']);
  const query={...bare([...business,header]),bindingValues:business,tableFilters:[header]};
  const fetchData=vi.fn(async (effective:EffectiveQuery)=>{
    expect(effectiveDqeItem(effective).filter).toEqual({dims:[{dim_name:'code',dim_value_list:['C']}]});
    return {rows:[],totalCount:0};
  });
  expect(await executeQuery(query,{fetchData},{})).toMatchObject({status:'empty'});
  expect(fetchData).toHaveBeenCalledTimes(1);
});
