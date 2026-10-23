import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage,validate} from '../src/validate';
import {selectQuery,queryLeaves} from '../src/query-selection';
import {queryFilterIds} from '../src/amount-filter';
import {pageSelectionVariants} from '../src/selection-variants';
const load=()=>JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8'));

describe('fixed single-select query branches',()=>{
  it('validates the actual chart page and discovers the selector and per-case predicates',()=>{
    const page=load();expect(validate(page)).toEqual([]);
    const query=page.dataSources['amount-trend'].source.query;
    expect(queryFilterIds(query)).toEqual(['business','region']);
    expect(queryLeaves(query).map(leaf=>leaf.body.dsl_list[0].output_metrics)).toEqual([['签约金额'],['商机金额']]);
  });
  it.each(['missing-case','extra-case','wrong-output','wrong-selector','root-body','root-binding','unknown-field','selector-predicate','time-and-dimension'])('rejects %s',kind=>{
    const page=load(),query=page.dataSources['amount-trend'].source.query,cases=query.queryModes.cases;
    if(kind==='missing-case')delete cases.opportunities;
    if(kind==='extra-case')cases.unknown=structuredClone(cases.contracts);
    if(kind==='wrong-output')cases.opportunities.body.dsl_list[0].output_metrics=['其他金额'];
    if(kind==='wrong-selector')query.queryModes.filterId='absent';
    if(kind==='root-body')query.body=cases.contracts.body;
    if(kind==='root-binding')query.filterBindings={};
    if(kind==='unknown-field')cases.opportunities.filterBindings.region.queryField='';
    if(kind==='selector-predicate')cases.opportunities.filterBindings.business={target:'dimension',queryField:'business'};
    if(kind==='time-and-dimension')query.timeModes={filterId:'period',cases:{day:cases.contracts}};
    expect(validate(page).length).toBeGreaterThan(0);
  });
  it('also accepts a required single enum without a filterGroup',()=>{
    const page=load(),components=page.sections[1].components[0].props.components;
    const control=components.shift();page.filters[0].options=control.props.options;page.filters[0].selection={mode:'single',required:true};
    expect(validate(page)).toEqual([]);
    page.filters[0].selection.mode='multiple';expect(validate(page).length).toBeGreaterThan(0);
  });
  it('gates the feature at 6.50',()=>{
    const page=load();page.schemaVersion='6.49';expect(validate(page).some(error=>error.message.includes('6.50'))).toBe(true);
  });
  it('gates branch response mappings at 6.57',()=>{
    const page=load();page.schemaVersion='6.56';expect(validate(page).some(error=>error.message.includes('6.57'))).toBe(true);
  });
  it.each(['missing','unknown','duplicate','mixed-root','missing-branch','fake-alias','initial'])('rejects invalid response mapping: %s',kind=>{
    const page=load(),source=page.dataSources['amount-trend'],leaf=source.source.query.queryModes.cases.opportunities;
    if(kind==='missing')delete leaf.fieldMappings.amount;
    if(kind==='unknown')leaf.fieldMappings.unknown='商机金额';
    if(kind==='duplicate')leaf.fieldMappings.amount='月份';
    if(kind==='mixed-root')source.fields.amount.queryField='金额';
    if(kind==='missing-branch')delete leaf.fieldMappings;
    if(kind==='fake-alias')leaf.body.dsl_list[0].output_metrics=[{name:'商机金额',alias:'商机金额'}];
    if(kind==='initial')source.source.initial={capturedAt:'2026-10-23T00:00:00Z',rows:[]};
    expect(validate(page).length).toBeGreaterThan(0);
  });
  it('accepts explicit formula columns without treating ordinary metrics as formulas',()=>{
    const page=load(),leaf=page.dataSources['amount-trend'].source.query.queryModes.cases.opportunities;
    leaf.body.dsl_list[0].output_metrics=[{formula:'COUNT(*)',alias:'商机金额'}];
    expect(validate(page)).toEqual([]);
  });
  it('uses one coherent assignment when query branches and field selection share an enum',()=>{
    const page=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/query-mode-binding-branches-page.json','utf8'));
    const query=page.dataSources.main.source.query,leaf=query.queryModes.cases.a;
    query.queryModes={filterId:'currency',cases:{RMB:structuredClone(leaf),USD:structuredClone(leaf)}};
    for(const [currency,entry]of Object.entries(query.queryModes.cases) as Array<[string,typeof leaf]>)entry.body.dsl_list[0].filter.dims=[{dim_name:'currency_code',dim_value_list:[currency]}];
    const parsed=parsePage(page);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const variants=[...pageSelectionVariants(parsed.page)];expect(variants).toHaveLength(2);
    expect(variants.map(variant=>variant.sections[0].components[0].props)).toMatchObject([{rows:[{valueField:{field:'total-cny'}}]},{rows:[{valueField:{field:'total-usd'}}]}]);
  });
  it.each([undefined,{type:'dimension',values:[]},{type:'dimension',values:['contracts','opportunities']},{type:'dimension',values:['unknown']},{type:'timeRange',mode:'contracts'},{type:'dimension',values:['__proto__']}])('rejects invalid runtime choice %j without a first-case fallback',value=>{
    const parsed=parsePage(load());if(!parsed.ok)throw Error('page');
    const source=parsed.page.dataSources['amount-trend'].source;if(source.type!=='query')throw Error('source');
    expect(()=>selectQuery(source.query,new Map(value?[['business',value]]:[]))).toThrow();
  });
  it('checks the complete selection product before expanding variants',()=>{
    const page=load(),source=page.dataSources['amount-trend'];page.dataSources={};page.sections=[{id:'budget',components:[{id:'note',type:'text',layout:{span:12},props:{body:'组合预算验收'}}]}];page.filters=[];
    for(let index=0;index<13;index++){
      const id=`mode-${index}`,copy=structuredClone(source);copy.source.query.queryModes.filterId=id;
      for(const leaf of Object.values(copy.source.query.queryModes.cases) as any[])leaf.filterBindings={};
      page.dataSources[id]=copy;page.filters.push({id,type:'dimension',dimension:id,default:['contracts'],options:[{label:'签约',value:'contracts'},{label:'商机',value:'opportunities'}],selection:{mode:'single',required:true}});
    }
    expect(()=>validate(page)).not.toThrow();expect(validate(page)).toContainEqual(expect.objectContaining({path:'/dataSources',message:'查询模式组合超过4096'}));
  });
});
