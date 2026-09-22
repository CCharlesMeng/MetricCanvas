import { expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/inline-params-page.json';
import { validate, resolvePageParams, normalizePageDocument } from '../src';
import vectors from '../../../contracts/metriccanvas/page/conformance/inline-params.json';

it.each(vectors.cases)('shared inline contract: $name',vector=>{
  expect(normalizePageDocument(vector.input)).toEqual(vector.expected);
  expect(validate(vector.input).length===0).toBe(['unfilled-template','filled-range','anchor-window'].includes(vector.name));
});

it('accepts a complete unfilled Page, but never executes it without required values', () => {
  expect(validate(fixture)).toEqual([]);
  expect(resolvePageParams(fixture).ok).toBe(false);
});
it('rejects old-version required omission and uncontrolled/malformed query references', () => {
  const mutations = [
    (p:any) => { p.schemaVersion='6.4'; p.params=[{id:'region',type:'string'}]; p.dataSources={}; p.sections[0].components.pop(); },
    (p:any) => { p.dataSources.tokens.source.query.body.dsl_list[0].output_metrics=[{param:'region'}]; },
    (p:any) => { p.dataSources.tokens.source.query.body.dsl_list[0].filter.dims[0].dim_value_list={param:'region',extra:1}; },
    (p:any) => { p.dataSources.tokens.source.query.body.dsl_list[0].filter.time.part='other'; },
    (p:any) => { p.dataSources.tokens.source.query.paramBindings={region:{target:'dimension',queryField:'other'}}; }
  ];
  for(const mutate of mutations) {const p=structuredClone(fixture); mutate(p); expect(validate(p).length).toBeGreaterThan(0);}
});
it('resolves complete typed values and text together, preserving a filled reference document', () => {
  const result=resolvePageParams(fixture, {region:['中国区'],'report-period':{start:'2026-01',end:'2026-06',granularity:'month'}});
  expect(result.ok).toBe(true);
  if(!result.ok) return;
  expect((result.resolvedPage.sections[0].components[1].props as {body?:string}).body).toBe('2026-01 至 2026-06');
  expect(result.document.dataSources).toEqual(fixture.dataSources);
  expect(resolvePageParams({...fixture,sections:[]}).ok).toBe(false);
});
