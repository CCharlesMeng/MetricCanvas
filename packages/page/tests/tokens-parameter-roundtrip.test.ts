import {expect,it} from 'vitest';
import source from '../fixtures/parameter-extraction/tokens-parameter-source.json';
import {extractPageParams,applyPageParamSelection,resolvePageParams,validate} from '../src';

export function tokensTemplate(){
  const identities=Object.fromEntries(Object.keys(source.dataSources).map(id=>[id,{'区域':'region'}]));
  const e=extractPageParams(source,{baseline:'tokens-r1',dimensionIdentities:identities});
  if(!e.ok)throw Error(JSON.stringify(e.issues));
  const s=applyPageParamSelection(e,e.candidates.map(c=>c.id));
  if(!s.ok)throw Error(JSON.stringify(s.issues));
  return {e,s};
}
it('Tokens: all five verified queries round-trip, changed region/period changes only values and authorized DQE targets',()=>{
  const original=structuredClone(source);const {e,s}=tokensTemplate();
  expect(e.candidates.map(c=>[c.id,c.coveredQueries.length,c.defaultSelected])).toEqual([['region',5,true],['report-period',5,true]]);
  expect(validate(s.document)).toEqual([]);
  expect(Object.values(s.document.dataSources).every(d=>!('initial' in d.source))).toBe(true);
  for(const inputs of [s.originalValues,{region:'欧洲区','report-period':{start:'2026-07',end:'2026-12',granularity:'month'}}]){
    const r=resolvePageParams(s.document,inputs);expect(r.ok).toBe(true);if(!r.ok)throw Error(JSON.stringify(r.issues));
    const stripped=structuredClone(r.document);if(!Array.isArray(stripped.params))throw Error('expected legacy array');stripped.params.forEach(p=>delete p.value);expect(stripped).toEqual(s.document);
    expect(resolvePageParams(s.document,inputs)).toEqual(r);
    for(const [id,ds] of Object.entries(r.resolvedPage.dataSources)){
      if(ds.source.type!=='query')throw Error('query');
      const before=structuredClone((source.dataSources as any)[id].source.query.body);
      before.dsl_list[0].filter.dims[0].dim_value_list=[inputs.region];
      Object.assign(before.dsl_list[0].filter.time,{start:(inputs['report-period'] as any).start,end:(inputs['report-period'] as any).end});
      expect(ds.source.query.body).toEqual(before);
    }
  }
  expect(source).toEqual(original);
});
it('stable ids survive label changes and repeated preparation; stale source and unknown selections fail closed',()=>{
  const {e}=tokensTemplate();const previous=structuredClone(e.candidates);previous[0].declaration.label='不同显示名';
  const next=extractPageParams(source,{baseline:'tokens-r2',dimensionIdentities:Object.fromEntries(Object.keys(source.dataSources).map(id=>[id,{'区域':'region'}])),previousCandidates:previous});
  expect(next.ok&&next.candidates.map(c=>c.id)).toEqual(e.candidates.map(c=>c.id));
  expect(applyPageParamSelection(e,['report_period']).ok).toBe(false);
  e.source.id='changed';expect(applyPageParamSelection(e,[]).ok).toBe(false);
});
it('coverage defaults require a strict majority and more than one query, without extracting groupBy or metric conditions',()=>{
  const raw=structuredClone(source) as any;const ids=Object.keys(raw.dataSources);
  for(const [i,id] of ids.entries()){
    raw.dataSources[id].source.query.body.dsl_list[0].filter.dims[0].dim_value_list=[i<3?'中国区':'欧洲区'];
    raw.dataSources[id].source.query.body.dsl_list[0].filter.metrics=[{metric_name:'Tokens消耗量',operator:'gt',value:100}];
  }
  const e=extractPageParams(raw,{baseline:'coverage-r1',dimensionIdentities:Object.fromEntries(ids.map(id=>[id,{'区域':'region'}]))});if(!e.ok)throw Error(JSON.stringify(e.issues));
  const dimensions=e.candidates.filter(c=>c.declaration.type==='dimension');expect(dimensions).toHaveLength(2);
  expect(dimensions.find(c=>c.originalValue==='中国区')).toMatchObject({defaultSelected:true,uncoveredQueries:expect.any(Array)});
  expect(dimensions.find(c=>c.originalValue==='欧洲区')?.defaultSelected).toBe(false);
  expect(e.candidates).toHaveLength(3);
  const chosen=dimensions.find(c=>c.originalValue==='中国区')!;
  const selected=applyPageParamSelection(e,[chosen.id]);if(!selected.ok)throw Error(JSON.stringify(selected.issues));
  for(const id of chosen.uncoveredQueries)expect(selected.document.dataSources[id]).toEqual({...raw.dataSources[id],source:{type:'query',query:raw.dataSources[id].source.query}});
});
it('composite literal text requires an explicit reviewed replacement, never a global string substitution',()=>{
  const raw=structuredClone(source);raw.sections[0].components[0].props={body:'中国区：Tokens'} as any;
  const e=extractPageParams(raw,{baseline:'r1',dimensionIdentities:Object.fromEntries(Object.keys(raw.dataSources).map(id=>[id,{'区域':'region'}]))});if(!e.ok)throw Error('fixture');
  expect(applyPageParamSelection(e,['region']).ok).toBe(false);
  const selected=applyPageParamSelection(e,['region'],{'/sections/0/components/0/props/body':{param:'region'}});
  expect(selected.ok).toBe(true);
  const none=applyPageParamSelection(e,[]);expect(none.ok&&none.document.sections).toEqual(raw.sections);
});
