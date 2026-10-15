import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import fixture from '../../../page/fixtures/contract-valid/report-date-filters-page.json';
import { exportComponentData, exportComponentSnapshot, type ExportRenderState } from '../src/export-render-state';

it('preserves successful table slots when a secondary source fails during report export', () => {
  const parsed=parsePage(fixture);if(!parsed.ok)throw Error('fixture');
  const page=parsed.page,component=page.sections[1].components[0];
  if(component.type!=='table')throw Error('fixture');
  page.dataSources.failed=structuredClone(page.dataSources.sales);
  component.data.extra='failed';
  const state:ExportRenderState={page,currentYear:2026,filters:new Map(),tables:{},headerFilters:{},summaries:{},snapshots:new Map([
    ['sales',{status:'ready',rows:[{entry:'available',amount:7}],totalCount:1}],
    ['failed',{status:'error',error:{code:'DQE_FORBIDDEN',message:'unavailable'}}]
  ])};
  expect(exportComponentSnapshot(state,component)).toMatchObject({status:'ready'});
  expect(exportComponentData(state,component).main?.snapshot.rows).toEqual([{entry:'available',amount:7}]);
  expect(exportComponentData(state,component).extra?.snapshot.rows).toEqual([]);
});
