import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '../src/validate';
import {projectFieldSelections,fieldSelectionVariants} from '../src/field-selection';
import {numberRangeIssue,rangeInBaseUnits,queryFilterIds} from '../src/amount-filter';
const doc=()=>JSON.parse(readFileSync('pages/ioc-header-currency-demo.json','utf8'));
const load=()=>{const result=parsePage(doc());if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
describe('static currency fields and amount rules',()=>{
 it('validates real declaration and selects coherent leaves and metadata without changing static fields',()=>{
  const page=load(),projection=projectFieldSelections(page,new Map([['currency',{type:'dimension',values:['USD']}]]));
  const table=projection.sections[0].components[2];if(table.type!=='table')throw Error();
  expect(table.props.columns[1]).toMatchObject({field:{field:'base-usd'},title:'预签金额（美元）'});
  expect(JSON.stringify(projection.sections)).not.toContain('byFilter');expect(page.dataSources).toEqual(projection.dataSources);
  expect([...fieldSelectionVariants(page)]).toHaveLength(2);expect(()=>projectFieldSelections(page,new Map())).toThrow();
  expect(JSON.stringify(projectFieldSelections(page,new Map(),true).sections)).toContain('等待合法币种选择');
 });
 it('preserves explicit business context and avoids repeating adaptive money units',()=>{const page=load();const card=page.sections[0].components[0];if(card.type!=='metricCard')throw Error();const row=card.props.rows[0];row.label='年累计';row.unit='元';row.valueField={byFilter:{filterId:'currency',cases:{RMB:{data:'main',field:'total-cny',format:'cny-adaptive'},USD:{data:'main',field:'total-usd',format:'usd-adaptive'}}}};const selected=projectFieldSelections(page,new Map([['currency',{type:'dimension',values:['USD']}]]));const output=selected.sections[0].components[0];if(output.type!=='metricCard')throw Error();expect(output.props.rows[0]).toMatchObject({label:'年累计',unit:'',valueField:{field:'total-usd',format:'usd-adaptive'}});expect(output.props.title).toBe(card.props.title);});
 it('does not infer new currency or selection capabilities from opaque legacy query values',()=>{const page=JSON.parse(readFileSync('pages/ioc-header-overview-demo.json','utf8'));page.schemaVersion='6.36';const query=Object.values(page.dataSources).find((source:any)=>source.source.type==='query') as any;query.source.query.body.dsl_list[0].opaque={byFilter:'业务值',currency:'USD',format:'usd-adaptive'};expect(parsePage(page).ok).toBe(true);});
 it('ignores opaque business data and streams projections sharing unchanged sources',()=>{const page=load();(page.dataSources as any).opaque={source:{type:'inline',rows:[{byFilter:'业务值'}]},fields:{}};const variants=fieldSelectionVariants(page);const first=variants.next().value!;expect(first.dataSources).toBe(page.dataSources);expect([...variants]).toHaveLength(1);});
 it('rejects direct bindings with the wrong static currency format',()=>{const page=doc();page.sections[0].components[2].props.columns[1].field={data:'main',field:'base-usd',format:'cny-adaptive'};expect(parsePage(page).ok).toBe(false);});
 it.each(['missing','extra','optional','field','currency','format','nested'])( 'rejects invalid %s branch even when RMB is the default',kind=>{
  const page=doc(),binding=page.sections[0].components[2].props.columns[1].field;
  if(kind==='missing')delete binding.byFilter.cases.USD;
  if(kind==='extra')binding.byFilter.cases.BAD=binding.byFilter.cases.USD;
  if(kind==='optional')page.filters[1].selection.required=false;
  if(kind==='field')binding.byFilter.cases.USD.field='missing';
  if(kind==='currency')binding.byFilter.cases.USD.field='base-cny';
  if(kind==='format')binding.byFilter.cases.USD.format='cny-adaptive';
  if(kind==='nested')binding.byFilter.cases.USD=binding;
  expect(parsePage(page).ok).toBe(false);
 });
 it('checks simultaneous table-column conflicts in the nondefault USD assignment',()=>{
  const page=doc();page.sections[0].components[2].props.columns[2].field.byFilter.cases.USD.field='base-usd';expect(parsePage(page).ok).toBe(false);
 });
 it('rejects mixed-currency compute even with equal display units',()=>{
  const page=doc();page.dataSources.main.fields['fee-usd'].unit='元';page.dataSources.main.compute[0].fields[1]='fee-usd';expect(parsePage(page).ok).toBe(false);
 });
 it('independently gates USD, amount ranges and selections at 6.37',()=>{const page=doc();page.schemaVersion='6.36';expect(parsePage(page).ok).toBe(false);});
 it('keeps legacy equality while strict amounts and overflow reject; display units multiply once',()=>{
  const filter=load().filters![2];if(filter.type!=='numberRange')throw Error();
  expect(numberRangeIssue(filter,{from:0})).toBeUndefined();expect(numberRangeIssue(filter,{to:0})).toBeUndefined();
  for(const value of [{from:-1},{from:1,to:1},{from:Infinity},{from:NaN},{from:2,to:1}])expect(numberRangeIssue(filter,value)).toBeTruthy();
  expect(numberRangeIssue({...filter,constraints:undefined},{from:1,to:1})).toBeTruthy();
  expect(numberRangeIssue({id:'old',type:'numberRange'},{from:1,to:1})).toBeUndefined();
  expect(rangeInBaseUnits(filter,{from:100},10000)).toEqual({from:1000000});expect(()=>rangeInBaseUnits(filter,{from:1e308},10000)).toThrow();
  const source=load().dataSources.main;if(source.source.type!=='query')throw Error();expect(queryFilterIds(source.source.query)).toEqual(['period','amount','currency']);
 });
 it('preserves explicit business context and avoids repeating adaptive money units',()=>{const page=load();const card=page.sections[0].components[0];if(card.type!=='metricCard')throw Error();const row=card.props.rows[0];row.label='年累计';row.unit='元';row.valueField={byFilter:{filterId:'currency',cases:{RMB:{data:'main',field:'total-cny',format:'cny-adaptive'},USD:{data:'main',field:'total-usd',format:'usd-adaptive'}}}};const selected=projectFieldSelections(page,new Map([['currency',{type:'dimension',values:['USD']}]]));const output=selected.sections[0].components[0];if(output.type!=='metricCard')throw Error();expect(output.props.rows[0]).toMatchObject({label:'年累计',unit:'',valueField:{field:'total-usd',format:'usd-adaptive'}});expect(output.props.title).toBe(card.props.title);});
 it('does not infer new currency or selection capabilities from opaque legacy query values',()=>{const page=JSON.parse(readFileSync('pages/ioc-header-overview-demo.json','utf8'));page.schemaVersion='6.36';const query=Object.values(page.dataSources).find((source:any)=>source.source.type==='query') as any;query.source.query.body.dsl_list[0].opaque={byFilter:'业务值',currency:'USD',format:'usd-adaptive'};expect(parsePage(page).ok).toBe(true);});
 it('ignores opaque business data and streams projections sharing unchanged sources',()=>{const page=load();(page.dataSources as any).opaque={source:{type:'inline',rows:[{byFilter:'业务值'}]},fields:{}};const variants=fieldSelectionVariants(page);const first=variants.next().value!;expect(first.dataSources).toBe(page.dataSources);expect([...variants]).toHaveLength(1);});
 it('rejects direct bindings with the wrong static currency format',()=>{const page=doc();page.sections[0].components[2].props.columns[1].field={data:'main',field:'base-usd',format:'cny-adaptive'};expect(parsePage(page).ok).toBe(false);});
 it.each(['missing','wrong','both'])( 'rejects %s metric selection contracts',kind=>{
  const page=doc(),binding=page.dataSources.main.source.query.filterBindings.amount;
  if(kind==='missing')delete binding.metricByFilter.cases.USD;
  if(kind==='wrong')binding.metricByFilter.cases.USD='ioc_amount_base_cny';
  if(kind==='both')binding.metric='ioc_amount_base_cny';
  expect(parsePage(page).ok).toBe(false);
 });
});
