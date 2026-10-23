import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src/validate';
import { initializeQueryParams } from '../src/query';
import { objectDateBoundary } from '../src/dqe-object';
const load = () => JSON.parse(readFileSync('pages/capabilities/query/dqe-object-query-demo.json', 'utf8'));
const objectQuery = (page = load()) => page.dataSources.records.source.query;

describe('DQE object page contract', () => {
  it('validates the actual Dashboard with window bindings, complete computation and mixed query association', () => {
    expect(validate(load())).toEqual([]);
  });
  it.each(['object-type', 'empty-output', 'duplicate-output', 'mixed-output', 'time-field', 'time-format', 'field-condition', 'version'])('rejects %s', kind => {
    const page = load(), query = objectQuery(page), item = query.body.dsl_list[0];
    if (kind === 'object-type') delete item.object_type;
    if (kind === 'empty-output') item.output_fields = [];
    if (kind === 'duplicate-output') item.output_fields.push(item.output_fields[0]);
    if (kind === 'mixed-output') item.output_dims = ['商务编号'];
    if (kind === 'time-field') delete query.filterBindings.period.queryField;
    if (kind === 'time-format') delete query.filterBindings.period.valueFormat;
    if (kind === 'field-condition') item.filter.fields[0].value_list = 'bad';
    if (kind === 'version') page.schemaVersion = '6.51';
    expect(validate(page).length).toBeGreaterThan(0);
  });
  it('does not impose a role inferred from output_fields', () => {
    const page = load();page.dataSources.records.fields.business.role = 'measure';
    expect(validate(page).some(error => error.message.includes('DQE 维度'))).toBe(false);
  });
  it('checks object output consistency across query mode branches', () => {
    const page=load(),query=objectQuery(page),leaf={body:query.body,filterBindings:query.filterBindings};
    page.filters.push({id:'mode',type:'dimension',dimension:'object_mode',default:['a'],options:[{label:'A',value:'a'},{label:'B',value:'b'}],selection:{mode:'single',required:true}});
    query.queryModes={filterId:'mode',cases:{a:structuredClone(leaf),b:structuredClone(leaf)}};delete query.body;delete query.filterBindings;
    expect(validate(page)).toEqual([]);
    query.queryModes.cases.b.body.dsl_list[0].output_fields.pop();
    expect(validate(page).some(error=>error.message.includes('相同字段'))).toBe(true);
  });
  it('resolves object dimension and paired date parameters without mutating the saved body', () => {
    const page=load(),query=objectQuery(page);delete query.filterBindings;
    page.params={query:{dimensions:[{id:'business-input',dim_name:'商务编号',label:'商务',required:true,dim_value_list:['B001']}],times:[{id:'period-input',label:'期间',required:true,granularity:'month',start:'2025-02',end:'2025-02'}]}};
    query.body.dsl_list[0].filter.fields=[
      {field_name:'商务编号',value_list:{param:'business-input'},operator:'='},
      {field_name:'特价审批通过时间',value_list:{param:'period-input',part:'start',valueFormat:'datetime'},operator:'>='},
      {field_name:'特价审批通过时间',value_list:{param:'period-input',part:'end',valueFormat:'datetime'},operator:'<='}
    ];
    const result=parsePage(page);if(!result.ok)throw Error(JSON.stringify(result.errors));
    const resolved=initializeQueryParams(query,new Map<string,any>([['business-input',['B002']],['period-input',{start:'2024-02',end:'2024-02'}]]));
    expect(resolved.body!.dsl_list[0].filter).toMatchObject({fields:[{value_list:['B002']},{value_list:['2024-02-01 00:00:00']},{value_list:['2024-02-29 23:59:59']}]});
    expect(query.body.dsl_list[0].filter.fields[0].value_list).toEqual({param:'business-input'});
    query.body.dsl_list[0].filter.fields.pop();expect(validate(page).length).toBeGreaterThan(0);
  });
  it('uses explicit calendar formats', () => {
    expect(objectDateBoundary('2025-02',true,'datetime')).toBe('2025-02-28 23:59:59');
    expect(objectDateBoundary('2025-02-03',false,'iso')).toBe('2025-02-03');
    expect(objectDateBoundary('2025-02',false,'compact')).toBe('202502');
  });
});

it('supports month windows and explicit legacy binding migration for object queries',async()=>{
  const {migrateParamBindings,resolvePageParams}=await import('../src');
  const page=load(),query=objectQuery(page);page.filters=[];delete query.filterBindings;
  page.params=[{id:'period-input',type:'time',granularity:'month',required:true,value:'2025-02'}];
  query.paramBindings={'period-input':{target:'time',queryField:'特价审批通过时间',valueFormat:'datetime',window:{kind:'period',unit:'month'}}};
  query.body.dsl_list[0].filter.fields=[];
  page.dataSources={records:page.dataSources.records};page.sections=page.sections.slice(0,1);delete page.sections[0].components[0].props.columns[1].selection;
  const migrated=migrateParamBindings(page);if(!migrated.ok)throw Error(JSON.stringify(migrated.issues));
  expect(migrated.document.schemaVersion).toBe('6.55');
  const resolved=resolvePageParams(migrated.document);if(!resolved.ok)throw Error(JSON.stringify(resolved.issues));
  const source=resolved.resolvedPage.dataSources.records.source;if(source.type!=='query')throw Error('source');
  expect(source.query.body!.dsl_list[0].filter).toMatchObject({fields:[{value_list:['2025-02-01 00:00:00']},{value_list:['2025-02-28 23:59:59']}]});
});

it('extracts simple object equality parameters and round trips the original query',async()=>{
 const {extractPageParams,applyPageParamSelection}=await import('../src');
 const page=load(),query=objectQuery(page);delete query.filterBindings;page.filters=[];
 page.dataSources={records:page.dataSources.records};page.sections=[{id:'main',components:[{id:'note',type:'text',layout:{span:12},props:{body:'对象参数'}}]}];
 query.body.dsl_list[0].filter.fields=[{field_name:'商务编号',value_list:['B001'],operator:'='}];
 const extraction=extractPageParams(page,{baseline:'object-v1'});if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
 expect(extraction.candidates).toHaveLength(1);
 const applied=applyPageParamSelection(extraction,[extraction.candidates[0].id]);if(!applied.ok)throw Error(JSON.stringify(applied.issues));
 expect(applied.originalValues).toMatchObject({[extraction.candidates[0].id]:['B001']});
});

it('permits object and metric mode branches with the same explicit result contract',()=>{
 const page=load(),query=objectQuery(page),leaf={body:query.body,filterBindings:query.filterBindings};
 page.filters.push({id:'mode',type:'dimension',dimension:'mixed_mode',default:['object'],options:[{label:'对象',value:'object'},{label:'指标',value:'metric'}],selection:{mode:'single',required:true}});
 const metric=structuredClone(leaf);metric.filterBindings.period={target:'time'};
 metric.body.dsl_list[0]={output_dims:['审批记录ID','商务编号','特价审批通过时间','区域'],output_metrics:['审批金额','预算金额'],filter:{time:{period:'day',is_aggregate:false},dims:[],metrics:[]},order:{limit:5,offset:0}};
 query.queryModes={filterId:'mode',cases:{object:leaf,metric}};delete query.body;delete query.filterBindings;
 expect(validate(page)).toEqual([]);
});
