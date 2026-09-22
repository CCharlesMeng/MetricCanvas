import { expect, it } from 'vitest';
import timePage from '../fixtures/contract-valid/time-params-page.json';
import dimensionPage from '../fixtures/contract-valid/dimension-params-page.json';
import flowPage from '../../../pages/flow-analysis-report-params.json';
import { resolvePageParams, migrateParamBindings } from '../src';

const requiredDimensions=structuredClone(dimensionPage);
requiredDimensions.params[1].required=true;
requiredDimensions.params[1].default='Enterprise';
it.each([timePage,requiredDimensions,flowPage])('explicit migration preserves every executed DQE body and the original', (page) => {
  const original=JSON.stringify(page);
  const migrated=migrateParamBindings(page);
  expect(migrated.ok, JSON.stringify(migrated.issues)).toBe(true);
  if(!migrated.ok)throw Error(JSON.stringify(migrated.issues));
  const before=resolvePageParams(page), after=resolvePageParams(migrated.document);
  expect(before.ok&&after.ok).toBe(true);
  if(!before.ok||!after.ok)return;
  for(const id of Object.keys(page.dataSources)) {
    const a=before.resolvedPage.dataSources[id].source,b=after.resolvedPage.dataSources[id].source;
    if(a.type==='query'&&b.type==='query')expect(b.query.body).toEqual(a.query.body);
  }
  expect(JSON.stringify(page)).toBe(original);
});
it('rejects optional legacy query bindings instead of silently changing their semantics',()=>{
  expect(migrateParamBindings(dimensionPage).ok).toBe(false);
});
