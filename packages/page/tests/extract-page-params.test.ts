import { expect,it } from 'vitest';
import filled from '../fixtures/contract-valid/inline-params-values-page.json';
import { extractPageParams, applyPageParamSelection, resolvePageParams } from '../src';

function concrete() {
  const resolved=resolvePageParams(filled);if(!resolved.ok)throw Error('fixture');
  const p=JSON.parse(JSON.stringify(resolved.resolvedPage));delete p.params;
  p.dataSources.trend=structuredClone(p.dataSources.tokens);
  p.dataSources.trend.source.query.body.dsl_list[0].filter.time.is_aggregate=false;
  p.sections[0].components=[{id:'title',type:'text',layout:{span:12},props:{body:'Tokens'}}];
  return p;
}
it('extracts identical trusted dimension identity/range, selects explicitly and round-trips original DQE',()=>{
  const p=concrete();
  const extraction=extractPageParams(p,{baseline:'revision-1',dimensionIdentities:{tokens:{'区域':'region'},trend:{'区域':'region'}}});
  expect(extraction.ok).toBe(true);if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
  expect(extraction.candidates).toHaveLength(2);
  expect(extraction.candidates.every(c=>c.defaultSelected)).toBe(true);
  const selected=applyPageParamSelection(extraction,extraction.candidates.map(c=>c.id));
  expect(selected.ok).toBe(true);if(!selected.ok)throw Error(JSON.stringify(selected.issues));
  expect(selected.document.params?.every(p=>p.value===undefined&&p.default===undefined)).toBe(true);
  const result=resolvePageParams(selected.document,selected.originalValues);
  expect(result.ok).toBe(true);if(!result.ok)return;
  for(const id of Object.keys(p.dataSources))expect((result.resolvedPage.dataSources[id].source as any).query.body).toEqual(p.dataSources[id].source.query.body);
  expect(p.params).toBeUndefined();
});
it('does not merge same-named dimensions without identity or different values; single-source is unselected',()=>{
  const p=concrete();p.dataSources.trend.source.query.body.dsl_list[0].filter.dims[0].dim_value_list=['全球'];
  const e=extractPageParams(p,{baseline:'revision-1'});expect(e.ok).toBe(true);if(!e.ok)return;
  expect(e.candidates.filter(c=>c.declaration.type==='dimension')).toHaveLength(2);
  expect(e.candidates.filter(c=>c.declaration.type==='dimension').every(c=>!c.defaultSelected)).toBe(true);
  const single=concrete();delete single.dataSources.trend;
  const s=extractPageParams(single,{baseline:'revision-2'});if(!s.ok)throw Error('failed');
  expect(s.candidates.every(c=>!c.defaultSelected)).toBe(true);
});
it('preserves predicate order when a selected parameter initializes a filter before another fixed predicate',()=>{
  const p=concrete();p.filters=[{id:'region-filter',type:'dimension',dimension:'region',default:['中国区']}];
  p.dataSources.tokens.fields.region={type:'string',role:'dimension',queryField:'区域'};
  p.dataSources.tokens.source.query.body.dsl_list[0].output_dims=['区域'];
  p.dataSources.tokens.source.query.filterBindings={'region-filter':{target:'dimension',queryField:'区域'}};
  p.dataSources.tokens.source.query.body.dsl_list[0].filter.dims.push({dim_name:'模型',dim_value_list:['m1']});
  const e=extractPageParams(p,{baseline:'r1',dimensionIdentities:{tokens:{'区域':'region'},trend:{'区域':'region'}}});
  if(!e.ok)throw Error(JSON.stringify(e.issues));
  expect(applyPageParamSelection(e,['region']).ok).toBe(true);
});
